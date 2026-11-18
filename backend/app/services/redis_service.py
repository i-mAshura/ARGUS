"""Redis service for caching and real-time processing"""
import redis.asyncio as redis
import asyncio
import logging
import json
import os
from urllib.parse import urlparse
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

class MockRedisClient:
    """Mock Redis client in-memory for testing/demo fallback

    Internally stores ``(value, expiry_timestamp)`` tuples so that
    ``setex`` with a TTL is honoured via wall-clock time.  Keys that lack
    an expiry (e.g. set via ``lpush``, ``incr``, or direct ``store`` manipulation)
    live forever — matching real Redis ``PERSIST`` semantics.
    """
    def __init__(self):
        self.store: dict[str, tuple] = {}

    # ── helpers ──────────────────────────────────────────────────────────
    @staticmethod
    def _now() -> float:
        return __import__("time").time()

    def _prune_immediate(self, key: str) -> None:
        """Remove *key* from the store if it has expired (no-op when not present)."""
        entry = self.store.get(key)
        if entry is None:
            return
        _value, expiry = entry
        if expiry is not None and self._now() > expiry:
            del self.store[key]

    def _prune_all(self) -> int:
        """Remove all expired keys and return the count of expired entries removed."""
        now = self._now()
        dead = [k for k, (_, exp) in self.store.items() if exp is not None and now > exp]
        for k in dead:
            del self.store[k]
        return len(dead)

    # ── public interface ─────────────────────────────────────────────────
    async def ping(self):
        self._prune_all()
        return True

    async def close(self):
        pass

    async def get(self, key):
        self._prune_immediate(key)
        entry = self.store.get(key)
        if entry is None:
            return None
        return entry[0]

    async def setex(self, key, ttl, value):
        expiry = self._now() + ttl if ttl is not None else None
        self.store[key] = (value, expiry)

    async def incr(self, key):
        self._prune_immediate(key)
        entry = self.store.get(key)
        val = entry[0] if entry else "0"
        try:
            new_val = int(val) + 1
        except Exception:
            new_val = 1
        self.store[key] = (str(new_val), None)  # no expiry
        return new_val

    async def lpush(self, key, *values):
        self._prune_immediate(key)
        entry = self.store.get(key)
        existing_list = list(entry[0]) if entry else []
        new_list = [str(v) for v in values] + existing_list
        self.store[key] = (new_list, None)  # no expiry

    async def lrange(self, key, start, end):
        self._prune_immediate(key)
        entry = self.store.get(key)
        if entry is None:
            return []
        lst = entry[0] if isinstance(entry[0], list) else []
        if end == -1:
            return lst[start:]
        return lst[start:end+1]

    async def delete(self, key):
        self._prune_immediate(key)
        if key in self.store:
            del self.store[key]

    async def exists(self, key):
        self._prune_immediate(key)
        return key in self.store

class RedisService:
    """Async Redis service"""
    
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.client = None
    
    @property
    def is_connected(self) -> bool:
        """Returns True when connected to a real Redis server, False when using the in-memory mock fallback."""
        return self.client is not None and not isinstance(self.client, MockRedisClient)

    async def connect(self):
        """Connect to Redis"""
        try:
            # Parse the Redis URL explicitly so we can pass auth credentials
            # to the constructor.  This is required for Redis 7+ where the
            # HELLO handshake must include AUTH when requirepass is set:
            #   HELLO <proto> AUTH <user> <pass>
            # from_url() does not guarantee this, triggering the auth error.
            parsed = urlparse(self.redis_url)
            host = parsed.hostname or "localhost"
            port = parsed.port or 6379
            password = parsed.password or None
            # urlparse returns empty string (not None) when URL has no user
            # but has a password:  redis://:pass@host:port  →  username=""
            # Passing username="" to redis.Redis sends AUTH "" <pass> instead
            # of AUTH <pass>, which fails against a requirepass-only Redis.
            username = parsed.username or None
            db = 0
            # Path may contain the database number  e.g. "redis://h:pass@host/1"
            path = parsed.path.strip("/") if parsed.path else ""
            if path:
                try:
                    db = int(path)
                except (ValueError, TypeError):
                    db = 0

            self.client = redis.Redis(
                host=host,
                port=port,
                password=password,
                username=username,
                db=db,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            await asyncio.wait_for(self.client.ping(), timeout=5.0)
            logger.info("✅ Redis connected successfully")
        except asyncio.TimeoutError:
            logger.warning("⚠️ Redis connection timed out after 5s. Falling back to in-memory MockRedisClient.")
            self.client = MockRedisClient()
        except Exception as e:
            logger.warning(f"⚠️ Redis connection failed ({e}). Falling back to in-memory MockRedisClient.")
            self.client = MockRedisClient()
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.client:
            await self.client.close()
            logger.info("✅ Redis disconnected")
    
    async def get(self, key: str):
        """Get value from Redis"""
        value = await self.client.get(key)
        return json.loads(value) if value else None
    
    async def set(self, key: str, value: dict, ttl: int = 3600):
        """Set value in Redis with TTL"""
        await self.client.setex(
            key,
            ttl,
            json.dumps(value)
        )
    
    async def increment(self, key: str):
        """Increment counter"""
        return await self.client.incr(key)
    
    async def lpush(self, key: str, values: list):
        """Push values to Redis list"""
        if values:
            await self.client.lpush(key, *values)
    
    async def lrange(self, key: str, start: int = 0, end: int = -1):
        """Get range from Redis list"""
        return await self.client.lrange(key, start, end)
    
    async def delete(self, key: str):
        """Delete key from Redis"""
        await self.client.delete(key)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        return bool(await self.client.exists(key))

    # ── live-stream / pub-sub ────────────────────────────────────────────
    # Per-channel subscriber queues.  Class-level so they survive reconnect.
    _live_subscribers: Dict[str, List[asyncio.Queue]] = {}

    def subscribe_live(self, channel: str) -> asyncio.Queue:
        """
        Return a per-connection ``asyncio.Queue`` that receives every message
        published to *channel* via this service.

        Works in both real-Redis and mock mode.
        """
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        self._live_subscribers.setdefault(channel, []).append(q)
        return q

    def unsubscribe_live(self, channel: str, q: asyncio.Queue) -> None:
        """Remove a previously registered subscriber queue."""
        subscribers = self._live_subscribers.get(channel, [])
        if q in subscribers:
            subscribers.remove(q)
        if not subscribers:
            self._live_subscribers.pop(channel, None)

    async def publish(self, channel: str, message: Any) -> None:
        """
        Publish a message to all local subscriber queues for *channel*.

        When connected to a real Redis server the message is also forwarded
        to the Redis ``PUBLISH`` command so other processes can receive it.
        """
        # ── Local subscriber queues (works in mock mode too) ──────────
        for q in list(self._live_subscribers.get(channel, [])):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                # Drop oldest to keep queue moving
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(message)
                except asyncio.QueueFull:
                    pass

        # ── Real Redis PUBLISH (cross-process) ────────────────────────
        if self.is_connected:
            try:
                await self.client.publish(channel, message)
            except Exception as e:
                logger.warning("Redis PUBLISH failed on %s: %s", channel, e)
