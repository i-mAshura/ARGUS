import pytest
import os
import asyncio
from httpx import AsyncClient

# Set environment variables for testing before importing the app
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:9999"  # Force connection failure to trigger mock Redis fallback
os.environ["TELEGRAM_BOT_TOKEN"] = "12345:mock_token"
os.environ["TELEGRAM_CHAT_ID"] = "12345"

from app.main import app, db, redis_service, detection_engine
from app.services.database import Database
from app.services.redis_service import RedisService

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session", autouse=True)
async def setup_services():
    """Initialize SQLite and Mock Redis service"""
    # Connect database (which creates tables in :memory:)
    await db.connect()
    # Connect redis (which triggers mock redis fallback)
    await redis_service.connect()
    # Start detection engine
    await detection_engine.start()
    
    yield
    
    # Stop services
    await detection_engine.stop()
    await redis_service.disconnect()
    await db.disconnect()

@pytest.fixture
async def db_session():
    """Provide a database session wrapper with a clean test database."""
    async for session in db.get_session():
        from sqlalchemy import delete
        from app.models.database import Agent, Event, Alert

        await session.execute(delete(Alert))
        await session.execute(delete(Event))
        await session.execute(delete(Agent))
        await session.commit()
        yield session

@pytest.fixture
def mock_redis():
    """Expose the mock redis client instance"""
    return redis_service.client
