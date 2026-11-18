import pytest
from app.detection.behavioral import BehavioralDetectionEngine
from app.detection.anomaly import AnomalyDetectionEngine
from app.detection.signature import SignatureDetectionEngine
from app.models.database import Rule
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.mark.asyncio
async def test_behavioral_process_detection(db_session, mock_redis):
    engine = BehavioralDetectionEngine(None, mock_redis)
    
    # 1. Test process obfuscation (caret)
    event_data = {"command_line": "c^m^d.e^xe /c echo hello"}
    alerts = await engine.analyze_process_behavior(db_session, "host-1", "user-1", event_data)
    assert any(a["reason"] == "Command line obfuscation detected" for a in alerts)
    
    # 2. Test encoding/decoding detection
    event_data = {"command_line": "powershell.exe -EncodedCommand abc"}
    alerts = await engine.analyze_process_behavior(db_session, "host-1", "user-1", event_data)
    assert any(a["reason"] == "Data encoding/decoding detected" for a in alerts)

    # 3. Test Registry manipulation
    event_data = {"command_line": "reg add HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v test"}
    alerts = await engine.analyze_process_behavior(db_session, "host-1", "user-1", event_data)
    assert any(a["reason"] == "Registry manipulation detected" for a in alerts)

    # 4. Test Parent-child relationship (Word spawning CMD)
    event_data = {
        "image": "C:\\Windows\\System32\\cmd.exe",
        "parent_image": "C:\\Program Files\\Microsoft Office\\Office16\\winword.exe"
    }
    alerts = await engine.analyze_process_behavior(db_session, "host-1", "user-1", event_data)
    assert any("winword.exe ->" in a["reason"] for a in alerts)

    # 5. Test Process injection
    event_data = {"injection_detected": True, "injection_type": "ReflectiveDLL"}
    alerts = await engine.analyze_process_behavior(db_session, "host-1", "user-1", event_data)
    assert any(a["reason"] == "Process injection detected" for a in alerts)

@pytest.mark.asyncio
async def test_behavioral_network_detection(db_session, mock_redis):
    engine = BehavioralDetectionEngine(None, mock_redis)
    
    # 1. Test data exfiltration (large bytes sent)
    event_data = {"bytes_sent": 150000000}  # 150MB
    alerts = await engine.analyze_network_behavior(db_session, "host-1", "user-1", event_data)
    assert any(a["reason"] == "Large data transfer detected" for a in alerts)

    # 2. Test C2 beaconing
    event_data = {"beaconing_detected": True, "beacon_interval": 10}
    alerts = await engine.analyze_network_behavior(db_session, "host-1", "user-1", event_data)
    assert any(a["reason"] == "C2 beaconing pattern detected" for a in alerts)

    # 3. Test DNS tunneling (high DNS query count)
    event_data = {"dns_query_count": 120, "protocol": "dns"}
    alerts = await engine.analyze_network_behavior(db_session, "host-1", "user-1", event_data)
    assert any(a["reason"] == "Potential DNS tunneling detected" for a in alerts)

    # 4. Test Port scanning
    event_data = {"unique_destination_ports": 150}
    alerts = await engine.analyze_network_behavior(db_session, "host-1", "user-1", event_data)
    assert any(a["reason"] == "Port scanning detected" for a in alerts)

@pytest.mark.asyncio
async def test_behavioral_file_detection(db_session, mock_redis):
    engine = BehavioralDetectionEngine(None, mock_redis)
    
    # 1. Test LOTL abuse
    event_data = {"process_name": "certutil.exe"}
    alerts = await engine.analyze_file_behavior("host-1", "user-1", event_data)
    assert any("LOTL binary abuse" in a["reason"] for a in alerts)

    # 2. Test system path write
    event_data = {"file_path": "C:\\Windows\\System32\\malicious.dll", "action": "write"}
    alerts = await engine.analyze_file_behavior("host-1", "user-1", event_data)
    assert any("Suspicious write to system path" in a["reason"] for a in alerts)

    # 3. Test Script execution
    event_data = {"file_name": "script.ps1"}
    alerts = await engine.analyze_file_behavior("host-1", "user-1", event_data)
    assert any("Script execution detected" in a["reason"] for a in alerts)

@pytest.mark.asyncio
async def test_anomaly_detection(db_session, mock_redis):
    # Set up test database with helper DB
    from app.main import db
    engine = AnomalyDetectionEngine(db, mock_redis)
    
    # Update baseline
    baseline_data = {
        "process_count_mean": 10.0,
        "process_count_std": 2.0,
        "network_connection_mean": 5.0,
        "network_connection_std": 1.0,
        "file_write_mean": 20.0,
        "file_write_std": 5.0
    }
    await db.update_baseline(db_session, "host-1", "user-1", "process_creation", baseline_data)
    
    # Test normal event
    normal_event = {
        "process_count": 11,
        "network_connection_count": 5,
        "file_write_count": 21
    }
    alerts = await engine.detect_anomalies(db_session, "host-1", "user-1", "process_creation", normal_event)
    assert len(alerts) == 0
    
    # Test anomalous event (high deviation)
    anomalous_event = {
        "process_count": 100,
        "network_connection_count": 50,
        "file_write_count": 200
    }
    alerts = await engine.detect_anomalies(db_session, "host-1", "user-1", "process_creation", anomalous_event)
    assert len(alerts) == 1
    assert alerts[0]["type"] == "anomaly"
    
    # Test unusual login time
    user_alerts = await engine.detect_user_behavior_anomaly(db_session, "host-1", "user-1", {"login_hour": 2})
    assert any(a["reason"] == "Unusual login time detected" for a in user_alerts)

@pytest.mark.asyncio
async def test_signature_detection(db_session, mock_redis):
    from app.main import db
    engine = SignatureDetectionEngine(db, mock_redis)
    
    # 1. Create a test signature rule in DB
    import uuid
    rule_id = "sig_test_mimikatz_" + str(uuid.uuid4())
    rule_name = "Test Mimikatz Detection " + str(uuid.uuid4())
    
    rule_payload = {
        "id": rule_id,
        "name": rule_name,
        "description": "Detects Mimikatz execution",
        "rule_type": "signature",
        "is_enabled": True,
        "severity": "critical",
        "conditions": {
            "match_type": "any",
            "command_line": {
                "operator": "contains",
                "value": "mimikatz"
            }
        },
        "mitre_tactics": ["Credential Access"],
        "mitre_techniques": ["T1003"]
    }
    await db.create_rule(db_session, rule_payload)
    
    # 2. Test matching event
    event = {
        "event_type": "process_creation",
        "command_line": "C:\\temp\\mimikatz.exe privilege::debug exit",
        "hostname": "host-1",
        "user": "admin"
    }
    alerts = await engine.detect_signatures(db_session, event)
    assert len(alerts) >= 1
    assert any(a["rule_id"] == rule_id for a in alerts)
    assert alerts[0]["severity"] == "critical"
    
    # 3. Test non-matching event
    event2 = {
        "event_type": "process_creation",
        "command_line": "notepad.exe",
        "hostname": "host-1",
        "user": "admin"
    }
    alerts2 = await engine.detect_signatures(db_session, event2)
    assert len(alerts2) == 0
