import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import func, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.database import Alert, Event, Sensor
from app.services.database import Database


async def main():
    db = Database()
    await db.connect()
    try:
        async for session in db.get_session():
            sensor_count = await session.scalar(select(func.count(Sensor.id))) or 0
            alert_count = await session.scalar(select(func.count(Alert.id))) or 0
            event_count = await session.scalar(select(func.count(Event.id))) or 0

            if sensor_count == 0:
                session.add_all([
                    Sensor(id="sensor-seed-01", name="Edge Gateway Sensor", sensor_type="network", status="active", ip_address="192.168.10.10", location="DMZ", event_type_feed="zeek", events_processed=1280),
                    Sensor(id="sensor-seed-02", name="Cloud Syslog Probe", sensor_type="syslog", status="active", ip_address="10.12.0.20", location="Cloud", event_type_feed="syslog", events_processed=950),
                    Sensor(id="sensor-seed-03", name="Deception Honeyprobe", sensor_type="honeypot", status="degraded", ip_address="172.16.8.40", location="Internal", event_type_feed="honeypot", events_processed=310),
                ])

            if alert_count == 0:
                now = datetime.utcnow()
                session.add_all([
                    Alert(id="alert-seed-01", title="RDP brute-force attempt", description="Multiple failed RDP sign-ins detected from 192.168.10.55.", severity="high", status="new", source_event_ids=["evt-seed-01"], rule_id="rule-seed-01", detection_type="behavioral", indicators=["192.168.10.55"], mitre_tactics=["Credential Access"], mitre_techniques=["T1110"], first_seen=now - timedelta(hours=2), last_seen=now, occurrences=4, hostname="edge-gw-01", user="analyst", assigned_to="SOC", notes=[], artifacts=[], created_at=now, updated_at=now),
                    Alert(id="alert-seed-02", title="PowerShell downloader observed", description="Suspicious PowerShell process attempted outbound download.", severity="critical", status="investigating", source_event_ids=["evt-seed-02"], rule_id="rule-seed-02", detection_type="signature", indicators=["powershell.exe"], mitre_tactics=["Execution"], mitre_techniques=["T1059"], first_seen=now - timedelta(hours=5), last_seen=now, occurrences=1, hostname="win-host-03", user="analyst", assigned_to="IR", notes=[], artifacts=[], created_at=now, updated_at=now),
                ])

            if event_count == 0:
                now = datetime.utcnow()
                session.add_all([
                    Event(id="evt-seed-01", timestamp=now - timedelta(minutes=15), source_ip="192.168.10.55", destination_ip="192.168.10.10", hostname="edge-gw-01", agent_id="agent-seed-01", event_type="network_connection", event_data={"protocol": "RDP", "status": "failed", "bytes": 8021}, status="new", created_at=now),
                    Event(id="evt-seed-02", timestamp=now - timedelta(minutes=28), source_ip="10.12.0.20", destination_ip="208.67.222.222", hostname="win-host-03", agent_id="agent-seed-02", event_type="process_creation", event_data={"image": "powershell.exe", "command_line": "powershell -enc ...", "user": "admin"}, status="new", created_at=now),
                    Event(id="evt-seed-03", timestamp=now - timedelta(hours=1), source_ip="172.16.8.40", destination_ip="172.16.8.1", hostname="honey-01", agent_id="agent-seed-03", event_type="vulnerability", event_data={"cve": "CVE-2024-21413", "package": "Microsoft Outlook", "severity": "critical", "cvss_score": 9.1, "status": "active"}, status="new", created_at=now),
                    Event(id="evt-seed-04", timestamp=now - timedelta(hours=2), source_ip="10.12.0.20", destination_ip="10.12.0.5", hostname="win-host-03", agent_id="agent-seed-02", event_type="compliance", event_data={"standard": "CIS Benchmark", "control_name": "Disable SMBv1", "status": "passed"}, status="new", created_at=now),
                ])

            # Always seed sysmon demo events
            sysmon_exists = await session.scalar(
                select(func.count(Event.id)).where(Event.id.in_(["evt-sysmon-01", "evt-sysmon-02"]))
            ) or 0
            if sysmon_exists < 2:
                now_sysmon = datetime.utcnow()
                if sysmon_exists > 0:
                    from sqlalchemy import delete as sa_delete
                    await session.execute(sa_delete(Event).where(Event.id.in_(["evt-sysmon-01", "evt-sysmon-02"])))
                session.add_all([
                    Event(id="evt-sysmon-01", timestamp=now_sysmon - timedelta(minutes=5), source_ip="192.168.1.100", destination_ip="10.0.0.45", hostname="win-host-03", agent_id="agent-seed-02", event_type="sysmon", event_data={"EventID": "1", "source_program": "sysmon", "log_type": "sysmon", "image": "C:\\Windows\\System32\\cmd.exe", "command_line": "cmd.exe /c whoami", "user": "SYSTEM", "parent_image": "C:\\Windows\\System32\\services.exe", "process_id": 4528, "parent_process_id": 612, "event_summary": "Process creation"}, status="new", created_at=now_sysmon),
                    Event(id="evt-sysmon-02", timestamp=now_sysmon - timedelta(minutes=3), source_ip="192.168.1.100", destination_ip="185.130.5.15", hostname="win-host-03", agent_id="agent-seed-02", event_type="sysmon", event_data={"EventID": "3", "source_program": "sysmon", "log_type": "sysmon", "image": "C:\\Windows\\System32\\powershell.exe", "process_id": 4900, "destination_ip": "185.130.5.15", "destination_port": 4444, "protocol": "TCP", "event_summary": "Network connection"}, status="new", created_at=now_sysmon),
                ])
                print("✅ Seeded 2 sysmon demo events")

            await session.commit()
            print(f"Seed summary: sensors={sensor_count}, alerts={alert_count}, events={event_count}")
    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
