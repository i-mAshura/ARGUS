import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Card, CardContent, Chip, Tooltip, ToggleButtonGroup, ToggleButton, LinearProgress } from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import GridOnIcon from '@mui/icons-material/GridOn';
import ListAltIcon from '@mui/icons-material/ListAlt';

const TACTICS_DATA = [
  {
    name: 'Initial Access',
    techniques: [
      { id: 'T1190', name: 'Exploit Public-Facing App' },
      { id: 'T1566', name: 'Phishing' },
      { id: 'T1133', name: 'External Remote Services' },
      { id: 'T1078', name: 'Valid Accounts' }
    ]
  },
  {
    name: 'Execution',
    techniques: [
      { id: 'T1059', name: 'Command & Scripting Interpreter' },
      { id: 'T1204', name: 'User Execution' },
      { id: 'T1047', name: 'Windows Management Instrumentation' },
      { id: 'T1569', name: 'System Services' }
    ]
  },
  {
    name: 'Persistence',
    techniques: [
      { id: 'T1547', name: 'Boot or Logon Autostart Execution' },
      { id: 'T1543', name: 'Create or Modify System Process' },
      { id: 'T1078', name: 'Valid Accounts' },
      { id: 'T1136', name: 'Create Account' }
    ]
  },
  {
    name: 'Privilege Escalation',
    techniques: [
      { id: 'T1548', name: 'Abuse Elevation Control Mechanism' },
      { id: 'T1055', name: 'Process Injection' },
      { id: 'T1068', name: 'Exploitation for Privilege Escalation' },
      { id: 'T1053', name: 'Scheduled Task/Job' }
    ]
  },
  {
    name: 'Defense Evasion',
    techniques: [
      { id: 'T1027', name: 'Obfuscated Files or Information' },
      { id: 'T1140', name: 'Deobfuscate/Decode Files or Info' },
      { id: 'T1036', name: 'Masquerading' },
      { id: 'T1070', name: 'Indicator Removal' }
    ]
  },
  {
    name: 'Credential Access',
    techniques: [
      { id: 'T1003', name: 'OS Credential Dumping' },
      { id: 'T1555', name: 'Credentials from Password Stores' },
      { id: 'T1110', name: 'Brute Force' },
      { id: 'T1539', name: 'Steal Web Session Cookie' }
    ]
  },
  {
    name: 'Lateral Movement',
    techniques: [
      { id: 'T1021', name: 'Remote Services' },
      { id: 'T1570', name: 'Lateral Tool Transfer' },
      { id: 'T1550', name: 'Use Alternate Authentication Material' }
    ]
  },
  {
    name: 'Command & Control',
    techniques: [
      { id: 'T1071', name: 'Application Layer Protocol' },
      { id: 'T1105', name: 'Ingress Tool Transfer' },
      { id: 'T1573', name: 'Encrypted Channel' }
    ]
  },
  {
    name: 'Exfiltration',
    techniques: [
      { id: 'T1020', name: 'Automated Exfiltration' },
      { id: 'T1041', name: 'Exfiltration Over C2 Channel' },
      { id: 'T1030', name: 'Data Transfer Limits' }
    ]
  }
];

