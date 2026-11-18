"""
Pydantic models for API requests/responses
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any

class EventCreate(BaseModel):
    """Event creation model"""
    timestamp: datetime
    source_ip: str
    destination_ip: Optional[str] = None
    hostname: str
    agent_id: str
    event_type: str
    event_data: Dict[str, Any]

class EventResponse(EventCreate):
    """Event response model"""
    id: str
    status: str
    created_at: datetime

class AlertCreate(BaseModel):
    """Alert creation model"""
    title: str
    description: str
    severity: str
    rule_id: str
    detection_type: str
    source_event_ids: List[str]
    indicators: Optional[Dict[str, Any]] = None
    mitre_tactics: Optional[List[str]] = None
    mitre_techniques: Optional[List[str]] = None

class AlertResponse(AlertCreate):
    """Alert response model"""
    id: str
    status: str
    first_seen: datetime
    hostname: str
    created_at: datetime
    updated_at: datetime

class RuleCreate(BaseModel):
    """Rule creation model"""
    name: str
    description: str
    rule_type: str  # signature, behavioral, anomaly
    severity: str
    conditions: Dict[str, Any]
    actions: Optional[List[Dict[str, Any]]] = None
    mitre_tactics: Optional[List[str]] = None
    mitre_techniques: Optional[List[str]] = None
    threshold: Optional[int] = None
    time_window: Optional[int] = None
    tags: Optional[List[str]] = None

class RuleResponse(RuleCreate):
    """Rule response model"""
    id: str
    is_enabled: bool
    created_at: datetime
    updated_at: datetime

class ResponseCreate(BaseModel):
    """Response action creation model"""
    alert_id: str
    action_type: str
    target: str

class ResponseResponse(ResponseCreate):
    """Response action response model"""
    id: str
    status: str
    created_at: datetime
    executed_at: Optional[datetime] = None

class DashboardStats(BaseModel):
    """Dashboard statistics"""
    total_events: int
    total_alerts: int
    critical_alerts: int
    high_alerts: int
    alerts_today: int
    rules_enabled: int
    avg_response_time: float
    top_threats: List[Dict[str, Any]]

class TelemetryBatch(BaseModel):
    """Batch telemetry submission"""
    hostname: str
    agent_id: str
    events: List[EventCreate]

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: datetime
    database: str
    redis: str
    detection_engine: str
