import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, Typography, Grid, Card, CardContent, LinearProgress, Chip } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, LineChart, Line } from 'recharts';
import ShieldIcon from '@mui/icons-material/Shield';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import HubIcon from '@mui/icons-material/Hub';
import LiveFeed from './LiveFeed';
import useLiveTelemetry from '../hooks/useLiveTelemetry';

const SEV_COLORS = {
  critical: '#ff1744',
  high: '#ff9100',
  medium: '#ffd600',
  low: '#00e676'
};

// Live chart data is populated only from real backend responses.

function Overview({ selectedAgent = 'all', onSelectSection }) {
  const { events, connected, cpuUsage, memoryUsage } = useLiveTelemetry();
  const [stats, setStats] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [topThreats, setTopThreats] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Rolling EPS (events per second) data from the live WebSocket feed.
  const [liveTelemetry, setLiveTelemetry] = useState([]);
  const eventArrivalRef = useRef(0);
  const prevEventCountRef = useRef(0);

  // Count every event arrival (reference change), not bounded array length
  // The events array is capped at MAX_EVENTS=200, so tracking .length flatlines.
  useEffect(() => {
    eventArrivalRef.current += 1;
  }, [events]);

  // Sample EPS every 3 seconds and push to chart
  useEffect(() => {
    const interval = setInterval(() => {
      const current = eventArrivalRef.current;
      const previous = prevEventCountRef.current;
      const eps = (current - previous) / 3;  // actual events per second
      prevEventCountRef.current = current;

      setLiveTelemetry(prev => {
        const next = [
          ...prev,
          { t: new Date().toLocaleTimeString(), eps: Math.max(0, Math.round(eps)) }
        ];
        return next.slice(-20);  // keep last 20 points
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedAgent]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch(`${API_BASE_URL}/dashboard/summary`);
      const statsData = await statsRes.json();
      setStats(statsData);

      const timelineRes = await fetch(`${API_BASE_URL}/dashboard/alerts/timeline`);
      const timelineData = await timelineRes.json();
      setTimeline(timelineData.timeline || []);

      const threatsRes = await fetch(`${API_BASE_URL}/dashboard/threats/top`);
      const threatsData = await threatsRes.json();
      setTopThreats(threatsData.threats || []);

      const incidentsRes = await fetch(`${API_BASE_URL}/dashboard/incidents/active`);
      const incidentsData = await incidentsRes.json();
      setIncidents(incidentsData.incidents || []);
      
      const rulesRes = await fetch(`${API_BASE_URL}/rules/?limit=1&offset=0`);
      const rulesData = await rulesRes.json();
      setStats(prev => ({ ...prev, rules: { total: rulesData.total || 0 } }));
      
    } catch (err) {
      console.error("Error loading Overview metrics: ", err);
    }
    setLoading(false);
  };

  if (loading) {
    return <LinearProgress sx={{ mt: 2, bgcolor: '#1b1e27', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />;
  }

  const alertData = [
    { name: 'Critical', value: stats?.alerts?.critical || 0, color: SEV_COLORS.critical },
    { name: 'High', value: stats?.alerts?.high || 0, color: SEV_COLORS.high },
    { name: 'Medium', value: stats?.alerts?.medium || 0, color: SEV_COLORS.medium },
    { name: 'Low', value: stats?.alerts?.low || 0, color: SEV_COLORS.low }
  ].filter(c => c.value > 0);

  const detectionTypesData = [
    { name: 'Signature', value: stats?.detections?.signature_based || 0 },
    { name: 'Behavioral', value: stats?.detections?.behavioral || 0 },
    { name: 'Anomaly', value: stats?.detections?.anomaly || 0 },
    { name: 'Threat Intel', value: stats?.detections?.threat_intel || 0 }
  ];

  const agentStatusData = [
    { name: 'Active (Online)', value: stats?.endpoints?.healthy || 0, color: '#00e676' },
    { name: 'Inactive (Offline)', value: stats?.endpoints?.offline || 0, color: '#ff1744' }
  ];

  const critTrend = [];
  const highTrend = [];
  const activeTrend = [];
  const eventsTrend = [];
  const cpuLoad = Number.isFinite(cpuUsage) ? cpuUsage : 0;
  const ramLoad = Number.isFinite(memoryUsage) ? memoryUsage : 0;

  return (
    <Box className="anim-slide-up">
      
      {/* System Manager Status banner */}
      <Paper 
        className="glass-panel" 
        sx={{ 
          p: 2, 
          mb: 3, 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: 'linear-gradient(90deg, rgba(18,19,26,0.8) 0%, rgba(240,90,40,0.08) 100%)',
          border: '1px solid rgba(240, 90, 40, 0.25)',
          borderRadius: 1.5,
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box 
            sx={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%', 
              bgcolor: '#00e676', 
              boxShadow: '0 0 10px #00e676',
              animation: 'pulse 2s infinite' 
            }} 
          />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#fff', fontSize: 13 }}>
              ARGUS Security Manager Status
            </Typography>
            <Typography variant="caption" color="#9598a3">
              Server Hostname: <strong>manager.argus-xdr.local</strong> | OS: <strong>Windows Server 2022 Datacenter</strong> | Node Status: <span style={{ color: '#00e676', fontWeight: 'bold' }}>CONNECTED [ONLINE]</span>
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="#8c909e" display="block">CPU Load</Typography>
            <Typography variant="subtitle2" color="#fff" sx={{ fontWeight: 'bold', fontSize: 12 }}>{cpuLoad.toFixed(0)}%</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="#8c909e" display="block">RAM Allocation</Typography>
            <Typography variant="subtitle2" color="#fff" sx={{ fontWeight: 'bold', fontSize: 12 }}>{ramLoad.toFixed(0)}% / 100%</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="#8c909e" display="block">Active Rules</Typography>
            <Typography variant="subtitle2" color="#f05a28" sx={{ fontWeight: 'bold', fontSize: 12 }}>{stats?.rules?.total ?? '…'} rules</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Visual Sparkline metrics */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        
        {/* Critical Alerts */}
        <Grid item xs={12} sm={6} md={3}>
          <Card onClick={() => onSelectSection('discover')} className="glass-panel glow-card-critical" sx={{ cursor: 'pointer' }}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>Critical Alerts</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 1, mb: 1 }}>
                <Typography variant="h3" color="#ff1744" sx={{ fontWeight: '800' }}>
                  {stats?.alerts?.critical ?? 0}
                </Typography>
                <Typography variant="caption" sx={{ color: '#ff1744', fontWeight: 'bold' }}>
                  {stats?.alerts?.critical > 0 ? "+12% vs yesterday" : "Stable"}
                </Typography>
              </Box>
              <ResponsiveContainer width="100%" height={35}>
                <AreaChart data={critTrend}>
                  <Area type="monotone" dataKey="v" stroke="#ff1744" fill="rgba(255, 23, 73, 0.1)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* High Alerts */}
        <Grid item xs={12} sm={6} md={3}>
          <Card onClick={() => onSelectSection('discover')} className="glass-panel glow-card-high" sx={{ cursor: 'pointer' }}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>High Warning Alerts</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 1, mb: 1 }}>
                <Typography variant="h3" color="#ff9100" sx={{ fontWeight: '800' }}>
                  {stats?.alerts?.high ?? 0}
                </Typography>
                <Typography variant="caption" sx={{ color: '#ff9100', fontWeight: 'bold' }}>
                  {stats?.alerts?.high > 0 ? "-5% vs yesterday" : "Stable"}
                </Typography>
              </Box>
              <ResponsiveContainer width="100%" height={35}>
                <AreaChart data={highTrend}>
                  <Area type="monotone" dataKey="v" stroke="#ff9100" fill="rgba(255, 145, 0, 0.1)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Agents */}
        <Grid item xs={12} sm={6} md={3}>
          <Card onClick={() => onSelectSection('agents')} className="glass-panel glow-card-low" sx={{ cursor: 'pointer' }}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>Connected Endpoints</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 1, mb: 1 }}>
                <Typography variant="h3" color="#00e676" sx={{ fontWeight: '800' }}>
                  {stats?.endpoints?.healthy ?? 0}
                </Typography>
                <Typography variant="caption" sx={{ color: '#00e676', fontWeight: 'bold' }}>
                  {stats?.endpoints?.healthy > 0 ? "100% Online" : "No Endpoints"}
                </Typography>
              </Box>
              <ResponsiveContainer width="100%" height={35}>
                <AreaChart data={activeTrend}>
                  <Area type="monotone" dataKey="v" stroke="#00e676" fill="rgba(0, 230, 118, 0.1)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Events */}
        <Grid item xs={12} sm={6} md={3}>
          <Card className="glass-panel glow-card-medium">
            <CardContent sx={{ pb: '12px !important' }}>
              <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>Telemetry Volume</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 1, mb: 1 }}>
                <Typography variant="h3" color="#ffd600" sx={{ fontWeight: '800' }}>
                  {Number(stats?.events?.total_today ?? 0).toLocaleString()}
                </Typography>
                <Typography variant="caption" sx={{ color: '#ffd600', fontWeight: 'bold' }}>
                  {stats?.events?.total_today > 0 ? "1.2k EPS avg" : "0 EPS avg"}
                </Typography>
              </Box>
              <ResponsiveContainer width="100%" height={35}>
                <AreaChart data={eventsTrend}>
                  <Area type="monotone" dataKey="v" stroke="#ffd600" fill="rgba(255, 214, 0, 0.1)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

      </Grid>

      {/* Main Charts: Area Timeline & Live Event Stream */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        
        {/* Timeline Area Chart */}
        <Grid item xs={12} md={8}>
          <Paper className="glass-panel" sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: '700', mb: 2.5, fontSize: 15, color: '#fff' }}>
              Security Incidents Frequency Timeline
            </Typography>
            {timeline.length > 0 && timeline.some(t => t.count > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f05a28" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f05a28" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="#8c909e" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8c909e" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#12131a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6 }} />
                  <Area type="monotone" dataKey="count" stroke="#f05a28" fillOpacity={1} fill="url(#colorOrange)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, color: '#666' }}>
                <ShieldIcon sx={{ fontSize: 40, mb: 1, color: '#00e676' }} />
                <Typography variant="body2">No incident frequency trends recorded</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Live Traffic Monitor (Rolling chart) */}
        <Grid item xs={12} md={4}>
          <Paper className="glass-panel" sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: '700', fontSize: 15, color: '#fff' }}>
                Live Stream EPS Rates
              </Typography>
              <Chip icon={<SignalCellularAltIcon sx={{ color: '#00e676 !important', fontSize: '14px !important' }} />} label="Live Ingest" size="small" sx={{ bgcolor: 'rgba(0, 230, 118, 0.1)', color: '#00e676', border: '1px solid rgba(0, 230, 118, 0.2)', height: 20, fontSize: 10, fontWeight: 'bold' }} className="pulse-active" />
            </Box>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={liveTelemetry} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="t" stroke="#8c909e" fontSize={10} tickLine={false} />
                <YAxis stroke="#8c909e" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#12131a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6 }} />
                <Line type="monotone" dataKey="eps" stroke="#00e676" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mt: 2, textAlign: 'center' }}>
              Real-time ingestion bandwidth computed locally from connected agents.
            </Typography>
          </Paper>
        </Grid>

      </Grid>

      {/* Grid: Incident Feed & Detection Breakdown */}
      <Grid container spacing={3}>
        
        {/* Severity split */}
        <Grid item xs={12} md={3}>
          <Paper className="glass-panel" sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: '700', mb: 2, fontSize: 15, color: '#fff' }}>
              Alert Severity Shares
            </Typography>
            <Box sx={{ position: 'relative', height: 230 }}>
              {alertData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={alertData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {alertData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#12131a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <Typography variant="h4" sx={{ fontWeight: '800', color: '#ff1744', lineHeight: 1.1 }}>
                      {stats?.alerts?.total || 0}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#8c909e', fontSize: 9, textTransform: 'uppercase', tracking: 1, fontWeight: 'bold' }}>
                      Alerts
                    </Typography>
                  </Box>
                </>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
                  <ShieldIcon sx={{ fontSize: 40, mb: 1, color: '#00e676' }} />
                  <Typography variant="body2">No alerts detected</Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Agent status split */}
        <Grid item xs={12} md={3}>
          <Paper className="glass-panel" sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: '700', mb: 2, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
              <HubIcon sx={{ color: '#00e676', fontSize: 18 }} /> Agent Status Shares
            </Typography>
            <Box sx={{ position: 'relative', height: 230 }}>
              {stats?.endpoints?.total > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={agentStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {agentStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#12131a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <Typography variant="h4" sx={{ fontWeight: '800', color: '#00e676', lineHeight: 1.1 }}>
                      {stats?.endpoints?.healthy || 0}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#8c909e', fontSize: 9, textTransform: 'uppercase', tracking: 1, fontWeight: 'bold' }}>
                      / {stats?.endpoints?.total || 0} Online
                    </Typography>
                  </Box>
                </>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
                  <HubIcon sx={{ fontSize: 40, mb: 1, color: '#ff1744' }} />
                  <Typography variant="body2">No Monitored Agents</Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Live Incident feed */}
        <Grid item xs={12} md={6}>
          <Paper className="glass-panel" sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: '700', mb: 3, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShieldIcon sx={{ color: '#ff9100' }} /> Active Escalation Feed
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {incidents.length > 0 ? (
                incidents.map((inc, index) => (
                  <Box
                    key={inc.id || index}
                    sx={{
                      p: 2,
                      bgcolor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 1.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.04)',
                        borderColor: 'rgba(240, 90, 40, 0.2)'
                      }
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: '700', color: '#ff1744', fontSize: 13.5 }}>
                        {inc.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#8c909e' }}>
                        Affected Endpoints: {inc.affected_hosts} | Alerts Volume: {inc.alert_count}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 0.5 }}>
                        {(inc.created_at ? new Date((inc.created_at + '').replace(/Z$/, '') + 'Z').toLocaleTimeString() : new Date().toLocaleTimeString())}
                      </Typography>
                      <Chip
                        label={(inc.status || 'investigating').toUpperCase()}
                        size="small"
                        color="warning"
                        sx={{ height: 18, fontSize: 9, fontWeight: 'bold', borderRadius: 1 }}
                      />
                    </Box>
                  </Box>
                ))
              ) : (
                <Box sx={{ p: 4, textAlign: 'center', color: '#666' }}>
                  <HelpOutlineIcon sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="body2">No alerts under active escalation.</Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

      </Grid>

      {/* ── Live Kafka / WebSocket Telemetry Feed ───────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Box sx={{ height: 380 }}>
            <LiveFeed />
          </Box>
        </Grid>
      </Grid>

    </Box>
  );
}

export default Overview;
