#!/bin/bash
# ==============================================================================
# ARGUS Endpoint Detection & Response - Linux Agent Installer (v1.0.0)
# ==============================================================================
# This script installs the ARGUS telemetry agent as a systemd service.
# Usage: sudo ./install.sh [SERVER_URL]
# Example: sudo ./install.sh http://192.168.1.10:8000
# ==============================================================================

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Please run this installation script as root (sudo)."
  exit 1
fi

# Define variables
INSTALL_DIR="/opt/argus"
SERVICE_NAME="argus-agent"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SERVER_URL="${1:-http://localhost:8000}"

echo "========================================================="
echo "🛡️  ARGUS Linux Endpoint Agent Installer"
echo "========================================================="
echo "Preparing system environment..."

# 1. Create installation directory
mkdir -p "$INSTALL_DIR"

# 2. Copy the agent script to the installation folder
SCRIPT_PATH="$(dirname "$0")/agent.py"
if [ -f "$SCRIPT_PATH" ]; then
  cp "$SCRIPT_PATH" "$INSTALL_DIR/agent.py"
else
  # If local copy not found (e.g. running standalone installer), check current directory
  if [ -f "agent.py" ]; then
    cp "agent.py" "$INSTALL_DIR/agent.py"
  else
    echo "❌ Error: Could not locate 'agent.py' script. Ensure agent.py is in the same folder."
    exit 1
  fi
fi

chmod +x "$INSTALL_DIR/agent.py"
echo "✅ Copied agent.py to $INSTALL_DIR"

# 3. Create server configuration JSON
cat <<EOF > "$INSTALL_DIR/config.json"
{
  "api_url": "$SERVER_URL"
}
EOF
chmod 600 "$INSTALL_DIR/config.json"
echo "✅ Configured agent reporting endpoint to: $SERVER_URL"

# 4. Check and install package dependencies (python3, requests)
echo "📦 Resolving system dependencies..."
if command -v apt-get &>/dev/null; then
  # Debian/Ubuntu systems
  apt-get update -y &>/dev/null
  apt-get install -y python3 python3-pip python3-requests &>/dev/null
elif command -v yum &>/dev/null; then
  # RHEL/CentOS systems
  yum install -y python3 python3-pip &>/dev/null
  pip3 install requests &>/dev/null
elif command -v dnf &>/dev/null; then
  # Fedora systems
  dnf install -y python3 python3-requests &>/dev/null
else
  echo "⚠️ Warning: Package manager not recognized. Please ensure python3 and python3-requests library are installed manually."
fi

# 5. Create Systemd Service File
echo "⚙️  Configuring Systemd service daemon..."
cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=ARGUS Endpoint Detection & Response Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/agent.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "$SERVICE_FILE"

# 6. Load, enable and start the service
echo "🚀 Loading and starting service..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

# 7. Print verification details
echo "========================================================="
echo "✅ ARGUS Linux Agent v1.0.0 installed successfully!"
echo "========================================================="
echo "Control Commands:"
echo "  • Check Status:  sudo systemctl status $SERVICE_NAME"
echo "  • Restart Agent: sudo systemctl restart $SERVICE_NAME"
echo "  • Stop Agent:    sudo systemctl stop $SERVICE_NAME"
echo "  • View Logs:     sudo journalctl -u $SERVICE_NAME -f"
echo "========================================================="
