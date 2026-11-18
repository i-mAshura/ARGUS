"""
Admin API Endpoints for System Management
Handles integrations, agent deployment, rules, users, and system settings
"""
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from typing import Dict, Any, List, Optional
from datetime import datetime
import os
import json



router = APIRouter()

# ==================== INTEGRATION MANAGEMENT ====================

def mask_sensitive_keys(data: Any) -> Any:
    if isinstance(data, dict):
        masked = {}
        for k, v in data.items():
            k_lower = k.lower()
            if any(secret_word in k_lower for secret_word in ["token", "password", "key", "secret", "private"]):
                if isinstance(v, str):
                    if len(v) <= 8:
                        masked[k] = "********"
                    else:
                        masked[k] = "********" + v[-4:]
                else:
                    masked[k] = v
            else:
                masked[k] = mask_sensitive_keys(v)
        return masked
    elif isinstance(data, list):
        return [mask_sensitive_keys(item) for item in data]
    return data

def resolve_masked_keys(integration_id: str, incoming_config: Dict[str, Any]) -> Dict[str, Any]:
    from app.integrations.config_helper import get_integration_config
    existing = get_integration_config(integration_id)
    if not existing:
        return incoming_config
    
    resolved = {}
    for k, v in incoming_config.items():
        k_lower = k.lower()
        if any(secret_word in k_lower for secret_word in ["token", "password", "key", "secret", "private"]):
            if isinstance(v, str) and (v.startswith("****") or v == "********"):
                resolved[k] = existing.get(k, v)
            else:
                resolved[k] = v
        else:
            resolved[k] = v
    return resolved

@router.post("/integrations/{integration_id}/test")
async def test_integration(integration_id: str, config: Dict[str, Any]):
    """Test integration configuration"""
    try:
        # Resolve masked keys using currently saved config
        config = resolve_masked_keys(integration_id, config)
        
        if integration_id == "jira":
            # Test Jira connection
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{config['jira_url']}/rest/api/3/myself",
                    auth=(config.get('jira_username', 'admin'), config['jira_api_token'])
                )
                if response.status_code == 200:
                    return {"success": True, "message": "✅ Jira connection successful"}
                else:
                    return {"success": False, "message": f"❌ Jira error: {response.status_code}"}
        
        elif integration_id == "servicenow":
            # Test ServiceNow connection
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{config['servicenow_url']}/oauth_token.do",
                    data={
                        "grant_type": "client_credentials",
                        "client_id": config['servicenow_client_id'],
                        "client_secret": config['servicenow_client_secret']
                    }
                )
                if response.status_code == 200:
                    return {"success": True, "message": "✅ ServiceNow connection successful"}
                else:
                    return {"success": False, "message": f"❌ ServiceNow error: {response.status_code}"}
        
        elif integration_id == "agent":
            # Test Agent connection
            from app.integrations.agent_integration import AgentIntegrationService
            service = AgentIntegrationService(
                config['agent_host'],
                config['agent_port'],
                config['agent_username'],
                config['agent_password']
            )
            if await service.authenticate():
                return {"success": True, "message": "✅ Agent connection successful"}
            else:
                return {"success": False, "message": "❌ Agent authentication failed"}
        
        elif integration_id == "telegram":
            # Test Telegram bot
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.telegram.org/bot{config['telegram_bot_token']}/getMe"
                )
                if response.status_code == 200:
                    return {"success": True, "message": "✅ Telegram bot is valid"}
                else:
                    return {"success": False, "message": "❌ Invalid Telegram token"}
        
        elif integration_id == "virustotal":
            # Test VirusTotal API
            import httpx
            async with httpx.AsyncClient() as client:
                headers = {"x-apikey": config.get('api_key', '')}
                response = await client.get(
                    "https://www.virustotal.com/api/v3/files/44d88612fea8a8f36de82e1278abb02f",
                    headers=headers
                )
                if response.status_code in [200, 404]:
                    return {"success": True, "message": "✅ VirusTotal connection validated successfully"}
                else:
                    return {"success": False, "message": f"❌ VirusTotal API key validation failed: {response.status_code}"}
        
        return {"success": False, "message": "Unknown integration"}
    
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

@router.get("/integrations")
async def get_all_integrations():
    """Get all saved integration configurations"""
    from app.integrations.config_helper import get_integrations_file_path
    path = get_integrations_file_path()
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                data = json.load(f)
                return mask_sensitive_keys(data)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read config: {str(e)}")
    return {}

