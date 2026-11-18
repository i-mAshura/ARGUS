import os
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Dict, Any, Optional
import stripe
import logging
from sqlalchemy import select

from app.services.multitenancy_service import MultitenancyService, RateLimiter

router = APIRouter()
logger = logging.getLogger(__name__)

def _get_multitenancy_service():
    from app.main import db
    return MultitenancyService(db)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_API_KEY")

# ==================== AUTHENTICATION ====================

@router.post("/auth/signup")
async def signup(
    name: str,
    email: str,
    password: str,
    organization_name: str,
    organization_slug: str
):
    """User signup with new organization"""
    multitenancy_service = _get_multitenancy_service()
    
    try:
        # Create organization
        org_result = await multitenancy_service.create_organization(
            name=organization_name,
            slug=organization_slug,
            contact_email=email,
            subscription_tier="trial"
        )
        
        # Create user
        user_result = await multitenancy_service.create_tenant_user(
            organization_id=org_result["id"],
            name=name,
            email=email,
            password=password,
            role="admin"
        )
        
        # Generate token
        auth_result = await multitenancy_service.authenticate_user(email, password)
        
        return {
            "status": "success",
            "message": "✅ Account created successfully!",
            "token": auth_result["token"],
            "organization_id": org_result["id"],
            "user_id": user_result["id"],
            "trial_ends": (datetime.utcnow() + timedelta(days=14)).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/auth/login")
async def login(email: str, password: str):
    """User login"""
    multitenancy_service = _get_multitenancy_service()
    
    try:
        auth_result = await multitenancy_service.authenticate_user(email, password)
        
        if not auth_result:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        return {
            "status": "success",
            "token": auth_result["token"],
            "organization_id": auth_result["organization_id"],
            "user_id": auth_result["user_id"],
            "role": auth_result["role"]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@router.post("/auth/logout")
async def logout(request: Request):
    """User logout (token invalidation)"""
    # In production, add token to blacklist
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/auth/default-credentials")
async def get_default_credentials():
    """Retrieve the generated default admin credentials for first-time login."""
    import json
    import os

    candidate_paths = [
        os.path.join(os.path.dirname(__file__), "../../data/credentials.json"),
        os.path.join(os.path.dirname(__file__), "../../../data/credentials.json"),
        os.path.abspath(os.path.join(os.getcwd(), "data", "credentials.json")),
        os.path.abspath(os.path.join(os.getcwd(), "backend", "data", "credentials.json")),
        "C:/Users/kollu/Documents/PROJECTS/SpyderXDR/database/credentials.json",
    ]

    for creds_path in candidate_paths:
        try:
            if os.path.exists(creds_path):
                with open(creds_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict) and data.get("email") and data.get("password"):
                    return data
        except Exception:
            continue

    return {"email": "admin@argus.com", "password": "password123"}

@router.post("/auth/refresh-token")
async def refresh_token(request: Request):
    """Refresh JWT token"""
    multitenancy_service = _get_multitenancy_service()
    
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid token")
        
        token = auth_header[7:]
        payload = multitenancy_service.verify_jwt_token(token)
        
        if not payload:
            raise HTTPException(status_code=401, detail="Token expired")
        
        # Generate new token
        new_token = multitenancy_service._generate_jwt_token(**payload)
        
        return {
            "status": "success",
            "token": new_token
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Token refresh failed")

# ==================== ORGANIZATION MANAGEMENT ====================

@router.get("/organization")
async def get_organization(request: Request):
    """Get current organization info"""
    from app.models.multitenancy import Organization
    
    try:
        org_id = request.state.tenant_id
        from app.main import db
        async for session in db.get_session():
            query = select(Organization).where(Organization.id == org_id)
            result = await session.execute(query)
            org = result.scalar_one_or_none()
            
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")
            
            # Get usage for this month
            from app.models.multitenancy import UsageMetrics
            from datetime import date
            month = date.today().strftime("%Y-%m")
            
            usage_query = select(UsageMetrics).where(
                UsageMetrics.organization_id == org_id,
                UsageMetrics.month == month
            )
            usage_result = await session.execute(usage_query)
            usage = usage_result.scalar_one_or_none()
            
            return {
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "subscription_tier": org.subscription_tier,
                "status": org.status,
                "max_endpoints": org.max_endpoints,
                "current_endpoints": org.current_endpoints,
                "endpoints_available": org.max_endpoints - org.current_endpoints,
                "created_at": org.created_at.isoformat(),
                "usage": {
                    "events_processed": usage.events_processed if usage else 0,
                    "alerts_generated": usage.alerts_generated if usage else 0,
                    "endpoints_connected": usage.endpoints_connected if usage else 0,
                    "api_calls": usage.api_calls if usage else 0
                }
            }
    
    except Exception as e:
        logger.error(f"Error getting organization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/organization")
async def update_organization(request: Request, data: Dict[str, Any]):
    """Update organization settings"""
    from app.models.multitenancy import Organization
    
    try:
        org_id = request.state.tenant_id
        from app.main import db
        async for session in db.get_session():
            query = select(Organization).where(Organization.id == org_id)
            result = await session.execute(query)
            org = result.scalar_one_or_none()
            
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")
            
            # Update allowed fields
            for field in ["name", "timezone", "language", "theme"]:
                if field in data:
                    setattr(org, field, data[field])
            
            org.updated_at = datetime.utcnow()
            await session.commit()
            
            return {
                "status": "success",
                "message": "Organization updated successfully"
            }
    
    except Exception as e:
        logger.error(f"Error updating organization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== SUBSCRIPTION & BILLING ====================

@router.get("/subscription")
async def get_subscription(request: Request):
    """Get subscription details"""
    try:
        org_id = request.state.tenant_id
        
        # Get organization tier
        from app.models.multitenancy import Organization
        from app.main import db
        async for session in db.get_session():
            query = select(Organization).where(Organization.id == org_id)
            result = await session.execute(query)
            org = result.scalar_one_or_none()
            
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")
            
            # Get pricing info
            pricing = {
                "free": {
                    "price": 0,
                    "endpoints": 50,
                    "features": ["Basic detection", "5 integrations"],
                    "support": "Community"
                },
                "professional": {
                    "price": 999,
                    "endpoints": 1000,
                    "features": ["Advanced detection", "Unlimited integrations", "Automation"],
                    "support": "Email support"
                },
                "enterprise": {
                    "price": 4999,
                    "endpoints": 100000,
                    "features": ["Full features", "API access", "SSO", "SLA 99.9%"],
                    "support": "24/7 Phone + Email"
                }
            }
            
            tier_info = pricing.get(org.subscription_tier, pricing["free"])
            
            return {
                "tier": org.subscription_tier,
                "status": org.status,
                **tier_info,
                "billing_cycle": "monthly",
                "next_billing_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
                "auto_renew": True
            }
    
    except Exception as e:
        logger.error(f"Error getting subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/subscription/upgrade")
async def upgrade_subscription(request: Request, new_tier: str):
    """Upgrade subscription tier"""
    from app.models.multitenancy import Organization
    
    try:
        org_id = request.state.tenant_id
        
        # Validate tier
        valid_tiers = ["free", "professional", "enterprise"]
        if new_tier not in valid_tiers:
            raise HTTPException(status_code=400, detail="Invalid tier")
        
        from app.main import db
        async for session in db.get_session():
            query = select(Organization).where(Organization.id == org_id)
            result = await session.execute(query)
            org = result.scalar_one_or_none()
            
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")
            
            # Update tier
            org.subscription_tier = new_tier
            org.max_endpoints = MultitenancyService._get_max_endpoints(new_tier)
            org.updated_at = datetime.utcnow()
            
            await session.commit()
            
            return {
                "status": "success",
                "message": f"✅ Upgraded to {new_tier} tier",
                "new_tier": new_tier,
                "max_endpoints": org.max_endpoints
            }
    
    except Exception as e:
        logger.error(f"Error upgrading subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/billing/checkout")
async def create_checkout_session(request: Request, tier: str):
    """Create Stripe checkout session"""
    try:
        org_id = request.state.tenant_id
        
        # Stripe pricing
        prices = {
            "professional": "price_prof",  # Add real Stripe price IDs
            "enterprise": "price_ent"
        }
        
        if tier not in prices:
            raise HTTPException(status_code=400, detail="Invalid tier")
        
        # Create session
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": prices[tier],
                    "quantity": 1,
                }
            ],
            mode="subscription",
            success_url="https://spyderxdr.local/billing/success",
            cancel_url="https://spyderxdr.local/billing/cancel",
            metadata={
                "organization_id": str(org_id),
                "tier": tier
            }
        )
        
        return {
            "session_id": session.id,
            "checkout_url": session.url
        }
    
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Billing error")

@router.get("/billing/invoices")
async def get_invoices(request: Request):
    """Get billing invoices"""
    try:
        org_id = request.state.tenant_id
        
        # Fetch from Stripe
        invoices = stripe.Invoice.list(
            metadata={"organization_id": str(org_id)},
            limit=12
        )
        
        return {
            "total": len(invoices.data),
            "invoices": [
                {
                    "id": inv.id,
                    "amount": inv.total,
                    "date": datetime.fromtimestamp(inv.created),
                    "status": inv.status,
                    "download_url": inv.invoice_pdf
                }
                for inv in invoices.data
            ]
        }
    
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Billing error")

# ==================== USAGE & ANALYTICS ====================

@router.get("/usage/current")
async def get_current_usage(request: Request):
    """Get current month usage"""
    from app.models.multitenancy import UsageMetrics, Organization
    from datetime import date
    
    try:
        org_id = request.state.tenant_id
        month = date.today().strftime("%Y-%m")
        from app.main import db
        async for session in db.get_session():
            # Get usage
            usage_query = select(UsageMetrics).where(
                UsageMetrics.organization_id == org_id,
                UsageMetrics.month == month
            )
            usage_result = await session.execute(usage_query)
            usage = usage_result.scalar_one_or_none()
            
            # Get limits
            org_query = select(Organization).where(Organization.id == org_id)
            org_result = await session.execute(org_query)
            org = org_result.scalar_one()
            
            limits = RateLimiter.get_limits(org.subscription_tier)
            
            return {
                "period": month,
                "metrics": {
                    "events_processed": usage.events_processed if usage else 0,
                    "alerts_generated": usage.alerts_generated if usage else 0,
                    "endpoints_connected": usage.endpoints_connected if usage else 0,
                    "api_calls": usage.api_calls if usage else 0,
                    "storage_used_gb": usage.storage_used_gb if usage else 0
                },
                "limits": limits,
                "percentage_used": {
                    "events": (usage.events_processed / limits["events_per_day"] * 100) if usage else 0
                }
            }
    
    except Exception as e:
        logger.error(f"Error getting usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usage/historical")
async def get_historical_usage(request: Request, months: int = 12):
    """Get historical usage for analytics"""
    from app.models.multitenancy import UsageMetrics
    
    try:
        org_id = request.state.tenant_id
        from app.main import db
        async for session in db.get_session():
            query = select(UsageMetrics).where(
                UsageMetrics.organization_id == org_id
            ).order_by(UsageMetrics.date.desc()).limit(months)
            
            result = await session.execute(query)
            usage_data = result.scalars().all()
            
            return {
                "organization_id": str(org_id),
                "data": [
                    {
                        "date": u.date.isoformat(),
                        "events": u.events_processed,
                        "alerts": u.alerts_generated,
                        "endpoints": u.endpoints_connected,
                        "api_calls": u.api_calls
                    }
                    for u in usage_data
                ]
            }
    
    except Exception as e:
        logger.error(f"Error getting historical usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== WEBHOOK HANDLERS ====================

@router.post("/webhooks/stripe")
async def handle_stripe_webhook(request: Request):
    """Handle Stripe webhooks for subscription events"""
    from app.models.multitenancy import Organization
    
    try:
        body = await request.body()
        sig_header = request.headers.get("stripe-signature")
        
        # Verify webhook
        event = stripe.Webhook.construct_event(
            body, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET")
        )
        
        if event["type"] == "customer.subscription.updated":
            # Handle subscription update
            pass
        elif event["type"] == "customer.subscription.deleted":
            # Handle subscription cancellation
            pass
        elif event["type"] == "invoice.payment_succeeded":
            # Handle successful payment
            pass
        
        return {"status": "success"}
    
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")
