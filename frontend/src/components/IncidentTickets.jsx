import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Button, Switch, List, ListItem, ListItemText, ListItemIcon, Divider, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, CircularProgress, IconButton, Alert, Card, Tab, Tabs } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TelegramIcon from '@mui/icons-material/Telegram';
import BoltIcon from '@mui/icons-material/Bolt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import InfoIcon from '@mui/icons-material/Info';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';

function IncidentTickets() {
  const [activeTab, setActiveTab] = useState(0);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [telegramLogs, setTelegramLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);

  // Telegram Config state
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState(null);

  // Ticket Dialogs/Interactions
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  // Create Ticket State
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [newTicketSeverity, setNewTicketSeverity] = useState('medium');
  const [newTicketPriority, setNewTicketPriority] = useState('3');
  const [newTicketAssigned, setNewTicketAssigned] = useState('Unassigned');

  // SOAR Rule Dialog State
  const [openRuleDialog, setOpenRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleAction, setRuleAction] = useState('create_ticket');
  const [rulePriority, setRulePriority] = useState('3');
  const [ruleCriteriaField, setRuleCriteriaField] = useState('severity');
  const [ruleCriteriaOp, setRuleCriteriaOp] = useState('equals');
  const [ruleCriteriaVal, setRuleCriteriaVal] = useState('critical');

  useEffect(() => {
    fetchTickets();
    fetchTelegramConfig();
    fetchTelegramLogs();
    fetchRules();
  }, []);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/tickets`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingTickets(false);
  };

  const fetchTelegramConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/integrations/telegram`);
      if (res.ok) {
        const data = await res.json();
        setTelegramToken(data.telegram_bot_token || '');
        setTelegramChatId(data.telegram_chat_id || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTelegramLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/telegram/logs`);
      if (res.ok) {
        const data = await res.json();
        setTelegramLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingLogs(false);
  };

  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/tickets/automation-rules`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingRules(false);
  };

  // Telegram functions
  const handleSaveTelegram = async () => {
    setSavingTelegram(true);
    setTelegramStatusMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/integrations/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_bot_token: telegramToken,
          telegram_chat_id: telegramChatId
        })
      });
      if (res.ok) {
        setTelegramStatusMsg({ success: true, text: 'Telegram bot settings saved successfully!' });
        fetchTelegramLogs();
      } else {
        setTelegramStatusMsg({ success: false, text: 'Failed to save telegram configuration' });
      }
    } catch (e) {
      setTelegramStatusMsg({ success: false, text: `Error: ${e.message}` });
    }
    setSavingTelegram(false);
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramStatusMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/telegram/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_bot_token: telegramToken,
          telegram_chat_id: telegramChatId
        })
      });
      const data = await res.json();
      if (data.success) {
        setTelegramStatusMsg({ success: true, text: 'Test alert sent successfully! Check your channel.' });
      } else {
        setTelegramStatusMsg({ success: false, text: `Failed: ${data.message}` });
      }
      fetchTelegramLogs();
    } catch (e) {
      setTelegramStatusMsg({ success: false, text: `Error testing connection: ${e.message}` });
    }
    setTestingTelegram(false);
  };

  // Ticket CRUD triggers
  const handleOpenTicketDetails = (ticket) => {
    setSelectedTicket(ticket);
    setOpenDetailDialog(true);
    setNewNoteText('');
  };

  const handleUpdateTicketField = async (ticketId, field, value) => {
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        // Refresh local lists
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, [field]: value } : t));
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket(prev => ({ ...prev, [field]: value }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !selectedTicket) return;
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/tickets/${selectedTicket.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'Analyst',
          note: newNoteText
        })
      });
      if (res.ok) {
        const data = await res.json();
        // Append note to list
        const updatedNotes = [...(selectedTicket.notes || []), data.note];
        setSelectedTicket(prev => ({ ...prev, notes: updatedNotes }));
        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, notes: updatedNotes } : t));
        setNewNoteText('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicketTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTicketTitle,
          description: newTicketDesc,
          severity: newTicketSeverity,
          priority: newTicketPriority,
          status: 'open',
          assigned_to: newTicketAssigned,
          notes: []
        })
      });
      if (res.ok) {
        fetchTickets();
        setOpenCreateDialog(false);
        setNewTicketTitle('');
        setNewTicketDesc('');
        setNewTicketSeverity('medium');
        setNewTicketPriority('3');
        setNewTicketAssigned('Unassigned');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Rule operations
  const handleToggleRule = async (ruleId, enabled) => {
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/tickets/automation-rules/${ruleId}?enabled=${enabled}`, {
        method: 'PUT'
      });
      if (res.ok) {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled } : r));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/tickets/automation-rules/${ruleId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== ruleId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenRuleDialog = (rule = null) => {
    if (rule) {
      setEditingRule(rule);
      setRuleName(rule.name);
      setRuleAction(rule.action);
      setRulePriority(rule.ticket_priority || '3');
      const criteria = rule.conditions?.criteria?.[0] || {};
      setRuleCriteriaField(criteria.field || 'severity');
      setRuleCriteriaOp(criteria.operator || 'equals');
      setRuleCriteriaVal(criteria.value || 'critical');
    } else {
      setEditingRule(null);
      setRuleName('');
      setRuleAction('create_ticket');
      setRulePriority('3');
      setRuleCriteriaField('severity');
      setRuleCriteriaOp('equals');
      setRuleCriteriaVal('critical');
    }
    setOpenRuleDialog(true);
  };

  const handleSaveRule = async () => {
    if (!ruleName.trim()) return;
    const rulePayload = {
      id: editingRule?.id || undefined,
      name: ruleName,
      enabled: editingRule ? editingRule.enabled : true,
      conditions: {
        match_type: 'all',
        criteria: [
          {
            field: ruleCriteriaField,
            operator: ruleCriteriaOp,
            value: ruleCriteriaVal
          }
        ]
      },
      action: ruleAction,
      ticket_priority: rulePriority,
      notify_teams: ['security_team']
    };

    try {
      const res = await fetch(`${API_BASE_URL}/integrations/tickets/automation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rulePayload)
      });
      if (res.ok) {
        fetchRules();
        setOpenRuleDialog(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Get Ticket stats
  const getStats = () => {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'open').length;
    const inProgress = tickets.filter(t => t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    return { total, open, inProgress, resolved };
  };

  const stats = getStats();

  const getPriorityLabel = (p) => {
    switch (p) {
      case '1': return 'P1 - Critical';
      case '2': return 'P2 - High';
      case '3': return 'P3 - Medium';
      case '4': return 'P4 - Low';
      default: return `P${p}`;
    }
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AssignmentIcon sx={{ color: '#f05a28', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
            Incident Tickets & Automation Center
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
          sx={{ bgcolor: '#f05a28', color: '#fff', fontSize: 12, '&:hover': { bgcolor: '#d84e20' } }}
        >
          Create Incident Ticket
        </Button>
      </Box>

      {/* Tabs Menu */}
      <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{
            '& .MuiTabs-indicator': { bgcolor: '#f05a28' },
            '& .MuiTab-root': { color: '#8c909e', fontWeight: 'bold', fontSize: 13, py: 1.5, px: 3, '&.Mui-selected': { color: '#fff' } }
          }}
        >
          <Tab label="Incident Tickets Center" icon={<AssignmentIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label="Telegram Alert Channels" icon={<TelegramIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label="SOAR Playbooks & Automation" icon={<BoltIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Incident Tickets Center Tab */}
      {activeTab === 0 && (
        <Box>
          {/* Stat Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={3}>
              <Card className="glass-panel" sx={{ p: 2.5, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 0.5 }}>Total Tickets</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#fff' }}>{stats.total}</Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card className="glass-panel" sx={{ p: 2.5, textAlign: 'center', borderLeft: '4px solid #ff1744 !important' }}>
                <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 0.5 }}>Open Incidents</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ff1744' }}>{stats.open}</Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card className="glass-panel" sx={{ p: 2.5, textAlign: 'center', borderLeft: '4px solid #ffd600 !important' }}>
                <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 0.5 }}>In Progress</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffd600' }}>{stats.inProgress}</Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card className="glass-panel" sx={{ p: 2.5, textAlign: 'center', borderLeft: '4px solid #00e676 !important' }}>
                <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 0.5 }}>Resolved</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#00e676' }}>{stats.resolved}</Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Tickets List */}
          <Paper className="glass-panel" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Active Incident Logs</Typography>
              <IconButton onClick={fetchTickets} size="small" sx={{ color: '#8c909e' }}><RefreshIcon /></IconButton>
            </Box>

            {loadingTickets ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress color="warning" /></Box>
            ) : tickets.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#8c909e' }}>No tickets registered. Automatically raised SOAR tickets will show up here.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 11, fontWeight: 'bold', py: 1.5 } }}>
                      <TableCell>Ticket ID</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Severity</TableCell>
                      <TableCell>Assignee</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tickets.map((t) => (
                      <TableRow
                        key={t.id}
                        hover
                        sx={{
                          cursor: 'pointer',
                          '& td': { borderBottom: '1px solid rgba(255,255,255,0.06)', py: 1.5, fontSize: 12.5 }
                        }}
                        onClick={() => handleOpenTicketDetails(t)}
                      >
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#f05a28' }}>{t.id}</TableCell>
                        <TableCell sx={{ fontWeight: '600', color: '#fff' }}>{t.title}</TableCell>
                        <TableCell>
                          <Chip
                            label={getPriorityLabel(t.priority)}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: 9,
                              bgcolor: t.priority === '1' ? 'rgba(255,23,73,0.15)' : t.priority === '2' ? 'rgba(255,145,0,0.15)' : 'rgba(255,255,255,0.05)',
                              color: t.priority === '1' ? '#ff1744' : t.priority === '2' ? '#ff9100' : '#8c909e',
                              fontWeight: 'bold'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{t.severity}</TableCell>
                        <TableCell sx={{ color: '#aaa' }}>{t.assigned_to}</TableCell>
                        <TableCell>
                          <Chip
                            label={t.status.toUpperCase().replace('_', ' ')}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: 9,
                              fontWeight: '800',
                              bgcolor: t.status === 'open' ? 'rgba(255,23,73,0.1)' : t.status === 'in_progress' ? 'rgba(255,214,0,0.1)' : 'rgba(0,230,118,0.1)',
                              color: t.status === 'open' ? '#ff1744' : t.status === 'in_progress' ? '#ffd600' : '#00e676',
                              border: `1px solid ${t.status === 'open' ? 'rgba(255,23,73,0.2)' : t.status === 'in_progress' ? 'rgba(255,214,0,0.2)' : 'rgba(0,230,118,0.2)'}`
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ opacity: 0.6 }}>{new Date(t.created_at).toLocaleString()}</TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Button size="small" variant="text" onClick={() => handleOpenTicketDetails(t)} sx={{ color: '#f05a28', fontSize: 11 }}>Investigate</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}

      {/* Telegram Alert Channels Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Telegram Settings form */}
          <Grid item xs={12} md={5}>
            <Paper className="glass-panel" sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                <TelegramIcon sx={{ color: '#229ED9', fontSize: 28 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Telegram Integration config</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 3 }}>
                Configure the security bot to broadcast alerts. Open Telegram and search for <b>BotFather</b> to create a token, and add your group's chat ID.
              </Typography>

              {telegramStatusMsg && (
                <Alert
                  severity={telegramStatusMsg.success ? 'success' : 'error'}
                  sx={{
                    mb: 2.5,
                    bgcolor: telegramStatusMsg.success ? 'rgba(46,125,50,0.1)' : 'rgba(211,47,47,0.1)',
                    color: telegramStatusMsg.success ? '#00e676' : '#ff1744',
                    border: `1px solid ${telegramStatusMsg.success ? '#2e7d32' : '#c62828'}`
                  }}
                >
                  {telegramStatusMsg.text}
                </Alert>
              )}

              <TextField
                fullWidth
                size="small"
                label="Telegram Bot Token"
                placeholder="e.g. 5827394857:AAHd847dhfg..."
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                sx={{
                  mb: 2,
                  input: { color: '#fff', fontSize: 13 },
                  '& .MuiInputLabel-root': { color: '#8c909e' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' }
                }}
              />

              <TextField
                fullWidth
                size="small"
                label="Target Chat ID"
                placeholder="e.g. -10019284729"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                sx={{
                  mb: 3,
                  input: { color: '#fff', fontSize: 13 },
                  '& .MuiInputLabel-root': { color: '#8c909e' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' }
                }}
              />

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleTestTelegram}
                  disabled={testingTelegram || !telegramToken}
                  sx={{ borderColor: 'rgba(255,255,255,0.1)', color: '#fff', '&:hover': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  {testingTelegram ? <CircularProgress size={16} color="inherit" /> : 'Send Test Notification'}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSaveTelegram}
                  disabled={savingTelegram}
                  sx={{ bgcolor: '#f05a28', color: '#fff', '&:hover': { bgcolor: '#d84e20' } }}
                >
                  {savingTelegram ? <CircularProgress size={16} color="inherit" /> : 'Save Parameters'}
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Telegram Console Logs */}
          <Grid item xs={12} md={7}>
            <Paper className="glass-panel" sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Telegram Alert Routing Audit Logs</Typography>
                <IconButton onClick={fetchTelegramLogs} size="small" sx={{ color: '#8c909e' }}><RefreshIcon /></IconButton>
              </Box>

              <Box
                sx={{
                  flexGrow: 1,
                  bgcolor: '#090a0f',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '4px',
                  p: 2,
                  fontFamily: 'monospace',
                  maxHeight: 300,
                  minHeight: 220,
                  overflowY: 'auto'
                }}
              >
                {loadingLogs ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress size={20} color="warning" /></Box>
                ) : telegramLogs.length === 0 ? (
                  <Typography variant="caption" sx={{ color: '#8c909e' }}>No alert routing events captured yet.</Typography>
                ) : (
                  telegramLogs.map((log, idx) => (
                    <Typography
                      key={idx}
                      variant="caption"
                      sx={{
                        display: 'block',
                        mb: 1,
                        color: log.includes('✅') ? '#00e676' : log.includes('🚨') ? '#ff1744' : log.includes('⚠️') ? '#ff9100' : '#8c909e',
                        lineHeight: 1.4
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

      {/* SOAR Playbooks Tab */}
      {activeTab === 2 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <BoltIcon sx={{ color: '#f05a28' }} /> SOAR Automatic Alert Escalation Playbooks
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleOpenRuleDialog()}
              sx={{ borderColor: '#f05a28', color: '#f05a28', '&:hover': { borderColor: '#d84e20', bgcolor: 'rgba(240, 90, 40, 0.05)' } }}
            >
              Add SOAR Rule
            </Button>
          </Box>
          <Typography variant="body2" sx={{ color: '#8c909e', mb: 3 }}>
            Enable or configure automatic action triggers. Playbooks can escalate alerts to incident tickets, isolate compromised endpoints via agents, or notify Telegram.
          </Typography>

          {loadingRules ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress color="warning" /></Box>
          ) : (
            <Grid container spacing={3}>
              {rules.map((rule) => {
                const criteria = rule.conditions?.criteria?.[0] || {};
                return (
                  <Grid item xs={12} md={6} key={rule.id}>
                    <Paper className="glass-panel" sx={{ p: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff' }}>
                          {rule.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Switch
                            size="small"
                            checked={rule.enabled !== false}
                            onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                            color="warning"
                          />
                          <IconButton onClick={() => handleOpenRuleDialog(rule)} size="small" sx={{ color: '#8c909e' }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                          {rule.id.startsWith('auto_') && (
                            <IconButton onClick={() => handleDeleteRule(rule.id)} size="small" sx={{ color: '#ff1744' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                          )}
                        </Box>
                      </Box>
                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#8c909e', width: 70 }}>Trigger:</Typography>
                          <Chip
                            label={`If alert ${criteria.field || 'severity'} ${criteria.operator || 'equals'} '${criteria.value}'`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#ccc', fontSize: 10, height: 20 }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#8c909e', width: 70 }}>Mitigation:</Typography>
                          <Chip
                            label={rule.action.toUpperCase().replace('_', ' ')}
                            size="small"
                            sx={{ bgcolor: 'rgba(240,90,40,0.1)', color: '#f05a28', fontSize: 10, height: 20, fontWeight: 'bold' }}
                          />
                        </Box>
                        {rule.auto_response && (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ color: '#8c909e', width: 70 }}>Endpoint Action:</Typography>
                            <Chip
                              label={rule.auto_response.toUpperCase()}
                              size="small"
                              sx={{ bgcolor: 'rgba(255,23,73,0.1)', color: '#ff1744', fontSize: 10, height: 20, fontWeight: 'bold' }}
                            />
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>
      )}

      {/* Ticket Details Dialog */}
      <Dialog
        open={openDetailDialog}
        onClose={() => setOpenDetailDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Ticket Investigation Board</Typography>
            <Chip label={selectedTicket?.id} size="small" sx={{ bgcolor: 'rgba(240,90,40,0.15)', color: '#f05a28', fontWeight: 'bold' }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField
              select
              size="small"
              value={selectedTicket?.status || 'open'}
              onChange={(e) => handleUpdateTicketField(selectedTicket.id, 'status', e.target.value)}
              sx={{
                width: 140,
                '& .MuiOutlinedInput-root': {
                  color: selectedTicket?.status === 'resolved' ? '#00e676' : selectedTicket?.status === 'in_progress' ? '#ffd600' : '#ff1744',
                  fontSize: 12,
                  fontWeight: 'bold',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
                }
              }}
            >
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </TextField>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={3}>
            {/* Left Side Info */}
            <Grid item xs={12} md={7}>
              <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>Title</Typography>
              <Typography variant="body2" sx={{ color: '#ccc', mb: 3, p: 1.5, bgcolor: '#090a0f', borderRadius: 1 }}>
                {selectedTicket?.title}
              </Typography>

              <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>Description & Alert Details</Typography>
              <Box
                sx={{
                  color: '#ccc',
                  fontSize: 12.5,
                  p: 2,
                  bgcolor: '#090a0f',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 250,
                  overflowY: 'auto'
                }}
              >
                {selectedTicket?.description || 'No description provided.'}
              </Box>
            </Grid>

            {/* Right Side metadata & notes */}
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5 }}>Incident Ownership</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={5}><Typography variant="caption" sx={{ color: '#8c909e' }}>Assignee:</Typography></Grid>
                  <Grid item xs={7}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={selectedTicket?.assigned_to || 'Unassigned'}
                      onChange={(e) => handleUpdateTicketField(selectedTicket.id, 'assigned_to', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-input': { py: 0.5, fontSize: 12, color: '#fff' } }}
                    >
                      <MenuItem value="Unassigned">Unassigned</MenuItem>
                      <MenuItem value="Security Team">Security Team</MenuItem>
                      <MenuItem value="Incident Response">Incident Response</MenuItem>
                      <MenuItem value="Network Operations">Network Ops</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={5}><Typography variant="caption" sx={{ color: '#8c909e' }}>Priority:</Typography></Grid>
                  <Grid item xs={7}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={selectedTicket?.priority || '3'}
                      onChange={(e) => handleUpdateTicketField(selectedTicket.id, 'priority', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-input': { py: 0.5, fontSize: 12, color: '#fff' } }}
                    >
                      <MenuItem value="1">P1 - Critical</MenuItem>
                      <MenuItem value="2">P2 - High</MenuItem>
                      <MenuItem value="3">P3 - Medium</MenuItem>
                      <MenuItem value="4">P4 - Low</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </Paper>

              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Communication & Activity Logs</Typography>
              <Box
                sx={{
                  bgcolor: '#090a0f',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 1,
                  p: 1.5,
                  maxHeight: 200,
                  overflowY: 'auto',
                  mb: 2
                }}
              >
                {(!selectedTicket?.notes || selectedTicket.notes.length === 0) ? (
                  <Typography variant="caption" sx={{ color: '#666', display: 'block', py: 1 }}>No activity logs yet.</Typography>
                ) : (
                  selectedTicket.notes.map((n, idx) => (
                    <Box key={idx} sx={{ mb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.03)', pb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#f05a28', fontWeight: 'bold' }}>{n.user}</Typography>
                        <Typography variant="caption" sx={{ color: '#555' }}>{new Date(n.timestamp).toLocaleTimeString()}</Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#ccc', display: 'block' }}>{n.note}</Typography>
                    </Box>
                  ))
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Add diagnostic update note..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  sx={{ input: { color: '#fff', fontSize: 12 } }}
                />
                <Button variant="contained" onClick={handleAddNote} sx={{ bgcolor: '#f05a28', color: '#fff', '&:hover': { bgcolor: '#d84e20' } }}><SendIcon sx={{ fontSize: 16 }} /></Button>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', p: 2 }}>
          <Button onClick={() => setOpenDetailDialog(false)} sx={{ color: '#8c909e' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Ticket Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => setOpenCreateDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Create New Security Incident Ticket</DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Ticket Subject / Title"
            value={newTicketTitle}
            onChange={(e) => setNewTicketTitle(e.target.value)}
            placeholder="e.g. Unauthorized access attempts detected on web-server-01"
            sx={{ input: { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
          />
          <TextField
            fullWidth
            multiline
            rows={4}
            size="small"
            label="Incident Description"
            value={newTicketDesc}
            onChange={(e) => setNewTicketDesc(e.target.value)}
            placeholder="Provide context, affected IPs, logs and indicators..."
            sx={{ textarea: { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Severity"
                value={newTicketSeverity}
                onChange={(e) => setNewTicketSeverity(e.target.value)}
                sx={{ '& .MuiInputLabel-root': { color: '#8c909e' } }}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Priority"
                value={newTicketPriority}
                onChange={(e) => setNewTicketPriority(e.target.value)}
                sx={{ '& .MuiInputLabel-root': { color: '#8c909e' } }}
              >
                <MenuItem value="1">P1 - Critical</MenuItem>
                <MenuItem value="2">P2 - High</MenuItem>
                <MenuItem value="3">P3 - Medium</MenuItem>
                <MenuItem value="4">P4 - Low</MenuItem>
              </TextField>
            </Grid>
          </Grid>
          <TextField
            select
            fullWidth
            size="small"
            label="Assignee Group"
            value={newTicketAssigned}
            onChange={(e) => setNewTicketAssigned(e.target.value)}
            sx={{ '& .MuiInputLabel-root': { color: '#8c909e' } }}
          >
            <MenuItem value="Unassigned">Unassigned</MenuItem>
            <MenuItem value="Security Team">Security Team</MenuItem>
            <MenuItem value="Incident Response">Incident Response</MenuItem>
            <MenuItem value="Network Operations">Network Ops</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreateDialog(false)} sx={{ color: '#8c909e' }}>Cancel</Button>
          <Button onClick={handleCreateTicket} sx={{ bgcolor: '#f05a28', color: '#fff', '&:hover': { bgcolor: '#d84e20' } }}>Create Ticket</Button>
        </DialogActions>
      </Dialog>

      {/* Create / Edit SOAR Rule Dialog */}
      <Dialog
        open={openRuleDialog}
        onClose={() => setOpenRuleDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>{editingRule ? 'Edit SOAR Rule Configuration' : 'Create Custom SOAR Playbook Trigger'}</DialogTitle>
        <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Rule Name / Playbook Identifier"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="e.g. Escalate high priority FIM alerts"
            sx={{ input: { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
          />

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ff9100' }}>Trigger Condition (Alert match)</Typography>

          <Grid container spacing={2}>
            <Grid item xs={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Alert Field"
                value={ruleCriteriaField}
                onChange={(e) => setRuleCriteriaField(e.target.value)}
                sx={{ '& .MuiInputLabel-root': { color: '#8c909e' } }}
              >
                <MenuItem value="severity">Severity</MenuItem>
                <MenuItem value="detection_type">Detection Type</MenuItem>
                <MenuItem value="mitre_tactics">MITRE Tactic</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Operator"
                value={ruleCriteriaOp}
                onChange={(e) => setRuleCriteriaOp(e.target.value)}
                sx={{ '& .MuiInputLabel-root': { color: '#8c909e' } }}
              >
                <MenuItem value="equals">Equals</MenuItem>
                <MenuItem value="contains">Contains</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                size="small"
                label="Matching Value"
                value={ruleCriteriaVal}
                onChange={(e) => setRuleCriteriaVal(e.target.value)}
                placeholder="e.g. critical, file_integrity, etc."
                sx={{ input: { color: '#fff', fontSize: 13 }, '& .MuiInputLabel-root': { color: '#8c909e' } }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ff9100' }}>Automation Actions</Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Response Action"
                value={ruleAction}
                onChange={(e) => setRuleAction(e.target.value)}
                sx={{ '& .MuiInputLabel-root': { color: '#8c909e' } }}
              >
                <MenuItem value="create_ticket">Create Incident Ticket</MenuItem>
                <MenuItem value="create_ticket_with_response">Isolate Host & Open Ticket</MenuItem>
                <MenuItem value="notify_telegram">Telegram Notification Only</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Escalation Ticket Priority"
                value={rulePriority}
                onChange={(e) => setRulePriority(e.target.value)}
                disabled={ruleAction === 'notify_telegram'}
                sx={{ '& .MuiInputLabel-root': { color: '#8c909e' } }}
              >
                <MenuItem value="1">P1 - Critical</MenuItem>
                <MenuItem value="2">P2 - High</MenuItem>
                <MenuItem value="3">P3 - Medium</MenuItem>
                <MenuItem value="4">P4 - Low</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenRuleDialog(false)} sx={{ color: '#8c909e' }}>Cancel</Button>
          <Button onClick={handleSaveRule} sx={{ bgcolor: '#f05a28', color: '#fff', '&:hover': { bgcolor: '#d84e20' } }}>Save Rule</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default IncidentTickets;
