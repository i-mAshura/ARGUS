"""
Live telemetry streaming via WebSocket.

Endpoint: /api/v1/stream/telemetry

The frontend connects once and receives real-time JSON frames as events are
ingested (via Kafka → KafkaService → Redis pub/sub → this WebSocket).

If Kafka is not available the mock in-memory broker inside KafkaService is
used transparently, so the endpoint works in all environments.

Message format sent to the client:
{
  "type": "event" | "alert" | "heartbeat",
  "payload": { ... }          // the raw Kafka message payload
}
"""

import asyncio
import json
import logging
import math
from datetime import datetime
from typing import Any, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()

# Registry of all live WebSocket connections (for broadcasting)
_connections: Set[WebSocket] = set()


# ── Backend selection ────────────────────────────────────────────────────────
def _prefer_backend() -> str:
    """Return ``"kafka"`` when real Kafka is available, else ``"redis"``."""
    try:
        from app.main import kafka_service
        if hasattr(kafka_service, "_use_real_kafka") and kafka_service._use_real_kafka:
            return "kafka"
    except Exception:
        pass
    return "redis"

SYSTEM_METRICS_KEY = "system_metrics"


def _coerce_number(value: Any) -> float | None:
    """Return a finite numeric value when possible."""
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return number if math.isfinite(number) else None


def _coerce_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


