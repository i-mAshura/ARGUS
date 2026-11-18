"""
Ticketing System Integration Service
Automated ticket creation based on alerts
"""
import logging
from typing import Dict, Any
import httpx
from datetime import datetime, timedelta
from enum import Enum

logger = logging.getLogger(__name__)

class TicketingProvider(str, Enum):
    JIRA = "jira"
    SERVICENOW = "servicenow"
    ZENDESK = "zendesk"
    GITHUB = "github"
    OPEN_TICKET = "open_ticket"  # Open-source ticketing

class AlertToTicketMapper:
    """Maps alerts to ticket creation rules"""
    
    # Alert severity to ticket priority mapping
    SEVERITY_TO_PRIORITY = {
        "critical": "1",      # P1 - Immediate
        "high": "2",          # P2 - Urgent
        "medium": "3",        # P3 - Normal
        "low": "4"            # P4 - Low
    }
    
    # MITRE ATT&CK to ticket category
    MITRE_TO_CATEGORY = {
        "Execution": "CODE_EXECUTION",
        "Persistence": "PERSISTENCE",
        "Lateral Movement": "LATERAL_MOVEMENT",
        "Privilege Escalation": "PRIV_ESCALATION",
        "Defense Evasion": "DEFENSE_EVASION",
        "Credential Access": "CREDENTIAL_ACCESS",
        "Discovery": "DISCOVERY",
        "Collection": "DATA_COLLECTION",
        "Exfiltration": "DATA_EXFILTRATION",
        "Command and Control": "C2_COMMUNICATION",
        "Impact": "IMPACT"
    }
    
    @staticmethod
    def create_ticket_payload(alert: Dict[str, Any]) -> Dict[str, Any]:
        """Convert alert to ticket payload"""
        
        severity = alert.get("severity", "medium")
        priority = AlertToTicketMapper.SEVERITY_TO_PRIORITY.get(severity, "3")
        
        # Extract MITRE tactics
        mitre_tactics = alert.get("mitre_tactics", [])
        category = AlertToTicketMapper.MITRE_TO_CATEGORY.get(
            mitre_tactics[0] if mitre_tactics else "Discovery",
            "SECURITY_INCIDENT"
        )
        
        # Build ticket title
        title = f"[{severity.upper()}] {alert.get('title', 'Security Alert')}"
        
        # Build description with context
        description = f"""
*Alert Details:*
- Type: {alert.get('detection_type')}
- Hostname: {alert.get('hostname')}
- User: {alert.get('user')}
- Severity: {severity}
- Detection Time: {alert.get('first_seen')}

*Detection Information:*
- Rule ID: {alert.get('rule_id')}
- Indicators: {alert.get('indicators')}
- MITRE Tactics: {', '.join(mitre_tactics)}
- MITRE Techniques: {', '.join(alert.get('mitre_techniques', []))}

*Alert Description:*
{alert.get('description', 'No description available')}

*Affected Assets:*
- Hostname: {alert.get('hostname')}
- User: {alert.get('user')}
- IP: {alert.get('source_ip', 'N/A')}

*Required Actions:*
1. Acknowledge this ticket
2. Investigate the alert
3. Determine if this is a true positive or false positive
4. Execute response actions if needed
5. Close ticket with resolution
"""
        
        return {
            "title": title,
            "description": description,
            "priority": priority,
            "category": category,
            "severity": severity,
            "alert_id": alert.get("id"),
            "hostname": alert.get("hostname"),
            "user": alert.get("user"),
            "mitre_tactics": mitre_tactics,
            "tags": [
                f"detection:{alert.get('detection_type')}",
                f"severity:{severity}",
                "argus",
                "spyderxdr",
                *[f"mitre:{tactic}" for tactic in mitre_tactics]
            ],
            "due_date": (datetime.utcnow() + timedelta(hours=4)).isoformat()  # 4-hour SLA
        }

