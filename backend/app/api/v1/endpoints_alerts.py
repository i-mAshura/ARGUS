"""Alerts API endpoints"""
from fastapi import APIRouter, Depends, Query
from datetime import datetime
import uuid



router = APIRouter()

@router.get("/", response_model=dict)
async def get_alerts(
    status: str = Query(None),
    severity: str = Query(None),
    hostname: str = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0)
):
    """Get alerts with filtering"""
    from app.main import db
    async for session in db.get_session():
        alerts = await db.get_alerts(
            session,
            status=status,
            severity=severity,
            hostname=hostname,
            limit=limit,
            offset=offset
        )
        
        return {
            "total": len(alerts),
            "alerts": [
                {
                    "id": a.id,
                    "title": a.title,
                    "description": a.description,
                    "severity": a.severity,
                    "status": a.status,
                    "hostname": a.hostname,
                    "mitre_tactics": a.mitre_tactics,
                    "mitre_techniques": a.mitre_techniques,
                    "created_at": a.created_at,
                    "updated_at": a.updated_at
                }
                for a in alerts
            ]
        }

@router.get("/{alert_id}")
async def get_alert(alert_id: str):
    """Get specific alert details"""
    from sqlalchemy import select
    from app.main import db
    
    async for session in db.get_session():
        from app.models.database import Alert
        query = select(Alert).where(Alert.id == alert_id)
        result = await session.execute(query)
        alert = result.scalar_one_or_none()
        
        if not alert:
            return {"error": "Alert not found"}
        
        return {
            "id": alert.id,
            "title": alert.title,
            "description": alert.description,
            "severity": alert.severity,
            "status": alert.status,
            "detection_type": alert.detection_type,
            "hostname": alert.hostname,
            "user": alert.user,
            "first_seen": alert.first_seen,
            "last_seen": alert.last_seen,
            "occurrences": alert.occurrences,
            "mitre_tactics": alert.mitre_tactics,
            "mitre_techniques": alert.mitre_techniques,
            "indicators": alert.indicators,
            "artifacts": alert.artifacts,
            "notes": alert.notes
        }

@router.put("/{alert_id}", response_model=dict)
async def update_alert(alert_id: str, update_data: dict):
    """Update alert status/notes"""
    from app.main import db, redis_service
    async for session in db.get_session():
        alert = await db.update_alert(session, alert_id, update_data)
        
        if not alert:
            return {"error": "Alert not found"}
        
        # Update cache
        cache_key = f"alert:{alert_id}"
        await redis_service.set(cache_key, {
            "status": alert.status,
            "updated_at": alert.updated_at.isoformat()
        })
        
        return {
            "status": "success",
            "alert_id": alert_id,
            "updated_fields": list(update_data.keys())
        }

@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledge alert"""
    from app.main import db
    async for session in db.get_session():
        alert = await db.update_alert(session, alert_id, {"status": "acknowledged"})
        return {"status": "acknowledged", "alert_id": alert_id}

@router.post("/{alert_id}/investigate")
async def mark_investigating(alert_id: str):
    """Mark alert as under investigation"""
    from app.main import db
    async for session in db.get_session():
        alert = await db.update_alert(session, alert_id, {"status": "investigating"})
        return {"status": "investigating", "alert_id": alert_id}

@router.post("/{alert_id}/resolve")
async def resolve_alert(alert_id: str, resolution: dict = None):
    """Resolve alert"""
    from app.main import db
    async for session in db.get_session():
        update_data = {"status": "resolved"}
        if resolution:
            update_data["notes"] = resolution.get("notes", [])
        
        alert = await db.update_alert(session, alert_id, update_data)
        return {"status": "resolved", "alert_id": alert_id}

@router.post("/{alert_id}/false-positive")
async def mark_false_positive(alert_id: str):
    """Mark alert as false positive"""
    from app.main import db
    async for session in db.get_session():
        alert = await db.update_alert(
            session,
            alert_id,
            {"status": "false_positive"}
        )
        return {"status": "marked_as_false_positive", "alert_id": alert_id}

@router.post("/acknowledge-all")
async def acknowledge_all_alerts():
    """Acknowledge all new alerts in the threat database"""
    from app.main import db
    from app.models.database import Alert, AlertStatus
    from sqlalchemy import update
    
    async for session in db.get_session():
        query = update(Alert).where(Alert.status == AlertStatus.NEW).values(status=AlertStatus.ACKNOWLEDGED)
        await session.execute(query)
        await session.commit()
        
    return {"status": "success", "message": "All unread alerts marked as acknowledged"}

@router.get("/stats/summary")
async def get_alert_stats():
    """Get alert statistics"""
    from app.main import db
    async for session in db.get_session():
        stats = await db.get_alert_stats(session)
        
        return {
            "total_alerts": stats["total"],
            "critical_alerts": stats["critical"],
            "high_alerts": stats["high"],
            "new_alerts": stats["new"],
            "today_alerts": stats["today"],
            "avg_response_time": "2.5 hours"  # TODO: Calculate
        }

@router.get("/trends/daily")
async def get_daily_trends():
    """Get daily alert trends"""
    return {
        "data": [
            {"date": "2024-01-01", "count": 45},
            {"date": "2024-01-02", "count": 52},
            {"date": "2024-01-03", "count": 48}
        ]
    }
