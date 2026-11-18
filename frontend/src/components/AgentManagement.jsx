import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Card,
} from '@mui/material';
import { Download as DownloadIcon, Settings as SettingsIcon } from '@mui/icons-material';

function AgentManagement() {
  const [agents, setAgents] = useState([
    {
      id: 'agent-001',
      hostname: 'prod-server-01',
      os: 'Windows Server 2022',
      status: 'active',
      last_checkin: '2 minutes ago',
      version: '2.0.0',
      events_sent: 45823
    },
    {
      id: 'agent-002',
      hostname: 'prod-db-01',
      os: 'Linux (Ubuntu 22.04)',
      status: 'active',
      last_checkin: '5 minutes ago',
      version: '2.0.0',
      events_sent: 23456
    },
    {
      id: 'agent-003',
      hostname: 'dev-machine-01',
      os: 'Windows 11',
      status: 'offline',
      last_checkin: '2 hours ago',
      version: '1.9.0',
      events_sent: 5634
    }
  ]);

  const [openDeploymentWizard, setOpenDeploymentWizard] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState(1);
  const [deploymentOS, setDeploymentOS] = useState('windows');
  const [deploymentCode, setDeploymentCode] = useState('');

  const handleOpenDeploymentWizard = () => {
    setDeploymentStep(1);
    setDeploymentOS('windows');
    setOpenDeploymentWizard(true);
  };

  const handleGenerateDeploymentCode = () => {
    const apiOrigin = window.location.origin.includes('localhost:3000') || window.location.origin.includes('127.0.0.1:3000') 
      ? `${window.location.protocol}//${window.location.hostname}:8001` 
      : window.location.origin;

    const codes = {
      windows: `# Windows Agent Deployment\n# Run as Administrator in PowerShell\n\n$ProgressPreference = "SilentlyContinue"\n$url = "${apiOrigin}/api/v1/admin/agents/download/windows-binary"\n$output = "C:\\Program Files\\ARGUS\\agent.py"\nif (-not (Test-Path "C:\\Program Files\\ARGUS")) { mkdir "C:\\Program Files\\ARGUS" }\nInvoke-WebRequest -Uri $url -OutFile $output\n\n# Create configuration file so the agent connects automatically\n$config = @{\n  api_url = "${apiOrigin}"\n}\n$config | ConvertTo-Json | Out-File "C:\\Program Files\\ARGUS\\config.json"\nWrite-Host "✅ ARGUS Windows Agent downloaded to C:\\Program Files\\ARGUS\\agent.py"\nWrite-Host "Run: python 'C:\\Program Files\\ARGUS\\agent.py' to start the agent"`,
      linux: `#!/bin/bash\n# Linux Agent Deployment\n\ncurl -fsSL ${apiOrigin}/api/v1/admin/agents/download/linux-binary -o /tmp/argus-agent.py\nsudo mkdir -p /opt/argus\nsudo mv /tmp/argus-agent.py /opt/argus/agent.py\nsudo chmod +x /opt/argus/agent.py\n\n# Create configuration file so the agent connects automatically\nsudo tee /opt/argus/config.json << EOF\n{\n  "api_url": "${apiOrigin}"\n}\nEOF\necho "✅ ARGUS Linux Agent installed to /opt/argus/agent.py"\necho "Run: python3 /opt/argus/agent.py to start the agent"`,
      macos: `#!/bin/bash\n# macOS Agent Deployment\n\ncurl -fsSL ${apiOrigin}/api/v1/admin/agents/download/macos-binary -o /tmp/argus-agent.py\nsudo mkdir -p /Applications/ARGUS\nsudo mv /tmp/argus-agent.py /Applications/ARGUS/agent.py\nsudo chmod +x /Applications/ARGUS/agent.py\n\n# Create configuration file so the agent connects automatically\nsudo tee /Applications/ARGUS/config.json << EOF\n{\n  "api_url": "${apiOrigin}"\n}\nEOF\necho "✅ ARGUS macOS Agent installed to /Applications/ARGUS/agent.py"\necho "Run: python3 /Applications/ARGUS/agent.py to start the agent"`
    };
    setDeploymentCode(codes[deploymentOS]);
    setDeploymentStep(3);
  };

  const handleNextStep = () => {
    if (deploymentStep === 2) {
      handleGenerateDeploymentCode();
    } else if (deploymentStep < 4) {
      setDeploymentStep(deploymentStep + 1);
    }
  };

  const handleDownloadPackage = () => {
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      `data:text/plain;charset=utf-8,${encodeURIComponent(deploymentCode)}`
    );
    element.setAttribute('download', `deploy-agent-${deploymentOS}.sh`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'offline':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <h1>🤖 Agent Management</h1>
        <Button
          variant="contained"
          color="success"
          startIcon={<DownloadIcon />}
          onClick={handleOpenDeploymentWizard}
        >
          Deploy New Agent
        </Button>
      </Box>

      <Box sx={{ mb: 3, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
        <StatBox title="Active Agents" value={agents.filter(a => a.status === 'active').length} color="#4caf50" />
        <StatBox title="Offline Agents" value={agents.filter(a => a.status === 'offline').length} color="#f44336" />
        <StatBox title="Total Events" value={agents.reduce((sum, a) => sum + a.events_sent, 0)} color="#2196f3" />
      </Box>

      {/* Agents Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell>Hostname</TableCell>
              <TableCell>OS</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Last Check-in</TableCell>
              <TableCell>Events Sent</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id} hover>
                <TableCell>{agent.hostname}</TableCell>
                <TableCell>{agent.os}</TableCell>
                <TableCell>
                  <Chip
                    label={agent.status.toUpperCase()}
                    color={getStatusColor(agent.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{agent.version}</TableCell>
                <TableCell>{agent.last_checkin}</TableCell>
                <TableCell>{agent.events_sent.toLocaleString()}</TableCell>
                <TableCell>
                  <Button size="small" startIcon={<SettingsIcon />}>
                    Configure
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Deployment Wizard Dialog */}
      <DeploymentWizard
        open={openDeploymentWizard}
        step={deploymentStep}
        os={deploymentOS}
        setOS={setDeploymentOS}
        deploymentCode={deploymentCode}
        onNext={handleNextStep}
        onDownload={handleDownloadPackage}
        onClose={() => setOpenDeploymentWizard(false)}
      />
    </Box>
  );
}

function StatBox({ title, value, color }) {
  return (
    <Card sx={{ p: 2, borderLeft: `4px solid ${color}` }}>
      <p style={{ margin: '0 0 8px 0', color: '#999', fontSize: '14px' }}>{title}</p>
      <h3 style={{ margin: 0, color, fontSize: '28px' }}>{value}</h3>
    </Card>
  );
}

function DeploymentWizard({ open, step, os, setOS, deploymentCode, onNext, onDownload, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Agent Deployment Wizard - Step {step} of 4
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {step === 1 && (
          <Box>
            <h3>Select Target Operating System</h3>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Operating System</InputLabel>
              <Select value={os} onChange={(e) => setOS(e.target.value)} label="Operating System">
                <MenuItem value="windows">Windows Server 2016/2019/2022</MenuItem>
                <MenuItem value="linux">Linux (Ubuntu/Debian/CentOS)</MenuItem>
                <MenuItem value="macos">macOS 10.15+</MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ mt: 2 }}>
              Select your operating system to generate the appropriate deployment script.
            </Alert>
          </Box>
        )}

        {step === 2 && (
          <Box>
            <h3>System Requirements</h3>
            {os === 'windows' && (
              <ul>
                <li>Windows Server 2016 or newer</li>
                <li>PowerShell 5.0+</li>
                <li>.NET Framework 4.6+</li>
                <li>Minimum 2GB RAM</li>
                <li>100MB disk space</li>
              </ul>
            )}
            {os === 'linux' && (
              <ul>
                <li>Ubuntu 18.04+ / Debian 10+ / CentOS 7+</li>
                <li>Bash 4.0+</li>
                <li>curl or wget</li>
                <li>Minimum 1GB RAM</li>
                <li>100MB disk space</li>
              </ul>
            )}
            <Alert severity="success" sx={{ mt: 2 }}>
              Your system meets the requirements. Click Next to generate the deployment script.
            </Alert>
          </Box>
        )}

        {step === 3 && (
          <Box>
            <h3>Deployment Script</h3>
            <p style={{ color: '#666', marginBottom: '16px' }}>
              Copy and run this script on your target endpoint:
            </p>
            <Paper
              sx={{
                p: 2,
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: '300px',
                overflowY: 'auto'
              }}
            >
              {deploymentCode}
            </Paper>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigator.clipboard.writeText(deploymentCode)}
              sx={{ mt: 2 }}
            >
              Copy to Clipboard
            </Button>
          </Box>
        )}

        {step === 4 && (
          <Box>
            <h3>✅ Deployment Complete</h3>
            <Alert severity="success" sx={{ mb: 2 }}>
              Agent deployment script has been generated successfully!
            </Alert>
            <p>Next steps:</p>
            <ol>
              <li>Download the deployment script</li>
              <li>Run it on your target endpoints with administrator/root privileges</li>
              <li>Agent will appear in the management console within 2-5 minutes</li>
              <li>Verify agent status and configure settings</li>
            </ol>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {step < 4 && (
          <Button
            onClick={onNext}
            variant="contained"
          >
            {step === 3 ? 'Finish' : 'Next'}
          </Button>
        )}
        {step === 3 && (
          <Button
            onClick={onDownload}
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
          >
            Download Script
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default AgentManagement;
