import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Grid, LinearProgress, Chip } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import useLiveTelemetry from '../hooks/useLiveTelemetry';

export function SystemMetrics() {
  const { events, connected, cpuUsage, memoryUsage } = useLiveTelemetry();
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [latestMetrics, setLatestMetrics] = useState({
    cpu_usage_percent: 0,
    memory_usage_percent: 0,
    timestamp: new Date()
  });

  useEffect(() => {
    const latest = events[0] || {};
    const payload = latest.payload || latest;
    const eventData = payload.event_data || payload;

    const nextCpu = Number(
      eventData.cpu_percent ??
      eventData.cpu_usage_percent ??
      eventData.cpu_usage ??
      cpuUsage ??
      0
    );

    const nextMemory = Number(
      eventData.ram_percent ??
      eventData.memory_percent ??
      eventData.memory_usage_percent ??
      eventData.memory_usage ??
      memoryUsage ??
      0
    );

    setLatestMetrics({
      cpu_usage_percent: nextCpu,
      memory_usage_percent: nextMemory,
      timestamp: latest.timestamp ? new Date(latest.timestamp) : new Date(),
      total_memory_gb: Number(eventData.total_memory_gb ?? eventData.total_ram_mb ? eventData.total_ram_mb / 1024 : 16),
      free_memory_mb: Number(eventData.free_memory_mb ?? 0)
    });

    if (nextCpu > 0 || nextMemory > 0) {
      setMetricsHistory(prevHistory => [
        {
          time: latest.timestamp ? new Date(latest.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
          cpu: nextCpu,
          memory: nextMemory
        },
        ...prevHistory
      ].slice(0, 20));
    }
  }, [events, cpuUsage, memoryUsage]);

  const getCpuColor = (cpu) => {
    if (cpu >= 80) return '#ff1744';  // Critical red
    if (cpu >= 60) return '#ff9100';  // Warning orange
    if (cpu >= 40) return '#ffd600';  // Caution yellow
    return '#00e676';                 // Good green
  };

  const getMemoryColor = (mem) => {
    if (mem >= 90) return '#ff1744';
    if (mem >= 75) return '#ff9100';
    if (mem >= 50) return '#ffd600';
    return '#00e676';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: '#fff' }}>
        🖥️ Live System Metrics
        {connected ? (
          <Chip label="Live" size="small" sx={{ ml: 2, bgcolor: '#00e676', color: '#000' }} />
        ) : (
          <Chip label="Offline" size="small" sx={{ ml: 2, bgcolor: '#ff1744', color: '#fff' }} />
        )}
      </Typography>

      {/* Main Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* CPU Usage Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: '#12131a', border: '1px solid #232630', p: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#9598a3' }}>
                  CPU Usage
                </Typography>
                <Typography variant="h4" sx={{ color: getCpuColor(latestMetrics.cpu_usage_percent), fontWeight: 'bold' }}>
                  {latestMetrics.cpu_usage_percent}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={latestMetrics.cpu_usage_percent}
                sx={{
                  height: 12,
                  borderRadius: 1,
                  bgcolor: '#1c1e28',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: getCpuColor(latestMetrics.cpu_usage_percent)
                  }
                }}
              />
              <Typography variant="caption" sx={{ mt: 2, display: 'block', color: '#9598a3' }}>
                Updated: {latestMetrics.timestamp.toLocaleTimeString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Memory Usage Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: '#12131a', border: '1px solid #232630', p: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#9598a3' }}>
                  Memory Usage
                </Typography>
                <Typography variant="h4" sx={{ color: getMemoryColor(latestMetrics.memory_usage_percent), fontWeight: 'bold' }}>
                  {latestMetrics.memory_usage_percent}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={latestMetrics.memory_usage_percent}
                sx={{
                  height: 12,
                  borderRadius: 1,
                  bgcolor: '#1c1e28',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: getMemoryColor(latestMetrics.memory_usage_percent)
                  }
                }}
              />
              <Typography variant="caption" sx={{ mt: 2, display: 'block', color: '#9598a3' }}>
                Free: {latestMetrics.free_memory_mb}MB / Total: {latestMetrics.total_memory_gb}GB
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Historical Chart */}
      <Card sx={{ bgcolor: '#12131a', border: '1px solid #232630', p: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3, color: '#fff' }}>
            📊 Metrics Timeline (Last 20 samples)
          </Typography>
          {metricsHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricsHistory.reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232630" />
                <XAxis 
                  dataKey="time" 
                  stroke="#9598a3" 
                  style={{ fontSize: 12 }}
                />
                <YAxis stroke="#9598a3" style={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    bgcolor: '#1c1e28', 
                    border: '1px solid #232630',
                    borderRadius: 4
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#ff9100"
                  dot={false}
                  name="CPU %"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  stroke="#2d94ff"
                  dot={false}
                  name="Memory %"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Typography sx={{ color: '#9598a3', textAlign: 'center', py: 4 }}>
              Waiting for metrics data...
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Box sx={{ mt: 3, p: 2, bgcolor: '#1a1a3e', borderRadius: 1, border: '1px solid #232630' }}>
        <Typography variant="caption" sx={{ color: '#9598a3' }}>
          {connected ? (
            <>
              ✅ WebSocket Connected - Receiving real-time metrics from agents
            </>
          ) : (
            <>
              ⚠️ WebSocket Disconnected - Attempting to reconnect...
            </>
          )}
        </Typography>
      </Box>
    </Box>
  );
}

export default SystemMetrics;
