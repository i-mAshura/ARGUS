import os
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def get_integrations_file_path() -> str:
    """Get the path to the integrations config file"""
    env_path = os.getenv("INTEGRATIONS_CONFIG_PATH")
    if env_path:
        return env_path
    
    # Try /app/config/integrations.json if running inside a docker container
    if os.path.exists('/app/config'):
        return '/app/config/integrations.json'
        
    # Default local directory relative to code base
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    config_dir = os.path.join(base_dir, 'config')
    os.makedirs(config_dir, exist_ok=True)
    return os.path.join(config_dir, 'integrations.json')

def get_integration_config(integration_id: str) -> Dict[str, Any]:
    """Get config details for a specific integration"""
    path = get_integrations_file_path()
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                integrations = json.load(f)
                return integrations.get(integration_id, {})
        except Exception as e:
            logger.error(f"Failed to read integrations config: {e}")
    return {}

def save_integration_config(integration_id: str, config: Dict[str, Any]) -> bool:
    """Save config details for a specific integration"""
    path = get_integrations_file_path()
    integrations = {}
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                integrations = json.load(f)
        except Exception as e:
            logger.error(f"Failed to read integrations config for saving: {e}")
            
    integrations[integration_id] = config
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            json.dump(integrations, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Failed to write integrations config: {e}")
        return False
