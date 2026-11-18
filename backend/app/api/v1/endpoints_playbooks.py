"""SOAR Playbook and Runbook API endpoints"""
from fastapi import APIRouter, HTTPException
import uuid
from datetime import datetime
from sqlalchemy import select

router = APIRouter()

DEFAULT_PLAYBOOKS = [
    {
        "name": "Ransomware Containment Workflow",
        "description": "Triggered when high-frequency file modifications (FIM) or known ransomware extensions are detected.",
        "trigger": "FIM File Modification Ingestion > 50 files/min OR Threat Intel detection",
        "active": True,
        "executions": 42,
        "success_rate": 98,
        "steps": [
            {"label": "Ingest & Verify Alert", "desc": "Confirm FIM signature and detect process entropy."},
            {"label": "Isolate Host", "desc": "Activate local host isolation firewall rules to prevent lateral movement."},
            {"label": "Terminate Malicious PID", "desc": "Identify and kill parent cryptor process via process tree lookup."},
            {"label": "Enrich & Notify", "desc": "Send alert to Slack channel (#soc-alerts) and open P1 incident ticket in Jira."}
        ]
    },
    {
        "name": "Brute Force IP Containment",
        "description": "Triggered on 5+ sequential authentication failures from external source IPs.",
        "trigger": "WinEventID 4625 (Logon Failure) OR SSH Auth Failure > 5 in 1 min",
        "active": True,
        "executions": 128,
        "success_rate": 100,
        "steps": [
            {"label": "Triage Source IP", "desc": "Lookup source IP against AlienVault OTX and VirusTotal DB."},
            {"label": "Block Source IP", "desc": "Add netsh/iptables drop rule on target endpoints and perimeter firewall."},
            {"label": "Notify Administrator", "desc": "Send summary email notification to Security Engineering team."}
        ]
    },
    {
        "name": "Credential Abuse Lockout",
        "description": "Triggers on suspicious LSASS memory access or credential dumping tools.",
        "trigger": "Rule ID 100085 (Mimikatz command-line patterns detected)",
        "active": False,
        "executions": 8,
        "success_rate": 87,
        "steps": [
            {"label": "Identify Rogue Session", "desc": "Determine PID and LogonID used to perform credential dump."},
            {"label": "Isolate Endpoint", "desc": "Disconnect endpoint from corporate domain routing."},
            {"label": "Revoke User Sessions", "desc": "Query Active Directory and terminate all active Kerberos ticket grants."},
            {"label": "Reset Credentials", "desc": "Force password expiration on target account and register MFA reset."}
        ]
    },
    {
        "name": "Phishing Email Attachment Quarantine",
        "description": "Triggered upon Gmail/Office365 malicious attachment hash detection.",
        "trigger": "SaaS Sandbox detection flag on attachment MD5/SHA256",
        "active": True,
        "executions": 19,
        "success_rate": 94,
        "steps": [
            {"label": "Extract Message Headers", "desc": "Collect DKIM/SPF headers and MD5 attachment hash from SaaS log."},
            {"label": "Search Workspace Mailboxes", "desc": "Query tenant email databases for all instances of identical attachment hash."},
            {"label": "Quarantine Messages", "desc": "Move suspicious messages to admin quarantine folder across all mailboxes."},
            {"label": "Block Sender Domain", "desc": "Add the sender address domain to incoming server-wide denylist rules."}
        ]
    },
    {
        "name": "C2 Beaconing Connection Block",
        "description": "Triggered on high-frequency outbound requests matching typical botnet command and control patterns.",
        "trigger": "Zeek IDS Anomaly: Beaconing Outbound Feed",
        "active": True,
        "executions": 34,
        "success_rate": 97,
        "steps": [
            {"label": "Verify C2 IP Reputation", "desc": "Lookup destination reputation score on Shodan and Cisco Talos."},
            {"label": "Deploy Edge Block", "desc": "Add firewall drop rules block outbound connections to destination C2 IP."},
            {"label": "Identify Client PID", "desc": "Audit endpoint socket connections to retrieve local process PID."},
            {"label": "Kill Local Rogue Process", "desc": "Terminate target process PID and delete associated executable binaries."}
        ]
    },
    {
        "name": "Cloud Privilege Escalation Remediation",
        "description": "Triggered when an IAM user updates policies to gain AdminAccess or creates high-privilege access keys.",
        "trigger": "CloudTrail EventName: PutUserPolicy OR CreateAccessKey with AdminAccess GUID",
        "active": True,
        "executions": 14,
        "success_rate": 100,
        "steps": [
            {"label": "Identify IAM Changes", "desc": "Identify rogue IAM policy modifications and access key creations."},
            {"label": "Detach Admin policy", "desc": "Detach high-privilege policies from user account dynamically."},
            {"label": "Deactivate Rogue Keys", "desc": "Revoke newly generated API access credentials."},
            {"label": "Console Session Revoke", "desc": "Inject logout command to abort active management console sessions."}
        ]
    },
    {
        "name": "SQL Injection Exploitation Defense",
        "description": "Triggered when multiple WAF logs flag SQL syntax patterns in HTTP request payloads.",
        "trigger": "WAF SQL Injection Rule Block OR ModSecurity log signature matching",
        "active": True,
        "executions": 87,
        "success_rate": 95,
        "steps": [
            {"label": "Extract Host IP", "desc": "Identify origin web node IP and remote hacker client IP from payload."},
            {"label": "Block Client at CDN", "desc": "Instruct Cloudflare/Fastly to block client IP at edge proxy layers."},
            {"label": "Dynamic Scan", "desc": "Deploy vulnerability scanner on target site to detect SQLi points."},
            {"label": "Alert Dev Team", "desc": "Create tickets for security engineers to fix query parameter binding."}
        ]
    },
    {
        "name": "USB Data Exfiltration Block",
        "description": "Triggered when massive file copying to an external USB mass storage device is detected on a workstation.",
        "trigger": "Sysmon Event ID 20 (PipeCreated) OR USB mount event copy rate > 100MB/s",
        "active": True,
        "executions": 6,
        "success_rate": 100,
        "steps": [
            {"label": "Disable USB Mounts", "desc": "Apply registry restrictions to mount external drives as read-only."},
            {"label": "Triage Event logs", "desc": "Query USN Journal logs to trace files copied to external storage."},
            {"label": "Lock Workspace Screen", "desc": "Lock user session shell and prompt for security authorization PIN."},
            {"label": "Open Incident ticket", "desc": "Escalate review logs to HR Compliance and Security manager."}
        ]
    },
    {
        "name": "Kubernetes Pod Compromise Quarantine",
        "description": "Triggered when web shell commands or reverse shells are launched inside a container pod.",
        "trigger": "Falco alert: Redirect stdout/stderr to network connection OR Shell spawned in container",
        "active": True,
        "executions": 29,
        "success_rate": 93,
        "steps": [
            {"label": "Namespace Isolation", "desc": "Apply NetworkPolicy to isolate pod egress/ingress traffic inside service mesh."},
            {"label": "Capture Container Memory", "desc": "Instruct sandbox runtime to capture core memory dumps of compromised container."},
            {"label": "Trigger Forensics", "desc": "Copy active container diff layer to quarantine storage block for analysis."},
            {"label": "Terminate Pod", "desc": "Instruct Kubernetes controller to delete pod and spawn replica on secure node."}
        ]
    },
    {
        "name": "Active Directory DCSync Attack Defense",
        "description": "Triggered when non-domain-controller accounts request replication of user hashes.",
        "trigger": "Windows Security Event ID 4662 with replica control GUIDs",
        "active": True,
        "executions": 3,
        "success_rate": 100,
        "steps": [
            {"label": "Query Request Source", "desc": "Identify machine account performing DCSync request and retrieve its MAC/IP address."},
            {"label": "Disable AD Account", "desc": "Instantly disable source active directory user/computer account object."},
            {"label": "Block DC Access", "desc": "Deploy network block list on Domain Controllers to drop packets from source IP."},
            {"label": "Emergency Key Rotation", "desc": "Initiate rolling password change for krbtgt account to revoke active tickets."}
        ]
    },
    {
        "name": "DNS Tunneling Detection & Remediation",
        "description": "Triggered when anomalous DNS query patterns (high entropy, subdomain counts) are detected on an endpoint.",
        "trigger": "Zeek DNS Entropy > 4.5 OR EDR DNS request threshold > 500 requests/min",
        "active": True,
        "executions": 12,
        "success_rate": 100,
        "steps": [
            {"label": "Analyze DNS Entropy", "desc": "Audit DNS query logs to isolate targeted tunnels and domains."},
            {"label": "Block Destination Domain", "desc": "Inject response policies to block target domains in DNS forwarders."},
            {"label": "Sinkhole IP", "desc": "Re-route requests to isolated sinkhole IP to trace callback beacons."},
            {"label": "Initiate Local Trace", "desc": "Trigger agent network capture dump and isolate malicious process parent."}
        ]
    },
    {
        "name": "AWS S3 Bucket Public Exposure Block",
        "description": "Triggered when AWS CloudTrail logs flag an S3 bucket access control list change to public access.",
        "trigger": "CloudTrail EventName: PutBucketAcl OR PutBucketPolicy allowing PublicAccess",
        "active": True,
        "executions": 5,
        "success_rate": 100,
        "steps": [
            {"label": "Scan Bucket ACL", "desc": "Inspect target bucket settings and retrieve active object exposure levels."},
            {"label": "Revert Policy", "desc": "Apply block public access settings to bucket and detach insecure policies."},
            {"label": "Flag IAM Account", "desc": "Flag originating IAM identity and suspend active keys temporarily."},
            {"label": "Notify Compliance Manager", "desc": "Send urgent notification to DevOps and Compliance managers via Slack."}
        ]
    },
    {
        "name": "Compromised Developer Endpoint Isolation",
        "description": "Triggered upon unauthorized tools execution (e.g. keyloggers, process hackers) on verified developer environments.",
        "trigger": "Sysmon Event ID 1 (Process Create) with dev-group blacklist signatures",
        "active": True,
        "executions": 8,
        "success_rate": 88,
        "steps": [
            {"label": "Enrich Process Info", "desc": "Triage parent process lineage, directory paths, and signature state."},
            {"label": "Isolate Workstation", "desc": "Activate host isolation to restrict routing to localhost and security manager endpoints."},
            {"label": "Revoke Dev Session Tokens", "desc": "Send webhook API calls to revoke developer GitHub, Okta, and Slack session tokens."},
            {"label": "Open Incident Ticket", "desc": "Register incident in Security Ops backlog and ping active on-call engineer."}
        ]
    },
    {
        "name": "Ransomware Lateral Movement Defense",
        "description": "Triggered on multiple RPC/SMB authentication attempts or PsExec execution sweeps between endpoints.",
        "trigger": "WinEvent ID 5140 (Write share) or PsExec Service spawn detected",
        "active": True,
        "executions": 17,
        "success_rate": 94,
        "steps": [
            {"label": "Map Movement Scope", "desc": "Identify source endpoint, target endpoints, and active process tokens."},
            {"label": "Terminate SMB Sessions", "desc": "Kill SMB network connections originating from rogue source host."},
            {"label": "Restrict Subnet routing", "desc": "Add temporary subnet blocking rules to isolate source host from adjacent endpoints."},
            {"label": "Deploy AV Sweep", "desc": "Force full active security scan on all target endpoints."}
        ]
    },
    {
        "name": "Data Exfiltration via DNS/ICMP Block",
        "description": "Triggered upon high frequency ping payloads containing structured hex strings.",
        "trigger": "Suricata Alert: ICMP Tunneling detected OR Outbound payload anomaly",
        "active": True,
        "executions": 4,
        "success_rate": 100,
        "steps": [
            {"label": "Triage Outbound Payloads", "desc": "Decode sample ICMP/DNS packets to extract exfiltrated headers."},
            {"label": "Kill Parent PID", "desc": "Locate and terminate local process generating anomalous payloads."},
            {"label": "Block Exfiltration Domain", "desc": "Add target exfiltration DNS/IP to global edge blocks."},
            {"label": "Add EDR File Hash Ban", "desc": "Extract process hash and register it to global SHA256 ban list."}
        ]
    },
    {
        "name": "Privileged User MFA Reset Remediation",
        "description": "Triggered on rapid, sequential MFA device registrations or multiple push denials from an admin account.",
        "trigger": "Okta SystemLog: user.mfa.device.reset_all OR user.authentication.auth_via_mfa denial > 3",
        "active": True,
        "executions": 9,
        "success_rate": 100,
        "steps": [
            {"label": "Audit Session History", "desc": "Retrieve location, IP, and browser user-agent of the requesting session."},
            {"label": "Suspend Entra/Okta User", "desc": "Disable admin user account in Identity Provider systems."},
            {"label": "Kill IdP Login Sessions", "desc": "Send API command to instantly revoke all active Web and OAuth tokens."},
            {"label": "Alert Identity Response Team", "desc": "Call escalation hotlines for Identity Response Team and email user supervisor."}
        ]
    },
    {
        "name": "Zero-Day Log4Shell Mitigation",
        "description": "Triggered when incoming HTTP payloads match JDNI lookup injection headers.",
        "trigger": "WAF alert: JNDI lookup payloads detected on /api/",
        "active": True,
        "executions": 12,
        "success_rate": 95,
        "steps": [
            {"label": "Locate Vulnerable Node", "desc": "Identify web server PID running java and hosting vulnerable log4j modules."},
            {"label": "Set SysProperty Flag", "desc": "Dynamically inject log4j2.formatMsgNoLookups=true system flag into runtime JVM."},
            {"label": "Restart Service", "desc": "Perform rolling restart of target web service process to load mitigations."},
            {"label": "Register Patch Task", "desc": "Create urgent Jira sprint task to upgrade log4j modules to version 2.17.1."}
        ]
    },
    {
        "name": "Kubernetes API Server Abuse Containment",
        "description": "Triggered upon anomalous service account token usage from external IPs.",
        "trigger": "KubeAudit: ClusterRoleBinding or RoleBinding modifications by external IP",
        "active": True,
        "executions": 18,
        "success_rate": 100,
        "steps": [
            {"label": "Triage Origin Identity", "desc": "Audit kube-apiserver logs to check calling IP and credential token attributes."},
            {"label": "Revoke Service Token", "desc": "Instantly delete active secrets associated with compromised service account."},
            {"label": "Block Ingress IP", "desc": "Deploy network security policy to drop traffic from origin IP at edge proxy loadbalancer."},
            {"label": "Notify Kube Admin", "desc": "Ping container security engineers on duty via Slack pager system."}
        ]
    },
    {
        "name": "Database Dump Exfiltration Prevention",
        "description": "Triggered when massive database query sweeps or dumps are detected via processes.",
        "trigger": "Rule ID 100099 (Process spawn: mysqldump or pg_dump execution)",
        "active": True,
        "executions": 7,
        "success_rate": 85,
        "steps": [
            {"label": "Validate Process Owner", "desc": "Check process owner UID. Flag if run by standard web service accounts instead of postgres admin."},
            {"label": "Terminate Dump Process", "desc": "Kill mysqldump/pg_dump PID dynamically to freeze exfiltration flow."},
            {"label": "Block Outbound FTP/SFTP", "desc": "Restrict network routing rules to block SSH/FTP outbound from target server."},
            {"label": "Audit DBA Access Logs", "desc": "Capture last 100 queries executed on target DB tables for forensics verification."}
        ]
    },
    {
        "name": "EDR Security Evasion Response",
        "description": "Triggered when defender or local security tools service status transitions to stopped.",
        "trigger": "WinEvent ID 7036 (Windows Defender Antivirus service stopped)",
        "active": True,
        "executions": 24,
        "success_rate": 100,
        "steps": [
            {"label": "Trace Service Parent", "desc": "Query process trees to find parent PID requesting service termination."},
            {"label": "Isolate Endpoint", "desc": "Instantly trigger host containment to quarantine machine from local network."},
            {"label": "Force Service Start", "desc": "Execute remote agent command to restart and lock defender services."},
            {"label": "Audit Event Logs", "desc": "Retrieve recent registry edits to verify if tamper protection was bypassed."}
        ]
    },
    {
        "name": "Compromised API Gateway Token Revocation",
        "description": "Triggered when access tokens are used in high-frequency patterns matching credential stuffing.",
        "trigger": "API Gateway: Token usage rate limit > 500 requests/sec",
        "active": True,
        "executions": 45,
        "success_rate": 98,
        "steps": [
            {"label": "Audit Token Metadata", "desc": "Extract API key hash, user UID, and location metrics from gatekeeper logs."},
            {"label": "Revoke Access Token", "desc": "Flag key hash as revoked inside Redis cache database immediately."},
            {"label": "Block Gateway Client IP", "desc": "Add origin IP address to WAF rate limit blocklist rules for 24 hours."},
            {"label": "Generate Password Reset", "desc": "Email user account owner prompting password/secret reset."}
        ]
    },
    {
        "name": "Kerberoasting Ticket Sweep Defense",
        "description": "Triggered when multiple Kerberos ticket requests (RC4 cipher) are generated by a single user account.",
        "trigger": "WinEvent ID 4769 (A Kerberos service ticket was requested) count > 50 in 1 min",
        "active": True,
        "executions": 14,
        "success_rate": 100,
        "steps": [
            {"label": "Audit User Account", "desc": "Identify requesting active directory account and check privilege attributes."},
            {"label": "Disable AD User Account", "desc": "Suspend user account in Active Directory to freeze ticket harvesting."},
            {"label": "Kill User Sessions", "desc": "Revoke active logon sessions on domain controllers and file servers."},
            {"label": "Enforce AES Encryption", "desc": "Log task to audit domain service principal names (SPN) for weak ciphers."}
        ]
    },
    {
        "name": "Malicious Browser Extension Removal",
        "description": "Triggered when malicious Chrome/Firefox extension directories are scanned on an endpoint.",
        "trigger": "FIM detection: New folder in Chrome Extension User Data matching malware signatures",
        "active": True,
        "executions": 5,
        "success_rate": 100,
        "steps": [
            {"label": "Terminate Browser Process", "desc": "Kill running Chrome/Firefox process instances on target endpoint."},
            {"label": "Delete Extension Folder", "desc": "Permanently delete malicious extension GUID folder from user directory."},
            {"label": "Reset Browser Settings", "desc": "Restore browser preferences to default state via registry policies."},
            {"label": "Trigger Agent Scan", "desc": "Initiate full local anti-malware sweep of endpoint startup locations."}
        ]
    },
    {
        "name": "Insider Threat File Sweep Protection",
        "description": "Triggered when rapid copy or read of sensitive source codes or corporate files is logged.",
        "trigger": "File Access Rate: read events > 200 files in 1 min",
        "active": True,
        "executions": 11,
        "success_rate": 90,
        "steps": [
            {"label": "Identify Process Owner", "desc": "Determine local PID and user account executing file sweeps."},
            {"label": "Lock Active Shell", "desc": "Kill active process PID and lock user terminal workspace instantly."},
            {"label": "Archive Temp Copies", "desc": "Verify if files were zipped or moved to temp staging directories."},
            {"label": "Log HR Incident", "desc": "Generate summary report of accessed file paths and escalate to compliance team."}
        ]
    },
    {
        "name": "GitHub Token Leak Key Revocation",
        "description": "Triggered when active AWS or API keys are detected in public GitHub commits.",
        "trigger": "GitGuardian: Exposed API credentials leaked in public repository branch",
        "active": True,
        "executions": 29,
        "success_rate": 100,
        "steps": [
            {"label": "Verify Token Active Status", "desc": "Query service provider API to confirm status of leaked key."},
            {"label": "Revoke Leaked Key", "desc": "Instantly disable and delete credentials in provider portal (AWS/Okta/Stripe)."},
            {"label": "Scan GitHub Repository", "desc": "Verify commit hashes to locate when exposure happened."},
            {"label": "Generate Replacement Key", "desc": "Securely generate new API key, alert developer team, and request audit."}
        ]
    },
    {
        "name": "Ransomware Registry Tampering Block",
        "description": "Triggered when registry keys disabling system recovery or automatic updates are modified.",
        "trigger": "Registry Event: Write to key SystemRestore\\DisableSR or WindowsUpdate\\AUOptions",
        "active": True,
        "executions": 8,
        "success_rate": 100,
        "steps": [
            {"label": "Lock Registry Hive", "desc": "Apply registry write restrictions to block further tampering by user processes."},
            {"label": "Restore Default Keys", "desc": "Overwrite keys with default secure configuration parameters."},
            {"label": "Isolate Endpoint", "desc": "Activate network isolation rules on target machine."},
            {"label": "Kill Originating Process", "desc": "Kill process PID executing registry modifications."}
        ]
    },
    {
        "name": "SSH Brute-Force IP Drop",
        "description": "Triggered when SSH daemon logs multiple authentication failures from a single external IP.",
        "trigger": "Syslog: sshd Failed password count > 10 from IP",
        "active": True,
        "executions": 182,
        "success_rate": 100,
        "steps": [
            {"label": "Deploy IpTables Drop", "desc": "Execute local shell command to append DROP rule for source IP in iptables config."},
            {"label": "Update Global Denylist", "desc": "Publish banned IP to central threat intelligence database feed."},
            {"label": "Verify Port Knocking", "desc": "Audit system configuration to verify port-knocking rules are active."}
        ]
    },
    {
        "name": "Cryptomining Container Pod Kill",
        "description": "Triggered when CPU or GPU utilization rates spike inside container runtimes matching miner patterns.",
        "trigger": "Kubernetes: Container CPU utilization > 95% AND pool.hashrate regex match",
        "active": True,
        "executions": 36,
        "success_rate": 97,
        "steps": [
            {"label": "Locate compromised pod", "desc": "Identify namespace, deployment name, and container ID from metrics."},
            {"label": "Kill mining process", "desc": "Instruct sandbox container engine to kill miner daemon PID."},
            {"label": "Triage Image Digest", "desc": "Scan docker image registry tag to check if secure registry was bypassed."},
            {"label": "Restart Pod", "desc": "Re-spawn clean replica container pod with resource quota limits enabled."}
        ]
    },
    {
        "name": "Process Hollowing Malware Neutralization",
        "description": "Triggered when processes spawn in suspended state and request writable virtual memory allocations.",
        "trigger": "Sysmon Event ID 10 (ProcessAccess) with susp-memory allocation profiles",
        "active": True,
        "executions": 6,
        "success_rate": 100,
        "steps": [
            {"label": "Suspend Target Process", "desc": "Send pause signal to hollowed child process to freeze code execution."},
            {"label": "Dump Virtual Memory", "desc": "Extract core virtual memory pages of hollowed process for malware triage."},
            {"label": "Kill Hollowed PID", "desc": "Kill suspended hollowed process tree and its parent launcher process."},
            {"label": "File Hash Ban", "desc": "Calculate MD5 of parent launcher and register to global banned hash lists."}
        ]
    },
    {
        "name": "Systemd Persistent Daemon Audit",
        "description": "Triggered when new systemd services or persistent cron jobs are configured on endpoints.",
        "trigger": "FIM Event: File write to /etc/systemd/system/ or /etc/cron.d/",
        "active": True,
        "executions": 19,
        "success_rate": 94,
        "steps": [
            {"label": "Audit Service Contents", "desc": "Examine service unit file executing script arguments and parameters."},
            {"label": "Disable Persistent Service", "desc": "Stop service daemon and execute disable command to prevent restart."},
            {"label": "Delete Service Files", "desc": "Remove configuration unit files from target system folders."},
            {"label": "Audit Cron logs", "desc": "Trace auditd logs to locate user session spawning the service setup."}
        ]
    }
]

