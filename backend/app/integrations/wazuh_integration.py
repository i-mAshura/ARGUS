"""
Compatibility layer for Wazuh Integration. Exposes legacy classes for test compatibility.
"""
from app.integrations.agent_integration import AgentIntegrationService as WazuhIntegrationService
from typing import Dict, Any

class WazuhVulnerabilityMapper:
    @staticmethod
    def convert_to_alert(wazuh_vuln: Dict) -> Dict[str, Any]:
        return {
            "id": f"wazuh_vuln_{wazuh_vuln.get('vuln_id')}",
            "title": f"Vulnerability: {wazuh_vuln.get('name')}",
            "description": f"CVE: {wazuh_vuln.get('cve_id', 'N/A')}",
            "severity": wazuh_vuln.get("severity", "medium"),
            "detection_type": "vulnerability",
            "source": "wazuh_vulnerability_scanner",
            "indicators": {
                "package": wazuh_vuln.get("package"),
                "version": wazuh_vuln.get("version"),
                "cve_id": wazuh_vuln.get("cve_id")
            }
        }
