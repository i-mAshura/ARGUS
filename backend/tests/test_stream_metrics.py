import asyncio
import sys
import types

import pytest

from app.api.v1.endpoints_events import _process_single_event
from app.api.v1.endpoints_stream import _merge_metrics_payload


@pytest.mark.asyncio
async def test_merge_metrics_payload_keeps_last_known_good_memory():
    last_good = {
        "event_type": "performance_metric",
        "event_data": {
            "metric_type": "system_resources",
            "cpu_usage_percent": 42,
            "memory_usage_percent": 81,
            "network": [{"remote_address": "10.0.0.3"}],
            "processes": [{"pid": 123}],
        },
    }

    incoming = {
        "event_type": "performance_metric",
        "event_data": {
            "metric_type": "system_resources",
            "cpu_usage_percent": 0,
            "memory_usage_percent": 0,
            "network": [],
            "processes": [],
        },
    }

    merged = await _merge_metrics_payload(incoming, last_good)

    assert merged["event_data"]["memory_usage_percent"] == 81
    assert merged["event_data"]["cpu_usage_percent"] == 42
    assert merged["event_data"]["network"] == [{"remote_address": "10.0.0.3"}]
    assert merged["event_data"]["processes"] == [{"pid": 123}]


@pytest.mark.asyncio
async def test_merge_metrics_payload_keeps_valid_nonzero_values():
    last_good = {
        "event_type": "performance_metric",
        "event_data": {
            "metric_type": "system_resources",
            "memory_usage_percent": 73,
        },
    }

    incoming = {
        "event_type": "demo_metric",
        "event_data": {
            "metric_type": "system_resources",
            "memory_usage_percent": 0,
        },
    }

    merged = await _merge_metrics_payload(incoming, last_good)

    assert merged["event_data"]["memory_usage_percent"] == 73


@pytest.mark.asyncio
async def test_process_single_event_skips_siem_persistence_for_cpu_ram_performance(monkeypatch):
    called = {"create": 0, "detect": 0, "publish": 0}

    class DummyDB:
        async def create_event(self, session, event_data):
            called["create"] += 1
            raise AssertionError("cpu_ram_performance should not be persisted to SIEM DB")

    class DummyDetectionEngine:
        async def process_event(self, session, event):
            called["detect"] += 1

    class DummyKafkaService:
        async def produce_event(self, topic, payload):
            called["publish"] += 1
            assert topic == "spyderxdr.telemetry"
            assert payload["event_type"] == "cpu_ram_performance"

    fake_app_main = types.SimpleNamespace(kafka_service=DummyKafkaService())
    monkeypatch.setitem(sys.modules, "app.main", fake_app_main)

    session = object()
    event = {
        "id": "evt-1",
        "timestamp": "2026-06-11T00:00:00",
        "hostname": "demo-host",
        "agent_id": "demo-agent",
        "event_type": "cpu_ram_performance",
        "source_ip": "127.0.0.1",
        "destination_ip": "",
        "event_data": {"cpu_percent": 42, "ram_percent": 81},
    }

    created = await _process_single_event(session, DummyDB(), DummyDetectionEngine(), event)

    assert created == "evt-1"
    assert called["create"] == 0
    assert called["detect"] == 0
    assert called["publish"] == 1
