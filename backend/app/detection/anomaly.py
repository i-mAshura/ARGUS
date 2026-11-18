"""
Anomaly Detection Engine
Uses statistical analysis and ML for anomaly detection
"""
import logging
from typing import Dict, Any, List, Tuple
import numpy as np
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class AnomalyDetectionEngine:
    """Detects anomalous behavior using statistical analysis"""
    
    def __init__(self, db, redis_service):
        self.db = db
        self.redis = redis_service
    
    async def detect_anomalies(
        self,
        session,
        hostname: str,
        username: str,
        event_type: str,
        event_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Detect anomalies in user/system behavior"""
        alerts = []
        
        # Get baseline for this host/user
        baseline = await self.db.get_baseline(session, hostname, event_type)
        
        if not baseline:
            # No baseline yet, build one
            await self._build_baseline(session, hostname, username, event_type)
            return alerts
        
        # Compare current activity against baseline
        anomaly_score = await self._calculate_anomaly_score(
            event_data,
            baseline.baseline_data
        )
        
        if anomaly_score > 0.7:  # 70% threshold
            alerts.append({
                "type": "anomaly",
                "severity": self._severity_from_score(anomaly_score),
                "reason": "Anomalous behavior detected",
                "details": {
                    "anomaly_score": anomaly_score,
                    "event_type": event_type,
                    "deviations": await self._get_deviations(event_data, baseline.baseline_data)
                }
            })
        
        return alerts
    
    async def _build_baseline(
        self,
        session,
        hostname: str,
        username: str,
        behavior_type: str
    ):
        """Build behavioral baseline from historical data"""
        from sqlalchemy import select, func
        from app.models.database import Event
        
        # Query total historical event counts for this host/type to establish baseline parameters
        query = select(func.count(Event.id)).where(
            Event.hostname == hostname,
            Event.event_type == behavior_type
        )
        result = await session.execute(query)
        historical_count = result.scalar() or 0
        
        # Calculate statistical baselines dynamically based on counts
        mean_val = max(historical_count / 10.0, 5.0)
        std_val = max(mean_val * 0.15, 1.0)
        
        baseline_data = {
            "mean": mean_val,
            "std_dev": std_val,
            "min": max(mean_val - 2 * std_val, 0),
            "max": mean_val + 2 * std_val,
            "process_count_mean": mean_val,
            "process_count_std": std_val,
            "network_connection_mean": mean_val * 0.8,
            "network_connection_std": std_val * 0.8,
            "file_write_mean": mean_val * 0.5,
            "file_write_std": std_val * 0.5,
            "learned_date": datetime.utcnow().isoformat()
        }
        
        await self.db.update_baseline(
            session,
            hostname,
            username,
            behavior_type,
            baseline_data
        )
    
    async def _calculate_anomaly_score(
        self,
        current_event: Dict,
        baseline: Dict
    ) -> float:
        """Calculate anomaly score (0-1) for current event"""
        score = 0.0
        
        # Process count anomaly
        if "process_count" in current_event:
            score += self._calculate_deviation_score(
                current_event["process_count"],
                baseline.get("process_count_mean", 0),
                baseline.get("process_count_std", 1)
            )
        
        # Network connection count anomaly
        if "network_connection_count" in current_event:
            score += self._calculate_deviation_score(
                current_event["network_connection_count"],
                baseline.get("network_connection_mean", 0),
                baseline.get("network_connection_std", 1)
            )
        
        # File write count anomaly
        if "file_write_count" in current_event:
            score += self._calculate_deviation_score(
                current_event["file_write_count"],
                baseline.get("file_write_mean", 0),
                baseline.get("file_write_std", 1)
            )
        
        # Normalize score to 0-1 range
        return min(score / 3.0, 1.0)
    
    def _calculate_deviation_score(
        self,
        current_value: float,
        mean: float,
        std_dev: float
    ) -> float:
        """Calculate deviation score using z-score"""
        if std_dev == 0:
            return 0.0 if current_value == mean else 1.0
        
        z_score = abs((current_value - mean) / std_dev)
        # Convert z-score to 0-1 using sigmoid function
        return 1.0 / (1.0 + np.exp(-z_score))
    
    async def _get_deviations(
        self,
        current_event: Dict,
        baseline: Dict
    ) -> Dict[str, float]:
        """Get list of deviations from baseline"""
        deviations = {}
        
        metrics = [
            "process_count",
            "network_connection_count",
            "file_write_count",
            "registry_modifications",
            "login_count"
        ]
        
        for metric in metrics:
            if metric in current_event:
                baseline_mean = baseline.get(f"{metric}_mean", 0)
                current = current_event[metric]
                if baseline_mean > 0:
                    deviation_pct = ((current - baseline_mean) / baseline_mean) * 100
                    deviations[metric] = deviation_pct
        
        return deviations
    
    def _severity_from_score(self, score: float) -> str:
        """Determine severity from anomaly score"""
        if score > 0.9:
            return "critical"
        elif score > 0.8:
            return "high"
        elif score > 0.7:
            return "medium"
        else:
            return "low"
    
    async def detect_user_behavior_anomaly(
        self,
        session,
        hostname: str,
        username: str,
        behavior_pattern: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Detect anomalies in user behavior patterns"""
        alerts = []
        
        # Login time anomaly
        if await self._is_unusual_login_time(hostname, username, behavior_pattern.get("login_hour")):
            alerts.append({
                "type": "anomaly",
                "severity": "medium",
                "reason": "Unusual login time detected",
                "details": {"login_hour": behavior_pattern.get("login_hour")}
            })
        
        # Location anomaly
        if await self._is_unusual_location(username, behavior_pattern.get("location")):
            alerts.append({
                "type": "anomaly",
                "severity": "medium",
                "reason": "Unusual login location detected",
                "details": {"location": behavior_pattern.get("location")}
            })
        
        # Activity rate anomaly
        if await self._is_unusual_activity_rate(hostname, username):
            alerts.append({
                "type": "anomaly",
                "severity": "low",
                "reason": "Unusual activity rate detected",
                "details": {}
            })
        
        return alerts
    
    async def _is_unusual_login_time(
        self,
        hostname: str,
        username: str,
        login_hour: int
    ) -> bool:
        """Check if login time is unusual for this user"""
        # Placeholder for ML model that learns typical login hours
        # Typically 6am-10pm is normal for business users
        if login_hour < 6 or login_hour > 22:
            return True
        return False
    
    async def _is_unusual_location(
        self,
        username: str,
        location: str
    ) -> bool:
        """Check if login location is unusual for this user"""
        # Placeholder for geolocation-based anomaly detection
        return False
    
    async def _is_unusual_activity_rate(
        self,
        hostname: str,
        username: str
    ) -> bool:
        """Check if user activity rate is unusual"""
        # Get user's typical activity rate
        cache_key = f"user_activity_rate:{hostname}:{username}"
        
        # Placeholder for activity rate analysis
        return False
