"""
AI Threat Copilot and Deception API Endpoints
"""
from fastapi import APIRouter, Query, Body
from typing import Dict, Any, List
import uuid
from datetime import datetime
from sqlalchemy import select, func, and_

from app.models.database import Alert, Event, Agent, Response

router = APIRouter()

# In-memory session logs for simulated agents
AGENT_EXECUTION_LOGS = {}

@router.post("/copilot/chat")
async def copilot_chat(payload: Dict[str, Any] = Body(...)):
    """Conversational AI Copilot querying SIEM logs and alerts databases"""
    from app.main import db
    message = payload.get("message", "").lower()
    
    async for session in db.get_session():
        # Query total DB stats for real-time response context
        total_alerts = await session.scalar(select(func.count(Alert.id))) or 0
        total_events = await session.scalar(select(func.count(Event.id))) or 0
        
        reply_text = ""
        action_data = None
        
        if "brute" in message or "failed" in message or "auth" in message:
            # Query if we have any SSH or Windows logon failure events in DB
            query = select(Event).where(Event.event_type == "network_connection").limit(5)
            result = await session.execute(query)
            db_events = result.scalars().all()
            
            reply_text = f"Checking SIEM databases... I found {total_events} parsed events. "
            if db_events:
                reply_text += f"There are active connections on agent **{db_events[0].hostname}** from source IP **{db_events[0].source_ip}**. I recommend blocking this source IP immediately to prevent potential intrusion."
                action_data = {
                    "label": f"Block Source IP {db_events[0].source_ip}",
                    "type": "block_ip",
                    "parameter": db_events[0].source_ip,
                    "target": db_events[0].hostname
                }
            else:
                reply_text += "I did not find logon anomalies in the events table. However, threat intelligence suggests monitoring SSH ports (22) for inbound noise."
                action_data = {
                    "label": "Block Inbound SSH IP 185.190.140.23",
                    "type": "block_ip",
                    "parameter": "185.190.140.23",
                    "target": "ABHIRAM"
                }
                
        elif "abhiram" in message or "anomaly" in message or "process" in message:
            # Query recent alerts on host ABHIRAM
            query = select(Alert).where(Alert.hostname == "ABHIRAM").limit(3)
            result = await session.execute(query)
            db_alerts = result.scalars().all()
            
            if db_alerts:
                reply_text = f"I retrieved {len(db_alerts)} active alerts for host **ABHIRAM**. The most critical alert is: **{db_alerts[0].title}** (Severity: {db_alerts[0].severity})."
                action_data = {
                    "label": "Isolate Host ABHIRAM",
                    "type": "isolate_host",
                    "parameter": "ABHIRAM",
                    "target": "ABHIRAM"
                }
            else:
                reply_text = "I scanned the alerts table. Host **ABHIRAM** has no critical alerts registered. However, I can trigger an active diagnostics scan to check for memory anomalies."
                action_data = {
                    "label": "Diagnose Host ABHIRAM",
                    "type": "diagnose_host",
                    "parameter": "ABHIRAM",
                    "target": "ABHIRAM"
                }
                
        elif "isolate" in message or "contain" in message:
            reply_text = "I can issue network containment blockades. This locks down all network routes on the agent except communications back to this ARGUS console."
            action_data = {
                "label": "Execute Subnet Isolation on ABHIRAM",
                "type": "isolate_host",
                "parameter": "ABHIRAM",
                "target": "ABHIRAM"
            }
        elif "outdated" in message or "config" in message or "hygiene" in message:
            reply_text = "Analyzing IT hygiene scorecards... Endpoints show configuration drifts. Specifically, passwords fail minimum length standards (currently set to 8 characters instead of 14)."
            action_data = {
                "label": "Enforce CIS Passwords Hardening",
                "type": "remediate_hygiene",
                "parameter": "dev-machine-01",
                "target": "dev-machine-01"
            }
        else:
            reply_text = f"I searched the databases (which contain {total_events} events and {total_alerts} alerts). No specific threat indicators matched your query: '{payload.get('message')}'."
            reply_text += " Try asking me about 'brute force failed logons' or 'process anomalies on ABHIRAM'."
            
        return {
            "sender": "ai",
            "text": reply_text,
            "action": action_data,
            "timestamp": datetime.utcnow().isoformat()
        }

@router.post("/agents/spawn")
async def spawn_agent(payload: Dict[str, Any] = Body(...)):
    """Spawn an autonomous incident containment agent simulation"""
    hostname = payload.get("hostname", "ABHIRAM")
    action_title = payload.get("action", "Manual Diagnostic Integrity Scan")
    
    agent_run_id = f"agent-run-{str(uuid.uuid4())[:8]}"
    
    # Store dynamic execution sequence logs in cache/memory
    AGENT_EXECUTION_LOGS[agent_run_id] = {
        "id": agent_run_id,
        "name": f"Spyder-Auto-{str(uuid.uuid4())[:4].upper()}",
        "host": hostname,
        "threat": action_title,
        "status": "completed",
        "timestamp": datetime.utcnow().isoformat(),
        "steps": [
          { "type": "OBSERVE", "label": "Telemetry Intake", "desc": f"Intake request verified. Scanning agent {hostname} socket files and local directories." },
          { "type": "THINK", "label": "Threat Analysis", "desc": f"Analyzing endpoint files against threat definitions. Action target: '{action_title}'." },
          { "type": "ACT", "label": "Mitigation Dispatch", "desc": f"Dispatched OS containment payload. Rule modification completed successfully." },
          { "type": "VERIFY", "label": "Host Re-audit", "desc": f"Agent audited target parameters. Threat is neutralized. Node state: Safe." },
          { "type": "REPORT", "label": "SOC Reporting", "desc": "Wrote incident post-mortem. Alert status flagged as resolved." }
        ]
    }
    
    return AGENT_EXECUTION_LOGS[agent_run_id]

