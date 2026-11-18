# Enterprise Deployment Guide - Large Scale Setup

## 🏢 Enterprise Architecture (100,000+ Endpoints)

### System Requirements

**Compute Cluster (Kubernetes - 50+ nodes)**
```
Total Resources:
- CPU Cores: 400+
- Memory: 1TB+
- Storage: 10TB+
- Network: 10Gbps+
```

**Per Node (Production Standard)**
- vCPU: 8-16 cores
- RAM: 32-64GB
- Storage: 200GB NVMe SSD
- Network: 1-10Gbps

### Recommended Infrastructure

#### Data Center Deployment
```
Primary Data Center:
├── Backend Cluster (15 nodes)
│   ├── API Servers (3 nodes) - FastAPI instances
│   ├── Detection Engines (5 nodes) - Parallel detection
│   ├── Cache Layer (3 nodes) - Redis Cluster
│   └── Job Queue (4 nodes) - Background processing
│
├── Database Tier (3 nodes)
│   ├── PostgreSQL Primary + 2 Replicas
│   ├── Connection Pooling (PgBouncer)
│   └── Backup Node
│
├── Search & Analytics (5 nodes)
│   ├── Elasticsearch Cluster (5 nodes)
│   └── Kibana Dashboard
│
├── Time-Series DB (3 nodes)
│   ├── TimescaleDB (PostgreSQL extension)
│   └── Prometheus Metrics
│
└── Load Balancer & Security
    ├── HAProxy/Nginx Load Balancer
    ├── WAF (ModSecurity)
    └── DDoS Protection

Disaster Recovery (Secondary Data Center):
├── Hot Standby Cluster
├── Database Replication
├── Real-time Failover
└── RPO < 1 minute, RTO < 5 minutes
```

### Event Processing Capacity

```
Processing Tiers:

Tier 1: 10,000-50,000 endpoints
├── Throughput: 100K-500K events/second
├── Detection Latency: <100ms
├── Backend Instances: 10
└── Database Connections: 100

Tier 2: 50,000-250,000 endpoints
├── Throughput: 500K-2.5M events/second
├── Detection Latency: <200ms
├── Backend Instances: 50
└── Database Connections: 300

Tier 3: 250,000-1,000,000 endpoints
├── Throughput: 2.5M-10M events/second
├── Detection Latency: <500ms
├── Backend Instances: 100
└── Database Connections: 500
```

## 🔧 Multi-Cluster Deployment

### Deployment Topology

```yaml
Global Deployment:
├── Regional Clusters
│   ├── North America
│   │   ├── Primary: 25 nodes
│   │   └── Secondary: 10 nodes
│   ├── Europe
│   │   ├── Primary: 20 nodes
│   │   └── Secondary: 8 nodes
│   └── Asia-Pacific
│       ├── Primary: 15 nodes
│       └── Secondary: 6 nodes
│
├── Central Services
│   ├── Master Metrics Server
│   ├── Centralized Logging (ELK)
│   └── Global Dashboard
│
└── Replication & Sync
    ├── Cross-region DB Replication
    ├── Alert Aggregation
    └── Threat Intel Synchronization
```

### Kubernetes Configuration

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: spyderxdr-enterprise

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spyderxdr-backend
  namespace: spyderxdr-enterprise
spec:
  replicas: 50  # Scale for 100K+ endpoints
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 5
      maxUnavailable: 2
  selector:
    matchLabels:
      app: spyderxdr-backend
  template:
    metadata:
      labels:
        app: spyderxdr-backend
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - spyderxdr-backend
              topologyKey: kubernetes.io/hostname
      containers:
      - name: backend
        image: spyderxdr/backend:latest
        resources:
          requests:
            cpu: 4
            memory: 8Gi
          limits:
            cpu: 8
            memory: 16Gi
        env:
        - name: DATABASE_POOL_SIZE
          value: "50"
        - name: DETECTION_BATCH_SIZE
          value: "500"
        - name: REDIS_CLUSTER
          value: "true"
        ports:
        - containerPort: 8000

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-primary
  namespace: spyderxdr-enterprise
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres-primary
  template:
    metadata:
      labels:
        app: postgres-primary
    spec:
      containers:
      - name: postgres
        image: postgres:16
        resources:
          requests:
            cpu: 16
            memory: 64Gi
          limits:
            cpu: 32
            memory: 128Gi
        env:
        - name: POSTGRES_DB
          value: spyderxdr
        - name: POSTGRES_INITDB_ARGS
          value: "-c max_connections=500 -c shared_buffers=16GB"
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Ti

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elasticsearch
  namespace: spyderxdr-enterprise
spec:
  replicas: 10
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      containers:
      - name: elasticsearch
        image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
        resources:
          requests:
            cpu: 4
            memory: 16Gi
          limits:
            cpu: 8
            memory: 32Gi
        env:
        - name: discovery.seed_hosts
          value: "elasticsearch-0,elasticsearch-1,elasticsearch-2,elasticsearch-3,elasticsearch-4,elasticsearch-5,elasticsearch-6,elasticsearch-7,elasticsearch-8,elasticsearch-9"
        - name: cluster.initial_master_nodes
          value: "elasticsearch-0,elasticsearch-1,elasticsearch-2"
        volumeMounts:
        - name: elasticsearch-data
          mountPath: /usr/share/elasticsearch/data
  volumeClaimTemplates:
  - metadata:
      name: elasticsearch-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 500Gi
