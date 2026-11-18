"""
ARGUS / SpyderXDR - Extended Detection & Response Platform
Main FastAPI Application

Changes vs original:
  - KafkaService added as a global singleton (starts/stops with the app)
  - endpoints_stream (WebSocket live feed) registered
  - All existing routes and middleware untouched
"""
from pathlib import Path

# Load .env before any service initialisation so REDIS_URL (and other env
# vars) are present in the environment.  python-dotenv is already declared
# as a dependency in requirements.txt.
try:
    from dotenv import load_dotenv
    # main.py resides at  backend/app/main.py  →  2× .parent = backend/
    dotenv_path = Path(__file__).resolve().parent.parent / ".env"
    if dotenv_path.exists():
        load_dotenv(dotenv_path=dotenv_path)
except ImportError:
    pass

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
from datetime import datetime

from app.services.database import Database
from app.services.redis_service import RedisService
from app.services.elastic_service import ElasticSearchService
from app.detection.engine import DetectionEngine
from app.kafka.kafka_service import KafkaService, TOPIC_TELEMETRY

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ─── Global services ─────────────────────────────────────────────────────────
db               = Database()
redis_service    = RedisService()
elastic_service  = ElasticSearchService()   # NEW: replaces SQLite as the event store
detection_engine = DetectionEngine(db, redis_service)
kafka_service    = KafkaService(elastic_service=elastic_service)   # Enable ES indexing in consumer

