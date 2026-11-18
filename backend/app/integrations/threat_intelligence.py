"""Threat Intelligence integration"""
import logging
import aiohttp
import os
from typing import List, Dict

logger = logging.getLogger(__name__)

class ThreatIntelligenceService:
    """Threat Intelligence integration and lookups"""
    
    def __init__(self, db, redis_service):
        self.db = db
        self.redis = redis_service
        self.ti_feeds = []
    
    async def check_indicators(self, event: Dict) -> List[Dict]:
        """Check event indicators against threat intelligence"""
        alerts = []
        
        # Check IP addresses
        if event.get("source_ip"):
            if await self._is_malicious_ip(event.get("source_ip")):
                alerts.append({
                    "type": "threat_intel",
                    "severity": "high",
                    "reason": f"Malicious IP detected: {event.get('source_ip')}",
                    "details": {"ip": event.get("source_ip")}
                })
        
        # Check domains
        if event.get("domain"):
            if await self._is_malicious_domain(event.get("domain")):
                alerts.append({
                    "type": "threat_intel",
                    "severity": "high",
                    "reason": f"Malicious domain detected: {event.get('domain')}",
                    "details": {"domain": event.get("domain")}
                })
        
        # Check file hashes
        file_hash = event.get("file_hash") or event.get("event_data", {}).get("md5") or event.get("event_data", {}).get("file_hash")
        if file_hash:
            if await self._is_malicious_hash(file_hash):
                alerts.append({
                    "type": "threat_intel",
                    "severity": "critical",
                    "reason": f"Known malware detected: {file_hash}",
                    "details": {"hash": file_hash}
                })
        
        return alerts
    
    async def _is_malicious_ip(self, ip: str) -> bool:
        """Check if IP is in threat intelligence"""
        cache_key = f"ti:ip:{ip}"
        
        # Check cache first
        cached = await self.redis.get(cache_key)
        if cached is not None:
            return cached.get("malicious", False)
        
        # Check against threat feeds
        is_malicious = await self._query_threat_feeds(ip, "ip")
        
        # Cache result
        await self.redis.set(cache_key, {"malicious": is_malicious}, ttl=86400)
        
        return is_malicious
    
    async def _is_malicious_domain(self, domain: str) -> bool:
        """Check if domain is in threat intelligence"""
        cache_key = f"ti:domain:{domain}"
        
        cached = await self.redis.get(cache_key)
        if cached is not None:
            return cached.get("malicious", False)
        
        is_malicious = await self._query_threat_feeds(domain, "domain")
        
        await self.redis.set(cache_key, {"malicious": is_malicious}, ttl=86400)
        
        return is_malicious
    
    async def _is_malicious_hash(self, hash_value: str) -> bool:
        """Check if file hash is in threat intelligence"""
        cache_key = f"ti:hash:{hash_value}"
        
        cached = await self.redis.get(cache_key)
        if cached is not None:
            return cached.get("malicious", False)
        
        is_malicious = await self._query_threat_feeds(hash_value, "hash")
        
        await self.redis.set(cache_key, {"malicious": is_malicious}, ttl=86400)
        
        return is_malicious
    
    async def _query_threat_feeds(self, indicator: str, indicator_type: str) -> bool:
        """Query external threat intelligence feeds like VirusTotal"""
        from app.integrations.config_helper import get_integration_config
        
        # Load VT config from integrations.json
        vt_config = get_integration_config("virustotal") or {}
        vt_api_key = vt_config.get("api_key") or os.getenv("VIRUSTOTAL_API_KEY")
        
        # Built-in index of known malicious indicators for demo / offline environment
        known_malicious = {
            "hash": [
                "7b22a6c1e95e865611f7c32bf28a8f6d",  # Simulated mimikatz hash
                "3c990b79e2a875ba2cf6d628ff3a19b6",
                "ab39cc8939cbf81efcd1283eac7a91bb",
                "44d88612fea8a8f36de82e1278abb02f",  # Eicar test file standard hash
            ],
            "ip": [
                "185.220.101.4",  # Known Tor exit node
                "198.51.100.42"   # Test malicious IP
            ],
            "domain": [
                "malicious-c2.com",
                "evil-download.ru"
            ]
        }
        
        # Check against built-in intelligence index first
        if indicator in known_malicious.get(indicator_type, []):
            return True
            
        # If API key is present, execute actual VirusTotal query
        if indicator_type == "hash" and vt_api_key:
            try:
                headers = {"x-apikey": vt_api_key}
                async with aiohttp.ClientSession() as session:
                    async with session.get(f"https://www.virustotal.com/api/v3/files/{indicator}", headers=headers, timeout=5) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
                            malicious_count = stats.get("malicious", 0)
                            # If 2 or more AV engines flag it, count as malicious
                            if malicious_count >= 2:
                                return True
            except Exception as e:
                logger.error(f"Error querying VirusTotal API: {e}")
                
        return False
    
    async def update_feeds(self):
        """Update threat intelligence feeds"""
        logger.info("Updating threat intelligence feeds...")
        
        # Placeholder for feed updates
        pass
    
    async def add_custom_indicator(self, indicator: str, indicator_type: str, threat_type: str):
        """Add custom threat indicator"""
        cache_key = f"ti:{indicator_type}:{indicator}"
        await self.redis.set(
            cache_key,
            {
                "malicious": True,
                "type": threat_type,
                "source": "custom"
            },
            ttl=2592000  # 30 days
        )
