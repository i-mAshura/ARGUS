# 🛡️ SpyderXDR - Open-Source Extended Detection & Response Platform

<div align="center">

**Enterprise-grade threat detection, real-time telemetry ingestion, and automated incident response mapping.**

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Features](#-key-features) • [How it Works](#-architecture--data-flow) • [Tech Stack](#-how-it-was-made-tech-stack) • [Quick Start](#-quick-start) • [Attack Simulation](#-simulating-live-detections) • [Testing](#-running-tests)

</div>

---

## 📝 GitHub Repository Description
Copy this description for your GitHub repository settings:
> 🛡️ SpyderXDR is an enterprise-ready, open-source Extended Detection & Response (XDR) platform featuring real-time process, network, and registry monitoring, behavioral & anomaly ML engines, MITRE ATT&CK mapping, and automated ticketing (Jira/ServiceNow) with zero-configuration dev fallbacks.

---

## 🎯 Key Features

- **Multi-Engine Detection Pipeline**:
  - **Behavioral Detection**: Identifies process parent-child anomalies (e.g. Word spawning cmd.exe), command-line obfuscation, reflective DLL injections, and suspicious writes.
  - **Anomaly Detection**: Statistical Z-score ML baseline learning (30-day window) for user activity spikes, network anomalies, and login hours.
  - **Signature Matching**: Extensible YAML-based rule matching (supporting operators like `contains`, `starts_with`, `ends_with`, `in`, etc.).
- **MITRE ATT&CK Mapping**: All alerts are automatically enriched with MITRE ATT&CK tactics, techniques, and sub-techniques.
- **Enterprise Integrations**:
  - **Ticketing Automation**: Seamless P1 alert ticket generation for Jira, ServiceNow, and open-source ticketing platforms (Taiga, Plane).
  - **Endpoint Correlation**: Native Agent manager synchronization to enrich host status, vulnerability logs, FIM (File Integrity Monitoring), and posture score.
  - **Real-time Alerting**: Formatted Telegram bot notification routing.
- **Zero-Config Developer Sandbox**: Auto-fallbacks from PostgreSQL to SQLite (`sqlite+aiosqlite`) and Redis to an in-memory Mock Redis database allow you to launch and demo the complete project locally in 5 seconds.

---

## 🏗️ Architecture & Data Flow

```
   +-------------------------------------------------------------+
   |                       Monitored Endpoint                    |
   |   [Structured Telemetry Agent]      [Agent Agent]           |
   +---------------------+---------------------+-----------------+
                         |                     |
           (JSON Ingest) |                     | (Agent Ingest)
                         ▼                     ▼
   +-------------------------------------------------------------+
   |                       FastAPI Backend                       |
   |              /api/v1/events/ingest  |  /agent/connect       |
   +-----------------------------+-------------------------------+
                                 |
                                 ▼
   +-------------------------------------------------------------+
   |                      Detection Engine                       |
   |   [Behavioral Engine]  [Anomaly Engine]  [Signature Engine] |
   +-----------------------------+-------------------------------+
                                 |
                                 ▼
   +-----------------------------+-------------------------------+
   |                      Alert Manager                          |
   |   - De-duplication   - Correlation   - TI Enrichment        |
   +-----------------------------+-------------------------------+
                                 |
         +-----------------------+-----------------------+
         |                       |                       |
         ▼                       ▼                       ▼
+-----------------+     +-----------------+     +-----------------+
|   PostgreSQL    |     |      Redis      |     |  Notification/  |
|  (Or SQLite DB) |     |  (Or In-Memory) |     |    Ticketing    |
|   Alert Logs    |     |  Real-Time Cache|     | (Jira/Telegram) |
+--------+--------+     +--------+--------+     +--------+--------+
         |                       |                       |
         +-----------+-----------+                       |
                     ▼                                   ▼
   +-----------------------------------+        +-----------------+
   |      React UI Web Dashboard       |        |   Jira Board    |
   |   Live Charts & Alerts Triage     |        | Telegram Client |
   +-----------------------------------+        +-----------------+
```

1. **Telemetry Capture**: Structured OS Agents record active process, network connections, registry adjustments, and file modifications on endpoints.
2. **Ingestion**: Agents stream batches of telemetry to the `/api/v1/events/ingest` endpoint.
3. **Detection Pipeline**: Events pass concurrently through Behavioral, Anomaly, and Signature detection engines.
4. **Alert Lifecycle**: Detections are correlated and mapped to MITRE ATT&CK. Auto-ticket routing rule evaluates alerts to trigger P1 ServiceNow/Jira incidents and ping Telegram channels.
5. **Triage Console**: Security analysts inspect alerts and execute host isolation or threat hunting queries directly from the React dashboard.

---

## 🛠️ How It Was Made (Tech Stack)

The system is split into three clean layers to maximize performance, scalability, and developer experience:

- **Backend (Python)**:
  - **FastAPI**: Asynchronous REST API routing.
  - **SQLAlchemy & aiosqlite**: High-performance asynchronous database access.
  - **pytest & pytest-asyncio**: Clean modular test runner with standard asyncio loop scopes.
  - **Pydantic v2**: Type enforcement and input request validations.
- **Frontend (Javascript & React)**:
  - **Vite**: Ultra-fast bundle building.
  - **Material UI**: Modern dashboard layouts and widgets.
  - **Zustand**: Lightweight global state management.
  - **Recharts**: Responsive real-time telemetry telemetry charts.
- **Endpoint Agent (Python)**:
  - Raw PowerShell interface wrapper executing `Get-CimInstance` and `Get-NetTCPConnection` to stream live OS telemetry.

---

## 🚀 Quick Start

### 1. Backend Server Setup
Navigate to the `backend` directory, create a virtual environment, install the dependencies, and start the hot-reloading API server:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # On macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```
*Note: The API server automatically connects to local SQLite (`database/spyderxdr.db`) and initializes in-memory Redis mocks if PostgreSQL or Redis are not running, making local sandboxing instant.*

### 2. Frontend Dashboard Setup
Navigate to the `frontend` directory, install packages, and launch Vite:
```bash
cd ../frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Deploy the Windows Endpoint Agent
To start guarding your host machine, run the agent script:
```bash
cd ..
backend\.venv\Scripts\python agents\windows\agent.py
```

---

## 🧪 Simulating Live Detections

To verify that the agent is guarding your host machine and sending alerts, open a Command Prompt or PowerShell and trigger one of the built-in detection rules:

- **Command Line Obfuscation Alert**:
  ```cmd
  c^m^d.e^xe /c echo "SpyderXDR Obfuscation Test"
  ```
- **Registry Manipulation Alert**:
  ```cmd
  reg add HKCU\Software\SpyderXDRTest /v testValue /t REG_SZ /d "demo" /f
  ```
The agent collects telemetry every **20 seconds**. Once submitted, the detection will trigger, and the alert will automatically populate on your React dashboard!

---

## 🚦 Running Tests

The backend includes a comprehensive testing suite utilizing `pytest` to test the detection engines, third-party integrations, and API endpoints using in-memory databases and client mocking:

```bash
cd backend
.venv\Scripts\python -m pytest -v
```

Expected output:
```bash
tests/test_api_endpoints.py::test_health_endpoints PASSED
tests/test_api_endpoints.py::test_integrations_status PASSED
tests/test_api_endpoints.py::test_dashboard_summary PASSED
tests/test_api_endpoints.py::test_event_ingestion_and_retrieval PASSED
tests/test_api_endpoints.py::test_ticket_creation_endpoints PASSED
tests/test_detection_engines.py::test_behavioral_process_detection PASSED
tests/test_detection_engines.py::test_behavioral_network_detection PASSED
tests/test_detection_engines.py::test_behavioral_file_detection PASSED
tests/test_detection_engines.py::test_anomaly_detection PASSED
tests/test_detection_engines.py::test_signature_detection PASSED
tests/test_integrations.py::test_ticket_payload_mapping PASSED
tests/test_integrations.py::test_jira_ticket_creation PASSED
tests/test_integrations.py::test_servicenow_ticket_creation PASSED
tests/test_integrations.py::test_automation_rules_evaluation PASSED
tests/test_integrations.py::test_agent_integration_mapping PASSED
tests/test_integrations.py::test_telegram_bot_formatting PASSED
tests/test_integrations.py::test_threat_intelligence_check PASSED

============================= 17 passed in 4.66s ==============================
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
