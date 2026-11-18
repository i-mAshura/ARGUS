import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, Typography, Grid, TextField, InputAdornment, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, FormControl, InputLabel, Select, MenuItem, LinearProgress, Tooltip, Switch, Collapse, Alert } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TerminalIcon from '@mui/icons-material/Terminal';
import CodeIcon from '@mui/icons-material/Code';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid } from 'recharts';

function Siem({ selectedAgent = 'all' }) {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [logType, setLogType] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [splMode, setSplMode] = useState(false);
  const [splParsed, setSplParsed] = useState(null);
  const [splErrors, setSplErrors] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [selectedHost, setSelectedHost] = useState(selectedAgent || 'all');
  const searchTimer = useRef(null);

  // Sync prop changes from dashboard
  useEffect(() => {
    setSelectedHost(selectedAgent || 'all');
  }, [selectedAgent]);

  // Load hostnames list once on mount
  useEffect(() => {
    const fetchHosts = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/dashboard/hosts/status`);
        if (resp.ok) {
          const data = await resp.json();
          // Deduplicate hosts by uppercased hostname
          const seen = new Set();
          const uniqueHosts = (data.hosts || []).filter(h => {
            const key = (h.hostname || '').toUpperCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setHosts(uniqueHosts);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchHosts();
  }, []);

  // Fetch telemetry whenever filters change
  useEffect(() => {
    fetchAndFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHost, logType, severityFilter, splMode]);

  const normalizeAddress = (value, fallback = '127.0.0.1') => {
    const text = String(value ?? '').trim();
    return text && !['unknown', 'None', 'null'].includes(text) ? text : fallback;
  };

  const normalizePort = (value, fallback = '8001') => {
    const text = String(value ?? '').trim();
    return text && !['unknown', 'None', 'null', ''].includes(text) ? text : fallback;
  };

  const fetchAndFilter = async () => {
    setLoading(true);
    setSplParsed(null);
    setSplErrors([]);

    // ── SPL mode: query the /api/v1/search/spl endpoint ──────────────
    if (splMode) {
      // When empty, fetch last 500 events by default so user sees all event types
      const queryStr = searchQuery.trim() || '| head 500';
      try {
        const resp = await fetch(`${API_BASE_URL}/search/spl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: queryStr, default_limit: 200 }),
        });
        const data = await resp.json();
        if (data.parsed) {
          setSplParsed(data.parsed);
        }
        if (data.errors && data.errors.length > 0) {
          setSplErrors(data.errors);
        }
        // Map ES results to the same syslog structure used in basic mode
        const mapped = (data.events || []).map((e, idx) => {
          const ed = e.event_data || {};
          // Normalize field name casing — ES may store event_id or EventID
          const eventId = String(ed.EventID || ed.event_id || ed.eventId || '');
          let msg = `${(e.event_type || '').toUpperCase() || 'EVENT'} - host: ${e.hostname || ''}`;
          let sev = 'info';
          if (e.event_type === 'process_creation') {
            msg = `Process Creation: ${ed.image || ed.process_name || 'unknown'} | Cmd: ${ed.command_line || ''}`;
            sev = (ed.image || '').toLowerCase().includes('powershell') ? 'warning' : 'info';
          } else if (e.event_type === 'network_connection' || eventId === '3') {
            msg = `Network Connection: ${e.source_ip || ed.source_ip || ''} -> ${e.destination_ip || ed.destination_ip || ''}:${ed.destination_port || ''}`;
          } else if (eventId === '1') {
            msg = `Sysmon Process Create: ${ed.Image || ed.image || ''} | ${ed.CommandLine || ed.command_line || ''}`;
          } else if (eventId === '11') {
            msg = `Sysmon File Create: ${ed.TargetFilename || ed.target_filename || ''} | Image: ${ed.Image || ed.image || ''}`;
          } else if (eventId === '22') {
            msg = `Sysmon DNS Query: ${ed.QueryName || ed.query_name || ''} -> ${(ed.QueryResults || ed.query_results || '').slice(0,80)}`;
          } else if (ed.event_summary) {
            msg = `Sysmon [${ed.event_summary}]: ${ed.image || ed.process_name || ''}`;
          } else if (e.event_type === 'sysmon' || ed.source === 'sysmon' || ed.source_program === 'sysmon') {
            msg = `Sysmon EventID=${eventId || '?'} | ${(ed.Image || ed.image || '').slice(0,60)}`;
          }
          return {
            id: e.id || `spl-${idx}`,
            timestamp: e.timestamp || new Date().toISOString(),
            hostname: (e.hostname || ed.hostname || ed.computer_name || 'unknown').toString(),
            log_type: e.event_type === 'sysmon' || ed.source_program === 'sysmon' || ed.source === 'sysmon'
              ? 'sysmon'
              : e.event_type === 'winevent'
                ? 'winevent'
                : e.event_type || 'unknown',
            event_type: e.event_type || 'unknown',
            severity: sev,
            message: msg,
            facility: 'spl',
            program: String(e.event_type || ed.source || 'spl'),
            _score: e._score,
          };
        });
        setLogs(mapped);
        setFilteredLogs(mapped);
      } catch (e) {
        console.error('SPL search error:', e);
        setSplErrors([`SPL search failed: ${e.message}`]);
      }
      setLoading(false);
      return;
    }

    // ── Basic mode: original logic ───────────────────────────────────
    try {
      const searchTerm = searchQuery.trim();
      const normalizedLogType = logType === 'sysmon' ? 'sysmon' : logType;
      // Client-side-only log types — the backend has no real event_type matching
      // these values (syslog, winevent, auditd, container, sysmon), so we fetch
      // ALL events and let the filter below handle it client-side.
      const clientSideTypes = ['syslog', 'winevent', 'auditd', 'container'];
      const isClientSide = normalizedLogType && normalizedLogType !== 'all' && clientSideTypes.includes(normalizedLogType);
      const filterValue = normalizedLogType && normalizedLogType !== 'all' && !isClientSide
        ? `&log_type=${encodeURIComponent(normalizedLogType)}&log_source_type=${encodeURIComponent(normalizedLogType)}`
        : '';
      // Client-side types fetch the full list; no backend search filter for the type.
      // When search is active, the backend handles full-text filtering so we keep
      // the limit the same — enough for diversity (200) without DOM render lag.
      const effectiveLimit = 200;
      const hostFilter = selectedHost && selectedHost !== 'all' ? `&hostname=${encodeURIComponent(selectedHost)}` : '';
      const url = `${API_BASE_URL}/events/?limit=${effectiveLimit}${filterValue}${hostFilter}`;
      const response = await fetch(url);
      const data = await response.json();
      let dbEvents = data.events || [];

      // ── 1. Convert DB events to same syslog structure ───────────────────
      const allLogs = dbEvents.map((e, idx) => {
        // Fix bare timestamps (no timezone suffix) by appending local offset
        // so that toLocaleString() displays consistently across all browsers.
        let ts = e.timestamp || new Date().toISOString();
        // Append local timezone offset to bare timestamps (no Z, +HH:MM, or +HHMM suffix)
        // so that toLocaleString() displays consistently across all browsers.
        if (typeof ts === 'string' && !/Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(ts)) {
          const offset = -new Date().getTimezoneOffset();
          const sign = offset >= 0 ? '+' : '-';
          const hours = Math.floor(Math.abs(offset) / 60);
          const minutes = Math.abs(offset) % 60;
          ts = `${ts}${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
        let msg = `${e.event_type.toUpperCase()} - host: ${e.hostname}`;
        let sev = 'info';
        const data = e.event_data || {};
        const rawText = JSON.stringify({ ...data, event_type: e.event_type, hostname: e.hostname, source_ip: e.source_ip, destination_ip: e.destination_ip }).toLowerCase();
        const isSysmon = /sysmon/.test(rawText)
          || String(e.event_type || '').toLowerCase() === 'sysmon'
          || String(data.log_type || '').toLowerCase() === 'sysmon'
          || String(data.source_program || '').toLowerCase() === 'sysmon'
          || String(data.event_type || '').toLowerCase() === 'sysmon';
        
        if (e.event_type === 'process_creation') {
          const img = data.image || data.process_name || 'unknown';
          const pid = data.process_id || data.pid || 'N/A';
          const cli = data.command_line || 'no command line args';
          const parent = data.parent_image || 'unknown';
          msg = `Process Creation: ${img} (PID: ${pid}) | Command: ${cli} | Parent: ${parent}`;
          if (img.toLowerCase().includes('mimikatz') || cli.toLowerCase().includes('privilege::debug')) {
            sev = 'error';
          } else if (img.toLowerCase().includes('cmd.exe') || img.toLowerCase().includes('powershell.exe')) {
            sev = 'warning';
          }
        } else if (e.event_type === 'network_connection') {
          const srcIp = normalizeAddress(e.source_ip || data.source_ip, '127.0.0.1');
          const destIp = normalizeAddress(e.destination_ip || data.destination_ip, '127.0.0.1');
          const fallbackPort = /kafka/i.test(String(e.hostname || '')) || /kafka/i.test(String(data.process_name || '')) ? '9092' : '8001';
          const srcPort = normalizePort(data.source_port || data.local_port || e.source_port, fallbackPort);
          const destPort = normalizePort(data.destination_port || e.destination_port || data.remote_port, fallbackPort);
          const proto = data.protocol || 'TCP';
          msg = `Network Socket Connection: ${srcIp}:${srcPort} -> ${destIp}:${destPort} | Protocol: ${proto}`;
          if (destPort === 4444 || destPort === 1337 || destPort === 6667) {
            sev = 'error';
          } else if (destPort === 22 || destPort === 3389) {
            sev = 'warning';
          }
        } else if (e.event_type === 'file_write') {
          const path = data.file_path || data.file_name || 'unknown';
          const action = data.action || 'write';
          msg = `File System Modification: ${action.toUpperCase()} path: ${path} | Process: ${data.image || 'system'}`;
          if (path.toLowerCase().includes('system32') || path.toLowerCase().includes('etc/passwd')) {
            sev = 'error';
          }
        } else if (e.event_type === 'compliance') {
          const control = data.control_id || 'unknown';
          const status = data.status || 'failed';
          const standards = (data.standards || []).join(', ');
          msg = `Compliance Check [${standards}]: Req ${control} status ${status.toUpperCase()} | Info: ${data.raw_log || e.id}`;
          sev = status === 'failed' ? 'error' : 'info';
        } else if (data.message || data.raw_log) {
          msg = data.message || data.raw_log;
        } else {
          msg = `${e.event_type.toUpperCase()} | Host: ${e.hostname} | Data: ${JSON.stringify(data)}`;
        }
        
        const inferredLogType = isSysmon
          ? 'sysmon'
          : e.event_type === 'winevent'
            ? 'winevent'
            : e.event_type === 'process_creation' || /process creation|security event/i.test(msg) || data.image || data.command_line
              ? 'winevent'
              : e.event_type === 'network_connection' || e.event_type === 'dns_query' || /network socket|dns/i.test(msg)
                ? 'syslog'
                : 'auditd';

        return {            id: e.id || `db-log-${idx}`,
          timestamp: ts,
          hostname: e.hostname || 'ABHIRAM',
          log_type: inferredLogType,
          event_type: e.event_type || 'unknown',
          severity: sev,
          message: msg,
          facility: 'user',
          program: e.event_type
        };
      });

      // Filter by agent if selected
      const agentFiltered = selectedHost !== 'all' 
        ? allLogs.filter(l => String(l.hostname || '').toLowerCase() === selectedHost.toLowerCase())
        : allLogs;

      // ── 2. Apply client-side filters on the fresh data ──────────────────
      let items = [...agentFiltered];

      if (logType !== 'all') {
        items = items.filter((l) => {
          if (logType === 'windows_system_events') {
            return ['syslog', 'winevent'].includes(String(l.log_type || '').toLowerCase());
          }
          if (logType === 'sysmon') {
            const haystack = [l.message, l.program, l.event_type, l.log_type, JSON.stringify(l)].join(' ').toLowerCase();                  return l.log_type === 'sysmon' || (l.program || '').toLowerCase() === 'sysmon' || (l.event_type || '').toLowerCase() === 'sysmon' || haystack.includes('sysmon');
          }
          return l.log_type === logType;
        });
      }

      if (severityFilter !== 'all') {
        items = items.filter(l => l.severity === severityFilter);
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        items = items.filter((l) => {
          const searchable = [
            l.message,
            l.hostname,
            l.program,
            l.event_type,
            l.log_type,
            l.severity,
            l.facility,
            String(l.message || '').toLowerCase(),
            String(l.hostname || '').toLowerCase(),
            String(l.program || '').toLowerCase(),
            String(l.event_type || '').toLowerCase(),
            String(l.log_type || '').toLowerCase(),
            String(l.severity || '').toLowerCase(),
          ]
            .join(' ')
            .toLowerCase();

          return searchable.includes(q);
        });
      }

      setLogs(agentFiltered);
      setFilteredLogs(items);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const getTimelineData = () => {
    const hours = {};
    filteredLogs.forEach(l => {
      const t = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      hours[t] = (hours[t] || 0) + 1;
    });

    const data = Object.keys(hours).map(k => ({ time: k, count: hours[k] }));
    if (data.length === 0) return [{ time: '12:00', count: 0 }];
    return data.sort((a,b) => a.time.localeCompare(b.time));
  };

  const getSeverityColor = (sev) => {
    switch (sev) {
      case 'error': return '#ff1744';
      case 'warning': return '#ff9100';
      case 'info': return '#00e676';
      default: return '#9598a3';
    }
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1.5 }}>
        <TerminalIcon sx={{ color: '#f05a28', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
          SIEM Log Data Analyzer
        </Typography>
      </Box>

      {/* Filters & Search */}
      <Paper className="glass-panel" sx={{ p: 2.5, mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={splMode ? 12 : 4.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (searchTimer.current) clearTimeout(searchTimer.current);
                  searchTimer.current = setTimeout(() => {
                    fetchAndFilter();
                  }, 300);
                }}
                placeholder={splMode ? "SPL query: event_type=sysmon EventID=1 'powershell.exe' | head 50" : "Search syslog messages, hostnames, programs..."}
                variant="outlined"
                sx={{
                  bgcolor: '#1c1e28',
                  borderRadius: '4px',
                  input: { color: '#fff', fontSize: 13, fontFamily: splMode ? 'monospace' : 'inherit' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: splMode ? 'rgba(240,90,40,0.3)' : 'rgba(255,255,255,0.05)' }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {splMode ? <CodeIcon sx={{ color: '#f05a28', fontSize: 18 }} /> : <SearchIcon sx={{ color: '#8c909e' }} />}
                    </InputAdornment>
                  ),
                }}
              />
              <Tooltip title={splMode ? 'Switch to Basic Search' : 'Switch to SPL Search'}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Typography variant="caption" sx={{ color: splMode ? '#f05a28' : '#8c909e', fontWeight: splMode ? 'bold' : 'normal', fontSize: 10 }}>
                    SPL
                  </Typography>
                  <Switch
                    size="small"
                    checked={splMode}
                    onChange={(e) => {
                      setSplMode(e.target.checked);
                      setSplParsed(null);
                      setSplErrors([]);
                    }}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#f05a28' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#f05a2880' },
                    }}
                  />
                </Box>
              </Tooltip>
            </Box>
          </Grid>
          {!splMode && (
            <>
              <Grid item xs={12} sm={4} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: '#8c909e' }}>Endpoint Host</InputLabel>
                  <Select
                    value={selectedHost}
                    onChange={(e) => setSelectedHost(e.target.value)}
                    label="Endpoint Host"
                    sx={{ color: '#fff', bgcolor: '#1c1e28', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.05)' } }}
                  >
                    <MenuItem value="all">All Hosts</MenuItem>
                    {hosts.map(h => (
                      <MenuItem key={h.id} value={h.hostname}>{h.hostname}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={4} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: '#8c909e' }}>Log Source Type</InputLabel>
                  <Select
                    value={logType}
                    onChange={(e) => setLogType(e.target.value)}
                    label="Log Source Type"
                    sx={{ color: '#fff', bgcolor: '#1c1e28', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.05)' } }}
                  >
                    <MenuItem value="all">All Logs</MenuItem>
                    <MenuItem value="syslog">Linux Auth/Syslogs</MenuItem>
                    <MenuItem value="winevent">Windows Security Events</MenuItem>
                    <MenuItem value="sysmon">Windows Sysmon Logs</MenuItem>
                    <MenuItem value="auditd">Linux System Audits</MenuItem>
                    <MenuItem value="container">Docker & K8s Container Logs</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={4} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: '#8c909e' }}>Syslog Severity</InputLabel>
                  <Select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    label="Syslog Severity"
                    sx={{ color: '#fff', bgcolor: '#1c1e28', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.05)' } }}
                  >
                    <MenuItem value="all">All Severities</MenuItem>
                    <MenuItem value="info">Info / Normal</MenuItem>
                    <MenuItem value="warning">Warning / Alert</MenuItem>
                    <MenuItem value="error">Error / Emergency</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
        </Grid>

        {/* SPL Parsed Query Info */}
        {splMode && splParsed && (
          <Collapse in={!!splParsed}>
            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'rgba(240,90,40,0.05)', borderRadius: 1, border: '1px solid rgba(240,90,40,0.15)' }}>
              <Typography variant="caption" sx={{ color: '#f05a28', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <InfoOutlinedIcon sx={{ fontSize: 14 }} />
                Parsed SPL Query
              </Typography>
              <Grid container spacing={1}>
                {splParsed.filters && Object.keys(splParsed.filters).length > 0 && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ color: '#8c909e' }}>Filters:</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.3 }}>
                      {Object.entries(splParsed.filters).map(([field, value]) => (
                        <Chip key={field} label={`${field}=${value}`} size="small" sx={{ height: 18, fontSize: 9, bgcolor: 'rgba(240,90,40,0.1)', color: '#f05a28', border: 'none' }} />
                      ))}
                    </Box>
                  </Grid>
                )}
                {splParsed.free_text && splParsed.free_text.length > 0 && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ color: '#8c909e' }}>Free-text terms:</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.3 }}>
                      {splParsed.free_text.map((term, i) => (
                        <Chip key={i} label={term} size="small" sx={{ height: 18, fontSize: 9, bgcolor: 'rgba(0,230,118,0.1)', color: '#00e676', border: 'none' }} />
                      ))}
                    </Box>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ color: '#8c909e' }}>
                    Sort: <span style={{ color: '#fff' }}>{splParsed.sort || 'timestamp (desc)'}</span>
                    &nbsp;|&nbsp; Limit: <span style={{ color: '#fff' }}>{splParsed.limit}</span>
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        )}

        {/* SPL Errors */}
        {splMode && splErrors.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {splErrors.map((err, i) => (
              <Alert key={i} severity="warning" sx={{ py: 0, px: 1.5, fontSize: 11, bgcolor: 'rgba(255,145,0,0.1)', color: '#ff9100', '& .MuiAlert-icon': { fontSize: 16, mr: 1 } }}>
                {err}
              </Alert>
            ))}
          </Box>
        )}
      </Paper>

      {/* Ingestion histogram */}
      <Paper className="glass-panel" sx={{ p: 2.5, mb: 4 }}>
        <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold', mb: 1.5, display: 'block' }}>
          SIEM Log Ingestion Hit Frequency Histogram (Parsed Real-time)
        </Typography>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={getTimelineData()}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.15)" fontSize={9} tickLine={false} />
            <YAxis stroke="rgba(255,255,255,0.15)" fontSize={9} tickLine={false} />
            <Bar dataKey="count" fill="#f05a28" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {/* Logs Table */}
      <Paper className="glass-panel" sx={{ p: 1 }}>
        {loading ? (
          <LinearProgress sx={{ bgcolor: '#1b1e27', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />
        ) : (
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11 } }}>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Endpoint Host</TableCell>
                  <TableCell>Log Type</TableCell>
                  <TableCell>Source Program</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Raw Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} hover sx={{ '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5, fontSize: 12 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' } }}>
                    <TableCell sx={{ opacity: 0.7, whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{log.hostname}</TableCell>
                    <TableCell>
                      <Chip label={(log.log_type || '').toUpperCase()} size="small" variant="outlined" sx={{ height: 16, fontSize: 8, borderColor: 'rgba(255,255,255,0.08)', color: '#fff' }} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{log.program}</TableCell>
                    <TableCell>
                      <Chip label={(log.severity || '').toUpperCase()} size="small" sx={{ height: 16, fontSize: 8, bgcolor: `${getSeverityColor(log.severity)}15`, color: getSeverityColor(log.severity) }} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Tooltip title={log.message} arrow placement="top">
                        <span>{log.message}</span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: '#666' }}>
                      No syslog records matched the active search filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

export default Siem;