async def _merge_metrics_payload(incoming: dict[str, Any], last_known: dict[str, Any] | None) -> dict[str, Any]:
    """
    Accumulate metrics from different Fluentd sources into a single cached payload.

    Fluentd emits three independent message types:
      - cpu_ram_performance   → CPU + RAM percentages
      - network_connection    → individual TCP connections (many per 30s)
      - process_creation      → individual process entries  (many per 60s)

    Each message type carries different top-level fields.  This function merges
    them so the cached payload always has the latest CPU/RAM plus an accumulating
    snapshot of active network connections and top processes.
    """
    if not isinstance(incoming, dict):
        return incoming

    # ── Build the combined cache structure ───────────────────────────────
    merged: dict[str, Any] = {
        "event_data": {
            "cpu_percent": 0,
            "cpu_usage_percent": 0,
            "ram_percent": 0,
            "memory_usage_percent": 0,
            "total_ram_mb": 0,
            "free_ram_mb": 0,
            "network": [],
            "processes": [],
            "windows_events": [],
        }
    }

    # Restore previous known values so we don't lose data between message types
    previous_event_data: dict[str, Any] = {}
    if isinstance(last_known, dict):
        prev = last_known.get("event_data") or last_known
        if isinstance(prev, dict):
            previous_event_data = prev

    for key in ("cpu_percent", "cpu_usage_percent", "ram_percent",
                "memory_usage_percent", "total_ram_mb", "free_ram_mb"):
        merged["event_data"][key] = previous_event_data.get(key, 0)
    for arr_key in ("network", "processes", "windows_events"):
        merged["event_data"][arr_key] = list(previous_event_data.get(arr_key, []) or [])

    # ── Detect stale data (no update in 60s) ─────────────────────────────
    # If the cached data is stale, reset to defaults but DO NOT return early.
    # Fall through to let the incoming message update the values.
    last_updated = previous_event_data.get("timestamp") or previous_event_data.get("last_updated")
    last_seen = _coerce_timestamp(last_updated)
    is_stale = False
    if last_seen is not None:
        if last_seen.tzinfo is not None:
            import datetime as dt
            last_seen = last_seen.astimezone(dt.timezone.utc).replace(tzinfo=None)
        is_stale = (datetime.utcnow() - last_seen).total_seconds() > 60
    if is_stale:
        for key in ("cpu_percent", "cpu_usage_percent", "ram_percent",
                    "memory_usage_percent", "total_ram_mb", "free_ram_mb"):
            merged["event_data"][key] = 0
        merged["event_data"]["network"] = []
        merged["event_data"]["processes"] = []
        merged["event_data"]["windows_events"] = []
        # Don't set last_updated yet — let the message-specific handler below set it

    # ── Classify the incoming message by tag / event_type ────────────────
    fluentd_tag = str(incoming.get("fluentd_tag") or "")
    event_type = str(incoming.get("event_type") or "")

    # 1. CPU / RAM performance message
    if "performance" in event_type or "cpu_ram" in event_type or "performance" in fluentd_tag:
        # Check both top-level keys AND nested event_data (the Windows agent nests values inside event_data)
        ed = incoming.get("event_data") or {}
        cpu_val = _coerce_number(
            incoming.get("cpu_percent")
            or incoming.get("cpu_usage_percent")
            or ed.get("cpu_percent")
            or ed.get("cpu_usage_percent")
        )
        if cpu_val is not None and cpu_val >= 0:
            merged["event_data"]["cpu_percent"] = cpu_val
            merged["event_data"]["cpu_usage_percent"] = cpu_val

        ram_val = _coerce_number(
            incoming.get("ram_percent")
            or incoming.get("memory_usage_percent")
            or ed.get("ram_percent")
            or ed.get("memory_usage_percent")
        )
        if ram_val is not None and ram_val >= 0:
            merged["event_data"]["ram_percent"] = ram_val
            merged["event_data"]["memory_usage_percent"] = ram_val

        total_ram = _coerce_number(
            incoming.get("total_ram_mb")
            or incoming.get("total_memory_mb")
            or ed.get("total_ram_mb")
            or ed.get("total_memory_mb")
        )
        if total_ram is not None and total_ram > 0:
            merged["event_data"]["total_ram_mb"] = total_ram

        free_ram = _coerce_number(
            incoming.get("free_ram_mb")
            or ed.get("free_ram_mb")
        )
        if free_ram is not None and free_ram >= 0:
            merged["event_data"]["free_ram_mb"] = free_ram

        merged["event_data"]["last_updated"] = incoming.get("timestamp") or datetime.utcnow().isoformat()
        return merged

    # 2. Network connection message (individual TCP connection from Fluentd exec)
    if event_type == "network_connection" or "network" in fluentd_tag:
        conn = {
            "remote_address": incoming.get("remote_address") or incoming.get("destination_ip", ""),
            "remote_port": incoming.get("remote_port") or incoming.get("destination_port", ""),
            "local_address": incoming.get("local_address") or incoming.get("source_ip", ""),
            "local_port": incoming.get("local_port") or "",
            "state": incoming.get("state") or "ESTABLISHED",
        }
        # Accumulate — keep last 50 unique connections (avoid duplicates)
        current_net = merged["event_data"]["network"]
        conn_key = f"{conn['remote_address']}:{conn['remote_port']}"
        existing = [i for i, c in enumerate(current_net) if f"{c.get('remote_address', '')}:{c.get('remote_port', '')}" == conn_key]
        if existing:
            current_net[existing[0]] = conn
        else:
            current_net.append(conn)
        merged["event_data"]["network"] = current_net[-50:]
        merged["event_data"]["last_updated"] = incoming.get("timestamp") or datetime.utcnow().isoformat()
        return merged

    # 3. Process creation message (individual process from Fluentd exec)
    if event_type == "process_creation" or "process" in fluentd_tag:
        proc = {
            "process_name": incoming.get("process_name") or incoming.get("image", ""),
            "pid": incoming.get("pid") or incoming.get("process_id", 0),
            "cpu": _coerce_number(incoming.get("cpu") or 0) or 0,
            "memory_mb": _coerce_number(incoming.get("memory_mb") or 0) or 0,
        }
        current_procs = merged["event_data"]["processes"]
        proc_key = str(proc.get("pid"))
        existing = [i for i, p in enumerate(current_procs) if str(p.get("pid")) == proc_key]
        if existing:
            current_procs[existing[0]] = proc
        else:
            current_procs.append(proc)
        # Keep sorted by CPU descending, max 50
        current_procs.sort(key=lambda p: -(p.get("cpu") or 0))
        merged["event_data"]["processes"] = current_procs[:50]
        merged["event_data"]["last_updated"] = incoming.get("timestamp") or datetime.utcnow().isoformat()
        return merged

    # 4. Windows event (winevent / sysmon) — accumulate in windows_events
    if event_type in ("winevent", "sysmon") or "winevent" in fluentd_tag or "sysmon" in fluentd_tag:
        win_evt = {
            "event_id": incoming.get("event_id") or incoming.get("id", ""),
            "event_type": event_type,
            "source": incoming.get("source") or incoming.get("source_name", ""),
            "message": str(incoming.get("event_data") or incoming)[:200],
        }
        current_win = merged["event_data"]["windows_events"]
        current_win.append(win_evt)
        merged["event_data"]["windows_events"] = current_win[-20:]
        merged["event_data"]["last_updated"] = incoming.get("timestamp") or datetime.utcnow().isoformat()
        return merged

    # 5. Fallback: try to extract any cpu/ram from arbitrary event_data and preserve arrays
    ed = incoming.get("event_data") or incoming
    if isinstance(ed, dict):
        for preferred, fallback in (("memory_usage_percent", "ram_percent"), ("cpu_usage_percent", "cpu_percent")):
            val = _coerce_number(ed.get(preferred, ed.get(fallback)))
            if val is not None and val > 0:
                merged["event_data"][preferred] = val
                merged["event_data"][fallback] = val

    merged["event_data"]["last_updated"] = incoming.get("timestamp") or datetime.utcnow().isoformat()
    return merged