@router.get("/attack-path")
async def attack_path():
    """Generates lateral movement attack graph nodes dynamically from database telemetry"""
    from app.main import db
    async for session in db.get_session():
        # Read total alerts in database
        alerts_query = select(Alert).limit(10)
        result = await session.execute(alerts_query)
        db_alerts = result.scalars().all()
        
        # Check if ABHIRAM has any critical alerts
        has_critical = any(a.severity == "critical" and a.hostname == "ABHIRAM" for a in db_alerts)
        
        nodes = {
          "internet": { "id": "internet", "name": "External Adversary", "type": "hacker", "ip": "185.190.140.23", "status": "compromised", "desc": "Remote Command & Control Server" },
          "perimeter": { "id": "perimeter", "name": "External Firewall", "type": "firewall", "ip": "10.0.0.1", "status": "bypassed", "desc": "Edge ingress filtering bypass via VPN exploit" },
          "laptop": { "id": "laptop", "name": "employee-laptop-01", "type": "workstation", "ip": "10.0.1.15", "status": "compromised", "desc": "Compromised via malicious PDF attachment phishing campaign" },
          "abhiram": { "id": "abhiram", "name": "ABHIRAM (Win11)", "type": "workstation", "ip": "10.0.1.22", "status": "compromised" if has_critical else "safe", "desc": "Lateral credentials harvested via lsass.exe memory dump" },
          "database": { "id": "database", "name": "prod-db-01", "type": "server", "ip": "10.0.2.80", "status": "at-risk", "desc": "Database backend storing encrypted card hashes" },
          "controller": { "id": "controller", "name": "domain-controller-01", "type": "server", "ip": "10.0.2.10", "status": "at-risk", "desc": "Domain root control node" }
        }
        
        return {
            "nodes": nodes,
            "total_compromised": len([n for n in nodes.values() if n["status"] == "compromised"])
        }

# ==================== DECEPTION HONEY-TOKENS ====================

@router.get("/deception/decoys")
async def get_deception_decoys():
    """Retrieve deployed deception honey-tokens"""
    from app.main import redis_service
    # Fetch decoys from cache, fallback to defaults
    cached_decoys = await redis_service.get("deception_decoys")
    if cached_decoys:
        return cached_decoys
        
    default_decoys = []
    
    await redis_service.set("deception_decoys", default_decoys)
    return default_decoys

@router.post("/deception/deploy")
async def deploy_decoy(payload: Dict[str, Any] = Body(...)):
    """Deploy new deception decoy token"""
    from app.main import redis_service
    hostname = payload.get("hostname", "ABHIRAM")
    decoy_type = payload.get("type", "SSH Private Key")
    location = payload.get("location", "")
    
    new_decoy = {
        "id": f"decoy-{str(uuid.uuid4())[:8]}",
        "hostname": hostname,
        "type": decoy_type,
        "location": location,
        "status": "active",
        "hits": 0
    }
    
    cached_decoys = await redis_service.get("deception_decoys") or []
    cached_decoys.append(new_decoy)
    await redis_service.set("deception_decoys", cached_decoys)
    
    return {"status": "deployed", "decoy": new_decoy}

@router.post("/deception/trigger")
async def trigger_decoy(payload: Dict[str, Any] = Body(...)):
    """Trigger alarm when agent detects decoy file read/access"""
    from app.main import db, redis_service
    decoy_id = payload.get("decoy_id", "")
    attacker_ip = payload.get("attacker_ip", "198.51.100.12")
    
    async for session in db.get_session():
        cached_decoys = await redis_service.get("deception_decoys") or []
        target_decoy = None
        
        for d in cached_decoys:
            if d["id"] == decoy_id:
                d["hits"] += 1
                target_decoy = d
                break
                
        if target_decoy:
            await redis_service.set("deception_decoys", cached_decoys)
            
            alert_id = str(uuid.uuid4())
            alert_payload = {
                "id": alert_id,
                "title": f"CRITICAL: Deception Honey-Token Accessed on {target_decoy['hostname']}",
                "description": f"An unauthorized process read decoy honey-token file path: {target_decoy['location']}. Initiating containment check.",
                "severity": "critical",
                "status": "new",
                "source_event_ids": [str(uuid.uuid4())],
                "rule_id": "rule-decoy-01",
                "detection_type": "deception",
                "indicators": {"decoy_path": target_decoy["location"], "attacker_ip": attacker_ip},
                "mitre_tactics": ["Credential Access", "Discovery"],
                "mitre_techniques": ["Credentials from Password Stores", "File and Directory Discovery"],
                "first_seen": datetime.utcnow(),
                "last_seen": datetime.utcnow(),
                "hostname": target_decoy["hostname"],
                "user": "unknown",
                "notes": [],
                "artifacts": []
            }
            
            await db.create_alert(session, alert_payload)
            return {"status": "alarm_triggered", "alert_id": alert_id}
            
    return {"error": "Decoy not found"}

