# SpyderXDR Complete Enterprise & SaaS Documentation

## 🎯 Overview

SpyderXDR is now a **complete, production-ready enterprise XDR platform** with:

✅ **Full Self-Service Admin Panel**
✅ **SaaS Multi-Tenant Architecture**
✅ **Automated Agent Deployment**
✅ **Stripe Billing Integration**
✅ **Complete API for Programmatic Management**
✅ **100% Client Self-Configurable** (like Agent)

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Admin Panel Features](#admin-panel-features)
3. [Self-Service Setup](#self-service-setup)
4. [API Reference](#api-reference)
5. [SaaS Subscription Tiers](#saas-subscription-tiers)
6. [Agent Deployment](#agent-deployment)
7. [Multitenancy & Isolation](#multitenancy--isolation)
8. [Billing & Usage Tracking](#billing--usage-tracking)
9. [Deployment Guide](#deployment-guide)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    WEB UI (React)                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │         SELF-SERVICE ADMIN DASHBOARD                │  │
│  │                                                     │  │
│  │  • Integrations Setup (5-click wizard)              │  │
│  │  • Agent Deployment (one-click)                     │  │
│  │  • Rules & Automation Configuration                │  │
│  │  • User & Team Management                          │  │
│  │  • API Key Generation                              │  │
│  │  • Usage & Billing Dashboard                       │  │
│  │  • System Settings                                 │  │
│  │  • Backup & Recovery                               │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │ HTTP/HTTPS
          ┌───────────────┼───────────────┐
          │               │               │
┌─────────▼──────┐ ┌──────▼──────┐ ┌────▼────────┐
│  Auth Service  │ │ Admin APIs  │ │ SaaS APIs   │
│  (Signup/Login)│ │             │ │ (Billing)   │
└────────────────┘ └─────────────┘ └─────────────┘
          │               │               │
          └───────────────┼───────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼────────┐ ┌─────▼──────┐ ┌────────▼───┐
│ PostgreSQL DB  │ │ Redis Cache│ │ Elasticsearch
│ (Multi-tenant) │ │ (by tenant)│ │ (indexed)
└────────────────┘ └────────────┘ └─────────────┘
        │
   [Stripe API]  [Agent API]  [Jira API]  [ServiceNow API]
```

### Tenant Isolation

```
Organization A              Organization B
├── Users (isolated)         ├── Users (isolated)
├── Events (encrypted)       ├── Events (encrypted)
├── Alerts (filtered)        ├── Alerts (filtered)
├── Integrations (separate)  ├── Integrations (separate)
└── API Keys (isolated)      └── API Keys (isolated)

All queries include: WHERE organization_id = :org_id
```

---

## Admin Panel Features

### 1. **Dashboard Tab** 📊
Real-time system overview:
- Active endpoints count
- Alert distribution by severity
- Detection types breakdown
- System uptime & health
- Recent activity feed

**Access**: `http://localhost:3000/admin`

### 2. **Integrations Tab** 🔌
5-click wizard for each integration:

#### Jira Integration
```
Step 1: Enter URL (https://jira.company.com)
Step 2: Provide API Token
Step 3: Select Project
Step 4: Auto-map fields
Step 5: Test & Save
```
✓ Automatic ticket creation on critical alerts
✓ Custom field mapping
✓ SLA tracking

#### ServiceNow Integration
```
Step 1: Enter Instance URL
Step 2: Provide OAuth Client ID & Secret
Step 3: Configure Incident Types
Step 4: Test & Save
```
✓ Incident creation with routing
✓ Assignment group mapping
✓ Status synchronization

#### Agent Integration
```
Step 1: Enter Manager Host
Step 2: Provide API Credentials
Step 3: Configure Sync Options
Step 4: Test & Save
```
✓ Real-time agent data
✓ Vulnerability scanning
✓ Compliance monitoring (CIS, PCI-DSS, GDPR, HIPAA, NIST)

#### Telegram Integration
```
Step 1: Create Bot (@BotFather)
Step 2: Enter Bot Token
Step 3: Enter Chat ID
Step 4: Test & Save
```
✓ Critical alert notifications
✓ Formatted messages with emoji
✓ On-the-go monitoring

### 3. **Agent Management Tab** 🤖
**Deploy agents in 3 clicks:**

1. **Select OS**: Windows / Linux / macOS
2. **Review Requirements**: System specs validation
3. **Download Script**: One-click deployment code
4. **Deploy**: Run on endpoints

**Agent List Shows:**
- Hostname
- OS type & version
- Connection status (active/offline)
- Events sent count
- Last check-in time
- Configuration options

**Actions:**
- View detailed logs
- Update configuration
- Restart agent
- Uninstall

### 4. **Rules & Automation Tab** ⚙️
**Create detection rules without coding:**

```
Rule Editor:
├── Rule Name
├── Type: Signature / Behavioral / Anomaly
├── Severity: Low / Medium / High / Critical
├── Conditions: YAML-based (easy to learn)
├── Auto Escalation: Alert / Ticket / Critical Ticket / Auto Response
└── Enable/Disable toggle
```

**Pre-built Rules** (editable):
- ✓ Suspicious Process Creation
- ✓ Behavioral Anomaly Detection
- ✓ C2 Communication Detection
- ✓ Lateral Movement Detection
- ✓ Data Exfiltration Attempts

**Test Rules**: Validate against sample events before activation

### 5. **User & Access Management Tab** 👥

#### Add Users
```
Form:
├── Full Name
├── Email
├── Role: Admin / Manager / Analyst / Viewer
└── MFA: Optional
```

**Roles & Permissions:**
| Role | Alerts | Rules | Integrations | Users | Billing |
|------|--------|-------|--------------|-------|---------|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manager | ✓ | ✓ | ✗ | ✓ | ✗ |
| Analyst | ✓ | ✗ | ✗ | ✗ | ✗ |
| Viewer | ✓ Read-only | ✗ | ✗ | ✗ | ✗ |

#### API Key Management
```
Generate Key:
├── Name: "Production API" 
├── Permissions: Full / Read-Only / Integrations / Agents
├── Expiry: 30/90/365 days or Never
└── Get: sk_prod_abc123def456...
```

**Keys Show:**
- Last used timestamp
- Permission level
- Creation date
- Revoke option (immediate)

### 6. **System Settings Tab** ⚙️

**Organization Settings:**
- Organization name
- Timezone
- Theme preference
- Language

**Feature Configuration:**
- Detection batch size (events/batch)
- Alert retention (days)
- Database backup frequency (hours)

**Notification Settings:**
- Email notifications (on/off)
- SMS notifications (on/off)
- Event aggregation (on/off)

**License Information:**
- Current tier (Free / Professional / Enterprise)
- Max endpoints licensed
- Endpoints in use
- License expiry date
- Auto-renewal status

**Backup & Recovery:**
- Manual backup creation
- Last backup timestamp
- Automatic backup schedule
- Restore from backup
- Download backup file

---

## Self-Service Setup

### Option 1: Local Testing (Docker)

```bash
# Start with demo credentials
docker-compose up -d

# Access admin panel
http://localhost:3000

# Login with default
Email: admin@company.com
Password: AdminPassword123!

# Configure everything from UI (no terminal needed!)
```

### Option 2: SaaS Signup

```bash
# Visit signup page
https://spyderxdr.cloud/signup

# Fill form:
- Full Name
- Email
- Organization Name
- Password

# Automatically:
✓ Creates organization
✓ Sets trial subscription (14 days)
✓ Generates API key
✓ Creates admin user
✓ Sends welcome email
```

### Option 3: Enterprise Deployment

```bash
# Provided by your account manager:
1. Deployment link
2. Instance URL
3. Admin credentials
4. Configuration wizard

# Follow in-app setup wizard (20 minutes)
```

---

## API Reference

### Authentication

#### Sign Up
```bash
POST /api/v1/saas/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@company.com",
  "password": "SecurePassword123!",
  "organization_name": "Acme Corp",
  "organization_slug": "acme-corp"
}

Response:
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "trial_ends": "2024-06-16T12:00:00Z"
}
```

#### Log In
```bash
POST /api/v1/saas/auth/login
Content-Type: application/json

{
  "email": "john@company.com",
  "password": "SecurePassword123!"
}

Response:
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "admin"
}
```

#### Use Token in Requests
```bash
Authorization: 

OR

X-API-Key: 
```

### Admin Endpoints

#### Integrations

```bash
# Test connection
POST /api/v1/admin/integrations/{integration_id}/test
X-API-Key: sk_prod_...

{
  "jira_url": "https://jira.company.com",
  "jira_api_token": "token...",
  "jira_project_key": "SEC"
}

# Save configuration
POST /api/v1/admin/integrations/{integration_id}
X-API-Key: sk_prod_...

# Same payload as test
```

#### Agent Management

```bash
# Get all agents
GET /api/v1/admin/agents?limit=100
Authorization: Bearer ...

# Get specific agent
GET /api/v1/admin/agents/{agent_id}
Authorization: Bearer ...

# Download deployment script
GET /api/v1/admin/agents/download/{os_type}
# os_type: windows, linux, macos
```

#### Rules

```bash
# List all rules
GET /api/v1/admin/rules?enabled=true
Authorization: Bearer ...

# Create rule
POST /api/v1/admin/rules
Authorization: Bearer ...

{
  "name": "Suspicious Process Creation",
  "type": "signature",
  "severity": "high",
  "automation": "create_ticket",
  "conditions": {
    "event_type": "process_creation",
    "process_name": ["cmd.exe", "powershell.exe"]
  }
}
```

#### Users

```bash
# List users
GET /api/v1/admin/users
Authorization: Bearer ...

# Add user
POST /api/v1/admin/users
Authorization: Bearer ...

{
  "name": "Jane Smith",
  "email": "jane@company.com",
  "role": "analyst"
}

# Generate API key
POST /api/v1/admin/api-keys
Authorization: Bearer ...

{
  "name": "Integration Key",
  "permissions": {"read": true, "write": true}
}
```

#### Settings

```bash
# Get settings
GET /api/v1/admin/settings
Authorization: Bearer ...

# Update settings
PUT /api/v1/admin/settings
Authorization: Bearer ...

{
  "organization_name": "My Company",
  "timezone": "America/New_York",
  "alert_retention_days": 90
}
```

### SaaS Endpoints

#### Organization

```bash
# Get organization info
GET /api/v1/saas/organization
Authorization: Bearer ...

# Update organization
PUT /api/v1/saas/organization
Authorization: Bearer ...

{
  "timezone": "UTC",
  "language": "en"
}
```

#### Subscription

```bash
# Get subscription
GET /api/v1/saas/subscription
Authorization: Bearer ...

# Upgrade subscription
POST /api/v1/saas/subscription/upgrade
Authorization: Bearer ...

{
  "new_tier": "professional"
}

# Create checkout
POST /api/v1/saas/billing/checkout
Authorization: Bearer ...

{
  "tier": "professional"
}
# Returns: checkout_url
```

#### Usage & Billing

```bash
# Current month usage
GET /api/v1/saas/usage/current
Authorization: Bearer ...

# Historical usage
GET /api/v1/saas/usage/historical?months=12
Authorization: Bearer ...

# Get invoices
GET /api/v1/saas/billing/invoices
Authorization: Bearer ...
```

---

## SaaS Subscription Tiers

### Free Tier
- **Price**: $0/month
- **Endpoints**: 50
- **Features**:
  - Basic threat detection
  - 5 integrations
  - 1 admin user
  - Email support
  - 30-day alert retention
- **Support**: Community forum
- **SLA**: Best effort

### Professional Tier
- **Price**: $999/month
- **Endpoints**: 1,000
- **Features**:
  - Advanced detection (behavioral + anomaly)
  - Unlimited integrations
  - 10 admin users
  - Rule creation
  - Alert automation
  - API access
  - Priority support
  - 90-day alert retention
- **Support**: Email support (24hrs)
- **SLA**: 99.5% uptime

### Enterprise Tier
- **Price**: $4,999/month (or custom)
- **Endpoints**: 100,000+
- **Features**:
  - Full feature set
  - Unlimited users
  - Advanced customization
  - SSO/SAML
  - Custom integrations
  - Dedicated support
  - 1-year alert retention
  - Advanced analytics
  - White-label options
- **Support**: 24/7 phone + email + Slack
- **SLA**: 99.9% uptime + dedicated infrastructure

### Pricing Details

| Feature | Free | Professional | Enterprise |
|---------|------|--------------|-----------|
| Events/month | 1M | 30M | Unlimited |
| API calls/hour | 100 | 10,000 | Unlimited |
| Storage | 10GB | 100GB | Custom |
| Custom rules | 5 | Unlimited | Unlimited |
| Integrations | 5 | Unlimited | Unlimited |
| Multi-org | ✗ | ✗ | ✓ |
| White-label | ✗ | ✗ | ✓ |
| Training | ✗ | ✓ | ✓ |

---

## Agent Deployment

### Automated One-Click Deployment

**From Admin Panel:**
1. Click "Deploy New Agent"
2. Select OS (Windows/Linux/macOS)
3. Review requirements
4. Download script
5. Run on endpoint
6. Agent appears in list (2-5 min)

### Manual Deployment

#### Windows PowerShell
```powershell
# Run as Administrator
$token = "YOUR_API_KEY"
$server = "https://spyderxdr.company.com"

Invoke-WebRequest -Uri "$server/api/v1/admin/agents/download/windows" `
  -OutFile "$env:TEMP\agent.ps1"

& "$env:TEMP\agent.ps1" -ApiKey $token -Server $server
```

#### Linux/macOS Bash
```bash
#!/bin/bash
TOKEN="YOUR_API_KEY"
SERVER="https://spyderxdr.company.com"

curl "$SERVER/api/v1/admin/agents/download/linux" \
  | bash -s -- --api-key $TOKEN --server $SERVER
```

### Agent Configuration Options

```yaml
# /opt/spyderxdr/config.yaml (Linux)
api_url: https://spyderxdr.company.com
api_key: sk_prod_...
hostname: prod-server-01

# Detection Settings
behavioral_detection: true
anomaly_detection: true
signature_detection: true

# Check Interval
event_check_interval: 300  # seconds

# Logging
log_level: INFO
log_path: /var/log/spyderxdr

# Resource Limits
max_memory_mb: 512
max_cpu_percent: 20
```

### Agent Health Monitoring

**From Admin Panel:**
- View agent status (active/offline/warning)
- Last check-in time
- Events sent count
- Agent version
- OS details
- Configuration

**Via API:**
```bash
GET /api/v1/admin/agents/{agent_id}
```

---

## Multitenancy & Isolation

### Tenant Data Isolation

**Every query automatically includes:**
```sql
WHERE organization_id = :current_org_id
```

**Examples:**
```sql
-- Events: Only events for this org
SELECT * FROM events 
WHERE organization_id = :org_id AND timestamp > now() - interval '24 hours'

-- Alerts: Only alerts for this org
SELECT * FROM alerts 
WHERE organization_id = :org_id AND severity >= 'high'

-- Users: Only users in this org
SELECT * FROM tenant_users 
WHERE organization_id = :org_id
```

### Cross-Tenant Data Breach Prevention

```python
# Middleware validates every request
if request.organization_id != token.organization_id:
    raise HTTPException(status_code=403, detail="Forbidden")
```

### Storage Separation

```
PostgreSQL:
├── organizations table (root)
├── tenant_users (filtered by org_id)
├── events (partitioned by org_id)
├── alerts (partitioned by org_id)
└── api_keys (filtered by org_id)

Redis (by tenant):
├── alerts:{org_id}:queue
├── baselines:{org_id}:{hostname}
└── cache:{org_id}:rules

Elasticsearch:
├── index: events-{org_id}-2024.06
├── index: alerts-{org_id}-2024.06
└── All queries include: query.match(organization_id = org_id)
```

---

## Billing & Usage Tracking

### Usage Metrics Tracked

```python
{
  "events_processed": 1500000,  # Daily
  "alerts_generated": 3500,     # Daily
  "endpoints_connected": 2456,  # Current
  "api_calls": 45000,           # Daily
  "storage_used_gb": 125        # Total
}
```

### Billing Calculations

```
Monthly Bill = Base Tier Price + Overage Charges

Example: Professional Tier ($999)
├── Base allocation
│   ├── 30M events/month
│   ├── 300k API calls/month
│   └── 100GB storage
└── Overage
    ├── +$0.001 per extra million events
    ├── +$0.0001 per extra API call
    └── +$0.10 per extra GB
```

### Stripe Integration

**Automatic Billing:**
- Monthly invoice generation
- Credit card charging
- Failed payment retry (3x)
- Invoice delivery to email
- Payment history in dashboard
- Tax calculation (if applicable)

**Subscription Events:**
```
Event: customer.subscription.created
→ Activate service immediately

Event: customer.subscription.updated
→ Update endpoints limit, features

Event: customer.subscription.deleted
→ Suspend on invoice date

Event: invoice.payment_succeeded
→ Update renewal date

Event: invoice.payment_failed
→ Alert customer, disable features after 7 days
```

### Usage Dashboard

**Shows:**
- Current month usage vs limit
- Percentage used (with warning at 80%)
- Projected overage charges
- Historical usage graph
- Upgrade recommendation (when > 80%)

---

## Deployment Guide

### Development (Laptop)
```bash
docker-compose up -d
# Access: http://localhost:3000
# API: http://localhost:8000/docs
```

### Small Business (AWS EC2)
```bash
# 1 x t3.xlarge (4CPU, 16GB RAM)
docker-compose -f docker-compose-enterprise.yml up -d
# Supports: 50-500 endpoints
# Cost: ~$100/month
```

### Medium Enterprise (Kubernetes)
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres-*.yaml
kubectl apply -f k8s/backend-*.yaml
kubectl apply -f k8s/frontend-*.yaml

# Supports: 5,000 endpoints
# Cost: ~$1,000/month
```

### Large Enterprise (Multi-region)
```bash
# 3+ Kubernetes clusters (one per region)
# PostgreSQL cluster with replication
# Redis cluster (6+ nodes)
# Elasticsearch cluster (10+ nodes)

# Supports: 100,000+ endpoints
# Cost: $10,000-50,000/month
```

---

## Security Best Practices

### For Customers

```
✓ Enable MFA on all user accounts
✓ Rotate API keys every 90 days
✓ Use read-only keys for integrations
✓ Enable TLS 1.3 for all connections
✓ Set strong passwords (16+ chars)
✓ Enable organization-level audit logging
✓ Regular backup verification
```

### For Administrators

```
✓ Regular security audits
✓ Penetration testing (quarterly)
✓ Vulnerability scanning (continuous)
✓ Access control reviews (monthly)
✓ Encryption key rotation (annual)
✓ DLP policies for sensitive data
```

---

## Monitoring & Support

### Health Checks

```bash
# Overall status
curl http://localhost:8000/health

# API status
curl http://localhost:8000/api/v1/status

# Admin endpoints
curl http://localhost:8000/api/v1/admin/status
```

### Support Channels

- **Free Tier**: Community forum (response: 48hrs)
- **Professional**: Email (response: 24hrs)
- **Enterprise**: Phone + Email + Slack (response: 1hr)

### Monitoring Dashboard

**Available in admin panel:**
- System uptime
- API response times
- Event processing rate
- Alert generation rate
- Storage usage
- Database health
- Integration status

---

## Next Steps

1. **Deploy** using your preferred option (Docker / K8s / Cloud)
2. **Sign up** or create first organization
3. **Configure integrations** using 5-click wizard
4. **Deploy agents** using one-click deployment
5. **Create rules** using rule editor
6. **Monitor** using dashboard
7. **Manage users** and permissions
8. **Track billing** and upgrade as needed

---

**✅ Everything is self-service - just like Agent!**

Clients can now configure and manage SpyderXDR completely through the web interface without requiring technical support or terminal access.

---

**Version**: 2.0.0-SaaS  
**Status**: Production Ready ✅  
**Last Updated**: 2024  
**Support**: 24/7 for Enterprise customers
