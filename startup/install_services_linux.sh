#!/bin/bash
# ==============================================================================
# ARGUS XDR Platform - Linux Service Installer (Systemd)
# ==============================================================================
# Registers the FastAPI backend and React frontend as active background daemons.

set -e

# Path configurations
BASE_DIR="/opt/argus"
BACKEND_DIR="$BASE_DIR/backend"
FRONTEND_DIR="$BASE_DIR/frontend"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This installer must be run as root (sudo)."
    exit 1
fi

echo "🚀 Installing system services for ARGUS XDR Console..."

# Copy files to destination directories if needed
# (Assuming current workspace is already copied to /opt/argus)
mkdir -p "$BASE_DIR"

# 1. Create Systemd Service for Backend
echo "⚙️ Creating Systemd service for FastAPI Backend..."
cat > /etc/systemd/system/argus-backend.service << EOF
[Unit]
Description=ARGUS XDR API Backend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$BACKEND_DIR
ExecStart=$BACKEND_DIR/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
Environment=PAGER=cat

[Install]
WantedBy=multi-user.target
EOF

# 2. Create Systemd Service for Frontend
echo "⚙️ Creating Systemd service for Vite Frontend Console..."
cat > /etc/systemd/system/argus-frontend.service << EOF
[Unit]
Description=ARGUS XDR Frontend Dashboard Console
After=network.target argus-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=$FRONTEND_DIR
ExecStart=/usr/bin/npm run dev -- --host 0.0.0.0 --port 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd configuration
echo "🔄 Reloading Systemd unit configuration..."
systemctl daemon-reload

# Enable and start services
echo "✅ Enabling services on system boot startup..."
systemctl enable argus-backend
systemctl enable argus-frontend

echo "▶️ Starting services immediately..."
systemctl start argus-backend || echo "⚠️ Failed to start backend service. Check if dependencies are installed."
systemctl start argus-frontend || echo "⚠️ Failed to start frontend service. Check if npm modules are installed."

echo "🎉 ARGUS XDR services installed successfully!"
echo "   Backend running on: http://localhost:8000"
echo "   Frontend Console on: http://localhost:3000"
echo "   Verify status with: systemctl status argus-backend argus-frontend"
EOF
