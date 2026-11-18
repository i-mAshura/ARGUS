# SpyderXDR – Kafka + Fluentd + Live Streaming Integration Guide

> **For new developers joining the project.**  
> This document explains what was added, why, and how to run everything.

---

## What is SpyderXDR?

SpyderXDR (also called ARGUS internally) is a self-hosted **Extended Detection & Response (XDR)** platform.  
It has:

| Layer | Technology |
|---|---|
| Agent (endpoint collector) | Python (Linux + Windows) |
| Backend API | FastAPI (Python, async) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Cache / session | Redis |
| Frontend | React + Vite + MUI |

---

## What Was Added

### 1. Kafka Streaming Pipeline

```
Agent → Fluentd → FastAPI /ingest → Kafka topic → WebSocket → Browser
```

Every time a telemetry event is ingested (`POST /api/v1/events/ingest`) it is:
1. Saved to the database (unchanged – existing behaviour).
2. Processed through the detection engine (unchanged).
3. **NEW**: Published to the Kafka topic `spyderxdr.telemetry`.

When the detection engine generates an alert it is:
1. Saved to the database (unchanged).
2. Cached in Redis (unchanged).
3. **NEW**: Published to the Kafka topic `spyderxdr.alerts`.

### 2. Fluentd Telemetry Agent

The original `agents/linux/agent.py` still works.  
The new `agents/linux/telemetry_agent.py` does the same collection but **posts to Fluentd first** (port 9880) which then:
- Buffers data in Redis (so nothing is lost if the backend is briefly down).
- Forwards to FastAPI `/ingest`.
- Forwards to Kafka.

Falls back to posting directly to FastAPI if Fluentd is unavailable.

### 3. WebSocket Live Stream

New endpoint: `ws://localhost:8000/api/v1/stream/telemetry`

The frontend connects once and receives events and alerts in real time — no polling, no browser refresh.

### 4. LiveFeed React Component

`frontend/src/components/LiveFeed.jsx` – a real-time scrolling feed panel.  
`frontend/src/hooks/useLiveTelemetry.js` – the WebSocket hook (auto-reconnect, backoff).

The `Overview` page now includes a LiveFeed panel at the bottom.

---

## Directory Layout (new files only)

```
SpyderXDR/
├── start.sh                            ← one-command startup script
├── fluentd/
│   └── spyderxdr.conf                  ← Fluentd config
├── agents/linux/
│   └── telemetry_agent.py              ← NEW agent (Fluentd-aware)
├── backend/app/
│   ├── kafka/
│   │   ├── __init__.py
│   │   └── kafka_service.py            ← KafkaService (real + mock)
│   ├── api/v1/
│   │   └── endpoints_stream.py         ← WebSocket /stream/telemetry
│   └── main.py                         ← updated (adds kafka_service)
└── frontend/src/
    ├── hooks/
    │   └── useLiveTelemetry.js         ← WebSocket React hook
    └── components/
        └── LiveFeed.jsx                ← live feed panel
```

---

## Running Everything

### Prerequisites

```bash
# Redis (WSL)
sudo service redis-server start
# OR
redis-server &

# Fluentd (optional – system falls back gracefully without it)
gem install fluentd
gem install fluent-plugin-kafka        # only if you have Kafka running

# Kafka (optional – system uses in-memory mock without it)
# Download from https://kafka.apache.org/downloads
# Then: bin/zookeeper-server-start.sh config/zookeeper.properties &
#       bin/kafka-server-start.sh config/server.properties &

# Node.js 18+  (for frontend)
# Python 3.10+ (for backend)
```

### One-Command Start

```bash
./start.sh
```

This starts (in order): Redis check → Fluentd → FastAPI backend → telemetry agent → React dev server.

### Manual Start (if you prefer separate terminals)

**Terminal 1 – Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 – Fluentd** (optional)
```bash
fluentd -c fluentd/spyderxdr.conf
```

**Terminal 3 – Telemetry Agent**
```bash
python agents/linux/telemetry_agent.py
# OR use the original agent (still works):
# python agents/linux/agent.py
```

**Terminal 4 – Frontend**
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

---

## URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Live WebSocket | ws://localhost:8000/api/v1/stream/telemetry |
| Fluentd HTTP input | http://localhost:9880 |

---

## How the Live Stream Works (step by step)

```
1. Agent collects telemetry (every 30s)
2. Agent POSTs JSON batch to Fluentd :9880
3. Fluentd buffers in Redis, then POSTs to FastAPI /ingest
4. FastAPI saves event to DB, runs detection engine
5. KafkaService.produce_event() publishes to spyderxdr.telemetry
6. If alert generated → published to spyderxdr.alerts
7. endpoints_stream.py bridge task reads from Kafka queues
8. bridge broadcasts JSON to all connected WebSocket clients
9. useLiveTelemetry hook in React receives messages
10. LiveFeed component renders rows in real time
```

When **Kafka is not installed**, the `KafkaService` transparently uses an in-memory mock broker — all the above still works, just within one Python process.

---

## Adding Kafka Topics

Topics are defined in `backend/app/kafka/kafka_service.py`:

```python
TOPIC_TELEMETRY = "spyderxdr.telemetry"
TOPIC_ALERTS    = "spyderxdr.alerts"
TOPIC_PROCESSED = "spyderxdr.processed"
TOPIC_HEARTBEAT = "spyderxdr.heartbeat"
```

To add a new topic:
1. Add the constant here.
2. Produce to it with `await kafka_service.produce_event(YOUR_TOPIC, payload)`.
3. To consume it in the frontend, add a handler in `endpoints_stream.py`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker(s) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `FLUENTD_URL` | `http://localhost:9880` | Fluentd HTTP input (agent) |
| `SPYDERXDR_SERVER` | `http://localhost:8000` | FastAPI URL (agent fallback) |
| `COLLECTION_INTERVAL` | `30` | Agent collection interval (seconds) |

Create a `.env` file in `backend/` to override any of these.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| LiveFeed shows "Reconnecting…" | Backend not running or WebSocket blocked. Check `uvicorn` logs. |
| "Kafka not available" warning | Normal if Kafka not installed – mock broker is used automatically. |
| Fluentd buffer errors | Ensure Redis is running before starting Fluentd. |
| 401 on `/ingest` | HMAC mismatch – check `AGENT_KEY` in agent vs backend `endpoints_events.py`. |
| Frontend blank page | Run `npm install --legacy-peer-deps` in `frontend/`. |
