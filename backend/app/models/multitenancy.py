"""
Multitenancy Models and Schemas
Supports SaaS with complete tenant isolation
"""
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, JSON, Enum, Uuid
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.models.database import Base

class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    CANCELLED = "cancelled"

class Organization(Base):
    """Organization/Tenant entity"""
    __tablename__ = "organizations"
    
    id = Column(Uuid(as_uuid=False), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)  # URL-friendly name
    description = Column(String(500))
    website = Column(String(255))
    
    # Subscription & Billing
    subscription_tier = Column(String(50), default="free")  # free, professional, enterprise
    status = Column(Enum(TenantStatus, native_enum=False), default=TenantStatus.TRIAL)
    max_endpoints = Column(Integer, default=50)  # Based on subscription tier
    current_endpoints = Column(Integer, default=0)
    
    # Contact & Legal
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(20))
    
    # Configuration
    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")
    theme = Column(String(20), default="dark")
    
    # Features
    features = Column(JSON, default={})
    integrations_enabled = Column(JSON, default={})
    
    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships
    users = relationship("TenantUser", back_populates="organization", cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="organization", cascade="all, delete-orphan")
    usage = relationship("UsageMetrics", back_populates="organization", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Organization {self.name}>"

class TenantUser(Base):
    """User within a tenant/organization"""
    __tablename__ = "tenant_users"
    
    id = Column(Uuid(as_uuid=False), primary_key=True, default=uuid.uuid4)
    organization_id = Column(Uuid(as_uuid=False), ForeignKey("organizations.id"), nullable=False)
    
    # User Info
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Role & Permissions
    role = Column(String(50), default="viewer")  # admin, manager, analyst, viewer
    permissions = Column(JSON, default={})
    
    # MFA
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(255), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    
    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    organization = relationship("Organization", back_populates="users")
    
    def __repr__(self):
        return f"<TenantUser {self.email}>"

class APIKey(Base):
    """API keys for programmatic access"""
    __tablename__ = "api_keys"
    
    id = Column(Uuid(as_uuid=False), primary_key=True, default=uuid.uuid4)
    organization_id = Column(Uuid(as_uuid=False), ForeignKey("organizations.id"), nullable=False)
    
    name = Column(String(255), nullable=False)
    key_hash = Column(String(255), nullable=False, unique=True)
    
    # Permissions
    permissions = Column(JSON, default={})
    
    # Usage Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    organization = relationship("Organization", back_populates="api_keys")
    
    def __repr__(self):
        return f"<APIKey {self.name}>"

class UsageMetrics(Base):
    """Track usage for billing purposes"""
    __tablename__ = "usage_metrics"
    
    id = Column(Uuid(as_uuid=False), primary_key=True, default=uuid.uuid4)
    organization_id = Column(Uuid(as_uuid=False), ForeignKey("organizations.id"), nullable=False)
    
    # Metrics
    events_processed = Column(Integer, default=0)
    alerts_generated = Column(Integer, default=0)
    endpoints_connected = Column(Integer, default=0)
    storage_used_gb = Column(Integer, default=0)
    api_calls = Column(Integer, default=0)
    
    # Time Period
    date = Column(DateTime, default=datetime.utcnow)
    month = Column(String(7))  # YYYY-MM format
    
    organization = relationship("Organization", back_populates="usage")
    
    def __repr__(self):
        return f"<UsageMetrics {self.organization_id} - {self.date}>"

# ==================== PYDANTIC SCHEMAS ====================

from pydantic import BaseModel, EmailStr
from typing import Optional, Dict

class OrganizationCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    contact_email: EmailStr
    contact_phone: Optional[str] = None

class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    subscription_tier: str
    status: str
    max_endpoints: int
    current_endpoints: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class TenantUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "viewer"

class TenantUserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    email_verified: bool
    last_login: Optional[datetime]
    
    class Config:
        from_attributes = True

class APIKeyCreate(BaseModel):
    name: str
    permissions: Optional[Dict[str, bool]] = None

class APIKeyResponse(BaseModel):
    id: str
    name: str
    permissions: Dict
    created_at: datetime
    last_used: Optional[datetime]
    is_active: bool
    
    class Config:
        from_attributes = True

class UsageMetricsResponse(BaseModel):
    organization_id: str
    events_processed: int
    alerts_generated: int
    endpoints_connected: int
    storage_used_gb: int
    api_calls: int
    date: datetime
    
    class Config:
        from_attributes = True
