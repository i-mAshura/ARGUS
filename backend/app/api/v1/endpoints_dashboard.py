"""Dashboard API endpoints"""
from fastapi import APIRouter
from datetime import datetime, timedelta
from sqlalchemy import select, func, or_
from app.models.database import Agent, Alert, Event, AlertStatus, AlertSeverity

router = APIRouter()

async def _check_and_update_stale_agents(session):
    """Check for active agents that haven't checked in for > 3 minutes and mark them offline."""
    now = datetime.utcnow()
    threshold = now - timedelta(minutes=3)
    query = select(Agent).where(Agent.status == "active").where(Agent.last_checkin < threshold)
    result = await session.execute(query)
    stale_agents = result.scalars().all()
    if stale_agents:
        for agent in stale_agents:
            agent.status = "offline"
        await session.commit()

@router.get("/summary")
async def get_dashboard_summary():
    """Get dashboard summary statistics"""
    from app.main import db, elastic_service

    # Query Elasticsearch for today's event count (primary event store)
    es_today = await elastic_service.count_today()

    async for session in db.get_session():
        await _check_and_update_stale_agents(session)
        # Query total registered, online, and offline agents
        total_endpoints = await session.scalar(select(func.count(Agent.id))) or 0
        healthy_endpoints = await session.scalar(select(func.count(Agent.id)).where(Agent.status == "active")) or 0
        offline_endpoints = await session.scalar(select(func.count(Agent.id)).where(Agent.status != "active")) or 0
        
        # Query event stats — use ES count as the primary value since that's
        # where the Kafka consumer indexes real telemetry.  Fall back to the
        # SQLite Event table count when ES is unavailable (e.g. not started).
        today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
        if es_today > 0:
            events_today = es_today
        else:
            events_today = await session.scalar(select(func.count(Event.id)).where(Event.timestamp >= today_start)) or 0
        
        # Query alerts stats by severity
        alerts_total = await session.scalar(select(func.count(Alert.id))) or 0
        alerts_critical = await session.scalar(select(func.count(Alert.id)).where(Alert.severity == AlertSeverity.CRITICAL)) or 0
        alerts_high = await session.scalar(select(func.count(Alert.id)).where(Alert.severity == AlertSeverity.HIGH)) or 0
        alerts_medium = await session.scalar(select(func.count(Alert.id)).where(Alert.severity == AlertSeverity.MEDIUM)) or 0
        alerts_low = await session.scalar(select(func.count(Alert.id)).where(Alert.severity == AlertSeverity.LOW)) or 0
        alerts_new = await session.scalar(select(func.count(Alert.id)).where(Alert.status == AlertStatus.NEW)) or 0
        
        # Query detection types
        behavioral = await session.scalar(select(func.count(Alert.id)).where(Alert.detection_type == "behavioral")) or 0
        anomaly = await session.scalar(select(func.count(Alert.id)).where(Alert.detection_type == "anomaly")) or 0
        signature = await session.scalar(select(func.count(Alert.id)).where(Alert.detection_type.in_(["signature", "signature_based"]))) or 0
        threat_intel = await session.scalar(select(func.count(Alert.id)).where(Alert.detection_type == "threat_intel")) or 0
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "alerts": {
                "total": alerts_total,
                "critical": alerts_critical,
                "high": alerts_high,
                "medium": alerts_medium,
                "low": alerts_low,
                "new": alerts_new
            },
            "events": {
                "total_today": events_today,
                "processed": events_today,
                "failed": 0
            },
            "endpoints": {
                "total": total_endpoints,
                "healthy": healthy_endpoints,
                "offline": offline_endpoints,
                "unmanaged": 0
            },
            "detections": {
                "behavioral": behavioral,
                "anomaly": anomaly,
                "signature_based": signature,
                "threat_intel": threat_intel
            }
        }

@router.get("/alerts/timeline")
async def get_alerts_timeline():
    """Get alert timeline for dashboard"""
    from app.main import db
    async for session in db.get_session():
        now = datetime.utcnow()
        yesterday = now - timedelta(hours=24)
        
        # Select all alerts created in the last 24 hours
        query = select(Alert.created_at).where(Alert.created_at >= yesterday)
        result = await session.execute(query)
        timestamps = result.scalars().all()
        
        # Construct hourly buckets
        buckets = {}
        for i in range(24):
            time_str = (now - timedelta(hours=i)).strftime("%H:00")
            buckets[time_str] = 0
            
        for ts in timestamps:
            if ts:
                ts_str = ts.strftime("%H:00")
                if ts_str in buckets:
                    buckets[ts_str] += 1
                    
        timeline_list = [{"time": k, "count": v} for k, v in buckets.items()]
        timeline_list.sort(key=lambda x: x["time"])
        
        return {"timeline": timeline_list}

