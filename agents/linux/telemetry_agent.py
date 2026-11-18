#!/usr/bin/env python3
"""
SpyderXDR Telemetry Agent (Fluentd edition)
============================================
This agent collects host telemetry and forwards it to the LOCAL Fluentd
HTTP input (port 9880).  Fluentd then buffers the data in Redis and fans
it out to:
  1. The SpyderXDR FastAPI ingest endpoint  (/api/v1/events/ingest)
  2. The Kafka topic  spyderxdr.telemetry   (for live-streaming to the UI)

It is a drop-in replacement for agents/linux/agent.py and keeps 100% of
the existing telemetry collection logic intact.

Environment variables:
  SPYDERXDR_SERVER   – FastAPI base URL (used only for health-check fallback)
  FLUENTD_URL        – Fluentd HTTP endpoint  (default: http://localhost:9880)
  AGENT_ID           – Optional fixed agent UUID
  COLLECTION_INTERVAL – Seconds between collection runs (default: 30)
"""

import hashlib
import hmac
import json
import logging
import os
import platform
import socket
import subprocess
import time
import uuid
from datetime import datetime

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("spyderxdr-agent")

# ─── Configuration ──────────────────────────────────────────────────────────
FLUENTD_URL         = os.getenv("FLUENTD_URL", "http://localhost:9880")
SERVER_URL          = os.getenv("SPYDERXDR_SERVER", "http://localhost:8000")
AGENT_KEY           = "secure_key_argus_hmac"   # must match backend
COLLECTION_INTERVAL = int(os.getenv("COLLECTION_INTERVAL", "30"))


def _load_config() -> dict:
    """Load config.json from script directory or /opt/argus/."""
    dirs = [os.path.dirname(os.path.abspath(__file__)), "/opt/argus"]
    for d in dirs:
        path = os.path.join(d, "config.json")
        if os.path.exists(path):
            try:
                with open(path) as f:
                    return json.load(f)
            except Exception:
                pass
    return {}


_cfg = _load_config()
AGENT_ID  = os.getenv("AGENT_ID") or _cfg.get("agent_id") or str(uuid.uuid4())
HOSTNAME  = os.getenv("COMPUTERNAME") or os.getenv("HOSTNAME") or platform.node() or socket.gethostname()


# ─── Telemetry collectors (identical logic to the original agent) ────────────

def _run_host_command(command: list[str], fallback_cmd: list[str] | None = None) -> str:
    """Run the best available host command for the current OS."""
    try:
        if os.name == "nt":
            result = subprocess.run(
                ["powershell.exe", "-NoProfile", "-Command", " ".join(command)],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                timeout=30,
            )
            return result.stdout or result.stderr or ""

        result = subprocess.run(command, capture_output=True, text=True, timeout=30)
        return result.stdout or result.stderr or ""
    except Exception:
        if fallback_cmd:
            try:
                result = subprocess.run(fallback_cmd, capture_output=True, text=True, timeout=30)
                return result.stdout or result.stderr or ""
            except Exception:
                return ""
        return ""


def collect_process_events() -> list:
    try:
        if os.name == "nt":
            raw = _run_host_command([
                "Get-CimInstance Win32_Process | Select-Object Name, CommandLine, ParentProcessId | ConvertTo-Json -Compress"
            ])
        else:
            raw = _run_host_command(["ps", "auxww"], ["ps", "-eo", "pid,comm,args"])

        return [{
            "event_type": "process_creation",
            "timestamp":  datetime.utcnow().isoformat(),
            "source_ip":  "127.0.0.1",
            "hostname":   HOSTNAME,
            "agent_id":   AGENT_ID,
            "event_data": {"raw": raw[:4000]},
        }]
    except Exception as e:
        logger.error("process events: %s", e)
        return []


def collect_network_events() -> list:
    try:
        if os.name == "nt":
            raw = _run_host_command([
                "Get-NetTCPConnection -State Established | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort | ConvertTo-Json -Compress"
            ])
        else:
            raw = _run_host_command(["ss", "-tuanp"], ["netstat", "-tuanp"])

        return [{
            "event_type": "network_connection",
            "timestamp":  datetime.utcnow().isoformat(),
            "source_ip":  "127.0.0.1",
            "hostname":   HOSTNAME,
            "agent_id":   AGENT_ID,
            "event_data": {"raw": raw[:4000]},
        }]
    except Exception as e:
        logger.error("network events: %s", e)
        return []


_fim_cache: dict = {}

