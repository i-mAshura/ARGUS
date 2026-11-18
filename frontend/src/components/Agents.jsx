import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, Alert, LinearProgress, IconButton } from '@mui/material';
import ComputerIcon from '@mui/icons-material/Computer';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

function Agents({ selectedAgentId, onSelectAgent }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDeployWizard, setOpenDeployWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [targetOS, setTargetOS] = useState('windows');
  const [deploymentCode, setDeploymentCode] = useState('');

  // Agent detail view state
  const [detailedAgent, setDetailedAgent] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);
  const [agentLogsLoading, setAgentLogsLoading] = useState(false);

  // Agent Deletion State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteAgent = (agent) => {
    setAgentToDelete(agent);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/agents/${agentToDelete.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setDeleteConfirmOpen(false);
        setAgentToDelete(null);
        setDetailedAgent(null);
        onSelectAgent('all');
        fetchAgents();
      } else {
        alert("Failed to delete agent. Verify your administrator permissions.");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred while deleting agent.");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedAgentId && selectedAgentId !== 'all') {
      const activeAgent = agents.find(a => a.id === selectedAgentId || a.hostname === selectedAgentId);
      if (activeAgent) {
        setDetailedAgent(activeAgent);
        fetchAgentLogs(activeAgent.hostname);
      } else {
        // Fallback for mock agent if not loaded yet
        const mockAgent = {
          id: selectedAgentId,
          hostname: selectedAgentId,
          os: 'Windows 11 Enterprise',
          ip_address: '127.0.0.1',
          status: 'active',
          last_seen: new Date().toISOString(),
          agent_version: '2.0.0',
          events_today: 45
        };
        setDetailedAgent(mockAgent);
        fetchAgentLogs(selectedAgentId);
      }
    } else {
      setDetailedAgent(null);
    }
  }, [selectedAgentId, agents]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      // Fetch both dashboard hosts and ARGUS integrated agents
      const [hostsRes, agentRes] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/hosts/status`).catch(() => null),
        fetch(`${API_BASE_URL}/integrations/agent/agents`).catch(() => null)
      ]);

      let hostsData = hostsRes ? await hostsRes.json() : null;
      let agentData = agentRes ? await agentRes.json() : null;

      let list = [];
      if (hostsData?.hosts) {
        hostsData.hosts.forEach((h, index) => {
          let displayedOs = 'Windows Server 2022';
          if (h.os_type) {
            const osLower = h.os_type.toLowerCase();
            if (osLower === 'linux') {
              displayedOs = 'Kali Linux';
            } else if (osLower === 'macos') {
              displayedOs = 'macOS';
            } else if (h.hostname.toLowerCase().includes('workstation')) {
              displayedOs = 'Windows 11 Professional';
            }
          } else if (h.hostname.toLowerCase().includes('workstation')) {
            displayedOs = 'Windows 11 Professional';
          }
          
          list.push({
            id: h.id || `agent-00${index + 1}`,
            hostname: h.hostname,
            os: displayedOs,
            ip_address: h.ip_address || ('192.168.1.' + (100 + index)),
            status: h.status,
            last_seen: h.last_seen,
            agent_version: h.agent_version,
            events_today: h.events_today
          });
        });
      }

      if (agentData?.agents) {
        agentData.agents.forEach(a => {
          if (!list.some(l => l.hostname.toUpperCase() === (a.name || '').toUpperCase())) {
            list.push({
              id: a.id,
              hostname: a.name,
              os: a.os?.name || 'Linux (Ubuntu)',
              ip_address: a.ip || '127.0.0.1',
              status: a.status === 'active' ? 'active' : 'offline',
              last_seen: a.lastKeepAlive || new Date().toISOString(),
              agent_version: a.version || '1.0.0',
              events_today: 100
            });
          }
        });
      }

      // Default fallback agents for demo (REMOVED)
      if (list.length === 0) {
        list = [];
      }

      const filteredList = list.filter(a => 
        !a.hostname.toLowerCase().includes('manager') && 
        !a.hostname.toLowerCase().includes('abhiram') && 
        !a.hostname.toLowerCase().includes('localhost')
      );
      setAgents(filteredList);
    } catch (err) {
      console.error("Error loading endpoint agents: ", err);
    }
    setLoading(false);
  };

  const fetchAgentLogs = async (hostname) => {
    setAgentLogsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/events/?hostname=${hostname}&limit=10`);
      const data = await response.json();
      setAgentLogs(data.events || []);
    } catch (err) {
      console.error("Error loading agent logs: ", err);
    }
    setAgentLogsLoading(false);
  };

  const handleOpenDeploy = () => {
    setWizardStep(1);
    setTargetOS('windows');
    setOpenDeployWizard(true);
  };

  const handleGenerateScript = () => {
    const apiOrigin = window.location.origin.includes('localhost:3000') || window.location.origin.includes('127.0.0.1:3000') 
      ? `${window.location.protocol}//${window.location.hostname}:8001` 
      : window.location.origin;

    const scripts = {
      windows: `$ProgressPreference = "SilentlyContinue"\n$url = "${apiOrigin}/api/v1/admin/agents/download/windows-binary"\n$output = "C:\\Program Files\\ARGUS\\agent.py"\nif (-not (Test-Path "C:\\Program Files\\ARGUS")) { mkdir "C:\\Program Files\\ARGUS" }\nInvoke-WebRequest -Uri $url -OutFile $output\n# Create configuration file so the agent connects automatically\n$config = @{\n  api_url = "${apiOrigin}"\n}\n$config | ConvertTo-Json | Out-File "C:\\Program Files\\ARGUS\\config.json"\nWrite-Host "✅ ARGUS Windows Agent downloaded to C:\\Program Files\\ARGUS\\agent.py"\nWrite-Host "Run: python 'C:\\Program Files\\ARGUS\\agent.py' to start the agent"`,
      linux: `curl -fsSL ${apiOrigin}/api/v1/admin/agents/download/linux-binary -o /tmp/argus-agent.py\nsudo mkdir -p /opt/argus\nsudo mv /tmp/argus-agent.py /opt/argus/agent.py\nsudo chmod +x /opt/argus/agent.py\n# Create configuration file so the agent connects automatically\nsudo tee /opt/argus/config.json << EOF\n{\n  "api_url": "${apiOrigin}"\n}\nEOF\necho "✅ ARGUS Linux Agent installed to /opt/argus/agent.py"\necho "Run: python3 /opt/argus/agent.py to start the agent"`,
      macos: `curl -fsSL ${apiOrigin}/api/v1/admin/agents/download/macos-binary -o /tmp/argus-agent.py\nsudo mkdir -p /Applications/ARGUS\nsudo mv /tmp/argus-agent.py /Applications/ARGUS/agent.py\nsudo chmod +x /Applications/ARGUS/agent.py\n# Create configuration file so the agent connects automatically\nsudo tee /Applications/ARGUS/config.json << EOF\n{\n  "api_url": "${apiOrigin}"\n}\nEOF\necho "✅ ARGUS macOS Agent installed to /Applications/ARGUS/agent.py"\necho "Run: python3 /Applications/ARGUS/agent.py to start the agent"`
    };
    setDeploymentCode(scripts[targetOS]);
    setWizardStep(3);
  };

  if (detailedAgent) {
    return (
      <Box sx={{ color: '#fff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={() => onSelectAgent('all')} sx={{ color: '#f05a28' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Agent: {detailedAgent.hostname}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => confirmDeleteAgent(detailedAgent)}
            sx={{ color: '#ff1744', borderColor: '#ff1744', '&:hover': { borderColor: '#d50000', bgcolor: 'rgba(255,23,68,0.05)' } }}
          >
            Delete Agent
          </Button>
        </Box>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Agent Meta Cards */}
          <Grid item xs={12} md={4}>
            <Card sx={{ bgcolor: '#12131a', border: '1px solid #232630', p: 1 }}>
              <CardContent>
                <Typography variant="subtitle2" color="#9598a3" sx={{ mb: 2 }}>System Specifications</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Typography variant="body2"><strong>Operating System:</strong> {detailedAgent.os}</Typography>
                  <Typography variant="body2"><strong>IP Address:</strong> {detailedAgent.ip_address}</Typography>
                  <Typography variant="body2"><strong>Agent Version:</strong> v{detailedAgent.agent_version}</Typography>
                  <Typography variant="body2"><strong>Last Active Check-in:</strong> {detailedAgent.last_seen ? new Date(detailedAgent.last_seen).toLocaleString() : 'Never Check-in'}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2"><strong>Status:</strong></Typography>
                    <Chip label={(detailedAgent.status || 'unknown').toUpperCase()} size="small" color={detailedAgent.status === 'active' ? 'success' : 'error'} sx={{ height: 18, fontSize: 9, fontWeight: 'bold' }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Local logs table */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ bgcolor: '#12131a', border: '1px solid #232630', p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, fontSize: 16 }}>
                Recent Security Telemetry Log
              </Typography>
              {agentLogsLoading ? (
                <LinearProgress sx={{ bgcolor: '#1b1e27', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />
              ) : (
                <TableContainer sx={{ maxHeight: 200 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#1c1e28', color: '#9598a3', borderBottom: '1px solid #232630' } }}>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Event Type</TableCell>
                        <TableCell>Source IP</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {agentLogs.length > 0 ? (
                        agentLogs.map((log, idx) => (
                          <TableRow key={log.id || idx}>
                            <TableCell sx={{ fontSize: 11, color: '#e3e4e8', borderBottom: '1px solid #232630' }}>
                              {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                            </TableCell>
                            <TableCell sx={{ borderBottom: '1px solid #232630', color: '#e3e4e8' }}>
                              <Chip label={log.event_type} size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#1c1e28', color: '#fff' }} />
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, borderBottom: '1px solid #232630', color: '#e3e4e8' }}>
                              {log.source_ip}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} sx={{ textAlign: 'center', py: 3, color: '#666', borderBottom: 'none' }}>
                            No process activity currently streamed inside the database.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ color: '#fff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ComputerIcon sx={{ color: '#f05a28', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', letterSpacing: 0.5 }}>
            Endpoints / Agents Console
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleOpenDeploy}
          sx={{ bgcolor: '#f05a28', '&:hover': { bgcolor: '#d84315' } }}
        >
          Deploy New Agent
        </Button>
      </Box>

      {/* KPI summaries */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#171922', border: '1px solid #232630' }}>
            <CardContent>
              <Typography color="#9598a3" variant="subtitle2">Total Registered</Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>{agents.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#171922', borderLeft: '4px solid #00e676', border: '1px solid #232630' }}>
            <CardContent>
              <Typography color="#9598a3" variant="subtitle2">Active Agents</Typography>
              <Typography variant="h4" color="#00e676" sx={{ fontWeight: 'bold', mt: 1 }}>
                {agents.filter(a => a.status === 'active').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#171922', borderLeft: '4px solid #ff1744', border: '1px solid #232630' }}>
            <CardContent>
              <Typography color="#9598a3" variant="subtitle2">Offline Agents</Typography>
              <Typography variant="h4" color="#ff1744" sx={{ fontWeight: 'bold', mt: 1 }}>
                {agents.filter(a => a.status === 'offline').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Agents grid table */}
      <TableContainer component={Paper} sx={{ bgcolor: '#12131a', border: '1px solid #232630' }}>
        {loading ? (
          <LinearProgress sx={{ bgcolor: '#1b1e27', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#1c1e28', color: '#9598a3', borderBottom: '1px solid #232630', fontWeight: 'bold' } }}>
                <TableCell>Agent Hostname</TableCell>
                <TableCell>Operating System</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Agent Version</TableCell>
                <TableCell>Last Active Check-in</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.length > 0 ? (
                agents.map((agent) => (
                  <TableRow key={agent.id} hover sx={{ '& td': { borderBottom: '1px solid #232630', color: '#e3e4e8', py: 1.5 }, '&:hover': { bgcolor: '#1c1e28' } }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>{agent.hostname}</TableCell>
                    <TableCell>{agent.os}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{agent.ip_address}</TableCell>
                    <TableCell>
                      <Chip
                        label={(agent.status || 'unknown').toUpperCase()}
                        size="small"
                        color={agent.status === 'active' ? 'success' : 'error'}
                        sx={{ height: 18, fontSize: 9, fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell>v{agent.agent_version}</TableCell>
                    <TableCell sx={{ fontSize: 11 }}>{agent.last_seen ? new Date(agent.last_seen).toLocaleString() : 'Never Check-in'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" onClick={() => onSelectAgent(agent.hostname)} sx={{ color: '#00b0ff', minWidth: 'auto' }}>
                          Inspect Detail
                        </Button>
                        <Button size="small" onClick={() => confirmDeleteAgent(agent)} sx={{ color: '#ff1744', minWidth: 'auto' }}>
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8, color: '#9598a3' }}>
                    <ComputerIcon sx={{ fontSize: 48, mb: 1, color: '#f05a28', opacity: 0.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>No active agents connected</Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>Please deploy a new agent to start receiving security telemetry.</Typography>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleOpenDeploy} sx={{ borderColor: '#f05a28', color: '#f05a28', '&:hover': { borderColor: '#d84e20', bgcolor: 'rgba(240,90,40,0.05)' } }}>
                      Deploy First Agent
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Deployment Dialog */}
      <Dialog open={openDeployWizard} onClose={() => setOpenDeployWizard(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#12131a', border: '1px solid #232630', color: '#fff' } }}>
        <DialogTitle sx={{ color: '#ff9100', fontWeight: 'bold' }}>Deploy Endpoint Agent - Step {wizardStep} of 4</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {wizardStep === 1 && (
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#9598a3', mb: 2 }}>Select target platform:</Typography>
              <FormControl fullWidth sx={{ bgcolor: '#1c1e28', border: '1px solid #2c2e3b', borderRadius: 1 }}>
                <InputLabel sx={{ color: '#9598a3' }}>Operating System</InputLabel>
                <Select value={targetOS} onChange={(e) => setTargetOS(e.target.value)} sx={{ color: '#fff' }}>
                  <MenuItem value="windows">Windows OS (PowerShell)</MenuItem>
                  <MenuItem value="linux">Linux OS (Bash)</MenuItem>
                  <MenuItem value="macos">macOS (Shell PKG)</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}

          {wizardStep === 2 && (
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#9598a3', mb: 2 }}>System Dependencies:</Typography>
              {targetOS === 'windows' ? (
                <ul>
                  <li>PowerShell v5.0 or newer</li>
                  <li>Internet connectivity to FastAPI backend</li>
                  <li>Administrator execution privileges</li>
                </ul>
              ) : (
                <ul>
                  <li>libc-based Linux host (Ubuntu/CentOS)</li>
                  <li>cURL/wget package</li>
                  <li>Root/sudo terminal access</li>
                </ul>
              )}
            </Box>
          )}

          {wizardStep === 3 && (
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#9598a3', mb: 1.5 }}>Deployment script command line:</Typography>
              <Paper sx={{ p: 2, bgcolor: '#0b0c10', border: '1px solid #232630', fontFamily: 'monospace', fontSize: 11, color: '#00e5ff', overflowX: 'auto' }}>
                <pre style={{ margin: 0 }}>{deploymentCode}</pre>
              </Paper>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigator.clipboard.writeText(deploymentCode)}
                sx={{ mt: 2, color: '#ff9100', borderColor: '#ff9100' }}
              >
                Copy Command line
              </Button>
            </Box>
          )}

          {wizardStep === 4 && (
            <Box>
              <Alert severity="success" sx={{ bgcolor: 'rgba(46,125,50,0.1)', color: '#00e676', border: '1px solid #2e7d32' }}>
                Script deployment details generated! Execute the copied command on your server terminal. The agent will check-in and display in the table automatically.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeployWizard(false)} sx={{ color: '#9598a3' }}>Close</Button>
          {wizardStep < 4 && (
            <Button
              onClick={() => {
                if (wizardStep === 2) handleGenerateScript();
                else setWizardStep(wizardStep + 1);
              }}
              variant="contained"
              sx={{ bgcolor: '#f05a28', '&:hover': { bgcolor: '#d84315' } }}
            >
              {wizardStep === 3 ? 'Finish' : 'Next'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Agent Deletion Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        PaperProps={{ sx: { bgcolor: '#12131a', border: '1px solid #232630', color: '#fff' } }}
      >
        <DialogTitle sx={{ color: '#ff1744', fontWeight: 'bold' }}>Confirm Endpoint Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#e3e4e8', mb: 1 }}>
            Are you sure you want to permanently delete the agent <strong>{agentToDelete?.hostname}</strong>?
          </Typography>
          <Typography variant="caption" sx={{ color: '#8c909e' }}>
            This will remove all association, credentials, and configuration logs from the XDR control database. Deployed agent processes will need to be redeployed to check-in again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting} sx={{ color: '#9598a3' }}>Cancel</Button>
          <Button
            onClick={handleDeleteAgent}
            disabled={deleting}
            variant="contained"
            sx={{ bgcolor: '#ff1744', '&:hover': { bgcolor: '#d50000' } }}
          >
            {deleting ? 'Deleting Agent...' : 'Confirm Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Agents;
