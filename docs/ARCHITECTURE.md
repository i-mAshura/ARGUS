# SpyderXDR Project Architecture

## Directory Structure

```
SpyderXDR/
├── backend/                          # FastAPI backend
│   ├── app/
│   │   ├── api/v1/                  # API endpoints
│   │   │   ├── endpoints_*.py       # Route handlers
│   │   │   └── __init__.py
│   │   ├── detection/               # Detection engines
│   │   │   ├── behavioral.py        # Behavioral detection
│   │   │   ├── anomaly.py          # Anomaly detection  
│   │   │   ├── signature.py        # Signature detection
│   │   │   ├── engine.py           # Main orchestrator
│   │   │   └── __init__.py
│   │   ├── models/                 # Data models
│   │   │   ├── database.py         # SQLAlchemy models
│   │   │   ├── schemas.py          # Pydantic schemas
│   │   │   └── __init__.py
│   │   ├── services/               # Business logic
│   │   │   ├── database.py         # Database operations
│   │   │   ├── redis_service.py    # Redis caching
│   │   │   └── __init__.py
│   │   ├── integrations/           # External integrations
│   │   │   ├── telegram_bot.py     # Telegram alerts
│   │   │   ├── threat_intelligence.py # TI lookups
│   │   │   └── __init__.py
│   │   ├── main.py                 # FastAPI app
│   │   └── __init__.py
│   ├── requirements.txt             # Python dependencies
│   └── Dockerfile
│
├── frontend/                        # React dashboard
│   ├── src/
│   │   ├── components/
│   │   │   └── Dashboard.jsx       # Main dashboard
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── App.css
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
│
├── database/                        # Database config
│   ├── init.sql                    # Schema
│   ├── migrations/
│   └── seeds/
│
├── detection-rules/                # Detection rules
│   └── rules.yaml                  # YAML rules
│
├── agents/                         # Endpoint agents
│   ├── windows/
│   │   └── agent.py               # Windows collector
│   └── linux/
│       └── agent.py               # Linux collector
│
├── config/                         # Configuration
│   ├── .env.example               # Environment template
│   └── prometheus.yml             # Monitoring config
│
├── docker/                         # Docker orchestration
│   ├── docker-compose.yml
│   ├── Dockerfile (backend)
│   └── Dockerfile (frontend)
│
├── docs/                          # Documentation
│   ├── DEPLOYMENT.md             # Deployment guide
│   ├── ARCHITECTURE.md           # System architecture
│   ├── API.md                    # API documentation
│   └── DEVELOPMENT.md            # Development guide
│
├── README.md                      # Main documentation
├── .gitignore
└── LICENSE
```

## Key Components

### Backend (Python + FastAPI)
- **Detection Engines**: Behavioral, Anomaly, Signature-based
- **API Gateway**: RESTful endpoints for all operations
- **Services**: Database, Redis, Threat Intelligence
- **Async Processing**: Handle 10,000+ events/second
- **Database**: PostgreSQL for persistence

### Frontend (React + Material-UI)
- **Dashboard**: Real-time security monitoring
- **Alert Management**: Triage and investigation
- **Response Center**: Execute automated actions
- **Compliance Tracking**: Security posture metrics

### Database Layer
- **PostgreSQL**: Relational data (alerts, rules, users)
- **TimescaleDB**: Time-series metrics
- **Elasticsearch**: Log aggregation and search
- **Redis**: Caching and real-time processing

### Endpoint Agents
- **Windows Agent**: Process, network, registry collection
- **Linux Agent**: Process, network, auth log collection
- **Telemetry Batch**: Efficient event transmission

## Data Flow

1. Agents → Event Ingestion API
2. Events → Detection Pipeline (3 parallel engines)
3. Detections → Alert Generation & Triage
4. Alerts → Dashboard + Telegram Notification
5. Analyst → Response Actions → Elasticsearch Log
6. Monitoring → Prometheus → Grafana

## Security Architecture

- Role-Based Access Control (RBAC)
- Encrypted database connections
- API authentication/authorization
- Audit logging for all actions
- Secure secret management
- HTTPS/TLS recommended

## Scalability

- Horizontal scaling via Docker Compose
- Load balancer support
- Database connection pooling
- Redis caching layer
- Batch event processing
- Asynchronous task queue ready

## Monitoring & Alerting

- Prometheus metrics export
- Health check endpoints
- Log aggregation ready
- Performance monitoring
- Error tracking
- Alert notifications