@router.get("/threats/top")
async def get_top_threats():
    """Get top threats grouped by title"""
    from app.main import db
    async for session in db.get_session():
        query = (
            select(Alert.title, Alert.severity, func.count(Alert.id).label("count"))
            .group_by(Alert.title, Alert.severity)
            .order_by(func.count(Alert.id).desc())
            .limit(5)
        )
        result = await session.execute(query)
        rows = result.all()
        
        threats = []
        for rank, row in enumerate(rows, 1):
            title, severity, count = row
            mitre_tech = "T1059"
            if "mimikatz" in title.lower():
                mitre_tech = "T1003"
            elif "obfusc" in title.lower():
                mitre_tech = "T1027"
            elif "certutil" in title.lower():
                mitre_tech = "T1105"
            elif "privilege" in title.lower():
                mitre_tech = "T1068"
            elif "lateral" in title.lower():
                mitre_tech = "T1570"
                
            threats.append({
                "rank": rank,
                "threat_name": title,
                "count": count,
                "severity": severity.value if hasattr(severity, "value") else str(severity),
                "mitre_technique": mitre_tech
            })
            
        return {"threats": threats}

@router.get("/hosts/status")
async def get_hosts_status():
    """Get endpoint status"""
    from app.main import db
    async for session in db.get_session():
        await _check_and_update_stale_agents(session)
        query = select(Agent)
        result = await session.execute(query)
        agents = result.scalars().all()
        
        hosts = []
        today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
        for a in agents:
            events_today = await session.scalar(
                select(func.count(Event.id))
                .where(Event.hostname == a.hostname)
                .where(Event.timestamp >= today_start)
            ) or 0
            
            alerts_today = await session.scalar(
                select(func.count(Alert.id))
                .where(Alert.hostname == a.hostname)
                .where(Alert.created_at >= today_start)
            ) or 0
            
            hosts.append({
                "id": a.id,
                "hostname": a.hostname,
                "os_type": a.os_type,
                "ip_address": a.ip_address,
                "status": a.status,
                "last_seen": a.last_checkin.isoformat() if a.last_checkin else None,
                "events_today": events_today,
                "alerts_today": alerts_today,
                "agent_version": a.version or "1.0.0"
            })
            
        return {"hosts": hosts}

@router.get("/incidents/active")
async def get_active_incidents():
    """Get active incidents"""
    from app.main import db
    async for session in db.get_session():
        query = (
            select(Alert)
            .where(Alert.status.in_([AlertStatus.NEW, AlertStatus.ACKNOWLEDGED, AlertStatus.INVESTIGATING]))
            .order_by(Alert.created_at.desc())
            .limit(10)
        )
        result = await session.execute(query)
        alerts = result.scalars().all()
        
        incidents = []
        for a in alerts:
            incidents.append({
                "id": a.id,
                "title": a.title,
                "severity": a.severity.value if hasattr(a.severity, "value") else str(a.severity),
                "status": a.status.value if hasattr(a.status, "value") else str(a.status),
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "affected_hosts": 1,
                "alert_count": a.occurrences
            })
            
        return {"incidents": incidents}

@router.get("/mitre/coverage")
async def get_mitre_coverage():
    """Get MITRE ATT&CK coverage"""
    return {
        "coverage": {
            "total_techniques": 450,
            "techniques_detected": 0,
            "coverage_percentage": 0.0,
            "top_tactics": []
        }
    }

@router.get("/kpis/response-time")
async def get_response_times():
    """Get average response times"""
    return {
        "metrics": {
            "detection_time_avg": "0 minutes",
            "response_time_avg": "0 minutes",
            "resolution_time_avg": "0 hours",
            "mean_time_to_detect": "0 minutes",
            "mean_time_to_respond": "0 minutes",
            "mean_time_to_resolve": "0 hours"
        }
    }

@router.get("/compliance/posture")
async def get_compliance_posture():
    """Get security compliance posture"""
    return {
        "compliance": {
            "cis_critical_controls": 0,
            "nist_800_53": 0,
            "iso_27001": 0,
            "gdpr_compliance": 0,
            "pci_dss": 0
        }
    }