function Mitre() {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [mitreStats, setMitreStats] = useState({});
  const [selectedTechnique, setSelectedTechnique] = useState(null);
  const [viewMode, setViewMode] = useState('matrix');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/alerts/?limit=100`);
        if (response.ok) {
          const data = await response.json();
          setActiveAlerts(data.alerts || []);
        }
      } catch (err) {
        console.error("Failed to fetch alerts for MITRE matrix:", err);
      }
      setLoading(false);
    };
    fetchAlerts();
  }, []);

  useEffect(() => {
    const stats = {};
    activeAlerts.forEach(alert => {
      const techniques = alert.mitre_techniques || [];
      techniques.forEach(tech => {
        const cleanTech = tech.split('.')[0];
        stats[cleanTech] = (stats[cleanTech] || 0) + 1;
      });
      const titleLower = (alert.title || '').toLowerCase();
      const descLower = (alert.description || '').toLowerCase();
      if (titleLower.includes('mimikatz') || descLower.includes('mimikatz')) stats['T1003'] = (stats['T1003'] || 0) + 1;
      if (titleLower.includes('obfusc') || descLower.includes('obfusc')) stats['T1027'] = (stats['T1027'] || 0) + 1;
      if (titleLower.includes('certutil') || descLower.includes('certutil')) stats['T1140'] = (stats['T1140'] || 0) + 1;
      if (titleLower.includes('psexec') || descLower.includes('psexec') || titleLower.includes('lateral')) stats['T1570'] = (stats['T1570'] || 0) + 1;
      if (titleLower.includes('registry') || titleLower.includes('persistence')) stats['T1547'] = (stats['T1547'] || 0) + 1;
    });

    setMitreStats(stats);
  }, [activeAlerts]);

  const getTechniqueSeverity = (techId) => {
    const count = mitreStats[techId] || 0;
    if (count === 0) return 'none';
    if (count > 3) return 'critical';
    if (count > 1) return 'high';
    return 'medium';
  };

  const getBgColor = (severity) => {
    switch (severity) {
      case 'critical': return 'rgba(255, 23, 73, 0.25)';
      case 'high': return 'rgba(255, 145, 0, 0.25)';
      case 'medium': return 'rgba(255, 214, 0, 0.2)';
      default: return '#12131a';
    }
  };

  const getBorderColor = (severity) => {
    switch (severity) {
      case 'critical': return '#ff1744';
      case 'high': return '#ff9100';
      case 'medium': return '#ffd600';
      default: return 'rgba(255,255,255,0.06)';
    }
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      {loading && <LinearProgress sx={{ mb: 2, bgcolor: '#1b1e27', '& .MuiLinearProgress-bar': { bgcolor: '#f05a28' } }} />}
      
      {/* Title & View Toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ShieldIcon sx={{ color: '#f05a28', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
            MITRE ATT&CK® Navigator Matrix
          </Typography>
        </Box>
        
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, next) => next && setViewMode(next)}
          size="small"
          sx={{ border: '1px solid rgba(255,255,255,0.08)', bgcolor: '#12131a' }}
        >
          <ToggleButton value="matrix" sx={{ color: '#8c909e', '&.Mui-selected': { color: '#f05a28', bgcolor: 'rgba(240,90,40,0.1)' } }}>
            <GridOnIcon sx={{ mr: 1, fontSize: 16 }} /> Heatmap Grid
          </ToggleButton>
          <ToggleButton value="list" sx={{ color: '#8c909e', '&.Mui-selected': { color: '#f05a28', bgcolor: 'rgba(240,90,40,0.1)' } }}>
            <ListAltIcon sx={{ mr: 1, fontSize: 16 }} /> Tactic Rank List
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* KPI Stats */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card className="glass-panel" sx={{ borderLeft: '4px solid #ff1744' }}>
            <CardContent>
              <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>Critical Techniques Active</Typography>
              <Typography variant="h4" color="#ff1744" sx={{ fontWeight: '800', mt: 1 }}>
                {Object.keys(mitreStats).filter(k => getTechniqueSeverity(k) === 'critical').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card className="glass-panel" sx={{ borderLeft: '4px solid #ff9100' }}>
            <CardContent>
              <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>High Techniques Active</Typography>
              <Typography variant="h4" color="#ff9100" sx={{ fontWeight: '800', mt: 1 }}>
                {Object.keys(mitreStats).filter(k => getTechniqueSeverity(k) === 'high').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card className="glass-panel" sx={{ borderLeft: '4px solid #ffd600' }}>
            <CardContent>
              <Typography color="#8c909e" variant="subtitle2" sx={{ fontSize: 12 }}>Overall Coverages</Typography>
              <Typography variant="h4" color="#ffd600" sx={{ fontWeight: '800', mt: 1 }}>
                {TACTICS_DATA.filter(t => t.techniques.some(tech => (mitreStats[tech.id] || 0) > 0)).length} / 9 Tactics
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Conditional View Renders */}
      {viewMode === 'matrix' ? (
        <Box sx={{ overflowX: 'auto', pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, minWidth: 1200 }}>
            {TACTICS_DATA.map((tactic, idx) => {
              const hasMatches = tactic.techniques.some(tech => (mitreStats[tech.id] || 0) > 0);
              return (
                <Box key={idx} sx={{ flex: 1, minWidth: 160 }}>
                  
                  {/* Tactic Name Card */}
                  <Paper
                    sx={{
                      p: 2,
                      mb: 2,
                      bgcolor: hasMatches ? 'rgba(240, 90, 40, 0.08)' : '#12131a',
                      border: `1px solid ${hasMatches ? 'rgba(240, 90, 40, 0.25)' : 'rgba(255,255,255,0.06)'}`,
                      textAlign: 'center',
                      minHeight: 65,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: 1.5
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: hasMatches ? '#f05a28' : '#e3e4e8', fontSize: 12.5, lineHeight: 1.2 }}>
                      {tactic.name}
                    </Typography>
                  </Paper>

                  {/* Techniques cells list */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                    {tactic.techniques.map((tech) => {
                      const count = mitreStats[tech.id] || 0;
                      const severity = getTechniqueSeverity(tech.id);
                      const isMatched = count > 0;

                      return (
                        <Tooltip
                          key={tech.id}
                          title={`${tech.name} (${tech.id}) - ${count} detection(s) found`}
                          arrow
                          placement="top"
                        >
                          <Box
                            onClick={() => isMatched && setSelectedTechnique({ ...tech, count })}
                            className="mitre-grid-item"
                            sx={{
                              p: 1.5,
                              bgcolor: getBgColor(severity),
                              border: `1px solid ${getBorderColor(severity)}`,
                              borderRadius: '6px',
                              minHeight: 82,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              cursor: isMatched ? 'pointer' : 'default',
                              transition: 'all 0.25s',
                              boxShadow: isMatched ? `0 0 15px ${getBorderColor(severity)}15` : 'none',
                              '&:hover': isMatched ? {
                                transform: 'translateY(-3px)',
                                boxShadow: `0 4px 15px ${getBorderColor(severity)}35`,
                                filter: 'brightness(1.15)'
                              } : {}
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                              <Typography variant="caption" sx={{ color: isMatched ? '#fff' : '#8c909e', fontWeight: '800', fontSize: 9.5 }}>
                                {tech.id}
                              </Typography>
                              {isMatched && (
                                <Chip
                                  label={count}
                                  size="small"
                                  sx={{
                                    height: 15,
                                    fontSize: 9,
                                    fontWeight: '800',
                                    bgcolor: severity === 'critical' ? '#ff1744' : severity === 'high' ? '#ff9100' : '#ffd600',
                                    color: '#000',
                                    px: 0.5,
                                    borderRadius: 1
                                  }}
                                />
                              )}
                            </Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: isMatched ? '#fff' : '#8c909e',
                                lineHeight: 1.25,
                                fontSize: 11,
                                fontWeight: isMatched ? 'bold' : 'normal'
                              }}
                            >
                              {tech.name}
                            </Typography>
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </Box>

                </Box>
              );
            })}
          </Box>
        </Box>
      ) : (
        /* Ranked Summary View List */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TACTICS_DATA.map((tactic, idx) => {
            const matches = tactic.techniques.filter(t => (mitreStats[t.id] || 0) > 0);
            if (matches.length === 0) return null;
            return (
              <Paper key={idx} className="glass-panel" sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#f05a28', mb: 2 }}>
                  Tactic: {tactic.name} ({matches.length} matches)
                </Typography>
                <Grid container spacing={2}>
                  {matches.map((tech) => (
                    <Grid item xs={12} sm={6} md={4} key={tech.id}>
                      <Box
                        onClick={() => setSelectedTechnique({ ...tech, count: mitreStats[tech.id] })}
                        sx={{
                          p: 2,
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 1.5,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: '#ff9100' }
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{tech.name}</Typography>
                          <Typography variant="caption" sx={{ color: '#8c909e' }}>Technique: {tech.id}</Typography>
                        </Box>
                        <Chip label={`Hits: ${mitreStats[tech.id]}`} size="small" sx={{ bgcolor: 'rgba(240,90,40,0.1)', color: '#f05a28', fontWeight: 'bold' }} />
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Details Popup Modal */}
      {selectedTechnique && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          onClick={() => setSelectedTechnique(null)}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              bgcolor: '#12131a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              p: 4,
              maxWidth: 520,
              width: '90%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.9)'
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#f05a28', mb: 2 }}>
              MITRE ATT&CK Technique Registry
            </Typography>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              {selectedTechnique.name} ({selectedTechnique.id})
            </Typography>
            <Typography variant="body2" sx={{ color: '#8c909e', mt: 2, mb: 3.5, lineHeight: 1.5 }}>
              Our telemetry collectors captured process injections, autostart configurations, or binaries execution associated with {selectedTechnique.name}. The engine flagged these patterns as anomalies or signature hits.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Chip label="MITRE technique" variant="outlined" size="small" sx={{ color: '#e3e4e8', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Chip label={`Hits detected: ${selectedTechnique.count}`} size="small" sx={{ bgcolor: 'rgba(240,90,40,0.2)', color: '#f05a28', fontWeight: 'bold' }} />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default Mitre;
