import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, TextField, InputAdornment, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Chip, Collapse, Button, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, LinearProgress } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlagIcon from '@mui/icons-material/Flag';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip as ChartTooltip } from 'recharts';

function Discover({ selectedAgent = 'all', searchQuery = '', onQueryChange }) {
  const [alerts, setAlerts] = useState([]);
  const [query, setQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Resolution Dialog state
  const [resDialog, setResDialog] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [resNotes, setResNotes] = useState('');

  const quickFilters = [
    { label: 'Critical Severity', q: 'critical' },
    { label: 'PowerShell Logs', q: 'powershell' },
    { label: 'Mimikatz Pattern', q: 'mimikatz' },
    { label: 'Certutil Downloader', q: 'certutil' },
    { label: 'Registry Persistence', q: 'registry' }
  ];

  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [selectedAgent, query]);

  const fetchAlerts = async () => {
    try {
      let url = `${API_BASE_URL}/alerts/?limit=100`;
      if (selectedAgent !== 'all') {
        url += `&hostname=${selectedAgent}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      let items = data.alerts || [];

      if (query.trim()) {
        const q = query.toLowerCase();
        items = items.filter(a => 
          a.title.toLowerCase().includes(q) || 
          a.hostname.toLowerCase().includes(q) ||
          a.severity.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
        );
      }

      if (items.length === 0 && !query) {
        items = [];
      }

      setAlerts(items);
    } catch (err) {
      console.error("Error loading alerts: ", err);
    }
    setLoading(false);
  };

  const handleAction = async (id, action) => {
    try {
      let endpoint = action === 'acknowledge' ? 'acknowledge' : action === 'investigate' ? 'investigate' : 'false-positive';
      const res = await fetch(`${API_BASE_URL}/alerts/${id}/${endpoint}`, { method: 'POST' });
      if (res.ok) fetchAlerts();
    } catch (err) {
      console.error(`Error: `, err);
    }
  };

  const handleOpenResolve = (id) => {
    setSelectedAlertId(id);
    setResNotes('');
    setResDialog(true);
  };

  const handleCloseResolve = () => {
    setResDialog(false);
    setSelectedAlertId(null);
  };

  const handleResolveSubmit = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${selectedAlertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: [resNotes] })
      });
      if (res.ok) {
        fetchAlerts();
        handleCloseResolve();
      }
    } catch (err) {
      console.error("Error: ", err);
    }
  };

  const getSeverityColor = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical': return '#ff1744';
      case 'high': return '#ff9100';
      case 'medium': return '#ffd600';
      case 'low': return '#00e676';
      default: return '#9598a3';
    }
  };

  const getTimelineData = () => {
    const buckets = {};
    alerts.forEach(a => {
      const date = new Date(((a.created_at || a.timestamp) + '').replace(/Z$/, '') + 'Z');
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      buckets[timeStr] = (buckets[timeStr] || 0) + 1;
    });

    const data = Object.keys(buckets).map(k => ({ time: k, count: buckets[k] }));
    if (data.length === 0) {
      return [];
    }
    return data.sort((a,b) => a.time.localeCompare(b.time));
  };

  const handleFilterClick = (filterValue) => {
    setQuery(filterValue);
    if (onQueryChange) onQueryChange(filterValue);
  };

  // Interactive Custom JSON Tree Renderer
  const renderJsonTree = (obj, depth = 0) => {
    return Object.keys(obj).map((key) => {
      const val = obj[key];
      const isObject = val !== null && typeof val === 'object';
      const keyColor = '#ffb74d'; // Key color orange
      let valColor = '#a5d6a7'; // String color green
      let displayVal = JSON.stringify(val);

      if (typeof val === 'number') {
        valColor = '#29b6f6'; // Number color blue
      } else if (typeof val === 'boolean') {
        valColor = '#e040fb'; // Boolean color purple
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
          <Tooltip title={`Filter by: ${key} = ${displayVal}`} arrow placement="right">
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: keyColor, fontFamily: 'monospace', fontWeight: 'bold' }}>
                "{key}":
              </Typography>
              <Typography variant="caption" sx={{ color: valColor, fontFamily: 'monospace' }}>
                {displayVal}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      );
    });
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      
      {/* Query Bar */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
        <TextField
          fullWidth
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (onQueryChange) onQueryChange(e.target.value);
          }}
          placeholder="Filter alerts by key, agent, technique... (Click JSON values below to filter instantly)"
          variant="outlined"
          sx={{
            bgcolor: '#12131a',
            borderRadius: '24px',
            border: '1px solid var(--border-color)',
            input: { color: '#fff', fontSize: 13.5, px: 2 },
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ pl: 1 }}>
                <SearchIcon sx={{ color: '#8c909e' }} />
              </InputAdornment>
            ),
          }}
        />
        
        {/* Quick Filter Chips */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: '#8c909e', mr: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FilterAltIcon sx={{ fontSize: 13 }} /> Quick Filters:
          </Typography>
          {quickFilters.map((filter) => {
            const active = query.toLowerCase() === filter.q;
            return (
              <Chip
                key={filter.q}
                label={filter.label}
                onClick={() => handleFilterClick(filter.q)}
                variant={active ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  height: 22,
                  fontSize: 10,
                  fontWeight: 'bold',
                  borderColor: 'rgba(255,255,255,0.08)',
                  bgcolor: active ? 'rgba(240, 90, 40, 0.2)' : 'transparent',
                  color: active ? '#f05a28' : '#8c909e',
                  '&:hover': { bgcolor: 'rgba(240, 90, 40, 0.1)', color: '#f05a28' }
                }}
              />
            );
          })}
          {query && (
            <Chip
              label="Reset"
              onClick={() => handleFilterClick('')}
              size="small"
              sx={{ height: 22, fontSize: 10, bgcolor: 'rgba(255,23,73,0.1)', color: '#ff1744', border: '1px solid rgba(255,23,73,0.2)', fontWeight: 'bold' }}
            />
          )}
        </Box>
      </Box>

      {/* Timeline chart */}
      <Paper className="glass-panel" sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold', mb: 1.5, display: 'block' }}>
          Historical Ingestion Hit Frequency
        </Typography>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={getTimelineData()}>
            <Bar dataKey="count" fill="#f05a28" radius={[2, 2, 0, 0]} />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.15)" fontSize={9} tickLine={false} />
            <YAxis stroke="rgba(255,255,255,0.15)" fontSize={9} tickLine={false} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {/* Discover events list grid */}
      <Paper className="glass-panel" sx={{ p: 1 }}>
        <TableContainer sx={{ maxHeight: 500 }}>
          <Table size="small" className="interactive-table">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11 } }}>
                <TableCell width={30}></TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell>Agent Endpoint</TableCell>
                <TableCell>Alert Description</TableCell>
                <TableCell>Threat Severity</TableCell>
                <TableCell>MITRE ATT&CK (Tactic · Technique)</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                    sx={{
                      '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5, fontSize: 12.5 },
                      cursor: 'pointer',
                      bgcolor: expandedRow === row.id ? 'rgba(255,255,255,0.01)' : 'transparent'
                    }}
                  >
                    <TableCell>
                      <IconButton size="small" sx={{ color: '#8c909e' }}>
                        {expandedRow === row.id ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ fontSize: 10.5, whiteSpace: 'nowrap', opacity: 0.8 }}>
                      {row.created_at || row.timestamp ? new Date(((row.created_at || row.timestamp) + '').replace(/Z$/, '') + 'Z').toLocaleString() : new Date().toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{row.hostname}</TableCell>
                    <TableCell sx={{ fontWeight: '500', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.title}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getSeverityColor(row.severity) }} className={row.severity === 'critical' ? 'pulse-active' : ''} />
                        <Typography sx={{ fontSize: 11, textTransform: 'capitalize', fontWeight: 'bold', color: getSeverityColor(row.severity) }}>
                          {row.severity}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {(row.mitre_tactics && row.mitre_techniques)
                        ? row.mitre_tactics.slice(0, 2).map((tactic, i) => (
                            <Chip
                              key={tactic}
                              label={`${tactic} · ${row.mitre_techniques[i] || row.mitre_techniques[0] || ''}`}
                              size="small"
                              sx={{ mr: 0.5, mb: 0.3, height: 18, fontSize: 9, bgcolor: 'rgba(255,214,0,0.1)', color: '#ffd600', border: '1px solid rgba(255,214,0,0.2)', fontWeight: 'bold' }}
                            />
                          ))
                        : row.mitre_techniques?.slice(0, 2).map(tech => (
                            <Chip key={tech} label={tech} size="small" sx={{ mr: 0.5, height: 16, fontSize: 9, bgcolor: 'rgba(255,214,0,0.1)', color: '#ffd600', border: '1px solid rgba(255,214,0,0.2)', fontWeight: 'bold' }} />
                          )) || <Typography variant="caption" sx={{ color: '#444' }}>-</Typography>
                      }
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={(row.status || 'new').toUpperCase()}
                        size="small"
                        color={row.status === 'resolved' ? 'success' : row.status === 'investigating' ? 'warning' : 'error'}
                        variant={row.status === 'resolved' ? 'outlined' : 'filled'}
                        sx={{ height: 18, fontSize: 9, fontWeight: '800' }}
                      />
                    </TableCell>
                  </TableRow>

                  {/* Expanded Row showing Tree JSON and Actions */}
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                      <ARGUSAlertDetailsRow
                        row={row}
                        expandedRow={expandedRow}
                        handleAction={handleAction}
                        handleOpenResolve={handleOpenResolve}
                        getSeverityColor={getSeverityColor}
                        renderJsonTree={renderJsonTree}
                      />
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              {alerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: '#9598a3' }}>
                    No security events or alerts recorded in the database.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Resolution Dialog */}
      <Dialog open={resDialog} onClose={handleCloseResolve} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 2 } }}>
        <DialogTitle sx={{ color: '#ff9100', fontWeight: 'bold' }}>Resolve Incident Alert</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#8c909e', mb: 2 }}>
            Provide comments and resolution findings before closing this security incident. A ticket will automatically be registered in connected integrations.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={resNotes}
            onChange={(e) => setResNotes(e.target.value)}
            placeholder="e.g. Confirmed security scans by DevOps. System baseline has been updated..."
            variant="outlined"
            sx={{
              bgcolor: '#1c1e28',
              borderRadius: 1.5,
              textarea: { color: '#fff' },
              border: '1px solid rgba(255,255,255,0.05)',
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseResolve} sx={{ color: '#8c909e' }}>Cancel</Button>
          <Button onClick={handleResolveSubmit} variant="contained" color="success">
            Submit Resolution
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ARGUSAlertDetailsRow({ row, expandedRow, handleAction, handleOpenResolve, getSeverityColor, renderJsonTree }) {
  const [actionType, setActionType] = useState('kill_process');
  const [targetValue, setTargetValue] = useState('');
  const [containmentResponse, setContainmentResponse] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [logs, setLogs] = useState([]);

  // Auto-fill suggested targets based on selected action type and event data
  useEffect(() => {
    if (actionType === 'kill_process') {
      // Find PID or name
      const pid = row.event_data?.process_id || row.event_data?.pid || row.event_data?.parent_process_id || '';
      const name = row.event_data?.image || row.event_data?.process_name || '';
      setTargetValue(String(pid || name || 'cmd.exe'));
    } else if (actionType === 'block_ip') {
      // Find source or dest IP
      const ip = row.event_data?.destination_ip || row.event_data?.source_ip || row.source_ip || '';
      setTargetValue(String(ip || '8.8.8.8'));
    } else if (actionType === 'isolate_host') {
      setTargetValue(String(row.hostname || ''));
    } else if (actionType === 'capture_memory') {
      const pid = row.event_data?.process_id || row.event_data?.pid || 'cmd.exe';
      setTargetValue(String(pid));
    } else if (actionType === 'collect_artifacts') {
      setTargetValue(String(row.hostname || ''));
    }
  }, [actionType, row]);

  const handleDispatchContainment = async () => {
    setLogs(["[SYSTEM] Initiating remote containment task..."]);
    try {
      // 1. Create response action
      const createRes = await fetch("${API_BASE_URL}/responses/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_id: row.id,
          action_type: actionType,
          target: targetValue,
          executed_by: "analyst"
        })
      });
      const createData = await createRes.json();
      if (createRes.status !== 200 || createData.error) {
        setLogs(prev => [...prev, `❌ Failed to create task: ${createData.error || "Server error"}`]);
        return;
      }
      
      const respId = createData.response_id;
      setLogs(prev => [...prev, `✓ Containment task registered (ID: ${respId})`, `⌛ Sending execution command to server queue...`]);
      
      // 2. Execute response action (flags as pending for agent polling)
      const execRes = await fetch(`${API_BASE_URL}/responses/${respId}/execute`, {
        method: "POST"
      });
      const execData = await execRes.json();
      
      setContainmentResponse({
        id: respId,
        status: "pending",
        action_type: actionType,
        target: targetValue
      });
      setLogs(prev => [...prev, `⌛ Status: Pending Agent Retrieval...`, `📡 Listening for check-in from agent on host: ${row.hostname}...`]);
      setPollingActive(true);
      
    } catch (e) {
      setLogs(prev => [...prev, `❌ Exception: ${e.message}`]);
    }
  };

  useEffect(() => {
    if (!pollingActive || !containmentResponse?.id) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/responses/${containmentResponse.id}`);
        if (!res.ok) return;
        const data = await res.json();
        
        setContainmentResponse(data);
        
        if (data.status === "executing") {
          setLogs(prev => {
            if (prev[prev.length - 1].includes("executing") || prev[prev.length - 1].includes("[EXEC]")) return prev;
            return [...prev, "⚡ Host agent picked up the containment command.", "[EXEC] Invoking native containment actions on OS..."];
          });
        } else if (data.status === "completed") {
          setLogs(prev => [
            ...prev,
            "✅ Containment action completed successfully on target host!",
            `Terminal stdout logs:\n${data.result?.stdout || "Execution returned success code 0."}`
          ]);
          setPollingActive(false);
          clearInterval(interval);
        } else if (data.status === "failed") {
          setLogs(prev => [
            ...prev,
            "❌ Containment action failed on agent.",
            `Terminal error logs:\n${data.result?.stdout || "Execution failed."}`
          ]);
          setPollingActive(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Error polling response action status: ", err);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [pollingActive, containmentResponse]);

  return (
    <Collapse in={expandedRow === row.id} timeout="auto" unmountOnExit>
      <Box sx={{ py: 3, px: 2.5, bgcolor: '#090a0f', borderLeft: '3px solid #f05a28', my: 1, borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.03)' }}>
        <Grid container spacing={3.5}>
          
          {/* Interactive log details tree panel */}
          <Grid item xs={12} md={7}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#8c909e' }}>
                Interactive Log Field Parser
              </Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                💡 Tip: Click values to filter dashboard logs.
              </Typography>
            </Box>
            <Paper sx={{ p: 2, bgcolor: '#0e0f15', border: '1px solid var(--border-color)', maxHeight: 330, overflowY: 'auto' }}>
              {renderJsonTree(row)}
            </Paper>
          </Grid>

          {/* Active Containment panel */}
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              {/* Alert management section */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5, color: '#8c909e' }}>
                  Alert Management
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {row.status === 'new' && (
                    <Button
                      variant="outlined"
                      color="info"
                      size="small"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => handleAction(row.id, 'acknowledge')}
                      sx={{ color: '#29b6f6', borderColor: 'rgba(41, 182, 246, 0.3)', '&:hover': { borderColor: '#29b6f6', bgcolor: 'rgba(41, 182, 246, 0.05)' } }}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {row.status !== 'investigating' && row.status !== 'resolved' && (
                    <Button
                      variant="outlined"
                      color="warning"
                      size="small"
                      startIcon={<FlagIcon />}
                      onClick={() => handleAction(row.id, 'investigate')}
                      sx={{ color: '#ffa726', borderColor: 'rgba(255, 167, 38, 0.3)', '&:hover': { borderColor: '#ffa726', bgcolor: 'rgba(255, 167, 38, 0.05)' } }}
                    >
                      Investigate
                    </Button>
                  )}
                  {row.status !== 'resolved' && (
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<AssignmentIcon />}
                      onClick={() => handleOpenResolve(row.id)}
                      sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
                    >
                      Resolve
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<ErrorOutlineIcon />}
                    onClick={() => handleAction(row.id, 'false-positive')}
                    sx={{ color: '#ef5350', borderColor: 'rgba(239, 83, 80, 0.3)', '&:hover': { borderColor: '#ef5350', bgcolor: 'rgba(239, 83, 80, 0.05)' } }}
                  >
                    False Positive
                  </Button>
                </Box>
              </Box>

              {/* Containment system */}
              <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', pt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: '#ff1744', display: 'flex', alignItems: 'center', gap: 1 }}>
                  🛡️ Active Containment & OS Response
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: '#8c909e' }}>Containment Action</InputLabel>
                    <Select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      label="Containment Action"
                      sx={{ color: '#fff', bgcolor: '#12131a', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
                      disabled={pollingActive}
                    >
                      <MenuItem value="kill_process">Terminate Malicious Process (kill_process)</MenuItem>
                      <MenuItem value="block_ip">Block Host connection to threat IP (block_ip)</MenuItem>
                      <MenuItem value="isolate_host">Isolate Host Endpoint Network (isolate_host)</MenuItem>
                      <MenuItem value="capture_memory">Capture Process Memory Dump (capture_memory)</MenuItem>
                      <MenuItem value="collect_artifacts">Gather Forensics Logs Bundle (collect_artifacts)</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    size="small"
                    label="Containment Target Parameter"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    sx={{
                      input: { color: '#fff' },
                      label: { color: '#8c909e' },
                      bgcolor: '#12131a',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
                    }}
                    disabled={pollingActive}
                  />

                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleDispatchContainment}
                    disabled={pollingActive || !targetValue}
                    sx={{ bgcolor: '#ff1744', '&:hover': { bgcolor: '#b71c1c' }, fontWeight: 'bold' }}
                  >
                    {pollingActive ? 'Executing Containment...' : 'Dispatch Containment Action'}
                  </Button>
                </Box>

                {/* Custom Stepper and logs */}
                {containmentResponse && (
                  <Box sx={{ mt: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, px: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#00e676', fontWeight: 'bold' }}>
                        1. Server Queued
                      </Typography>
                      <Typography variant="caption" sx={{ color: ['executing', 'completed', 'failed'].includes(containmentResponse.status) ? '#00e676' : '#8c909e', fontWeight: 'bold' }}>
                        2. Agent Executing
                      </Typography>
                      <Typography variant="caption" sx={{ color: containmentResponse.status === 'completed' ? '#00e676' : containmentResponse.status === 'failed' ? '#ff1744' : '#8c909e', fontWeight: 'bold' }}>
                        3. Completed
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={containmentResponse.status === 'completed' || containmentResponse.status === 'failed' ? 100 : containmentResponse.status === 'executing' ? 66 : 33}
                      color={containmentResponse.status === 'failed' ? 'error' : containmentResponse.status === 'completed' ? 'success' : 'info'}
                      sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}
                    />
                  </Box>
                )}

                {logs.length > 0 && (
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: '#06070a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 1, maxHeight: 150, overflowY: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: 10, fontFamily: 'monospace', color: '#00e5ff', whiteSpace: 'pre-wrap' }}>
                      {logs.join('\n')}
                    </pre>
                  </Box>
                )}

              </Box>

            </Box>
          </Grid>
        </Grid>
      </Box>
    </Collapse>
  );
}

export default Discover;
