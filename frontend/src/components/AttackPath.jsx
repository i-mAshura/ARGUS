import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Button, Divider, Card, CardContent, Chip, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import HubIcon from '@mui/icons-material/Hub';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ShieldIcon from '@mui/icons-material/Shield';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';

const SCENARIOS = {
  ransomware: {
    id: "ransomware",
    name: "Ransomware Lateral Spread",
    risk: "Critical",
    description: "Evaluates ransomware spread from compromised phishing endpoints to corporate databases.",
    nodes: {
      internet: { id: 'internet', name: 'External Adversary', type: 'hacker', ip: '185.190.140.23', status: 'compromised', desc: 'Remote C2 beaconing server spawning payloads' },
      perimeter: { id: 'perimeter', name: 'External Firewall', type: 'firewall', ip: '10.0.0.1', status: 'bypassed', desc: 'Edge rules bypassed by exploiting VPN vulnerabilities' },
      laptop: { id: 'laptop', name: 'employee-laptop-01', type: 'workstation', ip: '10.0.1.15', status: 'compromised', desc: 'Infected with LockBit ransomware strain via macro script' },
      abhiram: { id: 'abhiram', name: 'ABHIRAM (Win11)', type: 'workstation', ip: '10.0.1.22', status: 'compromised', desc: 'Lateral spread: admin shares exploited using harvested credentials' },
      database: { id: 'database', name: 'prod-db-01', type: 'server', ip: '10.0.2.80', status: 'at-risk', desc: 'Database server host containing sensitive customer files' },
      controller: { id: 'controller', name: 'domain-controller-01', type: 'server', ip: '10.0.2.10', status: 'at-risk', desc: 'Domain root control node hosting key policies' }
    },
    steps: [
      { source: 'internet', target: 'perimeter', desc: 'Adversary connects to target edge network perimeter' },
      { source: 'perimeter', target: 'laptop', desc: 'Ransomware script downloaded and run on employee-laptop-01' },
      { source: 'laptop', target: 'abhiram', desc: 'Lateral movement: scans subnet and infects ABHIRAM workstation' },
      { source: 'abhiram', target: 'database', desc: 'Attempting connection to prod-db-01 SQL database' },
      { source: 'abhiram', target: 'controller', desc: 'Querying Active Directory server for group policies privilege escalation' }
    ],
    playbook: "Ransomware Containment Workflow",
    playbook_steps: [
      "[SOAR] Triggered Ransomware Containment Workflow",
      "[SOAR] Step 1: Ingest & Verify Alert - Confirming LockBit signature [SUCCESS]",
      "[SOAR] Step 2: Isolate Host - Deploying host isolation rules on ABHIRAM [SUCCESS]",
      "[SOAR] Step 3: Terminate PID - Killing ransomware encryptor process tree [SUCCESS]",
      "[SOAR] Step 4: Notify - Slack alert dispatched to SOC channel [SUCCESS]",
      "[SOAR] Incident Mitigated successfully."
    ]
  },
  credentials: {
    id: "credentials",
    name: "LSASS Credential Harvesting",
    risk: "High",
    description: "Evaluates credential theft targeting local memory caches via unauthorized process reads.",
    nodes: {
      internet: { id: 'internet', name: 'External Adversary', type: 'hacker', ip: '203.0.113.100', status: 'compromised', desc: 'Adversary beacon server receiving credentials' },
      perimeter: { id: 'perimeter', name: 'External Firewall', type: 'firewall', ip: '10.0.0.1', status: 'safe', desc: 'Firewall rules active, dropping unknown incoming traffic' },
      laptop: { id: 'laptop', name: 'employee-laptop-01', type: 'workstation', ip: '10.0.1.15', status: 'compromised', desc: 'Initial entry point: malicious DLL sideloaded' },
      abhiram: { id: 'abhiram', name: 'ABHIRAM (Win11)', type: 'workstation', ip: '10.0.1.22', status: 'compromised', desc: 'LSASS.exe memory accessed to read plaintext passwords' },
      database: { id: 'database', name: 'prod-db-01', type: 'server', ip: '10.0.2.80', status: 'safe', desc: 'Database server host is safe, protected by secure credentials' },
      controller: { id: 'controller', name: 'domain-controller-01', type: 'server', ip: '10.0.2.10', status: 'at-risk', desc: 'Domain root control node is target of stolen admin hashes' }
    },
    steps: [
      { source: 'internet', target: 'laptop', desc: 'Rogue payload spawned inside browser helper object' },
      { source: 'laptop', target: 'abhiram', desc: 'Remote shell opened on ABHIRAM endpoint using local access tokens' },
      { source: 'abhiram', target: 'controller', desc: 'Attempting DCSync replication using harvested administrator credentials' }
    ],
    playbook: "Credential Abuse Lockout",
    playbook_steps: [
      "[SOAR] Triggered Credential Abuse Lockout Playbook",
      "[SOAR] Step 1: Identify Session - Scanning logon session indices [SUCCESS]",
      "[SOAR] Step 2: Isolate Endpoint - Containment active on ABHIRAM [SUCCESS]",
      "[SOAR] Step 3: Revoke Sessions - Clearing Active Directory ticket grants [SUCCESS]",
      "[SOAR] Step 4: Reset Credentials - Forcing password expiration for target account [SUCCESS]",
      "[SOAR] Incident Mitigated successfully."
    ]
  },
  exfiltration: {
    id: "exfiltration",
    name: "Cloud Data Exfiltration",
    risk: "Medium",
    description: "Evaluates data exfiltration attempts targeting cloud buckets through stolen IAM access keys.",
    nodes: {
      internet: { id: 'internet', name: 'External Adversary', type: 'hacker', ip: '198.51.100.5', status: 'compromised', desc: 'Exfiltration repository downloading files' },
      perimeter: { id: 'perimeter', name: 'External Firewall', type: 'firewall', ip: '10.0.0.1', status: 'safe', desc: 'Firewall safe' },
      laptop: { id: 'laptop', name: 'employee-laptop-01', type: 'workstation', ip: '10.0.1.15', status: 'safe', desc: 'Workstation safe' },
      abhiram: { id: 'abhiram', name: 'ABHIRAM (Win11)', type: 'workstation', ip: '10.0.1.22', status: 'compromised', desc: 'Developer environment compromised, AWS keys stolen from root history' },
      database: { id: 'database', name: 'AWS S3 Cloud Bucket', type: 'server', ip: 's3.us-east-1.amazonaws.com', status: 'compromised', desc: 'AWS S3 bucket containing client archive files' },
      controller: { id: 'controller', name: 'AWS IAM Gateway', type: 'server', ip: 'iam.amazonaws.com', status: 'bypassed', desc: 'AWS IAM management console accessed via stolen tokens' }
    },
    steps: [
      { source: 'internet', target: 'abhiram', desc: 'Stole AWS credential token file' },
      { source: 'abhiram', target: 'controller', desc: 'Logged into AWS console via IAM Gateway' },
      { source: 'controller', target: 'database', desc: 'Listing and downloading cloud storage bucket items' },
      { source: 'database', target: 'internet', desc: 'Exfiltrating raw database files to external server repository' }
    ],
    playbook: "AWS S3 Bucket Public Exposure Block",
    playbook_steps: [
      "[SOAR] Triggered AWS S3 Bucket Public Exposure Block Playbook",
      "[SOAR] Step 1: Scan Bucket ACL - Listing bucket properties [SUCCESS]",
      "[SOAR] Step 2: Revert Policy - Rewriting public bucket ACL to BlockPublicAccess [SUCCESS]",
      "[SOAR] Step 3: Flag IAM - Deactivating leaked AWS access keys [SUCCESS]",
      "[SOAR] Step 4: Notify - DevOps alerts sent out [SUCCESS]",
      "[SOAR] Incident Mitigated successfully."
    ]
  }
};

