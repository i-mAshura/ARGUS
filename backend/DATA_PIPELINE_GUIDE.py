"""
╔════════════════════════════════════════════════════════════════════════════════╗
║         SPYDERXDR DATA PIPELINE & ARCHITECTURE EXPLANATION                      ║
╚════════════════════════════════════════════════════════════════════════════════╝

█ DATA FLOW OVERVIEW
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            COMPLETE DATA PIPELINE                               │
└─────────────────────────────────────────────────────────────────────────────────┘

1. DATA COLLECTION (Windows Agent)
   ──────────────────────────────
   
   Agent Location: C:\Users\Vishaal\Desktop\SpyderXDR-updated\agents\windows\agent.py
   
   Agent collects:
   ✅ Process Events      → collect_process_events()
   ✅ Network Events      → collect_network_events()
   ✅ File Events         → collect_file_events()
   ✅ Registry Events     → collect_registry_events()
   ✅ SCA Events          → collect_sca_events()
   ✅ Performance Metrics → collect_performance_metrics()  [CPU/RAM]
   
   Collection Interval: Every 10 seconds
   
   Code Flow:
   ┌──────────────────────────────────┐
   │ start_collection()                │
   │ (infinite loop every 10s)         │
   │                                   │
   │ 1. collect_all_telemetry()        │
   │    ↓ collect_performance_metrics()│
   │    ↓ collect_process_events()     │
   │    ↓ collect_network_events()     │
   │    ↓ collect_file_events()        │
   │    ↓ collect_registry_events()    │
   │    ↓ collect_sca_events()         │
   │                                   │
   │ 2. send_telemetry(events)         │
   │    ↓ POST → Backend API           │
   │                                   │
   │ 3. poll_and_execute_response_     │
   │    actions()                      │
   └──────────────────────────────────┘


2. DATA TRANSMISSION (Agent → Backend API)
   ──────────────────────────────────────
   
   Protocol: HTTPS POST with HMAC-SHA256 signature
   Endpoint: http://localhost:8000/api/v1/events/ingest
   
   Headers:
   ├─ Content-Type: application/json
   └─ X-Argus-Signature: <HMAC-SHA256 hash>
   
   Payload Structure:
   {
     "hostname": "VISHAALSENVY",
     "agent_id": "88880ce7-c133-4898-9331-43d874e6a6ef",
     "events": [
       {
         "timestamp": "2026-06-09T12:00:00.000Z",
         "source_ip": "127.0.0.1",
         "hostname": "VISHAALSENVY",
         "agent_id": "88880ce7-c133-4898-9331-43d874e6a6ef",
         "event_type": "performance_metric",
         "event_data": {
           "metric_type": "system_resources",
           "cpu_usage_percent": 85,          ← CPU %
           "memory_usage_percent": 100,      ← RAM %
           "total_memory_gb": 16,
           "free_memory_mb": 2,
           "timestamp_ms": 1780987584583
         }
       }
     ]
   }


3. BACKEND API PROCESSING
   ──────────────────────
   
   Endpoint: /api/v1/events/ingest
   Handler: endpoints_events.py::ingest_events()
   
   Processing Steps:
   ├─ 1. HMAC Signature Verification (Security)
   │     └─ Verifies request comes from authorized agent
   │
   ├─ 2. Database Storage
   │     ├─ Write to SQLite database
   │     ├─ Table: events
   │     └─ Fields: id, timestamp, hostname, event_type, event_data, status, etc.
   │
   ├─ 3. Kafka Publishing  
   │     ├─ Topic: spyderxdr.telemetry
   │     ├─ Message: JSON event
   │     └─ Purpose: Real-time streaming
   │
   ├─ 4. Detection Engine Processing
   │     ├─ Analyze anomalies
   │     ├─ Check signatures
   │     ├─ Apply ML models
   │     └─ Generate alerts if needed
   │
   └─ 5. Response
        └─ HTTP 200 OK


4. KAFKA IMPLEMENTATION (Message Broker)
   ──────────────────────────────────────
   
   Location: backend/app/kafka/kafka_service.py
   
   Kafka Topics:
   ├─ spyderxdr.telemetry     ← Raw agent telemetry events
   ├─ spyderxdr.alerts        ← Generated security alerts  
   ├─ spyderxdr.processed     ← Events after detection
   └─ spyderxdr.heartbeat     ← Agent health heartbeats
   
   Implementation Strategy:
   ┌──────────────────────────────────────────────────────┐
   │ REAL KAFKA (if aiokafka available)                   │
   │ ├─ Connects to Kafka broker @ localhost:9092         │
   │ ├─ Real persistence & distribution                   │
   │ └─ Fault tolerance                                   │
   │                                                      │
   │ vs                                                   │
   │                                                      │
   │ MOCK IN-MEMORY BROKER (fallback if aiokafka missing) │
   │ ├─ _MockBroker class                                 │
   │ ├─ Async queues instead of real Kafka               │
   │ ├─ Same API interface                                │
   │ └─ Used when real Kafka unavailable                  │
   └──────────────────────────────────────────────────────┘
   
   Current Status: ⚠️ USING IN-MEMORY MOCK (aiokafka not installed)
   
   Kafka Data Flow:
   agent.send_telemetry()
      ↓
   Backend POST /api/v1/events/ingest
      ↓
   kafka_service.produce("spyderxdr.telemetry", event)
      ↓
   MockBroker or Real Kafka
      ↓
   WebSocket subscribers receive update
      ↓
   Frontend updates dashboard (real-time)


5. FLUENTD INTEGRATION
   ──────────────────
   
   Location: fluentd/spyderxdr.conf
   Purpose: Log aggregation & routing (Alternative ingestion path)
   
   Configuration:
   ┌──────────────────────────────────┐
   │ <source>                          │
   │   @type http                      │ ← HTTP input plugin
   │   port 9880                       │ ← Listen on port 9880
   │   bind 0.0.0.0                    │ ← Accept from anywhere
   │   tag spyderxdr.telemetry         │ ← Tag incoming data
   │   <parse>                         │
   │     @type json                    │ ← Parse as JSON
   │   </parse>                        │
   │ </source>                         │
   │                                   │
   │ <filter spyderxdr.**>             │ ← Process all spyderxdr logs
   │   @type record_transformer       │ ← Add metadata
   │   <record>                        │
   │     fluentd_received_at ${time}   │ ← Add timestamp
   │     pipeline_version "1.0"        │ ← Add version
   │   </record>                       │
   │ </filter>                         │
   │                                   │
   │ <match spyderxdr.telemetry>      │ ← Route to backend
   │   @type http                      │ ← HTTP output
   │   endpoint http://localhost:8000/ │ ← Backend API
   │            api/v1/events/ingest   │
   │   http_method post                │
   │   content_type application/json   │
   │   <buffer>                        │
   │     @type file                    │ ← Buffer to disk
   │     path C:/opt/fluent/buffer/    │
   │     flush_interval 2s             │ ← Flush every 2s
   │     retry_max_times 10            │ ← Retry 10 times
   │   </buffer>                       │
   │   <format>                        │
   │     @type json                    │
   │   </format>                       │
   │ </match>                          │
   └──────────────────────────────────┘
   
   Fluentd Data Flow:
   External logs/agents
      ↓
   Fluentd HTTP input (port 9880)
      ↓
   Tag as spyderxdr.telemetry
      ↓
   Add metadata (timestamp, version)
      ↓
   Buffer to disk (C:/opt/fluent/buffer/)
      ↓
   POST to Backend /api/v1/events/ingest
      ↓
   Backend processes like normal telemetry


6. REDIS CACHING LAYER
   ───────────────────
   
   Purpose: Fast caching, pub/sub, rate limiting
   
   Redis Operations:
   ├─ SET: Store processed event summaries
   ├─ GET: Retrieve cached data
   ├─ LPUSH: Queue alerts
   ├─ LRANGE: Get alert batches
   └─ PUB/SUB: Real-time event distribution
   
   Current Status: ⚠️ USING MOCK IN-MEMORY (Redis server not running)


7. WEBSOCKET REAL-TIME STREAMING
   ────────────────────────────
   
   Endpoint: ws://localhost:8000/api/v1/stream/telemetry
   File: backend/app/api/v1/endpoints_stream.py
   
   Flow:
   Frontend WebSocket Connect
      ↓
   ConnectionManager.connect(ws)
      ↓
   _kafka_bridge() task
      ├─ Subscribe to TOPIC_TELEMETRY queue
      ├─ Subscribe to TOPIC_ALERTS queue
      └─ Listen for messages
      ↓
   On each Kafka message:
      {
        "type": "event",
        "payload": { ...event... }
      }
      ↓
   Frontend receives via useLiveTelemetry hook
      ↓
   Frontend renders in real-time


8. DATABASE SCHEMA (SQLite)
   ──────────────────────
   
   Table: events
   Columns:
   ├─ id (String, Primary Key)
   ├─ timestamp (DateTime)
   ├─ source_ip (String)
   ├─ destination_ip (String)
   ├─ hostname (String)
   ├─ agent_id (String)
   ├─ event_type (String)
   │  ├─ process_creation
   │  ├─ network_connection
   │  ├─ file_created
   │  ├─ registry_modified
   │  ├─ sca_audit
   │  ├─ performance_metric  ← CPU/RAM data
   │  └─ ...
   ├─ event_data (JSON)
   │  └─ For performance_metric:
   │     {
   │       "metric_type": "system_resources",
   │       "cpu_usage_percent": <0-100>,
   │       "memory_usage_percent": <0-100>,
   │       "total_memory_gb": <number>,
   │       "free_memory_mb": <number>,
   │       "timestamp_ms": <unix_timestamp>
   │     }
   ├─ status (Enum: new, processed, archived)
   ├─ created_at (DateTime)
   └─ ...


9. FRONTEND DATA RETRIEVAL
   ──────────────────────
   
   Two Methods:
   
   Method 1: REST API (Polling)
   └─ GET /api/v1/dashboard/summary
   └─ GET /api/v1/events/?hostname=X&limit=10
   └─ Interval: 30 seconds (configurable)
   
   Method 2: WebSocket (Real-time Streaming)
   └─ ws://localhost:8000/api/v1/stream/telemetry
   └─ Instant updates as events arrive
   └─ Used by useLiveTelemetry hook


10. COMPLETE DATA FLOW DIAGRAM
    ─────────────────────────
    
    Windows Agent
    (collect_performance_metrics)
           ↓ Every 10s
           ↓ [cpu_usage: 85%, memory: 100%]
           ↓
    ┌──────────────────────────────────────────┐
    │ send_telemetry()                         │
    │ HMAC-SHA256 signed POST                  │
    └──────────────────────────────────────────┘
           ↓
    Backend /api/v1/events/ingest
    ├─ Verify HMAC signature
    ├─ Insert to SQLite DB
    ├─ Publish to Kafka topic
    ├─ Process through Detection Engine
    └─ Return 200 OK
           ↓
    ┌───────────┬──────────────────────────────┐
    │ Kafka     │ Real-time streaming          │
    │ (in-mem   ├─ Topic: spyderxdr.telemetry │
    │ mock)     │ Message: JSON event          │
    │           │ With CPU/RAM metrics         │
    └───────────┴──────────────────────────────┘
           ↓
    ┌──────────────────────────────────────────┐
    │ WebSocket Bridge (_kafka_bridge task)    │
    │ Listens to Kafka queue                   │
    │ Broadcasts to all WS clients             │
    └──────────────────────────────────────────┘
           ↓
    ┌────────────────────────────────────────────────────┐
    │ Frontend (React)                                   │
    │ Receives: {type: "event", payload: {...}}         │
    │ • CPU: 85%                                        │
    │ • RAM: 100%                                       │
    │ Updates Dashboard in real-time                     │
    └────────────────────────────────────────────────────┘


█ WHY CPU/RAM NOT SHOWING ON DASHBOARD
═════════════════════════════════════════════════════════════════════════════════

Problem: Dashboard shows events but not CPU/RAM values

Root Causes:
1. Dashboard.jsx queries /api/v1/dashboard/summary
   └─ This endpoint returns alert counts, not telemetry metrics

2. Agents.jsx displays agentLogs but doesn't show event_data
   └─ Table only shows: timestamp, event_type, source_ip
   └─ Doesn't display: event_data.cpu_usage_percent, event_data.memory_usage_percent

3. Frontend useLiveTelemetry hook works but metrics display component missing
   └─ WebSocket receives the metrics but they're not rendered

SOLUTION: Add metrics display component to show CPU/RAM in real-time


█ FLUENTD DATA PATH (When you start Fluentd)
═════════════════════════════════════════════════════════════════════════════════

When you run: fluentd -c fluentd/spyderxdr.conf

Step-by-Step Flow:
1. Fluentd starts and listens on localhost:9880
2. Waits for HTTP POST to /api/v1/events/ (implicit in config)
3. External agents/sources send JSON to http://localhost:9880
4. Fluentd receives and tags as "spyderxdr.telemetry"
5. Adds metadata (timestamp, version) via record_transformer filter
6. Buffers to disk at C:/opt/fluent/buffer/spyderxdr
7. Every 2 seconds (flush_interval), Fluentd batches buffered events
8. Fluentd POSTs to http://localhost:8000/api/v1/events/ingest
9. Backend processes and stores
10. On failure, retries up to 10 times with exponential backoff

Note: This is an OPTIONAL alternative to direct agent→backend communication.
      Currently, agents send directly to backend, bypassing Fluentd.


█ KAFKA vs FLUENTD vs DIRECT API
═════════════════════════════════════════════════════════════════════════════════

┌─────────────────┬──────────────────────┬────────────────┬─────────────────┐
│                 │ Direct Agent→API     │ Via Fluentd    │ Via Kafka       │
├─────────────────┼──────────────────────┼────────────────┼─────────────────┤
│ Current Use     │ ✅ ACTIVE            │ Optional       │ Real-time       │
│ Latency         │ Low (direct)         │ Medium (2s)    │ Very low (<1s)  │
│ Buffering       │ None (real-time)     │ Disk buffer    │ Memory buffer   │
│ Scaling         │ Limited              │ Good           │ Excellent       │
│ Persistence     │ Database only        │ Disk + DB      │ Kafka broker    │
│ When to use     │ Demo/POC             │ Centralized    │ Production      │
│                 │                      │ logging        │ streaming       │
└─────────────────┴──────────────────────┴────────────────┴─────────────────┘


█ CURRENT ARCHITECTURE SUMMARY
═════════════════════════════════════════════════════════════════════════════════

Agent (10s interval)
    ↓
    └─→ Direct HTTPS POST to /api/v1/events/ingest ✅ ACTIVE PATH
          ├─ HMAC verification
          ├─ Database insert
          ├─ Kafka publish (mock)
          ├─ Detection engine
          └─ WebSocket broadcast

Fluentd (Optional)
    ↓
    └─→ HTTP 9880 input
          └─ POST to /api/v1/events/ingest (same path as agent)

Frontend 
    ↓
    ├─ Method 1: REST API polling (/api/v1/dashboard/summary) ← Static view
    └─ Method 2: WebSocket streaming (ws://...) ← Real-time but needs UI component

Database
    └─ SQLite with 892 events (660 process_creation, 5 performance_metric, etc.)


█ ACTION ITEMS TO FIX DASHBOARD
═════════════════════════════════════════════════════════════════════════════════

1. ✅ Agent collects CPU/RAM metrics
   └─ Done in updated agent.py

2. ❌ Dashboard displays CPU/RAM values
   └─ Need to create MetricsCard component

3. ❌ Agents view shows detailed metrics
   └─ Need to expand table to show event_data.cpu_usage_percent

4. ❌ Real-time updates
   └─ Need to properly subscribe to WebSocket

"""

print(__doc__)