```

## 🎯 Integration Configuration

### Agent Integration (Large Scale)

```yaml
# Agent Configuration for SpyderXDR Integration
agent:
  cluster_mode: enabled
  nodes:
    - node1: 192.168.1.100
    - node2: 192.168.1.101
    - node3: 192.168.1.102
  
  integrations:
    spyderxdr:
      enabled: true
      webhook: https://spyderxdr-api.example.com/api/v1/agent/events
      frequency: 300  # Every 5 minutes
      
  vulnerability_detection:
    enabled: true
    feeds:
      - NVD
      - Ubuntu
      - Debian
      - Amazon
    
  file_integrity_monitoring:
    enabled: true
    monitored_paths:
      - /etc
      - /usr/bin
      - /usr/sbin
      - /opt
    
  rootkit_detection:
    enabled: true
    
  threat_detection:
    enabled: true
```

### Ticketing System Configuration

```yaml
# Jira Configuration
ticketing:
  provider: jira
  instance_url: https://jira.company.com
  credentials:
    username: ${JIRA_USERNAME}
    api_token: ${JIRA_API_TOKEN}
  
  project:
    key: SEC
    name: Security Incidents
  
  automation:
    critical_alerts:
      create_ticket: true
      priority: P1
      assignee: security-team
      sla_hours: 1
    
    high_alerts:
      create_ticket: true
      priority: P2
      assignee: security-team
      sla_hours: 4
    
    lateral_movement:
      create_ticket: true
      auto_response: isolate_host
      priority: P1
      sla_hours: 1
    
    data_exfiltration:
      create_ticket: true
      auto_response: block_ip
      priority: P1
      notify_ciso: true
      sla_hours: 0.5

# ServiceNow Configuration (Alternative)
servicenow:
  provider: servicenow
  instance_url: https://company.service-now.com
  oauth:
    client_id: ${SN_CLIENT_ID}
    client_secret: ${SN_CLIENT_SECRET}
  
  assignment_group: Security Incident Response
```

## 📊 Monitoring & Alerting

### Prometheus Metrics

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'spyderxdr-backend'
    static_configs:
      - targets:
        - backend-1:8000
        - backend-2:8000
        - backend-50:8000
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance

  - job_name: 'postgresql'
    static_configs:
      - targets: ['postgres-primary:5432']

  - job_name: 'elasticsearch'
    static_configs:
      - targets: ['elasticsearch:9200']

  - job_name: 'redis-cluster'
    static_configs:
      - targets:
        - redis-0:6379
        - redis-1:6379
        - redis-2:6379

# Alert Rules
groups:
- name: spyderxdr
  rules:
  - alert: HighDetectionLatency
    expr: spyderxdr_detection_latency_ms > 500
    for: 5m
    annotations:
      summary: "Detection latency > 500ms"
  
  - alert: DatabaseConnectionPoolExhausted
    expr: pg_stat_activity_count > 450
    for: 2m
    annotations:
      summary: "Database connections near limit"
  
  - alert: ElasticsearchClusterUnhealthy
    expr: elasticsearch_cluster_health_status != 1
    for: 1m
    annotations:
      summary: "Elasticsearch cluster unhealthy"
```

## 🚀 Performance Optimization

### Database Tuning

```sql
-- PostgreSQL Configuration for 100K+ endpoints
ALTER SYSTEM SET shared_buffers = '16GB';
ALTER SYSTEM SET effective_cache_size = '48GB';
ALTER SYSTEM SET maintenance_work_mem = '2GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '20MB';
ALTER SYSTEM SET min_wal_size = '4GB';
ALTER SYSTEM SET max_wal_size = '16GB';
ALTER SYSTEM SET max_worker_processes = 16;
ALTER SYSTEM SET max_parallel_workers_per_gather = 8;
ALTER SYSTEM SET max_parallel_workers = 16;
```

### Redis Cluster Setup

```bash
# Create Redis Cluster with 6 nodes (3 primary, 3 replica)
redis-cli --cluster create \
  redis-1:6379 redis-2:6379 redis-3:6379 \
  redis-4:6379 redis-5:6379 redis-6:6379 \
  --cluster-replicas 1 \
  --cluster-yes

# Configure cluster parameters
CONFIG SET maxmemory 128gb
CONFIG SET maxmemory-policy allkeys-lru
CONFIG SET appendonly yes
CONFIG SET appendfsync everysec
```

## 📈 Scaling Limits & Recommendations

| Metric | 10K Endpoints | 100K Endpoints | 1M Endpoints |
|--------|--------------|----------------|-------------|
| Backend Instances | 10 | 50 | 100 |
| PostgreSQL Connections | 100 | 300 | 500 |
| Elasticsearch Nodes | 5 | 10 | 20 |
| Redis Nodes | 3 | 6 | 12 |
| Events/Second | 100K | 1M | 10M |
| Detection Latency | <100ms | <200ms | <500ms |
| Storage/Day | 500GB | 5TB | 50TB |
| Annual Cost | $10K | $50K | $200K+ |

## 🔒 Security in Large Scale

- End-to-end encryption for all data in transit
- TLS 1.3 for all API communications
- Database encryption at rest
- Multi-factor authentication for all admin access
- Audit logging for all operations
- Regular penetration testing
- Compliance certifications (SOC 2, ISO 27001)

See `docs/ENTERPRISE_OPERATIONS.md` for operational runbooks.
