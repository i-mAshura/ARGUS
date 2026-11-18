import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, LinearProgress, IconButton, Tabs, Tab, TextField, InputAdornment, Collapse, Tooltip as MuiTooltip } from '@mui/material';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function Fim({ selectedAgent = 'all' }) {
  const [fimEvents, setFimEvents] = useState([]);
  const [activeDirFilter, setActiveDirFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  
  // Tabs state (0 = Dashboard, 1 = Events)
  const [activeModuleTab, setActiveModuleTab] = useState(0);
  const [eventSearch, setEventSearch] = useState('');
  const [eventExpanded, setEventExpanded] = useState(null);

  useEffect(() => {
    fetchFimEvents();
  }, [selectedAgent, eventSearch]);

  const fetchFimEvents = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/events/?limit=100`;
      if (eventSearch.trim()) {
        url += `&search=${encodeURIComponent(eventSearch)}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      
      let filtered = (data.events || []).filter(e => 
        e.event_type.startsWith('file_') || e.event_type.includes('fim') || e.event_type.includes('integrity')
      );
      
      if (filtered.length === 0) {
        filtered = [];
      }

      // Normalize event_data structures
      filtered = filtered.map(item => ({
        ...item,
        event_data: {
          file_path: item.event_data?.file_path || '/var/log/audit.log',
          action: item.event_data?.action || 'modified',
          process_name: item.event_data?.process_name || 'systemd',
          user: item.event_data?.user || 'root',
          size_bytes: item.event_data?.size_bytes || 0,
          md5: item.event_data?.md5 || ''
        }
      }));

      if (selectedAgent !== 'all') {
        filtered = filtered.filter(e => e.hostname === selectedAgent || e.agent_id === selectedAgent);
      }

      setFimEvents(filtered);
    } catch (err) {
      console.error("Error FIM events: ", err);
    }
    setLoading(false);
  };

  const getActionColor = (action) => {
    switch (action?.toLowerCase()) {
      case 'created':
      case 'added':
        return 'success';
      case 'modified':
      case 'updated':
        return 'warning';
      case 'deleted':
        return 'error';
      default:
        return 'default';
    }
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

  // Directories mapping counts
  const dirMap = [
    { label: 'etc System Auth', path: '/etc/pam.d', count: fimEvents.filter(e => e.event_data?.file_path?.includes('/etc/pam.d')).length },
    { label: 'System32 Drivers', path: 'System32\\drivers', count: fimEvents.filter(e => e.event_data?.file_path?.includes('System32\\drivers')).length },
    { label: 'Users SSH Keys', path: '.ssh', count: fimEvents.filter(e => e.event_data?.file_path?.includes('.ssh')).length },
    { label: 'Public Auditing', path: 'Public', count: fimEvents.filter(e => e.event_data?.file_path?.includes('Public')).length }
  ];

  // Dynamic filter
  const displayedFim = activeDirFilter === 'all' 
    ? fimEvents 
    : fimEvents.filter(e => e.event_data?.file_path?.includes(activeDirFilter));

  const chartData = [
    { name: 'Modifications', count: displayedFim.filter(e => (e.event_data?.action || '').includes('mod')).length },
    { name: 'Creations', count: displayedFim.filter(e => (e.event_data?.action || '').includes('creat') || (e.event_data?.action || '').includes('add')).length },
    { name: 'Deletions', count: displayedFim.filter(e => (e.event_data?.action || '').includes('del')).length },
  ];

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3.5, gap: 1.5 }}>
        <FolderZipIcon sx={{ color: '#f05a28', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
          File Integrity Audits (FIM)
        </Typography>
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
          {/* Directory Folder Quick Filter Map */}
          <Typography variant="subtitle2" sx={{ mb: 2, color: '#8c909e', fontWeight: 'bold' }}>
            Interactive Directory Monitor Map
          </Typography>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            
            {/* All Directories Folder */}
            <Grid item xs={6} sm={2.4}>
              <Card
                onClick={() => setActiveDirFilter('all')}
                className="glass-panel"
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  bgcolor: activeDirFilter === 'all' ? 'rgba(240,90,40,0.1) !important' : '#12131a',
                  borderColor: activeDirFilter === 'all' ? '#f05a28 !important' : 'rgba(255,255,255,0.06)',
                  '&:hover': { transform: 'translateY(-2px)' }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {activeDirFilter === 'all' ? <FolderOpenIcon sx={{ color: '#f05a28' }} /> : <FolderIcon sx={{ color: '#8c909e' }} />}
                  <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: 12 }}>All Paths</Typography>
                    <Typography variant="caption" sx={{ color: '#8c909e' }}>{fimEvents.length} events</Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>

            {/* Directory Specific Cards */}
            {dirMap.map((d, index) => {
              const active = activeDirFilter === d.path;
              return (
                <Grid item xs={6} sm={2.4} key={index}>
                  <Card
                    onClick={() => setActiveDirFilter(d.path)}
                    className="glass-panel"
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      bgcolor: active ? 'rgba(240,90,40,0.1) !important' : '#12131a',
                      borderColor: active ? '#f05a28 !important' : 'rgba(255,255,255,0.06)',
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {active ? <FolderOpenIcon sx={{ color: '#f05a28' }} /> : <FolderIcon sx={{ color: '#8c909e' }} />}
                      <Box>
                        <Typography sx={{ fontWeight: 'bold', fontSize: 12, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#8c909e' }}>{d.count} events</Typography>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              );
            })}

          </Grid>

          {loading ? (
            <LinearProgress sx={{ mt: 2, bgcolor: '#1b1e27', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />
          ) : (
            <Grid container spacing={3.5}>
              {/* FIM Chart */}
              <Grid item xs={12} md={4}>
                <Paper className="glass-panel" sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: '700', mb: 2, fontSize: 15, color: '#fff' }}>
                    FIM Activity division
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#8c909e" fontSize={11} tickLine={false} />
                      <YAxis stroke="#8c909e" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#12131a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                      <Bar dataKey="count" fill="#f05a28" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Audit Log Table */}
              <Grid item xs={12} md={8}>
                <Paper className="glass-panel" sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: '700', mb: 2.5, fontSize: 15, color: '#fff' }}>
                    FIM Audit Trails ({displayedFim.length} entries shown)
                  </Typography>
                  <TableContainer sx={{ maxHeight: 250 }}>
                    <Table size="small" className="interactive-table">
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11 } }}>
                          <TableCell>Timestamp</TableCell>
                          <TableCell>Agent Endpoint</TableCell>
                          <TableCell>Modified File Path</TableCell>
                          <TableCell>Action</TableCell>
                          <TableCell>Writing Process</TableCell>
                          <TableCell>User</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {displayedFim.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#8c909e' }}>
                              No File Integrity Monitoring (FIM) audit logs found. Connect an agent to monitor files.
                            </TableCell>
                          </TableRow>
                        ) : (
                          displayedFim.map((e, idx) => (
                            <TableRow key={e.id || idx} hover sx={{ '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5, fontSize: 12.5 } }}>
                              <TableCell sx={{ fontSize: 10.5, opacity: 0.8 }}>{new Date(e.timestamp).toLocaleString()}</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>{e.hostname}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, color: '#ffb74d', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <MuiTooltip title={e.event_data?.file_path || ''} arrow>
                                  <span>{e.event_data?.file_path}</span>
                                </MuiTooltip>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={(e.event_data?.action || 'unknown').toUpperCase()}
                                  size="small"
                                  color={getActionColor(e.event_data?.action)}
                                  sx={{ height: 18, fontSize: 9, fontWeight: '800' }}
                                />
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: 11.5 }}>{e.event_data?.process_name || 'N/A'}</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>{e.event_data?.user || 'unknown'}</TableCell>
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
            placeholder="Search FIM audit records... (Click JSON values below to filter instantly)"
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
              Raw Ingested FIM Events ({displayedFim.length} matches)
            </Typography>

            {loading ? (
              <LinearProgress sx={{ bgcolor: '#1b1e27', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />
            ) : (
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11 } }}>
                      <TableCell width="40"></TableCell>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Host</TableCell>
                      <TableCell>Modified File Path</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Process</TableCell>
                      <TableCell align="right">User</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedFim.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 5, color: '#8c909e' }}>
                          No raw FIM events found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedFim.map((e, idx) => {
                        const expanded = eventExpanded === e.id;
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
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: 11.5, color: '#ffb74d' }}>{e.event_data?.file_path}</TableCell>
                              <TableCell>
                                <Chip
                                  label={(e.event_data?.action || 'unknown').toUpperCase()}
                                  size="small"
                                  color={getActionColor(e.event_data?.action)}
                                  sx={{ height: 16, fontSize: 8.5, fontWeight: 'bold' }}
                                />
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: 11.5 }}>{e.event_data?.process_name || 'N/A'}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{e.event_data?.user}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                                <Collapse in={expanded} timeout="auto" unmountOnExit>
                                  <Box sx={{ py: 2, px: 3, bgcolor: '#090a0f', borderBottom: '1px solid rgba(255,255,255,0.06)', borderRadius: 1 }}>
                                    <Typography variant="subtitle2" sx={{ color: '#8c909e', fontWeight: 'bold', mb: 1, fontSize: 11 }}>
                                      Full FIM Syslog Telemetry Details (JSON Tree)
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
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );
}

export default Fim;
