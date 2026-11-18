"""
Comprehensive diagnostic script for SpyderXDR system health check
Verifies: Database, Redis, Kafka, WebSocket, and data flow
"""

import asyncio
import json
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

async def check_database():
    """Check SQLite database connection"""
    print("\n🔍 Checking Database Connection...")
    try:
        from app.services.database import Database
        db = Database()
        await db.connect()
        
        # Test query
        async for session in db.get_session():
            from sqlalchemy import text
            result = await session.execute(text("SELECT 1"))
            print("✅ Database: SQLite connected and operational")
            return True
    except Exception as e:
        print(f"❌ Database Error: {e}")
        return False

async def check_redis():
    """Check Redis connection"""
    print("\n🔍 Checking Redis Connection...")
    try:
        from app.services.redis_service import RedisService
        redis_svc = RedisService()
        await redis_svc.connect()
        
        # Test ping
        await redis_svc.client.ping()
        print("✅ Redis: Connected and operational")
        return True
    except Exception as e:
        print(f"❌ Redis Error: {e}")
        return False

async def check_kafka():
    """Check Kafka / Mock Broker"""
    print("\n🔍 Checking Kafka Service...")
    try:
        from app.kafka.kafka_service import KafkaService, _kafka_available
        
        if _kafka_available():
            print("✅ Kafka: aiokafka library available")
        else:
            print("⚠️  Kafka: Using in-memory mock broker (aiokafka not installed)")
        
        kafka = KafkaService()
        await kafka.start()
        print("✅ Kafka Service: Initialized and running")
        return True
    except Exception as e:
        print(f"❌ Kafka Error: {e}")
        return False

async def check_websocket():
    """Check WebSocket endpoint availability"""
    print("\n🔍 Checking WebSocket Endpoint...")
    try:
        # Try to connect to the WebSocket endpoint
        import websockets
        import asyncio
        ws_url = "ws://localhost:8000/api/v1/stream/telemetry"
        
        try:
            async with asyncio.timeout(5):
                async with websockets.connect(ws_url) as ws:
                    print("✅ WebSocket: Endpoint accessible and listening")
                    
                    # Send ping to check connection
                    await ws.send("ping")
                    print("✅ WebSocket: Ping sent successfully")
                    return True
        except asyncio.TimeoutError:
            print(f"⚠️  WebSocket: Connection timeout (API may not be running)")
            return False
        except Exception as e:
            print(f"⚠️  WebSocket: Could not connect ({type(e).__name__})")
            print("   Note: This may be normal if the API server isn't running")
            return False
    except Exception as e:
        print(f"❌ WebSocket Error: {e}")
        return False

async def check_data_ingestion():
    """Check if telemetry events can be ingested"""
    print("\n🔍 Checking Data Ingestion Pipeline...")
    try:
        from app.services.database import Database
        from app.kafka.kafka_service import KafkaService
        import uuid
        
        db = Database()
        await db.connect()
        
        # Create a test event
        test_event = {
            "id": str(uuid.uuid4()),
            "timestamp": "2026-06-09T12:00:00.000Z",
            "source_ip": "127.0.0.1",
            "destination_ip": "0.0.0.0",
            "hostname": "TEST-HOST",
            "agent_id": "test-agent-001",
            "event_type": "process_creation",
            "event_data": {
                "image": "test.exe",
                "command_line": "test.exe --diagnostic"
            }
        }
        
        # Try to ingest
        async with db.async_session() as session:
            event = await db.create_event(session, test_event)
            print(f"✅ Event Ingestion: Test event created (ID: {event.id[:8]}...)")
            
            # Check Kafka
            kafka = KafkaService()
            await kafka.start()
            await kafka.produce(
                "spyderxdr.telemetry",
                json.dumps(test_event).encode()
            )
            print("✅ Kafka Producer: Test event published to topic")
            return True
    except Exception as e:
        print(f"❌ Data Ingestion Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def check_agent_telemetry():
    """Check if agent is sending telemetry"""
    print("\n🔍 Checking Agent Telemetry Status...")
    try:
        from app.services.database import Database
        
        db = Database()
        await db.connect()
        
        async with db.async_session() as session:
            # Count recent events
            from sqlalchemy import func, text
            result = await session.execute(
                text("SELECT COUNT(*) as count FROM events WHERE event_type='process_creation'")
            )
            count = result.scalar() or 0
            
            if count > 0:
                print(f"✅ Agent Telemetry: {count} events detected in database")
                
                # Check for performance metrics
                result = await session.execute(
                    text("SELECT COUNT(*) as count FROM events WHERE event_type='performance_metric'")
                )
                perf_count = result.scalar() or 0
                
                if perf_count > 0:
                    print(f"✅ Performance Metrics: {perf_count} CPU/RAM events detected")
                else:
                    print("⚠️  Performance Metrics: No CPU/RAM data yet (restart agent with updated code)")
                
                return True
            else:
                print("⚠️  Agent Telemetry: No events detected yet (agent may not be running)")
                return False
    except Exception as e:
        print(f"❌ Agent Check Error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def run_diagnostics():
    """Run all diagnostics"""
    print("\n" + "="*60)
    print("   SpyderXDR SYSTEM DIAGNOSTICS")
    print("="*60)
    
    results = {
        "database": await check_database(),
        "redis": await check_redis(),
        "kafka": await check_kafka(),
        "websocket": await check_websocket(),
        "ingestion": await check_data_ingestion(),
        "agent_telemetry": await check_agent_telemetry(),
    }
    
    print("\n" + "="*60)
    print("DIAGNOSTIC SUMMARY")
    print("="*60)
    
    for service, status in results.items():
        status_icon = "✅" if status else "❌"
        print(f"{status_icon} {service.upper()}: {'OK' if status else 'FAILED'}")
    
    all_ok = all(results.values())
    print("\n" + "="*60)
    if all_ok:
        print("🎉 ALL SYSTEMS OPERATIONAL")
    else:
        print("⚠️  SOME SYSTEMS NEED ATTENTION")
    print("="*60 + "\n")
    
    return results

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
