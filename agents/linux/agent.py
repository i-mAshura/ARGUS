#!/usr/bin/env python3
"""
ARGUS Linux Endpoint Agent
Collects telemetry from Linux systems and sends to ARGUS server
"""

import requests
import json
import subprocess
import os
from datetime import datetime, timezone
import time
import uuid

def current_timestamp():
    """Return a timezone-aware local timestamp for telemetry payloads."""
    return datetime.now(timezone.utc).astimezone().isoformat()

import logging
import hmac
import hashlib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LinuxAgent:
    def __init__(self, server_url, agent_id=None):
        self.server_url = server_url
        self.agent_id = agent_id or str(uuid.uuid4())
        self.hostname = os.uname()[1]
        self.batch_size = 100
        self.collection_interval = 60
        self.fim_cache = {}
        
        # Load HMAC authentication key
        self.agent_key = "secure_key_argus_hmac"
        dir_path = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(dir_path, "config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    config = json.load(f)
                    self.agent_key = config.get("agent_key") or self.agent_key
            except Exception:
                pass
        else:
            # Fallback check standard installation directory
            install_config = "/opt/argus/config.json"
            if os.path.exists(install_config):
                try:
                    with open(install_config, "r") as f:
                        config = json.load(f)
                        self.agent_key = config.get("agent_key") or self.agent_key
                except Exception:
                    pass
    
    def collect_process_events(self):
        """Collect process information from /proc"""
        events = []
        try:
            result = subprocess.run(
                ['ps', 'auxww'],
                capture_output=True,
                text=True
            )
            
            events.append({
                'event_type': 'process_creation',
                'timestamp': current_timestamp(),
                'source_ip': '127.0.0.1',
                'hostname': self.hostname,
                'agent_id': self.agent_id,
                'event_data': {
                    'raw': result.stdout
                }
            })
        except Exception as e:
            logger.error(f"Error collecting process events: {e}")
        
        return events
    
    def collect_network_events(self):
        """Collect network connection events"""
        events = []
        try:
            result = subprocess.run(
                ['ss', '-tuanp'],
                capture_output=True,
                text=True
            )
            
            events.append({
                'event_type': 'network_connection',
                'timestamp': current_timestamp(),
                'source_ip': '127.0.0.1',
                'hostname': self.hostname,
                'agent_id': self.agent_id,
                'event_data': {
                    'raw': result.stdout
                }
            })
        except Exception as e:
            logger.error(f"Error collecting network events: {e}")
        
        return events
    
    def collect_file_events(self):
        """Collect file integrity monitoring events"""
        events = []
        import hashlib
        
        monitored_paths = [
            '/etc/hosts',
            '/etc/resolv.conf'
        ]
        
        for path in monitored_paths:
            if os.path.exists(path):
                try:
                    # Calculate MD5 hash
                    hasher = hashlib.md5()
                    with open(path, 'rb') as f:
                        buf = f.read()
                        hasher.update(buf)
                    current_hash = hasher.hexdigest()
                    current_size = len(buf)
                    
                    if path in self.fim_cache:
                        old_hash, old_size = self.fim_cache[path]
                        if current_hash != old_hash:
                            events.append({
                                'timestamp': current_timestamp(),
                                'source_ip': '127.0.0.1',
                                'hostname': self.hostname,
                                'agent_id': self.agent_id,
                                'event_type': 'file_modified',
                                'event_data': {
                                    'file_path': path,
                                    'action': 'modified',
                                    'hash': current_hash,
                                    'size': current_size
                                }
                            })
                            self.fim_cache[path] = (current_hash, current_size)
                    else:
                        self.fim_cache[path] = (current_hash, current_size)
                except Exception as e:
                    logger.error(f"Error checking file path {path}: {e}")
        
        return events
    
    def collect_auth_events(self):
        """Collect authentication events from /var/log/auth.log"""
        events = []
        auth_log = '/var/log/auth.log'
        if os.path.exists(auth_log):
            try:
                # Read last 10 lines for testing
                with open(auth_log, 'r') as f:
                    lines = f.readlines()[-10:]
                
                for line in lines:
                    if 'failed' in line.lower() or 'accepted' in line.lower():
                        events.append({
                            'event_type': 'authentication',
                            'timestamp': current_timestamp(),
                            'source_ip': '127.0.0.1',
                            'hostname': self.hostname,
                            'agent_id': self.agent_id,
                            'event_data': {
                                'raw': line.strip()
                            }
                        })
            except Exception as e:
                logger.error(f"Error collecting auth events: {e}")
        
        return events
    
    def collect_sca_events(self):
        """Collect security configuration assessment events (mocked for Linux SCA)"""
        events = []
        # Simulate simple configuration auditing
        events.append({
            'timestamp': current_timestamp(),
            'source_ip': '127.0.0.1',
            'hostname': self.hostname,
            'agent_id': self.agent_id,
            'event_type': 'compliance',
            'event_data': {
                'standards': ['CIS Linux Benchmark', 'PCI-DSS v4.0'],
                'control_id': 'CIS-1.1.1',
                'status': 'passed' if os.path.exists('/etc/passwd') else 'failed',
                'raw_log': 'Verify /etc/passwd permissions and contents are intact',
                'details': [
                    {
                        'id': 'sca-lux-001',
                        'title': 'Disable SSH Root Login',
                        'policy_value': 'PermitRootLogin',
                        'current_value': 'yes',
                        'recommended_value': 'no',
                        'compliant': False
                    },
                    {
                        'id': 'sca-lux-002',
                        'title': 'Restrict Permissions on /etc/shadow',
                        'policy_value': 'FilePermissions',
                        'current_value': '0600',
                        'recommended_value': '0600 or 0000',
                        'compliant': True
                    }
                ]
            }
        })
        return events

    def collect_all_telemetry(self):
        """Collect all telemetry data"""
        events = []
        events.extend(self.collect_process_events())
        events.extend(self.collect_network_events())
        events.extend(self.collect_file_events())
        events.extend(self.collect_auth_events())
        events.extend(self.collect_sca_events())
        
        return events
    
    def send_telemetry(self, events):
        """Send telemetry batch to server with HMAC signature"""
        if not events:
            return
        
        try:
            payload = {
                'hostname': self.hostname,
                'agent_id': self.agent_id,
                'events': events
            }
            
            # Compute HMAC-SHA256 signature
            payload_str = json.dumps(payload)
            signature = hmac.new(
                self.agent_key.encode('utf-8'),
                payload_str.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            headers = {
                'Content-Type': 'application/json',
                'X-Argus-Signature': signature
            }
            
            response = requests.post(
                f"{self.server_url}/api/v1/events/ingest",
                data=payload_str,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Sent {len(events)} events to server")
            else:
                logger.error(f"❌ Failed to send events: {response.status_code}")
        except Exception as e:
            logger.error(f"Error sending telemetry: {e}")
    
    def start_collection(self):
        """Start continuous telemetry collection"""
        logger.info(f"🚀 ARGUS Linux Agent Started")
        logger.info(f"Hostname: {self.hostname}")
        logger.info(f"Agent ID: {self.agent_id}")
        
        while True:
            try:
                events = self.collect_all_telemetry()
                self.send_telemetry(events)
                time.sleep(self.collection_interval)
            except KeyboardInterrupt:
                logger.info("\n⛔ Agent stopped")
                break
            except Exception as e:
                logger.error(f"Error: {e}")
                time.sleep(5)

if __name__ == "__main__":
    server_url = os.getenv('ARGUS_SERVER') or os.getenv('SPYDERXDR_SERVER')
    if not server_url:
        # Check config.json in current directory or executable directory
        dir_path = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(dir_path, "config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    config = json.load(f)
                    server_url = config.get("api_url") or config.get("server_url")
            except Exception as e:
                logger.error(f"Error loading config.json: {e}")
        
        # Check standard installation directory if not found
        if not server_url:
            install_config = "/opt/argus/config.json"
            if os.path.exists(install_config):
                try:
                    with open(install_config, "r") as f:
                        config = json.load(f)
                        server_url = config.get("api_url") or config.get("server_url")
                except Exception as e:
                    logger.error(f"Error loading /opt/argus/config.json: {e}")

    SERVER_URL = server_url or 'http://localhost:8000'
    agent = LinuxAgent(SERVER_URL)
    agent.start_collection()
