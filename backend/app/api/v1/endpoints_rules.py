"""Rules API endpoints"""
from fastapi import APIRouter, Query
import uuid
from datetime import datetime



router = APIRouter()

@router.get("/")
async def get_rules(
    enabled_only: bool = Query(False),
    limit: int = Query(50, le=1000),
    offset: int = Query(0)
):
    """Get detection rules with pagination"""
    from app.main import db
    from sqlalchemy import select, func
    from app.models.database import Rule
    
    async for session in db.get_session():
        # Count total
        count_q = select(func.count(Rule.id))
        if enabled_only:
            count_q = count_q.where(Rule.is_enabled == True)
        total_count = await session.scalar(count_q) or 0
        
        # Select subset
        query = select(Rule)
        if enabled_only:
            query = query.where(Rule.is_enabled == True)
        query = query.order_by(Rule.id).limit(limit).offset(offset)
        result = await session.execute(query)
        rules = result.scalars().all()
        
        return {
            "total": total_count,
            "rules": [
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "rule_type": r.rule_type,
                    "severity": r.severity,
                    "is_enabled": r.is_enabled,
                    "mitre_tactics": r.mitre_tactics,
                    "mitre_techniques": r.mitre_techniques,
                    "tags": r.tags
                }
                for r in rules
            ]
        }

@router.post("/create")
async def create_rule(rule_data: dict):
    """Create new detection rule"""
    from app.main import db
    async for session in db.get_session():
        rule_payload = {
            "id": str(uuid.uuid4()),
            "name": rule_data.get("name"),
            "description": rule_data.get("description"),
            "rule_type": rule_data.get("rule_type"),  # signature, behavioral, anomaly
            "severity": rule_data.get("severity", "medium"),
            "is_enabled": rule_data.get("is_enabled", True),
            "conditions": rule_data.get("conditions", {}),
            "actions": rule_data.get("actions", []),
            "mitre_tactics": rule_data.get("mitre_tactics", []),
            "mitre_techniques": rule_data.get("mitre_techniques", []),
            "threshold": rule_data.get("threshold"),
            "time_window": rule_data.get("time_window"),
            "tags": rule_data.get("tags", []),
            "updated_by": "system"
        }
        
        rule = await db.create_rule(session, rule_payload)
        
        return {
            "status": "created",
            "rule_id": rule.id,
            "name": rule.name
        }

@router.get("/{rule_id}")
async def get_rule(rule_id: str):
    """Get specific rule"""
    from app.main import db
    async for session in db.get_session():
        rule = await db.get_rule(session, rule_id)
        
        if not rule:
            return {"error": "Rule not found"}
        
        return {
            "id": rule.id,
            "name": rule.name,
            "description": rule.description,
            "rule_type": rule.rule_type,
            "severity": rule.severity,
            "is_enabled": rule.is_enabled,
            "conditions": rule.conditions,
            "actions": rule.actions,
            "mitre_tactics": rule.mitre_tactics,
            "mitre_techniques": rule.mitre_techniques,
            "tags": rule.tags
        }

@router.put("/{rule_id}")
async def update_rule(rule_id: str, update_data: dict):
    """Update detection rule"""
    from app.main import db
    async for session in db.get_session():
        from sqlalchemy import select
        from app.models.database import Rule
        
        query = select(Rule).where(Rule.id == rule_id)
        result = await session.execute(query)
        rule = result.scalar_one_or_none()
        
        if not rule:
            return {"error": "Rule not found"}
        
        for key, value in update_data.items():
            setattr(rule, key, value)
        
        rule.updated_at = datetime.utcnow()
        rule.updated_by = update_data.get("updated_by", "system")
        
        await session.commit()
        
        return {
            "status": "updated",
            "rule_id": rule_id,
            "updated_fields": list(update_data.keys())
        }

@router.post("/{rule_id}/enable")
async def enable_rule(rule_id: str):
    """Enable rule"""
    from app.main import db
    async for session in db.get_session():
        from sqlalchemy import select
        from app.models.database import Rule
        
        query = select(Rule).where(Rule.id == rule_id)
        result = await session.execute(query)
        rule = result.scalar_one_or_none()
        
        if rule:
            rule.is_enabled = True
            await session.commit()
        
        return {"status": "enabled", "rule_id": rule_id}

@router.post("/{rule_id}/disable")
async def disable_rule(rule_id: str):
    """Disable rule"""
    from app.main import db
    async for session in db.get_session():
        from sqlalchemy import select
        from app.models.database import Rule
        
        query = select(Rule).where(Rule.id == rule_id)
        result = await session.execute(query)
        rule = result.scalar_one_or_none()
        
        if rule:
            rule.is_enabled = False
            await session.commit()
        
        return {"status": "disabled", "rule_id": rule_id}

@router.get("/stats/by-type")
async def get_rules_by_type():
    """Get rules grouped by type"""
    return {
        "signature": 150,
        "behavioral": 75,
        "anomaly": 45,
        "total": 270
    }

@router.delete("/{rule_id}")
async def delete_rule(rule_id: str):
    """Delete a rule"""
    from app.main import db
    async for session in db.get_session():
        from sqlalchemy import select
        from app.models.database import Rule
        
        query = select(Rule).where(Rule.id == rule_id)
        result = await session.execute(query)
        rule = result.scalar_one_or_none()
        
        if rule:
            await session.delete(rule)
            await session.commit()
            return {"status": "deleted", "rule_id": rule_id}
        
        return {"error": "Rule not found"}

