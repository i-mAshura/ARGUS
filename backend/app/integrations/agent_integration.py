"""
Agent Integration Service
Integrates Agent agent data, vulnerability scanning, and threat intelligence
"""
import logging
from typing import Dict, Any, List
import httpx
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class AgentIntegrationService:
    """Integration with Agent for comprehensive threat data"""
    
    def __init__(self, agent_host: str, api_port: int, username: str, password: str):
        self.agent_host = agent_host
        self.api_port = api_port
        self.username = username
        self.password = password
        self.api_base = f"https://{agent_host}:{api_port}"
        self.token = None
    
    async def authenticate(self) -> bool:
        """Authenticate with Agent API"""
        try:
            async with httpx.AsyncClient(verify=False) as client:  # SSL verification can be disabled in dev
                response = await client.post(
                    f"{self.api_base}/security/user/authenticate",
                    auth=(self.username, self.password)
                )
                
                if response.status_code == 200:
                    self.token = response.json()["data"]["token"]
                    logger.info("✅ Authenticated with Agent API")
                    return True
                else:
                    logger.error(f"❌ Agent authentication failed: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Error authenticating with Agent: {e}")
            return False
    
    async def get_agents(self) -> List[Dict]:
        """Get all Agent agents"""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                response = await client.get(
                    f"{self.api_base}/agents",
                    headers={"Authorization": f"Bearer {self.token}"}
                )
                
                if response.status_code == 200:
                    agents = response.json()["data"]["affected_items"]
                    logger.info(f"Retrieved {len(agents)} Agent agents")
                    return agents
                else:
                    logger.error(f"Failed to get agents: {response.text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting Agent agents: {e}")
            return []
    
    async def get_vulnerabilities(self, agent_id: str = None) -> List[Dict]:
        """Get vulnerabilities from Agent Vulnerability Detection"""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                # Query vulnerabilities
                endpoint = f"{self.api_base}/vulnerability"
                params = {"select": ["vuln_id", "name", "severity", "published", "updated"]}
                
                if agent_id:
                    params["agent_id"] = agent_id
                
                response = await client.get(
                    endpoint,
                    headers={"Authorization": f"Bearer {self.token}"},
                    params=params
                )
                
                if response.status_code == 200:
                    vulnerabilities = response.json()["data"]["affected_items"]
                    logger.info(f"Retrieved {len(vulnerabilities)} vulnerabilities")
                    return vulnerabilities
                else:
                    logger.warning(f"Failed to get vulnerabilities: {response.text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting vulnerabilities: {e}")
            return []
    
    async def get_compliance_data(self) -> List[Dict]:
        """Get compliance data (CIS, PCI-DSS, GDPR, etc.)"""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                response = await client.get(
                    f"{self.api_base}/compliance",
                    headers={"Authorization": f"Bearer {self.token}"}
                )
                
                if response.status_code == 200:
                    compliance_data = response.json()["data"]["affected_items"]
                    logger.info(f"Retrieved compliance data")
                    return compliance_data
                else:
                    logger.warning(f"Failed to get compliance data: {response.text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting compliance data: {e}")
            return []
    
    async def get_threat_events(self, hours: int = 24) -> List[Dict]:
        """Get threat events from Agent in last N hours"""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                # Query Agent for high-severity events
                response = await client.get(
                    f"{self.api_base}/events",
                    headers={"Authorization": f"Bearer {self.token}"},
                    params={
                        "level": ">=7",  # High severity and above
                        "timeframe": f"{hours}h"
                    }
                )
                
                if response.status_code == 200:
                    events = response.json()["data"]["affected_items"]
                    logger.info(f"Retrieved {len(events)} threat events")
                    return events
                else:
                    logger.warning(f"Failed to get threat events: {response.text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting threat events: {e}")
            return []
    
    async def get_syscollector_data(self, agent_id: str) -> Dict[str, Any]:
        """Get system inventory from Agent Syscollector"""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                # Get installed packages/vulnerabilities
                response = await client.get(
                    f"{self.api_base}/syscollector/{agent_id}",
                    headers={"Authorization": f"Bearer {self.token}"}
                )
                
                if response.status_code == 200:
                    syscollector = response.json()["data"]["affected_items"]
                    
                    # Extract key data
                    packages = []
                    processes = []
                    ports = []
                    
                    # Agent data processing
                    for item in syscollector:
                        if item.get("type") == "package":
                            packages.append(item)
                        elif item.get("type") == "process":
                            processes.append(item)
                        elif item.get("type") == "port":
                            ports.append(item)
                    
                    return {
                        "agent_id": agent_id,
                        "packages": packages,
                        "processes": processes,
                        "listening_ports": ports,
                        "collected_at": datetime.utcnow().isoformat()
                    }
                else:
                    logger.warning(f"Failed to get syscollector data: {response.text}")
                    return {}
        except Exception as e:
            logger.error(f"Error getting syscollector data: {e}")
            return {}
    
    async def get_file_integrity_monitoring(self, agent_id: str = None) -> List[Dict]:
        """Get File Integrity Monitoring (FIM) events"""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                response = await client.get(
                    f"{self.api_base}/fim",
                    headers={"Authorization": f"Bearer {self.token}"},
                    params={"agent_id": agent_id} if agent_id else {}
                )
                
                if response.status_code == 200:
                    fim_events = response.json()["data"]["affected_items"]
                    logger.info(f"Retrieved {len(fim_events)} FIM events")
                    return fim_events
                else:
                    logger.warning(f"Failed to get FIM data: {response.text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting FIM data: {e}")
            return []
    
    async def get_rootkit_detection(self) -> List[Dict]:
        """Get rootkit detection results"""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                response = await client.get(
                    f"{self.api_base}/rootcheck",
                    headers={"Authorization": f"Bearer {self.token}"}
                )
                
                if response.status_code == 200:
                    rootkit_data = response.json()["data"]["affected_items"]
                    logger.info(f"Retrieved rootkit detection data")
                    return rootkit_data
                else:
                    logger.warning(f"Failed to get rootkit data: {response.text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting rootkit data: {e}")
            return []
    
    async def get_malware_detection(self) -> List[Dict]:
        """Get malware/threat detection from Agent"""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                response = await client.get(
                    f"{self.api_base}/logtest",
                    headers={"Authorization": f"Bearer {self.token}"}
                )
                
                if response.status_code == 200:
                    threat_data = response.json()["data"]["affected_items"]
                    logger.info(f"Retrieved threat detection data")
                    return threat_data
                else:
                    logger.warning(f"Failed to get threat data: {response.text}")
                    return []
        except Exception as e:
            logger.error(f"Error getting threat data: {e}")
            return []
    
    async def enrich_alert_with_agent(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich ARGUS alert with Agent data"""
        hostname = alert.get("hostname")
        
        try:
            # Get agent ID for this hostname
            agents = await self.get_agents()
            agent = next((a for a in agents if a.get("name") == hostname), None)
            
            if not agent:
                return alert
            
            agent_id = agent.get("id")
            
            # Enrich with vulnerability data
            vulnerabilities = await self.get_vulnerabilities(agent_id)
            alert["agent_vulnerabilities"] = vulnerabilities
            
            # Enrich with system data
            syscollector = await self.get_syscollector_data(agent_id)
            alert["agent_system"] = syscollector
            
            # Enrich with FIM data
            fim_events = await self.get_file_integrity_monitoring(agent_id)
            alert["agent_fim_events"] = fim_events[:10]  # Last 10 FIM events
            
            logger.info(f"Enriched alert {alert.get('id')} with Agent data")
            
        except Exception as e:
            logger.error(f"Error enriching alert with Agent data: {e}")
        
        return alert
    
    async def get_security_posture_score(self) -> Dict[str, Any]:
        """Calculate overall security posture from Agent data"""
        try:
            agents = await self.get_agents()
            compliance_data = await self.get_compliance_data()
            vulnerabilities = await self.get_vulnerabilities()
            
            # Calculate scores
            total_agents = len(agents)
            active_agents = len([a for a in agents if a.get("status") == "active"])
            
            critical_vuln = len([v for v in vulnerabilities if v.get("severity") == "critical"])
            high_vuln = len([v for v in vulnerabilities if v.get("severity") == "high"])
            
            # Overall risk score (0-100)
            risk_score = min(100, (critical_vuln * 10) + (high_vuln * 5))
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "total_endpoints": total_agents,
                "active_endpoints": active_agents,
                "critical_vulnerabilities": critical_vuln,
                "high_vulnerabilities": high_vuln,
                "overall_risk_score": 100 - risk_score,  # Higher is better
                "compliance_status": compliance_data,
                "posture_trend": "improving"  # Would track over time
            }
        except Exception as e:
            logger.error(f"Error calculating security posture: {e}")
            return {}

class AgentVulnerabilityMapper:
    """Maps Agent vulnerabilities to ARGUS format"""
    
    @staticmethod
    def convert_to_alert(agent_vuln: Dict) -> Dict[str, Any]:
        """Convert Agent vulnerability to ARGUS alert"""
        return {
            "id": f"agent_vuln_{agent_vuln.get('vuln_id')}",
            "title": f"Vulnerability: {agent_vuln.get('name')}",
            "description": f"CVE: {agent_vuln.get('cve_id', 'N/A')}",
            "severity": AgentVulnerabilityMapper._map_severity(agent_vuln.get("severity")),
            "detection_type": "vulnerability",
            "source": "agent_vulnerability_scanner",
            "indicators": {
                "package": agent_vuln.get("package"),
                "version": agent_vuln.get("version"),
                "cve_id": agent_vuln.get("cve_id")
            }
        }
    
    @staticmethod
    def _map_severity(agent_severity: str) -> str:
        """Map Agent severity to ARGUS severity"""
        mapping = {
            "critical": "critical",
            "high": "high",
            "medium": "medium",
            "low": "low",
            "info": "info"
        }
        return mapping.get(agent_severity, "medium")