# ─── Connection manager ──────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        logger.info("WS client connected. Total: %d", len(self.active))

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
        logger.info("WS client disconnected. Total: %d", len(self.active))

    async def broadcast(self, message: dict):
        dead = set()
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active.discard(ws)


manager = ConnectionManager()
metrics_manager = ConnectionManager()


# ─── Background task that bridges Kafka → WebSocket ─────────────────────────

_bridge_task: asyncio.Task | None = None
_metrics_bridge_task: asyncio.Task | None = None

async def _kafka_bridge():
    """
    Reads from Kafka (or Redis when Kafka is unavailable) and broadcasts to all
    connected WebSocket clients.  Runs as a single background task shared across
    all connections.
    """
    try:
        from app.main import kafka_service, redis_service
        from app.kafka.kafka_service import TOPIC_TELEMETRY, TOPIC_ALERTS
    except Exception as e:
        logger.error("Bridge import error: %s", e)
        return

    backend = _prefer_backend()

    if backend == "kafka":
        tele_q = kafka_service.subscribe_live(TOPIC_TELEMETRY)
        alert_q = kafka_service.subscribe_live(TOPIC_ALERTS)
        logger.info("Kafka→WS bridge started")
    else:
        tele_q = redis_service.subscribe_live(TOPIC_TELEMETRY)
        alert_q = redis_service.subscribe_live(TOPIC_ALERTS)
        logger.info("Redis→WS bridge started (Kafka unavailable)")

    try:
        while True:
            await asyncio.sleep(0.1)
            try:
                raw = tele_q.get_nowait()
                payload = json.loads(raw.decode("utf-8")) if isinstance(raw, (bytes, bytearray)) else raw
                await manager.broadcast({"type": "event", "payload": payload})
            except asyncio.QueueEmpty:
                pass

            try:
                raw = alert_q.get_nowait()
                payload = json.loads(raw.decode("utf-8")) if isinstance(raw, (bytes, bytearray)) else raw
                await manager.broadcast({"type": "alert", "payload": payload})
            except asyncio.QueueEmpty:
                pass

            await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        pass
    finally:
        try:
            if backend == "kafka":
                from app.main import kafka_service as ks
                ks.unsubscribe_live(TOPIC_TELEMETRY, tele_q)
                ks.unsubscribe_live(TOPIC_ALERTS, alert_q)
            else:
                redis_service.unsubscribe_live(TOPIC_TELEMETRY, tele_q)
                redis_service.unsubscribe_live(TOPIC_ALERTS, alert_q)
        except Exception:
            pass
        logger.info("Bridge stopped")

