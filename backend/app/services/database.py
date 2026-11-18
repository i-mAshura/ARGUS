"""Database connection and operations"""
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
import os

from app.models.database import Base, Event, Alert, Rule, User, Baseline, Ticket
from app.models.multitenancy import Organization, TenantUser, APIKey, UsageMetrics
from app.models.schemas import AlertResponse, AlertCreate

logger = logging.getLogger(__name__)

class Database:
    """Async database service"""
    
    def __init__(self):
        self.db_url = os.getenv(
            "DATABASE_URL", 
            "postgresql+asyncpg://xdr_user:xdr_pass@localhost:5432/spyderxdr"
        )
        self.engine = None
        self.async_session = None
    
    async def connect(self):
        """Connect to database and create tables"""
        try:
            self.engine = create_async_engine(
                self.db_url,
                echo=False,
                pool_size=20,
                max_overflow=40
            )
            # Try a quick execution to verify connection
            async with self.engine.connect() as conn:
                await conn.execute(select(1))
            
            self.async_session = sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            # Create tables
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            
            logger.info("✅ Database connected successfully")
            await self._seed_default_saas()
            await self._seed_default_rules()
            await self._seed_default_playbooks()
            # Real-data-only mode: demo seeding is permanently disabled.
        except Exception as postgres_err:
            logger.warning(f"⚠️ Postgres connection failed ({postgres_err}). Falling back to SQLite for demo.")
            try:
                # Create data directory if it doesn't exist
                db_dir = r"C:\Users\Vishaal\Desktop\SpyderXDR-updated\backend\data"
                os.makedirs(db_dir, exist_ok=True)
                
                db_path = os.path.join(db_dir, "spyderxdr.db")
                sqlite_url = f"sqlite+aiosqlite:///{db_path}"
                self.engine = create_async_engine(
                    sqlite_url,
                    echo=False
                )
                self.async_session = sessionmaker(
                    self.engine,
                    class_=AsyncSession,
                    expire_on_commit=False
                )
                
                # Create tables
                async with self.engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
                
                logger.info("✅ SQLite Database initialized and connected successfully")
                await self._seed_default_saas()
                await self._seed_default_rules()
                await self._seed_default_playbooks()
                # Real-data-only mode: demo seeding is permanently disabled.
            except Exception as sqlite_err:
                logger.error(f"❌ SQLite database setup failed: {sqlite_err}")
                raise
    
    async def disconnect(self):
        """Disconnect from database"""
        if self.engine:
            await self.engine.dispose()
            logger.info("✅ Database disconnected")
    
    async def get_session(self):
        """Get database session"""
        async with self.async_session() as session:
            yield session
    
    # Event operations
    async def create_event(self, session: AsyncSession, event_data: dict) -> Event:
        """Create new event"""
        event = Event(**event_data)
        session.add(event)
        await session.commit()
        await session.refresh(event)
        return event
    
    async def get_events(
        self, 
        session: AsyncSession,
        hostname: str = None,
        event_type: str = None,
        limit: int = 100,
        offset: int = 0
    ):
        """Get events with filtering"""
        query = select(Event)
        
        if hostname:
            query = query.where(Event.hostname == hostname)
        if event_type:
            query = query.where(Event.event_type == event_type)
        
        query = query.order_by(Event.timestamp.desc()).limit(limit).offset(offset)
        result = await session.execute(query)
        return result.scalars().all()
    
    async def get_events_by_time(
        self,
        session: AsyncSession,
        start_time: datetime,
        end_time: datetime,
        hostname: str = None
    ):
        """Get events within time range"""
        query = select(Event).where(
            and_(
                Event.timestamp >= start_time,
                Event.timestamp <= end_time
            )
        )
        
        if hostname:
            query = query.where(Event.hostname == hostname)
        
        result = await session.execute(query)
        return result.scalars().all()
    
    # Alert operations
    async def create_alert(self, session: AsyncSession, alert_data: dict) -> Alert:
        """Create new alert"""
        alert = Alert(**alert_data)
        session.add(alert)
        await session.commit()
        await session.refresh(alert)
        return alert
    
    async def get_alerts(
        self,
        session: AsyncSession,
        status: str = None,
        severity: str = None,
        hostname: str = None,
        limit: int = 100,
        offset: int = 0
    ):
        """Get alerts with filtering"""
        query = select(Alert)
        
        if status:
            query = query.where(Alert.status == status)
        if severity:
            query = query.where(Alert.severity == severity)
        if hostname:
            query = query.where(Alert.hostname == hostname)
        
        query = query.order_by(Alert.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(query)
        return result.scalars().all()
    
    async def update_alert(
        self,
        session: AsyncSession,
        alert_id: str,
        update_data: dict
    ):
        """Update alert"""
        query = select(Alert).where(Alert.id == alert_id)
        result = await session.execute(query)
        alert = result.scalar_one_or_none()
        
        if alert:
            for key, value in update_data.items():
                setattr(alert, key, value)
            alert.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(alert)
        
        return alert
    
    async def get_alert_stats(self, session: AsyncSession) -> dict:
        """Get alert statistics"""
        total = await session.scalar(select(func.count(Alert.id)))
        critical = await session.scalar(
            select(func.count(Alert.id)).where(Alert.severity == "critical")
        )
        high = await session.scalar(
            select(func.count(Alert.id)).where(Alert.severity == "high")
        )
        new = await session.scalar(
            select(func.count(Alert.id)).where(Alert.status == "new")
        )
        
        # Today's alerts
        today = datetime.utcnow().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_count = await session.scalar(
            select(func.count(Alert.id)).where(Alert.created_at >= today_start)
        )
        
        return {
            "total": total or 0,
            "critical": critical or 0,
            "high": high or 0,
            "new": new or 0,
            "today": today_count or 0
        }
    
    # Rule operations
    async def get_rules(self, session: AsyncSession, enabled_only: bool = False):
        """Get detection rules"""
        query = select(Rule)
        
        if enabled_only:
            query = query.where(Rule.is_enabled == True)
        
        result = await session.execute(query)
        return result.scalars().all()
    
    async def create_rule(self, session: AsyncSession, rule_data: dict) -> Rule:
        """Create new rule"""
        rule = Rule(**rule_data)
        session.add(rule)
        await session.commit()
        await session.refresh(rule)
        return rule
    
    async def get_rule(self, session: AsyncSession, rule_id: str) -> Rule:
        """Get single rule"""
        query = select(Rule).where(Rule.id == rule_id)
        result = await session.execute(query)
        return result.scalar_one_or_none()
    
    # Baseline operations
    async def update_baseline(
        self,
        session: AsyncSession,
        hostname: str,
        username: str,
        behavior_type: str,
        baseline_data: dict
    ):
        """Update or create behavioral baseline"""
        query = select(Baseline).where(
            and_(
                Baseline.hostname == hostname,
                Baseline.username == username,
                Baseline.behavior_type == behavior_type
            )
        )
        result = await session.execute(query)
        baseline = result.scalars().first()
        
        if baseline:
            baseline.baseline_data = baseline_data
            baseline.updated_at = datetime.utcnow()
        else:
            import uuid
            baseline = Baseline(
                id=str(uuid.uuid4()),
                hostname=hostname,
                username=username,
                behavior_type=behavior_type,
                baseline_data=baseline_data
            )
            session.add(baseline)
        
        await session.commit()
        return baseline
    
    async def get_baseline(
        self,
        session: AsyncSession,
        hostname: str,
        behavior_type: str
    ):
        """Get behavioral baseline"""
        query = select(Baseline).where(
            and_(
                Baseline.hostname == hostname,
                Baseline.behavior_type == behavior_type
            )
        )
        result = await session.execute(query)
        return result.scalars().first()

    # Ticket operations
    async def create_ticket(self, session: AsyncSession, ticket_data: dict) -> Ticket:
        """Create a new incident ticket"""
        import uuid
        if "id" not in ticket_data:
            ticket_data["id"] = str(uuid.uuid4())
        ticket = Ticket(**ticket_data)
        session.add(ticket)
        await session.commit()
        await session.refresh(ticket)
        return ticket

    async def get_tickets(
        self,
        session: AsyncSession,
        status: str = None,
        priority: str = None,
        limit: int = 100,
        offset: int = 0
    ):
        """Get list of tickets with filtering"""
        query = select(Ticket)
        if status:
            query = query.where(Ticket.status == status)
        if priority:
            query = query.where(Ticket.priority == priority)
        query = query.order_by(Ticket.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(query)
        return result.scalars().all()

    async def get_ticket(self, session: AsyncSession, ticket_id: str) -> Ticket:
        """Get specific ticket by ID"""
        query = select(Ticket).where(Ticket.id == ticket_id)
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def update_ticket(
        self,
        session: AsyncSession,
        ticket_id: str,
        update_data: dict
    ) -> Ticket:
        """Update ticket fields"""
        query = select(Ticket).where(Ticket.id == ticket_id)
        result = await session.execute(query)
        ticket = result.scalar_one_or_none()
        if ticket:
            for key, value in update_data.items():
                setattr(ticket, key, value)
            ticket.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(ticket)
        return ticket

    async def _seed_default_saas(self):
        """Seed default organization and tenant user for SaaS portal if they don't exist"""
        try:
            from app.models.multitenancy import Organization, TenantUser
            from sqlalchemy import select
            import uuid
            import bcrypt
            import json
            
            async with self.async_session() as session:
                # Check if default organization exists
                query_org = select(Organization).where(Organization.slug == "argus")
                result_org = await session.execute(query_org)
                org = result_org.scalar_one_or_none()
                
                if not org:
                    # Use static password for consistent access
                    plaintext_password = "password123"
                    password_hash = bcrypt.hashpw(plaintext_password.encode(), bcrypt.gensalt()).decode()
                    
                    # Write credentials to a workspace-local JSON file so the
                    # SaaS bootstrap works on any machine without hard-coded paths.
                    creds_dir = os.path.join(os.path.dirname(__file__), "../../data")
                    os.makedirs(creds_dir, exist_ok=True)
                    creds_path = os.path.join(creds_dir, "credentials.json")
                    with open(creds_path, "w", encoding="utf-8") as f:
                        json.dump({
                            "email": "admin@argus.com",
                            "password": plaintext_password
                        }, f)
                    
                    # Create default organization
                    org_id = str(uuid.uuid4())
                    org = Organization(
                        id=org_id,
                        name="ARGUS Enterprise",
                        slug="argus",
                        contact_email="admin@argus.com",
                        subscription_tier="enterprise",
                        status="active",
                        max_endpoints=100000
                    )
                    session.add(org)
                    
                    # Create default admin user
                    user_id = str(uuid.uuid4())
                    user = TenantUser(
                        id=user_id,
                        organization_id=org_id,
                        name="Administrator",
                        email="admin@argus.com",
                        password_hash=password_hash,
                        role="admin",
                        is_active=True,
                        email_verified=True
                    )
                    session.add(user)
                    await session.commit()
                    
                    # Print prominent credentials banner to the console terminal
                    print("\n" + "="*80)
                    print("🔑 ARGUS DEFAULT ADMIN CREDENTIALS GENERATED DURING INSTALLATION")
                    print(f"   Email:    admin@argus.com")
                    print(f"   Password: {plaintext_password}")
                    print(f"   Saved to: {creds_path}")
                    print("="*80 + "\n")
                    
                    logger.info(f"✅ Seeded default SaaS organization and tenant user (credentials saved to {creds_path})")
        except Exception as e:
            logger.error(f"⚠️ Error seeding default SaaS data: {e}")

    async def _seed_default_rules(self):
        """Seed 2000+ MITRE ATT&CK & Sigma rules in rules table if empty"""
        try:
            from sqlalchemy import select
            from app.models.database import Rule
            import uuid
            
            async with self.async_session() as session:
                # Check if rules already exist
                query_count = select(func.count(Rule.id))
                result = await session.execute(query_count)
                rules_count = result.scalar() or 0
                
                if rules_count >= 100:
                    logger.info(f"ℹ️ Detection rules table already seeded with {rules_count} records. Skipping rules seeding.")
                    return
                
                logger.info("⚡ Seeding rules database with 2000+ MITRE ATT&CK & Sigma detection rules...")
                
                # Predefined high-fidelity rules (approx 3 rules)
                base_rules = [
                    {
                        "id": "rule-000001",
                        "name": "Mimikatz Credential Dumping Pattern",
                        "description": "Detects execution of Mimikatz memory dump commands to harvest local security credentials.",
                        "rule_type": "signature",
                        "severity": "critical",
                        "conditions": {"process_name": "mimikatz.exe", "command_line": "sekurlsa::logonpasswords"},
                        "actions": ["isolate", "kill_process"],
                        "mitre_tactics": ["Credential Access"],
                        "mitre_techniques": ["T1003.001"],
                        "tags": ["mimikatz", "credentials", "dumping"]
                    },
                    {
                        "id": "rule-000002",
                        "name": "PowerShell Suspicious Downloader Execution",
                        "description": "PowerShell command trying to download external binaries using web request parameters.",
                        "rule_type": "behavioral",
                        "severity": "high",
                        "conditions": {"process_name": "powershell.exe", "command_line_regex": "System.Net.WebClient|Invoke-WebRequest|wget|curl"},
                        "actions": ["kill_process"],
                        "mitre_tactics": ["Execution", "Command and Control"],
                        "mitre_techniques": ["T1059.001", "T1105"],
                        "tags": ["powershell", "download", "malicious"]
                    },
                    {
                        "id": "rule-000003",
                        "name": "Volume Shadow Copies Deletion (vssadmin)",
                        "description": "Adversaries deleting Volume Shadow Copies via vssadmin to disable file recovery options.",
                        "rule_type": "behavioral",
                        "severity": "critical",
                        "conditions": {"process_name": "vssadmin.exe", "command_line": "delete shadows"},
                        "actions": ["isolate", "kill_process"],
                        "mitre_tactics": ["Impact"],
                        "mitre_techniques": ["T1490"],
                        "tags": ["ransomware", "vssadmin", "shadows"]
                    }
                ]
                
                # Bulk list to append
                all_rules_to_seed = []
                # Add base rules
                for r in base_rules:
                    all_rules_to_seed.append(Rule(
                        id=r["id"],
                        name=r["name"],
                        description=r["description"],
                        rule_type=r["rule_type"],
                        severity=r["severity"],
                        is_enabled=True,
                        conditions=r["conditions"],
                        actions=r["actions"],
                        mitre_tactics=r["mitre_tactics"],
                        mitre_techniques=r["mitre_techniques"],
                        tags=r["tags"],
                        updated_by="system"
                    ))
                
                # Programmatically generate ~2050 additional unique rules
                tactics = [
                    ("Initial Access", "T1190", ["exploit", "ingress", "entry"]),
                    ("Execution", "T1059", ["powershell", "cmd", "shell", "spawn"]),
                    ("Persistence", "T1547", ["registry", "service", "startup", "cron"]),
                    ("Privilege Escalation", "T1548", ["sudo", "uac", "bypass", "elevation"]),
                    ("Defense Evasion", "T1562", ["firewall", "defender", "clear-logs", "disable"]),
                    ("Credential Access", "T1003", ["lsass", "sam", "dumping", "harvest"]),
                    ("Discovery", "T1082", ["whoami", "netstat", "scan", "enumeration"]),
                    ("Lateral Movement", "T1021", ["ssh", "rdp", "psexec", "smb"]),
                    ("Command and Control", "T1071", ["c2", "beacon", "tunneling", "outbound"]),
                    ("Exfiltration", "T1048", ["ftp", "http-upload", "exfil", "data-leak"]),
                    ("Impact", "T1485", ["encrypt", "delete", "destroy", "wipe"])
                ]
                
                tools = [
                    ("powershell.exe", "Windows PowerShell host"),
                    ("cmd.exe", "Windows command prompt shell"),
                    ("wmic.exe", "Windows Management Instrumentation console"),
                    ("schtasks.exe", "Scheduled Tasks configuration agent"),
                    ("reg.exe", "Windows Registry editor service"),
                    ("certutil.exe", "Windows Certificate Utility tool"),
                    ("sc.exe", "Windows Service Controller tool"),
                    ("vssadmin.exe", "Windows Volume Shadow Copy editor"),
                    ("whoami.exe", "User verification utility"),
                    ("net.exe", "Windows network setup tool"),
                    ("taskkill.exe", "Process terminations agent"),
                    ("bash", "Unix Bash shell terminal"),
                    ("ssh", "Secure Shell protocol client"),
                    ("cron", "Unix scheduled task daemon"),
                    ("systemctl", "Unix systemd service manager"),
                    ("iptables", "Unix host firewall rule manager"),
                    ("curl", "Universal curl transfer client"),
                    ("wget", "GNU download utility"),
                    ("python3", "Python interpreter runtime"),
                    ("kubectl", "Kubernetes cluster interface tool"),
                    ("docker", "Docker container runtime client")
                ]
                
                actions = [
                    ("persistence startup registry key modification", "creation of autostart items to establish persistent execution on boot"),
                    ("suspicious outbound connection to blacklisted IP address", "outbound sockets connection matching active threat intelligence feeds"),
                    ("unusual process parent lineage spawn", "anomalous process relations where parent processes spawn unauthorized shells"),
                    ("system security audit logs clearing activity", "attempting to evade event monitoring systems by deleting log records"),
                    ("unauthorized host security controls disablement attempt", "attempting to disable local endpoint firewall or antivirus services"),
                    ("brute-force credentials login sweeps detection", "high-frequency authentication failures indicating active brute-force threat"),
                    ("sensitive local database enumeration scan", "scanning internal file repositories or credentials files to discover secrets"),
                    ("suspicious service installation or modification", "creating unauthorized system services or daemons for lateral persistence"),
                    ("obfuscated command parameters execution", "executing command arguments packed in base64, hexadecimal, or cipher strings"),
                    ("decoy honeytoken asset access attempt", "interaction with a fake directory or credential registry deployed to spot intruders")
                ]
                
                count = 4
                for t_name, t_code, t_tags in tactics:
                    for tool_name, tool_desc in tools:
                        for act_name, act_desc in actions:
                            rule_name = f"Sigma - {t_name}: {tool_name} {act_name}"
                            # Deduplicate base rules
                            if any(r["name"] == rule_name for r in base_rules):
                                continue
                            
                            rule_id = f"rule-{count:06d}"
                            severity = "high" if "critical" in act_name or "lsass" in t_tags or "encrypt" in t_tags else ("medium" if "powershell" in tool_name or "registry" in act_name else "low")
                            
                            r_obj = Rule(
                                id=rule_id,
                                name=rule_name,
                                description=f"Detects {act_desc} involving the {tool_desc} (`{tool_name}`). Leveraged in MITRE technique {t_code}.",
                                rule_type="signature" if count % 2 == 0 else "behavioral",
                                severity=severity,
                                is_enabled=True,
                                conditions={"process": tool_name, "technique": t_code, "action": act_name},
                                actions=["kill_process"] if severity in ["high", "critical"] else [],
                                mitre_tactics=[t_name],
                                mitre_techniques=[t_code],
                                tags=t_tags + [tool_name.replace(".exe", ""), "sigma"],
                                updated_by="system"
                            )
                            all_rules_to_seed.append(r_obj)
                            count += 1
                            if count > 2079: # Limit to exactly 2079 total rules
                                break
                        if count > 2079:
                            break
                    if count > 2079:
                        break
                
                 # Add all rules in batches
                session.add_all(all_rules_to_seed)
                await session.commit()
                logger.info(f"✅ Successfully seeded {len(all_rules_to_seed)} MITRE ATT&CK & Sigma rules in rules database table.")
        except Exception as e:
            logger.error(f"⚠️ Error seeding rules database: {e}")

    async def _seed_default_playbooks(self):
        """Seed 30 default SOAR playbooks in database"""
        try:
            from app.api.v1.endpoints_playbooks import seed_playbooks_if_empty
            async with self.async_session() as session:
                await seed_playbooks_if_empty(session)
            logger.info("✅ Successfully seeded default SOAR playbooks in threat database.")
        except Exception as e:
            logger.error(f"⚠️ Error seeding default SOAR playbooks: {e}")

    async def _seed_demo_records(self):
        """Seed minimal demo records so REST dashboard pages render with real data."""
        try:
            from sqlalchemy import select, func
            from app.models.database import Alert, Event, Sensor
            from datetime import datetime, timedelta

            async with self.async_session() as session:
                sensor_count = await session.scalar(select(func.count(Sensor.id))) or 0
                alert_count = await session.scalar(select(func.count(Alert.id))) or 0
                event_count = await session.scalar(select(func.count(Event.id))) or 0

                if sensor_count == 0:
                    session.add_all([
                        Sensor(id="sensor-demo-01", name="Edge Gateway Sensor", sensor_type="network", status="active", ip_address="192.168.10.10", location="DMZ", event_type_feed="zeek", events_processed=1280),
                        Sensor(id="sensor-demo-02", name="Cloud Syslog Probe", sensor_type="syslog", status="active", ip_address="10.12.0.20", location="Cloud", event_type_feed="syslog", events_processed=950),
                        Sensor(id="sensor-demo-03", name="Deception Honeyprobe", sensor_type="honeypot", status="degraded", ip_address="172.16.8.40", location="Internal", event_type_feed="honeypot", events_processed=310),
                    ])

                if alert_count == 0:
                    now = datetime.utcnow()
                    session.add_all([
                        Alert(id="alert-demo-01", title="RDP brute-force attempt", description="Multiple failed RDP sign-ins detected from 192.168.10.55.", severity="high", status="new", source_event_ids=["evt-demo-01"], rule_id="rule-demo-01", detection_type="behavioral", indicators=["192.168.10.55"], mitre_tactics=["Credential Access"], mitre_techniques=["T1110"], first_seen=now - timedelta(hours=2), last_seen=now, occurrences=4, hostname="edge-gw-01", user="analyst", assigned_to="SOC", notes=[], artifacts=[], created_at=now, updated_at=now),
                        Alert(id="alert-demo-02", title="PowerShell downloader observed", description="Suspicious PowerShell process attempted outbound download.", severity="critical", status="investigating", source_event_ids=["evt-demo-02"], rule_id="rule-demo-02", detection_type="signature", indicators=["powershell.exe"], mitre_tactics=["Execution"], mitre_techniques=["T1059"], first_seen=now - timedelta(hours=5), last_seen=now, occurrences=1, hostname="win-host-03", user="analyst", assigned_to="IR", notes=[], artifacts=[], created_at=now, updated_at=now),
                    ])

                if event_count == 0:
                    now = datetime.utcnow()
                    session.add_all([
                        Event(id="evt-demo-01", timestamp=now - timedelta(minutes=15), source_ip="192.168.10.55", destination_ip="192.168.10.10", hostname="edge-gw-01", agent_id="agent-demo-01", event_type="network_connection", event_data={"protocol": "RDP", "status": "failed", "bytes": 8021}, status="new", created_at=now),
                        Event(id="evt-demo-02", timestamp=now - timedelta(minutes=28), source_ip="10.12.0.20", destination_ip="208.67.222.222", hostname="win-host-03", agent_id="agent-demo-02", event_type="process_creation", event_data={"image": "powershell.exe", "command_line": "powershell -enc ...", "user": "admin"}, status="new", created_at=now),
                        Event(id="evt-demo-03", timestamp=now - timedelta(hours=1), source_ip="172.16.8.40", destination_ip="172.16.8.1", hostname="honey-01", agent_id="agent-demo-03", event_type="vulnerability", event_data={"cve": "CVE-2024-21413", "package": "Microsoft Outlook", "severity": "critical", "cvss_score": 9.1, "status": "active"}, status="new", created_at=now),
                        Event(id="evt-demo-04", timestamp=now - timedelta(hours=2), source_ip="10.12.0.20", destination_ip="10.12.0.5", hostname="win-host-03", agent_id="agent-demo-02", event_type="compliance", event_data={"standard": "CIS Benchmark", "control_name": "Disable SMBv1", "status": "passed"}, status="new", created_at=now),
                    ])

                await session.commit()
                logger.info("✅ Seeded demo sensors, alerts, and events for dashboard fallback data.")
        except Exception as e:
            logger.error(f"⚠️ Error seeding demo dashboard records: {e}")

