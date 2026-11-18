import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.integrations.ticketing_service import (
    AlertToTicketMapper,
    JiraTicketingService,
    ServiceNowTicketingService,
    AutomationRuleEngine,
    DEFAULT_AUTOMATION_RULES
)
from app.integrations.telegram_bot import TelegramAlertBot
from app.integrations.wazuh_integration import WazuhIntegrationService, WazuhVulnerabilityMapper
from app.integrations.threat_intelligence import ThreatIntelligenceService

@pytest.mark.asyncio
async def test_ticket_payload_mapping():
    alert = {
        "id": "alert-123",
        "title": "Suspicious Activity",
        "severity": "critical",
        "detection_type": "process",
        "hostname": "host-1",
        "user": "root",
        "first_seen": "2026-06-02T10:00:00",
        "mitre_tactics": ["Execution"],
        "mitre_techniques": ["T1059"],
        "description": "A suspicious process was executed."
    }
    payload = AlertToTicketMapper.create_ticket_payload(alert)
    assert "[CRITICAL]" in payload["title"]
    assert "priority" in payload
    assert payload["priority"] == "1"
    assert payload["category"] == "CODE_EXECUTION"
    assert "spyderxdr" in payload["tags"]

@pytest.mark.asyncio
async def test_jira_ticket_creation():
    service = JiraTicketingService("https://mock-jira", "user:pass", "SEC")
    alert = {
        "id": "alert-123",
        "title": "Jira Test",
        "severity": "high",
        "mitre_tactics": ["Persistence"]
    }
    
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"key": "SEC-101"}
        mock_post.return_value = mock_response
        
        res = await service.create_ticket(alert)
        assert res["status"] == "created"
        assert res["ticket_id"] == "SEC-101"
        assert "browse/SEC-101" in res["url"]

@pytest.mark.asyncio
async def test_servicenow_ticket_creation():
    service = ServiceNowTicketingService("https://mock-sn", "client", "secret")
    alert = {
        "id": "alert-123",
        "title": "SNOW Test",
        "severity": "critical"
    }
    
    with patch("httpx.AsyncClient.post") as mock_post:
        # Mock token call
        mock_token_res = MagicMock()
        mock_token_res.json.return_value = {"access_token": "token123"}
        
        # Mock ticket creation call
        mock_ticket_res = MagicMock()
        mock_ticket_res.status_code = 201
        mock_ticket_res.json.return_value = {
            "result": {
                "number": "INC0001",
                "sys_id": "sys123"
            }
        }
        
        mock_post.side_effect = [mock_token_res, mock_ticket_res]
        
        res = await service.create_ticket(alert)
        assert res["status"] == "created"
        assert res["ticket_id"] == "INC0001"

@pytest.mark.asyncio
async def test_automation_rules_evaluation():
    engine = AutomationRuleEngine()
    for rule in DEFAULT_AUTOMATION_RULES:
        engine.add_rule(rule)
        
    # Critical Alert should match
    alert_critical = {"severity": "critical", "mitre_tactics": [], "detection_type": "process"}
    assert engine.evaluate_alert(alert_critical) is True

    # Low Alert should not match
    alert_low = {"severity": "low", "mitre_tactics": [], "detection_type": "process"}
    assert engine.evaluate_alert(alert_low) is False

    # High + C2 should match
    alert_c2 = {"severity": "high", "mitre_tactics": ["Command and Control"], "detection_type": "network"}
    assert engine.evaluate_alert(alert_c2) is True

    # High but not C2 or lateral movement should not match
    alert_other = {"severity": "high", "mitre_tactics": ["Persistence"], "detection_type": "process"}
    assert engine.evaluate_alert(alert_other) is False

@pytest.mark.asyncio
async def test_wazuh_integration_mapping():
    wazuh_vuln = {
        "vuln_id": "CVE-2023-38606",
        "name": "Apple OS Vulnerability",
        "severity": "critical",
        "package": "kernel",
        "version": "1.0",
        "cve_id": "CVE-2023-38606"
    }
    
    alert = WazuhVulnerabilityMapper.convert_to_alert(wazuh_vuln)
    assert alert["id"] == "wazuh_vuln_CVE-2023-38606"
    assert alert["severity"] == "critical"
    assert alert["detection_type"] == "vulnerability"
    assert alert["source"] == "wazuh_vulnerability_scanner"

@pytest.mark.asyncio
@patch("telegram.Bot")
async def test_telegram_bot_formatting(mock_bot_class):
    # Initialize mock TelegramAlertBot
    mock_bot = MagicMock()
    mock_bot.send_message = AsyncMock(return_value=True)
    mock_bot_class.return_value = mock_bot
    
    bot = TelegramAlertBot()
    bot.bot = mock_bot
    bot.chat_id = "12345"
    
    alert = {
        "title": "Mimikatz execution",
        "severity": "critical",
        "detection_type": "credential_access",
        "hostname": "workstation-1",
        "user": "admin",
        "first_seen": "2026-06-02T12:00:00",
        "mitre_tactics": ["Credential Access"],
        "mitre_techniques": ["T1003"],
        "description": "Mimikatz detected in memory"
    }
    
    # Test send alert
    res = await bot.send_alert(alert)
    assert res is True
    
    # Test send critical alert
    res_crit = await bot.send_critical_alert(alert)
    assert res_crit is True

@pytest.mark.asyncio
async def test_threat_intelligence_check():
    from app.main import redis_service
    # Setup TI Service
    ti_service = ThreatIntelligenceService(None, redis_service)
    
    # Check non-malicious IP first
    res = await ti_service.check_indicators({"source_ip": "1.1.1.1"})
    assert len(res) == 0
    
    # Add a custom malicious IP in cache
    await ti_service.add_custom_indicator("8.8.8.8", "ip", "c2_server")
    
    # Check malicious IP
    res_malicious = await ti_service.check_indicators({"source_ip": "8.8.8.8"})
    assert len(res_malicious) == 1
    assert res_malicious[0]["type"] == "threat_intel"
    assert "8.8.8.8" in res_malicious[0]["reason"]
    assert res_malicious[0]["severity"] == "high"
