import API_BASE_URL from '../config/api.js';
/**
 * LiveSystemMetrics.jsx
 * Shows real-time CPU, RAM, network connections and processes
 * collected by Fluentd via /api/v1/events/metrics/live
 * Also receives live updates from the Kafka WebSocket stream.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Paper, Typography, Grid, LinearProgress, Chip, Table,
  TableBody, TableCell, TableHead, TableRow, CircularProgress, Alert
} from '@mui/material';
import MemoryIcon from '@mui/icons-material/Memory';
import HubIcon from '@mui/icons-material/Hub';
import AppsIcon from '@mui/icons-material/Apps';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import RefreshIcon from '@mui/icons-material/Refresh';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const WS_URL = '${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8001/api/v1/metrics';
const LIVE_METRICS_URL = `${API_BASE_URL}/events/metrics/live`;

function GaugeBar({ label, value, color }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const col = pct > 85 ? '#ff1744' : pct > 65 ? '#ff9100' : color;
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#90a4ae' }}>{label}</Typography>
        <Typography variant="caption" sx={{ color: col, fontWeight: 700 }}>
          {pct.toFixed(1)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8, borderRadius: 4,
          bgcolor: 'rgba(255,255,255,0.06)',
          '& .MuiLinearProgress-bar': { bgcolor: col, borderRadius: 4, transition: 'width 0.8s ease' }
        }}
      />
    </Box>
  );
}

export default function LiveSystemMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  const updateMetrics = (data) => {
    setMetrics(data);
    setLastUpdate(new Date().toLocaleTimeString());
    const cpu = Number(data.cpu_percent) || 0;
    const ram = Number(data.ram_percent) || 0;
    if (cpu > 0 || ram > 0) {
      setHistory(prev => [...prev, {
        t: new Date().toLocaleTimeString(), cpu, ram,
      }].slice(-20));
    }
  };

  const connectWs = () => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        setWsConnected(true);
        setLoading(false);
      };
      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWs, 5000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'metrics') {
            const payload = msg.payload || {};
            const d = payload.event_data || payload;
            const nextMetrics = {
              cpu_percent: Number(d.cpu_percent ?? d.cpu_usage_percent ?? 0),
              ram_percent: Number(d.ram_percent ?? d.memory_usage_percent ?? 0),
              total_ram_mb: Number(d.total_ram_mb ?? d.total_memory_mb ?? 0),
              free_ram_mb: Number(d.free_ram_mb ?? 0),
              network: Array.isArray(d.network) ? d.network : (Array.isArray(payload.network) ? payload.network : []),
              processes: Array.isArray(d.processes) ? d.processes : (Array.isArray(payload.processes) ? payload.processes : []),
              last_updated: payload.timestamp || new Date().toISOString(),
            };
            setMetrics(nextMetrics);
            setLastUpdate(new Date().toLocaleTimeString());
            setLoading(false);
            const cpu = nextMetrics.cpu_percent;
            const ram = nextMetrics.ram_percent;
            if (cpu > 0 || ram > 0) {
              setHistory(prev => [...prev, { t: new Date().toLocaleTimeString(), cpu, ram }].slice(-20));
            }
          }
        } catch (_) {}
      };
    } catch (e) {
      setTimeout(connectWs, 5000);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitialSnapshot = async () => {
      try {
        const res = await fetch(LIVE_METRICS_URL);
        if (!res.ok || cancelled) return;

        const data = await res.json();
        const payload = data.event_data || data;
        const nextMetrics = {
          cpu_percent: Number(payload.cpu_percent ?? payload.cpu_usage_percent ?? 0),
          ram_percent: Number(payload.ram_percent ?? payload.memory_usage_percent ?? 0),
          total_ram_mb: Number(payload.total_ram_mb ?? payload.total_memory_mb ?? 0),
          free_ram_mb: Number(payload.free_ram_mb ?? 0),
          network: Array.isArray(payload.network) ? payload.network : [],
          processes: Array.isArray(payload.processes) ? payload.processes : [],
          last_updated: data.last_updated || new Date().toISOString(),
        };

        if (nextMetrics.cpu_percent > 0 || nextMetrics.ram_percent > 0) {
          setMetrics(nextMetrics);
          setLastUpdate(new Date().toLocaleTimeString());
          setHistory(prev => [...prev, { t: new Date().toLocaleTimeString(), cpu: nextMetrics.cpu_percent, ram: nextMetrics.ram_percent }].slice(-20));
        }
        setLoading(false);
      } catch (error) {
        console.warn('Failed to load initial metrics snapshot:', error);
      }
    };

    loadInitialSnapshot();
    connectWs();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress sx={{ color: '#f05a28' }} />
    </Box>
  );

  const hasData = metrics && (
    metrics.cpu_percent > 0 || metrics.ram_percent > 0 || metrics.last_updated ||
    (metrics.network && metrics.network.length > 0) ||
    (metrics.processes && metrics.processes.length > 0)
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <MemoryIcon sx={{ color: '#f05a28' }} />
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>Live System Metrics</Typography>
        <FiberManualRecordIcon sx={{
          fontSize: 10, ml: 0.5,
          color: hasData ? '#69f0ae' : '#f44336',
          animation: hasData ? 'pulse 1.5s ease-in-out infinite' : 'none',
          '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } }
        }} />
        <Chip label={wsConnected ? 'WS Live' : 'WebSocket'} size="small" sx={{
          fontSize: 9, height: 18,
          bgcolor: wsConnected ? 'rgba(105,240,174,0.1)' : 'rgba(255,145,0,0.1)',
          color: wsConnected ? '#69f0ae' : '#ff9100',
          border: `1px solid ${wsConnected ? '#69f0ae44' : '#ff910044'}`
        }} />
        <Typography variant="caption" sx={{ color: '#546e7a', ml: 'auto' }}>
          {lastUpdate ? `Updated: ${lastUpdate}` : 'Waiting for Fluentd data…'}
        </Typography>
        <RefreshIcon sx={{ color: '#546e7a', fontSize: 16, cursor: 'pointer', '&:hover': { color: '#fff' } }} onClick={() => wsRef.current?.close()} />
      </Box>

      {!hasData ? (
        <Alert severity="warning" sx={{ bgcolor: 'rgba(255,145,0,0.1)', color: '#ff9100', border: '1px solid rgba(255,145,0,0.2)' }}>
          No metrics yet. Fluentd collects every 30 seconds — please wait or check Fluentd is running as Administrator.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, bgcolor: '#0d1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, height: '100%' }}>
              <Typography variant="subtitle2" sx={{ color: '#e0e0e0', mb: 2.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <MemoryIcon sx={{ fontSize: 16, color: '#7c4dff' }} /> CPU / RAM
              </Typography>
              <GaugeBar label="CPU Usage" value={metrics?.cpu_percent} color="#7c4dff" />
              <GaugeBar label="RAM Usage" value={metrics?.ram_percent} color="#00b0ff" />
              {metrics?.total_ram_mb > 0 && (
                <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1 }}>
                  <Typography variant="caption" sx={{ color: '#546e7a', display: 'block' }}>
                    Total RAM: <span style={{ color: '#e0e0e0' }}>{metrics.total_ram_mb.toLocaleString()} MB</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#546e7a', display: 'block' }}>
                    Free RAM: <span style={{ color: '#69f0ae' }}>{metrics.free_ram_mb?.toLocaleString()} MB</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#546e7a', display: 'block' }}>
                    Used RAM: <span style={{ color: '#ff9100' }}>{((metrics.total_ram_mb - (metrics.free_ram_mb || 0))).toLocaleString()} MB</span>
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, bgcolor: '#0d1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, height: '100%' }}>
              <Typography variant="subtitle2" sx={{ color: '#e0e0e0', mb: 2, fontWeight: 700 }}>
                CPU & RAM History (last 20 readings · updates every 30s)
              </Typography>
              {history.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="gcpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c4dff" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#7c4dff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gram" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00b0ff" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00b0ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="t" tick={{ fill: '#546e7a', fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fill: '#546e7a', fontSize: 9 }} unit="%" width={35} />
                    <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v, n) => [`${Number(v).toFixed(1)}%`, n]} />
                    <Area type="monotone" dataKey="cpu" stroke="#7c4dff" fill="url(#gcpu)" name="CPU" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="ram" stroke="#00b0ff" fill="url(#gram)" name="RAM" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: '#546e7a' }}>
                  <Typography variant="caption">Collecting history… wait for 2+ readings</Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#0d1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ color: '#e0e0e0', mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <HubIcon sx={{ fontSize: 16, color: '#00b0ff' }} />
                Active Network Connections
                <Chip label={metrics?.network?.length || 0} size="small" sx={{ ml: 'auto', fontSize: 9, height: 16, bgcolor: 'rgba(0,176,255,0.1)', color: '#00b0ff' }} />
              </Typography>
              {metrics?.network?.length > 0 ? (
                <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#546e7a', fontSize: 10, py: 0.5 }}>Remote IP</TableCell>
                        <TableCell sx={{ color: '#546e7a', fontSize: 10, py: 0.5 }}>Remote Port</TableCell>
                        <TableCell sx={{ color: '#546e7a', fontSize: 10, py: 0.5 }}>Local Port</TableCell>
                        <TableCell sx={{ color: '#546e7a', fontSize: 10, py: 0.5 }}>State</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metrics.network.slice(0, 15).map((n, i) => (
                        <TableRow key={i}>
                          <TableCell sx={{ color: '#b0bec5', fontSize: 11, py: 0.5 }}>{n.remote_address || '—'}</TableCell>
                          <TableCell sx={{ color: '#b0bec5', fontSize: 11, py: 0.5 }}>{n.remote_port || '—'}</TableCell>
                          <TableCell sx={{ color: '#546e7a', fontSize: 11, py: 0.5 }}>{n.local_port || '—'}</TableCell>
                          <TableCell sx={{ py: 0.5 }}>
                            <Chip label={n.state || 'ESTABLISHED'} size="small"
                              sx={{ fontSize: 9, height: 16, bgcolor: 'rgba(105,240,174,0.1)', color: '#69f0ae' }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: '#546e7a' }}>No network data yet</Typography>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#0d1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ color: '#e0e0e0', mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AppsIcon sx={{ fontSize: 16, color: '#ff9100' }} />
                Top Processes by CPU
                <Chip label={metrics?.processes?.length || 0} size="small" sx={{ ml: 'auto', fontSize: 9, height: 16, bgcolor: 'rgba(255,145,0,0.1)', color: '#ff9100' }} />
              </Typography>
              {metrics?.processes?.length > 0 ? (
                <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#546e7a', fontSize: 10, py: 0.5 }}>Process</TableCell>
                        <TableCell sx={{ color: '#546e7a', fontSize: 10, py: 0.5 }}>PID</TableCell>
                        <TableCell sx={{ color: '#546e7a', fontSize: 10, py: 0.5 }}>CPU s</TableCell>
                        <TableCell sx={{ color: '#546e7a', fontSize: 10, py: 0.5 }}>RAM MB</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metrics.processes.slice(0, 15).map((p, i) => (
                        <TableRow key={i}>
                          <TableCell sx={{ color: '#e0e0e0', fontSize: 11, py: 0.5, fontWeight: 600 }}>{p.process_name || '—'}</TableCell>
                          <TableCell sx={{ color: '#90a4ae', fontSize: 10, py: 0.5 }}>{p.pid || '—'}</TableCell>
                          <TableCell sx={{ color: '#7c4dff', fontSize: 11, py: 0.5 }}>{p.cpu !== undefined ? Number(p.cpu).toFixed(1) : '—'}</TableCell>
                          <TableCell sx={{ color: '#ff9100', fontSize: 11, py: 0.5 }}>{p.memory_mb || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: '#546e7a' }}>No process data yet</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}