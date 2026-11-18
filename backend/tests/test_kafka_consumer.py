import pytest

from app.models.database import Agent
import kafka_consumer


class FakeDetectionEngine:
    """Mock detection engine that accepts the async call but returns no alerts."""

    async def process_event(self, session, event):
        return []


class FakeSession:
    def __init__(self):
        self.added = []
        self.query_result = []

    async def commit(self):
        return None

    def add(self, item):
        self.added.append(item)

    async def execute(self, query):
        class Result:
            def __init__(self, items):
                self._items = items

            def scalars(self):
                return self

            def all(self):
                return list(self._items)

        return Result(self.query_result)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeDB:
    def __init__(self):
        self.session = FakeSession()
        self.async_session = self

    def __call__(self):
        return self

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_process_message_upserts_agent_record():
    """Verify _process_kafka_message updates agent tracking without writing raw Event rows."""
    db = FakeDB()
    detection_engine = FakeDetectionEngine()

    await kafka_consumer._process_kafka_message(db, {
        "id": "evt-1",
        "timestamp": "2026-06-12T18:00:00",
        "hostname": "WinHost",
        "agent_id": "agent-1",
        "event_type": "winevent",
        "source_ip": "10.0.0.5",
        "event_data": {"channel": "Application"},
    }, detection_engine)

    # Agent record must be upserted with correct tracking — no Event row should be added
    agent_added = next(item for item in db.session.added if isinstance(item, Agent))
    assert agent_added.hostname == "WinHost"
    assert agent_added.events_processed == 1
    assert agent_added.status == "active"
    assert agent_added.last_checkin is not None

    # Confirm no Event instances in the added items
    assert not any(type(item).__name__ == "Event" for item in db.session.added)