from datetime import timedelta
DEFAULT_LOGS = [
    {
        "playbook_name": "Ransomware Containment Workflow",
        "target": "ABHIRAM",
        "status": "completed",
        "timestamp": datetime.utcnow() - timedelta(hours=2),
        "logs": ["Step 1: Ingest & Verify Alert [Success]", "Step 2: Isolate Host [Success]", "Step 3: Terminate Malicious PID [Success]"]
    },
    {
        "playbook_name": "AWS S3 Bucket Public Exposure Block",
        "target": "prod-customer-data",
        "status": "completed",
        "timestamp": datetime.utcnow() - timedelta(hours=6),
        "logs": ["Step 1: Check Bucket Exposure [Success]", "Step 2: Apply Restricted Bucket Policy [Success]"]
    },
    {
        "playbook_name": "Compromised Developer Endpoint Isolation",
        "target": "DEV-WORKSTATION",
        "status": "completed",
        "timestamp": datetime.utcnow() - timedelta(days=1),
        "logs": ["Step 1: Analyze Process Lineage [Success]", "Step 2: Trigger Endpoint Network Containment [Success]"]
    }
]

async def seed_playbooks_if_empty(session):
    """Seed playbooks and execution logs if table is empty or missing defaults"""
    from app.models.database import Playbook, PlaybookLog
    
    # Seed Playbooks
    q_pb = select(Playbook)
    res_pb = await session.execute(q_pb)
    existing_pbs = res_pb.scalars().all()
    existing_names = {pb.name for pb in existing_pbs}
    
    added_any = False
    for pb_def in DEFAULT_PLAYBOOKS:
        if pb_def["name"] not in existing_names:
            pb = Playbook(
                id=f"pb-{str(uuid.uuid4())[:8]}",
                name=pb_def["name"],
                description=pb_def["description"],
                trigger=pb_def["trigger"],
                active=pb_def["active"],
                executions=pb_def["executions"],
                success_rate=pb_def["success_rate"],
                steps=pb_def["steps"],
                created_at=datetime.utcnow()
            )
            session.add(pb)
            added_any = True
            
    if added_any:
        await session.commit()
        
    # Seed Logs
    q_log = select(PlaybookLog)
    res_log = await session.execute(q_log)
    if not res_log.scalars().first():
        for log_def in DEFAULT_LOGS:
            pl_log = PlaybookLog(
                id=f"run-{str(uuid.uuid4())[:8]}",
                playbook_name=log_def["playbook_name"],
                target=log_def["target"],
                status=log_def["status"],
                timestamp=log_def["timestamp"],
                logs=log_def["logs"]
            )
            session.add(pl_log)
        await session.commit()

