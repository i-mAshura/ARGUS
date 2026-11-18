"""Compliance and Legacy Log Parser API endpoints"""
from fastapi import APIRouter, HTTPException
import re
import uuid
from datetime import datetime

router = APIRouter()

# Regular expressions for log parsing
SYSLOG_REGEX = re.compile(
    r'^([A-Za-z]{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+([\w\.\-]+)\s+([\w\.\-\[\]]+)(?:\[(\d+)\])?:\s+(.*)$'
)

WEB_ACCESS_REGEX = re.compile(
    r'^([\d\.]+|[\w\.\-]+)\s+([\w\-]+)\s+([\w\-]+)\s+\[([^\]]+)\]\s+"(\w+)\s+([^\s\?]+)[^\s]*\s+([^"]+)"\s+(\d+)\s+(\d+|\-)(?:\s+"([^"]*)"\s+"([^"]*)")?$'
)

def parse_syslog_line(line: str):
    """Parse standard RFC 3164 syslog lines"""
    match = SYSLOG_REGEX.match(line.strip())
    if not match:
        return None
    timestamp, hostname, service, pid, message = match.groups()
    
    # Simple year padding for timestamp (RFC 3164 lacks year)
    current_year = datetime.utcnow().year
    try:
        dt = datetime.strptime(f"{current_year} {timestamp}", "%Y %b %d %H:%M:%S")
    except:
        dt = datetime.utcnow()
        
    return {
        "timestamp": dt,
        "hostname": hostname,
        "service": service.split("[")[0],
        "pid": pid or "0",
        "message": message
    }

def parse_web_access_line(line: str):
    """Parse Apache/Nginx combined access log lines"""
    match = WEB_ACCESS_REGEX.match(line.strip())
    if not match:
        return None
    ip, _, _, timestamp, method, path, proto, status, bytes_sent, referer, user_agent = match.groups()
    
    # Parse web timestamp (e.g. 04/Jun/2026:10:22:15 +0000)
    try:
        ts_clean = timestamp.split(" ")[0]
        dt = datetime.strptime(ts_clean, "%d/%b/%Y:%H:%M:%S")
    except:
        dt = datetime.utcnow()
        
    return {
        "timestamp": dt,
        "hostname": "web-proxy",
        "source_ip": ip,
        "message": f"{method} {path} HTTP Status {status}",
        "web_details": {
            "method": method,
            "path": path,
            "status": int(status),
            "bytes": int(bytes_sent) if bytes_sent.isdigit() else 0,
            "user_agent": user_agent or ""
        }
    }

def evaluate_compliance_mapping(log_data: dict):
    """Evaluate logs and match against PCI-DSS, HIPAA, GDPR, CIS controls"""
    msg = log_data.get("message", "").lower()
    
    standards = []
    control_id = "0.0"
    control_name = "General Event Audit"
    status = "passed"
    details = "Log audited under default compliance baseline."
    
    # Rule 1: Authentication failure / Brute force
    if any(k in msg for k in ["failed password", "logon failure", "failed login", "auth failure", "invalid user"]):
        standards = ["PCI-DSS Req 8.2", "GDPR Art 32", "HIPAA §164.308", "CIS Control 4.1"]
        control_id = "8.2"
        control_name = "Identify and authenticate access"
        status = "failed"
        details = f"Authentication failure detected: {log_data.get('message')}"
        
    # Rule 2: Root Login
    elif "permitrootlogin" in msg or "root login via ssh" in msg or "session opened for user root" in msg:
        standards = ["CIS Control 5.2", "ISO 27001 A.9"]
        control_id = "5.2"
        control_name = "Disable root access via SSH"
        if "permitrootlogin no" in msg:
            status = "passed"
            details = "Root SSH login restriction verified in sshd_config."
        else:
            status = "failed"
            details = "Direct SSH root login enabled or session accessed."
            
    # Rule 3: Cardholder primary account numbers (PAN) exposure
    elif any(k in msg for k in ["pan", "credit card", "primary account number"]) or re.search(r'\b(?:\d[ -]*?){13,16}\b', msg):
        standards = ["PCI-DSS Req 3.4", "GDPR Art 32"]
        control_id = "3.4"
        control_name = "Protect stored cardholder data (PAN)"
        status = "failed"
        details = "Unmasked primary account number credit card signature detected in log."
        
    # Rule 4: Weak Cryptography / SSL / TLS
    elif any(k in msg for k in ["sslv3", "tlsv1", "tlsv1.1", "weak cipher", "rc4", "3des"]):
        standards = ["PCI-DSS Req 4.1", "HIPAA §164.312", "GDPR Art 32"]
        control_id = "4.1"
        control_name = "Encrypt cardholder data in transit"
        status = "failed"
        details = f"Insecure cryptography negotiation signature: {log_data.get('message')}"
        
    # Rule 5: Database writes or unencrypted databases
    elif "sqlite" in msg or "unencrypted sql" in msg:
        standards = ["GDPR Art 32", "ISO 27001 A.10"]
        control_id = "2.1"
        control_name = "Encrypt data-at-rest buffers"
        status = "warning"
        details = "Plaintext database accessed on local storage."
        
    # Rule 6: Successful root or sudo elevation
    elif "sudo" in msg and "command=" in msg:
        standards = ["PCI-DSS Req 10.2", "HIPAA §164.312(b)", "CIS Control 5.4"]
        control_id = "10.2"
        control_name = "Audit access to system components"
        status = "passed"
        details = f"Privileged command audit execution captured: {log_data.get('message')}"

    return {
        "standard": standards[0] if standards else "General Audit",
        "standards": standards,
        "control_id": control_id,
        "control_name": control_name,
        "status": status,
        "details": details
    }

