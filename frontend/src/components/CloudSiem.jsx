import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Grid, Typography, Button, Table, TableContainer, TableHead, TableRow, TableCell, TableBody, Chip, Divider, CircularProgress, TextField, Alert } from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import SecurityIcon from '@mui/icons-material/Security';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SearchIcon from '@mui/icons-material/Search';
import SyncIcon from '@mui/icons-material/Sync';

function CloudSiem({ section }) {
  const [isSetup, setIsSetup] = useState(null);
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [azureTenant, setAzureTenant] = useState('');
  const [gcpJson, setGcpJson] = useState('');
  const [role, setRole] = useState('Analyst');

  const [logs, setLogs] = useState([]);
  const [findings, setFindings] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const checkSetupStatus = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/events/cloud/check-setup`);
      if (resp.ok) {
        const data = await resp.json();
        setIsSetup(data.is_setup);
        setRole(data.role || 'Analyst');
      }
    } catch (e) {
      console.error(e);
      setIsSetup(false);
    }
  };

  const fetchCloudData = async () => {
    setLoading(true);
    try {
      const logsRes = await fetch(`${API_BASE_URL}/events/cloud/logs`);
      const postureRes = await fetch(`${API_BASE_URL}/events/cloud/posture`);
      const anomaliesRes = await fetch(`${API_BASE_URL}/events/cloud/anomalies`);
      const alertsRes = await fetch(`${API_BASE_URL}/events/cloud/alerts`);
      
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
      if (postureRes.ok) {
        const data = await postureRes.json();
        setFindings(data.findings || []);
      }
      if (anomaliesRes.ok) {
        const data = await anomaliesRes.json();
        setAnomalies(data.anomalies || []);
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    } catch (e) {
      console.error("Error fetching cloud data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSetupStatus();
  }, []);

  useEffect(() => {
    if (isSetup) {
      fetchCloudData();
    }
  }, [isSetup, section]);

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    try {
      const resp = await fetch(`${API_BASE_URL}/events/cloud/save-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awsAccessKey,
          awsSecretKey,
          azureTenant,
          gcpJson,
          role
        })
      });
      if (resp.ok) {
        setIsSetup(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSandboxMode = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/events/cloud/save-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awsAccessKey: 'DEMO_AWS_ACCESS_KEY',
          awsSecretKey: 'DEMO_AWS_SECRET_KEY',
          azureTenant: '00000000-0000-0000-0000-000000000000',
          gcpJson: 'demo_base64_json',
          role: 'Admin'
        })
      });
      if (resp.ok) {
        setIsSetup(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisconnect = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/events/cloud/reset-credentials`, {
        method: 'POST'
      });
      if (resp.ok) {
        setIsSetup(false);
        setAwsAccessKey('');
        setAwsSecretKey('');
        setAzureTenant('');
        setGcpJson('');
        setRole('Analyst');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemediate = async (ruleId) => {
    if (role !== 'Admin') {
      setActionMessage({ type: 'error', text: "RBAC Error: Only 'Security Admin' role users can run auto-remediation." });
      setTimeout(() => setActionMessage(null), 5000);
      return;
    }
    try {
      const resp = await fetch(`${API_BASE_URL}/events/cloud/remediate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_id: ruleId })
      });
      if (resp.ok) {
        const data = await resp.json();
        setFindings(data.findings);
        setActionMessage({ type: 'success', text: `Successfully remediated check ${ruleId}! Auto-remediation SOAR playbook run recorded in logs.` });
        setTimeout(() => setActionMessage(null), 5000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulate = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/events/cloud/simulate`, {
        method: 'POST'
      });
      if (resp.ok) {
        fetchCloudData();
        setActionMessage({ type: 'info', text: "Cloud anomalies and logs re-injected. Threat simulation active!" });
        setTimeout(() => setActionMessage(null), 5000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleIngest = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/events/cloud/ingest`, {
        method: 'POST'
      });
      if (resp.ok) {
        fetchCloudData();
        setActionMessage({ type: 'success', text: "Successfully fetched and ingested AWS CloudTrail logs!" });
        setTimeout(() => setActionMessage(null), 5000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter logs based on search query
  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.cloud_provider.toLowerCase().includes(query) ||
      log.activity_name.toLowerCase().includes(query) ||
      log.user_identity.toLowerCase().includes(query) ||
      log.source_ip.toLowerCase().includes(query) ||
      log.api_service_name.toLowerCase().includes(query)
    );
  });

  // Dynamic Graph Nodes and Links matching Tauri logic
  const graphData = React.useMemo(() => {
    const nodes = [];
    const links = [];
    const nodeSet = new Set();

    const addNode = (id, group, val, name) => {
      if (!nodeSet.has(id)) {
        nodes.push({ id, group, val, name });
        nodeSet.add(id);
      }
    };

    alerts.forEach(a => {
      addNode(a.source_ip, 1, 12, a.source_ip);
      addNode(a.rule_name, 2, 6, a.rule_name);
      links.push({ source: a.source_ip, target: a.rule_name });
    });

    anomalies.forEach(a => {
      addNode(a.source_ip, 1, 15, a.source_ip);
      addNode("Anomaly: Volumetric", 3, 5, "Anomaly: Volumetric");
      links.push({ source: a.source_ip, target: "Anomaly: Volumetric" });
    });

    logs.forEach(l => {
      if (l.cloud_provider) {
         addNode(l.cloud_provider, 4, 8, l.cloud_provider);
         addNode(l.source_ip, 1, 12, l.source_ip);
         links.push({ source: l.source_ip, target: l.cloud_provider });
      }
    });

    return { nodes, links };
  }, [alerts, anomalies, logs]);

  // Position nodes in columns
  const positionedNodes = React.useMemo(() => {
    const { nodes } = graphData;
    const leftNodes = nodes.filter(n => n.group === 1);
    const midNodes = nodes.filter(n => n.group === 4);
    const rightNodes = nodes.filter(n => n.group === 2 || n.group === 3);

    const positions = {};

    leftNodes.forEach((n, idx) => {
      const step = 320 / Math.max(leftNodes.length, 1);
      positions[n.id] = {
        x: 230,
        y: 40 + idx * step + step / 2
      };
    });

    midNodes.forEach((n, idx) => {
      let y = 200;
      if (n.id === 'AWS') y = 100;
      if (n.id === 'Azure') y = 200;
      if (n.id === 'GCP') y = 300;
      positions[n.id] = {
        x: 460,
        y
      };
    });

    rightNodes.forEach((n, idx) => {
      const step = 320 / Math.max(rightNodes.length, 1);
      positions[n.id] = {
        x: 690,
        y: 40 + idx * step + step / 2
      };
    });

    return positions;
  }, [graphData]);

  if (isSetup === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  // 1. Setup Screen
  if (!isSetup) {
    return (
      <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
        <Paper sx={{ p: 4, bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', maxWidth: 500, width: '100%' }}>
          <Typography variant="h5" align="center" sx={{ fontWeight: 'bold', color: '#64b5f6', mb: 1 }}>
            SIEM / CSPM Setup
          </Typography>
          <Typography variant="body2" align="center" color="textSecondary" sx={{ mb: 4 }}>
            Multi-Cloud Enterprise Edition v2.0
          </Typography>
          
          <form onSubmit={handleSetupSubmit}>
            {/* AWS Block */}
            <Typography variant="subtitle2" sx={{ color: '#64b5f6', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 0.5, mb: 2 }}>
              AWS Integration
            </Typography>
            <TextField
              label="AWS Access Key"
              fullWidth
              size="small"
              required
              value={awsAccessKey}
              onChange={(e) => setAwsAccessKey(e.target.value)}
              sx={{ mb: 2, '& input': { color: '#fff' } }}
              InputLabelProps={{ style: { color: 'rgba(255,255,255,0.5)' } }}
            />
            <TextField
              label="AWS Secret Key"
              type="password"
              fullWidth
              size="small"
              required
              value={awsSecretKey}
              onChange={(e) => setAwsSecretKey(e.target.value)}
              sx={{ mb: 3, '& input': { color: '#fff' } }}
              InputLabelProps={{ style: { color: 'rgba(255,255,255,0.5)' } }}
            />

            {/* Azure Block */}
            <Typography variant="subtitle2" sx={{ color: '#64b5f6', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 0.5, mb: 2 }}>
              Azure Integration (Optional)
            </Typography>
            <TextField
              label="Azure Tenant ID"
              placeholder="00000000-0000-0000-0000-000000000000"
              fullWidth
              size="small"
              value={azureTenant}
              onChange={(e) => setAzureTenant(e.target.value)}
              sx={{ mb: 3, '& input': { color: '#fff' } }}
              InputLabelProps={{ style: { color: 'rgba(255,255,255,0.5)' } }}
            />

            {/* GCP Block */}
            <Typography variant="subtitle2" sx={{ color: '#64b5f6', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 0.5, mb: 2 }}>
              GCP Integration (Optional)
            </Typography>
            <TextField
              label="Service Account JSON Base64"
              type="password"
              fullWidth
              size="small"
              value={gcpJson}
              onChange={(e) => setGcpJson(e.target.value)}
              sx={{ mb: 3, '& input': { color: '#fff' } }}
              InputLabelProps={{ style: { color: 'rgba(255,255,255,0.5)' } }}
            />

            {/* RBAC */}
            <Typography variant="subtitle2" sx={{ color: '#64b5f6', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 0.5, mb: 2 }}>
              RBAC Role Assignment
            </Typography>
            <Box sx={{ mb: 3 }}>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#090a0f',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#fff',
                  outline: 'none'
                }}
              >
                <option value="Admin">Security Admin (Full Access + SOAR)</option>
                <option value="Analyst">Security Analyst (Read-Only)</option>
              </select>
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ bgcolor: '#1e88e5', color: '#fff', mb: 2, py: 1.2, fontWeight: 'bold', '&:hover': { bgcolor: '#1565c0' } }}
            >
              Authenticate & Launch Multi-Cloud
            </Button>
            
            <Button
              variant="outlined"
              fullWidth
              onClick={handleSandboxMode}
              sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#9598a3', '&:hover': { borderColor: '#fff', color: '#fff' } }}
            >
              Use Demo Sandbox Mode
            </Button>
          </form>
          
          <Typography variant="caption" align="center" display="block" color="textSecondary" sx={{ mt: 3 }}>
            Credentials stored securely in cloud_config.json
          </Typography>
        </Paper>
      </Box>
    );
  }

  // 2. Main Dashboard Views
  return (
    <Box sx={{ color: '#fff' }}>
      {actionMessage && (
        <Alert severity={actionMessage.type} sx={{ mb: 3, bgcolor: '#1b1d26', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>
          {actionMessage.text}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : (
        <Box>
          {/* Tab 1: Dashboard Overview */}
          {section === 'cloud_dashboard' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
                  Executive Summary (AWS + Azure + GCP)
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleDisconnect}
                    sx={{ borderColor: 'rgba(255,23,68,0.4)', color: '#ff1744', '&:hover': { bgcolor: 'rgba(255,23,68,0.05)', borderColor: '#ff1744' } }}
                  >
                    Disconnect Cloud
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      let csv = "Type,ID,Title,Severity,Status,Resource\n";
                      findings.forEach(f => {
                        csv += `CSPM,${f.rule_id},"${f.title}",${f.severity},${f.status},${f.resource}\n`;
                      });
                      alerts.forEach(a => {
                        csv += `Alert,${a.id},"${a.rule_name}",${a.severity},OPEN,${a.source_ip}\n`;
                      });
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.setAttribute("download", "prowler_benchmark_report.csv");
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', '&:hover': { borderColor: '#fff' } }}
                  >
                    Export Benchmark Report
                  </Button>
                </Box>
              </Box>

              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 3, bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <Typography variant="caption" color="textSecondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                      Logs Ingested
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
                      {logs.length}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 3, bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <Typography variant="caption" color="textSecondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                      Open Alerts
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1, color: '#ff1744' }}>
                      {alerts.length}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 3, bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <Typography variant="caption" color="textSecondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                      Anomalies
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1, color: '#ff9100' }}>
                      {anomalies.length}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 3, bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <Typography variant="caption" color="textSecondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                      Failed Posture Checks
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1, color: '#ffd600' }}>
                      {findings.filter(f => f.status === 'FAIL').length}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
                <Button
                  variant="contained"
                  startIcon={<SyncIcon />}
                  onClick={handleIngest}
                  sx={{ bgcolor: '#2e7d32', color: '#fff', '&:hover': { bgcolor: '#1b5e20' } }}
                >
                  Fetch Real CloudTrail Logs
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleSimulate}
                  sx={{ bgcolor: '#d32f2f', color: '#fff', '&:hover': { bgcolor: '#c62828' } }}
                >
                  Inject Red Team Synthetic Data (Multi-Cloud)
                </Button>
              </Box>
            </Box>
          )}

          {/* Tab 2: Threat Graph (Custom SVG Nodes Rendering) */}
          {section === 'cloud_graph' && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                Threat Graph
              </Typography>
              <Paper sx={{ p: 3, bgcolor: '#090a0f', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ position: 'absolute', top: 20, left: 20, zIndex: 10, bgcolor: 'rgba(18,19,26,0.9)', p: 2, borderRadius: 1, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 1, color: '#f05a28' }}>Legend</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff1744' }} />
                    <Typography variant="caption">Malicious IPs</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff9100' }} />
                    <Typography variant="caption">Triggered Rules</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ffd600' }} />
                    <Typography variant="caption">Anomalies</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#9c27b0' }} />
                    <Typography variant="caption">Cloud Providers</Typography>
                  </Box>
                </Box>

                {/* Dynamic SVG Graph Canvas */}
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                  <svg width="100%" height="100%" viewBox="0 0 800 400" style={{ overflow: 'visible' }}>
                    <defs>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Connective Lines */}
                    {graphData.links.map((link, idx) => {
                      const start = positionedNodes[link.source];
                      const end = positionedNodes[link.target];
                      if (!start || !end) return null;
                      return (
                        <line
                          key={idx}
                          x1={start.x}
                          y1={start.y}
                          x2={end.x}
                          y2={end.y}
                          stroke="rgba(255,255,255,0.12)"
                          strokeWidth="1.5"
                        />
                      );
                    })}

                    {/* Nodes */}
                    {graphData.nodes.map((node, idx) => {
                      const pos = positionedNodes[node.id];
                      if (!pos) return null;
                      
                      let color = '#fff';
                      if (node.group === 1) color = '#ff1744'; // Red IP
                      if (node.group === 2) color = '#ff9100'; // Orange Rule
                      if (node.group === 3) color = '#ffd600'; // Yellow Anomaly
                      if (node.group === 4) { // Purple/Unique Cloud Provider
                        if (node.id === 'AWS') color = '#ff9900';
                        if (node.id === 'Azure') color = '#00bcf2';
                        if (node.id === 'GCP') color = '#ea4335';
                      }

                      return (
                        <g key={idx}>
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={node.group === 4 ? 18 : 10}
                            fill="#12131a"
                            stroke={color}
                            strokeWidth="2.5"
                            filter="url(#glow)"
                          />
                          <text
                            x={pos.x}
                            y={pos.y + (node.group === 4 ? 32 : 22)}
                            fill="#9598a3"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {node.name.length > 25 ? `${node.name.substring(0, 22)}...` : node.name}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Tab 3: Log Explorer */}
          {section === 'cloud_logs' && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                Log Explorer
              </Typography>
              {/* Search Bar */}
              <Box sx={{ display: 'flex', bgcolor: '#12131a', px: 2, py: 1, borderRadius: 1, border: '1px solid rgba(255,255,255,0.05)', mb: 3 }}>
                <SearchIcon sx={{ color: '#8c909e', alignSelf: 'center', mr: 1 }} />
                <TextField
                  placeholder='e.g., cloud_provider:"Azure" source_ip:"192.168.1.1"'
                  variant="standard"
                  fullWidth
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    disableUnderline: true,
                    style: { color: '#fff', fontSize: 13, fontFamily: 'monospace' }
                  }}
                />
              </Box>

              <TableContainer component={Paper} sx={{ bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#181922' }}>
                      <TableCell sx={{ color: '#8c909e', fontWeight: 'bold' }}>Cloud</TableCell>
                      <TableCell sx={{ color: '#8c909e', fontWeight: 'bold' }}>Time</TableCell>
                      <TableCell sx={{ color: '#8c909e', fontWeight: 'bold' }}>Activity</TableCell>
                      <TableCell sx={{ color: '#8c909e', fontWeight: 'bold' }}>User</TableCell>
                      <TableCell sx={{ color: '#8c909e', fontWeight: 'bold' }}>Source IP</TableCell>
                      <TableCell sx={{ color: '#8c909e', fontWeight: 'bold' }}>Service</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.map((log, idx) => (
                      <TableRow key={idx} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                        <TableCell>
                          <Chip
                            label={log.cloud_provider}
                            size="small"
                            sx={{
                              fontSize: 9,
                              fontWeight: 'bold',
                              height: 18,
                              bgcolor: log.cloud_provider === 'AWS' ? 'rgba(240,90,40,0.15)' : log.cloud_provider === 'Azure' ? 'rgba(0,176,255,0.15)' : 'rgba(234,67,53,0.15)',
                              color: log.cloud_provider === 'AWS' ? '#f05a28' : log.cloud_provider === 'Azure' ? '#00b0ff' : '#ea4335'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: 11, color: '#9598a3' }}>{log.event_time}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#64b5f6' }}>{log.activity_name}</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>{log.user_identity}</TableCell>
                        <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', color: log.source_ip === '192.168.1.45' || log.source_ip === '10.0.0.5' ? '#ff1744' : '#fff' }}>
                          {log.source_ip}
                        </TableCell>
                        <TableCell sx={{ fontSize: 11, color: '#9598a3' }}>{log.api_service_name}</TableCell>
                      </TableRow>
                    ))}
                    {filteredLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center', color: '#8c909e' }}>
                          No matching cloud events found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Tab 4: Alert Triage */}
          {section === 'cloud_triage' && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                  Correlated Security Alerts (Multi-Cloud)
                </Typography>
                <Grid container spacing={2}>
                  {alerts.map(alert => (
                    <Grid item xs={12} key={alert.id}>
                      <Paper sx={{ p: 3, bgcolor: '#12131a', border: '1px solid rgba(255,23,68,0.15)', borderRadius: '8px', display: 'flex', gap: 2 }}>
                        <Chip
                          label={alert.severity}
                          size="small"
                          sx={{
                            fontWeight: 'bold',
                            fontSize: 10,
                            bgcolor: alert.severity === 'CRITICAL' ? '#d32f2f' : '#f57c00',
                            color: '#fff'
                          }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff' }}>
                            {alert.rule_name}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#9598a3', mt: 0.5 }}>
                            {alert.description}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 4, mt: 2 }}>
                            <Typography variant="caption" sx={{ color: '#8c909e' }}>
                              <strong>IP:</strong> {alert.source_ip}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#8c909e' }}>
                              <strong>Tactic:</strong> {alert.mitre_tactic}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#8c909e' }}>
                              <strong>Technique:</strong> <Chip label={alert.mitre_technique} size="small" sx={{ fontSize: 9, height: 16, bgcolor: '#1c1e28', color: '#64b5f6' }} />
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="caption" sx={{ color: '#8c909e' }}>
                          {alert.time}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                  {alerts.length === 0 && (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#12131a', color: '#8c909e' }}>
                        No alerts detected. Ingest data to analyze cloud activities.
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </Grid>

              {/* Volumetric Anomalies */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                  Statistical Volumetric Anomalies
                </Typography>
                <Grid container spacing={2}>
                  {anomalies.map((anom, idx) => (
                    <Grid item xs={12} key={idx}>
                      <Paper sx={{ p: 3, bgcolor: '#12131a', border: '1px solid rgba(255,145,0,0.15)', borderRadius: '8px' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff' }}>
                          {anom.anomaly_type}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#9598a3', mt: 0.5 }}>
                          {anom.description}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 2, fontFamily: 'monospace', color: '#ffcc80' }}>
                          Offending IP: {anom.source_ip} (Total Events: {anom.event_count})
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                  {anomalies.length === 0 && (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 4, py: 6, textAlign: 'center', bgcolor: '#12131a', color: '#8c909e', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        No anomalies detected. Run Stratus Red Team simulation to generate anomalies.
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </Grid>
            </Grid>
          )}

          {/* Tab 5: CSPM Posture */}
          {section === 'cloud_posture' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Cloud Posture & Auto-Remediation (SOAR)
                </Typography>
                <Button startIcon={<SyncIcon />} onClick={fetchCloudData} sx={{ color: '#64b5f6', textTransform: 'none' }}>
                  Refresh Scan
                </Button>
              </Box>

              <Grid container spacing={3}>
                {findings.map(finding => (
                  <Grid item xs={12} key={finding.rule_id}>
                    <Paper sx={{ p: 3, bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '8px' }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Chip
                            label={finding.severity}
                            size="small"
                            sx={{
                              fontSize: 9,
                              fontWeight: 'bold',
                              height: 18,
                              bgcolor: finding.severity === 'CRITICAL' ? 'rgba(255,23,68,0.15)' : finding.severity === 'HIGH' ? 'rgba(255,145,0,0.15)' : finding.severity === 'MEDIUM' ? 'rgba(0,230,118,0.15)' : 'rgba(255,214,0,0.15)',
                              color: finding.severity === 'CRITICAL' ? '#ff1744' : finding.severity === 'HIGH' ? '#ff9100' : finding.severity === 'MEDIUM' ? '#00e676' : '#ffd600'
                            }}
                          />
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {finding.title}
                          </Typography>
                          <Chip
                            label={finding.status}
                            icon={finding.status === 'PASS' ? <CheckCircleIcon style={{ color: '#00e676', fontSize: 14 }} /> : <ErrorIcon style={{ color: '#ff1744', fontSize: 14 }} />}
                            size="small"
                            sx={{
                              fontSize: 9,
                              fontWeight: 'bold',
                              height: 18,
                              border: `1px solid ${finding.status === 'PASS' ? '#00e676' : '#ff1744'}`,
                              bgcolor: 'transparent',
                              color: finding.status === 'PASS' ? '#00e676' : '#ff1744',
                              '& .MuiChip-icon': { color: 'inherit' }
                            }}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ color: '#9598a3' }}>
                          {finding.description}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, fontFamily: 'monospace', color: '#546e7a' }}>
                          Resource: {finding.resource}
                        </Typography>
                      </Box>

                      {finding.rule_id === 'S3.1' && finding.status === 'FAIL' && (
                        <Button
                          variant="contained"
                          onClick={() => handleRemediate(finding.rule_id)}
                          sx={{
                            bgcolor: '#9c27b0',
                            color: '#fff',
                            px: 3,
                            boxShadow: '0 0 10px rgba(156,39,176,0.3)',
                            '&:hover': { bgcolor: '#7b1fa2' }
                          }}
                        >
                          Auto-Remediate (SOAR)
                        </Button>
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default CloudSiem;
