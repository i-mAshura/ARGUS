import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, LinearProgress, Tabs, Tab, TextField, InputAdornment, IconButton, Collapse, Tooltip as MuiTooltip, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ShieldIcon from '@mui/icons-material/Shield';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import TerminalIcon from '@mui/icons-material/Terminal';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DescriptionIcon from '@mui/icons-material/Description';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { RadialBarChart, RadialBar, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = {
  passed: '#00e676',
  failed: '#ff1744',
  warning: '#ff9100',
  pending: '#8c909e'
};

const mockComplianceEvents = [];

function Compliance({ selectedAgent = 'all' }) {
  const [activeModuleTab, setActiveModuleTab] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [eventList, setEventList] = useState([]);
  const [eventSearch, setEventSearch] = useState('');
  const [eventExpanded, setEventExpanded] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Dynamic state for compliance checklist & radial chart
  const [complianceStats, setComplianceStats] = useState([
    { name: 'CIS Benchmarks', value: 0, fill: '#f05a28' },
    { name: 'GDPR Privacy', value: 0, fill: '#00b0ff' },
    { name: 'ISO 27001', value: 0, fill: '#ffd600' },
    { name: 'PCI-DSS v4.0', value: 0, fill: '#ff1744' }
  ]);

  const [complianceRules, setComplianceRules] = useState([
    { id: '1.1', control: 'Ensure root login via SSH is disabled', standard: 'CIS Benchmark', status: 'pending', drift: 'Waiting for telemetry' },
    { id: '1.2', control: 'Ensure password hashing algorithm is SHA-512', standard: 'CIS Benchmark', status: 'pending', drift: 'Waiting for telemetry' },
    { id: '2.1', control: 'Encrypt all sensitive data-at-rest buffers', standard: 'GDPR Art. 32', status: 'pending', drift: 'Waiting for telemetry' },
    { id: '2.2', control: 'Maintain log retention archives for 365 days', standard: 'GDPR Art. 30', status: 'pending', drift: 'Waiting for telemetry' },
    { id: '3.1', control: 'Enforce MFA authentication on all admin nodes', standard: 'ISO 27001 A.9', status: 'pending', drift: 'Waiting for telemetry' },
    { id: '3.2', control: 'Enforce password complexity (min 12 chars)', standard: 'ISO 27001 A.9', status: 'pending', drift: 'Waiting for telemetry' },
    { id: '4.1', control: 'Disable default manufacturer passwords', standard: 'PCI-DSS Req 2', status: 'pending', drift: 'Waiting for telemetry' },
    { id: '4.2', control: 'Mask PAN numbers (Credit Card primary info)', standard: 'PCI-DSS Req 3', status: 'pending', drift: 'Waiting for telemetry' }
  ]);

  const [containerAudits, setContainerAudits] = useState([
    { id: 'c-001', resource: 'k8s-api-server', type: 'Kubernetes Control Plane', check: 'Anonymous requests disabled', status: 'pending', risk: 'low' },
    { id: 'c-002', resource: 'docker-daemon', type: 'Docker Host configuration', check: 'Restrict container root privileges', status: 'pending', risk: 'critical' },
    { id: 'c-003', resource: 'k8s-pod-security', type: 'Kubernetes Pod Manifest', check: 'Read-only root filesystem enforced', status: 'pending', risk: 'medium' },
    { id: 'c-004', resource: 'etcd-cluster', type: 'Kubernetes Datastore', check: 'TLS authentication active for peers', status: 'pending', risk: 'low' },
    { id: 'c-005', resource: 'nginx-ingress', type: 'Container Application', check: 'Vulnerabilities level <= medium', status: 'pending', risk: 'high' }
  ]);

  // Legacy Log Parser State
  const [rawLogs, setRawLogs] = useState('');
  const [logFormat, setLogFormat] = useState('auto');
  const [parserResults, setParserResults] = useState(null);
  const [parsingLogs, setParsingLogs] = useState(false);

  const handleParseLegacyLogs = async () => {
    if (!rawLogs.trim()) return;
    setParsingLogs(true);
    setParserResults(null);
    try {
      const response = await fetch("${API_BASE_URL}/compliance/parse-legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logs: rawLogs,
          format: logFormat,
          hostname: "legacy-ingest"
        })
      });
      if (response.ok) {
        const data = await response.json();
        setParserResults(data);
        fetchComplianceEvents();
        fetchComplianceSummary();
      } else {
        alert("Failed to parse logs.");
      }
    } catch (err) {
      console.error(err);
      alert("Error calling parser service.");
    }
    setParsingLogs(false);
  };

  const handleLoadSample = (type) => {
    if (type === 'syslog') {
      setLogFormat('syslog');
      setRawLogs(
        `Jun  4 10:22:15 host-syslog sshd[1234]: Failed password for invalid user admin from 192.168.1.100\n` +
        `Jun  4 10:25:00 host-syslog sshd[1234]: PermitRootLogin no\n` +
        `Jun  4 10:30:00 host-syslog transaction_service: PAN cardholder number 4111-1111-1111-1111 found.`
      );
    } else if (type === 'web') {
      setLogFormat('web');
      setRawLogs(
        `192.168.1.50 - - [04/Jun/2026:10:22:15 +0000] "GET /api/v1/users HTTP/1.1" 200 4520 "http://referrer.com" "Mozilla/5.0"\n` +
        `192.168.1.50 - - [04/Jun/2026:10:23:45 +0000] "POST /login HTTP/1.1" 401 120 "http://referrer.com" "Mozilla/5.0 (Failed password)"\n` +
        `192.168.1.60 - - [04/Jun/2026:10:25:00 +0000] "GET /db/sqlite.db HTTP/1.1" 403 0 "-" "curl/7.68.0"`
      );
    }
  };

  useEffect(() => {
    fetchComplianceSummary();
    fetchContainerAudits();
    if (activeModuleTab === 1) {
      fetchComplianceEvents();
    }
  }, [activeModuleTab, selectedAgent, eventSearch]);

  const fetchComplianceSummary = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/integrations/agent/compliance`);
      if (response.ok) {
        const data = await response.json();
        const stds = data.standards || {};
        setComplianceStats([
          { name: 'CIS Benchmarks', value: parseInt(stds.cis || 0), fill: '#f05a28' },
          { name: 'GDPR Privacy', value: parseInt(stds.gdpr || 0), fill: '#00b0ff' },
          { name: 'ISO 27001', value: parseInt(stds.nist || 0), fill: '#ffd600' },
          { name: 'PCI-DSS v4.0', value: parseInt(stds.pci_dss || 0), fill: '#ff1744' }
        ]);

        const detailed = data.detailed_compliance || [];
        if (detailed.length > 0) {
          const updatedRules = complianceRules.map(rule => {
            const match = detailed.find(d => String(d.id) === String(rule.id));
            if (match) {
              return {
                ...rule,
                status: match.status === 'compliant' || match.status === 'passed' ? 'passed' : 'failed',
                drift: match.drift || (match.status === 'compliant' || match.status === 'passed' ? 'None' : 'Non-compliant configuration detected')
              };
            }
            return rule;
          });
          setComplianceRules(updatedRules);
        } else {
          setComplianceRules([
            { id: '1.1', control: 'Ensure root login via SSH is disabled', standard: 'CIS Benchmark', status: 'pending', drift: 'Waiting for telemetry' },
            { id: '1.2', control: 'Ensure password hashing algorithm is SHA-512', standard: 'CIS Benchmark', status: 'pending', drift: 'Waiting for telemetry' },
            { id: '2.1', control: 'Encrypt all sensitive data-at-rest buffers', standard: 'GDPR Art. 32', status: 'pending', drift: 'Waiting for telemetry' },
            { id: '2.2', control: 'Maintain log retention archives for 365 days', standard: 'GDPR Art. 30', status: 'pending', drift: 'Waiting for telemetry' },
            { id: '3.1', control: 'Enforce MFA authentication on all admin nodes', standard: 'ISO 27001 A.9', status: 'pending', drift: 'Waiting for telemetry' },
            { id: '3.2', control: 'Enforce password complexity (min 12 chars)', standard: 'ISO 27001 A.9', status: 'pending', drift: 'Waiting for telemetry' },
            { id: '4.1', control: 'Disable default manufacturer passwords', standard: 'PCI-DSS Req 2', status: 'pending', drift: 'Waiting for telemetry' },
            { id: '4.2', control: 'Mask PAN numbers (Credit Card primary info)', standard: 'PCI-DSS Req 3', status: 'pending', drift: 'Waiting for telemetry' }
          ]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchContainerAudits = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/events/?event_type=container_audit&limit=50`);
      if (response.ok) {
        const data = await response.json();
        const events = data.events || [];
        if (events.length > 0) {
          const updatedAudits = containerAudits.map(audit => {
            const match = events.find(e => e.event_data?.resource === audit.resource || e.event_data?.control_id === audit.id);
            if (match) {
              return {
                ...audit,
                status: match.event_data?.status || 'failed',
                risk: match.event_data?.risk || audit.risk,
                check: match.event_data?.check || audit.check
              };
            }
            return audit;
          });
          setContainerAudits(updatedAudits);
        } else {
          setContainerAudits([
            { id: 'c-001', resource: 'k8s-api-server', type: 'Kubernetes Control Plane', check: 'Anonymous requests disabled', status: 'pending', risk: 'low' },
            { id: 'c-002', resource: 'docker-daemon', type: 'Docker Host configuration', check: 'Restrict container root privileges', status: 'pending', risk: 'critical' },
            { id: 'c-003', resource: 'k8s-pod-security', type: 'Kubernetes Pod Manifest', check: 'Read-only root filesystem enforced', status: 'pending', risk: 'medium' },
            { id: 'c-004', resource: 'etcd-cluster', type: 'Kubernetes Datastore', check: 'TLS authentication active for peers', status: 'pending', risk: 'low' },
            { id: 'c-005', resource: 'nginx-ingress', type: 'Container Application', check: 'Vulnerabilities level <= medium', status: 'pending', risk: 'high' }
          ]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchComplianceEvents = async () => {
    setEventsLoading(true);
    try {
      let url = `${API_BASE_URL}/events/?event_type=compliance&limit=100`;
      if (selectedAgent !== 'all') {
        url += `&hostname=${selectedAgent}`;
      }
      if (eventSearch.trim()) {
        url += `&search=${encodeURIComponent(eventSearch)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const items = data.events || [];
        setEventList(items);
      } else {
        setEventList([]);
      }
    } catch (e) {
      setEventList([]);
    }
    setEventsLoading(false);
  };

  const handleFilterClick = (filterVal) => {
    setEventSearch(filterVal);
  };

  const renderJsonTree = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object') return null;
    return Object.keys(obj).map((key) => {
      const val = obj[key];
      const isObject = val !== null && typeof val === 'object';
      const keyColor = '#ffb74d'; 
      let valColor = '#a5d6a7'; 
      let displayVal = JSON.stringify(val);

      if (typeof val === 'number') {
        valColor = '#29b6f6'; 
      } else if (typeof val === 'boolean') {
        valColor = '#e040fb'; 
      }

      if (isObject) {
        return (
          <Box key={key} sx={{ pl: depth * 2, mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: keyColor, fontFamily: 'monospace', fontWeight: 'bold' }}>
              "{key}":
            </Typography>
            <Box>{renderJsonTree(val, depth + 1)}</Box>
          </Box>
        );
      }

      return (
        <Box
          key={key}
          onClick={() => handleFilterClick(String(val))}
          sx={{
            pl: depth * 2,
            mt: 0.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'baseline',
            gap: 0.5,
            transition: 'all 0.1s',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' }
          }}
        >
          <MuiTooltip title={`Filter by: ${key} = ${displayVal}`} arrow placement="right">
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: keyColor, fontFamily: 'monospace', fontWeight: 'bold' }}>
                "{key}":
              </Typography>
              <Typography variant="caption" sx={{ color: valColor, fontFamily: 'monospace' }}>
                {displayVal}
              </Typography>
            </Box>
          </MuiTooltip>
        </Box>
      );
    });
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1.5 }}>
        <FactCheckIcon sx={{ color: '#f05a28', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
          Regulatory Compliance & Posture Management
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: '#8c909e', mb: 3 }}>
        Track CIS security benchmarks, data privacy audit directives, and container configuration scanning logs.
      </Typography>

      {/* Main Tabs Selector */}
      <Paper className="glass-panel" sx={{ mb: 3.5, bgcolor: '#12131a' }}>
        <Tabs
          value={activeModuleTab}
          onChange={(e, nv) => setActiveModuleTab(nv)}
          sx={{
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            '& .MuiTab-root': { color: '#8c909e', textTransform: 'none', fontWeight: 'bold' },
            '& .Mui-selected': { color: '#f05a28 !important' },
            '& .MuiTabs-indicator': { bgcolor: '#f05a28' }
          }}
        >
          <Tab label="Dashboard" />
          <Tab label="Events" />
          <Tab label="Legacy Log Ingest & Parser" />
        </Tabs>
      </Paper>

      {activeModuleTab === 0 && (
        <Box>
          <Paper className="glass-panel" sx={{ mb: 4, bgcolor: '#12131a' }}>
            <Tabs
              value={activeTab}
              onChange={(e, nv) => setActiveTab(nv)}
              sx={{
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                '& .MuiTab-root': { color: '#8c909e', textTransform: 'none', fontWeight: 'bold' },
                '& .Mui-selected': { color: '#f05a28 !important' },
                '& .MuiTabs-indicator': { bgcolor: '#f05a28' }
              }}
            >
              <Tab label="Standards Compliance Overview" />
              <Tab label="Container & Cloud Security audits" />
            </Tabs>
          </Paper>

          {activeTab === 0 && (
            <Grid container spacing={3.5}>
              {/* Posture Radial Chart */}
              <Grid item xs={12} md={5}>
                <Paper className="glass-panel" sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: '700', mb: 2, fontSize: 15 }}>
                    Overall Compliance Share
                  </Typography>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" barSize={10} data={complianceStats}>
                      <RadialBar
                        minAngle={15}
                        label={{ position: 'insideStart', fill: '#fff', fontSize: 9, fontWeight: 'bold' }}
                        background
                        clockWise
                        dataKey="value"
                      />
                      <Tooltip contentStyle={{ backgroundColor: '#12131a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <Legend iconSize={8} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 11 }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Compliance Checklist Table */}
              <Grid item xs={12} md={7}>
                <Paper className="glass-panel" sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: '700', mb: 2.5, fontSize: 15 }}>
                    Regulatory Standards Checklist (CIS, GDPR, ISO, PCI)
                  </Typography>
                  <TableContainer sx={{ maxHeight: 250 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#1c1e28', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11 } }}>
                          <TableCell>Control ID</TableCell>
                          <TableCell>Security Directive Requirement</TableCell>
                          <TableCell>Regulatory standard</TableCell>
                          <TableCell>Audit Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {complianceRules.map((rule) => (
                          <TableRow key={rule.id} hover sx={{ '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.2, fontSize: 12 } }}>
                            <TableCell sx={{ fontWeight: 'bold', color: '#ff9100' }}>{rule.id}</TableCell>
                            <TableCell>
                              <MuiTooltip title={rule.status === 'failed' || rule.status === 'warning' ? rule.drift : 'Compliant'} arrow>
                                <span>{rule.control}</span>
                              </MuiTooltip>
                            </TableCell>
                            <TableCell sx={{ opacity: 0.8 }}>{rule.standard}</TableCell>
                            <TableCell>
                              <Chip
                                label={rule.status.toUpperCase()}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: 8.5,
                                  fontWeight: 'bold',
                                  bgcolor: `${COLORS[rule.status]}15`,
                                  color: COLORS[rule.status],
                                  border: `1px solid ${COLORS[rule.status]}30`
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 1 && (
            <Box>
              <Grid container spacing={3.5} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={4}>
                  <Card className="glass-panel" sx={{ borderLeft: `4px solid ${COLORS.failed}` }}>
                    <CardContent>
                      <Typography color="#8c909e" variant="subtitle2">Critical Container Vulnerabilities</Typography>
                      <Typography variant="h4" color="#ff1744" sx={{ fontWeight: '800', mt: 1 }}>
                        {containerAudits.filter(a => a.status === 'failed' && (a.risk === 'critical' || a.risk === 'high')).length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card className="glass-panel" sx={{ borderLeft: `4px solid ${COLORS.warning}` }}>
                    <CardContent>
                      <Typography color="#8c909e" variant="subtitle2">Medium Risk Pod Drifts</Typography>
                      <Typography variant="h4" color="#ff9100" sx={{ fontWeight: '800', mt: 1 }}>
                        {containerAudits.filter(a => a.status === 'warning' || (a.status === 'failed' && a.risk === 'medium')).length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card className="glass-panel" sx={{ borderLeft: `4px solid ${COLORS.passed}` }}>
                    <CardContent>
                      <Typography color="#8c909e" variant="subtitle2">Passed Workload Configs</Typography>
                      <Typography variant="h4" color="#00e676" sx={{ fontWeight: '800', mt: 1 }}>
                        {containerAudits.filter(a => a.status === 'passed').length} / {containerAudits.length} checks
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Container Audit Log */}
              <Paper className="glass-panel" sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: '700', mb: 2.5, fontSize: 15 }}>
                  Active Container & Pod Configuration Hardening Logs
                </Typography>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#1c1e28', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11 } }}>
                        <TableCell>Resource Name</TableCell>
                        <TableCell>Infrastructure Node Type</TableCell>
                        <TableCell>Security check Description</TableCell>
                        <TableCell>Risk level</TableCell>
                        <TableCell>Verification State</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {containerAudits.map((audit) => (
                        <TableRow key={audit.id} hover sx={{ '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5, fontSize: 12 } }}>
                          <TableCell sx={{ fontWeight: 'bold' }}>{audit.resource}</TableCell>
                          <TableCell sx={{ opacity: 0.8 }}>{audit.type}</TableCell>
                          <TableCell>{audit.check}</TableCell>
                          <TableCell>
                            <Chip
                              label={audit.risk.toUpperCase()}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: 8.5,
                                fontWeight: 'bold',
                                bgcolor: audit.risk === 'critical' ? 'rgba(255,23,73,0.1)' : audit.risk === 'high' ? 'rgba(255,145,0,0.1)' : 'rgba(255,255,255,0.05)',
                                color: audit.risk === 'critical' ? '#ff1744' : audit.risk === 'high' ? '#ff9100' : '#8c909e'
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={audit.status.toUpperCase()}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: 8.5,
                                fontWeight: 'bold',
                                bgcolor: `${COLORS[audit.status]}15`,
                                color: COLORS[audit.status]
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </Box>
      )}

      {activeModuleTab === 1 && (
        /* Events Tab Layout */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            fullWidth
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="Search Compliance audit records... (Click JSON values below to filter instantly)"
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#8c909e' }} />
                </InputAdornment>
              )
            }}
            sx={{
              bgcolor: '#12131a',
              borderRadius: 1.5,
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' },
                '&:hover fieldset': { borderColor: '#f05a28' },
                '&.Mui-focused fieldset': { borderColor: '#f05a28' }
              }
            }}
          />

          <Paper className="glass-panel" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: '700', mb: 2, fontSize: 15 }}>
              Raw Ingested Compliance Audit Events ({eventList.length} matches)
            </Typography>

            {eventsLoading ? (
              <LinearProgress sx={{ bgcolor: '#1b1e27', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />
            ) : (
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11 } }}>
                      <TableCell width="40"></TableCell>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Host</TableCell>
                      <TableCell>Regulatory Standard</TableCell>
                      <TableCell>Requirement</TableCell>
                      <TableCell>Details / Drift</TableCell>
                      <TableCell align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {eventList.map((e, idx) => {
                      const expanded = eventExpanded === e.id;
                      const status = e.event_data?.status || 'failed';
                      return (
                        <React.Fragment key={e.id || idx}>
                          <TableRow hover sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#f0f2f5', py: 1.5, fontSize: 12.5 } }}>
                            <TableCell>
                              <IconButton size="small" onClick={() => setEventExpanded(expanded ? null : e.id)} sx={{ color: '#8c909e' }}>
                                {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                              </IconButton>
                            </TableCell>
                            <TableCell sx={{ opacity: 0.7, fontSize: 11 }}>{new Date(e.timestamp).toLocaleString()}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{e.hostname}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: '#ffd600' }}>{e.event_data?.standard}</TableCell>
                            <TableCell sx={{ color: '#ffb74d' }}>({e.event_data?.control_id}) {e.event_data?.control_name}</TableCell>
                            <TableCell>{e.event_data?.details}</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={status.toUpperCase()}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: 8.5,
                                  fontWeight: 'bold',
                                  bgcolor: `${COLORS[status]}15`,
                                  color: COLORS[status],
                                  border: `1px solid ${COLORS[status]}30`
                                }}
                              />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                              <Collapse in={expanded} timeout="auto" unmountOnExit>
                                <Box sx={{ py: 2, px: 3, bgcolor: '#090a0f', borderBottom: '1px solid rgba(255,255,255,0.06)', borderRadius: 1 }}>
                                  <Typography variant="subtitle2" sx={{ color: '#8c909e', fontWeight: 'bold', mb: 1, fontSize: 11 }}>
                                    Full Compliance Telemetry Details (JSON Tree)
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, borderLeft: '2px dashed rgba(255,255,255,0.06)', pl: 2 }}>
                                    {renderJsonTree(e)}
                                  </Box>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}

      {activeModuleTab === 2 && (
        /* Legacy Log Ingest & Parser Tab Layout */
        <Box>
          <Grid container spacing={3.5}>
            {/* Left panel: Input and Ingest controls */}
            <Grid item xs={12} md={5}>
              <Paper className="glass-panel" sx={{ p: 3, height: '100%', bgcolor: '#12131a' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                  <CloudUploadIcon sx={{ color: '#f05a28' }} />
                  <Typography variant="h6" sx={{ fontWeight: '700', fontSize: 16 }}>
                    Legacy Log Ingestion
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#8c909e', mb: 3.5 }}>
                  Submit logs from legacy databases, standard syslog engines, or raw web access endpoints. They will be parsed dynamically, mapped to compliance controls, and indexed under compliance telemetry.
                </Typography>

                {/* Format selection */}
                <FormControl fullWidth sx={{
                  mb: 2.5,
                  '& .MuiInputLabel-root': { color: '#8c909e' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#f05a28' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    bgcolor: '#1c1e28',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' },
                    '&:hover fieldset': { borderColor: '#f05a28' },
                    '&.Mui-focused fieldset': { borderColor: '#f05a28' }
                  },
                  '& .MuiSelect-icon': { color: '#8c909e' }
                }}>
                  <InputLabel id="log-format-label">Log Format Profile</InputLabel>
                  <Select
                    labelId="log-format-label"
                    value={logFormat}
                    label="Log Format Profile"
                    onChange={(e) => setLogFormat(e.target.value)}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          bgcolor: '#12131a',
                          border: '1px solid rgba(255,255,255,0.08)',
                          '& .MuiMenuItem-root': {
                            color: '#8c909e',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' },
                            '&.Mui-selected': { bgcolor: 'rgba(240,90,40,0.15)', color: '#f05a28' },
                            '&.Mui-selected:hover': { bgcolor: 'rgba(240,90,40,0.2)' }
                          }
                        }
                      }
                    }}
                  >
                    <MenuItem value="auto">Auto-Detect Format</MenuItem>
                    <MenuItem value="syslog">RFC-3164 Syslog</MenuItem>
                    <MenuItem value="web">Web Access Log (Apache/Nginx)</MenuItem>
                  </Select>
                </FormControl>

                {/* Raw logs input */}
                <TextField
                  fullWidth
                  multiline
                  rows={12}
                  value={rawLogs}
                  onChange={(e) => setRawLogs(e.target.value)}
                  placeholder="Paste raw log lines here..."
                  variant="outlined"
                  sx={{
                    mb: 3,
                    bgcolor: '#1c1e28',
                    borderRadius: 1.5,
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' },
                      '&:hover fieldset': { borderColor: '#f05a28' },
                      '&.Mui-focused fieldset': { borderColor: '#f05a28' }
                    }
                  }}
                />

                {/* Action buttons */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => handleLoadSample('syslog')}
                      sx={{
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: '#8c909e',
                        '&:hover': { borderColor: '#f05a28', color: '#fff', bgcolor: 'rgba(240,90,40,0.05)' }
                      }}
                    >
                      Sample Syslog
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => handleLoadSample('web')}
                      sx={{
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: '#8c909e',
                        '&:hover': { borderColor: '#f05a28', color: '#fff', bgcolor: 'rgba(240,90,40,0.05)' }
                      }}
                    >
                      Sample Web Log
                    </Button>
                  </Grid>
                </Grid>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleParseLegacyLogs}
                  disabled={parsingLogs || !rawLogs.trim()}
                  startIcon={<PlayArrowIcon />}
                  sx={{
                    mt: 3,
                    py: 1.5,
                    fontWeight: 'bold',
                    bgcolor: '#f05a28',
                    '&:hover': { bgcolor: '#d3481b' },
                    '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }
                  }}
                >
                  {parsingLogs ? "Processing Audits..." : "Parse & Audit Logs"}
                </Button>
              </Paper>
            </Grid>

            {/* Right panel: Results and KPIs */}
            <Grid item xs={12} md={7}>
              {!parserResults ? (
                <Paper className="glass-panel" sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 450, bgcolor: '#12131a' }}>
                  <TerminalIcon sx={{ fontSize: 72, color: 'rgba(255,255,255,0.08)', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: '700', mb: 1 }}>
                    Compliance Audit Console Idle
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#8c909e', maxWidth: 350 }}>
                    Select a formatting profile, paste unstructured legacy logs or load one of the preset samples, and click "Parse & Audit Logs" to evaluate standards.
                  </Typography>
                </Paper>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, height: '100%' }}>
                  {/* KPI Metrics */}
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Card className="glass-panel" sx={{ borderLeft: '4px solid #f05a28', bgcolor: '#12131a', height: '100%' }}>
                        <CardContent sx={{ p: '16px !important' }}>
                          <Typography color="#8c909e" sx={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Logs Ingested
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: '800', mt: 1, color: '#fff' }}>
                            {parserResults.total_lines_submitted}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Card className="glass-panel" sx={{ borderLeft: '4px solid #00e676', bgcolor: '#12131a', height: '100%' }}>
                        <CardContent sx={{ p: '16px !important' }}>
                          <Typography color="#8c909e" sx={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Parsed OK
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: '800', mt: 1, color: '#00e676' }}>
                            {parserResults.successfully_parsed}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Card className="glass-panel" sx={{ borderLeft: `4px solid ${parserResults.fallback_parses > 0 ? '#ff9100' : '#8c909e'}`, bgcolor: '#12131a', height: '100%' }}>
                        <CardContent sx={{ p: '16px !important' }}>
                          <Typography color="#8c909e" sx={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Fallback
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: '800', mt: 1, color: parserResults.fallback_parses > 0 ? '#ff9100' : '#8c909e' }}>
                            {parserResults.fallback_parses}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Card className="glass-panel" sx={{ borderLeft: '4px solid #ffd600', bgcolor: '#12131a', height: '100%' }}>
                        <CardContent sx={{ p: '16px !important' }}>
                          <Typography color="#8c909e" sx={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Matches
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: '800', mt: 1, color: '#ffd600' }}>
                            {parserResults.compliance_matches}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Log Audit Mapping Details */}
                  <Paper className="glass-panel" sx={{ p: 3, bgcolor: '#12131a', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                      <DescriptionIcon sx={{ color: '#f05a28' }} />
                      <Typography variant="h6" sx={{ fontWeight: '700', fontSize: 15 }}>
                        Regulatory Mapping Log Stream
                      </Typography>
                    </Box>
                    <TableContainer sx={{ maxHeight: 380, flexGrow: 1 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ '& th': { bgcolor: '#1c1e28', color: '#8c909e', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11 } }}>
                            <TableCell>Standard</TableCell>
                            <TableCell>Control Name</TableCell>
                            <TableCell>Audit Evaluation Details</TableCell>
                            <TableCell align="right">Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {parserResults.events.map((e, idx) => (
                            <TableRow key={e.id || idx} hover sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#f0f2f5', py: 1.5, fontSize: 12 } }}>
                              <TableCell sx={{ fontWeight: 'bold', color: '#ffd600' }}>{e.standard}</TableCell>
                              <TableCell sx={{ color: '#ffb74d' }}>{e.control_name}</TableCell>
                              <TableCell>{e.details}</TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={e.status.toUpperCase()}
                                  size="small"
                                  sx={{
                                    height: 16,
                                    fontSize: 8.5,
                                    fontWeight: 'bold',
                                    bgcolor: `${COLORS[e.status]}15`,
                                    color: COLORS[e.status],
                                    border: `1px solid ${COLORS[e.status]}30`
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>
              )}
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

export default Compliance;
