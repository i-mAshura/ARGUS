# Installation & Deployment Guide

## System Requirements

- **OS**: Windows, Linux, macOS
- **CPU**: 4+ cores
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 50GB (SSD recommended)
- **Network**: Stable internet connection
- **Ports**: 5432 (PostgreSQL), 6379 (Redis), 9200 (Elasticsearch), 8000 (API), 3000 (Dashboard)

## Docker Compose Deployment (Recommended)

### 1. Install Docker
- **Windows/Mac**: [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: `curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh`

### 2. Clone Repository
```bash
git clone https://github.com/yourusername/SpyderXDR.git
cd SpyderXDR
```

### 3. Configure Environment
```bash
cp config/.env.example config/.env

# Edit with your settings
# Required: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
nano config/.env
```

### 4. Deploy Services
```bash
cd docker
docker-compose up -d

# Verify all containers are running
docker-compose ps

# Check logs
docker-compose logs -f backend
```

### 5. Initialize Database
```bash
# Migrations run automatically on startup
# Verify:
docker-compose exec postgres psql -U xdr_user -d spyderxdr -c "\\dt"
```

### 6. Access Services
- **Dashboard**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **Prometheus**: http://localhost:9090

## Local Development Setup

### Backend Setup
```bash
# Requirements: Python 3.11+
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
export DATABASE_URL="postgresql://xdr_user:xdr_pass@localhost:5432/spyderxdr"
export REDIS_URL="redis://:xdr_redis_pass@localhost:6379"

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
# Requirements: Node.js 18+
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:3000
```

### Database Setup (Standalone)
```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE spyderxdr"
psql -U postgres -d spyderxdr -f database/init.sql
```

## Agent Deployment

### Windows Agent
```powershell
# Run PowerShell as Administrator
cd agents/windows

# Install Python 3.11+
# Then:
pip install requests

# Run agent
python agent.py

# Or install as Windows Service
New-Service -Name "SpyderXDRAgent" -BinaryPathName "python C:\path\to\agent.py" -StartupType Automatic
Start-Service -Name "SpyderXDRAgent"
```

### Linux Agent
```bash
# Install dependencies
sudo apt-get install python3-pip
pip3 install requests

# Make executable
chmod +x agents/linux/agent.py

# Run agent
python3 agents/linux/agent.py

# Or as systemd service
sudo tee /etc/systemd/system/spyderxdr-agent.service > /dev/null <<EOF
[Unit]
Description=SpyderXDR Endpoint Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/spyderxdr-agent/agent.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable spyderxdr-agent
sudo systemctl start spyderxdr-agent
```

## Configuration

### Telegram Bot Setup
1. Create bot with @BotFather on Telegram
2. Get bot token and chat ID
3. Add to `config/.env`:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   ```

### Threat Intelligence
Optionally configure threat intelligence feeds:
```env
VIRUSTOTAL_API_KEY=your_key
ABUSEIPDB_API_KEY=your_key
OTXALIENTVAULT_API_KEY=your_key
```

### Alert Thresholds
Adjust sensitivity in `.env`:
```env
ALERT_CRITICAL_THRESHOLD=0.95
ALERT_HIGH_THRESHOLD=0.85
ALERT_MEDIUM_THRESHOLD=0.70
```

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process using port
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows
kill -9 PID
```

### Database Connection Error
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check connection
docker-compose exec postgres psql -U xdr_user -c "SELECT 1"
```

### Agent Cannot Connect to Server
```bash
# Verify server is running
curl http://localhost:8000/api/v1/health

# Check firewall
# Check agent SPYDERXDR_SERVER environment variable
```

### Low Performance
- Increase Docker resource limits
- Add more backend containers
- Enable database query optimization
- Increase Redis memory allocation

## Monitoring

### Health Checks
```bash
# API health
curl http://localhost:8000/api/v1/health

# Database
docker-compose exec postgres pg_isready

# Redis
docker-compose exec redis redis-cli ping

# Elasticsearch
curl http://localhost:9200
```

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend

# Follow logs
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

## Backup & Recovery

### Backup Database
```bash
# PostgreSQL backup
docker-compose exec postgres pg_dump -U xdr_user spyderxdr > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U xdr_user spyderxdr < backup.sql
```

### Backup Configuration
```bash
# Backup .env and rules
tar -czf spyderxdr-config-backup.tar.gz config/ detection-rules/
```

## Updates

### Update Services
```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker-compose up -d --build

# Check version
curl http://localhost:8000/api/v1/health | jq '.version'
```

## Production Deployment

### Security Hardening
- Change all default passwords
- Enable HTTPS with valid certificates
- Implement firewall rules
- Enable authentication on all services
- Set CORS restrictions
- Enable audit logging

### Performance Tuning
- Use PostgreSQL tuning
- Increase worker processes
- Enable caching
- Set up load balancer
- Use CDN for frontend

### Monitoring
- Set up Prometheus scraping
- Configure Grafana dashboards
- Enable log aggregation (ELK)
- Set up alerts on key metrics

See `docs/KUBERNETES.md` for cloud deployment options.
