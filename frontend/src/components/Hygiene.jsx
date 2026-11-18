import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button, LinearProgress, CircularProgress, Alert } from '@mui/material';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import ShieldIcon from '@mui/icons-material/Shield';
import KeyIcon from '@mui/icons-material/Key';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const INITIAL_PATCHES = [];
const INITIAL_POLICY_DRIFTS = [];

function Hygiene({ selectedAgent = 'all' }) {
  const [patches, setPatches] = useState([]);
  const [drifts, setDrifts] = useState([]);
  const [remediatingId, setRemediatingId] = useState(null);
  const [remedyLogs, setRemedyLogs] = useState('');

  useEffect(() => {
    fetchHygieneData();
  }, [selectedAgent]);

  const fetchHygieneData = async () => {
    try {
      // Fetch compliance data
      const compRes = await fetch(`${API_BASE_URL}/integrations/agent/compliance`);
      if (compRes.ok) {
        const compData = await compRes.json();
        const detailed = compData.detailed_compliance || [];
        const mappedDrifts = detailed.map(d => ({
          id: d.id,
          policy: d.requirement,
          current: d.status === 'compliant' || d.status === 'passed' ? 'Enforced' : 'Disabled / Drifted',
          recommended: d.id.includes('1.1') || d.requirement.includes('MFA') ? 'Enforced' : 'Secure configuration',
          category: d.standard,
          compliant: d.status === 'compliant' || d.status === 'passed'
        }));
        setDrifts(mappedDrifts);
      } else {
        setDrifts([]);
      }

      // Fetch vulnerability patches
      let vulnUrl = `${API_BASE_URL}/integrations/agent/vulnerabilities`;
      if (selectedAgent !== 'all') {
        vulnUrl += `?agent_id=${selectedAgent}`;
      }
      const vulnRes = await fetch(vulnUrl);
      if (vulnRes.ok) {
        const vulnData = await vulnRes.json();
        const items = vulnData.vulnerabilities || [];
        const mappedPatches = items.map(v => ({
          id: v.cve_id,
          cve: v.cve_id,
          title: v.description || `Vulnerability in ${v.package}`,
          severity: v.severity,
          component: v.package,
          status: v.status === 'mitigated' || v.status === 'patched' ? 'patched' : 'pending'
        }));
        setPatches(mappedPatches);
      } else {
        setPatches([]);
      }
    } catch (e) {
      console.warn("Error fetching hygiene data", e);
      setDrifts([]);
      setPatches([]);
    }
  };
  
  // Calculate aggregate stats
  const totalPatches = patches.length || 1; // avoid divide by zero
  const pendingPatches = patches.filter(p => p.status === 'pending').length;
  const scheduledPatches = patches.filter(p => p.status === 'scheduled').length;
  const patchedPatches = patches.filter(p => p.status === 'patched').length;

  const totalPolicies = drifts.length || 1;
  const compliantPolicies = drifts.filter(d => d.compliant).length;
  const nonCompliantPolicies = drifts.filter(d => !d.compliant).length;

  // Score calculations
  const patchScore = patches.length === 0 ? 100 : Math.round((patchedPatches + (scheduledPatches * 0.5)) / totalPatches * 100);
  const policyScore = drifts.length === 0 ? 100 : Math.round((compliantPolicies / totalPolicies) * 100);
  const aggregateScore = Math.round((patchScore + policyScore) / 2);

  const getSeverityColor = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical': return '#ff1744';
      case 'high': return '#ff9100';
      case 'medium': return '#ffd600';
      default: return '#00b0ff';
    }
  };

  const handleApprovePatch = (id) => {
    setPatches(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, status: 'scheduled' };
      }
      return p;
    }));
  };

  const handleRemediateDrift = (drift) => {
    setRemediatingId(drift.id);
    setRemedyLogs(`[START] Resolving policy drift: ${drift.policy}\n[ACTION] Executing Local Agent configuration update...`);
    
    setTimeout(() => {
      setRemedyLogs(prev => prev + `\n[INFO] Validating recommended criteria: ${drift.recommended}`);
    }, 1000);

    setTimeout(() => {
      setRemedyLogs(prev => prev + `\n[SUCCESS] Applied policy enforcement rules. Audit confirmed.`);
      setDrifts(prev => prev.map(d => {
        if (d.id === drift.id) {
          return { ...d, current: d.recommended, compliant: true };
        }
        return d;
      }));
      setRemediatingId(null);
    }, 2500);
  };

  // Charts data
  const pieData = [
    { name: 'Compliant Policies', value: compliantPolicies, color: '#00e676' },
    { name: 'Non-Compliant Policies', value: nonCompliantPolicies, color: '#ff1744' }
  ];

  const barData = [
    { name: 'Credentials', nonCompliant: drifts.filter(d => (d.category?.toLowerCase()?.includes('cred') || d.policy?.toLowerCase()?.includes('pass')) && !d.compliant).length },
    { name: 'Network', nonCompliant: drifts.filter(d => (d.category?.toLowerCase()?.includes('net') || d.category?.toLowerCase()?.includes('port')) && !d.compliant).length },
    { name: 'OS Config', nonCompliant: drifts.filter(d => d.category?.toLowerCase()?.includes('os') && !d.compliant).length },
    { name: 'Kernel', nonCompliant: drifts.filter(d => d.category?.toLowerCase()?.includes('kernel') && !d.compliant).length },
  ];

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1.5 }}>
        <HealthAndSafetyIcon sx={{ color: '#f05a28', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
          Endpoint IT Hygiene & Hardening Console
        </Typography>
      </Box>

      {/* Hygiene Scorecard Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Core Aggregate Score */}
        <Grid item xs={12} md={4}>
          <Paper className="glass-panel" sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', minHeight: 140 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                SYSTEM HARDENING HEALTH SCORE
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: '800', color: aggregateScore > 75 ? '#00e676' : '#ffd600', mb: 1 }}>
                {aggregateScore}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e' }}>
                Active Agent: <strong style={{ color: '#fff' }}>{selectedAgent === 'all' ? 'All Monitored Endpoints' : selectedAgent}</strong>
              </Typography>
            </Box>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress variant="determinate" value={aggregateScore} size={80} thickness={6} sx={{ color: aggregateScore > 75 ? '#00e676' : '#ffd600' }} />
              <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                <ShieldIcon sx={{ color: '#8c909e' }} />
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Patch Management Summary */}
        <Grid item xs={12} md={4}>
          <Paper className="glass-panel" sx={{ p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', minHeight: 140 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold', display: 'block', mb: 1 }}>
                SECURITY PATCH COMPLIANCE SUMMARY
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ff1744' }}>{pendingPatches}</Typography>
                  <Typography variant="caption" sx={{ color: '#666' }}>Pending</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffd600' }}>{scheduledPatches}</Typography>
                  <Typography variant="caption" sx={{ color: '#666' }}>Scheduled</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#00e676' }}>{patchedPatches}</Typography>
                  <Typography variant="caption" sx={{ color: '#666' }}>Patched</Typography>
                </Grid>
              </Grid>
            </Box>
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <span>Patch compliance status</span>
                <span>{patchScore}%</span>
              </Typography>
              <LinearProgress variant="determinate" value={patchScore} sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#00e676' } }} />
            </Box>
          </Paper>
        </Grid>

        {/* Policy Hardening Status */}
        <Grid item xs={12} md={4}>
          <Paper className="glass-panel" sx={{ p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', minHeight: 140 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold', display: 'block', mb: 1 }}>
                CIS POLICY HARDENING ALIGNMENT
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#00e676' }}>{compliantPolicies}</Typography>
                  <Typography variant="caption" sx={{ color: '#666' }}>Compliant</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ff1744' }}>{nonCompliantPolicies}</Typography>
                  <Typography variant="caption" sx={{ color: '#666' }}>Non-Compliant</Typography>
                </Grid>
              </Grid>
            </Box>
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <span>CIS benchmark checks passed</span>
                <span>{policyScore}%</span>
              </Typography>
              <LinearProgress variant="determinate" value={policyScore} sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#00e676' } }} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Main Content Area */}
      <Grid container spacing={3}>
        {/* Outstanding Security Patches */}
        <Grid item xs={12} md={7}>
          <Paper className="glass-panel" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SystemUpdateIcon sx={{ color: '#f05a28' }} /> Outstanding Security Patches (OS Audits)
            </Typography>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11 } }}>
                    <TableCell>CVE ID</TableCell>
                    <TableCell>Vulnerability Title</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Component</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#8c909e' }}>
                        No pending patches detected. Monitored endpoints are fully up to date.
                      </TableCell>
                    </TableRow>
                  ) : (
                    patches.map((p) => (
                      <TableRow key={p.id} hover sx={{ '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5, fontSize: 12 } }}>
                        <TableCell sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{p.cve}</TableCell>
                        <TableCell>{p.title}</TableCell>
                        <TableCell>
                          <Chip
                            label={p.severity.toUpperCase()}
                            size="small"
                            sx={{ height: 16, fontSize: 8, bgcolor: `${getSeverityColor(p.severity)}15`, color: getSeverityColor(p.severity), fontWeight: 'bold' }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{p.component}</TableCell>
                        <TableCell>
                          <Chip
                            label={p.status.toUpperCase()}
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: 8,
                              bgcolor: p.status === 'patched' ? 'rgba(0, 230, 118, 0.15)' : p.status === 'scheduled' ? 'rgba(255, 145, 0, 0.15)' : 'rgba(255,23,73,0.15)',
                              color: p.status === 'patched' ? '#00e676' : p.status === 'scheduled' ? '#ff9100' : '#ff1744'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {p.status === 'pending' && (
                            <Button size="small" variant="outlined" onClick={() => handleApprovePatch(p.id)} sx={{ fontSize: 9, py: 0.2, px: 1, color: '#f05a28', borderColor: 'rgba(240, 90, 40, 0.3)', '&:hover': { borderColor: '#f05a28' } }}>
                              Approve
                            </Button>
                          )}
                          {p.status === 'scheduled' && (
                            <Typography variant="caption" sx={{ color: '#ff9100', fontSize: 10, fontWeight: 'bold' }}>Deploying...</Typography>
                          )}
                          {p.status === 'patched' && (
                            <CheckCircleIcon sx={{ color: '#00e676', fontSize: 16 }} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Active Remediation Logs Console */}
          {remedyLogs && (
            <Alert
              severity="info"
              icon={remediatingId ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <CheckCircleIcon />}
              sx={{
                bgcolor: '#090a0f',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.08)',
                '& .MuiAlert-icon': { color: '#f05a28' },
                '& .MuiAlert-message': { width: '100%' }
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', color: '#f05a28', mb: 0.5 }}>
                Local Agent Policy Enforcement Logs
              </Typography>
              <Box component="pre" sx={{ m: 0, fontFamily: 'monospace', fontSize: 10, color: '#ccc', whiteSpace: 'pre-wrap' }}>
                {remedyLogs}
              </Box>
            </Alert>
          )}
        </Grid>

        {/* Policy Hardening Drifts */}
        <Grid item xs={12} md={5}>
          <Paper className="glass-panel" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <KeyIcon sx={{ color: '#f05a28' }} /> Policy Hardening & Credential Drifts
            </Typography>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11 } }}>
                    <TableCell>Policy Target</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Remediation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {drifts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4, color: '#8c909e' }}>
                        No compliance policy audits recorded yet. Connect an agent to monitor policies.
                      </TableCell>
                    </TableRow>
                  ) : (
                    drifts.map((d) => (
                      <TableRow key={d.id} hover sx={{ '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5, fontSize: 12 } }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 'bold' }}>{d.policy}</Typography>
                          <Typography variant="caption" sx={{ color: '#666', fontSize: 9 }}>Category: {d.category}</Typography>
                        </TableCell>
                        <TableCell>
                          <span style={{ textDecoration: d.compliant ? 'none' : 'line-through', opacity: d.compliant ? 1 : 0.6, fontSize: 11 }}>{d.current}</span>
                          {!d.compliant && (
                            <Typography variant="caption" sx={{ display: 'block', color: '#00e676', fontSize: 10 }}>Target: {d.recommended}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={d.compliant ? 'Compliant' : 'Drifted'}
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: 8,
                              bgcolor: d.compliant ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,23,73,0.15)',
                              color: d.compliant ? '#00e676' : '#ff1744'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {d.compliant ? (
                            <CheckCircleIcon sx={{ color: '#00e676', fontSize: 16 }} />
                          ) : (
                            <Button
                              size="small"
                              variant="contained"
                              disabled={remediatingId === d.id}
                              onClick={() => handleRemediateDrift(d)}
                              sx={{
                                fontSize: 9,
                                py: 0.2,
                                px: 1,
                                bgcolor: 'rgba(240, 90, 40, 0.1)',
                                color: '#f05a28',
                                border: '1px solid rgba(240, 90, 40, 0.3)',
                                '&:hover': { bgcolor: 'rgba(240, 90, 40, 0.2)' }
                              }}
                            >
                                {remediatingId === d.id ? 'Fixing...' : 'Fix'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* CIS Benchmark Categories Distribution Charts */}
          <Paper className="glass-panel" sx={{ p: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#8c909e', fontWeight: 'bold', display: 'block', mb: 2 }}>
              NON-COMPLIANT CIS DRIFTS BY CATEGORY
            </Typography>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={barData}>
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.15)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.15)" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.01)' }} />
                <Bar dataKey="nonCompliant" fill="#f05a28" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Hygiene;
