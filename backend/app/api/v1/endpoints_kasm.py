"""
Kasm Remote Browser Isolation API
===================================
Bridge to a Kasm Workspaces routing flow.

Two modes:
  1. DEMO mode (default) — interpolates a placeholder URL for local testing.
  2. LIVE mode — calls the real Kasm REST API to create a browser session,
     then returns the session URL to the frontend.

Switch to LIVE mode by setting KASM_MODE=live in your .env file and
providing the connection details below.

Example .env entries:
    KASM_MODE=live
    KASM_BASE_URL=https://kasm.yourcompany.com
    KASM_API_KEY=your_api_key
    KASM_API_SECRET=your_api_secret
    KASM_WORKSPACE_ID=your_workspace_id   # optional; default = Chrome browser image
    KASM_USER_ID=your_user_id             # optional; default = admin user
"""

import asyncio
import logging
import os
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Configuration — read from environment / .env
# ---------------------------------------------------------------------------

# Mode: "demo" (placeholder URL) or "live" (real Kasm API)
KASM_MODE = os.getenv("KASM_MODE", "demo").strip().lower()

# Kasm server base URL (used in both modes)
KASM_BASE_URL = os.getenv("KASM_BASE_URL", "https://kasm.local").rstrip("/")

# Kasm API credentials (LIVE mode only)
KASM_API_KEY    = os.getenv("KASM_API_KEY", "")
KASM_API_SECRET = os.getenv("KASM_API_SECRET", "")

# Which Kasm workspace image to launch (LIVE mode only)
# Default "2" is typically the Chrome browser workspace on most Kasm installs
KASM_WORKSPACE_ID = os.getenv("KASM_WORKSPACE_ID", "2")

# Which Kasm user will own the session (LIVE mode only)
# The default admin user ID on a fresh Kasm install is usually "1"
KASM_USER_ID = os.getenv("KASM_USER_ID", "1")

# SSL certificate verification (LIVE mode only)
# Set to "false" to disable verification (e.g. self-signed certs)
KASM_SSL_VERIFY = os.getenv("KASM_SSL_VERIFY", "true").strip().lower() in ("true", "1", "yes")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class KasmRequest(BaseModel):
    """POST /api/v1/kasm/request body."""
    target_url: str


class KasmResponse(BaseModel):
    """Structured Kasm isolation response."""
    kasm_url: str
    status: str = "success"
    mode: str = "demo"  # "demo" or "live"


# ---------------------------------------------------------------------------
# Internal helpers — demo mode
# ---------------------------------------------------------------------------
def _build_demo_url(request: Request, target_url: str) -> str:
    """Placeholder URL builder for local development — no Kasm server needed."""
    encoded = quote(target_url, safe="")
    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/api/v1/kasm/session_placeholder?url={encoded}"


