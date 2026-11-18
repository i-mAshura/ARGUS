"""Simple mock metrics producer for real-time WebSocket testing.

This writes demo CPU/RAM telemetry into the same Kafka topic consumed by the
WebSocket bridge in app.api.v1.endpoints_stream.
"""

import asyncio
import json
import random
import sys
import uuid
from datetime import datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.kafka.kafka_service import KafkaService, TOPIC_TELEMETRY


async def main() -> None:
    kafka_service = KafkaService()
    await kafka_service.start()

    try:
        cpu = 35
        ram = 45
        while True:
            cpu = min(98, max(10, cpu + random.randint(-8, 8)))
            ram = min(98, max(20, ram + random.randint(-6, 6)))

            payload = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat(),
                "hostname": "demo-host",
                "agent_id": "demo-agent",
                "event_type": "cpu_ram_performance",
                "source_ip": "127.0.0.1",
                "destination_ip": "",
                "event_data": {
                    "metric_type": "system_resources",
                    "cpu_percent": cpu,
                    "ram_percent": ram,
                    "total_ram_mb": 16384,
                    "free_ram_mb": max(256, 16384 - int(ram * 16384 / 100)),
                },
            }
            await kafka_service.produce_event(TOPIC_TELEMETRY, payload)
            print(f"[metrics_producer] published to {TOPIC_TELEMETRY}: {json.dumps(payload, separators=(',', ':'))}")
            await asyncio.sleep(2)
    finally:
        await kafka_service.stop()


if __name__ == "__main__":
    asyncio.run(main())