@router.post("/parse-legacy")
async def parse_legacy_logs(payload: dict):
    """Parse raw multiline text logs and index them under compliance events"""
    from app.main import db
    from app.models.database import Event
    
    raw_logs = payload.get("logs", "")
    log_format = payload.get("format", "auto")
    hostname = payload.get("hostname", "legacy-ingest")
    
    if not raw_logs.strip():
        raise HTTPException(status_code=400, detail="No log content provided")
        
    lines = raw_logs.strip().split("\n")
    parsed_count = 0
    failures = 0
    compliance_matches = 0
    created_events = []
    
    async for session in db.get_session():
        for line in lines:
            if not line.strip():
                continue
                
            parsed = None
            # Formatting detection
            if log_format == "syslog" or (log_format == "auto" and SYSLOG_REGEX.match(line.strip())):
                parsed = parse_syslog_line(line)
            elif log_format == "web" or (log_format == "auto" and WEB_ACCESS_REGEX.match(line.strip())):
                parsed = parse_web_access_line(line)
                
            if not parsed:
                # Fallback to simple line parsing
                parsed = {
                    "timestamp": datetime.utcnow(),
                    "hostname": hostname,
                    "message": line.strip()
                }
                failures += 1
                
            parsed_count += 1
            
            # Map parsed data to compliance standards
            comp_mapping = evaluate_compliance_mapping(parsed)
            if comp_mapping["standards"]:
                compliance_matches += 1
                
            # Create compliance event in DB
            db_event = Event(
                id=str(uuid.uuid4()),
                timestamp=parsed.get("timestamp", datetime.utcnow()),
                source_ip=parsed.get("source_ip", "127.0.0.1"),
                destination_ip=None,
                hostname=parsed.get("hostname", hostname),
                agent_id="legacy-agent-uuid-001",
                event_type="compliance",
                event_data={
                    "standard": comp_mapping["standard"],
                    "standards": comp_mapping["standards"],
                    "control_id": comp_mapping["control_id"],
                    "control_name": comp_mapping["control_name"],
                    "status": comp_mapping["status"],
                    "details": comp_mapping["details"],
                    "raw_log": line.strip(),
                    "extracted_metadata": {
                        "service": parsed.get("service"),
                        "pid": parsed.get("pid"),
                        "web_details": parsed.get("web_details")
                    }
                },
                status="new"
            )
            session.add(db_event)
            created_events.append({
                "id": db_event.id,
                "standard": comp_mapping["standard"],
                "control_name": comp_mapping["control_name"],
                "status": comp_mapping["status"],
                "details": comp_mapping["details"]
            })
            
        await session.commit()
        
    return {
        "status": "success",
        "total_lines_submitted": len(lines),
        "successfully_parsed": parsed_count,
        "fallback_parses": failures,
        "compliance_matches": compliance_matches,
        "events": created_events
    }
