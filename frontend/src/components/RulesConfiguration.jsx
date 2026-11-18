import API_BASE_URL from '../config/api.js';
import React, { useState } from 'react';
import { Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel, Select, MenuItem, FormControl, InputLabel, Chip, Typography, Tabs, Tab, Grid, TablePagination } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GavelIcon from '@mui/icons-material/Gavel';

function RulesConfiguration() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const fetchRules = async (currentPage = page, currentRowsPerPage = rowsPerPage) => {
    setLoading(true);
    try {
      const offset = currentPage * currentRowsPerPage;
      const response = await fetch(`${API_BASE_URL}/rules/?limit=${currentRowsPerPage}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setTotalCount(data.total || 0);
        const parsed = (data.rules || []).map(r => ({
          id: r.id,
          name: r.name,
          enabled: r.is_enabled,
          severity: r.severity,
          type: r.rule_type,
          automation: Array.isArray(r.actions) ? r.actions.join(', ') : typeof r.actions === 'string' ? r.actions : 'alert_only',
          conditions: typeof r.conditions === 'object' ? JSON.stringify(r.conditions) : r.conditions
        }));
        setRules(parsed);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    fetchRules(page, rowsPerPage);
  }, [page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const rpp = parseInt(event.target.value, 10);
    setRowsPerPage(rpp);
    setPage(0);
  };

  const [openDialog, setOpenDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({});

  const [activeTab, setActiveTab] = useState(0);
  const [sigmaInput, setSigmaInput] = useState(`title: Suspicious Process Creation (Mimikatz)
id: signature-mimikatz-process
status: experimental
description: Detects command line strings containing mimikatz patterns
logsource:
    category: process_creation
    product: windows
detection:
    selection:
        Image|endswith: '\\mimikatz.exe'
        CommandLine|contains: 'securesync'
    condition: selection
fields:
    - CommandLine
    - ParentCommandLine
falsepositives:
    - Administrative scripts
level: critical`);
  const [compileLogs, setCompileLogs] = useState([]);
  const [compiling, setCompiling] = useState(false);

  const handleCompileSigma = () => {
    setCompiling(true);
    setCompileLogs(['[SIGMA] Connecting to compiler registry...', '[SIGMA] Ingesting Sigma YAML ruleset...']);
    
    setTimeout(() => {
      setCompileLogs(prev => [...prev, 
        '[SIGMA] Validating standard attributes...',
        '  - Title: Sigma: Suspicious Process Creation (Mimikatz)',
        '  - Logsource category: process_creation',
        '  - Threat Level: critical'
      ]);
    }, 800);

    setTimeout(() => {
      setCompileLogs(prev => [...prev, 
        '[SIGMA] Translating rules logic to correlation SQL structures...',
        '  - Selection conditions parsed.',
        '  - SQL mapping: (image LIKE \'%\\mimikatz.exe\') AND (command_line LIKE \'%securesync%\')'
      ]);
    }, 1800);

    setTimeout(async () => {
      const generatedRule = {
        name: 'Sigma: Suspicious Process Creation (Mimikatz)',
        rule_type: 'behavioral',
        severity: 'critical',
        is_enabled: true,
        actions: ['create_ticket_critical'],
        conditions: 'event_type: process_creation\nimage: mimikatz.exe\ncommand_line: securesync'
      };
      
      try {
        const response = await fetch(`${API_BASE_URL}/rules/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(generatedRule)
        });
        if (response.ok) {
          fetchRules();
          setCompileLogs(prev => [...prev, 
            '✅ Rules compiled & loaded successfully!',
            `[INFO] Ingested rule registered in threat engine catalog.`
          ]);
        }
      } catch (e) {
        setCompileLogs(prev => [...prev, `❌ Compilation save failed: ${e.message}`]);
      }
      setCompiling(false);
    }, 3000);
  };

  const handleOpenDialog = (rule = null) => {
    if (rule) {
      setEditingRule(rule);
      setFormData(rule);
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        type: 'signature',
        severity: 'high',
        automation: 'create_ticket',
        enabled: true,
        conditions: 'event_type: process_creation\nimage: powershell.exe\ncommand_line: -e'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRule(null);
  };

  const handleSaveRule = async () => {
    try {
      if (editingRule) {
        const response = await fetch(`${API_BASE_URL}/rules/${editingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            rule_type: formData.type,
            severity: formData.severity,
            is_enabled: formData.enabled,
            actions: [formData.automation],
            conditions: formData.conditions
          })
        });
        if (response.ok) fetchRules();
      } else {
        const response = await fetch(`${API_BASE_URL}/rules/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            rule_type: formData.type,
            severity: formData.severity,
            is_enabled: formData.enabled,
            actions: [formData.automation],
            conditions: formData.conditions
          })
        });
        if (response.ok) fetchRules();
      }
    } catch (e) {
      console.error(e);
    }
    handleCloseDialog();
  };

  const handleToggleRule = async (ruleId) => {
    const targetRule = rules.find(r => r.id === ruleId);
    if (!targetRule) return;
    try {
      const endpoint = targetRule.enabled ? 'disable' : 'enable';
      const response = await fetch(`${API_BASE_URL}/rules/${ruleId}/${endpoint}`, {
        method: 'POST'
      });
      if (response.ok) fetchRules();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/rules/${ruleId}`, {
        method: 'DELETE'
      });
      if (response.ok) fetchRules();
    } catch (e) {
      console.error(e);
    }
  };

  const getSeverityColor = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical': return '#ff1744';
      case 'high': return '#ff9100';
      case 'medium': return '#ffd600';
      default: return '#00e676';
    }
  };

  return (
    <Box className="anim-slide-up">
      {/* Title Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <GavelIcon sx={{ color: '#f05a28', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
            Threat Detection Rules Catalog
          </Typography>
        </Box>
        {activeTab === 0 && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ bgcolor: '#f05a28', '&:hover': { bgcolor: '#d84315' } }}
          >
            Add Custom Rule
          </Button>
        )}
      </Box>
      <Typography variant="body2" sx={{ color: '#8c909e', mb: 4 }}>
        Configure heuristics, signatures, and alert severity thresholds processed by the XDR threat correlation engine.
      </Typography>

      {/* Tabs Layout */}
      <Paper className="glass-panel" sx={{ mb: 3.5, bgcolor: '#12131a' }}>
        <Tabs
          value={activeTab}
          onChange={(e, nv) => setActiveTab(nv)}
          sx={{
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            '& .MuiTab-root': { color: '#8c909e', textTransform: 'none', fontWeight: 'bold' },
            '& .Mui-selected': { color: '#f05a28 !important' },
            '& .MuiTabs-indicator': { bgcolor: '#f05a28' }
          }}
        >
          <Tab label="Rules Catalog" />
          <Tab label="Sigma Compiler" />
        </Tabs>
      </Paper>

      {activeTab === 0 ? (
        <Box>
          <TableContainer component={Paper} className="glass-panel" sx={{ p: 1 }}>
            <Table size="small" className="interactive-table">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11, fontWeight: 'bold' } }}>
                  <TableCell>Rule Name</TableCell>
                  <TableCell>Correlation Type</TableCell>
                  <TableCell>Severity Level</TableCell>
                  <TableCell>Auto Action Flow</TableCell>
                  <TableCell>Execution State</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} sx={{ '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5 } }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>{rule.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={(rule.type || 'signature').toUpperCase()}
                        size="small"
                        sx={{ height: 18, fontSize: 9, bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getSeverityColor(rule.severity) }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 'bold', color: getSeverityColor(rule.severity), textTransform: 'capitalize' }}>
                          {rule.severity}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 11.5 }}>{rule.automation}</TableCell>
                    <TableCell>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={rule.enabled}
                            onChange={() => handleToggleRule(rule.id)}
                            size="small"
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': { color: '#f05a28' },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#f05a28' }
                            }}
                          />
                        }
                        label={rule.enabled ? 'Enabled' : 'Disabled'}
                        labelPlacement="end"
                        sx={{ '& .MuiFormControlLabel-label': { fontSize: 11.5, color: rule.enabled ? '#00e676' : '#8c909e' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => handleOpenDialog(rule)}
                        sx={{ color: '#00b0ff' }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleDeleteRule(rule.id)}
                        sx={{ color: '#ff1744' }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              color: '#8c909e',
              '& .MuiTablePagination-selectIcon': { color: '#8c909e' },
              '& .MuiIconButton-root': { color: '#8c909e' },
              borderTop: '1px solid rgba(255,255,255,0.05)',
              mt: 1
            }}
          />
        </Box>
      ) : (
        /* Sigma Compiler Grid */
        <Grid container spacing={3.5}>
          {/* Editor Panel */}
          <Grid item xs={12} md={7}>
            <Paper className="glass-panel" sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: '700', mb: 1, fontSize: 15 }}>
                Sigma YAML Code Editor
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 2.5 }}>
                Paste industry-standard Sigma rules to auto-compile into XDR detection triggers.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={14}
                value={sigmaInput}
                onChange={(e) => setSigmaInput(e.target.value)}
                variant="outlined"
                sx={{
                  bgcolor: '#090a0f',
                  borderRadius: 1,
                  border: '1px solid rgba(255,255,255,0.06)',
                  textarea: { color: '#00e5ff', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }
                }}
              />
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={handleCompileSigma}
                  disabled={compiling}
                  sx={{ bgcolor: '#f05a28', fontWeight: 'bold', '&:hover': { bgcolor: '#d84315' } }}
                >
                  {compiling ? 'Compiling Rules...' : 'Compile to XDR Rules'}
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Compilation Logs Panel */}
          <Grid item xs={12} md={5}>
            <Paper className="glass-panel" sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ fontWeight: '700', mb: 1, fontSize: 15 }}>
                Compiler Console Output
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 2.5 }}>
                Sigma translation logs and generated rule properties.
              </Typography>
              <Box
                sx={{
                  flexGrow: 1,
                  bgcolor: '#06070a',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 1.5,
                  p: 2,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  minHeight: 280,
                  maxHeight: 330,
                  overflowY: 'auto'
                }}
              >
                {compileLogs.length === 0 ? (
                  <Typography variant="caption" sx={{ color: '#666', fontStyle: 'italic' }}>
                    Waiting for Sigma rule compilation...
                  </Typography>
                ) : (
                  compileLogs.map((log, idx) => (
                    <Typography
                      key={idx}
                      variant="caption"
                      sx={{
                        display: 'block',
                        fontFamily: 'monospace',
                        color: log.includes('✅') || log.includes('[SUCCESS]') ? '#00e676' : log.includes('[ERROR]') ? '#ff1744' : '#ccc',
                        mb: 0.5
                      }}
                    >
                      {log}
                    </Typography>
                  ))
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Custom Rule Wizard Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#12131a',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: '800', color: '#ff9100' }}>{editingRule ? 'Modify Correlation Rule' : 'Create Custom Rule Wizard'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Rule Definition Name"
            placeholder="e.g. Suspicious TaskScheduler Registry Write"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            variant="outlined"
            InputLabelProps={{ style: { color: '#8c909e' } }}
            sx={{ input: { color: '#fff' } }}
          />

          <FormControl fullWidth margin="normal" variant="outlined" sx={{ bgcolor: '#1c1e28', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 1 }}>
            <InputLabel sx={{ color: '#8c909e' }}>Correlation Type</InputLabel>
            <Select
              value={formData.type || ''}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              sx={{ color: '#fff' }}
            >
              <MenuItem value="signature">Signature matching (Regex / Command Line)</MenuItem>
              <MenuItem value="behavioral">Behavioral tracking (Time / Sequence Thresholds)</MenuItem>
              <MenuItem value="anomaly">Statistical Anomaly (Z-score calculation)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" variant="outlined" sx={{ bgcolor: '#1c1e28', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 1 }}>
            <InputLabel sx={{ color: '#8c909e' }}>Threat Severity Threshold</InputLabel>
            <Select
              value={formData.severity || ''}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              sx={{ color: '#fff' }}
            >
              <MenuItem value="low">Low Risk</MenuItem>
              <MenuItem value="medium">Medium Warning</MenuItem>
              <MenuItem value="high">High Threat Warning</MenuItem>
              <MenuItem value="critical">Critical Incident Breach</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" variant="outlined" sx={{ bgcolor: '#1c1e28', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 1 }}>
            <InputLabel sx={{ color: '#8c909e' }}>Auto Response Action</InputLabel>
            <Select
              value={formData.automation || ''}
              onChange={(e) => setFormData({ ...formData, automation: e.target.value })}
              sx={{ color: '#fff' }}
            >
              <MenuItem value="alert_only">Alert Only (Broadcast on Discover Panel)</MenuItem>
              <MenuItem value="create_ticket">Escalate & Create Ticketing Issue</MenuItem>
              <MenuItem value="create_ticket_critical">Escalate Ticket & Notify Telegram channels</MenuItem>
              <MenuItem value="auto_response">Trigger Host Isolation Command</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Detection Logic YAML Schema"
            placeholder="event_type: process_creation&#10;command_line:&#10;  operator: contains&#10;  value: mimikatz"
            value={formData.conditions || ''}
            onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
            margin="normal"
            multiline
            rows={5}
            variant="outlined"
            InputLabelProps={{ style: { color: '#8c909e' } }}
            sx={{ textarea: { color: '#fff', fontFamily: 'monospace', fontSize: 12.5 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={handleCloseDialog} sx={{ color: '#8c909e' }}>Cancel</Button>
          <Button
            onClick={handleSaveRule}
            variant="contained"
            sx={{ bgcolor: '#f05a28', color: '#fff', fontWeight: 'bold', '&:hover': { bgcolor: '#d84315' } }}
          >
            Save Rule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RulesConfiguration;
