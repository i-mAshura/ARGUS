"""Health check endpoints"""
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("")
async def health_check():
    """Health check endpoint — reports real Redis connection status."""
    from app.main import redis_service

    redis_status = "connected" if redis_service.is_connected else "mock (real Redis not available)"

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "api": "running",
            "database": "connected",
            "redis": redis_status,
            "detection_engine": "running"
        }
    }

@router.get("/ready")
async def ready_check():
    """Readiness check for orchestration"""
    return {
        "ready": True,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/live")
async def liveness_check():
    """Liveness check for orchestration"""
    return {
        "alive": True,
        "timestamp": datetime.utcnow().isoformat()
    }