@router.get("/")
async def list_playbooks():
    """List all SOAR Playbooks from database"""
    from app.main import db
    from app.models.database import Playbook
    async for session in db.get_session():
        await seed_playbooks_if_empty(session)
        q = select(Playbook).order_by(Playbook.created_at.desc())
        res = await session.execute(q)
        playbooks = res.scalars().all()
        return {
            "playbooks": [
                {
                    "id": pb.id,
                    "name": pb.name,
                    "description": pb.description,
                    "trigger": pb.trigger,
                    "active": pb.active,
                    "executions": pb.executions,
                    "successRate": pb.success_rate,
                    "steps": pb.steps,
                    "created_at": pb.created_at
                }
                for pb in playbooks
            ]
        }

@router.get("/logs")
async def list_playbook_logs():
    """List historical playbook execution logs"""
    from app.main import db
    from app.models.database import PlaybookLog
    async for session in db.get_session():
        await seed_playbooks_if_empty(session)
        q = select(PlaybookLog).order_by(PlaybookLog.timestamp.desc())
        res = await session.execute(q)
        logs = res.scalars().all()
        return {
            "logs": [
                {
                    "id": log.id,
                    "playbookName": log.playbook_name,
                    "target": log.target,
                    "status": log.status,
                    "timestamp": log.timestamp.isoformat() + "Z",
                    "logs": log.logs
                }
                for log in logs
            ]
        }