def ensure_bridge():
    """Start the bridge task once; idempotent."""
    global _bridge_task
    if _bridge_task is None or _bridge_task.done():
        _bridge_task = asyncio.create_task(_kafka_bridge())


async def _metrics_kafka_bridge():
    """Read telemetry events and fan them to /ws/metrics clients."""
    try:
        from app.main import kafka_service, redis_service
        from app.kafka.kafka_service import TOPIC_TELEMETRY
    except Exception as e:
        logger.error("Metrics bridge import error: %s", e)
        return

    backend = _prefer_backend()

    if backend == "kafka":
        tele_q = kafka_service.subscribe_live(TOPIC_TELEMETRY)
        logger.info("Metrics Kafka→WS bridge started")
    else:
        tele_q = redis_service.subscribe_live(TOPIC_TELEMETRY)
        logger.info("Metrics Redis→WS bridge started (Kafka unavailable)")

    try:
        while True:
            await asyncio.sleep(0.1)
            try:
                raw = tele_q.get_nowait()
                payload = json.loads(raw.decode("utf-8")) if isinstance(raw, (bytes, bytearray)) else raw
                if isinstance(payload, dict):
                    last_known = await redis_service.get(SYSTEM_METRICS_KEY)
                    merged_payload = await _merge_metrics_payload(payload, last_known)
                    await redis_service.set(SYSTEM_METRICS_KEY, merged_payload, ttl=60)
                    await metrics_manager.broadcast({"type": "metrics", "payload": merged_payload})
            except asyncio.QueueEmpty:
                pass
            except Exception as e:
                logger.error("Error processing telemetry metrics in bridge: %s", e)
            await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        pass
    finally:
        try:
            if backend == "kafka":
                from app.main import kafka_service as ks
                ks.unsubscribe_live(TOPIC_TELEMETRY, tele_q)
            else:
                redis_service.unsubscribe_live(TOPIC_TELEMETRY, tele_q)
        except Exception:
            pass
        logger.info("Metrics bridge stopped")


def ensure_metrics_bridge():
    """Start the metrics bridge task once; idempotent."""
    global _metrics_bridge_task
    if _metrics_bridge_task is None or _metrics_bridge_task.done():
        _metrics_bridge_task = asyncio.create_task(_metrics_kafka_bridge())


# ─── WebSocket endpoint ──────────────────────────────────────────────────────

@router.websocket("/telemetry")
async def ws_telemetry(websocket: WebSocket):
    """
    Live telemetry WebSocket.
    Connect from the frontend:
        const ws = new WebSocket("ws://localhost:8001/api/v1/stream/telemetry");
    """
    await manager.connect(websocket)
    ensure_bridge()          # make sure the Kafka bridge is running

    try:
        # Send a welcome frame so the client knows it's live
        await websocket.send_json({"type": "connected", "payload": {"status": "streaming"}})

        # Keep the connection open; we only send server→client (no client→server msgs needed)
        while True:
            # Echo any ping frames from the client to keep NATs alive
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                # Send a heartbeat so the browser doesn't time out the connection
                await websocket.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WS error: %s", e)
    finally:
        manager.disconnect(websocket)


metrics_router = APIRouter()


@metrics_router.websocket("/metrics")
async def ws_metrics(websocket: WebSocket):
    """Dedicated metrics stream for the frontend dashboard."""
    await metrics_manager.connect(websocket)
    ensure_metrics_bridge()

    try:
        await websocket.send_json({"type": "connected", "payload": {"status": "streaming", "key": SYSTEM_METRICS_KEY}})
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("Metrics WS error: %s", e)
    finally:
        metrics_manager.disconnect(websocket)