from app.api.v1 import (
    endpoints_events,
    endpoints_alerts,
    endpoints_rules,
    endpoints_responses,
    endpoints_dashboard,
    endpoints_health,
    endpoints_integrations,
    endpoints_admin,
    endpoints_saas,
    endpoints_ai,
    endpoints_sensors,
    endpoints_playbooks,
    endpoints_compliance,
    endpoints_stream,          # WebSocket live stream
    endpoints_search,          # SPL search
    endpoints_hunting,         # NEW: Velociraptor Threat Hunting
    endpoints_kasm,          # NEW: Kasm Remote Browser Isolation
)
from app.api.v1.endpoints_stream import metrics_router
from app.api.v1 import endpoints_search


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("🚀 ARGUS / SpyderXDR Starting up...")

    await db.connect()
    await redis_service.connect()
    await elastic_service.start()                # NEW
    await elastic_service.init_index()           # Create spyderxdr-events index
    await detection_engine.start()
    await kafka_service.start()                  # NEW

    # ── Non-blocking background Kafka consumer ────────────────────────
    async def _run_kafka_consumer():
        """Background task wrapper so the consumer never blocks startup."""
        try:
            # Pass topics explicitly — there are no registered handlers, so
            # start_consuming() would otherwise start no consumer tasks.
            await kafka_service.start_consuming(topics=[TOPIC_TELEMETRY])
        except asyncio.CancelledError:
            logger.info("Kafka consumer background task cancelled")
        except Exception as exc:
            logger.error("Kafka consumer background task failed: %s", exc)

    asyncio.create_task(_run_kafka_consumer())
    logger.info("✅ All services started successfully (Elasticsearch + Kafka pipeline)")

    # ─── Seed demo data if the database is empty ───────────────────────
    try:
        from sqlalchemy import func, select
        from app.models.database import Alert, Event, Sensor
        from datetime import datetime, timedelta

        async for session in db.get_session():
            sensor_count = await session.scalar(select(func.count(Sensor.id))) or 0
            alert_count  = await session.scalar(select(func.count(Alert.id)))  or 0
            event_count  = await session.scalar(select(func.count(Event.id)))  or 0

            if sensor_count == 0:
                session.add_all([
                    Sensor(id="sensor-seed-01", name="Edge Gateway Sensor", sensor_type="network", status="active", ip_address="192.168.10.10", location="DMZ", event_type_feed="zeek", events_processed=1280),
                    Sensor(id="sensor-seed-02", name="Cloud Syslog Probe", sensor_type="syslog", status="active", ip_address="10.12.0.20", location="Cloud", event_type_feed="syslog", events_processed=950),
                    Sensor(id="sensor-seed-03", name="Deception Honeyprobe", sensor_type="honeypot", status="degraded", ip_address="172.16.8.40", location="Internal", event_type_feed="honeypot", events_processed=310),
                ])

            if alert_count == 0:
                now = datetime.utcnow()
                session.add_all([
                    Alert(id="alert-seed-01", title="RDP brute-force attempt", description="Multiple failed RDP sign-ins detected from 192.168.10.55.", severity="high", status="new", source_event_ids=["evt-seed-01"], rule_id="rule-seed-01", detection_type="behavioral", indicators=["192.168.10.55"], mitre_tactics=["Credential Access"], mitre_techniques=["T1110"], first_seen=now - timedelta(hours=2), last_seen=now, occurrences=4, hostname="edge-gw-01", user="analyst", assigned_to="SOC", notes=[], artifacts=[], created_at=now, updated_at=now),
                    Alert(id="alert-seed-02", title="PowerShell downloader observed", description="Suspicious PowerShell process attempted outbound download.", severity="critical", status="investigating", source_event_ids=["evt-seed-02"], rule_id="rule-seed-02", detection_type="signature", indicators=["powershell.exe"], mitre_tactics=["Execution"], mitre_techniques=["T1059"], first_seen=now - timedelta(hours=5), last_seen=now, occurrences=1, hostname="win-host-03", user="analyst", assigned_to="IR", notes=[], artifacts=[], created_at=now, updated_at=now),
                ])

            if event_count == 0:
                now = datetime.utcnow()
                session.add_all([
                    Event(id="evt-seed-01", timestamp=now - timedelta(minutes=15), source_ip="192.168.10.55", destination_ip="192.168.10.10", hostname="edge-gw-01", agent_id="agent-seed-01", event_type="network_connection", event_data={"protocol": "RDP", "status": "failed", "bytes": 8021}, status="new", created_at=now),
                    Event(id="evt-seed-02", timestamp=now - timedelta(minutes=28), source_ip="10.12.0.20", destination_ip="208.67.222.222", hostname="win-host-03", agent_id="agent-seed-02", event_type="process_creation", event_data={"image": "powershell.exe", "command_line": "powershell -enc ...", "user": "admin"}, status="new", created_at=now),
                    Event(id="evt-seed-03", timestamp=now - timedelta(hours=1), source_ip="172.16.8.40", destination_ip="172.16.8.1", hostname="honey-01", agent_id="agent-seed-03", event_type="vulnerability", event_data={"cve": "CVE-2024-21413", "package": "Microsoft Outlook", "severity": "critical", "cvss_score": 9.1, "status": "active"}, status="new", created_at=now),
                    Event(id="evt-seed-04", timestamp=now - timedelta(hours=2), source_ip="10.12.0.20", destination_ip="10.12.0.5", hostname="win-host-03", agent_id="agent-seed-02", event_type="compliance", event_data={"standard": "CIS Benchmark", "control_name": "Disable SMBv1", "status": "passed"}, status="new", created_at=now),
                    Event(id="evt-seed-05", timestamp=now - timedelta(minutes=5), source_ip="192.168.1.100", destination_ip="10.0.0.45", hostname="win-host-03", agent_id="agent-seed-02", event_type="sysmon", event_data={"EventID": "1", "source_program": "sysmon", "log_type": "sysmon", "image": "C:\\Windows\\System32\\cmd.exe", "command_line": "cmd.exe /c whoami", "user": "SYSTEM", "parent_image": "C:\\Windows\\System32\\services.exe", "process_id": 4528, "parent_process_id": 612, "event_summary": "Process creation", "details": {"event_id": "1", "source_program": "sysmon", "log_type": "sysmon", "image": "C:\\Windows\\System32\\cmd.exe", "command_line": "cmd.exe /c whoami", "user": "SYSTEM", "process_name": "cmd.exe", "event_summary": "Process creation"}}, status="new", created_at=now),
                    Event(id="evt-seed-06", timestamp=now - timedelta(minutes=3), source_ip="192.168.1.100", destination_ip="185.130.5.15", hostname="win-host-03", agent_id="agent-seed-02", event_type="sysmon", event_data={"EventID": "3", "source_program": "sysmon", "log_type": "sysmon", "image": "C:\\Windows\\System32\\powershell.exe", "process_id": 4900, "destination_ip": "185.130.5.15", "destination_port": 4444, "protocol": "TCP", "event_summary": "Network connection", "details": {"event_id": "3", "source_program": "sysmon", "log_type": "sysmon", "image": "powershell.exe", "process_name": "powershell.exe", "event_summary": "Network connection"}}, status="new", created_at=now),
                ])

            # Always seed sysmon demo events if they don't exist yet
            # (separate from the event_count == 0 check above so existing DBs also get them)
            sysmon_exists = await session.scalar(
                select(func.count(Event.id)).where(Event.id.in_(["evt-sysmon-01", "evt-sysmon-02"]))
            ) or 0
            if sysmon_exists < 2:
                now_sysmon = datetime.utcnow()
                # Remove any partial sysmon seed events first
                if sysmon_exists > 0:
                    from sqlalchemy import delete as sa_delete
                    await session.execute(sa_delete(Event).where(Event.id.in_(["evt-sysmon-01", "evt-sysmon-02"])))
                session.add_all([
                    Event(id="evt-sysmon-01", timestamp=now_sysmon - timedelta(minutes=5), source_ip="192.168.1.100", destination_ip="10.0.0.45", hostname="win-host-03", agent_id="agent-seed-02", event_type="sysmon", event_data={"EventID": "1", "source_program": "sysmon", "log_type": "sysmon", "image": "C:\\Windows\\System32\\cmd.exe", "command_line": "cmd.exe /c whoami", "user": "SYSTEM", "parent_image": "C:\\Windows\\System32\\services.exe", "process_id": 4528, "parent_process_id": 612, "event_summary": "Process creation"}, status="new", created_at=now_sysmon),
                    Event(id="evt-sysmon-02", timestamp=now_sysmon - timedelta(minutes=3), source_ip="192.168.1.100", destination_ip="185.130.5.15", hostname="win-host-03", agent_id="agent-seed-02", event_type="sysmon", event_data={"EventID": "3", "source_program": "sysmon", "log_type": "sysmon", "image": "C:\\Windows\\System32\\powershell.exe", "process_id": 4900, "destination_ip": "185.130.5.15", "destination_port": 4444, "protocol": "TCP", "event_summary": "Network connection"}, status="new", created_at=now_sysmon),
                ])
                logger.info("✅ Seeded 2 sysmon demo events for SIEM sysmon filter.")

            await session.commit()
            logger.info(f"Seed summary: sensors={sensor_count}, alerts={alert_count}, events={event_count}")
            break
    except Exception as e:
        logger.warning(f"Demo data seeding skipped: {e}")

    yield

    # Shutdown
    logger.info("⛔ Shutting down services...")
    await kafka_service.stop()           # NEW
    await detection_engine.stop()
    await redis_service.disconnect()
    await elastic_service.close()        # NEW
    await db.disconnect()
    logger.info("✅ All services shut down")


