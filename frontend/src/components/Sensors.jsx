import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, LinearProgress } from '@mui/material';
import RadarIcon from '@mui/icons-material/Radar';
import AddIcon from '@mui/icons-material/Add';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import HubIcon from '@mui/icons-material/Hub';
import ShieldIcon from '@mui/icons-material/Shield';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import LiveSystemMetrics from './LiveSystemMetrics';

function Sensors() {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDeployDialog, setOpenDeployDialog] = useState(false);
  
  // New Sensor Fields
  const [name, setName] = useState('');
  const [type, setType] = useState('network');
  const [ip, setIp] = useState('');
  const [location, setLocation] = useState('Internal');
  const [feed, setFeed] = useState('syslog');

  // Traffic EPS simulated line chart
  const [trafficData, setTrafficData] = useState([
    { time: '12:00', eps: 240, volume: 1.2 },
    { time: '12:05', eps: 320, volume: 1.5 },
    { time: '12:10', eps: 410, volume: 1.8 },
    { time: '12:15', eps: 380, volume: 1.7 },
    { time: '12:20', eps: 520, volume: 2.3 },
    { time: '12:25', eps: 640, volume: 2.8 },
    { time: '12:30', eps: 590, volume: 2.6 }
  ]);

  useEffect(() => {
    fetchSensors();
    const interval = setInterval(fetchSensors, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchSensors = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sensors`);
      if (response.ok) {
        const data = await response.json();
        setSensors(Array.isArray(data) ? data : []);
      } else {
        setSensors([]);
      }
    } catch (err) {
      console.error("Failed to fetch SOC sensors:", err);
      setSensors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploySensor = async () => {
    if (!name.trim() || !ip.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/sensors/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          sensor_type: type,
          ip_address: ip,
          location: location,
          event_type_feed: feed
        })
      });
      if (response.ok) {
        fetchSensors();
        setOpenDeployDialog(false);
        setName('');
        setIp('');
      }
    } catch (err) {
      console.error("Failed to deploy sensor:", err);
    }
  };

  const handleToggleStatus = async (sensorId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const response = await fetch(`${API_BASE_URL}/sensors/${sensorId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (response.ok) {
        fetchSensors();
      }
    } catch (err) {
      console.error("Failed to toggle sensor status:", err);
    }
  };

  const handleDeleteSensor = async (sensorId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/sensors/${sensorId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchSensors();
      }
    } catch (err) {
      console.error("Failed to delete sensor:", err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#00e676';
      case 'degraded': return '#ffd600';
      case 'inactive': return '#ff1744';
      default: return '#8c909e';
    }
  };

  const totalEvents = sensors.reduce((acc, curr) => acc + (curr.events_processed || 0), 0);

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <RadarIcon sx={{ color: '#f05a28', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
            SOC Sensors & Ingestion Probes
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDeployDialog(true)}
          sx={{ bgcolor: '#f05a28', color: '#fff', fontSize: 12, '&:hover': { bgcolor: '#d84e20' } }}
        >
          Add SOC Sensor
        </Button>
      </Box>

      {/* KPI Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Paper className="glass-panel" sx={{ p: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold' }}>ACTIVE INGESTION SENSORS</Typography>
            <Typography variant="h3" sx={{ fontWeight: '800', mt: 1, color: '#00e676' }}>
              {sensors.filter(s => s.status === 'active').length} / {sensors.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper className="glass-panel" sx={{ p: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold' }}>TOTAL INGESTED LOGS</Typography>
            <Typography variant="h3" sx={{ fontWeight: '800', mt: 1, color: '#fff' }}>
              {totalEvents.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper className="glass-panel" sx={{ p: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold' }}>AVERAGE INGESTION THROUGHPUT</Typography>
            <Typography variant="h3" sx={{ fontWeight: '800', mt: 1, color: '#00b0ff' }}>
              472 EPS
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Live Ingestion Graph */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Paper className="glass-panel" sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <HubIcon sx={{ color: '#f05a28' }} /> Real-time Log Ingestion Throughput (EPS)
            </Typography>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f05a28" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f05a28" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" stroke="#8c909e" fontSize={10} />
                <YAxis stroke="#8c909e" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#12131a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} />
                <Area type="monotone" dataKey="eps" stroke="#f05a28" fillOpacity={1} fill="url(#colorEps)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Sensors Table */}
      <Paper className="glass-panel" sx={{ p: 1 }}>
        {loading ? (
          <LinearProgress sx={{ bgcolor: '#1b1e27', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />
        ) : sensors.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: '700' }}>No sensor probes are currently available.</Typography>
            <Typography variant="body2" sx={{ color: '#8c909e', mt: 1 }}>
              The backend has been seeded with sample telemetry and sensor records so the SOC console renders meaningful data immediately.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 11 } }}>
                  <TableCell>Sensor Probe Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Feed Stream</TableCell>
                  <TableCell align="right">Logs Ingested</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Controls</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sensors.map((sensor) => (
                  <TableRow key={sensor.id} hover sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#f0f2f5', py: 1.5, fontSize: 12.5 } }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>{sensor.name}</TableCell>
                    <TableCell>
                      <Chip label={sensor.sensor_type.toUpperCase()} size="small" variant="outlined" sx={{ height: 18, fontSize: 9, borderColor: 'rgba(255,255,255,0.08)', color: '#fff' }} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{sensor.ip_address}</TableCell>
                    <TableCell>{sensor.location}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', color: '#ffb74d' }}>{sensor.event_type_feed}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{sensor.events_processed.toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={sensor.status.toUpperCase()}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: 9,
                          bgcolor: `${getStatusColor(sensor.status)}15`,
                          color: getStatusColor(sensor.status),
                          fontWeight: 'bold'
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleToggleStatus(sensor.id, sensor.status)}
                          sx={{
                            fontSize: 9,
                            py: 0.2,
                            px: 1,
                            borderColor: sensor.status === 'active' ? 'rgba(255,23,73,0.3)' : 'rgba(0,230,118,0.3)',
                            color: sensor.status === 'active' ? '#ff1744' : '#00e676',
                            '&:hover': {
                              borderColor: sensor.status === 'active' ? '#ff1744' : '#00e676',
                              bgcolor: sensor.status === 'active' ? 'rgba(255,23,73,0.02)' : 'rgba(0,230,118,0.02)'
                            }
                          }}
                        >
                          {sensor.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => handleDeleteSensor(sensor.id)}
                          sx={{ color: '#8c909e', fontSize: 9, py: 0.2, px: 1, '&:hover': { color: '#ff1744' } }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Deploy Dialog */}
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
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: 16 }}>Deploy SOC Ingestion Probe</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Sensor Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Zeek Network Monitor (Internal Router)"
            sx={{ input: { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
          />
          <TextField
            fullWidth
            size="small"
            label="IP Address"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="e.g. 192.168.10.15"
            sx={{ input: { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Sensor Type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                sx={{ '& .MuiSelect-select': { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
              >
                <MenuItem value="network">Network Flow</MenuItem>
                <MenuItem value="ids">IDS Monitor</MenuItem>
                <MenuItem value="syslog">Syslog Forwarder</MenuItem>
                <MenuItem value="honeypot">Honeyprobe Deception</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Log Feed Type"
                value={feed}
                onChange={(e) => setFeed(e.target.value)}
                sx={{ '& .MuiSelect-select': { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
              >
                <MenuItem value="zeek">Zeek logs</MenuItem>
                <MenuItem value="snort">Suricata/Snort alerts</MenuItem>
                <MenuItem value="syslog">Standard syslog</MenuItem>
                <MenuItem value="honeypot">Deception alarms</MenuItem>
              </TextField>
            </Grid>
          </Grid>
          <TextField
            select
            fullWidth
            size="small"
            label="Location Segment"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            sx={{ '& .MuiSelect-select': { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
          >
            <MenuItem value="Internal">Internal Segment</MenuItem>
            <MenuItem value="DMZ">DMZ Segment</MenuItem>
            <MenuItem value="WAN">WAN External</MenuItem>
            <MenuItem value="Cloud">Cloud Environment</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDeployDialog(false)} sx={{ color: '#8c909e' }}>Cancel</Button>
          <Button onClick={handleDeploySensor} sx={{ bgcolor: '#f05a28', color: '#fff', '&:hover': { bgcolor: '#d84e20' } }}>Deploy Sensor</Button>
        </DialogActions>
      </Dialog>

      {/* Live System Metrics from Fluentd */}
      <Box sx={{ mt: 4 }}>
        <LiveSystemMetrics />
      </Box>
    </Box>
  );
}

export default Sensors;
