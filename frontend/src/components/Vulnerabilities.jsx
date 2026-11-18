import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, LinearProgress, Slider, CircularProgress, Button, Drawer, Divider, Tabs, Tab, TextField, InputAdornment, Collapse, IconButton, Tooltip as MuiTooltip } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import SyncIcon from '@mui/icons-material/Sync';
import InfoIcon from '@mui/icons-material/Info';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

const COLORS = {
  critical: '#ff1744',
  high: '#ff9100',
  medium: '#ffd600',
  low: '#00e676'
};

const INITIAL_VULNS = [];

function Vulnerabilities({ selectedAgent = 'all' }) {
  const [vulns, setVulns] = useState([]);
  const [cvssFilter, setCvssFilter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncingNvd, setSyncingNvd] = useState(false);
  const [syncLogs, setSyncLogs] = useState('NVD Feed: Connected. Database contains 0 indexed CVE records.');
  
  // Tab layout state (0 = Dashboard, 1 = Events)
  const [activeModuleTab, setActiveModuleTab] = useState(0);
  const [eventList, setEventList] = useState([]);
  const [eventSearch, setEventSearch] = useState('');
  const [eventExpanded, setEventExpanded] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Drawer state for CVE details
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCve, setSelectedCve] = useState(null);

  // Mock Vulnerability syslog events as fallbacks
  const mockVulnEvents = [];

  useEffect(() => {
    fetchVulnerabilities();
  }, [selectedAgent]);

  useEffect(() => {
    if (activeModuleTab === 1) {
      fetchVulnEvents();
    }
  }, [activeModuleTab, selectedAgent, eventSearch]);

  const fetchVulnerabilities = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/integrations/agent/vulnerabilities`;
      if (selectedAgent !== 'all') {
        url += `?agent_id=${selectedAgent}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const items = data.vulnerabilities || [];
        setVulns(items);
        if (items.length > 0) {
          setSelectedCve(items[0]);
          setSyncLogs(`NVD Feed: Connected. Database contains ${items.length} indexed CVE records.`);
        } else {
          setSelectedCve(null);
          setSyncLogs('NVD Feed: Connected. Database contains 0 indexed CVE records.');
        }
      } else {
        setVulns([]);
        setSelectedCve(null);
      }
    } catch (err) {
      console.error(err);
      setVulns([]);
      setSelectedCve(null);
    }
    setLoading(false);
  };

  const fetchVulnEvents = async () => {
    setEventsLoading(true);
    try {
      let url = `${API_BASE_URL}/events/?event_type=vulnerability&limit=100`;
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

  const handleSyncNvd = async () => {
    setSyncingNvd(true);
    setSyncLogs('Syncing NVD Feed... Connecting to api.vuln.nvd.nist.gov...');
    try {
      const response = await fetch(`${API_BASE_URL}/integrations/agent/vulnerabilities/sync`, {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setSyncLogs(data.message || 'Successfully synchronized NVD signatures.');
        // Refresh the tables and statistics from backend
        await fetchVulnerabilities();
        await fetchVulnEvents();
      } else {
        setSyncLogs('Failed to sync NVD Feed: Server returned an error.');
      }
    } catch (err) {
      console.error(err);
      setSyncLogs('Failed to sync NVD Feed: Connection to backend timed out.');
    }
    setSyncingNvd(false);
  };

  const handleRowClick = (cve) => {
    setSelectedCve(cve);
    setDrawerOpen(true);
  };

  const getSeverityColor = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical': return COLORS.critical;
      case 'high': return '#ff9100';
      case 'medium': return '#ffd600';
      case 'low': return '#00e676';
      default: return '#9598a3';
    }
  };

  // Filter CVEs by score
  const filteredVulns = vulns.filter(v => (v.cvss_score || 0) >= cvssFilter);

  const chartData = [
    { name: 'Critical', value: vulns.filter(v => v.severity === 'critical').length, color: COLORS.critical },
    { name: 'High', value: vulns.filter(v => v.severity === 'high').length, color: COLORS.high },
    { name: 'Medium', value: vulns.filter(v => v.severity === 'medium').length, color: COLORS.medium },
    { name: 'Low', value: vulns.filter(v => v.severity === 'low').length, color: COLORS.low },
  ].filter(c => c.value > 0);

  // CVSS frequency distribution metrics (for bar chart)
  const distData = [
    { scoreRange: '0.0 - 2.0', count: vulns.filter(v => v.cvss_score <= 2).length },
    { scoreRange: '2.1 - 4.0', count: vulns.filter(v => v.cvss_score > 2 && v.cvss_score <= 4).length },
    { scoreRange: '4.1 - 6.0', count: vulns.filter(v => v.cvss_score > 4 && v.cvss_score <= 6).length },
    { scoreRange: '6.1 - 8.0', count: vulns.filter(v => v.cvss_score > 6 && v.cvss_score <= 8).length },
    { scoreRange: '8.1 - 10.0', count: vulns.filter(v => v.cvss_score > 8 && v.cvss_score <= 10).length }
  ];

  // Parse CVSS Vector String into key-value chips
  const parseVector = (vector) => {
    if (!vector) return [];
    const parts = vector.split('/');
    return parts.map(p => {
      const [key, val] = p.split(':');
      if (key === 'CVSS') return { key: 'Standard', val: val };
      if (key === 'AV') return { key: 'Attack Vector', val: val === 'N' ? 'Network' : val === 'A' ? 'Adjacent' : val === 'L' ? 'Local' : 'Physical' };
      if (key === 'AC') return { key: 'Complexity', val: val === 'L' ? 'Low' : 'High' };
      if (key === 'PR') return { key: 'Privileges', val: val === 'N' ? 'None' : val === 'L' ? 'Low' : 'High' };
      if (key === 'UI') return { key: 'User Interaction', val: val === 'N' ? 'None' : 'Required' };
      if (key === 'S') return { key: 'Scope', val: val === 'U' ? 'Unchanged' : 'Changed' };
      if (key === 'C') return { key: 'Confidentiality', val: val === 'H' ? 'High' : val === 'L' ? 'Low' : 'None' };
      if (key === 'I') return { key: 'Integrity', val: val === 'H' ? 'High' : val === 'L' ? 'Low' : 'None' };
      if (key === 'A') return { key: 'Availability', val: val === 'H' ? 'High' : val === 'L' ? 'Low' : 'None' };
      return { key: key, val: val };
    });
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
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BugReportIcon sx={{ color: '#f05a28', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
            Vulnerability Detection & NVD Audits
          </Typography>
        </Box>
        <Button
          variant="outlined"
          disabled={syncingNvd}
          onClick={handleSyncNvd}
          startIcon={syncingNvd ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
          sx={{ borderColor: '#f05a28', color: '#f05a28', '&:hover': { borderColor: '#d84e20', bgcolor: 'rgba(240,90,40,0.05)' } }}
        >
          {syncingNvd ? 'Syncing...' : 'Sync NVD Feed'}
        </Button>
      </Box>

      {/* Tabs Layout */}
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
        </Tabs>
      </Paper>

      {activeModuleTab === 0 ? (
        <Box>
          {/* KPI Stats */}
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={3}>
              <Card className="glass-panel" sx={{ borderLeft: `4px solid ${COLORS.critical}` }}>
                <CardContent>
                  <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>Critical Vulnerabilities</Typography>
                  <Typography variant="h4" color="#ff1744" sx={{ fontWeight: '800', mt: 1 }}>
                    {vulns.filter(v => v.severity === 'critical').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card className="glass-panel" sx={{ borderLeft: `4px solid ${COLORS.high}` }}>
                <CardContent>
                  <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>High Threats</Typography>
                  <Typography variant="h4" color="#ff9100" sx={{ fontWeight: '800', mt: 1 }}>
                    {vulns.filter(v => v.severity === 'high').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card className="glass-panel" sx={{ borderLeft: `4px solid ${COLORS.medium}` }}>
                <CardContent>
                  <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>Total CVE Detections</Typography>
                  <Typography variant="h4" color="#ffd600" sx={{ fontWeight: '800', mt: 1 }}>
                    {vulns.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card className="glass-panel" sx={{ borderLeft: `4px solid ${COLORS.low}` }}>
                <CardContent>
                  <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>Patched / Resolved</Typography>
                  <Typography variant="h4" color="#00e676" sx={{ fontWeight: '800', mt: 1 }}>
                    {vulns.filter(v => v.status === 'mitigated' || v.status === 'patched').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Sync Logs alert display */}
          <Box sx={{ mb: 4, bgcolor: '#090a0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1.5, p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <InfoIcon sx={{ color: '#f05a28' }} />
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#00e5ff' }}>
              {syncLogs}
            </Typography>
          </Box>

          {loading ? (
            <LinearProgress sx={{ mt: 2, bgcolor: '#1b1e27', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />
          ) : (
            <Grid container spacing={3.5}>
              {/* Charts & Interactive Slider */}
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, height: '100%' }}>
                  
                  {/* CVSS Distribution Histrogram */}
                  <Paper className="glass-panel" sx={{ p: 3 }}>
                    <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold', display: 'block', mb: 2 }}>
                      CVSS SCORE DENSITY DISTRIBUTION
                    </Typography>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={distData}>
                        <XAxis dataKey="scoreRange" stroke="rgba(255,255,255,0.15)" fontSize={9} tickLine={false} />
                        <YAxis stroke="rgba(255,255,255,0.15)" fontSize={9} tickLine={false} allowDecimals={false} />
                        <Bar dataKey="count" fill="#f05a28" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>

                  {/* CVSS Interactive Slider */}
                  <Paper className="glass-panel" sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: '700', mb: 1, fontSize: 15, color: '#fff' }}>
                      Minimum CVSS Score Filter
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#8c909e', mb: 2, display: 'block' }}>
                      Filter the vulnerability index list below in real-time.
                    </Typography>
                    <Box sx={{ px: 1, mt: 1 }}>
                      <Slider
                        value={cvssFilter}
                        onChange={(e, next) => setCvssFilter(next)}
                        min={0}
                        max={10}
                        step={0.5}
                        valueLabelDisplay="auto"
                        sx={{ color: '#f05a28' }}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="caption" sx={{ color: '#8c909e' }}>CVSS 0.0</Typography>
                        <Typography variant="caption" sx={{ color: '#f05a28', fontWeight: 'bold' }}>Active: &gt;= {cvssFilter.toFixed(1)}</Typography>
                        <Typography variant="caption" sx={{ color: '#8c909e' }}>CVSS 10.0</Typography>
                      </Box>
                    </Box>
                  </Paper>

                </Box>
              </Grid>

              {/* Vulnerability index table */}
              <Grid item xs={12} md={8}>
                <Paper className="glass-panel" sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: '700', mb: 2.5, fontSize: 15, color: '#fff' }}>
                    CVE Vulnerability Index ({filteredVulns.length} entries shown)
                  </Typography>
                  <TableContainer sx={{ maxHeight: 380 }}>
                    <Table size="small" className="interactive-table">
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11 } }}>
                          <TableCell>CVE ID</TableCell>
                          <TableCell>Package / Version</TableCell>
                          <TableCell align="center">CVSS Score Gauge</TableCell>
                          <TableCell>Severity</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredVulns.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 5, color: '#8c909e' }}>
                              No vulnerabilities detected. Connect agents to begin automatic vulnerability scanning.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredVulns.map((v, idx) => (
                            <TableRow key={v.cve_id || idx} onClick={() => handleRowClick(v)} hover sx={{ cursor: 'pointer', '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5, fontSize: 12.5 } }}>
                              <TableCell sx={{ fontWeight: '800', color: '#ff9100' }}>{v.cve_id}</TableCell>
                              <TableCell>
                                <Typography sx={{ fontWeight: 'bold', fontSize: 12.5 }}>{v.package}</Typography>
                                <Typography variant="caption" sx={{ color: '#8c909e' }}>v{v.version}</Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <CircularProgress
                                    variant="determinate"
                                    value={v.cvss_score * 10}
                                    size={28}
                                    thickness={5}
                                    sx={{ color: getSeverityColor(v.severity) }}
                                  />
                                  <Typography
                                    variant="caption"
                                    component="div"
                                    sx={{
                                      position: 'absolute',
                                      fontSize: 9,
                                      fontWeight: 'bold',
                                      color: '#fff'
                                    }}
                                  >
                                    {v.cvss_score.toFixed(0)}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={(v.severity || 'low').toUpperCase()}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: 9,
                                    fontWeight: 'bold',
                                    bgcolor: `${getSeverityColor(v.severity)}15`,
                                    color: getSeverityColor(v.severity),
                                    border: `1px solid ${getSeverityColor(v.severity)}30`
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={v.status}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    height: 18,
                                    fontSize: 9,
                                    fontWeight: 'bold',
                                    color: v.status === 'mitigated' ? '#00e676' : '#ff1744',
                                    borderColor: v.status === 'mitigated' ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 23, 73, 0.3)'
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      ) : (
        /* Events Tab Layout */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            fullWidth
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="Search raw logs or CVE vulnerability triggers... (Click JSON values below to filter instantly)"
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
              Raw Ingested Vulnerability Events ({eventList.length} matches)
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
                      <TableCell>Type</TableCell>
                      <TableCell>Description Summary</TableCell>
                      <TableCell align="right">Severity</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {eventList.map((e, idx) => {
                      const expanded = eventExpanded === e.id;
                      const severity = e.event_data?.severity || 'high';
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
                            <TableCell>
                              <Chip label={e.event_type.toUpperCase()} size="small" sx={{ height: 16, fontSize: 8.5, fontWeight: 'bold', bgcolor: 'rgba(255,255,255,0.05)', color: '#8c909e' }} />
                            </TableCell>
                            <TableCell sx={{ color: '#ffb74d' }}>
                              {e.event_data?.description || `Package ${e.event_data?.package || ''} vulnerability detected (${e.event_data?.cve || ''})`}
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                label={severity.toUpperCase()}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: 8.5,
                                  fontWeight: 'bold',
                                  bgcolor: `${getSeverityColor(severity)}15`,
                                  color: getSeverityColor(severity)
                                }}
                              />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                              <Collapse in={expanded} timeout="auto" unmountOnExit>
                                <Box sx={{ py: 2, px: 3, bgcolor: '#090a0f', borderBottom: '1px solid rgba(255,255,255,0.06)', borderRadius: 1 }}>
                                  <Typography variant="subtitle2" sx={{ color: '#8c909e', fontWeight: 'bold', mb: 1, fontSize: 11 }}>
                                    Full Syslog Telemetry Details (JSON Tree)
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

      {/* CVE Details slideout drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 480,
            bgcolor: '#12131a',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            p: 3,
            color: '#fff'
          }
        }}
      >
        {selectedCve && (
          <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ff9100' }}>
                {selectedCve.cve_id}
              </Typography>
              <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: '#8c909e' }}>
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Severity Card info */}
            <Paper className="glass-panel" sx={{ p: 2, mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#8c909e', display: 'block' }}>CVSS Severity</Typography>
                <Typography variant="h5" sx={{ fontWeight: '800', color: getSeverityColor(selectedCve.severity) }}>
                  {selectedCve.severity.toUpperCase()} ({selectedCve.cvss_score.toFixed(1)})
                </Typography>
              </Box>
              <CircularProgress variant="determinate" value={selectedCve.cvss_score * 10} size={50} thickness={6} sx={{ color: getSeverityColor(selectedCve.severity) }} />
            </Paper>

            <Typography variant="subtitle2" sx={{ color: '#8c909e', mb: 1 }}>Vulnerability Description</Typography>
            <Typography variant="body2" sx={{ fontSize: 13, lineHeight: 1.6, mb: 3.5 }}>
              {selectedCve.description}
            </Typography>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 3 }} />

            {/* CVSS Vector metrics */}
            <Typography variant="subtitle2" sx={{ color: '#8c909e', mb: 2 }}>CVSS v3 Vector Metrics</Typography>
            <Grid container spacing={1.5} sx={{ mb: 3.5 }}>
              {parseVector(selectedCve.vector).map((chip, idx) => (
                <Grid item xs={6} key={idx}>
                  <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 1.5 }}>
                    <Typography variant="caption" sx={{ color: '#666', display: 'block', fontSize: 9 }}>{chip.key}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: 11.5, color: '#fff' }}>{chip.val}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* CPE details */}
            <Typography variant="subtitle2" sx={{ color: '#8c909e', mb: 1 }}>Affected Package CPE</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', p: 1.5, bgcolor: '#090a0f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 1, mb: 3.5 }}>
              {selectedCve.cpe}
            </Typography>

            {/* Remediation */}
            <Typography variant="subtitle2" sx={{ color: '#8c909e', mb: 1 }}>Remediation Strategy</Typography>
            <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 'bold', color: '#00e676', mb: 3.5 }}>
              {selectedCve.remediation}
            </Typography>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 3 }} />

            {/* References */}
            <Typography variant="subtitle2" sx={{ color: '#8c909e', mb: 1.5 }}>Advisory References</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {selectedCve.references.map((ref, idx) => (
                <Button
                  key={idx}
                  variant="outlined"
                  size="small"
                  href={ref}
                  target="_blank"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                  sx={{ justifyContent: 'space-between', borderColor: 'rgba(255,255,255,0.08)', color: '#8c909e', textTransform: 'none', fontSize: 11, '&:hover': { borderColor: '#f05a28', color: '#fff' } }}
                >
                  {ref.replace('https://', '')}
                </Button>
              ))}
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}

export default Vulnerabilities;
