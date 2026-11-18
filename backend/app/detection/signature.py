"""
Signature-based Detection Engine
Rule-based threat detection and MITRE ATT&CK mapping
"""
import logging
from typing import Dict, Any, List
import yaml
import json
from datetime import datetime

logger = logging.getLogger(__name__)

class SignatureDetectionEngine:
    """Detects threats using signature-based rules"""
    
    def __init__(self, db, redis_service):
        self.db = db
        self.redis = redis_service
        self.rules = []
    
    async def detect_signatures(
        self,
        session,
        event_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Detect threats using signature rules"""
        alerts = []
        
        # Get enabled rules from database
        rules = await self.db.get_rules(session, enabled_only=True)
        
        for rule in rules:
            if rule.rule_type != "signature":
                continue
            
            # Check if event matches rule conditions
            if await self._match_rule(rule, event_data):
                alerts.append({
                    "type": "signature",
                    "severity": rule.severity,
                    "reason": rule.description,
                    "rule_id": rule.id,
                    "mitre_tactics": rule.mitre_tactics,
                    "mitre_techniques": rule.mitre_techniques,
                    "details": {
                        "matched_rule": rule.name,
                        "event_type": event_data.get("event_type")
                    }
                })
        
        return alerts
    
    async def _match_rule(self, rule, event_data: Dict) -> bool:
        """Check if event matches rule conditions"""
        conditions = rule.conditions
        
        if not conditions:
            return False
        
        # Support different condition types
        match_type = conditions.get("match_type", "all")  # all, any, pattern
        
        if match_type == "all":
            return self._match_all_conditions(conditions, event_data)
        elif match_type == "any":
            return self._match_any_condition(conditions, event_data)
        elif match_type == "pattern":
            return self._match_pattern(conditions, event_data)
        
        return False
    
    def _match_all_conditions(self, conditions: Dict, event_data: Dict) -> bool:
        """Match if ALL conditions are true"""
        for condition_name, condition_value in conditions.items():
            if condition_name in ["match_type"]:
                continue
            
            if not self._evaluate_condition(condition_name, condition_value, event_data):
                return False
        
        return True
    
    def _match_any_condition(self, conditions: Dict, event_data: Dict) -> bool:
        """Match if ANY condition is true"""
        for condition_name, condition_value in conditions.items():
            if condition_name in ["match_type"]:
                continue
            
            if self._evaluate_condition(condition_name, condition_value, event_data):
                return True
        
        return False
    
    def _match_pattern(self, conditions: Dict, event_data: Dict) -> bool:
        """Match using pattern/regex"""
        patterns = conditions.get("patterns", [])
        
        for pattern in patterns:
            field = pattern.get("field")
            regex = pattern.get("regex")
            
            if not field or not regex:
                continue
            
            event_value = str(event_data.get(field, ""))
            
            # Simple string matching (in production, use re.match)
            if regex in event_value:
                return True
        
        return False
    
    def _evaluate_condition(
        self,
        field: str,
        expected_value: Any,
        event_data: Dict
    ) -> bool:
        """Evaluate a single condition"""
        actual_value = event_data.get(field)
        
        # Handle different comparison types
        if isinstance(expected_value, dict):
            op = expected_value.get("operator")
            value = expected_value.get("value")
            
            if op == "equals":
                return actual_value == value
            elif op == "not_equals":
                return actual_value != value
            elif op == "contains":
                return value in str(actual_value)
            elif op == "not_contains":
                return value not in str(actual_value)
            elif op == "starts_with":
                return str(actual_value).startswith(value)
            elif op == "ends_with":
                return str(actual_value).endswith(value)
            elif op == "greater_than":
                return actual_value > value
            elif op == "less_than":
                return actual_value < value
            elif op == "in":
                return actual_value in value
            elif op == "not_in":
                return actual_value not in value
        else:
            # Direct equality check
            return actual_value == expected_value
    
    async def load_rules_from_file(self, session, file_path: str):
        """Load rules from YAML file"""
        try:
            with open(file_path, 'r') as f:
                rules_data = yaml.safe_load(f)
            
            for rule_data in rules_data.get("rules", []):
                existing_rule = await self.db.get_rule(session, rule_data["id"])
                
                if not existing_rule:
                    await self.db.create_rule(session, rule_data)
                    logger.info(f"Loaded rule: {rule_data['name']}")
        
        except Exception as e:
            logger.error(f"Error loading rules from {file_path}: {e}")
    
    def get_mitre_mapping(self, event_type: str) -> Dict[str, List[str]]:
        """Get MITRE ATT&CK mapping for event type"""
        mitre_mappings = {
            "process_creation": {
                "tactics": ["Execution"],
                "techniques": ["T1059"]  # Command and Scripting Interpreter
            },
            "file_created": {
                "tactics": ["Persistence"],
                "techniques": ["T1547"]  # Boot or Logon Autostart Execution
            },
            "network_connection": {
                "tactics": ["Command and Control"],
                "techniques": ["T1071"]  # Application Layer Protocol
            },
            "registry_modified": {
                "tactics": ["Defense Evasion", "Persistence"],
                "techniques": ["T1112"]  # Modify Registry
            },
            "logon": {
                "tactics": ["Initial Access"],
                "techniques": ["T1078"]  # Valid Accounts
            }
        }
        
        return mitre_mappings.get(event_type, {})
