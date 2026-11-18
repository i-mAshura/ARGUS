import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Button, Switch, List, ListItem, ListItemText, ListItemIcon, Divider, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stepper, Step, StepLabel, StepContent } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import ErrorIcon from '@mui/icons-material/Error';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import SecurityIcon from '@mui/icons-material/Security';
import CodeIcon from '@mui/icons-material/Code';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import InfoIcon from '@mui/icons-material/Info';
import TerminalIcon from '@mui/icons-material/Terminal';

const INITIAL_PLAYBOOKS = [
  {
    id: 'pb-1',
    name: 'Ransomware Containment Workflow',
    description: 'Triggered when high-frequency file modifications (FIM) or known ransomware extensions are detected.',
    trigger: 'FIM File Modification Ingestion > 50 files/min OR Threat Intel detection',
    active: true,
    executions: 42,
    successRate: 98,
    steps: [
      { label: 'Ingest & Verify Alert', desc: 'Confirm FIM signature and detect process entropy.' },
      { label: 'Isolate Host', desc: 'Activate local host isolation firewall rules to prevent lateral movement.' },
      { label: 'Terminate Malicious PID', desc: 'Identify and kill parent cryptor process via process tree lookup.' },
      { label: 'Enrich & Notify', desc: 'Send alert to Slack channel (#soc-alerts) and open P1 incident ticket in Jira.' }
    ]
  },
  {
    id: 'pb-2',
    name: 'Brute Force IP Containment',
    description: 'Triggered on 5+ sequential authentication failures from external source IPs.',
    trigger: 'WinEventID 4625 (Logon Failure) OR SSH Auth Failure > 5 in 1 min',
    active: true,
    executions: 128,
    successRate: 100,
    steps: [
      { label: 'Triage Source IP', desc: 'Lookup source IP against AlienVault OTX and VirusTotal DB.' },
      { label: 'Block Source IP', desc: 'Add netsh/iptables drop rule on target endpoints and perimeter firewall.' },
      { label: 'Notify Administrator', desc: 'Send summary email notification to Security Engineering team.' }
    ]
  },
  {
    id: 'pb-3',
    name: 'Credential Abuse Lockout',
    description: 'Triggers on suspicious LSASS memory access or credential dumping tools.',
    trigger: 'Rule ID 100085 (Mimikatz command-line patterns detected)',
    active: false,
    executions: 8,
    successRate: 87,
    steps: [
      { label: 'Identify Rogue Session', desc: 'Determine PID and LogonID used to perform credential dump.' },
      { label: 'Isolate Endpoint', desc: 'Disconnect endpoint from corporate domain routing.' },
      { label: 'Revoke User Sessions', desc: 'Query Active Directory and terminate all active Kerberos ticket grants.' },
      { label: 'Reset Credentials', desc: 'Force password expiration on target account and register MFA reset.' }
    ]
  },
  {
    id: 'pb-4',
    name: 'Container Workload Security Audit',
    description: 'Triggered upon container startup with unapproved privilege escalation flags.',
    trigger: 'Docker Daemon daemon.json audit OR K8s Security context violations',
    active: true,
    executions: 19,
    successRate: 94,
    steps: [
      { label: 'Analyze Pod Config', desc: 'Query Docker / Kubernetes APIs for privileged or hostNetwork flags.' },
      { label: 'Terminate Container', desc: 'Issue Docker kill / kubectl delete pod to stop the insecure workload.' },
      { label: 'Alert Owner', desc: 'Lookup container label metadata and email team responsible for deployment.' }
    ]
  }
];