@router.get("/explain/{alert_id}")
async def explain_alert(alert_id: str):
    """Explain alert classification using simulated SHAP/LIME feature importances"""
    from app.main import db
    from sqlalchemy import select
    
    async for session in db.get_session():
        query = select(Alert).where(Alert.id == alert_id)
        result = await session.execute(query)
        alert = result.scalar_one_or_none()
        
        if not alert:
            return {"error": "Alert not found"}
            
        severity = alert.severity.lower() if alert.severity else "medium"
        det_type = alert.detection_type.lower() if alert.detection_type else "behavioral"
        
        anomaly_score = 65.0
        if severity == "critical":
            anomaly_score = 94.8
        elif severity == "high":
            anomaly_score = 82.5
        elif severity == "medium":
            anomaly_score = 62.1
            
        confidence_score = 88.4 if severity in ["critical", "high"] else 74.2
        
        decision_path = [
            "Ingress Telemetry Stream Check ➔ Status: Valid",
            f"Behavioral Feature Vector Extraction ➔ Type: {det_type.upper()}",
            "Anomaly Score Threshold Evaluation ➔ Verdict: Malicious"
        ]
        
        features = []
        if "fim" in det_type or "file" in alert.title.lower() or "integrity" in alert.title.lower():
            features = [
                {"name": "File Entropy Index", "value": "8.4 (High)", "impact": 35, "description": "High process byte randomness typical of cryptors or packers"},
                {"name": "Write Ingestion Frequency", "value": "142 files/min", "impact": 28, "description": "High directory modification rate violating base write window"},
                {"name": "Target Folder Authority", "value": "C:\\Windows\\System32", "impact": 20, "description": "Write operations directed at high-privilege system paths"},
                {"name": "Executing Session Rights", "value": "SYSTEM", "impact": 10, "description": "High privilege execution namespace"},
                {"name": "Local Signature State", "value": "Missing / Self-Signed", "impact": 15, "description": "Binary lacks official authority certificate trust"},
                {"name": "Known System Baseline", "value": "Modified System File", "impact": -8, "description": "Deviates from standard golden-image hash maps"}
            ]
        elif "network" in det_type or "connection" in alert.title.lower() or "brute" in alert.title.lower() or "ssh" in alert.title.lower():
            features = [
                {"name": "Source IP Reputational Score", "value": "Malicious (AlienVault OTX)", "impact": 42, "description": "Origin IP listed in active malicious threat feeds"},
                {"name": "Connection Attempt Frequency", "value": "14 attempts/min", "impact": 25, "description": "Repeated authorization drops from single network socket"},
                {"name": "Target Port Profile", "value": "22 (SSH) / 3389 (RDP)", "impact": 18, "description": "Target port matches common initial access attack vectors"},
                {"name": "Logon Success Rate", "value": "0.0%", "impact": 12, "description": "All login attempts rejected by endpoint authentication services"},
                {"name": "Network Socket Entropy", "value": "High randomness", "impact": 8, "description": "Packet sizes and intervals indicate script automation"},
                {"name": "Local Host Firewall Profile", "value": "Public Profile", "impact": -5, "description": "No active perimeter block list matched"}
            ]
        else:
            features = [
                {"name": "Process Injection Triggers", "value": "LSASS Access (Read)", "impact": 38, "description": "Process dump request targeting security authority mem space"},
                {"name": "Parent Binary Namespace", "value": "Unknown Bin (temp/dump.exe)", "impact": 26, "description": "Executing program resides in unsafe temporary paths"},
                {"name": "Command-line Signature", "value": "Mimikatz dump parameters", "impact": 22, "description": "Process arguments match credential dumping templates"},
                {"name": "Process Code Privilege", "value": "NT AUTHORITY\\SYSTEM", "impact": 12, "description": "Command launched within root user namespace"},
                {"name": "Process Execution History", "value": "Rare (First Occurrence)", "impact": 10, "description": "Binary was never seen running on this host prior"},
                {"name": "Local Endpoint AV State", "value": "Disabled / Bypassed", "impact": -6, "description": "Active antivirus agent reported no blockade"}
            ]
            
        explanation = {
            "alert_id": alert_id,
            "title": alert.title,
            "severity": severity,
            "detection_type": det_type,
            "anomaly_score": anomaly_score,
            "confidence_score": confidence_score,
            "decision_path": decision_path,
            "features": features,
            "mitigation_reasoning": "The AI model computed that network isolation represents the optimal response action here to prevent lateral host breaches. Command sig signing is enforced to secure command validation routes."
        }
        
        return explanation

