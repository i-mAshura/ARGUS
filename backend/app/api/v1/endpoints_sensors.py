"""
Endpoints for SOC Sensors Management
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
from sqlalchemy import select

from app.models.database import Sensor

router = APIRouter()

async def seed_default_sensors(session):
    """Seed default SOC sensors if table is empty so the SOC console has real rows."""
    from sqlalchemy import select, func

    sensor_count = await session.scalar(select(func.count(Sensor.id))) or 0
    if sensor_count > 0:
        return

    session.add_all([
        Sensor(id="sensor-seed-01", name="Edge Gateway Sensor", sensor_type="network", status="active", ip_address="192.168.10.10", location="DMZ", event_type_feed="zeek", events_processed=1280),
        Sensor(id="sensor-seed-02", name="Cloud Syslog Probe", sensor_type="syslog", status="active", ip_address="10.12.0.20", location="Cloud", event_type_feed="syslog", events_processed=950),
        Sensor(id="sensor-seed-03", name="Deception Honeyprobe", sensor_type="honeypot", status="degraded", ip_address="172.16.8.40", location="Internal", event_type_feed="honeypot", events_processed=310),
    ])
    await session.commit()

@router.get("")
async def get_sensors():
    """Get all registered SOC sensors"""
    from app.main import db
    async for session in db.get_session():
        await seed_default_sensors(session)
        query = select(Sensor)
        result = await session.execute(query)
        sensors = result.scalars().all()
        return [
            {
                "id": s.id,
                "name": s.name,
                "sensor_type": s.sensor_type,
                "status": s.status,
                "ip_address": s.ip_address,
                "location": s.location,
                "event_type_feed": s.event_type_feed,
                "events_processed": s.events_processed,
                "created_at": s.created_at,
                "updated_at": s.updated_at
            }
            for s in sensors
        ]

@router.post("/deploy")
async def deploy_sensor(payload: dict):
    """Deploy new sensor probe"""
    try:
        from app.main import db
        async for session in db.get_session():
            sensor = Sensor(
                id=f"sensor-{str(uuid.uuid4())[:8]}",
                name=payload.get("name"),
                sensor_type=payload.get("sensor_type", "network"),
                status="active",
                ip_address=payload.get("ip_address", "127.0.0.1"),
                location=payload.get("location", "Internal"),
                event_type_feed=payload.get("event_type_feed", "syslog"),
                events_processed=0
            )
            session.add(sensor)
            await session.commit()
            return {
                "status": "deployed",
                "sensor": {
                    "id": sensor.id,
                    "name": sensor.name,
                    "status": sensor.status
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{sensor_id}/status")
async def toggle_sensor_status(sensor_id: str, payload: dict):
    """Toggle active status of a sensor"""
    from app.main import db
    async for session in db.get_session():
        query = select(Sensor).where(Sensor.id == sensor_id)
        result = await session.execute(query)
        sensor = result.scalar_one_or_none()
        
        if not sensor:
            raise HTTPException(status_code=404, detail="Sensor not found")
        
        sensor.status = payload.get("status", "active")
        await session.commit()
        return {"status": "updated", "sensor_id": sensor_id, "active_status": sensor.status}

@router.delete("/{sensor_id}")
async def delete_sensor(sensor_id: str):
    """Delete sensor probe"""
    from app.main import db
    async for session in db.get_session():
        query = select(Sensor).where(Sensor.id == sensor_id)
        result = await session.execute(query)
        sensor = result.scalar_one_or_none()
        
        if not sensor:
            raise HTTPException(status_code=404, detail="Sensor not found")
        
        await session.delete(sensor)
        await session.commit()
        return {"status": "deleted", "sensor_id": sensor_id}
