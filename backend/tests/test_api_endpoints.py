import json
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from app.main import app, db
from app.models.database import Alert, Agent, Event
from sqlalchemy import select

client = TestClient(app)

def test_health_endpoints():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json()["ready"] is True
    
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json()["alive"] is True

def test_integrations_status():
    response = client.get("/api/v1/integrations/status")
    assert response.status_code == 200
    data = response.json()
    assert "integrations" in data
    assert "wazuh" in data["integrations"]
    assert "telegram" in data["integrations"]

def test_dashboard_summary():
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "alerts" in data
    assert "endpoints" in data


def test_sensors_endpoint_returns_seeded_data():
    response = client.get("/api/v1/sensors")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "name" in data[0]

@pytest.mark.asyncio
async def test_event_ingestion_and_retrieval(db_session):
    payload = {
        "hostname": "host-test-api",
        "agent_id": "test-agent-uuid-1",
        "events": [
            {
                "timestamp": "2026-06-02T12:00:00",
                "event_type": "process_creation",
                "source_ip": "192.168.1.5",
                "destination_ip": "10.0.0.1",
                "hostname": "host-test-api",
                "agent_id": "test-agent-uuid-1",
                "event_data": {
                    "image": "C:\\Windows\\notepad.exe",
                    "command_line": "notepad.exe",
                    "user": "admin"
                }
            }
        ]
    }

    response = client.post("/api/v1/events/ingest", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "disabled"
    assert data["events_ingested"] == 0
    assert "Direct agent HTTP transport is disabled" in data["message"]

@pytest.mark.asyncio
async def test_event_ingestion_upserts_agent_by_hostname_and_marks_active(db_session):
    existing = Agent(
        id="old-agent-id",
        hostname="VISHAALSENVY",
        os_type="windows",
        status="offline",
        version="0.9.0",
        ip_address="10.0.0.1",
        events_processed=1,
    )
    db_session.add(existing)
    await db_session.commit()

    payload = {
        "hostname": "VISHAALSENVY",
        "agent_id": "new-agent-id",
        "events": [
            {
                "timestamp": "2026-06-02T12:00:00",
                "event_type": "heartbeat",
                "source_ip": "192.168.1.10",
                "destination_ip": "10.0.0.1",
                "hostname": "VISHAALSENVY",
                "agent_id": "new-agent-id",
                "event_data": {"status": "online"},
            }
        ],
    }

    response = client.post("/api/v1/events/ingest", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "disabled"

    result = await db_session.execute(select(Agent).where(Agent.hostname == "VISHAALSENVY"))
    agents = result.scalars().all()
    assert len(agents) == 1
    assert agents[0].id == "old-agent-id"
    assert agents[0].status == "offline"
    assert agents[0].ip_address == "10.0.0.1"


@pytest.mark.asyncio
async def test_events_search_supports_partial_event_type_and_json_text(db_session):
    db_session.add(
        Event(
            id=str(uuid.uuid4()),
            timestamp=datetime(2026, 6, 2, 12, 0, 0),
            source_ip="192.168.1.20",
            destination_ip="10.0.0.20",
            hostname="VISHAALSENVY-SYSLOG",
            agent_id=f"search-agent-sysmon-{uuid.uuid4()}",
            event_type="sysmon-network",
            event_data={"message": "sysmon-network alert triggered"},
        )
    )
    await db_session.commit()

    response = client.get("/api/v1/events/?search=sysmon&limit=20")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("sysmon" in str(item.get("event_type") or "").lower() or "sysmon" in str(item.get("event_data") or "").lower() for item in data["events"])

    response = client.get("/api/v1/events/?query=sysmon&limit=20")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("sysmon" in str(item.get("event_type") or "").lower() or "sysmon" in str(item.get("event_data") or "").lower() for item in data["events"])

    response = client.get("/api/v1/events/?log_type=sysmon&limit=20")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("sysmon" in str(item.get("event_type") or "").lower() or "sysmon" in str(item.get("event_data") or "").lower() for item in data["events"])

    response = client.get("/api/v1/events/?event_type=network&limit=20")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("network" in str(item.get("event_type") or "").lower() or "network" in str(item.get("event_data") or "").lower() for item in data["events"])


@pytest.mark.asyncio
async def test_fluentd_sysmon_ingest_normalizes_event_details(db_session):
    payload = {
        "hostname": "host-sysmon-test",
        "agent_id": "fluentd-sysmon-agent",
        "fluentd_tag": "spyderxdr.sysmon",
        "event_type": "sysmon",
        "timestamp": "2026-06-11T12:00:00+00:00",
        "source_ip": "127.0.0.1",
        "destination_ip": "",
        "EventID": 1,
        "Image": "C:\\Windows\\System32\\cmd.exe",
        "CommandLine": "cmd.exe /c whoami",
        "ParentImage": "C:\\Windows\\System32\\explorer.exe",
        "Hashes": "SHA1=abc,SHA256=def,MD5=123",
        "User": "DESKTOP\\Admin"
    }

    response = client.post("/api/v1/events/fluentd-ingest", data=json.dumps(payload) + "\n")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["events_ingested"] == 1

    event_id = data["event_ids"][0]
    event_response = client.get(f"/api/v1/events/{event_id}")
    assert event_response.status_code == 200
    body = event_response.json()
    assert body["event_type"] == "sysmon"
    assert body["event_data"]["source_program"] == "sysmon"
    assert body["event_data"]["log_type"] == "sysmon"
    assert body["event_data"]["details"]["image"] == "C:\\Windows\\System32\\cmd.exe"
    assert body["event_data"]["details"]["parent_image"] == "C:\\Windows\\System32\\explorer.exe"
    assert body["event_data"]["details"]["sha256"] == "def"


@pytest.mark.asyncio
async def test_ticket_creation_endpoints(db_session):
    # 1. Create a dummy alert in DB
    import uuid
    alert_id = "alert-test-endpoints-" + str(uuid.uuid4())
    alert_payload = {
        "id": alert_id,
        "title": "API Alert Test",
        "description": "Alert for api test",
        "severity": "critical",
        "status": "new",
        "source_event_ids": [],
        "rule_id": "rule-1",
        "detection_type": "signature",
        "indicators": {},
        "mitre_tactics": [],
        "mitre_techniques": [],
        "hostname": "host-test",
        "user": "root"
    }
    
    alert = Alert(**alert_payload)
    db_session.add(alert)
    await db_session.commit()
    
    # 2. Test automation rules checking
    response = client.post(f"/api/v1/integrations/tickets/automation-rules/test/{alert_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["alert_id"] == alert_id
    assert data["matches_automation"] is True
    assert len(data["matched_rules"]) > 0
