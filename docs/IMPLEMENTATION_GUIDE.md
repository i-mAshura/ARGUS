# Implementation Guide - Enterprise Features

## 🎯 Feature Overview

This guide covers implementing the complete enterprise setup with:
1. **Ticketing System Integration** (Jira, ServiceNow, open-source)
2. **Agent Integration** (attacks, vulnerabilities, compliance)
3. **Alert Automation** (severity-based ticket creation)
4. **Large-Scale Deployment** (100K+ endpoints)

## 1️⃣ Ticketing System Integration

### Setup Jira Integration

```python
# Initialize Jira ticketing service
from backend.app.integrations.ticketing_service import JiraTicketingService

jira_service = JiraTicketingService(
    jira_url="https://jira.company.com",
    api_token="YOUR_JIRA_API_TOKEN",
    project_key="SEC"  # Security project
)

# Test connection
await jira_service.create_ticket({
    "id": "test-alert",
    "title": "Test Security Alert",
    "severity": "critical",
    "hostname": "prod-server-01",
    "user": "system",
    "detection_type": "malware",
    "rule_id": "rule-001",
    "indicators": ["suspicious_process.exe"],
    "mitre_tactics": ["Execution"],
    "mitre_techniques": ["T1059"],
    "first_seen": "2024-01-15T10:30:00Z",
    "source_ip": "192.168.1.100"
})
```

### Setup ServiceNow Integration

```python
from backend.app.integrations.ticketing_service import ServiceNowTicketingService

sn_service = ServiceNowTicketingService(
    instance_url="https://company.service-now.com",
    client_id="YOUR_CLIENT_ID",
    client_secret="YOUR_CLIENT_SECRET"
)

# Create incident
result = await sn_service.create_ticket(alert_data)
# Returns: {"status": "created", "ticket_id": "INC123456", "url": "..."}
```

### Enable Automation Rules

```python
from backend.app.integrations.ticketing_service import (
    AutomationRuleEngine,
    DEFAULT_AUTOMATION_RULES
)

engine = AutomationRuleEngine()

# Add default rules
for rule in DEFAULT_AUTOMATION_RULES:
    engine.add_rule(rule)

# Check if alert matches rules
alert = {
    "severity": "critical",
    "mitre_tactics": ["Command and Control"],
    "detection_type": "c2_communication"
}

if engine.evaluate_alert(alert):
    print("✅ Alert matches automation rule - ticket will be created")
```

## 2️⃣ Agent Integration

### Connect to Agent

```python
from backend.app.integrations.agent_integration import AgentIntegrationService

agent_service = AgentIntegrationService(
    agent_host="agent.example.com",
    api_port=55000,
    username="admin",
    password="SecurePassword"
)

# Authenticate
if await agent_service.authenticate():
    print("✅ Connected to Agent")
```

### Fetch Agent Data

```python
# Get all agents
agents = await agent_service.get_agents()
print(f"Total agents: {len(agents)}")
for agent in agents:
    print(f"  - {agent['name']}: {agent['status']}")

# Get vulnerabilities
vulnerabilities = await agent_service.get_vulnerabilities()
print(f"Total vulnerabilities: {len(vulnerabilities)}")

# Get compliance status
compliance = await agent_service.get_compliance_data()
print(f"CIS Compliance: {compliance.get('cis_status')}")

# Get security posture
posture = await agent_service.get_security_posture_score()
print(f"Risk Score: {posture['overall_risk_score']}/100")
```

### Enrich Alerts with Agent Data

```python
# Enrich an alert with Agent data
enriched_alert = await agent_service.enrich_alert_with_agent(alert)

# Now includes:
# - agent_vulnerabilities: Vulnerabilities on that host
# - agent_system: Installed packages and processes
# - agent_fim_events: Recent file integrity changes
```

## 3️⃣ Alert Automation Pipeline

### Integrate into Detection Flow

Update `/backend/app/detection/engine.py`:

```python
from backend.app.integrations.ticketing_service import AutomationRuleEngine, DEFAULT_AUTOMATION_RULES

class DetectionEngine:
    def __init__(self):
        self.automation_engine = AutomationRuleEngine()
        for rule in DEFAULT_AUTOMATION_RULES:
            self.automation_engine.add_rule(rule)
    
    async def process_event(self, event: Dict[str, Any]) -> List[Dict]:
        # ... existing detection logic ...
        
        alerts = []
        for engine_type in [self.behavioral, self.anomaly, self.signature]:
            engine_alerts = await engine_type.analyze(event)
            alerts.extend(engine_alerts)
        
        # Process alerts through automation rules
        for alert in alerts:
            if self.automation_engine.evaluate_alert(alert):
                # Create ticket automatically
                ticket_result = await self.create_ticket_from_alert(alert)
                alert["ticket_info"] = ticket_result
        
        return alerts
    
    async def create_ticket_from_alert(self, alert: Dict) -> Dict:
        from backend.app.integrations.ticketing_service import JiraTicketingService
        
        jira_service = JiraTicketingService(
            jira_url=os.getenv("JIRA_URL"),
            api_token=os.getenv("JIRA_API_TOKEN"),
            project_key="SEC"
        )
        
        return await jira_service.create_ticket(alert)
```

## 4️⃣ API Integration Points

### Ticketing API