@router.post("/create")
async def create_custom_playbook(payload: dict):
    """Create a new custom SOAR playbook"""
    from app.main import db
    from app.models.database import Playbook
    
    if not payload.get("name") or not payload.get("trigger"):
        raise HTTPException(status_code=400, detail="Name and Trigger fields are required")
        
    async for session in db.get_session():
        # Check uniqueness
        q = select(Playbook).where(Playbook.name == payload["name"])
        res = await session.execute(q)
        if res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Playbook with this name already exists")
            
        pb = Playbook(
            id=f"pb-{str(uuid.uuid4())[:8]}",
            name=payload["name"],
            description=payload.get("description", ""),
            trigger=payload["trigger"],
            active=payload.get("active", True),
            executions=0,
            success_rate=100,
            steps=payload.get("steps", []),
            created_at=datetime.utcnow()
        )
        session.add(pb)
        await session.commit()
        return {
            "status": "created",
            "playbook_id": pb.id,
            "name": pb.name
        }

@router.post("/{pb_id}/toggle")
async def toggle_playbook_active_status(pb_id: str):
    """Toggle playbook enabled/disabled active flag"""
    from app.main import db
    from app.models.database import Playbook
    async for session in db.get_session():
        q = select(Playbook).where(Playbook.id == pb_id)
        res = await session.execute(q)
        pb = res.scalar_one_or_none()
        if not pb:
            raise HTTPException(status_code=404, detail="Playbook not found")
            
        pb.active = not pb.active
        await session.commit()
        return {
            "status": "updated",
            "playbook_id": pb_id,
            "active": pb.active
        }

