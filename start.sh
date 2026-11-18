#!/usr/bin/env bash
# =============================================================================
# SpyderXDR – Full Stack Startup Script
# =============================================================================
# Prerequisites (WSL / Linux):
#   - Python 3.10+  with venv at backend/.venv   (or system-wide install)
#   - Node.js 18+
#   - Redis running  (sudo service redis-server start  OR  redis-server &)
#   - Fluentd installed  (gem install fluentd  OR  td-agent)
#   - Optional: Kafka at localhost:9092 (backend falls back to in-memory mock)
#
# Usage:
#   chmod +x start.sh
#   ./start.sh
# =============================================================================

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          SpyderXDR – Starting All Services           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── Colours ──────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ─── Cleanup on CTRL-C ────────────────────────────────────────────────────
PIDS=()
cleanup() {
    echo ""
    info "Stopping all services…"
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null
    echo "Done."
    exit 0
}
trap cleanup SIGINT SIGTERM

# ─── 1. Redis ─────────────────────────────────────────────────────────────
info "Checking Redis…"
if redis-cli ping &>/dev/null; then
    info "Redis already running ✅"
else
    warn "Redis not running – attempting to start…"
    redis-server --daemonize yes --loglevel warning
    sleep 1
    if redis-cli ping &>/dev/null; then
        info "Redis started ✅"
    else
        error "Could not start Redis. Please run: sudo service redis-server start"
        exit 1
    fi
fi

# ─── 2. Fluentd ───────────────────────────────────────────────────────────
FLUENTD_CONF="$ROOT/fluentd/spyderxdr.conf"
info "Starting Fluentd (HTTP input on :9880, forward on :24224)…"

# Try fluentd binary, fall back to td-agent
if command -v fluentd &>/dev/null; then
    FLUENTD_BIN="fluentd"
elif command -v td-agent &>/dev/null; then
    FLUENTD_BIN="td-agent"
else
    warn "Fluentd / td-agent not found – skipping. Agent will POST directly to FastAPI."
    FLUENTD_BIN=""
fi

if [ -n "$FLUENTD_BIN" ]; then
    "$FLUENTD_BIN" -c "$FLUENTD_CONF" \
        --log "$ROOT/fluentd/fluentd.log" \
        -d "$ROOT/fluentd/fluentd.pid" \
        2>&1 &
    PIDS+=($!)
    sleep 2
    info "Fluentd started (log: fluentd/fluentd.log) ✅"
fi

# ─── 3. FastAPI Backend ───────────────────────────────────────────────────
info "Starting FastAPI backend (port 8001)…"
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
    warn "No .venv found – creating virtual environment…"
    python3 -m venv .venv
fi

if [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    source .venv/bin/activate
fi
info "Installing / updating Python dependencies…"
pip install -q --upgrade pip
pip install -q -r requirements.txt

info "Launching uvicorn…"
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8001 \
    --reload \
    --log-level info \
    2>&1 | sed 's/^/[BACKEND] /' &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)
cd "$ROOT"

# Wait for backend to be ready
info "Waiting for backend to be ready…"
for i in $(seq 1 20); do
    if curl -s http://localhost:8001/api/v1/health &>/dev/null; then
        info "Backend ready ✅"
        break
    fi
    sleep 1
done

# ─── 4. Telemetry Agent (optional) ────────────────────────────────────────
if [ -f "$ROOT/agents/linux/telemetry_agent.py" ]; then
    info "Starting Telemetry Agent (posts to Fluentd / FastAPI)…"
    COLLECTION_INTERVAL=30 \
    python3 "$ROOT/agents/linux/telemetry_agent.py" \
        2>&1 | sed 's/^/[AGENT]   /' &
    PIDS+=($!)
fi

# ─── 5. Frontend ──────────────────────────────────────────────────────────
info "Starting React frontend (port 3000)…"
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
    warn "node_modules missing – running npm install (this may take a minute)…"
    npm install --legacy-peer-deps
fi

npm run dev 2>&1 | sed 's/^/[FRONTEND]/' &
PIDS+=($!)
cd "$ROOT"

# ─── Done ─────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              SpyderXDR Running 🚀                    ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Frontend   →  http://localhost:3000                 ║"
echo "║  Backend    →  http://localhost:8001                 ║"
echo "║  API Docs   →  http://localhost:8001/docs            ║"
echo "║  Live WS    →  ws://localhost:8001/api/v1/stream/telemetry ║"
echo "║  Fluentd    →  http://localhost:9880 (HTTP input)    ║"
echo "║  Redis      →  localhost:6379                        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Press  Ctrl+C  to stop all services."
echo ""

# Block until CTRL-C
wait