```bash
# Create ticket from alert
curl -X POST http://localhost:8000/api/v1/integrations/tickets/create-from-alert/{alert_id} \
  -H "Content-Type: application/json" \
  -d '{"provider": "jira"}'

# Get automation rules
curl http://localhost:8000/api/v1/integrations/tickets/automation-rules

# Test if alert matches rules
curl -X POST http://localhost:8000/api/v1/integrations/tickets/automation-rules/test/{alert_id}
```

### Agent API

```bash
# Connect to Agent
curl -X POST http://localhost:8000/api/v1/integrations/agent/connect \
  -H "Content-Type: application/json" \
  -d '{
    "agent_host": "agent.example.com",
    "api_port": 55000,
    "username": "admin",
    "password": "password"
  }'

# Get Agent agents
curl http://localhost:8000/api/v1/integrations/agent/agents

# Get vulnerabilities
curl http://localhost:8000/api/v1/integrations/agent/vulnerabilities?severity=critical

# Get compliance status
curl http://localhost:8000/api/v1/integrations/agent/compliance

# Get security posture
curl http://localhost:8000/api/v1/integrations/agent/posture

# Enrich alert with Agent data
curl -X POST http://localhost:8000/api/v1/integrations/agent/enrich-alert/{alert_id}
```

## 5️⃣ Configuration

### Environment Variables

```bash
# .env file
# ========== CORE ==========
DATABASE_URL=postgresql://spyderxdr:spyderxdr@postgres:5432/spyderxdr
REDIS_URL=redis://redis:6379/0
ELASTICSEARCH_URL=http://elasticsearch:9200

# ========== AGENT ==========
AGENT_HOST=agent.example.com
AGENT_PORT=55000
AGENT_USERNAME=admin
AGENT_PASSWORD=SecurePassword123
AGENT_VERIFY_SSL=true

# ========== JIRA ==========
JIRA_URL=https://jira.company.com
JIRA_USERNAME=spyderxdr-bot
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=SEC

# ========== SERVICENOW ==========
SERVICENOW_URL=https://company.service-now.com
SERVICENOW_CLIENT_ID=your_client_id
SERVICENOW_CLIENT_SECRET=your_client_secret

# ========== TELEGRAM ==========
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# ========== DETECTION ==========
DETECTION_BATCH_SIZE=500
DETECTION_THREADS=4
ANOMALY_DETECTION_ENABLED=true
BEHAVIORAL_DETECTION_ENABLED=true
SIGNATURE_DETECTION_ENABLED=true

# ========== SCALE ==========
DATABASE_POOL_SIZE=50
API_WORKERS=8
REDIS_CLUSTER_MODE=false
```

## 6️⃣ Deployment Checklist

### Pre-Deployment

- [ ] Configure all environment variables
- [ ] Set up Jira project with custom fields
- [ ] Create ServiceNow OAuth credentials
- [ ] Configure Agent API credentials
- [ ] Set up Telegram bot
- [ ] Configure SSL certificates
- [ ] Set up database backups
- [ ] Configure Redis persistence

### Deployment

```bash
# Deploy enterprise setup
docker-compose -f docker/docker-compose-enterprise.yml up -d

# Verify all services
docker-compose -f docker/docker-compose-enterprise.yml ps

# Check logs
docker-compose -f docker/docker-compose-enterprise.yml logs -f backend-1

# Verify Agent connection
curl -k -u admin:password https://localhost:55000/api/v1/manager/info

# Verify Elasticsearch
curl http://localhost:9200/_cluster/health

# Access dashboard
# Frontend: http://localhost:3000
# Kibana: http://localhost:5601
# Grafana: http://localhost:3001
```

### Post-Deployment

- [ ] Test alert creation to Jira
- [ ] Test alert creation to ServiceNow
- [ ] Verify Agent integration
- [ ] Test automation rules
- [ ] Monitor system metrics
- [ ] Set up alerting in Prometheus
- [ ] Configure log rotation
- [ ] Perform load testing

## 7️⃣ Scaling to 100K+ Endpoints

### Database Scaling

```sql
-- Create partitions for events table
CREATE TABLE events_2024_q1 PARTITION OF events
  FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE events_2024_q2 PARTITION OF events
  FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- Create indexes on hot columns
CREATE INDEX idx_events_hostname_timestamp ON events(hostname, timestamp DESC);
CREATE INDEX idx_events_severity_timestamp ON events(severity, timestamp DESC);
CREATE INDEX idx_alerts_status_timestamp ON alerts(status, timestamp DESC);
```

### Elasticsearch Scaling

```yaml
# Elasticsearch 10+ node cluster
- name: node-1
  node.roles: [master, data]
- name: node-2
  node.roles: [master, data]
- name: node-3
  node.roles: [master, data]
- name: node-4
  node.roles: [data]
- name: node-5
  node.roles: [data]
  # ... more data nodes
```

### Redis Scaling

```bash
# Activate Redis Cluster mode for 100K+ endpoints
redis-cli --cluster create \
  redis-1:6379 redis-2:6379 redis-3:6379 \
  redis-4:6379 redis-5:6379 redis-6:6379 \
  --cluster-replicas 1
```

## ✅ Validation

```bash
# Check system health
curl http://localhost:8000/health

# Check integration status
curl http://localhost:8000/api/v1/integrations/status

# Test alert detection
curl -X POST http://localhost:8000/api/v1/events/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "prod-server",
    "event_type": "process_creation",
    "process_name": "suspicious.exe"
  }'

# Verify alert created
curl http://localhost:8000/api/v1/alerts?limit=10
```

## 📞 Support & Troubleshooting

See `docs/TROUBLESHOOTING.md` for common issues and solutions.