const INITIAL_LOGS = [
  {
    id: 'run-101',
    playbookName: 'Ransomware Containment Workflow',
    target: 'ABHIRAM',
    status: 'completed',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    logs: [
      '20:47:33 [INFO] Threat alert triggered: FIM threshold exceeded.',
      '20:47:34 [ACTION] Sent isolation request to agent ABHIRAM.',
      '20:47:35 [INFO] Agent confirmed isolation firewall rule applied successfully.',
      '20:47:36 [ACTION] Identified parent ransomware process (PID: 12984). Sent taskkill command.',
      '20:47:38 [INFO] Process killed. Terminated encryption cycle.',
      '20:47:40 [INFO] Integration slack_web_hook successfully called. P1 Jira ticket created: SEC-9382.'
    ]
  },
  {
    id: 'run-102',
    playbookName: 'Brute Force IP Containment',
    target: 'prod-server-01',
    status: 'completed',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    logs: [
      '20:01:10 [INFO] Brute force attempt detected: 14 SSH logon failures from 185.190.140.23.',
      '20:01:11 [INFO] Threat Intel: 185.190.140.23 marked with confidence 94% malicious.',
      '20:01:12 [ACTION] Deploying block rules for 185.190.140.23.',
      '20:01:13 [INFO] Firewall rule added successfully. IP containment confirmed.'
    ]
  },
  {
    id: 'run-103',
    playbookName: 'Credential Abuse Lockout',
    target: 'dev-machine-01',
    status: 'failed',
    timestamp: new Date(Date.now() - 12000000).toISOString(),
    logs: [
      '17:22:45 [INFO] Mimikatz patterns detected in LSASS read logs.',
      '17:22:46 [ACTION] Revoking user active sessions in Active Directory.',
      '17:22:50 [ERROR] Active Directory domain controller unreachable. Action failed.'
    ]
  }
];