@router.get("/session_placeholder", response_class=HTMLResponse)
async def session_placeholder(url: str):
    """Serve the kasm-mock.html mock template."""
    from pathlib import Path
    
    # Try finding the kasm-mock.html file by traversing parents from this file
    mock_path = Path(__file__).resolve().parent.parent.parent.parent.parent / "kasm-mock.html"
    
    # If not found at parent[5], look at other candidates relative to this file
    if not mock_path.exists():
        p = Path(__file__).resolve()
        for _ in range(6):
            p = p.parent
            candidate = p / "kasm-mock.html"
            if candidate.exists():
                mock_path = candidate
                break

    if not mock_path.exists():
        # Fallback HTML content if the mock file is not found
        return HTMLResponse(
            content="""<!DOCTYPE html>
<html>
<head><title>Kasm Mock Session</title></head>
<body style="margin:0;background:#0d0e16;color:#e3e4e8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
  <div style="text-align:center;">
    <h2>Kasm RBI Session (Mock)</h2>
    <p>Investigating: <span style="color:#f05a28;">{}</span></p>
  </div>
</body>
</html>""".format(url)
        )

    try:
        content = mock_path.read_text(encoding="utf-8")
        return HTMLResponse(content=content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read mock file: {e}")


# ---------------------------------------------------------------------------
# Internal helpers — live Kasm API mode
# ---------------------------------------------------------------------------
async def _destroy_existing_sessions(client) -> None:
    """
    Destroy all existing Kasm sessions for the configured user.

    This prevents stale sessions from causing Kasm's web UI to show
    "resume" errors or redirect to its dashboard instead of directly
    connecting to the new Chrome session.
    """
    try:
        # Get all sessions for this user
        get_url = f"{KASM_BASE_URL}/api/public/get_kasms"
        resp = await client.post(get_url, json={
            "api_key":        KASM_API_KEY,
            "api_key_secret": KASM_API_SECRET,
            "user_id":        KASM_USER_ID,
        })

        if resp.status_code != 200:
            logger.warning("Could not list existing sessions (HTTP %d)", resp.status_code)
            return

        data = resp.json()
        kasms = data.get("kasms") or data.get("data") or []

        if not kasms:
            logger.debug("No existing sessions to clean up")
            return

        # Destroy each existing session
        destroy_url = f"{KASM_BASE_URL}/api/public/destroy_kasm"
        for kasm in kasms:
            kid = kasm.get("kasm_id") or kasm.get("id")
            if not kid:
                continue
            try:
                dr = await client.post(destroy_url, json={
                    "api_key":        KASM_API_KEY,
                    "api_key_secret": KASM_API_SECRET,
                    "kasm_id":        kid,
                    "user_id":        KASM_USER_ID,
                })
                logger.info("Destroyed stale session %s (HTTP %d)", kid, dr.status_code)
            except Exception as e:
                logger.warning("Failed to destroy session %s: %s", kid, e)

        # ── Step 0.5: Wait for Docker/Kasm to fully clean up terminated sessions ──
        for poll_attempt in range(5):
            await asyncio.sleep(1.0)
            check_resp = await client.post(get_url, json={
                "api_key":        KASM_API_KEY,
                "api_key_secret": KASM_API_SECRET,
                "user_id":        KASM_USER_ID,
            })
            if check_resp.status_code == 200:
                check_data = check_resp.json()
                active_kasms = check_data.get("kasms") or check_data.get("data") or []
                if not active_kasms:
                    logger.info("All existing sessions successfully cleared from Docker.")
                    break
                else:
                    logger.debug("Waiting for sessions to clear... attempt %d/5", poll_attempt + 1)
            else:
                break

    except Exception as e:
        logger.warning("Error cleaning up existing sessions: %s", e)


async def _create_kasm_session(target_url: str) -> str:
    """
    Call the Kasm Workspaces REST API to create a browser session.

    The session will navigate to ``target_url`` so the analyst can inspect it
    inside the isolated browser.

    References:
        https://kasmweb.com/docs/latest/developers/developer_api.html
    """
    if not KASM_API_KEY or not KASM_API_SECRET:
        raise RuntimeError(
            "KASM_API_KEY and KASM_API_SECRET must be set in .env when "
            "KASM_MODE=live"
        )

    # Kasm Developer API — correct endpoint for Kasm 1.16.x / 1.17.x
    # References:
    #   https://kasmweb.com/docs/latest/developers/developer_api.html
    api_url = f"{KASM_BASE_URL}/api/public/request_kasm"
    logger.info("Requesting Kasm session at %s for target: %s", api_url, target_url)

    payload = {
        "api_key":        KASM_API_KEY,
        "api_key_secret": KASM_API_SECRET,
        "image_id":       KASM_WORKSPACE_ID,
        "user_id":        KASM_USER_ID,
        "target":         target_url,
    }

    import httpx  # lazy import — not required for demo mode

    async with httpx.AsyncClient(verify=KASM_SSL_VERIFY, timeout=30.0) as client:
        # ── Step 0: Destroy any existing sessions to prevent resume conflicts ──
        await _destroy_existing_sessions(client)

        # ── Step 1: Request a new Kasm session ──
        response = await client.post(api_url, json=payload)

        if response.status_code != 200:
            logger.error(
                "Kasm API returned HTTP %d: %s",
                response.status_code,
                response.text,
            )
            raise RuntimeError(
                f"Kasm API returned HTTP {response.status_code}: {response.text[:300]}"
            )

        result = response.json()
        kasm_id = (result.get("data") or {}).get("kasm_id") or result.get("kasm_id")
        if not kasm_id:
            raise RuntimeError(
                f"Kasm API response did not contain a kasm_id: {response.text[:400]}"
            )

        logger.info(
            "Kasm session created - kasm_id=%s (status: %s), polling for readiness...",
            kasm_id,
            (result.get("data") or {}).get("status") or result.get("status", "starting"),
        )

        # ── Step 2: Poll /api/public/get_kasm_status until session is running ──
        status_url = f"{KASM_BASE_URL}/api/public/get_kasm_status"
        max_polls = 90         # 90 x 2s = 180 seconds max wait
        poll_interval = 2.0

        for attempt in range(1, max_polls + 1):
            await asyncio.sleep(poll_interval)
            status_payload = {
                "api_key":        KASM_API_KEY,
                "api_key_secret": KASM_API_SECRET,
                "kasm_id":        kasm_id,
                "user_id":        KASM_USER_ID,
            }
            status_resp = await client.post(status_url, json=status_payload)

            if status_resp.status_code != 200:
                logger.warning(
                    "Status poll HTTP %d (attempt %d/%d)",
                    status_resp.status_code, attempt, max_polls,
                )
                continue

            status_data = status_resp.json()
            kasm_info = status_data.get("kasm") or status_data.get("data") or {}
            
            operational = (
                kasm_info.get("operational_status")
                or status_data.get("operational_status")
                or ""
            )

            logger.debug(
                "Poll %d/%d - operational_status=%s", attempt, max_polls, operational
            )

            if operational == "running":
                session_url = (
                    status_data.get("kasm_url")
                    or kasm_info.get("kasm_url")
                    or ""
                )
                if session_url:
                    if not (session_url.startswith("http://") or session_url.startswith("https://")):
                        session_url = f"{KASM_BASE_URL.rstrip('/')}/{session_url.lstrip('/')}"
                    logger.info("Kasm session is running - URL: %s", session_url)
                    return session_url

        raise RuntimeError(
            f"Kasm session {kasm_id} did not become ready within "
            f"{max_polls * poll_interval:.0f}s"
        )


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------
def _is_safe_target(target: str) -> bool:
    """Reject obviously malformed or dangerous inputs."""
    stripped = target.strip()
    if not stripped:
        return False
    for scheme in ("file:", "data:", "javascript:", "vbscript:"):
        if stripped.lower().startswith(scheme):
            return False
    return True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.post("/request", response_model=KasmResponse)
async def kasm_request(body: KasmRequest, request: Request):
    """
    Request a Kasm remote browser isolation session for a given target URL
    or indicator (IP, domain, URL).

    **Request body** (JSON):
        { "target_url": "<indicator>" }

    **Response** (JSON):
        { "kasm_url": "<session URL>", "status": "success", "mode": "demo|live" }

    Run in **demo mode** by default (no Kasm server required).
    Set ``KASM_MODE=live`` in your .env to call the actual Kasm Workspaces API.
    """
    target = (body.target_url or "").strip()

    if not target:
        raise HTTPException(status_code=422, detail="target_url must not be empty")

    if not _is_safe_target(target):
        raise HTTPException(
            status_code=422,
            detail="target_url contains a disallowed URI scheme",
        )

    try:
        if KASM_MODE == "live":
            kasm_url = await _create_kasm_session(target)
        else:
            kasm_url = _build_demo_url(request, target)

        logger.info(
            "Kasm isolation [mode=%s] for: %s -> %s",
            KASM_MODE,
            target,
            kasm_url,
        )
        return KasmResponse(kasm_url=kasm_url, mode=KASM_MODE)

    except Exception as exc:
        logger.warning(
            "Kasm live API failed for %s (%s). Falling back to demo mode.",
            target, exc,
        )
        kasm_url = _build_demo_url(request, target)
        return KasmResponse(
            kasm_url=kasm_url,
            mode="demo_fallback",
            status=f"live_api_error: {exc}",
        )


# ---------------------------------------------------------------------------
# GET /api/v1/kasm/status — health check / config info
# ---------------------------------------------------------------------------
@router.get("/status")
async def kasm_status():
    """Return current Kasm integration configuration (no secrets)."""
    return {
        "mode":       KASM_MODE,
        "base_url":   KASM_BASE_URL,
        "workspace_id": KASM_WORKSPACE_ID if KASM_MODE == "live" else None,
        "configured": KASM_MODE == "live" and bool(KASM_API_KEY) and bool(KASM_API_SECRET),
        "info": "Set KASM_MODE=live with valid API credentials in .env for production use",
    }