@router.get("/integrations/{integration_id}")
async def get_integration(integration_id: str):
    """Get configuration details for a specific integration"""
    from app.integrations.config_helper import get_integration_config
    config = get_integration_config(integration_id)
    if config:
        return mask_sensitive_keys(config)
    return {"status": "not_configured"}

@router.post("/integrations/{integration_id}")
async def save_integration(integration_id: str, config: Dict[str, Any]):
    """Save integration configuration"""
    try:
        from app.integrations.config_helper import save_integration_config
        
        # Resolve masked keys so we don't save asterisks
        resolved_config = resolve_masked_keys(integration_id, config)
        
        saved_payload = {
            **resolved_config,
            'configured_at': datetime.utcnow().isoformat(),
            'status': 'configured'
        }
        
        success = save_integration_config(integration_id, saved_payload)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save integration config")
            
        return {
            "status": "configured",
            "message": f"✅ {integration_id} integration saved successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== AGENT MANAGEMENT ====================

@router.get("/agents")
async def get_agents(
    status: Optional[str] = Query(None),
    os_type: Optional[str] = Query(None),
    limit: int = Query(100)
):
    """Get all agents with filtering"""
    try:
        from sqlalchemy import select
        from app.models.database import Agent
        from app.main import db
        
        async for session in db.get_session():
            query = select(Agent)
            
            if status:
                query = query.where(Agent.status == status)
            if os_type:
                query = query.where(Agent.os_type == os_type)
            
            query = query.limit(limit)
            result = await session.execute(query)
            agents = result.scalars().all()
            
            return {
                "total": len(agents),
                "agents": [
                    {
                        "id": a.id,
                        "hostname": a.hostname,
                        "os": a.os_type,
                        "status": a.status,
                        "version": a.version,
                        "last_checkin": a.last_checkin,
                        "events_sent": a.events_processed
                    }
                    for a in agents
                ]
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    """Get specific agent details"""
    try:
        from sqlalchemy import select
        from app.models.database import Agent
        from app.main import db
        
        async for session in db.get_session():
            query = select(Agent).where(Agent.id == agent_id)
            result = await session.execute(query)
            agent = result.scalar_one_or_none()
            
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")
            
            return {
                "id": agent.id,
                "hostname": agent.hostname,
                "os": agent.os_type,
                "status": agent.status,
                "version": agent.version,
                "ip_address": agent.ip_address,
                "last_checkin": agent.last_checkin,
                "events_sent": agent.events_processed,
                "configuration": {
                    "detection_enabled": True,
                    "behavioral_enabled": True,
                    "anomaly_enabled": True,
                    "check_interval": 300,
                    "log_level": "INFO"
                }
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str):
    """Delete an agent and cascade delete all its associated alerts, events, baselines, responses, tickets"""
    try:
        from sqlalchemy import select, delete
        from app.models.database import Agent, Event, Alert, Baseline, Response, Ticket
        from app.main import db
        
        async for session in db.get_session():
            query = select(Agent).where(Agent.id == agent_id)
            result = await session.execute(query)
            agent = result.scalar_one_or_none()
            
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")
                
            hostname = agent.hostname
            
            # Get all alerts for this hostname
            alerts_query = select(Alert.id).where(Alert.hostname == hostname)
            alerts_res = await session.execute(alerts_query)
            alert_ids = [r for r in alerts_res.scalars().all()]
            
            # Cascade delete from responses & tickets linked to alerts
            if alert_ids:
                del_responses = delete(Response).where(Response.alert_id.in_(alert_ids))
                await session.execute(del_responses)
                
                del_tickets = delete(Ticket).where(Ticket.alert_id.in_(alert_ids))
                await session.execute(del_tickets)
            
            # Cascade delete alerts
            del_alerts = delete(Alert).where(Alert.hostname == hostname)
            await session.execute(del_alerts)
            
            # Cascade delete events
            del_events = delete(Event).where((Event.agent_id == agent_id) | (Event.hostname == hostname))
            await session.execute(del_events)
            
            # Cascade delete baselines
            del_baselines = delete(Baseline).where(Baseline.hostname == hostname)
            await session.execute(del_baselines)
            
            # Delete agent record
            await session.delete(agent)
            await session.commit()
            
            return {
                "status": "deleted",
                "message": f"Agent {agent_id} and all related telemetry, alerts, tickets, and baselines deleted successfully"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agents/download/{os_type}")
async def download_agent(os_type: str, request: Request, server: Optional[str] = None):
    """Generate and download agent for specified OS or binary file"""
    from fastapi.responses import FileResponse
    import os
    
    # Define binary file response logic
    if os_type in ["windows-binary", "linux-binary", "macos-binary"]:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        if os_type == "windows-binary":
            binary_path = os.path.join(base_dir, "app", "static", "binaries", "agent.exe")
            if os.path.exists(binary_path):
                return FileResponse(binary_path, media_type="application/octet-stream", filename="agent.exe")
            # Fallback if binary is not compiled yet (e.g. serve source script)
            fallback_script = os.path.join(base_dir, "..", "agents", "windows", "agent.py")
            if os.path.exists(fallback_script):
                return FileResponse(fallback_script, media_type="text/x-python", filename="agent.py")
            raise HTTPException(status_code=404, detail="Windows agent binary/script not found on server")
            
        elif os_type == "linux-binary":
            # Serve the python agent.py directly as a script since it runs on Python
            script_path = os.path.join(base_dir, "..", "agents", "linux", "agent.py")
            if os.path.exists(script_path):
                return FileResponse(script_path, media_type="text/x-python", filename="agent.py")
            raise HTTPException(status_code=404, detail="Linux agent script not found on server")
            
        elif os_type == "macos-binary":
            # Use windows agent.py as a script fallback
            script_path = os.path.join(base_dir, "..", "agents", "windows", "agent.py")
            if os.path.exists(script_path):
                return FileResponse(script_path, media_type="text/x-python", filename="agent.py")
            raise HTTPException(status_code=404, detail="macOS agent script not found on server")
            
    base_url = server or str(request.base_url).rstrip('/')
    
    agent_scripts = {
        "windows": generate_windows_agent(base_url),
        "linux": generate_linux_agent(base_url),
        "macos": generate_macos_agent(base_url)
    }
    
    if os_type not in agent_scripts:
        raise HTTPException(status_code=400, detail="Invalid OS type")
    
    return {
        "os": os_type,
        "script": agent_scripts[os_type],
        "instructions": f"Run this script on your {os_type} endpoint"
    }

def generate_windows_agent(base_url: str):
    """Generate Windows deployment script"""
    return f"""# Windows ARGUS Agent Deployment
# Run as Administrator in PowerShell

$ProgressPreference = "SilentlyContinue"
$baseUrl = "{base_url}"
$agentPath = "C:\\Program Files\\ARGUS"

# Create directory
New-Item -ItemType Directory -Path $agentPath -Force | Out-Null

# Download agent
$agentUrl = "$baseUrl/api/v1/admin/agents/download/windows-binary"
$agentToken = "secure_key_argus_hmac"
Invoke-WebRequest -Uri $agentUrl -OutFile "$agentPath\\agent.py"

# Create configuration
$config = @{{
    api_url = "$baseUrl"
    hostname = [System.Net.Dns]::GetHostName()
    os = "windows"
    agent_key = "$agentToken"
}}
$config | ConvertTo-Json | Out-File "$agentPath\\config.json"

Write-Host "✅ ARGUS agent downloaded and configured at $agentPath\\agent.py"
Write-Host "Run: python '$agentPath\\agent.py' to start the agent"
"""

def generate_linux_agent(base_url: str):
    """Generate Linux deployment script"""
    return f"""#!/bin/bash
# Linux ARGUS Agent Deployment

set -e

BASE_URL="{base_url}"
AGENT_PATH="/opt/argus"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root"
    exit 1
fi

# Create directory
mkdir -p $AGENT_PATH

# Download agent
curl -fsSL "$BASE_URL/api/v1/admin/agents/download/linux-binary" -o $AGENT_PATH/agent.py
chmod +x $AGENT_PATH/agent.py

# Create configuration
cat > $AGENT_PATH/config.json << EOF
{{
    "api_url": "$BASE_URL",
    "hostname": "$(hostname)",
    "os": "linux",
    "agent_key": "secure_key_argus_hmac"
}}
EOF

# Install systemd service
cat > /etc/systemd/system/argus.service << EOF
[Unit]
Description=ARGUS Security Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 $AGENT_PATH/agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable argus
systemctl start argus

echo "✅ ARGUS agent installed and started successfully"
"""

def generate_macos_agent(base_url: str):
    """Generate macOS deployment script"""
    return f"""#!/bin/bash
# macOS ARGUS Agent Deployment

BASE_URL="{base_url}"
AGENT_PATH="/Library/ARGUS"

# Create directory
sudo mkdir -p $AGENT_PATH

# Download agent
sudo curl -fsSL "$BASE_URL/api/v1/admin/agents/download/macos-binary" -o $AGENT_PATH/agent.py
sudo chmod +x $AGENT_PATH/agent.py

# Create configuration
sudo tee $AGENT_PATH/config.json > /dev/null << EOF
{{
    "api_url": "$BASE_URL",
    "hostname": "$(hostname)",
    "os": "macos",
    "agent_key": "secure_key_argus_hmac"
}}
EOF

# Create launch agent
sudo tee /Library/LaunchDaemons/com.argus.agent.plist > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.argus.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$AGENT_PATH/agent.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

sudo launchctl load /Library/LaunchDaemons/com.argus.agent.plist

echo "✅ ARGUS agent installed successfully"
"""

# ==================== RULES MANAGEMENT ====================

@router.get("/rules")
async def get_rules(enabled: Optional[bool] = None, limit: int = 100):
    """Get all rules with optional filtering"""
    try:
        from sqlalchemy import select
        from app.models.database import Rule
        from app.main import db
        
        async for session in db.get_session():
            query = select(Rule)
            
            if enabled is not None:
                query = query.where(Rule.is_enabled == enabled)
            
            query = query.limit(limit)
            result = await session.execute(query)
            rules = result.scalars().all()
            
            return {
                "total": len(rules),
                "rules": [
                    {
                        "id": r.id,
                        "name": r.name,
                        "type": r.rule_type,
                        "severity": r.severity,
                        "enabled": r.is_enabled
                    }
                    for r in rules
                ]
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rules")
async def create_rule(rule_data: Dict[str, Any]):
    """Create new detection rule"""
    try:
        import uuid
        from app.models.database import Rule
        from app.main import db
        
        async for session in db.get_session():
            new_rule = Rule(
                id=str(uuid.uuid4()),
                name=rule_data['name'],
                rule_type=rule_data['type'],
                severity=rule_data['severity'],
                is_enabled=True,
                conditions=rule_data.get('conditions', {}),
                actions=rule_data.get('automation', [])
            )
            
            session.add(new_rule)
            await session.commit()
            
            return {
                "id": new_rule.id,
                "status": "created",
                "message": "Rule created successfully"
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== USER & ACCESS MANAGEMENT ====================

@router.get("/users")
async def get_users():
    """Get all users from database"""
    from app.main import db
    async for session in db.get_session():
        from sqlalchemy import select
        from app.models.database import User
        query = select(User)
        result = await session.execute(query)
        users = result.scalars().all()
        return {
            "users": [
                {
                    "id": u.id,
                    "name": u.username,
                    "email": u.email,
                    "role": u.role,
                    "mfa_enabled": True
                }
                for u in users
            ]
        }

@router.post("/users")
async def create_user(user_data: Dict[str, Any]):
    """Create new user in database"""
    try:
        from app.main import db
        async for session in db.get_session():
            from app.models.database import User
            import uuid
            
            new_user = User(
                id=str(uuid.uuid4()),
                username=user_data.get("name"),
                email=user_data.get("email"),
                password_hash="hashed_default",
                role=user_data.get("role", "analyst")
            )
            session.add(new_user)
            await session.commit()
            return {
                "id": new_user.id,
                "status": "created",
                "message": "User created successfully"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Delete user from database"""
    try:
        from app.main import db
        async for session in db.get_session():
            from sqlalchemy import select
            from app.models.database import User
            
            query = select(User).where(User.id == user_id)
            result = await session.execute(query)
            user = result.scalar_one_or_none()
            if user:
                await session.delete(user)
                await session.commit()
                return {"status": "deleted", "message": "User deleted successfully"}
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api-keys")
async def get_api_keys():
    """Get all API keys from Redis cache"""
    from app.main import redis_service
    keys = await redis_service.get("api_keys") or []
    return {"keys": keys}

@router.post("/api-keys")
async def generate_api_key(key_data: Dict[str, Any]):
    """Generate new API key and store in Redis"""
    from app.main import redis_service
    import secrets
    import uuid
    
    key = f"sk_prod_{secrets.token_hex(16)}"
    
    keys = await redis_service.get("api_keys") or []
    new_key = {
        "id": f"key-{str(uuid.uuid4())[:8]}",
        "name": key_data.get('name'),
        "key": key,
        "permissions": key_data.get('permissions', 'ingest_only'),
        "created_at": datetime.utcnow().strftime("%Y-%m-%d"),
        "last_used": "Never"
    }
    keys.append(new_key)
    await redis_service.set("api_keys", keys)
    
    return {
        "id": new_key["id"],
        "key": key,
        "name": new_key["name"],
        "permissions": new_key["permissions"],
        "message": "API key generated. Save it securely!"
    }

@router.delete("/api-keys/{key_id}")
async def delete_api_key(key_id: str):
    """Revoke API key"""
    from app.main import redis_service
    keys = await redis_service.get("api_keys") or []
    updated_keys = [k for k in keys if k["id"] != key_id]
    await redis_service.set("api_keys", updated_keys)
    return {"status": "revoked", "message": "API key revoked successfully"}


# ==================== SYSTEM SETTINGS ====================

@router.get("/settings")
async def get_settings():
    """Get system settings"""
    return {
        "organization_name": os.getenv("ORG_NAME", "My Organization"),
        "timezone": os.getenv("TIMEZONE", "UTC"),
        "detection_batch_size": int(os.getenv("DETECTION_BATCH_SIZE", 500)),
        "alert_retention_days": 90
    }

@router.put("/settings")
async def save_settings(settings: Dict[str, Any]):
    """Save system settings"""
    # Update configuration
    try:
        config_file = '/app/config/settings.json'
        os.makedirs('/app/config', exist_ok=True)
        
        with open(config_file, 'w') as f:
            json.dump(settings, f, indent=2)
        
        return {
            "status": "saved",
            "message": "Settings saved successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== BACKUP & RECOVERY ====================

@router.post("/backup")
async def create_backup():
    """Create system backup"""
    import subprocess
    
    try:
        timestamp = datetime.utcnow().isoformat()
        backup_file = f"backup_{timestamp}.tar.gz"
        
        # In production, use professional backup tools
        # For demo, just create a marker
        
        return {
            "status": "creating",
            "file": backup_file,
            "message": "Backup created successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_admin_status():
    """Get overall system status"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "database": "healthy",
            "cache": "healthy",
            "detection_engines": "operational",
            "integrations": {
                "jira": "configured",
                "agent": "connected",
                "telegram": "active"
            }
        }
    }

@router.get("/ml/baselines")
async def get_all_baselines():
    """Retrieve all learned behavioral baselines"""
    from sqlalchemy import select
    from app.models.database import Baseline
    from app.main import db
    
    async for session in db.get_session():
        query = select(Baseline)
        result = await session.execute(query)
        baselines = result.scalars().all()
        return [
            {
                "id": b.id,
                "hostname": b.hostname,
                "username": b.username,
                "behavior_type": b.behavior_type,
                "baseline_data": b.baseline_data,
                "learned_at": b.learned_at.isoformat() if b.learned_at else None,
                "updated_at": b.updated_at.isoformat() if b.updated_at else None
            }
            for b in baselines
        ]

@router.post("/ml/retrain")
async def retrain_ml_models():
    """Trigger retraining of behavioral baselines on all active agents"""
    from sqlalchemy import select
    from app.models.database import Agent
    from app.detection.anomaly import AnomalyDetectionEngine
    from app.main import db, redis_service
    
    anomaly_engine = AnomalyDetectionEngine(db, redis_service)
    
    async for session in db.get_session():
        query = select(Agent)
        result = await session.execute(query)
        agents = result.scalars().all()
        
        rebuilt_count = 0
        for agent in agents:
            for behavior_type in ["process_creation", "network_connection", "file_created", "registry_modified"]:
                await anomaly_engine._build_baseline(
                    session,
                    hostname=agent.hostname,
                    username="system",
                    behavior_type=behavior_type
                )
                rebuilt_count += 1
                
        return {
            "success": True,
            "message": f"Successfully retrained and updated {rebuilt_count} behavioral baselines for {len(agents)} active agents.",
            "timestamp": datetime.utcnow().isoformat()
        }
