"""Response actions API endpoints"""
from fastapi import APIRouter
import uuid
from datetime import datetime



router = APIRouter()

@router.post("/create")
async def create_response(response_data: dict):
    """Create automated response action"""
    from app.main import db
    async for session in db.get_session():
        from app.models.database import Response
        
        alert_id = response_data.get("alert_id")
        hostname = response_data.get("hostname")
        
        if alert_id and alert_id.startswith("manual-dispatch-") and hostname:
            from app.models.database import Alert, AlertSeverity, AlertStatus
            from sqlalchemy import select
            
            # Check if alert already exists
            alert_query = select(Alert).where(Alert.id == alert_id)
            alert_result = await session.execute(alert_query)
            existing_alert = alert_result.scalar_one_or_none()
            
            if not existing_alert:
                dummy_alert = Alert(
                    id=alert_id,
                    title="Manual Containment Action",
                    description=f"Manual execution of {response_data.get('action_type')} on {hostname}",
                    severity=AlertSeverity.HIGH,
                    status=AlertStatus.INVESTIGATING,
                    source_event_ids=[],
                    hostname=hostname,
                    first_seen=datetime.utcnow()
                )
                session.add(dummy_alert)
        
        response = Response(
            id=str(uuid.uuid4()),
            alert_id=alert_id,
            action_type=response_data.get("action_type"),
            target=response_data.get("target"),
            status="pending",
            executed_by=response_data.get("executed_by", "system"),
            created_at=datetime.utcnow()
        )
        
        session.add(response)
        await session.commit()
        
        return {
            "status": "created",
            "response_id": response.id,
            "action_type": response.action_type
        }

@router.post("/{response_id}/execute")
async def execute_response(response_id: str):
    """Execute response action (flag as pending for agent pickup)"""
    from sqlalchemy import select
    from app.models.database import Response
    from app.main import db
    
    async for session in db.get_session():
        query = select(Response).where(Response.id == response_id)
        result = await session.execute(query)
        response = result.scalar_one_or_none()
        
        if not response:
            return {"status": "error", "message": "Response action not found"}
        
        response.status = "pending"
        response.executed_at = datetime.utcnow()
        await session.commit()
        
        return {
            "status": "pending",
            "response_id": response_id,
            "action_type": response.action_type
        }

@router.get("/{response_id}")
async def get_response(response_id: str):
    """Get response action details"""
    from sqlalchemy import select
    from app.models.database import Response
    from app.main import db
    
    async for session in db.get_session():
        query = select(Response).where(Response.id == response_id)
        result = await session.execute(query)
        response = result.scalar_one_or_none()
        
        if not response:
            return {"error": "Response not found"}
        
        return {
            "id": response.id,
            "alert_id": response.alert_id,
            "action_type": response.action_type,
            "target": response.target,
            "status": response.status,
            "created_at": response.created_at,
            "executed_at": response.executed_at
        }

@router.get("/list/by-alert/{alert_id}")
async def get_responses_for_alert(alert_id: str):
    """Get all response actions for an alert"""
    from sqlalchemy import select
    from app.models.database import Response
    from app.main import db
    
    async for session in db.get_session():
        query = select(Response).where(Response.alert_id == alert_id)
        result = await session.execute(query)
        responses = result.scalars().all()
        
        return {
            "alert_id": alert_id,
            "total": len(responses),
            "responses": [
                {
                    "id": r.id,
                    "action_type": r.action_type,
                    "target": r.target,
                    "status": r.status,
                    "created_at": r.created_at
                }
                for r in responses
            ]
        }

@router.post("/{response_id}/cancel")
async def cancel_response(response_id: str):
    """Cancel pending response"""
    from sqlalchemy import select
    from app.models.database import Response
    from app.main import db
    
    async for session in db.get_session():
        query = select(Response).where(Response.id == response_id)
        result = await session.execute(query)
        response = result.scalar_one_or_none()
        
        if response:
            response.status = "cancelled"
            await session.commit()
        
        return {"status": "cancelled", "response_id": response_id}

@router.get("/actions/available")
async def get_available_actions():
    """Get available response actions"""
    return {
        "actions": [
            {
                "id": "isolate_host",
                "name": "Isolate Host",
                "description": "Isolate endpoint from network",
                "parameters": ["hostname"]
            },
            {
                "id": "kill_process",
                "name": "Kill Process",
                "description": "Terminate process on endpoint",
                "parameters": ["hostname", "process_id"]
            },
            {
                "id": "block_hash",
                "name": "Block Hash",
                "description": "Block executable by hash",
                "parameters": ["hash_value"]
            },
            {
                "id": "block_ip",
                "name": "Block IP",
                "description": "Block outbound connection to IP",
                "parameters": ["ip_address"]
            },
            {
                "id": "disable_account",
                "name": "Disable Account",
                "description": "Disable user account",
                "parameters": ["username"]
            },
            {
                "id": "capture_memory",
                "name": "Capture Memory",
                "description": "Capture process memory dump",
                "parameters": ["hostname", "process_id"]
            },
            {
                "id": "collect_artifacts",
                "name": "Collect Artifacts",
                "description": "Collect forensic artifacts",
                "parameters": ["hostname"]
            }
        ]
    }

@router.get("/pending/{hostname}")
async def get_pending_responses(hostname: str):
    """Get all pending response actions for a host and flag them as executing"""
    from sqlalchemy import select, func
    from app.models.database import Response, Alert
    from app.main import db
    
    pending = []
    async for session in db.get_session():
        # Find responses that are pending and belong to an alert on this host
        query = (
            select(Response)
            .join(Alert, Response.alert_id == Alert.id)
            .where(Response.status == "pending")
            .where(func.lower(Alert.hostname) == hostname.lower())
        )
        result = await session.execute(query)
        responses = result.scalars().all()
        
        for r in responses:
            import hmac
            import hashlib
            msg = f"{r.action_type}:{r.target}:{r.id}"
            signature = hmac.new(b"spyderxdr_cryptographic_verification_key_2026", msg.encode(), hashlib.sha256).hexdigest()
            
            pending.append({
                "id": r.id,
                "alert_id": r.alert_id,
                "action_type": r.action_type,
                "target": r.target,
                "status": "pending",
                "signature": signature
            })
            # Mark as executing
            r.status = "executing"
            r.executed_at = datetime.utcnow()
            
        if responses:
            await session.commit()
            
    return {
        "hostname": hostname,
        "total": len(pending),
        "responses": pending
    }

@router.post("/{response_id}/result")
async def report_response_result(response_id: str, payload: dict):
    """Report result of executing a response action from agent"""
    from sqlalchemy import select
    from app.models.database import Response
    from app.main import db
    
    async for session in db.get_session():
        query = select(Response).where(Response.id == response_id)
        result = await session.execute(query)
        response = result.scalar_one_or_none()
        
        if not response:
            return {"status": "error", "message": "Response action not found"}
        
        response.status = payload.get("status", "completed")
        response.result = payload.get("result_data", {})
        response.completed_at = datetime.utcnow()
        await session.commit()
        
        return {
            "status": "updated",
            "response_id": response_id
        }
