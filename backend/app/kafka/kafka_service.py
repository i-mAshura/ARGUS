"""
Kafka Service for SpyderXDR telemetry streaming pipeline.

Handles:
  - Producing telemetry events from the ingest endpoint into Kafka topics
  - Consuming events from Kafka and forwarding to the detection engine
  - Providing live event streaming to WebSocket clients via Redis pub/sub
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

# ── Batch sizing for Elasticsearch bulk indexing ───────────────────────
# Flush to ES after collecting this many documents.
ES_BATCH_SIZE = 100

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Topic names – centralised so nothing is hardcoded elsewhere
# ---------------------------------------------------------------------------
TOPIC_TELEMETRY   = "spyderxdr.telemetry"        # raw inbound events
TOPIC_ALERTS      = "spyderxdr.alerts"            # generated alerts
TOPIC_PROCESSED   = "spyderxdr.processed"         # events after detection
TOPIC_HEARTBEAT   = "spyderxdr.heartbeat"         # agent heartbeats

# All topics that should exist at startup
ALL_TOPICS = [TOPIC_TELEMETRY, TOPIC_ALERTS, TOPIC_PROCESSED, TOPIC_HEARTBEAT]


# ---------------------------------------------------------------------------
# Kafka availability probe
# ---------------------------------------------------------------------------
def _kafka_available() -> bool:
    try:
        from aiokafka import AIOKafkaProducer  # noqa: F401
        return True
    except ImportError:
        return False


# ---------------------------------------------------------------------------
# Mock in-memory broker is intentionally disabled for real-data-only mode.
# ---------------------------------------------------------------------------
_live_subscribers: Dict[str, List[asyncio.Queue]] = {}


# ---------------------------------------------------------------------------
# KafkaService
# ---------------------------------------------------------------------------
class KafkaService:
    """
    Unified async Kafka service.

    Usage:
        kafka = KafkaService()
        await kafka.start()
        await kafka.produce_event(TOPIC_TELEMETRY, {"event_type": "..."})
        await kafka.stop()
    """

    BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

    def __init__(self, elastic_service=None):
        self._use_real_kafka = _kafka_available()
        if not self._use_real_kafka:
            logger.error("❌ aiokafka is not available; Kafka mock fallback is disabled.")
        self._producer = None
        self._consumer_tasks: List[asyncio.Task] = []
        self._running = False
        self._handlers: Dict[str, List] = {}
        self._ws_forwarder_started: Dict[str, bool] = {}
        self.elastic_service = elastic_service
        logger.info(
            "KafkaService: using %s backend%s",
            "aiokafka" if self._use_real_kafka else "in-memory mock",
            " (Elasticsearch indexing enabled)" if self.elastic_service else "",
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def start(self):
        """Start the real Kafka producer only. Falls back to degraded mode if unavailable."""
        self._running = True
        if not self._use_real_kafka:
            logger.warning(
                "⚠️ aiokafka not installed — Kafka disabled. Telemetry will bypass Kafka pipeline."
            )
            self._producer = None
            return

        try:
            await self._start_real()
            logger.info("✅ KafkaService started with real Kafka broker")
        except Exception as e:
            logger.warning(
                "⚠️ Kafka broker not available at %s (%s). Running in degraded mode — "
                "telemetry will bypass Kafka pipeline.",
                self.BOOTSTRAP_SERVERS, e,
            )
            self._producer = None
            self._use_real_kafka = False

    async def _start_real(self):
        from aiokafka import AIOKafkaProducer
        from aiokafka.admin import AIOKafkaAdminClient, NewTopic
        from aiokafka.errors import TopicAlreadyExistsError

        # Create topics if they don't exist
        try:
            admin = AIOKafkaAdminClient(
                bootstrap_servers=self.BOOTSTRAP_SERVERS,
                request_timeout_ms=5000,
            )
            await admin.start()
            new_topics = [
                NewTopic(name=t, num_partitions=3, replication_factor=1)
                for t in ALL_TOPICS
            ]
            try:
                await admin.create_topics(new_topics)
                logger.info("Kafka topics created: %s", ALL_TOPICS)
            except TopicAlreadyExistsError:
                pass
            finally:
                await admin.close()
        except Exception as e:
            logger.warning("Could not create Kafka topics: %s", e)

        # Start producer
        self._producer = AIOKafkaProducer(
            bootstrap_servers=self.BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            compression_type="gzip",
            max_batch_size=65536,
            linger_ms=5,
            request_timeout_ms=5000,
        )
        await self._producer.start()

    async def stop(self):
        """Graceful shutdown."""
        self._running = False
        for task in self._consumer_tasks:
            task.cancel()
        if self._producer:
            await self._producer.stop()
        logger.info("KafkaService stopped")

    # ------------------------------------------------------------------
    # Producer helpers
    # ------------------------------------------------------------------
    async def produce_event(self, topic: str, payload: Dict[str, Any], key: Optional[str] = None):
        """Send a single JSON message to a Kafka topic using the real broker only."""
        try:
            if not self._use_real_kafka or self._producer is None:
                raise RuntimeError("Real Kafka producer is unavailable")
            await self._producer.send_and_wait(topic, value=payload, key=key)
        except Exception as e:
            logger.error("Kafka produce error on topic %s: %s", topic, e)
            raise

    async def produce_batch(self, topic: str, payloads: List[Dict[str, Any]]):
        """Send multiple messages efficiently."""
        for payload in payloads:
            await self.produce_event(topic, payload)

    # ------------------------------------------------------------------
    # Consumer helpers
    # ------------------------------------------------------------------
    def register_handler(self, topic: str, handler):
        """Register an async callback for messages on *topic*."""
        self._handlers.setdefault(topic, []).append(handler)

    async def start_consuming(self, topics: Optional[List[str]] = None):
        """Start background consumer tasks for the given topics."""
        targets = topics or list(self._handlers.keys())
        for topic in targets:
            task = asyncio.create_task(self._consume_loop(topic))
            self._consumer_tasks.append(task)
            logger.info("Started consumer for topic: %s", topic)

    async def _consume_loop(self, topic: str):
        if not self._use_real_kafka:
            raise RuntimeError("Real Kafka consumer is unavailable")
        await self._consume_real(topic)

    async def _flush_es_buffer(self, es_buffer: List[Dict[str, Any]]) -> None:
        """Flush the ES buffer — swallows exceptions so the caller is never interrupted."""
        if not es_buffer:
            return
        try:
            batch = list(es_buffer)
            es_buffer.clear()
            await self.elastic_service.bulk_index(batch)
        except Exception as es_err:
            logger.error("ES bulk index failed for batch of %d docs: %s", len(batch), es_err)

    async def _consume_real(self, topic: str):
        from aiokafka import AIOKafkaConsumer

        def _safe_deserializer(v):
            """Safe JSON deserializer — return None instead of crashing on bad messages."""
            try:
                return json.loads(v.decode("utf-8"))
            except Exception:
                return None

        consumer = AIOKafkaConsumer(
            topic,
            bootstrap_servers=self.BOOTSTRAP_SERVERS,
            group_id="spyderxdr-backend",
            auto_offset_reset="latest",
            value_deserializer=_safe_deserializer,
        )
        await consumer.start()
        logger.info("Kafka consumer started on topic: %s (Elasticsearch bulk write path)", topic)

        # Accumulation buffer for batch ES indexing
        es_buffer: List[Dict[str, Any]] = []

        # Periodic flush timer — guarantees documents don't sit in the buffer
        # indefinitely during low-traffic periods.
        ES_FLUSH_INTERVAL = 5.0  # seconds

        async def _periodic_flush():
            while self._running:
                await asyncio.sleep(ES_FLUSH_INTERVAL)
                if es_buffer:
                    await self._flush_es_buffer(es_buffer)

        flush_task = asyncio.create_task(_periodic_flush())

        try:
            async for msg in consumer:
                if not self._running:
                    break

                payload = msg.value

                # Skip malformed messages (safe deserializer returned None)
                if payload is None:
                    continue

                # ── 1. Buffer into batch for Elasticsearch bulk indexing ────
                if self.elastic_service is not None and isinstance(payload, dict):
                    norm = self._normalize_for_es(payload)
                    es_buffer.append(norm)

                    if len(es_buffer) >= ES_BATCH_SIZE:
                        await self._flush_es_buffer(es_buffer)

                # ── 2. Keep existing alerting / live-stream handlers ────────
                await self._dispatch(topic, payload)

        except asyncio.CancelledError:
            pass
        except Exception as loop_err:
            logger.error("Kafka consumer loop crashed: %s", loop_err)
        finally:
            flush_task.cancel()
            try:
                await flush_task
            except asyncio.CancelledError:
                pass
            # Flush any remaining buffered documents
            if self.elastic_service is not None and es_buffer:
                logger.info("Flushing final ES batch of %d documents", len(es_buffer))
                try:
                    await self.elastic_service.bulk_index(es_buffer)
                except Exception as es_err:
                    logger.error("ES final bulk index flush failed: %s", es_err)
            await consumer.stop()

    @staticmethod
    def _normalize_for_es(payload: dict) -> dict:
        """Flatten a Kafka event payload into a document suitable for ES indexing."""
        import uuid
        from datetime import datetime

        def _ip(val):
            """Coerce an IP value; return None for empty/missing."""
            if not val:
                return None
            s = str(val).strip()
            return s if s else None

        doc = {
            "timestamp":      str(payload.get("timestamp") or datetime.utcnow().isoformat()),
            "hostname":       str(payload.get("hostname") or "localhost"),
            "event_type":     str(payload.get("event_type") or "kafka_event"),
            "agent_id":       str(payload.get("agent_id") or "kafka-consumer"),
            "status":         str(payload.get("status") or "new"),
            "event_data":     payload.get("event_data") or payload,
        }
        # Only include IP fields when they hold a valid value
        src_ip = _ip(payload.get("source_ip"))
        if src_ip:
            doc["source_ip"] = src_ip
        dst_ip = _ip(payload.get("destination_ip"))
        if dst_ip:
            doc["destination_ip"] = dst_ip

        # Preserve original id if present
        eid = payload.get("id")
        if eid:
            doc["id"] = str(eid)
        return doc


    async def _dispatch(self, topic: str, payload: Dict[str, Any]):
        for handler in self._handlers.get(topic, []):
            try:
                await handler(payload)
            except Exception as e:
                logger.error("Handler error on topic %s: %s", topic, e)

    # ------------------------------------------------------------------
    # Live-stream helpers for WebSocket consumers
    # ------------------------------------------------------------------
    def subscribe_live(self, topic: str) -> asyncio.Queue:
        """Return a per-connection queue backed by the real Kafka broker only."""
        if not self._use_real_kafka:
            raise RuntimeError("Real Kafka live stream is unavailable")
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        _live_subscribers.setdefault(topic, []).append(q)
        if not self._ws_forwarder_started.get(topic, False):
            self._ws_forwarder_started[topic] = True
            asyncio.create_task(self._real_kafka_to_mock(topic))
            logger.info("Started real Kafka→WS forwarder for topic: %s", topic)
        return q

    def unsubscribe_live(self, topic: str, q: asyncio.Queue):
        subscribers = _live_subscribers.get(topic, [])
        if q in subscribers:
            subscribers.remove(q)
        if not subscribers:
            _live_subscribers.pop(topic, None)

    async def _real_kafka_to_mock(self, topic: str):
        """Reads from real Kafka and pushes into mock broker queues for WebSocket delivery."""
        from aiokafka import AIOKafkaConsumer
        consumer = AIOKafkaConsumer(
            topic,
            bootstrap_servers=self.BOOTSTRAP_SERVERS,
            group_id=f"spyderxdr-ws-{topic}",
            auto_offset_reset="latest",
            value_deserializer=lambda v: v,
        )
        try:
            await consumer.start()
            logger.info("Real Kafka WS consumer started for topic: %s", topic)
            async for msg in consumer:
                if not self._running:
                    break
                for q in list(_live_subscribers.get(topic, [])):
                    try:
                        q.put_nowait(msg.value)
                    except asyncio.QueueFull:
                        try:
                            q.get_nowait()
                        except asyncio.QueueEmpty:
                            pass
                        try:
                            q.put_nowait(msg.value)
                        except Exception:
                            pass
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Real Kafka WS consumer error on %s: %s", topic, e)
        finally:
            try:
                await consumer.stop()
            except Exception:
                pass
            self._ws_forwarder_started[topic] = False