function AttackPath() {
  const [activeScenarioId, setActiveScenarioId] = useState('ransomware');
  const scenario = SCENARIOS[activeScenarioId];

  const [nodes, setNodes] = useState(scenario.nodes);
  const [selectedNode, setSelectedNode] = useState(scenario.nodes.abhiram);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [isIsolated, setIsIsolated] = useState(false);
  const [simLogs, setSimLogs] = useState([]);
  const [runningPlaybook, setRunningPlaybook] = useState(false);

  useEffect(() => {
    // Reset simulation when scenario changes
    handleResetSimulation();
  }, [activeScenarioId]);

  const handleResetSimulation = () => {
    setActiveStep(-1);
    setSimLogs([]);
    setRunningPlaybook(false);
    setIsIsolated(false);
    setNodes(scenario.nodes);
    setSelectedNode(scenario.nodes.abhiram);
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setActiveStep(0);
    const logs = [`[START] Initiating ${scenario.name} Simulation...`];
    setSimLogs(logs);

    let step = 0;
    const interval = setInterval(() => {
      if (step < scenario.steps.length) {
        const stepDetail = scenario.steps[step];
        
        // Check block condition on target nodes
        if (isIsolated && (stepDetail.source === 'abhiram' || stepDetail.target === 'abhiram')) {
          logs.push(`[BLOCKED] Lateral movement to/from ABHIRAM failed.`);
          logs.push(`[REASON] Host ABHIRAM has active containment rules. Connections dropped.`);
          logs.push(`[MITIGATION] Running SOAR Playbook: ${scenario.playbook}`);
          setSimLogs([...logs]);
          
          // Trigger SOAR Playbook step-by-step
          setRunningPlaybook(true);
          let pbStepIdx = 0;
          const pbInterval = setInterval(() => {
            if (pbStepIdx < scenario.playbook_steps.length) {
              logs.push(scenario.playbook_steps[pbStepIdx]);
              setSimLogs([...logs]);
              pbStepIdx++;
            } else {
              clearInterval(pbInterval);
              setRunningPlaybook(false);
              setIsSimulating(false);
            }
          }, 800);
          
          clearInterval(interval);
          return;
        }

        logs.push(`[STEP ${step + 1}] ${stepDetail.desc} (${scenario.nodes[stepDetail.source].ip} -> ${scenario.nodes[stepDetail.target].ip})`);
        
        setNodes(prev => {
          const updated = { ...prev };
          if (updated[stepDetail.target]) {
            updated[stepDetail.target].status = 'compromised';
          }
          return updated;
        });

        setActiveStep(step);
        setSimLogs([...logs]);
        step++;
      } else {
        clearInterval(interval);
        logs.push(`[CRITICAL] Simulation path complete. Domain server assets fully compromised.`);
        setSimLogs([...logs]);
        setIsSimulating(false);
      }
    }, 1500);
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const toggleIsolation = () => {
    const nextState = !isIsolated;
    setIsIsolated(nextState);
    
    // Dynamically update nodes status on isolate/reconnect
    setNodes(prev => {
      const updated = { ...prev };
      if (nextState) {
        updated.abhiram.status = 'safe';
        if (updated.database) updated.database.status = 'safe';
        if (updated.controller) updated.controller.status = 'safe';
      } else {
        updated.abhiram.status = 'compromised';
        if (updated.database && scenario.nodes.database.status === 'at-risk') updated.database.status = 'at-risk';
        if (updated.controller && scenario.nodes.controller.status === 'at-risk') updated.controller.status = 'at-risk';
      }
      return updated;
    });
    
    setSimLogs(prev => [
      ...prev,
      nextState ? `[SHIELD] Activated containment filter rules on ABHIRAM.` : `[SHIELD] Containment rules disabled. Reconnected ABHIRAM to subnet.`
    ]);
  };

  const getNodeColor = (status, id) => {
    if (isIsolated && id === 'abhiram') return '#00e676'; // Shielded / safe
    switch (status) {
      case 'compromised': return '#ff1744';
      case 'bypassed': return '#ff9100';
      case 'at-risk': return '#ffd600';
      default: return '#9598a3';
    }
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      {/* Title */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <HubIcon sx={{ color: '#f05a28', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
            Attack Path & SOAR Simulator
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 220, bgcolor: '#12131a', borderRadius: 1 }}>
          <InputLabel id="scenario-label" style={{ color: '#8c909e' }}>Select Scenario</InputLabel>
          <Select
            labelId="scenario-label"
            value={activeScenarioId}
            label="Select Scenario"
            onChange={(e) => setActiveScenarioId(e.target.value)}
            sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#232630' } }}
          >
            <MenuItem value="ransomware">Ransomware Lateral Spread</MenuItem>
            <MenuItem value="credentials">LSASS Credential Dumping</MenuItem>
            <MenuItem value="exfiltration">Cloud Data Exfiltration</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Typography variant="body2" sx={{ color: '#8c909e', mb: 4 }}>
        Evaluate network breach trajectories and analyze how local endpoint isolation triggers SOAR playbook execution.
      </Typography>

      <Grid container spacing={3.5}>
        {/* Network Diagram View */}
        <Grid item xs={12} md={8}>
          <Paper className="glass-panel" sx={{ p: 3, height: 420, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  Interactive Breach Topology Map
                </Typography>
                <Chip
                  label={`Risk: ${scenario.risk}`}
                  size="small"
                  sx={{
                    bgcolor: scenario.risk === 'Critical' ? 'rgba(255,23,68,0.15)' : scenario.risk === 'High' ? 'rgba(255,145,0,0.15)' : 'rgba(255,214,0,0.15)',
                    color: scenario.risk === 'Critical' ? '#ff1744' : scenario.risk === 'High' ? '#ff9100' : '#ffd600',
                    fontWeight: 'bold',
                    fontSize: 10
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={toggleIsolation}
                  startIcon={<ShieldIcon />}
                  sx={{
                    borderColor: isIsolated ? '#00e676' : 'rgba(255,255,255,0.1)',
                    color: isIsolated ? '#00e676' : '#fff',
                    '&:hover': { borderColor: isIsolated ? '#00e676' : 'rgba(255,255,255,0.2)' }
                  }}
                >
                  {isIsolated ? 'ABHIRAM Containment Active' : 'Isolate ABHIRAM Node'}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={isSimulating}
                  startIcon={<PlayArrowIcon />}
                  onClick={handleRunSimulation}
                  sx={{ bgcolor: '#f05a28', color: '#fff', '&:hover': { bgcolor: '#d84e20' } }}
                >
                  Run Attack
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleResetSimulation}
                  startIcon={<SettingsBackupRestoreIcon />}
                  sx={{ borderColor: 'rgba(255,255,255,0.08)', color: '#8c909e' }}
                >
                  Reset
                </Button>
              </Box>
            </Box>

            {/* SVG Network Map Topology */}
            <svg style={{ width: '100%', height: '80%', background: '#090a0f', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
              {/* Connection paths lines */}
              <line x1="80" y1="140" x2="200" y2="140" stroke={activeStep >= 0 ? '#ff1744' : '#222'} strokeWidth={activeStep >= 0 ? 3 : 1} />
              <line x1="200" y1="140" x2="350" y2="90" stroke={activeStep >= 1 ? '#ff1744' : '#222'} strokeWidth={activeStep >= 1 ? 3 : 1} />
              
              {/* laptop -> abhiram */}
              <line x1="350" y1="90" x2="350" y2="210" stroke={activeStep >= 2 ? '#ff1744' : '#222'} strokeWidth={activeStep >= 2 ? 3 : 1} />
              
              {/* abhiram -> database / controller */}
              <line x1="350" y1="210" x2="520" y2="100" stroke={activeStep >= 3 && !isIsolated ? '#ff1744' : '#222'} strokeWidth={activeStep >= 3 && !isIsolated ? 3 : 1} />
              <line x1="350" y1="210" x2="520" y2="210" stroke={activeStep >= 4 && !isIsolated ? '#ff1744' : '#222'} strokeWidth={activeStep >= 4 && !isIsolated ? 3 : 1} />

              {/* Node Internet */}
              <circle cx="80" cy="140" r="22" fill="#0d0e15" stroke={getNodeColor(nodes.internet ? nodes.internet.status : 'safe', 'internet')} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.internet)} />
              <text x="80" y="145" fill="#fff" fontSize="9" textAnchor="middle" style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.internet)}>Internet</text>

              {/* Node Perimeter */}
              <circle cx="200" cy="140" r="22" fill="#0d0e15" stroke={getNodeColor(nodes.perimeter ? nodes.perimeter.status : 'safe', 'perimeter')} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.perimeter)} />
              <text x="200" y="145" fill="#fff" fontSize="9" textAnchor="middle" style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.perimeter)}>Firewall</text>

              {/* Node Workstation Laptop */}
              <circle cx="350" cy="90" r="22" fill="#0d0e15" stroke={getNodeColor(nodes.laptop ? nodes.laptop.status : 'safe', 'laptop')} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.laptop)} />
              <text x="350" y="95" fill="#fff" fontSize="8" textAnchor="middle" style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.laptop)}>Workstation</text>

              {/* Node ABHIRAM */}
              <circle cx="350" cy="210" r="22" fill="#0d0e15" stroke={getNodeColor(nodes.abhiram ? nodes.abhiram.status : 'safe', 'abhiram')} strokeWidth={isIsolated ? 3 : 2} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.abhiram)} />
              <text x="350" y="215" fill="#fff" fontSize="9" textAnchor="middle" style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.abhiram)}>ABHIRAM</text>
              {isIsolated && (
                <g transform="translate(358, 192) scale(0.6)">
                  <path d="M12 2C11.95 2 11.89 2.01 11.84 2.02C9.97 2.61 6.13 5.43 5.12 6.5C5.04 6.58 5 6.69 5 6.8V13C5 17.5 9.5 21.2 11.5 22C11.66 22.06 11.83 22.09 12 22.09C12.17 22.09 12.34 22.06 12.5 22C14.5 21.2 19 17.5 19 13V6.8C19 6.69 18.96 6.58 18.88 6.5C17.87 5.43 14.03 2.61 12.16 2.02C12.11 2.01 12.05 2 12 2Z" fill="#00e676" />
                </g>
              )}

              {/* Node Database server */}
              <circle cx="520" cy="100" r="22" fill="#0d0e15" stroke={getNodeColor(nodes.database ? nodes.database.status : 'safe', 'database')} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.database)} />
              <text x="520" y="105" fill="#fff" fontSize="9" textAnchor="middle" style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.database)}>{activeScenarioId === 'exfiltration' ? 'S3 Bucket' : 'Database'}</text>

              {/* Node Domain Controller */}
              <circle cx="520" cy="210" r="22" fill="#0d0e15" stroke={getNodeColor(nodes.controller ? nodes.controller.status : 'safe', 'controller')} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.controller)} />
              <text x="520" y="215" fill="#fff" fontSize="9" textAnchor="middle" style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(nodes.controller)}>{activeScenarioId === 'exfiltration' ? 'IAM Service' : 'DomCtrl'}</text>
            </svg>
          </Paper>
        </Grid>

        {/* Node detail side panel */}
        <Grid item xs={12} md={4}>
          <Paper className="glass-panel" sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
              Inspect Threat Node
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

            {selectedNode ? (
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" sx={{ color: '#f05a28', fontWeight: 'bold', mb: 0.5 }}>
                  {selectedNode.name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 2.5 }}>
                  IP/Service URL: <strong style={{ color: '#fff' }}>{selectedNode.ip}</strong>
                </Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>Type</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{selectedNode.type?.toUpperCase()}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>Security State</Typography>
                    <Chip
                      label={selectedNode.status?.toUpperCase()}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 8,
                        fontWeight: 'bold',
                        bgcolor: selectedNode.status === 'compromised' ? 'rgba(255,23,73,0.1)' : selectedNode.status === 'at-risk' ? 'rgba(255,214,0,0.1)' : 'rgba(0,230,118,0.1)',
                        color: selectedNode.status === 'compromised' ? '#ff1744' : selectedNode.status === 'at-risk' ? '#ffd600' : '#00e676'
                      }}
                    />
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#f0f2f5' }}>
                  Node Threat Diagnostics
                </Typography>
                <Typography variant="body2" sx={{ color: '#8c909e', fontSize: 13, lineHeight: 1.5 }}>
                  {selectedNode.desc}
                </Typography>
              </Box>
            ) : (
              <Typography variant="caption" color="#666">Click a node to inspect diagnostic detail.</Typography>
            )}

            {selectedNode && selectedNode.id === 'abhiram' && (
              <Box sx={{ mt: 3 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={toggleIsolation}
                  color={isIsolated ? 'success' : 'error'}
                  sx={{ textTransform: 'none', fontWeight: 'bold' }}
                >
                  {isIsolated ? 'Deactivate Isolation' : 'Isolate Node ABHIRAM'}
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Real-time simulation outputs */}
      {simLogs.length > 0 && (
        <Paper className="glass-panel" sx={{ p: 2.5, mt: 3.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ErrorOutlineIcon sx={{ color: '#f05a28' }} /> Simulation Trace Console
          </Typography>
          <Box sx={{ bgcolor: '#090a0f', p: 2, borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 180, overflowY: 'auto' }}>
            {simLogs.map((logLine, idx) => (
              <Typography
                key={idx}
                variant="caption"
                sx={{
                  display: 'block',
                  fontFamily: 'monospace',
                  color: logLine.includes('[CRITICAL]') ? '#ff1744' : logLine.includes('[SOAR]') ? '#00b0ff' : logLine.includes('[BLOCKED]') ? '#00e676' : '#ccc',
                  mb: 0.5
                }}
              >
                {logLine}
              </Typography>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}

export default AttackPath;
