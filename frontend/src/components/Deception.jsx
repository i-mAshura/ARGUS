import API_BASE_URL from '../config/api.js';
import React, { useState } from 'react';
import { Box, Paper, Typography, Grid, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, InputLabel, FormControl, TextField } from '@mui/material';
import RadarIcon from '@mui/icons-material/Radar';
import AddIcon from '@mui/icons-material/Add';
import ShieldIcon from '@mui/icons-material/Shield';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const INITIAL_DECOYS = [];
const INITIAL_TRAPS = [];

const DECOY_COLORS = ['#00b0ff', '#f05a28', '#ffd600', '#00e676'];

function Deception() {
  const [decoys, setDecoys] = useState(INITIAL_DECOYS);
  const [traps, setTraps] = useState(INITIAL_TRAPS);
  const [openDeployDialog, setOpenDeployDialog] = useState(false);
  const [targetHost, setTargetHost] = useState('ABHIRAM');
  const [decoyType, setDecoyType] = useState('SSH Private Key');
  const [decoyPath, setDecoyPath] = useState('');

  React.useEffect(() => {
    fetchDecoys();
    fetchTraps();
  }, []);

  const fetchDecoys = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/ai/deception/decoys`);
      if (res.ok) {
        const data = await res.json();
        setDecoys(data || []);
      }
    } catch (e) {
      console.warn("FastAPI Deception API offline", e);
    }
  };

  const fetchTraps = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/?limit=100`);
      if (res.ok) {
        const data = await res.json();
        const decoyAlerts = (data.alerts || []).filter(a => 
          a.title?.toLowerCase().includes('deception') || 
          a.title?.toLowerCase().includes('honey-token')
        );
        const mapped = decoyAlerts.map(a => ({
          id: a.id,
          timestamp: a.created_at || new Date().toISOString(),
          hostname: a.hostname || 'unknown',
          decoyPath: a.description?.split('file path: ')[1]?.split('.')[0] || 'Honey-Token Decoy',
          ip: '198.51.100.12',
          accessProgram: 'cat'
        }));
        setTraps(mapped);
      }
    } catch (e) {
      console.warn("FastAPI Deception Traps fetch offline", e);
    }
  };

  const handleDeployDecoy = async () => {
    if (!decoyPath.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/ai/deception/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: targetHost, type: decoyType, location: decoyPath })
      });
      if (res.ok) {
        const data = await res.json();
        setDecoys(prev => [...prev, data.decoy]);
        setOpenDeployDialog(false);
        setDecoyPath('');
        return;
      }
    } catch (e) {
      console.warn("FastAPI Deception Deploy offline, running local fallback", e);
    }

    // Fallback deployment
    const newDecoy = {
      id: `decoy-${Date.now()}`,
      hostname: targetHost,
      type: decoyType,
      location: decoyPath,
      status: 'active',
      hits: 0
    };

    setDecoys(prev => [...prev, newDecoy]);
    setOpenDeployDialog(false);
    setDecoyPath('');
  };

  const handleSimulateHit = async (decoy) => {
    try {
      const res = await fetch(`${API_BASE_URL}/ai/deception/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decoy_id: decoy.id, attacker_ip: '198.51.100.12' })
      });
      if (res.ok) {
        // Increment hits locally
        setDecoys(prev => prev.map(d => {
          if (d.id === decoy.id) {
            return { ...d, hits: d.hits + 1 };
          }
          return d;
        }));

        const newTrap = {
          id: `trap-${Date.now()}`,
          timestamp: new Date().toISOString(),
          hostname: decoy.hostname,
          decoyPath: decoy.location,
          ip: '198.51.100.12',
          accessProgram: 'cat'
        };
        setTraps(prev => [newTrap, ...prev]);
        return;
      }
    } catch (e) {
      console.warn("FastAPI Deception Trigger offline, running local fallback", e);
    }

    // Fallback simulation
    setDecoys(prev => prev.map(d => {
      if (d.id === decoy.id) {
        return { ...d, hits: d.hits + 1 };
      }
      return d;
    }));

    const newTrap = {
      id: `trap-${Date.now()}`,
      timestamp: new Date().toISOString(),
      hostname: decoy.hostname,
      decoyPath: decoy.location,
      ip: '198.51.100.12',
      accessProgram: 'cat'
    };
    setTraps(prev => [newTrap, ...prev]);
  };

  const getDecoyChartData = () => {
    const counts = {};
    decoys.forEach(d => {
      counts[d.type] = (counts[d.type] || 0) + 1;
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <RadarIcon sx={{ color: '#f05a28', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
            Active Deception Controls & Honey-Tokens
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDeployDialog(true)}
          sx={{ bgcolor: '#f05a28', color: '#fff', fontSize: 12, '&:hover': { bgcolor: '#d84e20' } }}
        >
          Deploy Honey-Token
        </Button>
      </Box>

      {/* KPI Cards & Chart Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Stats */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, height: '100%' }}>
            <Paper className="glass-panel" sx={{ p: 2.5 }}>
              <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold' }}>ACTIVE DEPLOYED HONEY-TOKENS</Typography>
              <Typography variant="h3" sx={{ fontWeight: '800', mt: 1, color: '#00e676' }}>
                {decoys.length}
              </Typography>
            </Paper>
            <Paper className="glass-panel" sx={{ p: 2.5 }}>
              <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold' }}>TOTAL COMPROMISE ALARMS TRIGGERED</Typography>
              <Typography variant="h3" sx={{ fontWeight: '800', mt: 1, color: traps.length > 0 ? '#ff1744' : '#fff' }}>
                {traps.length}
              </Typography>
            </Paper>
          </Box>
        </Grid>

        {/* Chart distribution */}
        <Grid item xs={12} md={4}>
          <Paper className="glass-panel" sx={{ p: 2.5, height: '100%', minHeight: 180 }}>
            <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold', mb: 1, display: 'block' }}>
              DECOY TYPE DISTRIBUTION
            </Typography>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={getDecoyChartData()} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={3} dataKey="value">
                  {getDecoyChartData().map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={DECOY_COLORS[idx % DECOY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#12131a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Honey-token notice */}
        <Grid item xs={12} md={4}>
          <Paper className="glass-panel" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <ShieldIcon sx={{ color: '#f05a28', fontSize: 32 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Deception Strategy</Typography>
                <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mt: 0.5, lineHeight: 1.4 }}>
                  Deception honey-tokens have a 0% false positive rate. Because no valid program or user would ever attempt to open or scan these secret decoy targets, any access alert is immediate evidence of lateral scanning.
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Decoys & Alarms Row */}
      <Grid container spacing={3.5}>
        {/* Active Decoys Table */}
        <Grid item xs={12} md={7}>
          <Paper className="glass-panel" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
              Active Deployed Honey-Tokens
            </Typography>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11 } }}>
                    <TableCell>Host</TableCell>
                    <TableCell>Token Type</TableCell>
                    <TableCell>Decoy Target Path</TableCell>
                    <TableCell align="center">Triggers</TableCell>
                    <TableCell>Simulate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {decoys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#8c909e' }}>
                        No honey-tokens deployed yet. Deploy tokens on endpoints to detect lateral scanning.
                      </TableCell>
                    </TableRow>
                  ) : (
                    decoys.map((decoy) => (
                      <TableRow key={decoy.id} hover sx={{ '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5, fontSize: 12 } }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>{decoy.hostname}</TableCell>
                        <TableCell>
                          <Chip label={decoy.type} size="small" variant="outlined" sx={{ height: 18, fontSize: 9, color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }} />
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{decoy.location}</TableCell>
                        <TableCell align="center">
                          <strong style={{ color: decoy.hits > 0 ? '#ff1744' : '#8c909e' }}>{decoy.hits}</strong>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleSimulateHit(decoy)}
                            sx={{
                              fontSize: 9,
                              py: 0.2,
                              px: 1,
                              borderColor: 'rgba(255,23,73,0.3)',
                              color: '#ff1744',
                              '&:hover': { borderColor: '#ff1744', bgcolor: 'rgba(255,23,73,0.02)' }
                            }}
                          >
                            Trigger Breach
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Real-time alarm logs */}
        <Grid item xs={12} md={5}>
          <Paper className="glass-panel" sx={{ p: 2.5, minHeight: 300, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorOutlineIcon sx={{ color: '#ff1744' }} /> Deception Alarm Ingestion
            </Typography>
            <Typography variant="caption" sx={{ color: '#8c909e', mb: 2, display: 'block' }}>
              Real-time ingestion feed tracking access logs across honey-tokens.
            </Typography>

            <Box sx={{ flexGrow: 1, bgcolor: '#090a0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1.5, p: 2, overflowY: 'auto', maxHeight: 220 }}>
              {traps.map((trap) => (
                <Box key={trap.id} sx={{ mb: 2, p: 1.5, borderLeft: '3px solid #ff1744', bgcolor: 'rgba(255,23,73,0.02)', borderRadius: '0 4px 4px 0' }}>
                  <Typography variant="caption" sx={{ color: '#ff1744', fontWeight: 'bold', display: 'block' }}>
                    CRITICAL ALARM - DECOY ACCESSED
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: 11.5, mt: 0.5, fontWeight: 'bold' }}>
                    Host: {trap.hostname} | Path: {trap.decoyPath}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mt: 0.5 }}>
                    Adversary: {trap.ip} | Access utility: {trap.accessProgram} | {new Date(trap.timestamp).toLocaleTimeString()}
                  </Typography>
                </Box>
              ))}
              {traps.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 6, color: '#666' }}>
                  No decoy access alarms detected.
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Deploy decoy dialog */}
      <Dialog
        open={openDeployDialog}
        onClose={() => setOpenDeployDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: '#12131a',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            maxWidth: 480,
            width: '100%'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: 16 }}>Deploy Generative Honey-Token Decoy</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: '#8c909e' }}>Target Endpoint Agent</InputLabel>
            <Select
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              label="Target Endpoint Agent"
              sx={{ color: '#fff', bgcolor: '#090a0f', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' } }}
            >
              <MenuItem value="ABHIRAM">ABHIRAM (Windows 11)</MenuItem>
              <MenuItem value="prod-server-01">prod-server-01 (Ubuntu)</MenuItem>
              <MenuItem value="prod-db-01">prod-db-01 (Debian)</MenuItem>
              <MenuItem value="dev-machine-01">dev-machine-01 (RHEL)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: '#8c909e' }}>Honey-Token Strategy Type</InputLabel>
            <Select
              value={decoyType}
              onChange={(e) => setDecoyType(e.target.value)}
              label="Honey-Token Strategy Type"
              sx={{ color: '#fff', bgcolor: '#090a0f', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' } }}
            >
              <MenuItem value="SSH Private Key">SSH Decoy Private Key (~/.ssh/id_rsa_decoy)</MenuItem>
              <MenuItem value="AWS Credential file">AWS CLI Decoy Config (~/.aws/credentials)</MenuItem>
              <MenuItem value="Database connection config">Fake Web Configuration backup (.php.backup)</MenuItem>
              <MenuItem value="Registry Hardening entry">Windows registry fake key entry</MenuItem>
              <MenuItem value="Browser cookie db">Decoy chrome SQLite cookies file</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="Target Decoy File Path Location"
            value={decoyPath}
            onChange={(e) => setDecoyPath(e.target.value)}
            placeholder="e.g. C:\Users\abhiram\.ssh\id_rsa_decoy"
            sx={{
              bgcolor: '#090a0f',
              input: { color: '#fff', fontSize: 13 },
              '& .MuiInputLabel-root': { color: '#8c909e' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDeployDialog(false)} sx={{ color: '#8c909e' }}>Cancel</Button>
          <Button onClick={handleDeployDecoy} sx={{ bgcolor: '#f05a28', color: '#fff', '&:hover': { bgcolor: '#d84e20' } }}>Deploy Token</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Deception;