def collect_file_events() -> list:
    events = []
    paths = [r"C:\\Windows\\System32\\drivers\\etc\\hosts", r"C:\\Windows\\System32\\drivers\\etc\\networks"] if os.name == "nt" else ["/etc/hosts", "/etc/resolv.conf"]
    for path in paths:
        if not os.path.exists(path):
            continue
        try:
            data = open(path, "rb").read()
            current_hash = hashlib.md5(data).hexdigest()
            if path in _fim_cache and _fim_cache[path] != current_hash:
                events.append({
                    "event_type": "file_modified",
                    "timestamp":  datetime.utcnow().isoformat(),
                    "source_ip":  "127.0.0.1",
                    "hostname":   HOSTNAME,
                    "agent_id":   AGENT_ID,
                    "event_data": {"file_path": path, "action": "modified", "hash": current_hash},
                })
            _fim_cache[path] = current_hash
        except Exception as e:
            logger.error("FIM %s: %s", path, e)
    return events


def collect_auth_events() -> list:
    events = []
    log = "/var/log/auth.log"
    if not os.path.exists(log):
        return events
    try:
        lines = open(log).readlines()[-20:]
        for line in lines:
            if "failed" in line.lower() or "accepted" in line.lower():
                events.append({
                    "event_type": "authentication",
                    "timestamp":  datetime.utcnow().isoformat(),
                    "source_ip":  "127.0.0.1",
                    "hostname":   HOSTNAME,
                    "agent_id":   AGENT_ID,
                    "event_data": {"raw": line.strip()},
                })
    except Exception as e:
        logger.error("auth events: %s", e)
    return events


def collect_sca_events() -> list:
    return [{
        "event_type": "compliance",
        "timestamp":  datetime.utcnow().isoformat(),
        "source_ip":  "127.0.0.1",
        "hostname":   HOSTNAME,
        "agent_id":   AGENT_ID,
        "event_data": {
            "standards":   ["CIS Linux Benchmark"],
            "control_id":  "CIS-1.1.1",
            "status":      "passed" if os.path.exists("/etc/passwd") else "failed",
        },
    }]


def collect_all() -> list:
    events = []
    events.extend(collect_process_events())
    events.extend(collect_network_events())
    events.extend(collect_file_events())
    events.extend(collect_auth_events())
    events.extend(collect_sca_events())
    return events


# ─── Sending via Fluentd HTTP ────────────────────────────────────────────────

def _build_payload(events: list) -> dict:
    return {
        "hostname":  HOSTNAME,
        "agent_id":  AGENT_ID,
        "events":    events,
    }


def _sign(payload_bytes: bytes) -> str:
    return hmac.new(
        AGENT_KEY.encode(),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()


def send_via_fluentd(events: list) -> bool:
    """
    POST the telemetry batch to Fluentd's HTTP input.
    Fluentd will buffer it in Redis and forward to both FastAPI and Kafka.
    """
    payload = _build_payload(events)
    payload_bytes = json.dumps(payload).encode()
    signature = _sign(payload_bytes)

    try:
        resp = requests.post(
            f"{FLUENTD_URL}/spyderxdr.telemetry",
            data=payload_bytes,
            headers={
                "Content-Type":     "application/json",
                "X-Argus-Signature": signature,
            },
            timeout=10,
        )
        if resp.status_code in (200, 204):
            logger.info("✅ Sent %d events → Fluentd", len(events))
            return True
        else:
            logger.warning("Fluentd returned %s: %s", resp.status_code, resp.text[:200])
            return False
    except requests.exceptions.ConnectionError:
        logger.warning("⚠️  Fluentd unreachable – falling back to direct ingest")
        return False


def send_direct(events: list) -> bool:
    """Fallback: bypass Fluentd and POST directly to FastAPI (original behaviour)."""
    payload = _build_payload(events)
    payload_bytes = json.dumps(payload).encode()
    signature = _sign(payload_bytes)

    try:
        resp = requests.post(
            f"{SERVER_URL}/api/v1/events/ingest",
            data=payload_bytes,
            headers={
                "Content-Type":      "application/json",
                "X-Argus-Signature": signature,
            },
            timeout=10,
        )
        if resp.status_code == 200:
            logger.info("✅ Sent %d events → FastAPI (direct fallback)", len(events))
            return True
        logger.error("Direct ingest failed: %s", resp.status_code)
    except Exception as e:
        logger.error("Direct ingest error: %s", e)
    return False


# ─── Main loop ───────────────────────────────────────────────────────────────

def main():
    logger.info("🚀 SpyderXDR Agent started  hostname=%s  agent_id=%s", HOSTNAME, AGENT_ID)
    logger.info("   Fluentd endpoint : %s", FLUENTD_URL)
    logger.info("   Fallback backend : %s", SERVER_URL)
    logger.info("   Collection every : %ds", COLLECTION_INTERVAL)

    while True:
        try:
            events = collect_all()
            if events:
                sent = send_via_fluentd(events)
                if not sent:
                    send_direct(events)
            time.sleep(COLLECTION_INTERVAL)
        except KeyboardInterrupt:
            logger.info("⛔ Agent stopped by user")
            break
        except Exception as e:
            logger.error("Unexpected error: %s", e)
            time.sleep(5)


if __name__ == "__main__":
    main()