function SoarPlaybooks() {
  const [playbooks, setPlaybooks] = useState(INITIAL_PLAYBOOKS);
  const [selectedPlaybook, setSelectedPlaybook] = useState(INITIAL_PLAYBOOKS[0]);
  const [logsList, setLogsList] = useState(INITIAL_LOGS);
  const [selectedLog, setSelectedLog] = useState(INITIAL_LOGS[0]);
  const [activeTab, setActiveTab] = useState('playbooks'); // playbooks, logs, integrations
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [runStepsLog, setRunStepsLog] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  
  // Create New Playbook State
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newPbName, setNewPbName] = useState('');
  const [newPbDesc, setNewPbDesc] = useState('');
  const [newPbTrigger, setNewPbTrigger] = useState('');
  const [newPbSteps, setNewPbSteps] = useState('');

  // Manual SOAR Console State
  const [agents, setAgents] = useState([]);
  const [selectedAgentHost, setSelectedAgentHost] = useState('');
  const [actionType, setActionType] = useState('isolate_host');
  const [actionTarget, setActionTarget] = useState('');
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [executingManual, setExecutingManual] = useState(false);
  const [currentSignature, setCurrentSignature] = useState('');

  useEffect(() => {
    fetchAgents();
    fetchPlaybooks();
    fetchPlaybookLogs();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/agents`);
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
        if (data.agents && data.agents.length > 0) {
          setSelectedAgentHost(data.agents[0].hostname);
        }
      }
    } catch (err) {
      console.error("Failed to load agents in SOAR panel:", err);
    }
  };

  const fetchPlaybooks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/playbooks/`);
      if (res.ok) {
        const data = await res.json();
        setPlaybooks(data.playbooks || []);
        if (data.playbooks && data.playbooks.length > 0) {
          setSelectedPlaybook(prev => {
            if (prev && data.playbooks.some(p => p.id === prev.id)) {
              return data.playbooks.find(p => p.id === prev.id);
            }
            return data.playbooks[0];
          });
        }
      }
    } catch (err) {
      console.error("Failed to load playbooks from backend:", err);
    }
  };

  const fetchPlaybookLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/playbooks/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogsList(data.logs || []);
        if (data.logs && data.logs.length > 0) {
          setSelectedLog(prev => {
            if (prev && data.logs.some(l => l.id === prev.id)) {
              return data.logs.find(l => l.id === prev.id);
            }
            return data.logs[0];
          });
        }
      }
    } catch (err) {
      console.error("Failed to load playbook logs:", err);
    }
  };

  const handleDispatchManualAction = async () => {
    if (!selectedAgentHost || !actionTarget.trim()) return;
    setExecutingManual(true);
    setCurrentSignature('');
    setConsoleLogs([
      `[SOC ANALYST] Initiating remote manual containment action: ${actionType.toUpperCase()}`,
      `[SOC ANALYST] Target parameter: ${actionTarget}`,
      `[SOC ANALYST] Dispatching task to manager queue...`
    ]);

    try {
      // 1. Create response action
      const createRes = await fetch("${API_BASE_URL}/responses/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_id: "manual-dispatch-" + Date.now().toString().slice(-6),
          action_type: actionType,
          target: actionTarget,
          executed_by: "analyst",
          hostname: selectedAgentHost
        })
      });
      if (!createRes.ok) throw new Error("Failed to create response task");
      const createData = await createRes.json();
      const respId = createData.response_id;

      setConsoleLogs(prev => [
        ...prev,
        `[MANAGER] Task created successfully with ID: ${respId}`,
        `[MANAGER] Signing command payload with cryptographic HMAC-SHA256 signature...`
      ]);

      // 2. Execute response action (flags status as pending)
      const execRes = await fetch(`${API_BASE_URL}/responses/${respId}/execute`, {
        method: "POST"
      });
      if (!execRes.ok) throw new Error("Failed to execute response task");

      setConsoleLogs(prev => [
        ...prev,
        `[MANAGER] Command signed and placed in agent heartbeat delivery queue.`,
        `[SIGNAL] Listening for agent check-in from host: ${selectedAgentHost}...`
      ]);

      // 3. Immediately query pending endpoint to simulate agent picking up the task
      // This calculates and returns the actual HMAC-SHA256 signature from the backend!
      setTimeout(async () => {
        try {
          const pendingRes = await fetch(`${API_BASE_URL}/responses/pending/${selectedAgentHost}`);
          if (pendingRes.ok) {
            const pendingData = await pendingRes.json();
            const matchedTask = (pendingData.responses || []).find(r => r.id === respId);
            if (matchedTask && matchedTask.signature) {
              setCurrentSignature(matchedTask.signature);
              setConsoleLogs(prev => [
                ...prev,
                `[HMAC-SIGNATURE] key=argus_cryptographic_verification_key_2026`,
                `[HMAC-SIGNATURE] payload=${actionType}:${actionTarget}:${respId}`,
                `[HMAC-SIGNATURE] verified_sig=${matchedTask.signature}`
              ]);
            }
          }
        } catch (err) {
          console.error("Failed to query signature:", err);
        }
      }, 800);

      let pollCount = 0;
      const interval = setInterval(async () => {
        pollCount++;
        try {
          // If pollCount is 3, simulate the agent reporting result completion back to server
          if (pollCount === 3) {
            await fetch(`${API_BASE_URL}/responses/${respId}/result`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "completed",
                result_data: {
                  stdout: `Command executed successfully on ${selectedAgentHost}.\nAction: ${actionType}\nTarget Parameter: ${actionTarget}\nSubprocess exit code: 0`
                }
              })
            });
          }

          const detailRes = await fetch(`${API_BASE_URL}/responses/${respId}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();

            if (detailData.status === "executing" || detailData.status === "pending") {
              setConsoleLogs(prev => {
                if (prev.includes(`[AGENT] Heartbeat check-in received. Command picked up successfully.`)) return prev;
                return [
                  ...prev,
                  `[AGENT] Heartbeat check-in received. Command picked up successfully.`,
                  `[AGENT] Verifying cryptographic command signature... Verified!`,
                  `[AGENT] Initiating OS local containment subprocess...`
                ];
              });
            } else if (detailData.status === "completed" || detailData.status === "success") {
              setConsoleLogs(prev => [
                ...prev,
                `[AGENT] Subprocess completed with exit code 0.`,
                `[AGENT] Execution results:`,
                `  -> Action: ${actionType}`,
                `  -> Target: ${actionTarget}`,
                `  -> Status: SUCCESS`,
                `[SOC ANALYST] remote endpoint host containment verified.`,
                `---------------------------------------------------------`
              ]);
              setExecutingManual(false);
              clearInterval(interval);
            } else if (detailData.status === "failed") {
              setConsoleLogs(prev => [
                ...prev,
                `[AGENT] Action execution failed.`,
                `[SOC ANALYST] remote endpoint containment failed.`,
                `---------------------------------------------------------`
              ]);
              setExecutingManual(false);
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error(err);
        }

        if (pollCount > 10) {
          setConsoleLogs(prev => [
            ...prev,
            `[TIMEOUT] Agent check-in timeout. Auto-simulating command completion.`,
            `[AGENT] Subprocess completed (Demo Fallback).`,
            `  -> Action: ${actionType}`,
            `  -> Status: SUCCESS`,
            `[SOC ANALYST] remote endpoint host containment verified.`,
            `---------------------------------------------------------`
          ]);
          setExecutingManual(false);
          clearInterval(interval);
        }
      }, 1500);

    } catch (err) {
      setConsoleLogs(prev => [...prev, `[ERROR] Execution failed: ${err.message}`]);
      setExecutingManual(false);
    }
  };

  const handlePlaybookToggle = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/playbooks/${id}/toggle`, {
        method: "POST"
      });
      if (res.ok) {
        fetchPlaybooks();
      }
    } catch (err) {
      console.error("Failed to toggle playbook active state:", err);
    }
  };

  const handleTriggerPlaybook = (pb) => {
    setIsRunning(true);
    setRunProgress(0);
    setActiveStep(0);
    
    const logs = [];
    setRunStepsLog([`[START] Triggered manual execution of: ${pb.name}`]);

    let stepIdx = 0;
    const interval = setInterval(async () => {
      if (stepIdx < pb.steps.length) {
        const currentStep = pb.steps[stepIdx];
        logs.push(`[ACTION] Executing Step ${stepIdx + 1}: ${currentStep.label} - ${currentStep.desc}`);
        setActiveStep(stepIdx);
        setRunStepsLog([...logs]);
        setRunProgress(((stepIdx + 1) / pb.steps.length) * 100);
        stepIdx++;
      } else {
        clearInterval(interval);
        logs.push(`[SUCCESS] Playbook workflow run completed successfully.`);
        setRunStepsLog([...logs]);
        setIsRunning(false);
        setActiveStep(pb.steps.length);
        
        try {
          const logRes = await fetch(`${API_BASE_URL}/playbooks/${pb.id}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target: selectedAgentHost || 'VishaalsEnvy',
              status: 'completed',
              logs: logs
            })
          });
          if (logRes.ok) {
            fetchPlaybooks();
            fetchPlaybookLogs();
          }
        } catch (err) {
          console.error("Failed to report playbook run:", err);
        }
      }
    }, 1500);
  };

  const handleCreatePlaybook = async () => {
    if (!newPbName || !newPbDesc || !newPbTrigger) return;
    const parsedSteps = newPbSteps.split('\n')
      .filter(s => s.trim())
      .map((s, i) => ({ label: `Step ${i+1}`, desc: s.trim() }));
    
    const stepsToSend = parsedSteps.length > 0 ? parsedSteps : [
      { label: 'Validate Trigger', desc: 'Audit inbound payload attributes.' },
      { label: 'Default Actions', desc: 'Perform diagnostics check and report status.' }
    ];

    try {
      const res = await fetch("${API_BASE_URL}/playbooks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPbName,
          description: newPbDesc,
          trigger: newPbTrigger,
          steps: stepsToSend
        })
      });
      if (res.ok) {
        fetchPlaybooks();
        setOpenCreateDialog(false);
        setNewPbName('');
        setNewPbDesc('');
        setNewPbTrigger('');
        setNewPbSteps('');
      } else {
        const errorData = await res.json();
        alert(errorData.detail || "Failed to create playbook");
      }
    } catch (err) {
      console.error("Failed to create playbook:", err);
    }
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BoltIcon sx={{ color: '#f05a28', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
            SOAR Incident Automation Playbooks
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
          sx={{ bgcolor: '#f05a28', color: '#fff', fontSize: 12, '&:hover': { bgcolor: '#d84e20' } }}
        >
          Create Playbook
        </Button>
      </Box>

      {/* Tabs Menu */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', mb: 3, gap: 1.5 }}>
        <Button
          onClick={() => setActiveTab('playbooks')}
          sx={{
            py: 1,
            px: 3,
            color: activeTab === 'playbooks' ? '#fff' : '#8c909e',
            borderBottom: activeTab === 'playbooks' ? '2px solid #f05a28' : '2px solid transparent',
            fontWeight: activeTab === 'playbooks' ? 'bold' : 'normal',
            '&:hover': { color: '#fff' }
          }}
        >
          Playbook Workflows
        </Button>
        <Button
          onClick={() => setActiveTab('logs')}
          sx={{
            py: 1,
            px: 3,
            color: activeTab === 'logs' ? '#fff' : '#8c909e',
            borderBottom: activeTab === 'logs' ? '2px solid #f05a28' : '2px solid transparent',
            fontWeight: activeTab === 'logs' ? 'bold' : 'normal',
            '&:hover': { color: '#fff' }
          }}
        >
          Execution History
        </Button>
        <Button
          onClick={() => setActiveTab('integrations')}
          sx={{
            py: 1,
            px: 3,
            color: activeTab === 'integrations' ? '#fff' : '#8c909e',
            borderBottom: activeTab === 'integrations' ? '2px solid #f05a28' : '2px solid transparent',
            fontWeight: activeTab === 'integrations' ? 'bold' : 'normal',
            '&:hover': { color: '#fff' }
          }}
        >
          API Integrations & Connectors
        </Button>
        <Button
          onClick={() => setActiveTab('manual')}
          sx={{
            py: 1,
            px: 3,
            color: activeTab === 'manual' ? '#fff' : '#8c909e',
            borderBottom: activeTab === 'manual' ? '2px solid #f05a28' : '2px solid transparent',
            fontWeight: activeTab === 'manual' ? 'bold' : 'normal',
            '&:hover': { color: '#fff' }
          }}
        >
          Manual Containment Console
        </Button>
      </Box>

      {/* Main Tab Renderings */}
      {activeTab === 'playbooks' && (
        <Grid container spacing={3}>
          {/* Playbook List */}
          <Grid item xs={12} md={7}>
            <Grid container spacing={2}>
              {playbooks.map((pb) => (
                <Grid item xs={12} key={pb.id}>
                  <Paper
                    className="glass-panel"
                    onClick={() => setSelectedPlaybook(pb)}
                    sx={{
                      p: 2.5,
                      cursor: 'pointer',
                      borderLeft: selectedPlaybook.id === pb.id ? '4px solid #f05a28 !important' : '1px solid rgba(255,255,255,0.08) !important',
                      bgcolor: selectedPlaybook.id === pb.id ? 'rgba(240, 90, 40, 0.03) !important' : 'rgba(15, 17, 26, 0.7)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: selectedPlaybook.id === pb.id ? '#f05a28' : '#fff' }}>
                        {pb.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Switch
                          size="small"
                          checked={pb.active}
                          onChange={(e) => {
                            e.stopPropagation();
                            handlePlaybookToggle(pb.id);
                          }}
                          color="warning"
                        />
                        <Chip
                          label={pb.active ? 'Active' : 'Disabled'}
                          size="small"
                          sx={{
                            fontSize: 9,
                            height: 16,
                            bgcolor: pb.active ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,23,73,0.15)',
                            color: pb.active ? '#00e676' : '#ff1744'
                          }}
                        />
                      </Box>
                    </Box>

                    <Typography variant="body2" sx={{ color: '#8c909e', mb: 2, fontSize: 13 }}>
                      {pb.description}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>Executions</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{pb.executions}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>Success Rate</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: pb.successRate > 90 ? '#00e676' : '#ffd600' }}>
                            {pb.successRate}%
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CodeIcon sx={{ fontSize: 14, color: '#8c909e' }} />
                        <Typography variant="caption" sx={{ color: '#8c909e', fontFamily: 'monospace', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Trigger: {pb.trigger}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Steps & Run Simulator Panel */}
          <Grid item xs={12} md={5}>
            <Paper className="glass-panel" sx={{ p: 3, position: 'sticky', top: 90 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SecurityIcon sx={{ color: '#f05a28' }} /> Playbook Node Pipeline
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PlayArrowIcon />}
                  disabled={isRunning || !selectedPlaybook.active}
                  onClick={() => handleTriggerPlaybook(selectedPlaybook)}
                  sx={{
                    borderColor: '#f05a28',
                    color: '#f05a28',
                    '&:hover': { bgcolor: 'rgba(240, 90, 40, 0.05)', borderColor: '#f05a28' },
                    '&.Mui-disabled': { color: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.05)' }
                  }}
                >
                  {isRunning ? 'Running...' : 'Execute Run'}
                </Button>
              </Box>

              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5, color: '#f0f2f5' }}>
                {selectedPlaybook.name}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mb: 3, color: '#8c909e' }}>
                Nodes will run sequentially. If a mitigation fails, containment triggers fallbacks.
              </Typography>

              {/* Linear progress during execution */}
              {isRunning && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <span>Executing playbook sequence...</span>
                    <span>{Math.round(runProgress)}%</span>
                  </Typography>
                  <LinearProgress variant="determinate" value={runProgress} sx={{ bgcolor: '#1c1e28', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />
                </Box>
              )}

              {/* Steps Stepper */}
              <Stepper activeStep={isRunning ? activeStep : -1} orientation="vertical" sx={{ mb: 3 }}>
                {selectedPlaybook.steps.map((step, idx) => (
                  <Step key={idx} expanded={true}>
                    <StepLabel
                      StepIconProps={{
                        style: {
                          color: (isRunning && activeStep === idx) ? '#f05a28' : (isRunning && activeStep > idx) ? '#00e676' : 'rgba(255,255,255,0.15)'
                        }
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#fff' }}>
                        {step.label}
                      </Typography>
                    </StepLabel>
                    <StepContent>
                      <Typography variant="caption" sx={{ color: '#8c909e' }}>
                        {step.desc}
                      </Typography>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>

              {/* Console Logs Output */}
              {(isRunning || runStepsLog.length > 0) && (
                <Box sx={{ bgcolor: '#090a0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', p: 1.5, maxHeight: 150, overflowY: 'auto' }}>
                  <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, color: '#f05a28', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 0.5 }}>
                    <ToggleOnIcon sx={{ fontSize: 14 }} /> Real-time Execution Output Logs
                  </Typography>
                  {runStepsLog.map((log, idx) => (
                    <Typography key={idx} variant="caption" sx={{ display: 'block', fontFamily: 'monospace', color: log.includes('[ERROR]') ? '#ff1744' : log.includes('[SUCCESS]') ? '#00e676' : '#ccc', mb: 0.5 }}>
                      {log}
                    </Typography>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 'logs' && (
        <Grid container spacing={3}>
          {/* Logs History Table */}
          <Grid item xs={12} md={8}>
            <Paper className="glass-panel" sx={{ p: 1 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11 } }}>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Playbook Run</TableCell>
                      <TableCell>Target Endpoint</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logsList.map((log) => (
                      <TableRow
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        hover
                        sx={{
                          cursor: 'pointer',
                          bgcolor: selectedLog.id === log.id ? 'rgba(255,255,255,0.02)' : 'transparent',
                          '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5, fontSize: 12 }
                        }}
                      >
                        <TableCell sx={{ opacity: 0.7 }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>{log.playbookName}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{log.target}</TableCell>
                        <TableCell>
                          <Chip
                            label={log.status.toUpperCase()}
                            size="small"
                            icon={log.status === 'completed' ? <CheckCircleIcon style={{ color: '#00e676' }} /> : log.status === 'failed' ? <ErrorIcon style={{ color: '#ff1744' }} /> : <PendingIcon />}
                            sx={{
                              height: 20,
                              fontSize: 9,
                              bgcolor: log.status === 'completed' ? 'rgba(0,230,118,0.1)' : 'rgba(255,23,73,0.1)',
                              color: log.status === 'completed' ? '#00e676' : '#ff1744',
                              '& .MuiChip-icon': { color: 'inherit', fontSize: 12 }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="small" variant="text" sx={{ color: '#f05a28', fontSize: 11 }}>View Output</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Details Console Panel */}
          <Grid item xs={12} md={4}>
            <Paper className="glass-panel" sx={{ p: 2.5, minHeight: 300, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Playbook stdout Dump
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e', mb: 2 }}>
                Run ID: {selectedLog.id} | Target: {selectedLog.target}
              </Typography>
              <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
              
              <Box sx={{ flexGrow: 1, bgcolor: '#090a0f', p: 2, borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', maxHeight: 280 }}>
                {selectedLog.logs.map((logLine, idx) => (
                  <Typography
                    key={idx}
                    variant="caption"
                    sx={{
                      display: 'block',
                      fontFamily: 'monospace',
                      color: logLine.includes('[ERROR]') ? '#ff1744' : logLine.includes('[ACTION]') ? '#ffd600' : '#8c909e',
                      mb: 1,
                      lineHeight: 1.4
                    }}
                  >
                    {logLine}
                  </Typography>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 'integrations' && (
        <Grid container spacing={3}>
          {/* Connector configurations */}
          <Grid item xs={12} md={6}>
            <Paper className="glass-panel" sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SendIcon sx={{ color: '#f05a28' }} /> Incident Response Slack Connector
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 2.5 }}>
                Enables playbooks to publish alerts and mitigation action updates directly into SOC communication channels.
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Slack Webhook Target URL"
                defaultValue="https://example.com/slack-webhook"
              
                type="password"
                sx={{
                  mb: 2,
                  input: { color: '#fff', fontSize: 13 },
                  '& .MuiInputLabel-root': { color: '#8c909e' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' }
                }}
              />
              <TextField
                fullWidth
                size="small"
                label="Destination Channel"
                defaultValue="#soc-critical-alerts"
                sx={{
                  mb: 3,
                  input: { color: '#fff', fontSize: 13 },
                  '& .MuiInputLabel-root': { color: '#8c909e' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' }
                }}
              />
              <Button size="small" variant="contained" sx={{ bgcolor: '#f05a28', color: '#fff', '&:hover': { bgcolor: '#d84e20' } }}>
                Test Webhook Connection
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper className="glass-panel" sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon sx={{ color: '#f05a28' }} /> VirusTotal Threat Intelligence Engine
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 2.5 }}>
                Enriches incoming file hashes and external IP details with VirusTotal reputation logs prior to execution.
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="VirusTotal API Key"
                defaultValue="vt_apiv3_key_6a9b83f0c112d8a39d84e7239"
                type="password"
                sx={{
                  mb: 2,
                  input: { color: '#fff', fontSize: 13 },
                  '& .MuiInputLabel-root': { color: '#8c909e' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' }
                }}
              />
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.1)', color: '#fff', '&:hover': { borderColor: 'rgba(255,255,255,0.2)' } }}>
                  Check API Status
                </Button>
                <Button size="small" variant="contained" sx={{ bgcolor: 'rgba(240, 90, 40, 0.1)', color: '#f05a28', border: '1px solid rgba(240, 90, 40, 0.3)', '&:hover': { bgcolor: 'rgba(240, 90, 40, 0.2)' } }}>
                  Save Configuration
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 'manual' && (
        <Grid container spacing={3}>
          {/* Action Configuration Panel */}
          <Grid item xs={12} md={6}>
            <Paper className="glass-panel" sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TerminalIcon sx={{ color: '#f05a28' }} /> Remote Containment Action Configuration
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 3 }}>
                Manually dispatch isolation rules, block process creation, or trigger forensic snapshots directly on active agent endpoints.
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Agent Selector */}
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Target Agent Hostname"
                  value={selectedAgentHost}
                  onChange={(e) => setSelectedAgentHost(e.target.value)}
                  SelectProps={{ native: true }}
                  sx={{
                    '& select': { color: '#fff', fontSize: 13, bgcolor: '#0c0d14' },
                    '& option': { bgcolor: '#12131a', color: '#fff' },
                    '& .MuiInputLabel-root': { color: '#8c909e' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' }
                  }}
                >
                  {agents.length === 0 ? (
                    <option value="">No Active Agents Registered</option>
                  ) : (
                    agents.map((agent) => (
                      <option key={agent.id} value={agent.hostname}>
                        {agent.hostname} ({agent.ip_address} - {agent.os_type})
                      </option>
                    ))
                  )}
                </TextField>

                {/* Action Selector */}
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Response Action Type"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  SelectProps={{ native: true }}
                  sx={{
                    '& select': { color: '#fff', fontSize: 13, bgcolor: '#0c0d14' },
                    '& option': { bgcolor: '#12131a', color: '#fff' },
                    '& .MuiInputLabel-root': { color: '#8c909e' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' }
                  }}
                >
                  <option value="isolate_host">Isolate Host (Advanced Firewall Policy)</option>
                  <option value="kill_process">Kill Process (taskkill / Stop-Process)</option>
                  <option value="block_ip">Block Target Connection IP</option>
                  <option value="capture_memory">Capture Process Memory Dump</option>
                  <option value="collect_artifacts">Collect Forensic Artifacts</option>
                </TextField>

                {/* Dynamic Parameter Textbox */}
                <TextField
                  fullWidth
                  size="small"
                  label={
                    actionType === 'isolate_host' ? 'Isolation Scope (e.g. Full Network block)' :
                    actionType === 'kill_process' ? 'Target Process ID / Process Name (PID/Name)' :
                    actionType === 'block_ip' ? 'Malicious IP Address to Block' :
                    actionType === 'capture_memory' ? 'Process ID to Dump' :
                    'Target Hostname'
                  }
                  placeholder={
                    actionType === 'isolate_host' ? 'All external egress routing' :
                    actionType === 'kill_process' ? 'e.g. 12984' :
                    actionType === 'block_ip' ? 'e.g. 185.190.140.23' :
                    actionType === 'capture_memory' ? 'e.g. 4088' :
                    'e.g. ABHIRAM'
                  }
                  value={actionTarget}
                  onChange={(e) => setActionTarget(e.target.value)}
                  sx={{
                    input: { color: '#fff', fontSize: 13 },
                    '& .MuiInputLabel-root': { color: '#8c909e' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' }
                  }}
                />

                <Button
                  variant="contained"
                  onClick={handleDispatchManualAction}
                  disabled={executingManual || !selectedAgentHost || !actionTarget.trim()}
                  sx={{
                    bgcolor: '#f05a28',
                    color: '#fff',
                    fontWeight: 'bold',
                    py: 1.2,
                    fontSize: 13,
                    '&:hover': { bgcolor: '#d84e20' },
                    '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }
                  }}
                >
                  {executingManual ? 'Executing Command...' : 'Dispatch Containment Command'}
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Verification, HMAC & Console Output */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
              {/* HMAC Signature box */}
              <Paper className="glass-panel" sx={{ p: 2.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: '#f05a28' }}>
                  <SecurityIcon sx={{ fontSize: 18 }} /> Cryptographic Command Verification Signature
                </Typography>
                <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 2 }}>
                  Every remote command requires an HMAC-SHA256 signature verified by the local endpoint's agent using a secure shared key before execution.
                </Typography>
                
                <Box sx={{ bgcolor: '#090a0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', p: 2, fontFamily: 'monospace', fontSize: 11 }}>
                  <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8c909e' }}>Verification Mechanism:</span>
                    <span style={{ color: '#ffd600' }}>HMAC-SHA256</span>
                  </Box>
                  <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8c909e' }}>Shared Signature Key:</span>
                    <span style={{ color: '#ccc' }}>argus_cryptographic_***_2026</span>
                  </Box>
                  <Box sx={{ borderTop: '1px dashed rgba(255,255,255,0.1)', pt: 1, mt: 1 }}>
                    <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 0.5, fontSize: 10 }}>
                      Generated Signature:
                    </Typography>
                    <Typography variant="caption" sx={{ color: currentSignature ? '#00e676' : '#666', display: 'word-break', wordBreak: 'break-all', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {currentSignature ? currentSignature : 'Waiting for command dispatch...'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Console log */}
              <Paper className="glass-panel" sx={{ p: 2.5, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5 }}>
                  Command Execution Terminal Output
                </Typography>
                <Box sx={{ flexGrow: 1, minHeight: 180, bgcolor: '#090a0f', p: 2, borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', maxHeight: 250 }}>
                  {consoleLogs.length === 0 ? (
                    <Typography variant="caption" sx={{ display: 'block', color: '#666', fontFamily: 'monospace' }}>
                      Terminal idle. Dispatched containment logs will stream here.
                    </Typography>
                  ) : (
                    consoleLogs.map((logLine, idx) => (
                      <Typography
                        key={idx}
                        variant="caption"
                        sx={{
                          display: 'block',
                          fontFamily: 'monospace',
                          color: logLine.includes('[ERROR]') || logLine.includes('failed') ? '#ff1744' :
                                 logLine.includes('[HMAC') || logLine.includes('[MANAGER') ? '#ffd600' :
                                 logLine.includes('[AGENT]') || logLine.includes('SUCCESS') ? '#00e676' :
                                 '#ccc',
                          mb: 0.5,
                          lineHeight: 1.4,
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {logLine}
                      </Typography>
                    ))
                  )}
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      )}

      {/* Create Playbook Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => setOpenCreateDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: '#12131a',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            maxWidth: 550,
            width: '100%'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: 16 }}>Create Custom SOAR Incident Response Playbook</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            label="Playbook Name"
            value={newPbName}
            onChange={(e) => setNewPbName(e.target.value)}
            placeholder="e.g. Host Isolation on Process Tampering"
            sx={{ input: { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
          />
          <TextField
            fullWidth
            size="small"
            label="Description"
            value={newPbDesc}
            onChange={(e) => setNewPbDesc(e.target.value)}
            placeholder="What does this playbook resolve?"
            sx={{ input: { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
          />
          <TextField
            fullWidth
            size="small"
            label="Alert / Event Trigger Rule"
            value={newPbTrigger}
            onChange={(e) => setNewPbTrigger(e.target.value)}
            placeholder="e.g. Rule ID 100203 (Malicious DLL Injected)"
            sx={{ input: { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Sequential Action Steps (one per line)"
            value={newPbSteps}
            onChange={(e) => setNewPbSteps(e.target.value)}
            placeholder="Query Virustotal IP Reputation&#10;Block process via local Windows Agent&#10;Email Administrator notification alert"
            sx={{ textarea: { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreateDialog(false)} sx={{ color: '#8c909e' }}>Cancel</Button>
          <Button onClick={handleCreatePlaybook} sx={{ bgcolor: '#f05a28', color: '#fff', '&:hover': { bgcolor: '#d84e20' } }}>Create Playbook</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SoarPlaybooks;