@router.post("/{pb_id}/execute")
async def execute_playbook_run(pb_id: str, run_payload: dict):
    """Execute a real or simulated run and record logs"""
    from app.main import db
    from app.models.database import Playbook, PlaybookLog, Agent
    from app.api.v1.endpoints_hunting import _run_vql_query, _load_api_config
    from sqlalchemy import select, func

    async for session in db.get_session():
        q = select(Playbook).where(Playbook.id == pb_id)
        res = await session.execute(q)
        pb = res.scalar_one_or_none()
        if not pb:
            raise HTTPException(status_code=404, detail="Playbook not found")
            
        if not pb.active:
            raise HTTPException(status_code=400, detail="Cannot execute disabled playbook")
            
        target_host = run_payload.get("target", "VishaalsEnvy")
        execution_logs = []

        # 1. Look up target agent's OS type (windows or linux)
        agent_q = select(Agent).where(func.lower(Agent.hostname) == target_host.lower())
        agent_res = await session.execute(agent_q)
        agent = agent_res.scalar_one_or_none()
        
        os_type = agent.os_type.lower() if agent else "windows"  # Fallback to Windows if unknown

        if pb.name == "Systemd Persistent Daemon Audit":
            try:
                config = _load_api_config()
                service_name = run_payload.get("service_name", "spyderxdr-test-service")
                execution_logs.append(f"[START] Mitigating host: {target_host} ({os_type.upper()}) | Target Service: {service_name}")

                if os_type == "windows":
                    # --- WINDOWS SERVICE REMEDIATION ---
                    vql_audit = f"SELECT Name, DisplayName, PathName, StartMode FROM wmi(query='SELECT Name, DisplayName, PathName, StartMode FROM Win32_Service WHERE Name=\"{service_name}\"')"
                    audit_res = _run_vql_query(config, vql_audit, "all")
                    execution_logs.append(f"[ACTION] Audit Service (Windows): {str(audit_res)}")

                    vql_disable = f"SELECT * FROM execve(argv=['powershell.exe', '-Command', 'Stop-Service -Name {service_name} -Force; Set-Service -Name {service_name} -StartupType Disabled'])"
                    _run_vql_query(config, vql_disable, "all")
                    execution_logs.append(f"[ACTION] Stopped & Disabled Service (Windows): {service_name}")

                    vql_delete = f"SELECT * FROM execve(argv=['sc.exe', 'delete', '{service_name}'])"
                    _run_vql_query(config, vql_delete, "all")
                    execution_logs.append(f"[ACTION] Deleted service registry files (Windows): {service_name}")

                    vql_logs = "SELECT Message FROM wmi(query='SELECT Message FROM Win32_NTLogEvent WHERE Logfile=\"System\" AND EventCode=7040 LIMIT 1')"
                    log_res = _run_vql_query(config, vql_logs, "all")
                    execution_logs.append(f"[ACTION] Verified Security Log Event: {str(log_res)}")

                else:
                    # --- LINUX SERVICE REMEDIATION ---
                    vql_audit = f"SELECT * FROM execve(argv=['cat', '/etc/systemd/system/{service_name}.service'])"
                    audit_res = _run_vql_query(config, vql_audit, "all")
                    execution_logs.append(f"[ACTION] Audit Service (Linux): {str(audit_res)}")

                    vql_disable = f"SELECT * FROM execve(argv=['systemctl', 'disable', '--now', '{service_name}.service'])"
                    _run_vql_query(config, vql_disable, "all")
                    execution_logs.append(f"[ACTION] Stopped & Disabled Service (Linux): {service_name}")

                    vql_delete = f"SELECT * FROM execve(argv=['rm', '/etc/systemd/system/{service_name}.service'])"
                    _run_vql_query(config, vql_delete, "all")
                    execution_logs.append(f"[ACTION] Deleted service unit files (Linux): {service_name}")

                    vql_logs = "SELECT Message FROM parse_syslog(filename='/var/log/syslog') LIMIT 3"
                    log_res = _run_vql_query(config, vql_logs, "all")
                    execution_logs.append(f"[ACTION] Verified Auditd Cron Logs: {str(log_res)}")

                status = "completed"
                execution_logs.append(f"[SUCCESS] Playbook workflow successfully executed on {target_host}.")

            except Exception as e:
                status = "failed"
                execution_logs.append(f"[ERROR] Playbook execution failed: {str(e)}")
        else:
            status = "completed"
            execution_logs = run_payload.get("logs", [])

        # Log the run
        pb_log = PlaybookLog(
            id=f"run-{str(uuid.uuid4())[:8]}",
            playbook_name=pb.name,
            target=target_host,
            status=status,
            timestamp=datetime.utcnow(),
            logs=execution_logs
        )
        session.add(pb_log)
        pb.executions += 1
        await session.commit()
        
        return {
            "status": status,
            "log_id": pb_log.id,
            "playbook_name": pb.name,
            "executions": pb.executions
        }
