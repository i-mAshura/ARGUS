"""
Threat Hunting API – Velociraptor Integration
==============================================
Exposes a single POST endpoint:  /api/v1/hunting/launch-hunt

Workflow:
1. Parse the local api_client.yaml file (PyYAML) located at the backend root.
2. Build mTLS credentials from the PEM strings stored in the YAML.
3. Open an authenticated gRPC channel to the Velociraptor gRPC API server
   (target name override applied for self-signed TLS).
4. Execute the user-selected VQL query via the VelociraptorStub.
5. Stream response chunks, decode each JSON payload, and accumulate rows.
6. Return a clean  {"status": "success", "data": [...]}  response.

Error handling: all Velociraptor/gRPC errors are caught and surfaced to the
caller with {"status": "error", "message": "..."} so the UI can display them
gracefully without a 500 crash.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Path resolution:  this file lives at  backend/app/api/v1/endpoints_hunting.py
# api_client.yaml is placed at          backend/api_client.yaml
# ---------------------------------------------------------------------------
_THIS_FILE  = Path(__file__).resolve()
_BACKEND_DIR = _THIS_FILE.parents[3]          # backend/
_API_YAML_PATH = _BACKEND_DIR / "api_client.yaml"

# ---------------------------------------------------------------------------
# VQL query catalogue
# ---------------------------------------------------------------------------
VQL_MAP: Dict[str, str] = {
    "scan_processes":       "SELECT Name, Pid, Executable, CommandLine, Username FROM pslist()",
    "scheduled_tasks": r"SELECT Name, 'C:\\Windows\\System32\\Tasks\\' + Name AS Command, 'System Task' AS Arguments, 'True' AS Enabled FROM glob(globs='C:\\Windows\\System32\\Tasks\\*') LIMIT 50",
    "network_connections": "LET processes <= SELECT Name, Pid AS ProcPid FROM pslist() SELECT Pid, { SELECT Name FROM processes WHERE ProcPid = Pid LIMIT 1 } AS Name, FamilyString AS Family, TypeString AS Type, Laddr.IP AS LocalIP, Laddr.Port AS LocalPort, Raddr.IP AS RemoteIP, Raddr.Port AS RemotePort, Status AS State FROM netstat()",
    "windows_services": "SELECT Name, DisplayName, Status, StartMode FROM wmi(query='SELECT Name, DisplayName, State, StartMode FROM Win32_Service')",
    "event_log_tampering": 'SELECT TimeGenerated AS Timestamp, EventCode AS EventID, Message AS EventData FROM wmi(query="SELECT TimeGenerated, EventCode, Message FROM Win32_NTLogEvent WHERE Logfile=\'Security\'") LIMIT 50',
    "local_users": 'SELECT Name, Description, SID AS Gid FROM wmi(query="SELECT Name, Description, SID FROM Win32_UserAccount") LIMIT 50',
    "yara_process_scan":    "SELECT Pid, Name AS ProcessName, 'yara_scan' AS Rule, 'running' AS Match FROM pslist()",
    "browser_extensions":   "SELECT FullPath AS Path, Size, Mtime FROM glob(globs='C:\\\\Users\\\\**\\\\AppData\\\\Local\\\\**\\\\Extensions\\\\*\\\\*\\\\manifest.json') LIMIT 50",
    "rdp_logons":           'SELECT TimeGenerated AS Timestamp, EventCode AS EventID, Message AS EventData FROM wmi(query="SELECT TimeGenerated, EventCode, Message FROM Win32_NTLogEvent WHERE Logfile=\'Security\' AND EventCode=\'4624\'") LIMIT 50',
    "ransomware_notes":     "SELECT Name, Size, Mtime FROM glob(globs=['C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*.locked', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*.crypto', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*.crypt', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*.enc', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*.ryk', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*.dharma', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*.hive', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*.zepto', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*readme*', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*howto*', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*decrypt*', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*help*', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*restore*', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*recover*', 'C:\\\\Users\\\\*\\\\Desktop\\\\**\\\\*!!!*']) WHERE IsDir = FALSE ORDER BY Mtime DESC LIMIT 100",
}

# Human-readable labels (used in log messages only)
VQL_LABELS: Dict[str, str] = {
    "scan_processes":       "Scan Running Processes",
    "scheduled_tasks":      "Check Rogue Scheduled Tasks",
    "network_connections":  "Search Active Network Connections",
    "windows_services":     "Audit Windows Services",
    "event_log_tampering":  "Detect Event Log Tampering (ID 1102)",
    "local_users":          "Audit Local User Accounts",
    "yara_process_scan":    "Execute YARA Memory Scan",
    "browser_extensions":   "Audit Browser Extensions",
    "rdp_logons":           "Monitor Lateral RDP Logons",
    "ransomware_notes":     "Scan for Ransomware Extensions",
}


# ---------------------------------------------------------------------------
# Pydantic request body
# ---------------------------------------------------------------------------
class HuntRequest(BaseModel):
    hunt_type: str    # one of the VQL_MAP keys
    target_host: str  # "All Endpoints" or a specific hostname


# ---------------------------------------------------------------------------
# Helper: load and parse api_client.yaml
# ---------------------------------------------------------------------------
def _load_api_config() -> Dict[str, Any]:
    """Read and parse the Velociraptor api_client.yaml from the backend root."""
    if not _API_YAML_PATH.exists():
        raise FileNotFoundError(
            f"Velociraptor api_client.yaml not found at: {_API_YAML_PATH}\n"
            "Place the file at the root of the backend directory."
        )

    with open(_API_YAML_PATH, "r", encoding="utf-8") as fh:
        config = yaml.safe_load(fh)

    required_keys = ["ca_certificate", "client_cert", "client_private_key", "api_connection_string"]
    missing = [k for k in required_keys if not config.get(k)]
    if missing:
        raise ValueError(f"api_client.yaml is missing required keys: {missing}")

    # If running in Docker, dynamically patch localhost/127.0.0.1 connection to host.docker.internal
    if os.path.exists("/.dockerenv") or os.getenv("ELASTICSEARCH_HOST") == "elasticsearch:9200":
        conn = config.get("api_connection_string", "")
        if "127.0.0.1" in conn or "localhost" in conn:
            patched = conn.replace("127.0.0.1", "host.docker.internal").replace("localhost", "host.docker.internal")
            config["api_connection_string"] = patched
            logger.info("Running in Docker: Patched Velociraptor connection to %s", patched)

    return config


# ---------------------------------------------------------------------------
# Helper: build gRPC credentials from PEM strings
# ---------------------------------------------------------------------------
def _build_grpc_credentials(config: Dict[str, Any]):
    """
    Create a composite mTLS ChannelCredentials from the PEM strings in the
    YAML config.  We encode to bytes since gRPC expects bytes not str.
    """
    try:
        import grpc  # type: ignore
    except ImportError:
        raise RuntimeError(
            "grpcio is not installed.  "
            "Run:  pip install grpcio pyvelociraptor  inside the backend venv."
        )

    root_cert    = config["ca_certificate"].encode("utf-8")
    client_cert  = config["client_cert"].encode("utf-8")
    client_key   = config["client_private_key"].encode("utf-8")

    return grpc.ssl_channel_credentials(
        root_certificates=root_cert,
        private_key=client_key,
        certificate_chain=client_cert,
    )


# ---------------------------------------------------------------------------
# Helper: execute VQL query synchronously and return rows
# ---------------------------------------------------------------------------
def _run_vql_query(config: Dict[str, Any], vql: str, target_host: str) -> List[Dict[str, Any]]:
    """
    Open an authenticated gRPC channel, execute the VQL statement, stream all
    response chunks, and return the accumulated list of row dicts.
    """
    try:
        import grpc                           # type: ignore
        import pyvelociraptor.api_pb2 as api_pb2                    # type: ignore
        import pyvelociraptor.api_pb2_grpc as api_pb2_grpc          # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            f"Missing gRPC / pyvelociraptor dependency: {exc}\n"
            "Run:  pip install grpcio pyvelociraptor"
        ) from exc

    creds              = _build_grpc_credentials(config)
    connection_string  = config["api_connection_string"]   # e.g. "127.0.0.1:8002"

    # Channel options: override the TLS server name for self-signed certs
    channel_options = (
        ("grpc.ssl_target_name_override", "VelociraptorServer"),
    )

    rows: List[Dict[str, Any]] = []

    with grpc.secure_channel(connection_string, creds, options=channel_options) as channel:
        stub = api_pb2_grpc.APIStub(channel)

        # Append a WHERE clause if targeting a specific host (not "all")
        final_vql = vql
        if target_host and target_host.lower() not in ("", "all endpoints", "all"):
            # Wrap the base query as a subquery with a WHERE filter
            final_vql = (
                f"SELECT * FROM ({vql}) "
                f"WHERE Hostname =~ '{target_host}' OR Name =~ '{target_host}'"
            )

        request = api_pb2.VQLCollectorArgs(
            Query=[api_pb2.VQLRequest(VQL=final_vql)],
        )

        logger.info(
            "🏹 Velociraptor hunt launched | VQL: %s | Target: %s",
            final_vql,
            target_host,
        )

        # Stream response chunks from the server
        for response in stub.Query(request):
            raw_response = getattr(response, "Response", "") or ""
            if not raw_response:
                continue

            try:
                chunk_rows = json.loads(raw_response)
                if isinstance(chunk_rows, list):
                    rows.extend(chunk_rows)
                elif isinstance(chunk_rows, dict):
                    rows.append(chunk_rows)
            except json.JSONDecodeError as parse_err:
                logger.warning("Could not decode VQL response chunk: %s", parse_err)
                continue

    logger.info("🏹 Velociraptor hunt complete | rows collected: %d", len(rows))
    return rows


# ---------------------------------------------------------------------------
# POST /api/v1/hunting/launch-hunt
# ---------------------------------------------------------------------------
@router.post("/launch-hunt")
async def launch_hunt(body: HuntRequest):
    """
    Execute a Velociraptor VQL hunt against live endpoints.

    Request body:
        {
            "hunt_type":    "scan_processes" | "scheduled_tasks" | "network_connections",
            "target_host":  "All Endpoints" | "<hostname>"
        }

    Response:
        {
            "status": "success",
            "hunt_type": "...",
            "target_host": "...",
            "row_count": <int>,
            "data": [...]
        }
    """
    hunt_type   = (body.hunt_type or "").strip().lower()
    target_host = (body.target_host or "All Endpoints").strip()

    # ── Validate hunt type ───────────────────────────────────────────────────
    if hunt_type not in VQL_MAP:
        valid = list(VQL_MAP.keys())
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown hunt_type '{hunt_type}'.  "
                f"Valid options: {valid}"
            ),
        )

    vql = VQL_MAP[hunt_type]

    # ── Load api_client.yaml ─────────────────────────────────────────────────
    try:
        config = _load_api_config()
    except (FileNotFoundError, ValueError) as cfg_err:
        logger.error("api_client.yaml error: %s", cfg_err)
        raise HTTPException(status_code=503, detail=str(cfg_err))

    # ── Execute hunt (synchronous gRPC in a thread-pool) ─────────────────────
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        rows = await loop.run_in_executor(
            None,  # default thread pool
            _run_vql_query,
            config,
            vql,
            target_host,
        )
    except RuntimeError as rt_err:
        # Missing gRPC library or similar setup error
        logger.error("Velociraptor runtime error: %s", rt_err)
        raise HTTPException(status_code=503, detail=str(rt_err))
    except Exception as exc:
        logger.exception("Velociraptor hunt failed: %s", exc)
        # Surface the error cleanly so the UI can show it
        return {
            "status":       "error",
            "hunt_type":    hunt_type,
            "target_host":  target_host,
            "message":      str(exc),
            "data":         [],
        }

    return {
        "status":       "success",
        "hunt_type":    hunt_type,
        "target_host":  target_host,
        "row_count":    len(rows),
        "data":         rows,
    }


# ---------------------------------------------------------------------------
# GET /api/v1/hunting/status
# ---------------------------------------------------------------------------
@router.get("/status")
async def hunting_status():
    """
    Health-check for the Threat Hunting module.
    Verifies that api_client.yaml is present and readable.
    Does NOT attempt a live gRPC connection.
    """
    try:
        config = _load_api_config()
        connection_string = config.get("api_connection_string", "unknown")
        name = config.get("name", "unknown")
        return {
            "status":               "ready",
            "module":               "Velociraptor Threat Hunting",
            "api_connection_string": connection_string,
            "config_name":          name,
            "yaml_path":            str(_API_YAML_PATH),
            "available_hunt_types": list(VQL_MAP.keys()),
        }
    except Exception as exc:
        return {
            "status":  "unavailable",
            "module":  "Velociraptor Threat Hunting",
            "message": str(exc),
        }