# ─── FastAPI application ──────────────────────────────────────────────────────
app = FastAPI(
    title="ARGUS / SpyderXDR API",
    description="Extended Detection & Response Platform",
    version="1.1.0",
    lifespan=lifespan,
)

# CORS – allow all origins (tighten in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted hosts – open for cross-OS remote agent communication
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],
)

# JWT SaaS Authentication & Tenant Isolation Middleware
from fastapi.responses import JSONResponse

@app.middleware("http")
async def add_tenant_isolation_context(request: Request, call_next):
    path = request.url.path
    bypass_paths = [
        "/api/v1/saas/auth/login",
        "/api/v1/saas/auth/signup",
        "/api/v1/saas/auth/default-credentials",
        "/api/v1/saas/webhooks/stripe",
    ]
    if path.startswith("/api/v1/saas") and path not in bypass_paths:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid authentication token"},
            )
        token = auth_header[7:]
        try:
            from app.services.multitenancy_service import MultitenancyService
            multitenancy_service = MultitenancyService(db)
            payload = multitenancy_service.verify_jwt_token(token)
            if not payload:
                return JSONResponse(status_code=401, content={"detail": "Token expired or invalid"})
            request.state.tenant_id = payload.get("organization_id")
            request.state.user_id = payload.get("user_id")
        except Exception as e:
            return JSONResponse(
                status_code=401,
                content={"detail": f"Authentication failed: {str(e)}"},
            )

    response = await call_next(request)
    return response


# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(endpoints_health.router,      prefix="/api/v1/health",      tags=["Health"])
app.include_router(endpoints_events.router,      prefix="/api/v1/events",      tags=["Events"])
app.include_router(endpoints_alerts.router,      prefix="/api/v1/alerts",      tags=["Alerts"])
app.include_router(endpoints_rules.router,       prefix="/api/v1/rules",       tags=["Rules"])
app.include_router(endpoints_responses.router,   prefix="/api/v1/responses",   tags=["Response"])
app.include_router(endpoints_dashboard.router,   prefix="/api/v1/dashboard",   tags=["Dashboard"])
app.include_router(endpoints_integrations.router,prefix="/api/v1/integrations",tags=["Integrations"])
app.include_router(endpoints_admin.router,       prefix="/api/v1/admin",       tags=["Admin"])
app.include_router(endpoints_saas.router,        prefix="/api/v1/saas",        tags=["SaaS"])
app.include_router(endpoints_ai.router,          prefix="/api/v1/ai",          tags=["AI Copilot & Deception"])
app.include_router(endpoints_sensors.router,     prefix="/api/v1/sensors",     tags=["Sensors"])
app.include_router(endpoints_playbooks.router,   prefix="/api/v1/playbooks",   tags=["Playbooks & Runbooks"])
app.include_router(endpoints_compliance.router,  prefix="/api/v1/compliance",  tags=["Compliance & Posture"])
app.include_router(endpoints_search.router,        prefix="/api/v1/search",       tags=["Search & SPL"])
app.include_router(endpoints_stream.router,      prefix="/api/v1/stream",      tags=["Live Stream"])
app.include_router(metrics_router,               prefix="/api/v1",             tags=["Metrics WS"])
app.include_router(endpoints_hunting.router,     prefix="/api/v1/hunting",     tags=["Threat Hunting"])  # NEW: Velociraptor
app.include_router(endpoints_kasm.router,       prefix="/api/v1/kasm",        tags=["Kasm Isolation"])     # NEW: Kasm RBI


@app.get("/")
async def root():
    return {
        "application": "ARGUS / SpyderXDR",
        "version": "1.1.0",
        "status": "active",
        "timestamp": datetime.utcnow().isoformat(),
        "streaming": "ws://localhost:8000/api/v1/stream/telemetry",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )
