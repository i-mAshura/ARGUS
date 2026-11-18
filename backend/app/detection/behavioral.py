"""
Behavioral Detection Engine
Analyzes user and process behavior for anomalies
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json

logger = logging.getLogger(__name__)

class BehavioralDetectionEngine:
    """Detects abnormal user and process behavior"""
    
    def __init__(self, db, redis_service):
        self.db = db
        self.redis = redis_service
    
    async def analyze_process_behavior(
        self,
        session,
        hostname: str,
        username: str,
        process_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Detect abnormal process behavior"""
        alerts = []
        
        # Check for suspicious process characteristics
        suspicious_patterns = await self._check_process_patterns(process_data)
        if suspicious_patterns:
            alerts.extend(suspicious_patterns)
        
        # Check for unexpected parent-child relationships
        parent_alert = await self._check_parent_process(process_data)
        if parent_alert:
            alerts.append(parent_alert)
        
        # Check for process injection attempts
        injection_alert = await self._check_process_injection(process_data)
        if injection_alert:
            alerts.append(injection_alert)
        
        return alerts
    
    async def analyze_network_behavior(
        self,
        session,
        hostname: str,
        user: str,
        network_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Detect abnormal network behavior"""
        alerts = []
        
        # Check for data exfiltration patterns
        exfil_alert = await self._check_data_exfiltration(network_data)
        if exfil_alert:
            alerts.append(exfil_alert)
        
        # Check for C2 communication patterns
        c2_alert = await self._check_c2_patterns(network_data)
        if c2_alert:
            alerts.append(c2_alert)
        
        # Check for scanning activities
        scan_alert = await self._check_scanning(network_data)
        if scan_alert:
            alerts.append(scan_alert)
        
        return alerts
    
    async def analyze_file_behavior(
        self,
        hostname: str,
        username: str,
        file_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Detect abnormal file operations"""
        alerts = []
        
        # Check for living-off-the-land binaries abuse
        lotl_alert = await self._check_lotl_abuse(file_data)
        if lotl_alert:
            alerts.append(lotl_alert)
        
        # Check for suspicious file writes to system directories
        system_write_alert = await self._check_system_directory_writes(file_data)
        if system_write_alert:
            alerts.append(system_write_alert)
        
        # Check for script/macro execution
        script_alert = await self._check_script_execution(file_data)
        if script_alert:
            alerts.append(script_alert)
        
        return alerts
    
    async def _check_process_patterns(self, process_data: Dict) -> List[Dict]:
        """Check for suspicious process patterns"""
        alerts = []
        
        # Command line obfuscation detection
        cmdline = process_data.get("command_line", "").lower()
        if self._is_obfuscated(cmdline):
            alerts.append({
                "type": "behavioral",
                "severity": "high",
                "reason": "Command line obfuscation detected",
                "details": {"obfuscation_type": "encoded_characters"},
                "mitre_tactics": ["Defense Evasion"],
                "mitre_techniques": ["T1027"]
            })
        
        # Suspicious encoding/decoding
        if any(enc in cmdline for enc in ["base64", "powershell", "encode", "decode"]):
            alerts.append({
                "type": "behavioral",
                "severity": "medium",
                "reason": "Data encoding/decoding detected",
                "details": {"pattern": "encoding_execution"},
                "mitre_tactics": ["Execution", "Defense Evasion"],
                "mitre_techniques": ["T1059.001", "T1027"]
            })
        
        # Registry manipulation
        if any(reg in cmdline for reg in ["reg add", "reg delete", "regedit"]):
            alerts.append({
                "type": "behavioral",
                "severity": "medium",
                "reason": "Registry manipulation detected",
                "details": {"pattern": "registry_modification"},
                "mitre_tactics": ["Persistence"],
                "mitre_techniques": ["T1547.001"]
            })
        
        return alerts
    
    async def _check_parent_process(self, process_data: Dict) -> Dict:
        """Detect suspicious parent-child process relationships"""
        process_name = process_data.get("image", "").lower()
        parent_name = process_data.get("parent_image", "").lower()
        
        # Suspicious parent processes
        suspicious_parents = {
            "winword.exe": ["cmd.exe", "powershell.exe", "wscript.exe"],
            "excel.exe": ["cmd.exe", "powershell.exe", "wscript.exe"],
            "outlook.exe": ["cmd.exe", "powershell.exe"],
            "explorer.exe": ["cmd.exe", "powershell.exe", "reg.exe"],
        }
        
        for parent, children in suspicious_parents.items():
            if parent_name.endswith(parent):
                for child in children:
                    if process_name.endswith(child):
                        return {
                            "type": "behavioral",
                            "severity": "high",
                            "reason": f"Suspicious parent-child: {parent} -> {process_name}",
                            "details": {"parent": parent, "child": process_name},
                            "mitre_tactics": ["Execution", "Defense Evasion"],
                            "mitre_techniques": ["T1059"]
                        }
        
        return None
    
    async def _check_process_injection(self, process_data: Dict) -> Dict:
        """Detect process injection attempts"""
        if process_data.get("injection_detected"):
            return {
                "type": "behavioral",
                "severity": "critical",
                "reason": "Process injection detected",
                "details": {"injection_method": process_data.get("injection_type")},
                "mitre_tactics": ["Defense Evasion", "Execution"],
                "mitre_techniques": ["T1055"]
            }
        return None
    
    async def _check_data_exfiltration(self, network_data: Dict) -> Dict:
        """Detect potential data exfiltration"""
        bytes_sent = network_data.get("bytes_sent", 0)
        bytes_received = network_data.get("bytes_received", 0)
        
        # Large outbound data transfer
        if bytes_sent > 100 * 1024 * 1024:  # 100MB
            return {
                "type": "behavioral",
                "severity": "high",
                "reason": "Large data transfer detected",
                "details": {"bytes_sent": bytes_sent},
                "mitre_tactics": ["Exfiltration"],
                "mitre_techniques": ["T1020"]
            }
        
        # Suspicious destination IPs
        dest_ip = network_data.get("destination_ip", "")
        if self._is_suspicious_ip(dest_ip):
            return {
                "type": "behavioral",
                "severity": "high",
                "reason": "Connection to suspicious destination",
                "details": {"destination": dest_ip},
                "mitre_tactics": ["Command and Control"],
                "mitre_techniques": ["T1071"]
            }
        
        return None
    
    async def _check_c2_patterns(self, network_data: Dict) -> Dict:
        """Detect C2 communication patterns"""
        # Check for beaconing behavior
        if network_data.get("beaconing_detected"):
            return {
                "type": "behavioral",
                "severity": "critical",
                "reason": "C2 beaconing pattern detected",
                "details": {"interval": network_data.get("beacon_interval")},
                "mitre_tactics": ["Command and Control"],
                "mitre_techniques": ["T1071"]
            }
        
        # Check for DNS tunneling
        if network_data.get("dns_query_count", 0) > 50 and network_data.get("protocol") == "dns":
            return {
                "type": "behavioral",
                "severity": "high",
                "reason": "Potential DNS tunneling detected",
                "details": {"query_count": network_data.get("dns_query_count")},
                "mitre_tactics": ["Command and Control", "Exfiltration"],
                "mitre_techniques": ["T1071.004"]
            }
        
        return None
    
    async def _check_scanning(self, network_data: Dict) -> Dict:
        """Detect scanning activities"""
        unique_ports = network_data.get("unique_destination_ports", 0)
        unique_hosts = network_data.get("unique_destination_hosts", 0)
        
        if unique_ports > 100:
            return {
                "type": "behavioral",
                "severity": "high",
                "reason": "Port scanning detected",
                "details": {"ports_scanned": unique_ports},
                "mitre_tactics": ["Discovery"],
                "mitre_techniques": ["T1046"]
            }
        
        if unique_hosts > 50:
            return {
                "type": "behavioral",
                "severity": "high",
                "reason": "Host scanning detected",
                "details": {"hosts_scanned": unique_hosts},
                "mitre_tactics": ["Discovery"],
                "mitre_techniques": ["T1046"]
            }
        
        return None
    
    async def _check_lotl_abuse(self, file_data: Dict) -> Dict:
        """Detect living-off-the-land binaries abuse"""
        lotl_binaries = [
            "rundll32", "regsvcs", "regasm", "regsvr32",
            "msbuild", "csc.exe", "scrcons", "certutil",
            "makecab", "wmic", "psexec", "psloggedon"
        ]
        
        process_name = file_data.get("process_name", "").lower()
        for binary in lotl_binaries:
            if binary in process_name:
                return {
                    "type": "behavioral",
                    "severity": "high",
                    "reason": f"LOTL binary abuse: {binary}",
                    "details": {"binary": binary},
                    "mitre_tactics": ["Defense Evasion"],
                    "mitre_techniques": ["T1218"]
                }
        
        return None
    
    async def _check_system_directory_writes(self, file_data: Dict) -> Dict:
        """Detect suspicious writes to system directories"""
        path = file_data.get("file_path", "").lower()
        system_paths = [
            "\\windows\\system32\\",
            "\\windows\\syswow64\\",
            "c:\\program files\\",
            "\\drivers\\etc\\",
        ]
        
        for sys_path in system_paths:
            if sys_path in path and file_data.get("action") == "write":
                return {
                    "type": "behavioral",
                    "severity": "high",
                    "reason": f"Suspicious write to system path: {path}",
                    "details": {"path": path},
                    "mitre_tactics": ["Persistence", "Defense Evasion"],
                    "mitre_techniques": ["T1543.003"]
                }
        
        return None
    
    async def _check_script_execution(self, file_data: Dict) -> Dict:
        """Detect script/macro execution"""
        script_extensions = [".ps1", ".vbs", ".js", ".bat", ".cmd", ".scr"]
        file_name = file_data.get("file_name", "").lower()
        
        for ext in script_extensions:
            if file_name.endswith(ext):
                return {
                    "type": "behavioral",
                    "severity": "medium",
                    "reason": f"Script execution detected: {file_name}",
                    "details": {"extension": ext},
                    "mitre_tactics": ["Execution"],
                    "mitre_techniques": ["T1059"]
                }
        
        return None
    
    def _is_obfuscated(self, text: str) -> bool:
        """Check if command line is obfuscated"""
        obfuscation_patterns = [
            "^",  # Caret obfuscation
            "`",  # Backtick obfuscation
            "${{",  # Variable expansion
        ]
        return any(pattern in text for pattern in obfuscation_patterns)
    
    def _is_suspicious_ip(self, ip: str) -> bool:
        """Check if IP is suspicious"""
        # Placeholder for threat intelligence lookup
        # In production, query threat intelligence database
        return False
