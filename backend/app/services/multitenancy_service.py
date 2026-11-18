"""
Multitenancy Service
Handles tenant isolation, verification, and context management
"""
import logging
import secrets
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import jwt
import hashlib
from functools import wraps

from fastapi import Request, HTTPException, Depends
from sqlalchemy import select

logger = logging.getLogger(__name__)

class MultitenancyService:
    """Service for managing multitenancy and tenant isolation"""
    
    def __init__(self, db_service, jwt_secret: str = None):
        self.db = db_service
        self.jwt_secret = jwt_secret or "your-secret-key-change-in-production"
        self.jwt_algorithm = "HS256"
    
    async def create_organization(
        self,
        name: str,
        slug: str,
        contact_email: str,
        subscription_tier: str = "free",
        **kwargs
    ) -> Dict[str, Any]:
        """Create new organization"""
        from app.models.multitenancy import Organization
        
        try:
            organization = Organization(
                name=name,
                slug=slug,
                contact_email=contact_email,
                subscription_tier=subscription_tier,
                max_endpoints=self._get_max_endpoints(subscription_tier),
                **kwargs
            )
            
            async for session in self.db.get_session():
                session.add(organization)
                await session.commit()
                
                logger.info(f"✅ Created organization: {name}")
                
                return {
                    "id": str(organization.id),
                    "name": organization.name,
                    "status": "created"
                }
        
        except Exception as e:
            logger.error(f"Error creating organization: {e}")
            raise
    
    async def create_tenant_user(
        self,
        organization_id: str,
        name: str,
        email: str,
        password: str,
        role: str = "viewer"
    ) -> Dict[str, Any]:
        """Create user within organization"""
        from app.models.multitenancy import TenantUser
        
        try:
            # Hash password
            password_hash = self._hash_password(password)
            
            user = TenantUser(
                organization_id=organization_id,
                name=name,
                email=email,
                password_hash=password_hash,
                role=role
            )
            
            async for session in self.db.get_session():
                session.add(user)
                await session.commit()
                
                logger.info(f"✅ Created tenant user: {email}")
                
                return {
                    "id": str(user.id),
                    "email": user.email,
                    "role": user.role,
                    "status": "created"
                }
        
        except Exception as e:
            logger.error(f"Error creating tenant user: {e}")
            raise
    
    async def generate_api_key(
        self,
        organization_id: str,
        name: str,
        permissions: Dict[str, bool] = None,
        expires_in_days: int = 365
    ) -> Dict[str, Any]:
        """Generate API key for organization"""
        from app.models.multitenancy import APIKey
        
        try:
            # Generate random key
            raw_key = secrets.token_urlsafe(32)
            key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
            
            # Set defaults
            if permissions is None:
                permissions = {"read": True, "write": False}
            
            api_key = APIKey(
                organization_id=organization_id,
                name=name,
                key_hash=key_hash,
                permissions=permissions,
                expires_at=datetime.utcnow() + timedelta(days=expires_in_days)
            )
            
            async for session in self.db.get_session():
                session.add(api_key)
                await session.commit()
                
                logger.info(f"✅ Generated API key: {name}")
                
                return {
                    "id": str(api_key.id),
                    "name": name,
                    "key": raw_key,  # Only shown once
                    "message": "⚠️ Save this key securely. You won't see it again!"
                }
        
        except Exception as e:
            logger.error(f"Error generating API key: {e}")
            raise
    
    async def verify_api_key(self, key: str) -> Optional[Dict[str, Any]]:
        """Verify API key and return organization context"""
        from app.models.multitenancy import APIKey, Organization
        
        try:
            key_hash = hashlib.sha256(key.encode()).hexdigest()
            
            async for session in self.db.get_session():
                query = select(APIKey).where(
                    APIKey.key_hash == key_hash,
                    APIKey.is_active == True
                )
                result = await session.execute(query)
                api_key = result.scalar_one_or_none()
                
                if not api_key:
                    return None
                
                # Check expiration
                if api_key.expires_at and api_key.expires_at < datetime.utcnow():
                    logger.warning(f"API key expired: {api_key.name}")
                    return None
                
                # Update last used
                api_key.last_used = datetime.utcnow()
                await session.commit()
                
                # Get organization
                org_query = select(Organization).where(Organization.id == api_key.organization_id)
                org_result = await session.execute(org_query)
                org = org_result.scalar_one()
                
                return {
                    "organization_id": str(org.id),
                    "organization_name": org.name,
                    "permissions": api_key.permissions,
                    "subscription_tier": org.subscription_tier
                }
        
        except Exception as e:
            logger.error(f"Error verifying API key: {e}")
            return None
    
    async def authenticate_user(
        self,
        email: str,
        password: str
    ) -> Optional[Dict[str, Any]]:
        """Authenticate tenant user"""
        from app.models.multitenancy import TenantUser
        
        try:
            async for session in self.db.get_session():
                query = select(TenantUser).where(TenantUser.email == email)
                result = await session.execute(query)
                user = result.scalar_one_or_none()
                
                if not user:
                    return None
                
                # Verify password
                if not self._verify_password(password, user.password_hash):
                    return None
                
                if not user.is_active:
                    return None
                
                # Update last login
                user.last_login = datetime.utcnow()
                await session.commit()
                
                # Generate JWT token
                token = self._generate_jwt_token(
                    user_id=str(user.id),
                    organization_id=str(user.organization_id),
                    email=user.email,
                    role=user.role
                )
                
                return {
                    "token": token,
                    "user_id": str(user.id),
                    "organization_id": str(user.organization_id),
                    "email": user.email,
                    "role": user.role
                }
        
        except Exception as e:
            logger.error(f"Error authenticating user: {e}")
            return None
    
    def _generate_jwt_token(self, **claims) -> str:
        """Generate JWT token"""
        payload = {
            **claims,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)
    
    def verify_jwt_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError:
            logger.warning("Invalid token")
            return None
    
    @staticmethod
    def _hash_password(password: str) -> str:
        """Hash password securely"""
        import bcrypt
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    
    @staticmethod
    def _verify_password(password: str, password_hash: str) -> bool:
        """Verify password"""
        import bcrypt
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    
    @staticmethod
    def _get_max_endpoints(subscription_tier: str) -> int:
        """Get max endpoints based on subscription tier"""
        tiers = {
            "free": 50,
            "professional": 1000,
            "enterprise": 100000,
            "custom": 500000
        }
        return tiers.get(subscription_tier, 50)
    
    async def record_usage(
        self,
        organization_id: str,
        metrics: Dict[str, int]
    ) -> bool:
        """Record usage metrics for billing"""
        from app.models.multitenancy import UsageMetrics
        from datetime import date
        
        try:
            today = date.today()
            month = today.strftime("%Y-%m")
            
            async for session in self.db.get_session():
                # Get or create today's record
                query = select(UsageMetrics).where(
                    UsageMetrics.organization_id == organization_id,
                    UsageMetrics.date >= today
                )
                result = await session.execute(query)
                usage = result.scalar_one_or_none()
                
                if not usage:
                    usage = UsageMetrics(
                        organization_id=organization_id,
                        date=datetime.utcnow(),
                        month=month
                    )
                    session.add(usage)
                
                # Update metrics
                usage.events_processed += metrics.get("events", 0)
                usage.alerts_generated += metrics.get("alerts", 0)
                usage.endpoints_connected = metrics.get("endpoints", 0)
                usage.api_calls += metrics.get("api_calls", 0)
                
                await session.commit()
                return True
        
        except Exception as e:
            logger.error(f"Error recording usage: {e}")
            return False

# ==================== MIDDLEWARE FOR TENANT ISOLATION ====================

async def get_current_tenant(request: Request) -> Dict[str, Any]:
    """Extract tenant from request context"""
    # Try API key first
    api_key = request.headers.get("X-API-Key")
    if api_key:
        # Verify and return tenant
        pass
    
    # Try JWT token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        # Verify and return tenant
        pass
    
    raise HTTPException(status_code=401, detail="Not authenticated")

def tenant_required(func):
    """Decorator to require tenant context"""
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        tenant = await get_current_tenant(request)
        request.state.tenant_id = tenant["organization_id"]
        return await func(request, *args, **kwargs)
    return wrapper

# ==================== RATE LIMITING BY TIER ====================

class RateLimiter:
    """Rate limiting based on subscription tier"""
    
    LIMITS = {
        "free": {"events_per_day": 10000, "api_calls_per_hour": 100},
        "professional": {"events_per_day": 1000000, "api_calls_per_hour": 10000},
        "enterprise": {"events_per_day": 100000000, "api_calls_per_hour": 1000000}
    }
    
    @classmethod
    def get_limits(cls, tier: str) -> Dict[str, int]:
        """Get rate limits for tier"""
        return cls.LIMITS.get(tier, cls.LIMITS["free"])
