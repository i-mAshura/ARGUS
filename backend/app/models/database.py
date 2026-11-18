"""
SQLAlchemy models for ARGUS
"""
from sqlalchemy import Column, String, Integer, DateTime, Boolean, JSON, Float, ForeignKey, Enum, Index
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone
import enum

Base = declarative_base()

class EventStatus(str, enum.Enum):
    NEW = "new"
    PROCESSED = "processed"
    ARCHIVED = "archived"

class AlertSeverity(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class AlertStatus(str, enum.Enum):
    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"

class Event(Base):
    """Telemetry events from endpoints and network"""
    __tablename__ = "events"
    
    id = Column(String, primary_key=True)
    timestamp = Column(DateTime, index=True)
    source_ip = Column(String, index=True)
    destination_ip = Column(String, index=True)
    hostname = Column(String, index=True)
    agent_id = Column(String, index=True)
    event_type = Column(String, index=True)  # process_creation, file_write, network_connection, etc.
    event_data = Column(JSON)  # Raw event data
    status = Column(Enum(EventStatus, native_enum=False), default=EventStatus.NEW)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_timestamp_event_type', 'timestamp', 'event_type'),
        Index('idx_hostname_timestamp', 'hostname', 'timestamp'),
    )

class Alert(Base):
    """Generated alerts from detection engine"""
    __tablename__ = "alerts"
    
    id = Column(String, primary_key=True)
    title = Column(String)
    description = Column(String)
    severity = Column(Enum(AlertSeverity, native_enum=False), index=True)
    status = Column(Enum(AlertStatus, native_enum=False), index=True, default=AlertStatus.NEW)
    source_event_ids = Column(JSON)  # List of related event IDs
    rule_id = Column(String, ForeignKey("rules.id"))
    detection_type = Column(String)  # behavioral, anomaly, signature
    indicators = Column(JSON)  # IOCs detected
    mitre_tactics = Column(JSON)  # MITRE ATT&CK tactics
    mitre_techniques = Column(JSON)  # MITRE ATT&CK techniques
    first_seen = Column(DateTime, index=True)
    last_seen = Column(DateTime)
    occurrences = Column(Integer, default=1)
    hostname = Column(String, index=True)
    user = Column(String)
    assigned_to = Column(String)
    notes = Column(JSON)  # Investigation notes
    artifacts = Column(JSON)  # Captured artifacts
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_severity_status', 'severity', 'status'),
        Index('idx_hostname_created', 'hostname', 'created_at'),
    )

class Rule(Base):
    """Detection rules (signature, behavioral, anomaly)"""
    __tablename__ = "rules"
    
    id = Column(String, primary_key=True)
    name = Column(String, unique=True)
    description = Column(String)
    rule_type = Column(String, index=True)  # signature, behavioral, anomaly
    is_enabled = Column(Boolean, default=True, index=True)
    severity = Column(Enum(AlertSeverity, native_enum=False), index=True)
    conditions = Column(JSON)  # Rule logic
    actions = Column(JSON)  # Automated response actions
    mitre_tactics = Column(JSON)
    mitre_techniques = Column(JSON)
    threshold = Column(Integer)  # For anomaly/behavioral rules
    time_window = Column(Integer)  # In seconds
    tags = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_by = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_rule_type_enabled', 'rule_type', 'is_enabled'),
    )

class Response(Base):
    """Automated response actions"""
    __tablename__ = "responses"
    
    id = Column(String, primary_key=True)
    alert_id = Column(String, ForeignKey("alerts.id"))
    action_type = Column(String)  # isolate, kill_process, block_hash, block_ip, etc.
    target = Column(String)  # Process ID, IP, hash, etc.
    status = Column(String)  # pending, executing, completed, failed
    result = Column(JSON)
    executed_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    executed_at = Column(DateTime)
    completed_at = Column(DateTime)

class Sensor(Base):
    """Network and honeypot sensors for threat detection"""
    __tablename__ = "sensors"
    
    id = Column(String, primary_key=True)
    name = Column(String, unique=True)
    sensor_type = Column(String)  # network, syslog, honeypot, ids
    status = Column(String, default="active")  # active, inactive, disconnected
    ip_address = Column(String)
    location = Column(String)  # DMZ, Internal, WAN, Cloud
    event_type_feed = Column(String)  # zeek, snort, syslog, honeypot
    events_processed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ThreatIntelligence(Base):
    """Threat intelligence data"""
    __tablename__ = "threat_intelligence"
    
    id = Column(String, primary_key=True)
    indicator_type = Column(String)  # ip, domain, hash, email
    indicator_value = Column(String, index=True)
    threat_type = Column(String)
    severity = Column(Enum(AlertSeverity, native_enum=False))
    source = Column(String)
    confidence = Column(Float)
    threat_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)

class Baseline(Base):
    """User/host behavior baselines for anomaly detection"""
    __tablename__ = "baselines"
    
    id = Column(String, primary_key=True)
    hostname = Column(String, index=True)
    username = Column(String)
    behavior_type = Column(String)  # process_count, network_connections, file_writes, etc.
    baseline_data = Column(JSON)  # Statistical data
    learned_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class User(Base):
    """Platform users"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True)
    email = Column(String, unique=True)
    password_hash = Column(String)
    role = Column(String)  # admin, analyst, operator, viewer
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Agent(Base):
    """Endpoint agents monitored by the system"""
    __tablename__ = "agents"
    
    id = Column(String, primary_key=True)
    hostname = Column(String, index=True)
    os_type = Column(String, index=True)  # windows, linux, macos
    status = Column(String, default="offline")  # online, offline
    version = Column(String)
    ip_address = Column(String)
    last_checkin = Column(DateTime, default=datetime.utcnow)
    events_processed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_agent_os_status', 'os_type', 'status'),
    )


class Ticket(Base):
    """Incident tickets raised for alerts"""
    __tablename__ = "tickets"
    
    id = Column(String, primary_key=True)
    alert_id = Column(String, ForeignKey("alerts.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(String)
    severity = Column(String, default="medium")
    priority = Column(String, default="3")  # 1: Critical, 2: High, 3: Medium, 4: Low
    status = Column(String, default="open")  # open, in_progress, resolved, closed
    assigned_to = Column(String)
    notes = Column(JSON, default=list)  # Comment history
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Playbook(Base):
    """SOAR Automated Playbook Workflows"""
    __tablename__ = "playbooks"
    
    id = Column(String, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)
    trigger = Column(String)
    active = Column(Boolean, default=True)
    executions = Column(Integer, default=0)
    success_rate = Column(Integer, default=100)
    steps = Column(JSON)  # List of dicts: {"label": "...", "desc": "..."}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PlaybookLog(Base):
    """SOAR Playbook Execution Logs"""
    __tablename__ = "playbook_logs"
    
    id = Column(String, primary_key=True)
    playbook_name = Column(String, nullable=False)
    target = Column(String)
    status = Column(String, default="completed")  # completed, failed, running
    timestamp = Column(DateTime, default=datetime.utcnow)
    logs = Column(JSON)  # List of strings: log steps output