class JiraTicketingService:
    """Jira ticketing system integration"""
    
    def __init__(self, jira_url: str, api_token: str, project_key: str):
        self.jira_url = jira_url
        self.api_token = api_token
        self.project_key = project_key
    
    async def create_ticket(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        """Create Jira ticket from alert"""
        payload = AlertToTicketMapper.create_ticket_payload(alert)
        
        jira_payload = {
            "fields": {
                "project": {"key": self.project_key},
                "summary": payload["title"],
                "description": payload["description"],
                "priority": {"id": payload["priority"]},
                "issuetype": {"name": "Security Alert"},
                "customfield_alertid": alert.get("id"),
                "customfield_hostname": payload["hostname"],
                "customfield_severity": payload["severity"],
                "labels": payload["tags"],
                "duedate": payload["due_date"]
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.jira_url}/rest/api/3/issues",
                    json=jira_payload,
                    auth=(self.api_token.split(":")[0], self.api_token.split(":")[1]),
                    headers={"Accept": "application/json"}
                )
                
                if response.status_code == 201:
                    data = response.json()
                    logger.info(f"Created Jira ticket: {data['key']}")
                    return {
                        "status": "created",
                        "ticket_id": data["key"],
                        "url": f"{self.jira_url}/browse/{data['key']}"
                    }
                else:
                    logger.error(f"Failed to create Jira ticket: {response.text}")
                    return {"status": "error", "message": response.text}
        
        except Exception as e:
            logger.error(f"Error creating Jira ticket: {e}")
            return {"status": "error", "message": str(e)}

class ServiceNowTicketingService:
    """ServiceNow ticketing system integration"""
    
    def __init__(self, instance_url: str, client_id: str, client_secret: str):
        self.instance_url = instance_url
        self.client_id = client_id
        self.client_secret = client_secret
    
    async def create_ticket(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        """Create ServiceNow incident from alert"""
        payload = AlertToTicketMapper.create_ticket_payload(alert)
        
        sn_payload = {
            "short_description": payload["title"],
            "description": payload["description"],
            "priority": payload["priority"],
            "cmdb_ci": payload["hostname"],
            "category": "Security",
            "subcategory": payload["category"],
            "state": "1",  # New
            "u_severity": payload["severity"],
            "u_alert_id": alert.get("id"),
            "u_mitre_tactics": ",".join(payload["mitre_tactics"]),
            "assignment_group": "Security Team",
            "due_date": payload["due_date"]
        }
        
        try:
            async with httpx.AsyncClient() as client:
                # Get OAuth token
                token_response = await client.post(
                    f"{self.instance_url}/oauth_token.do",
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self.client_id,
                        "client_secret": self.client_secret
                    }
                )
                
                token = token_response.json()["access_token"]
                
                # Create incident
                response = await client.post(
                    f"{self.instance_url}/api/now/table/incident",
                    json=sn_payload,
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                if response.status_code == 201:
                    data = response.json()
                    incident_id = data["result"]["number"]
                    logger.info(f"Created ServiceNow incident: {incident_id}")
                    return {
                        "status": "created",
                        "ticket_id": incident_id,
                        "url": f"{self.instance_url}/nav_to.do?uri=incident.do?sys_id={data['result']['sys_id']}"
                    }
                else:
                    logger.error(f"Failed to create ServiceNow incident: {response.text}")
                    return {"status": "error", "message": response.text}
        
        except Exception as e:
            logger.error(f"Error creating ServiceNow incident: {e}")
            return {"status": "error", "message": str(e)}

class OpenTicketService:
    """Open-source ticketing system (Taiga, Plane, etc.)"""
    
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url
        self.api_key = api_key
    
    async def create_ticket(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        """Create ticket in open-source system"""
        payload = AlertToTicketMapper.create_ticket_payload(alert)
        
        ticket_payload = {
            "title": payload["title"],
            "description": payload["description"],
            "priority": payload["priority"],
            "type": "bug",  # Security incident
            "status": "backlog",
            "labels": payload["tags"],
            "metadata": {
                "alert_id": alert.get("id"),
                "hostname": payload["hostname"],
                "severity": payload["severity"],
                "mitre_tactics": payload["mitre_tactics"],
                "detection_type": alert.get("detection_type")
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/issues",
                    json=ticket_payload,
                    headers={"Authorization": f"Token {self.api_key}"}
                )
                
                if response.status_code == 201:
                    data = response.json()
                    logger.info(f"Created ticket: {data['id']}")
                    return {
                        "status": "created",
                        "ticket_id": data["id"],
                        "url": f"{self.api_url}/issues/{data['id']}"
                    }
                else:
                    logger.error(f"Failed to create ticket: {response.text}")
                    return {"status": "error", "message": response.text}
        
        except Exception as e:
            logger.error(f"Error creating ticket: {e}")
            return {"status": "error", "message": str(e)}

class AutomationRuleEngine:
    """Automation rules for alert-to-ticket escalation"""
    
    def __init__(self):
        self.rules = []
    
    def add_rule(self, rule_config: Dict[str, Any]):
        """Add automation rule"""
        self.rules.append(rule_config)
    
    def evaluate_alert(self, alert: Dict[str, Any]) -> bool:
        """Check if alert matches any automation rules"""
        for rule in self.rules:
            if self._match_rule(rule, alert):
                return True
        return False
    
    def _match_rule(self, rule: Dict, alert: Dict) -> bool:
        """Match alert against a rule"""
        conditions = rule.get("conditions", {})
        match_type = conditions.get("match_type", "all")
        
        if match_type == "all":
            return all(self._check_condition(cond, alert) for cond in conditions.get("criteria", []))
        elif match_type == "any":
            return any(self._check_condition(cond, alert) for cond in conditions.get("criteria", []))
        
        return False
    
    def _check_condition(self, condition: Dict, alert: Dict) -> bool:
        """Check single condition"""
        field = condition.get("field")
        operator = condition.get("operator")
        value = condition.get("value")
        
        alert_value = alert.get(field)
        
        if operator == "equals":
            return alert_value == value
        elif operator == "contains":
            return value in alert_value if isinstance(alert_value, (str, list)) else False
        elif operator == "greater_than":
            return alert_value > value if isinstance(alert_value, (int, float)) else False
        elif operator == "in":
            return alert_value in value if isinstance(value, list) else False
        
        return False

# Default automation rules
DEFAULT_AUTOMATION_RULES = [
    {
        "id": "auto_ticket_critical",
        "name": "Auto-Ticket Critical Alerts",
        "enabled": True,
        "conditions": {
            "match_type": "all",
            "criteria": [
                {"field": "severity", "operator": "equals", "value": "critical"}
            ]
        },
        "action": "create_ticket",
        "ticket_priority": "1",
        "notify_teams": ["security_team"]
    },
    {
        "id": "auto_ticket_high_c2",
        "name": "Auto-Ticket High + C2 Detection",
        "enabled": True,
        "conditions": {
            "match_type": "all",
            "criteria": [
                {"field": "severity", "operator": "equals", "value": "high"},
                {"field": "mitre_tactics", "operator": "contains", "value": "Command and Control"}
            ]
        },
        "action": "create_ticket",
        "ticket_priority": "1",
        "notify_teams": ["security_team", "incident_response"]
    },
    {
        "id": "auto_ticket_lateral_movement",
        "name": "Auto-Ticket Lateral Movement",
        "enabled": True,
        "conditions": {
            "match_type": "all",
            "criteria": [
                {"field": "mitre_tactics", "operator": "contains", "value": "Lateral Movement"},
                {"field": "severity", "operator": "in", "value": ["high", "critical"]}
            ]
        },
        "action": "create_ticket_with_response",
        "ticket_priority": "1",
        "auto_response": "isolate_host",
        "notify_teams": ["security_team", "incident_response"]
    },
    {
        "id": "auto_ticket_exfiltration",
        "name": "Auto-Ticket Data Exfiltration",
        "enabled": True,
        "conditions": {
            "match_type": "all",
            "criteria": [
                {"field": "detection_type", "operator": "contains", "value": "exfiltration"}
            ]
        },
        "action": "create_ticket_urgent",
        "ticket_priority": "1",
        "notify_teams": ["security_team", "incident_response", "management"]
    }
]
