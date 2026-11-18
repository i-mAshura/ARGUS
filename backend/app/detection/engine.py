"""
Main Detection Engine - Orchestrates all detection methods
"""
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List
import asyncio

from app.detection.behavioral import BehavioralDetectionEngine
from app.detection.anomaly import AnomalyDetectionEngine
from app.detection.signature import SignatureDetectionEngine
from app.integrations.threat_intelligence import ThreatIntelligenceService

logger = logging.getLogger(__name__)

class DetectionEngine:
    """Main orchestrator for all detection methods"""
    
    def __init__(self, db, redis_service):
        self.db = db
        self.redis = redis_service
        self.behavioral = BehavioralDetectionEngine(db, redis_service)
        self.anomaly = AnomalyDetectionEngine(db, redis_service)
        self.signature = SignatureDetectionEngine(db, redis_service)
        self.threat_intel = ThreatIntelligenceService(db, redis_service)
        self.running = False
    
    async def start(self):
        """Start detection engine"""
        self.running = True
        logger.info("🚀 Detection Engine started")
    
    async def stop(self):
        """Stop detection engine"""
        self.running = False
        logger.info("⛔ Detection Engine stopped")
    
    async def process_event(self, session, event: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process event through all detection methods"""
        if not self.running:
            return []
        
        alerts = []
        
        try:
            # Extract event details
            event_type = event.get("event_type")
            hostname = event.get("hostname")
            username = event.get("user", "unknown")

            # ── Sysmon-to-detection-type bridging ──────────────────────────
            # Sysmon events carry event_type="sysmon" but the detection engine
            # routes behavioral analysis based on the Sysmon EventID.  The
            # signature engine also needs the Sysmon fields elevated to the
            # top level so that rule conditions like "command_line" or "image"
            # resolve correctly.
            detection_event_type = event_type
            detection_event_data = event.get("event_data", {})
            sysmon_signature_event = None

            SYSMON_EVENTID_MAP = {
                "1":  "process_creation",
                "3":  "network_connection",
                "11": "file_created",
                "12": "registry_modified",
                "13": "registry_modified",
                "14": "registry_modified",
                "22": "dns_query",
            }

            if event_type == "sysmon":
                raw_ed = event.get("event_data", {})
                event_id = str(
                    raw_ed.get("EventID")
                    or raw_ed.get("event_id")
                    or raw_ed.get("details", {}).get("event_id")
                    or ""
                )
                if event_id in SYSMON_EVENTID_MAP:
                    detection_event_type = SYSMON_EVENTID_MAP[event_id]

                # Flatten the normalised `details` dict into detection_event_data
                # so the behavioral engine finds `command_line`, `image`, etc.
                # at the top level instead of nested under `details`.
                details = raw_ed.get("details", {})
                if details:
                    detection_event_data = {**raw_ed, **details}
                else:
                    detection_event_data = raw_ed

                # Build an event copy with elevated Sysmon fields so signature
                # rules (which check top-level keys like command_line, image,
                # parent_image, etc.) can find the values.
                sysmon_signature_event = dict(event)
                details = raw_ed.get("details", {})
                if details:
                    for k, v in details.items():
                        if v is not None and k not in sysmon_signature_event:
                            sysmon_signature_event[k] = v
                # Also bring up original PascalCase Sysmon fields for rules
                # that may reference the raw field names.
                for pascal_key in (
                    "Image", "CommandLine", "ParentImage", "User",
                    "ImageLoaded", "TargetFilename", "TargetObject",
                    "SourceIp", "DestinationIp", "DestinationPort", "Protocol",
                    "QueryName", "QueryResults",
                ):
                    v = raw_ed.get(pascal_key)
                    if v is not None and pascal_key.lower() not in sysmon_signature_event:
                        sysmon_signature_event[pascal_key] = v

            # Run all detection methods in parallel
            detection_tasks = []
            
            # Behavioral detection
            # Uses detection_event_type so Sysmon process/network/file/registry
            # events are routed to the behavioral analyser.
            if detection_event_type in ["process_creation", "network_connection", "file_created", "registry_modified"]:
                detection_tasks.append(
                    self.behavioral.analyze_process_behavior(
                        session, hostname, username, detection_event_data
                    )
                )
            
            # Anomaly detection
            detection_tasks.append(
                self.anomaly.detect_anomalies(
                    session, hostname, username, event_type, event.get("event_data", {})
                )
            )
            
            # Signature-based detection
            # For Sysmon events the copy with elevated fields is used so
            # rule conditions resolve the nested Sysmon data correctly.
            signature_event = sysmon_signature_event if sysmon_signature_event is not None else event
            detection_tasks.append(
                self.signature.detect_signatures(session, signature_event)
            )
            
            # Threat intelligence lookup (skip system telemetry to avoid ti:ip Redis churn)
            if event_type not in {"cpu_ram_performance", "network_connection", "process_creation", "winevent", "performance_metric"}:
                detection_tasks.append(
                    self.threat_intel.check_indicators(event)
                )
            
            # Wait for all detections
            results = await asyncio.gather(*detection_tasks, return_exceptions=True)
            
            # Combine results
            for result in results:
                if isinstance(result, list):
                    alerts.extend(result)
                elif isinstance(result, Exception):
                    logger.error(f"Detection error: {result}")
            
            # Deduplicate and correlate alerts
            alerts = await self._deduplicate_alerts(alerts)
            
            # Create Alert objects in database
            for alert_data in alerts:
                await self._create_alert(session, event, alert_data)
            
        except Exception as e:
            logger.error(f"Error processing event: {e}")
        
        return alerts
    
    async def _deduplicate_alerts(self, alerts: List[Dict]) -> List[Dict]:
        """Remove duplicate alerts"""
        seen = set()
        unique_alerts = []
        
        for alert in alerts:
            alert_key = (
                alert.get("type"),
                alert.get("severity"),
                alert.get("reason")
            )
            
            if alert_key not in seen:
                seen.add(alert_key)
                unique_alerts.append(alert)
        
        return unique_alerts
    
    @staticmethod
    def _infer_mitre(alert_data: Dict) -> tuple:
        """Infer MITRE ATT&CK tactics and techniques from alert reason/title.

        This fallback ensures MITRE data is populated even when the running
        detection engine process has cached old behavioral code (e.g. the
        standalone kafka_consumer.py that was started before code changes).
        """
        mitre_tactics = alert_data.get("mitre_tactics", [])
        mitre_techniques = alert_data.get("mitre_techniques", [])

        if mitre_techniques:
            return mitre_tactics, mitre_techniques

        reason = (alert_data.get("reason") or "").lower()

        # ── MITRE inference map ───────────────────────────────────────────
        inference_map = [
            (["obfuscation"],                     ["Defense Evasion"],            ["T1027"]),
            (["encoding", "decode"],               ["Execution", "Defense Evasion"], ["T1059.001", "T1027"]),
            (["registry"],                         ["Persistence"],                ["T1547.001"]),
            (["parent-child", "winword", "excel"], ["Execution", "Defense Evasion"], ["T1059"]),
            (["injection"],                        ["Defense Evasion", "Execution"], ["T1055"]),
            (["large data", "exfil"],              ["Exfiltration"],               ["T1020"]),
            (["beacon", "c2"],                     ["Command and Control"],         ["T1071"]),
            (["dns tunnel"],                       ["Command and Control"],         ["T1071.004"]),
            (["port scan"],                        ["Discovery"],                  ["T1046"]),
            (["host scan"],                        ["Discovery"],                  ["T1046"]),
            (["lotl", "rundll32", "certutil"],     ["Defense Evasion"],            ["T1218"]),
            (["system path", "system32"],          ["Persistence", "Defense Evasion"], ["T1543.003"]),
            (["script execution", ".ps1", ".vbs", ".bat", ".cmd", ".scr"], ["Execution"], ["T1059"]),
            (["powershell"],                       ["Execution"],                  ["T1059.001"]),
        ]

        for keywords, tactics, techniques in inference_map:
            if any(kw in reason for kw in keywords):
                return tactics, techniques

        # Fallback unknown → Discovery / T1087
        return ["Discovery"], ["T1087"]

    async def _create_alert(self, session, event: Dict, alert_data: Dict):
        """Create alert in database"""
        try:
            alert_id = str(uuid.uuid4())

            mitre_tactics, mitre_techniques = self._infer_mitre(alert_data)

            alert_payload = {
                "id": alert_id,
                "title": alert_data.get("reason", "Security Alert"),
                "description": alert_data.get("description", ""),
                "severity": alert_data.get("severity", "medium"),
                "status": "new",
                "source_event_ids": [event.get("id")],
                "rule_id": alert_data.get("rule_id", ""),
                "detection_type": alert_data.get("type", "unknown"),
                "indicators": alert_data.get("details", {}),
                "mitre_tactics": mitre_tactics,
                "mitre_techniques": mitre_techniques,
                "first_seen": datetime.utcnow(),
                "last_seen": datetime.utcnow(),
                "hostname": event.get("hostname", "unknown"),
                "user": event.get("user", "unknown"),
                "notes": [],
                "artifacts": []
            }
            
            alert = await self.db.create_alert(session, alert_payload)
            logger.info(f"Created alert {alert_id}: {alert_data.get('reason')}")
            
            # Cache alert for faster dashboard queries
            cache_key = f"alert:{alert_id}"
            cache_payload = alert_payload.copy()
            cache_payload["first_seen"] = cache_payload["first_seen"].isoformat()
            cache_payload["last_seen"] = cache_payload["last_seen"].isoformat()
            await self.redis.set(cache_key, cache_payload)

            # ── Publish alert to Kafka for live streaming ──────────────
            try:
                from app.main import kafka_service
                from app.kafka.kafka_service import TOPIC_ALERTS
                kafka_alert = cache_payload.copy()
                await kafka_service.produce_event(TOPIC_ALERTS, kafka_alert)
            except Exception as kafka_err:
                logger.warning("Kafka alert publish skipped: %s", kafka_err)
                # Fall back to Redis pub/sub
                try:
                    from app.main import redis_service
                    import json
                    await redis_service.publish(TOPIC_ALERTS, json.dumps(kafka_alert))
                except Exception:
                    pass

            # Trigger dynamic SOAR automations (Telegram notifications, ticketing escalation, blocklist triggers)
            await self.trigger_automations(session, alert_payload)
            
        except Exception as e:
            logger.error(f"Error creating alert: {e}")

    async def trigger_automations(self, session, alert: Dict[str, Any]):
        """Evaluate alert against SOAR playbooks and send Telegram dispatches"""
        try:
            # 1. Dispatch Telegram Alerts dynamically
            from app.integrations.telegram_bot import TelegramAlertBot
            telegram_bot = TelegramAlertBot()
            
            if alert.get("severity") in ["critical", "high"]:
                await telegram_bot.send_critical_alert(alert)
            else:
                await telegram_bot.send_alert(alert)
                
            # 2. Evaluate SOAR Automation Rules
            from app.api.v1.endpoints_integrations import get_active_automation_rules
            from app.integrations.ticketing_service import AutomationRuleEngine
            
            rules = get_active_automation_rules()
            engine = AutomationRuleEngine()
            for rule in rules:
                if rule.get("enabled", True):
                    engine.add_rule(rule)
                    
            alert_eval_data = {
                "severity": alert.get("severity"),
                "mitre_tactics": alert.get("mitre_tactics", []),
                "detection_type": alert.get("detection_type")
            }
            
            for rule in rules:
                if not rule.get("enabled", True):
                    continue
                if engine._match_rule(rule, alert_eval_data):
                    action = rule.get("action")
                    logger.info(f"⚡ Alert {alert['id']} matched SOAR playbook: {rule['name']} (Action: {action})")
                    
                    # Action A: Create Internal Ticket
                    if action in ["create_ticket", "create_ticket_urgent", "create_ticket_with_response"]:
                        import uuid
                        ticket_payload = {
                            "id": f"TCK-{str(uuid.uuid4())[:8].upper()}",
                            "alert_id": alert["id"],
                            "title": f"[{alert['severity'].upper()}] [SOAR] {alert['title']}",
                            "description": f"Automated SOAR Escalation ticket created by rule: {rule['name']}.\n\nAlert details: {alert['description']}",
                            "severity": alert["severity"],
                            "priority": rule.get("ticket_priority", "3"),
                            "status": "open",
                            "assigned_to": "Unassigned",
                            "notes": [{"user": "SOAR Engine", "note": f"Ticket escalated automatically by playbook: {rule['name']}", "timestamp": datetime.utcnow().isoformat()}]
                        }
                        await self.db.create_ticket(session, ticket_payload)
                        
                        # Update Alert notes
                        alert_notes = alert.get("notes") or []
                        alert_notes.append({
                            "type": "soar_escalation",
                            "ticket_id": ticket_payload["id"],
                            "rule_name": rule["name"],
                            "timestamp": datetime.utcnow().isoformat()
                        })
                        await self.db.update_alert(session, alert["id"], {"notes": alert_notes})
                    
                    # Action B: Auto-Mitigation (e.g. Isolate Host)
                    if action == "create_ticket_with_response" or rule.get("auto_response") == "isolate_host":
                        # Queue an isolation command response for the agent
                        import uuid
                        response_id = str(uuid.uuid4())
                        
                        # Generate cryptographic signature for agent verification
                        import hmac
                        import hashlib
                        
                        action_type = "isolate"
                        target = alert.get("hostname")
                        shared_secret = b"spyderxdr_cryptographic_verification_key_2026"
                        signature = hmac.new(
                            shared_secret,
                            f"{action_type}:{target}:{response_id}".encode(),
                            hashlib.sha256
                        ).hexdigest()
                        
                        response_payload = {
                            "id": response_id,
                            "alert_id": alert["id"],
                            "action_type": action_type,
                            "target": target,
                            "status": "pending",
                            "result": {"signature": signature},
                            "executed_by": f"SOAR Playbook: {rule['name']}",
                            "created_at": datetime.utcnow()
                        }
                        
                        # Create response in DB
                        from app.models.database import Response
                        db_response = Response(**response_payload)
                        session.add(db_response)
                        await session.commit()
                        logger.warning(f"🔒 SOAR Playbook triggered AUTOMATED Host Isolation response for agent {target}")
                        
                        # Also log to Telegram
                        await telegram_bot.log_telegram_dispatch(f"🛡️ SOAR Playbook '{rule['name']}' automatically triggered Host Isolation response for {target}.")
        except Exception as e:
            logger.error(f"Error executing alert SOAR triggers: {e}")

    
    async def process_batch(self, session, events: List[Dict[str, Any]]):
        """Process batch of events"""
        tasks = [self.process_event(session, event) for event in events]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        processed = sum(1 for r in results if not isinstance(r, Exception))
        logger.info(f"Processed batch: {processed}/{len(events)} events")
        
        return results
    
    async def correlate_alerts(self, session, time_window: int = 300):
        """Correlate related alerts (within time window)"""
        # Get recent alerts
        # Group by hostname, user, and alert type
        # Create incidents for related alerts
        pass
    
    async def update_threat_intelligence(self):
        """Update threat intelligence feeds"""
        await self.threat_intel.update_feeds()
