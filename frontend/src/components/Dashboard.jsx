import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Container, Grid, Paper, Typography, Card, CardContent, LinearProgress, Button } from '@mui/material';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Alert, AlertTitle } from '@mui/material';
import CriticalIcon from '@mui/icons-material/ErrorOutline';
import HighIcon from '@mui/icons-material/Warning';
import MediumIcon from '@mui/icons-material/Info';
import LowIcon from '@mui/icons-material/CheckCircle';

const COLORS = {
  critical: '#ff1744',
  high: '#ff9100',
  medium: '#ffd600',
  low: '#00e676',
  background: '#0f0f23',
  card: '#1a1a3e',
  accent: '#2d2d5f'
};

export function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/summary`);
      const data = await response.json();
      setStats(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  if (loading) {
    return <LinearProgress />;
  }

  const alertData = [
    { name: 'Critical', value: stats?.alerts?.critical || 0, color: COLORS.critical },
    { name: 'High', value: stats?.alerts?.high || 0, color: COLORS.high },
    { name: 'Medium', value: stats?.alerts?.medium || 0, color: COLORS.medium },
    { name: 'Low', value: stats?.alerts?.low || 0, color: COLORS.low }
  ];

  return (
    <Box sx={{ background: COLORS.background, minHeight: '100vh', py: 3 }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h3" sx={{ color: '#fff', fontWeight: 'bold' }}>
            🛡️ ARGUS Dashboard
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => window.location.href = '/admin'}
            sx={{ 
              borderColor: '#2d94ff', 
              color: '#2d94ff', 
              '&:hover': { borderColor: '#fff', color: '#fff', background: 'rgba(255,255,255,0.05)' } 
            }}
          >
            ⚙️ Admin Panel
          </Button>
        </Box>

        {/* Key Metrics */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: COLORS.card, borderLeft: `4px solid ${COLORS.critical}` }}>
              <CardContent>
                <Typography color="textSecondary">Critical Alerts</Typography>
                <Typography variant="h4" sx={{ color: COLORS.critical }}>
                  {stats?.alerts?.critical || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: COLORS.card, borderLeft: `4px solid ${COLORS.high}` }}>
              <CardContent>
                <Typography color="textSecondary">High Severity</Typography>
                <Typography variant="h4" sx={{ color: COLORS.high }}>
                  {stats?.alerts?.high || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: COLORS.card, borderLeft: `4px solid ${COLORS.medium}` }}>
              <CardContent>
                <Typography color="textSecondary">Total Events Today</Typography>
                <Typography variant="h4" sx={{ color: COLORS.medium }}>
                  {stats?.events?.total_today || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: COLORS.card, borderLeft: `4px solid ${COLORS.low}` }}>
              <CardContent>
                <Typography color="textSecondary">Healthy Endpoints</Typography>
                <Typography variant="h4" sx={{ color: COLORS.low }}>
                  {stats?.endpoints?.healthy || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts */}
        <Grid container spacing={2}>
          {/* Alert Distribution */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ background: COLORS.card, p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Alert Distribution</Typography>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={alertData} cx="50%" cy="50%" innerRadius={40} outerRadius={100} paddingAngle={2} dataKey="value">
                    {alertData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Detection Types */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ background: COLORS.card, p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Detection Types</Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { name: 'Behavioral', value: stats?.detections?.behavioral || 0 },
                  { name: 'Anomaly', value: stats?.detections?.anomaly || 0 },
                  { name: 'Signature', value: stats?.detections?.signature_based || 0 },
                  { name: 'Threat Intel', value: stats?.detections?.threat_intel || 0 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2d94ff" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Endpoint Status */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ background: COLORS.card, p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Endpoint Status</Typography>
              <Box>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Healthy</Typography>
                    <Typography variant="body2">{stats?.endpoints?.healthy || 0}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={95} sx={{ height: 8 }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Offline</Typography>
                    <Typography variant="body2">{stats?.endpoints?.offline || 0}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={5} sx={{ height: 8, backgroundColor: COLORS.critical }} />
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Security Posture */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ background: COLORS.card, p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Security Compliance</Typography>
              <Box>
                {[
                  { name: 'MITRE ATT&CK Coverage', value: 62 },
                  { name: 'CIS Controls', value: 85 },
                  { name: 'NIST 800-53', value: 78 }
                ].map((item, idx) => (
                  <Box key={idx} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">{item.name}</Typography>
                      <Typography variant="body2">{item.value}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={item.value} sx={{ height: 8 }} />
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Alerts Section */}
        <Grid item xs={12} sx={{ mt: 3 }}>
          <Paper sx={{ background: COLORS.card, p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Recent Critical Alerts</Typography>
            <Alert severity="error">
              <AlertTitle>Critical Alert</AlertTitle>
              Suspicious process execution detected on WORKSTATION-001 - Mimikatz execution pattern identified
            </Alert>
          </Paper>
        </Grid>
      </Container>
    </Box>
  );
}

export default Dashboard;
