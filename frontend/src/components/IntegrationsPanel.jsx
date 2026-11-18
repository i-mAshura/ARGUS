import API_BASE_URL from '../config/api.js';
import React, { useState } from 'react';
import { Box, Button, Card, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, CircularProgress, Chip, Typography, Grid } from '@mui/material';
import CableIcon from '@mui/icons-material/Cable';

function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState([
    {
      id: 'jira',
      name: 'Jira Software',
      status: 'not_configured',
      icon: '🎫',
      description: 'Create issues and escalation tickets in Jira workflows dynamically.'
    },
    {
      id: 'servicenow',
      name: 'ServiceNow',
      status: 'not_configured',
      icon: '🔔',
      description: 'Escalate threat responses to ServiceNow ITSM incident queues.'
    },
    {
      id: 'agent',
      name: 'ARGUS Cluster',
      status: 'configured',
      icon: '🛡️',
      description: 'Synchronize vulnerability datasets, posture scores, and compliance controls.'
    },
    {
      id: 'telegram',
      name: 'Telegram Messenger',
      status: 'not_configured',
      icon: '💬',
      description: 'Broadcast high-risk threat warnings to security channels in real-time.'
    },
    {
      id: 'virustotal',
      name: 'VirusTotal Threat Intelligence',
      status: 'not_configured',
      icon: '🔍',
      description: 'Enrich threat alerts and FIM file hashes using VirusTotal dynamic queries.'
    }
  ]);

  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  React.useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/integrations`);
      const data = await response.json();
      setIntegrations(prev => prev.map(int => {
        if (data[int.id]) {
          return { ...int, status: data[int.id].status || 'configured' };
        }
        return int;
      }));
    } catch (err) {
      console.error("Failed to load integrations: ", err);
    }
  };

  const handleOpenDialog = async (integration) => {
    setSelectedIntegration(integration);
    setFormData({});
    setTestResult(null);
    setOpenDialog(true);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/integrations/${integration.id}`);
      const data = await response.json();
      if (data && data.status !== 'not_configured') {
        setFormData(data);
      }
    } catch (err) {
      console.error("Error loading config: ", err);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedIntegration(null);
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/integrations/${selectedIntegration.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.message
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: `Failed to perform test connection: ${err.message}`
      });
    }
    setTesting(false);
  };

  const handleSaveIntegration = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/integrations/${selectedIntegration.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setIntegrations(prev => prev.map(int => 
          int.id === selectedIntegration.id ? { ...int, status: 'configured' } : int
        ));
        handleCloseDialog();
      } else {
        alert("Failed to save configuration");
      }
    } catch (err) {
      console.error("Save error: ", err);
    }
  };

  return (
    <Box className="anim-slide-up">
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1.5 }}>
        <CableIcon sx={{ color: '#f05a28', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
          Security Integrations & Connectors
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: '#8c909e', mb: 4 }}>
        Synchronize ARGUS alerts, FIM updates, and vulnerability audits with external ticketing tools and endpoints.
      </Typography>

      <Grid container spacing={3}>
        {integrations.map((integration) => (
          <Grid item xs={12} sm={6} md={3} key={integration.id}>
            <Card
              className="glass-panel"
              sx={{
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderColor: integration.status === 'configured' ? 'rgba(0, 230, 118, 0.2) !important' : 'rgba(255,255,255,0.06)',
                '&:hover': {
                  borderColor: integration.status === 'configured' ? '#00e676 !important' : '#f05a28 !important',
                  transform: 'translateY(-4px)'
                }
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h3" sx={{ fontSize: 32, m: 0 }}>{integration.icon}</Typography>
                  <Chip
                    label={integration.status === 'configured' ? 'ACTIVE' : 'INACTIVE'}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: 8.5,
                      fontWeight: '800',
                      bgcolor: integration.status === 'configured' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255,255,255,0.05)',
                      color: integration.status === 'configured' ? '#00e676' : '#8c909e',
                      border: `1px solid ${integration.status === 'configured' ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.1)'}`
                    }}
                  />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff', mb: 1 }}>{integration.name}</Typography>
                <Typography variant="body2" sx={{ color: '#8c909e', fontSize: 12.5, lineHeight: 1.4 }}>{integration.description}</Typography>
              </Box>
              
              <Button
                variant={integration.status === 'configured' ? 'outlined' : 'contained'}
                fullWidth
                onClick={() => handleOpenDialog(integration)}
                sx={{
                  mt: 3,
                  bgcolor: integration.status === 'configured' ? 'transparent' : '#f05a28',
                  borderColor: integration.status === 'configured' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: '#fff',
                  '&:hover': {
                    bgcolor: integration.status === 'configured' ? 'rgba(255,255,255,0.05)' : '#d84315',
                    borderColor: '#fff'
                  }
                }}
              >
                {integration.status === 'configured' ? 'Manage Connector' : 'Set Up Connection'}
              </Button>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Connection Wizard Modal */}
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
        <DialogTitle sx={{ fontWeight: '800', color: '#ff9100' }}>Configure Integration: {selectedIntegration?.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {testResult && (
            <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 2.5, bgcolor: testResult.success ? 'rgba(46,125,50,0.1)' : 'rgba(211,47,47,0.1)', color: testResult.success ? '#00e676' : '#ff1744', border: `1px solid ${testResult.success ? '#2e7d32' : '#c62828'}` }}>
              {testResult.message}
            </Alert>
          )}

          {/* Render inputs based on active option */}
          {selectedIntegration?.id === 'jira' && (
            <>
              <TextField fullWidth label="Atlassian Domain Instance" placeholder="https://company.atlassian.net" value={formData.jira_url || ''} onChange={(e) => handleInputChange('jira_url', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
              <TextField fullWidth label="Service Account Email" placeholder="xdr-sync@company.com" value={formData.jira_username || ''} onChange={(e) => handleInputChange('jira_username', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
              <TextField fullWidth label="Atlassian API Developer Token" type="password" placeholder="••••••••••••••" value={formData.jira_api_token || ''} onChange={(e) => handleInputChange('jira_api_token', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
            </>
          )}

          {selectedIntegration?.id === 'servicenow' && (
            <>
              <TextField fullWidth label="ServiceNow Instance URL" placeholder="https://dev12345.service-now.com" value={formData.servicenow_url || ''} onChange={(e) => handleInputChange('servicenow_url', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
              <TextField fullWidth label="Integration Username" value={formData.servicenow_username || ''} onChange={(e) => handleInputChange('servicenow_username', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
              <TextField fullWidth label="Integration Account Password" type="password" value={formData.servicenow_password || ''} onChange={(e) => handleInputChange('servicenow_password', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
            </>
          )}

          {selectedIntegration?.id === 'agent' && (
            <>
              <TextField fullWidth label="ARGUS Manager Server API URL" placeholder="https://agent-mgr.company.local:55000" value={formData.agent_host || ''} onChange={(e) => handleInputChange('agent_host', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
              <TextField fullWidth label="ARGUS API User ID" value={formData.agent_username || ''} onChange={(e) => handleInputChange('agent_username', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
              <TextField fullWidth label="ARGUS REST API Password" type="password" value={formData.agent_password || ''} onChange={(e) => handleInputChange('agent_password', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
            </>
          )}

          {selectedIntegration?.id === 'telegram' && (
            <>
              <TextField fullWidth label="Telegram Bot HTTP API Token" placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ" value={formData.telegram_bot_token || ''} onChange={(e) => handleInputChange('telegram_bot_token', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
              <TextField fullWidth label="Recipient Telegram Chat Group ID" placeholder="-100123456789" value={formData.telegram_chat_id || ''} onChange={(e) => handleInputChange('telegram_chat_id', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
            </>
          )}

          {selectedIntegration?.id === 'virustotal' && (
            <>
              <TextField fullWidth label="VirusTotal API v3 Developer Key" placeholder="64-character hex key string" value={formData.api_key || ''} onChange={(e) => handleInputChange('api_key', e.target.value)} margin="normal" variant="outlined" InputLabelProps={{ style: { color: '#8c909e' } }} sx={{ input: { color: '#fff' } }} />
            </>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={handleCloseDialog} sx={{ color: '#8c909e' }}>Cancel</Button>
          <Button
            onClick={handleTestConnection}
            variant="outlined"
            disabled={testing}
            sx={{ color: '#ff9100', borderColor: 'rgba(255, 145, 0, 0.3)', '&:hover': { borderColor: '#ff9100', bgcolor: 'rgba(255,145,0,0.05)' } }}
          >
            {testing ? <CircularProgress size={20} color="inherit" /> : 'Test Authentication'}
          </Button>
          <Button
            onClick={handleSaveIntegration}
            variant="contained"
            sx={{ bgcolor: '#00e676', color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#00c853' } }}
          >
            Enable Connector
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default IntegrationsPanel;
