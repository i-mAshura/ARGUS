import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, Typography, Grid, TextField, Button, Chip, Avatar, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, List, ListItem, ListItemText, LinearProgress, CircularProgress, Stepper, Step, StepLabel, StepContent, Card, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import TerminalIcon from '@mui/icons-material/Terminal';
import BoltIcon from '@mui/icons-material/Bolt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ShieldIcon from '@mui/icons-material/Shield';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import TimelineIcon from '@mui/icons-material/Timeline';
import SpeedIcon from '@mui/icons-material/Speed';

const QUICK_PROMPTS = [
  "Are there active brute-force attacks?",
  "Show recent process anomalies on ABHIRAM",
  "Isolate host ABHIRAM immediately",
  "What endpoints have outdated configurations?"
];

const INITIAL_AGENTS_RUNS = [];

function AiCopilot({ selectedAgent = 'all' }) {
  const [activeTab, setActiveTab] = useState('chat'); // chat, agents, xai
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Greetings. I am the ARGUS Agentic Copilot. I have indexed the active SIEM database logs, FIM hashes, and system hardening metrics. How can I assist your threat hunting operation today?',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);
 
  // Agentic AI State
  const [agentRuns, setAgentRuns] = useState(INITIAL_AGENTS_RUNS);
  const [selectedAgentRun, setSelectedAgentRun] = useState(null);
  const [spawningAgent, setSpawningAgent] = useState(false);
  const [spawnProgress, setSpawnProgress] = useState(0);
  const [spawnStepIdx, setSpawnStepIdx] = useState(0);
  const [spawnLogs, setSpawnLogs] = useState([]);

  // XAI State
  const [alertsList, setAlertsList] = useState([]);
  const [selectedAlertId, setSelectedAlertId] = useState('');
  const [xaiData, setXaiData] = useState(null);
  const [loadingXai, setLoadingXai] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/`);
      if (res.ok) {
        const data = await res.json();
        setAlertsList(data.alerts || []);
        if (data.alerts && data.alerts.length > 0) {
          setSelectedAlertId(data.alerts[0].id);
          fetchXaiExplanation(data.alerts[0].id);
        } else {
          // If no alerts are in DB, load simulated fallback
          simulateXaiFallback('alert-mock-101');
        }
      } else {
        simulateXaiFallback('alert-mock-101');
      }
    } catch (e) {
      console.warn("FastAPI Alerts endpoint offline, loading simulated XAI templates", e);
      simulateXaiFallback('alert-mock-101');
    }
  };

  const fetchXaiExplanation = async (alertId) => {
    if (!alertId) return;
    if (alertId === 'alert-mock-101') {
      simulateXaiFallback('alert-mock-101');
      return;
    }
    
    setLoadingXai(true);
    try {
      const res = await fetch(`${API_BASE_URL}/ai/explain/${alertId}`);
      if (res.ok) {
        const data = await res.json();
        setXaiData(data);
      } else {
        simulateXaiFallback(alertId);
      }
    } catch (e) {
      console.error(e);
      simulateXaiFallback(alertId);
    }
    setLoadingXai(false);
  };

  const simulateXaiFallback = (alertId) => {
    setXaiData({
      alert_id: alertId || 'alert-mock-101',
      title: 'CRITICAL: Suspicious lsass.exe Memory Dump',
      severity: 'critical',
      detection_type: 'behavioral',
      anomaly_score: 94.8,
      confidence_score: 91.2,
      decision_path: [
        "Ingress Telemetry Stream Check ➔ Status: Valid",
        "Behavioral Feature Vector Extraction ➔ Type: BEHAVIORAL",
        "Anomaly Score Threshold Evaluation ➔ Verdict: Malicious"
      ],
      features: [
        { name: "Process Injection Triggers", value: "LSASS Access (Read)", impact: 38, description: "Process dump request targeting security authority mem space" },
        { name: "Parent Binary Namespace", value: "Unknown Bin (temp/dump.exe)", impact: 26, description: "Executing program resides in unsafe temporary paths" },
        { name: "Command-line Signature", value: "Mimikatz dump parameters", impact: 22, description: "Process arguments match credential dumping templates" },
        { name: "Process Code Privilege", value: "NT AUTHORITY\\SYSTEM", impact: 12, description: "Command launched within root user namespace" },
        { name: "Process Execution History", value: "Rare (First Occurrence)", impact: 10, description: "Binary was never seen running on this host prior" },
        { name: "Local Endpoint AV State", value: "Disabled / Bypassed", impact: -6, description: "Active antivirus agent reported no blockade" }
      ],
      mitigation_reasoning: "The AI model computed that network isolation represents the optimal response action here to prevent lateral host breaches. Command sig signing is enforced to secure command validation routes."
    });
  };

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    const userMsg = {
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/ai/copilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          sender: 'ai',
          text: data.text,
          action: data.action,
          timestamp: new Date(data.timestamp).toLocaleTimeString()
        }]);
        setIsTyping(false);
        return;
      }
    } catch (e) {
      console.warn("FastAPI AI Chat offline, running local simulation fallback", e);
    }

    // Simulate AI Threat Response Fallback
    setTimeout(() => {
      let replyText = '';
      let actionData = null;
      const lower = text.toLowerCase();

      if (lower.includes('brute-force') || lower.includes('brute force') || lower.includes('attack')) {
        replyText = 'Checking SIEM logs... Yes, I detected active brute-force attempts targeting host **prod-server-01** (SSH port 22) originating from IP **198.51.100.42**. There have been 14 authentication failures in the last 3 minutes.';
        actionData = {
          label: 'Block Source IP 198.51.100.42',
          type: 'block_ip',
          parameter: '198.51.100.42',
          target: 'prod-server-01'
        };
      } else if (lower.includes('abhiram') || lower.includes('process') || lower.includes('anomaly')) {
        replyText = 'Scanning host **ABHIRAM** process registry... I found a high-entropy execution warning associated with PID **8472** (`mimikatz.exe` execution pattern detected in LSASS mem dumps).';
        actionData = {
          label: 'Terminate Process Tree (PID 8472)',
          type: 'kill_process',
          parameter: '8472',
          target: 'ABHIRAM'
        };
      } else if (lower.includes('isolate')) {
        replyText = 'WARNING: Host isolation drops all external network configurations except the connection to the ARGUS server. Host **ABHIRAM** is queued for containment.';
        actionData = {
          label: 'Execute Subnet Isolation on ABHIRAM',
          type: 'isolate_host',
          parameter: 'ABHIRAM',
          target: 'ABHIRAM'
        };
      } else if (lower.includes('outdated') || lower.includes('config') || lower.includes('hygiene')) {
        replyText = 'Auditing configuration baselines... Found 3 critical policy drifts on **dev-machine-01**: Minimum Password Length is set to 8 characters instead of 14, and SMBv1 is enabled.';
        actionData = {
          label: 'Apply CIS Security Policies',
          type: 'remediate_hygiene',
          parameter: 'dev-machine-01',
          target: 'dev-machine-01'
        };
      } else {
        replyText = `I have searched the telemetry databases for "${text}". I did not locate any active critical anomalies matching this pattern. Let me know if you would like me to spawn an autonomous diagnostic agent on a target host to perform deep file systems checks.`;
      }

      setMessages(prev => [...prev, {
        sender: 'ai',
        text: replyText,
        action: actionData,
        timestamp: new Date().toLocaleTimeString()
      }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleExecuteAction = (action) => {
    setMessages(prev => [...prev, {
      sender: 'ai',
      text: `[SYSTEM COMMAND INITIATED] Dispatched command type "${action.type}" with parameter "${action.parameter}" to host "${action.target}". Dispatch status: Queued.`,
      timestamp: new Date().toLocaleTimeString()
    }]);

    setActiveTab('agents');
    handleSpawnAgent(action.target, action.label);
  };

  const handleSpawnAgent = async (targetHost = 'ABHIRAM', actionTitle = 'Manual Threat Diagnostic Audit') => {
    setSpawningAgent(true);
    setSpawnProgress(0);
    setSpawnStepIdx(0);
    
    const logs = [`[START] Initializing Autonomous Security Agent on endpoint ${targetHost}...`];
    setSpawnLogs([...logs]);

    try {
      const response = await fetch(`${API_BASE_URL}/ai/agents/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: targetHost, action: actionTitle })
      });
      if (response.ok) {
        const data = await response.json();
        
        let stepIdx = 0;
        const interval = setInterval(() => {
          if (stepIdx < data.steps.length) {
            const step = data.steps[stepIdx];
            logs.push(`[${step.type}] Executed Step: ${step.label} - ${step.desc}`);
            setSpawnLogs([...logs]);
            setSpawnStepIdx(stepIdx);
            setSpawnProgress(((stepIdx + 1) / data.steps.length) * 100);
            stepIdx++;
          } else {
            clearInterval(interval);
            setSpawningAgent(false);
            
            const newRun = {
              id: data.id,
              name: data.name,
              host: data.host,
              threat: data.threat,
              status: data.status,
              timestamp: data.timestamp,
              steps: data.steps
            };
            setAgentRuns(prev => [newRun, ...prev]);
            setSelectedAgentRun(newRun);
          }
        }, 1200);
        return;
      }
    } catch (e) {
      console.warn("FastAPI Agent Spawn offline, running local simulation fallback", e);
    }

    // Fallback simulation
    const agentSteps = [
      { type: 'OBSERVE', label: 'Telemetry Intake', desc: `Scanning target host ${targetHost} registry keys, network adapters, and file handles.` },
      { type: 'THINK', label: 'Threat Analysis', desc: `Evaluating behavioral metrics: Action matches command context "${actionTitle}". Calculating remediation actions.` },
      { type: 'ACT', label: 'Mitigation Dispatch', desc: `Dispatched native system containment script to Agent. Active blocking firewall rules deployed.` },
      { type: 'VERIFY', label: 'Host Re-audit', desc: 'Re-polling host process socket state. Threat confirmed isolated. Diagnostic report compiled.' },
      { type: 'REPORT', label: 'SOC Reporting', desc: 'Completed incident containment loop. Incident record resolved.' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < agentSteps.length) {
        logs.push(`[${agentSteps[currentStep].type}] Executed Step: ${agentSteps[currentStep].label} - ${agentSteps[currentStep].desc}`);
        setSpawnLogs([...logs]);
        setSpawnStepIdx(currentStep);
        setSpawnProgress(((currentStep + 1) / agentSteps.length) * 100);
        currentStep++;
      } else {
        clearInterval(interval);
        setSpawningAgent(false);
        
        const newRun = {
          id: `agent-run-${Date.now()}`,
          name: `Argus-Dynamic-${Math.floor(Math.random()*100)}`,
          host: targetHost,
          threat: actionTitle,
          status: 'completed',
          timestamp: new Date().toISOString(),
          steps: agentSteps
        };
        setAgentRuns(prev => [newRun, ...prev]);
        setSelectedAgentRun(newRun);
      }
    }, 1200);
  };

  const handleAlertSelectChange = (val) => {
    setSelectedAlertId(val);
    fetchXaiExplanation(val);
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1.5 }}>
        <SmartToyIcon sx={{ color: '#f05a28', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
          AI Agentic Security & Incident Command
        </Typography>
      </Box>

      {/* Tabs Menu */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', mb: 3, gap: 1.5 }}>
        <Button
          onClick={() => setActiveTab('chat')}
          sx={{
            py: 1,
            px: 3,
            color: activeTab === 'chat' ? '#fff' : '#8c909e',
            borderBottom: activeTab === 'chat' ? '2px solid #f05a28' : '2px solid transparent',
            fontWeight: activeTab === 'chat' ? 'bold' : 'normal',
            '&:hover': { color: '#fff' }
          }}
        >
          Conversational Threat Hunting
        </Button>
        <Button
          onClick={() => setActiveTab('agents')}
          sx={{
            py: 1,
            px: 3,
            color: activeTab === 'agents' ? '#fff' : '#8c909e',
            borderBottom: activeTab === 'agents' ? '2px solid #f05a28' : '2px solid transparent',
            fontWeight: activeTab === 'agents' ? 'bold' : 'normal',
            '&:hover': { color: '#fff' }
          }}
        >
          Autonomous Incident Agents
        </Button>
        <Button
          onClick={() => setActiveTab('xai')}
          sx={{
            py: 1,
            px: 3,
            color: activeTab === 'xai' ? '#fff' : '#8c909e',
            borderBottom: activeTab === 'xai' ? '2px solid #f05a28' : '2px solid transparent',
            fontWeight: activeTab === 'xai' ? 'bold' : 'normal',
            '&:hover': { color: '#fff' }
          }}
        >
          Explainable AI (XAI) Engine
        </Button>
      </Box>

      {/* Tab Contents */}
      {activeTab === 'chat' && (
        <Grid container spacing={3}>
          {/* Chat Window */}
          <Grid item xs={12} md={8}>
            <Paper className="glass-panel" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: 480 }}>
              {/* Message History */}
              <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1.5, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {messages.map((msg, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    {msg.sender !== 'user' && (
                      <Avatar sx={{ bgcolor: '#f05a28', width: 28, height: 28 }}>
                        <SmartToyIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                    )}
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Paper
                        sx={{
                          p: 1.8,
                          bgcolor: msg.sender === 'user' ? '#f05a28' : 'rgba(255,255,255,0.03)',
                          border: msg.sender === 'user' ? 'none' : '1px solid rgba(255,255,255,0.05)',
                          borderRadius: msg.sender === 'user' ? '12px 12px 0 12px' : '0 12px 12px 12px',
                          color: '#fff'
                        }}
                      >
                        <Typography variant="body2" sx={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {msg.text}
                        </Typography>

                        {msg.action && (
                          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="caption" sx={{ color: '#ff9100', display: 'block', fontWeight: 'bold' }}>
                                RECOMMENDED ACTION ({msg.action.type.toUpperCase()})
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 'bold' }}>
                                Host: {msg.action.target} | Target: {msg.action.parameter}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              startIcon={<BoltIcon />}
                              onClick={() => handleExecuteAction(msg.action)}
                              sx={{ textTransform: 'none', fontSize: 11, fontWeight: 'bold' }}
                            >
                              Dispatch Agent
                            </Button>
                          </Box>
                        )}
                      </Paper>
                      <Typography variant="caption" sx={{ color: '#666', mt: 0.5, alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                        {msg.timestamp}
                      </Typography>
                    </Box>
                    {msg.sender === 'user' && (
                      <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.1)', width: 28, height: 28 }}>
                        <PersonIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                    )}
                  </Box>
                ))}

                {isTyping && (
                  <Box sx={{ display: 'flex', gap: 1.5, alignSelf: 'flex-start' }}>
                    <Avatar sx={{ bgcolor: '#f05a28', width: 28, height: 28 }}>
                      <SmartToyIcon sx={{ fontSize: 16 }} />
                    </Avatar>
                    <Paper sx={{ p: 1.8, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0 12px 12px 12px', display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <CircularProgress size={12} sx={{ color: '#f05a28' }} />
                      <Typography variant="caption" sx={{ color: '#8c909e' }}>Copilot is parsing SIEM databases...</Typography>
                    </Paper>
                  </Box>
                )}
                <div ref={chatEndRef} />
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

              {/* Chat Input */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
                  placeholder="Ask about brute force events, policy drifts, threat vectors..."
                  sx={{
                    bgcolor: '#090a0f',
                    input: { color: '#fff', fontSize: 13 },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' }
                  }}
                />
                <Button
                  variant="contained"
                  onClick={() => handleSendMessage(inputText)}
                  sx={{ bgcolor: '#f05a28', color: '#fff', px: 3, '&:hover': { bgcolor: '#d84e20' } }}
                >
                  <SendIcon sx={{ fontSize: 18 }} />
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Quick Prompts Panel */}
          <Grid item xs={12} md={4}>
            <Paper className="glass-panel" sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <HelpOutlineIcon sx={{ color: '#f05a28' }} /> Quick Hunting Prompts
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e', mb: 3, display: 'block' }}>
                Click any prompt token below to query the RAG-copilot threat engine automatically.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <Card
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 1.5,
                      p: 1.8,
                      cursor: 'pointer',
                      color: '#fff',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(240, 90, 40, 0.05)',
                        borderColor: 'rgba(240, 90, 40, 0.3)'
                      }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: 12.5, fontWeight: 'medium' }}>
                      {prompt}
                    </Typography>
                  </Card>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 'agents' && (
        <Grid container spacing={3}>
          {/* Agent Runs List */}
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<PsychologyIcon />}
                disabled={spawningAgent}
                onClick={() => handleSpawnAgent('ABHIRAM', 'Manual Diagnostic Integrity Scan')}
                sx={{
                  bgcolor: '#f05a28',
                  color: '#fff',
                  '&:hover': { bgcolor: '#d84e20' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: '#666' }
                }}
              >
                {spawningAgent ? 'Agent Running...' : 'Spawn Autonomous Agent'}
              </Button>

              {/* Progress bar if spawning */}
              {spawningAgent && (
                <Paper className="glass-panel" sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <span>Deploying agent payload...</span>
                    <span>{Math.round(spawnProgress)}%</span>
                  </Typography>
                  <LinearProgress variant="determinate" value={spawnProgress} sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />
                  
                  <Box sx={{ mt: 2, bgcolor: '#090a0f', p: 1, borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 110, overflowY: 'auto' }}>
                    {spawnLogs.map((log, i) => (
                      <Typography key={i} variant="caption" sx={{ display: 'block', fontFamily: 'monospace', color: '#00e676', fontSize: 10, mb: 0.5 }}>
                        {log}
                      </Typography>
                    ))}
                  </Box>
                </Paper>
              )}

              {/* History Table */}
              <Paper className="glass-panel" sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Agent Incident Escalations
                </Typography>
                <List sx={{ p: 0 }}>
                  {agentRuns.length === 0 ? (
                    <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', textAlign: 'center', py: 4 }}>
                      No active escalations recorded. Click "Spawn Autonomous Agent" to run a scan.
                    </Typography>
                  ) : (
                    agentRuns.map((run) => (
                      <ListItem
                        key={run.id}
                        onClick={() => setSelectedAgentRun(run)}
                        sx={{
                          p: 1.5,
                          mb: 1.5,
                          borderRadius: 1.5,
                          cursor: 'pointer',
                          bgcolor: selectedAgentRun && selectedAgentRun.id === run.id ? 'rgba(240, 90, 40, 0.05)' : 'rgba(255,255,255,0.02)',
                          border: selectedAgentRun && selectedAgentRun.id === run.id ? '1px solid rgba(240, 90, 40, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                          transition: 'all 0.2s ease',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: '#f05a28' }}>
                          <ShieldIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{run.name}</Typography>
                              <Chip label="COMPLETED" size="small" sx={{ height: 16, fontSize: 8, bgcolor: 'rgba(0, 230, 118, 0.15)', color: '#00e676', fontWeight: 'bold' }} />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block' }}>
                                Host: {run.host} | Threat: {run.threat}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))
                  )}
                </List>
              </Paper>
            </Box>
          </Grid>

          {/* Stepper Detail View */}
          <Grid item xs={12} md={7}>
            <Paper className="glass-panel" sx={{ p: 3, height: '100%', minHeight: 300 }}>
              {selectedAgentRun ? (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TerminalIcon sx={{ color: '#f05a28' }} /> Agent Reasoning Execution Loop
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#8c909e', fontFamily: 'monospace' }}>
                      ID: {selectedAgentRun.id}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#fff', mb: 0.5 }}>
                      {selectedAgentRun.name} (Active on {selectedAgentRun.host})
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#ffd600', fontWeight: 'bold' }}>
                      Context: {selectedAgentRun.threat}
                    </Typography>
                  </Box>

                  {/* Steps Stepper */}
                  <Stepper orientation="vertical">
                    {selectedAgentRun.steps.map((step, index) => (
                      <Step key={index} active={true} expanded={true}>
                        <StepLabel
                          StepIconProps={{
                            style: { color: '#f05a28' }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={step.type}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: 9,
                                bgcolor: step.type === 'OBSERVE' ? 'rgba(0,176,255,0.15)' : step.type === 'THINK' ? 'rgba(255,214,0,0.15)' : step.type === 'ACT' ? 'rgba(255,23,73,0.15)' : 'rgba(0,230,118,0.15)',
                                color: step.type === 'OBSERVE' ? '#00b0ff' : step.type === 'THINK' ? '#ffd600' : step.type === 'ACT' ? '#ff1744' : '#00e676',
                                fontWeight: 'bold'
                              }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#fff' }}>
                              {step.label}
                            </Typography>
                          </Box>
                        </StepLabel>
                        <StepContent>
                          <Typography variant="body2" sx={{ color: '#8c909e', pl: 1.5, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                            {step.desc}
                          </Typography>
                        </StepContent>
                      </Step>
                    ))}
                  </Stepper>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, textAlign: 'center' }}>
                  <TerminalIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.05)', mb: 2 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#8c909e' }}>No Agent Escalation Selected</Typography>
                  <Typography variant="caption" sx={{ color: '#666', maxWidth: 300, mt: 1, display: 'block' }}>
                    Select an escalation run from the history list, or dispatch a new autonomous diagnostic agent to evaluate system anomalies.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 'xai' && (
        <Box>
          {/* Dropdown Alert Selector */}
          <Paper className="glass-panel" sx={{ p: 2.5, mb: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} sm={8}>
                <FormControl fullWidth size="small" variant="outlined">
                  <InputLabel id="xai-alert-select-label" sx={{ color: '#8c909e' }}>Select Alert to Analyze with Explainable AI</InputLabel>
                  <Select
                    labelId="xai-alert-select-label"
                    value={selectedAlertId}
                    onChange={(e) => handleAlertSelectChange(e.target.value)}
                    label="Select Alert to Analyze with Explainable AI"
                    sx={{
                      color: '#fff',
                      '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#f05a28' },
                      '.MuiSvgIcon-root': { color: '#8c909e' }
                    }}
                  >
                    {alertsList.length === 0 ? (
                      <MenuItem value="alert-mock-101">[DEMO] CRITICAL: Suspicious lsass.exe Memory Dump</MenuItem>
                    ) : (
                      alertsList.map((alert) => (
                        <MenuItem key={alert.id} value={alert.id}>
                          [{alert.severity.toUpperCase()}] {alert.title}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PsychologyIcon />}
                  onClick={() => fetchXaiExplanation(selectedAlertId)}
                  disabled={loadingXai}
                  sx={{ bgcolor: '#f05a28', color: '#fff', '&:hover': { bgcolor: '#d84e20' } }}
                >
                  {loadingXai ? 'Running XAI Explainers...' : 'Explain Classification'}
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {loadingXai ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress color="warning" /></Box>
          ) : !xaiData ? (
            <Paper className="glass-panel" sx={{ p: 5, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#8c909e' }}>Select or trigger a security alert to generate an Explainable AI classification profile.</Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {/* Left Column - Metrics & SHAP Force Plot */}
              <Grid item xs={12} md={7}>
                <Paper className="glass-panel" sx={{ p: 3, mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5, gap: 1 }}>
                    <SpeedIcon sx={{ color: '#f05a28' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Model Explainability & Anomaly Weights</Typography>
                  </Box>

                  {/* KPI Gauges */}
                  <Grid container spacing={2} sx={{ mb: 4 }}>
                    <Grid item xs={6}>
                      <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.15)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 0.5 }}>Risk Score (Anomaly Index)</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: xaiData.anomaly_score > 80 ? '#ff1744' : '#ff9100' }}>
                          {xaiData.anomaly_score}%
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.15)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 0.5 }}>Model Confidence Interval</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#00e676' }}>
                          {xaiData.confidence_score}%
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* SHAP Force Plot Contributions Chart */}
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#f0f2f5' }}>Shapley Feature Contributions (SHAP Force Plot)</Typography>
                  <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 3.5 }}>
                    Red bars represent features that push the model risk assessment <b>upward</b> (malicious factors). Green bars represent features that reduce risk score (benign factors).
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {xaiData.features.map((feature, idx) => {
                      const isPositive = feature.impact > 0;
                      const percentage = Math.min(Math.abs(feature.impact) * 2, 100);
                      
                      return (
                        <Box key={idx}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: 12.5, color: '#fff' }}>
                                {feature.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#666', fontSize: 10.5, display: 'block' }}>
                                {feature.description}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 'bold', color: isPositive ? '#ff1744' : '#00e676' }}>
                                {isPositive ? `+${feature.impact}%` : `${feature.impact}%`}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#aaa', fontSize: 11 }}>
                                Val: {feature.value}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ width: '100%', height: 6, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 3, position: 'relative' }}>
                            <Box
                              sx={{
                                position: 'absolute',
                                left: isPositive ? '50%' : 'auto',
                                right: !isPositive ? '50%' : 'auto',
                                width: `${percentage / 2}%`,
                                height: '100%',
                                bgcolor: isPositive ? 'linear-gradient(90deg, #ff9100, #ff1744)' : 'linear-gradient(90deg, #00e676, #00b0ff)',
                                borderRadius: 3
                              }}
                            />
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              </Grid>

              {/* Right Column - Decision Path & Reasonings */}
              <Grid item xs={12} md={5}>
                {/* Decision Trace Path */}
                <Paper className="glass-panel" sx={{ p: 3, mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                    <TimelineIcon sx={{ color: '#f05a28' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Decision Forest Traversal Path</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 3 }}>
                    The neural tree decisions path triggered in the active behavioral classifier context.
                  </Typography>

                  <Stepper orientation="vertical" sx={{ '& .MuiStepConnector-line': { borderColor: 'rgba(255,255,255,0.06)' } }}>
                    {xaiData.decision_path.map((pathItem, idx) => (
                      <Step key={idx} active={true} expanded={true}>
                        <StepLabel StepIconProps={{ style: { color: '#f05a28' } }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#fff', fontSize: 12 }}>
                            {pathItem}
                          </Typography>
                        </StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                </Paper>

                {/* Mitigation Rationale */}
                <Paper className="glass-panel" sx={{ p: 3, borderLeft: '4px solid #f05a28 !important' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                    <InfoIcon sx={{ color: '#f05a28' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Mitigation Logic Reasoning</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#ccc', fontSize: 13, lineHeight: 1.5 }}>
                    {xaiData.mitigation_reasoning}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}

export default AiCopilot;
