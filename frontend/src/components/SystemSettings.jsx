import React, { useState } from 'react';
import { Box, Button, Card, Switch, TextField, FormControlLabel, Alert, Divider, Grid, Dialog, DialogTitle, DialogContent, DialogActions, Typography, CircularProgress } from '@mui/material';
import BackupIcon from '@mui/icons-material/Backup';
import SettingsIcon from '@mui/icons-material/Settings';

function SystemSettings() {
  const [settings, setSettings] = useState({
    organization_name: 'Enterprise Security Operations',
    timezone: 'IST',
    language: 'English',
    theme: 'dark',
    detection_batch_size: 500,
    alert_retention_days: 90,
    database_backup_frequency: '24',
    email_notifications_enabled: true,
    sms_notifications_enabled: false,
    event_aggregation_enabled: true,
  });

  const [backupDialog, setBackupDialog] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [licenseInfo] = useState({
    status: 'active',
    tier: 'Enterprise Platinum',
    endpoints_licensed: 100000,
    endpoints_used: 2456,
    expiry_date: '2026-12-31',
    auto_renewal: true
  });

  const handleSettingChange = (key, value) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleSaveSettings = () => {
    // Simulate successful save
    alert('✅ System parameters updated successfully!');
  };

  const handleBackup = () => {
    setBackupStatus('creating');
    setTimeout(() => {
      setBackupStatus({
        success: true,
        message: 'Manual backup archive successfully built and encrypted: argus-backup-2026-06-02.tar.gz'
      });
    }, 1500);
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1.5 }}>
        <SettingsIcon sx={{ color: '#f05a28', fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
          XDR System Configuration
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: '#8c909e', mb: 4 }}>
        Configure database backends, threat telemetry ingestion thresholds, and notifications alerts policies.
      </Typography>

      <Grid container spacing={3.5}>
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
            
            {/* Organization Settings */}
            <Card className="glass-panel" sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff', mb: 2 }}>
                🏢 Tenant Settings
              </Typography>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(255,255,255,0.05)' }} />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Organization Tenant Name"
                    value={settings.organization_name}
                    onChange={(e) => handleSettingChange('organization_name', e.target.value)}
                    variant="outlined"
                    InputLabelProps={{ style: { color: '#8c909e' } }}
                    sx={{ input: { color: '#fff' } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Primary System Timezone"
                    value={settings.timezone}
                    onChange={(e) => handleSettingChange('timezone', e.target.value)}
                    variant="outlined"
                    InputLabelProps={{ style: { color: '#8c909e' } }}
                    sx={{ input: { color: '#fff' } }}
                  />
                </Grid>
              </Grid>
            </Card>

            {/* Ingestion limits */}
            <Card className="glass-panel" sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff', mb: 2 }}>
                🎛️ Telemetry Processing Parameters
              </Typography>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(255,255,255,0.05)' }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Detection Correlator Batch Size"
                  type="number"
                  value={settings.detection_batch_size}
                  onChange={(e) => handleSettingChange('detection_batch_size', parseInt(e.target.value))}
                  variant="outlined"
                  InputLabelProps={{ style: { color: '#8c909e' } }}
                  sx={{ input: { color: '#fff' } }}
                  helperText="Events correlated per engine sweep cycle."
                />
                <TextField
                  fullWidth
                  label="Threat Database Retention Limit (Days)"
                  type="number"
                  value={settings.alert_retention_days}
                  onChange={(e) => handleSettingChange('alert_retention_days', parseInt(e.target.value))}
                  variant="outlined"
                  InputLabelProps={{ style: { color: '#8c909e' } }}
                  sx={{ input: { color: '#fff' } }}
                />
              </Box>
            </Card>

          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>

            {/* Licensing Card */}
            <Card className="glass-panel" sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff', mb: 2 }}>
                📋 Subscription Licensing
              </Typography>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(255,255,255,0.05)' }} />
              <Alert severity="success" sx={{ mb: 2.5, bgcolor: 'rgba(46,125,50,0.1)', color: '#00e676', border: '1px solid #2e7d32' }}>
                License Status: <strong>{licenseInfo.status.toUpperCase()} (VALID)</strong>
              </Alert>
              <Grid container spacing={2} sx={{ fontSize: 13.5 }}>
                <Grid item xs={6}>
                  <p style={{ color: '#8c909e' }}><strong>Service Tier:</strong></p>
                  <p style={{ fontWeight: 'bold', color: '#fff' }}>{licenseInfo.tier}</p>
                  <p style={{ color: '#8c909e', marginTop: 10 }}><strong>Expiration Date:</strong></p>
                  <p style={{ fontWeight: 'bold', color: '#fff' }}>{licenseInfo.expiry_date}</p>
                </Grid>
                <Grid item xs={6}>
                  <p style={{ color: '#8c909e' }}><strong>Endpoints Allowed:</strong></p>
                  <p style={{ fontWeight: 'bold', color: '#fff' }}>{licenseInfo.endpoints_licensed.toLocaleString()}</p>
                  <p style={{ color: '#8c909e', marginTop: 10 }}><strong>Endpoints Active:</strong></p>
                  <p style={{ fontWeight: 'bold', color: '#00e676' }}>{licenseInfo.endpoints_used.toLocaleString()} in use</p>
                </Grid>
              </Grid>
            </Card>

            {/* Notification triggers */}
            <Card className="glass-panel" sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff', mb: 2 }}>
                📢 Event Broadcast Triggers
              </Typography>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(255,255,255,0.05)' }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.email_notifications_enabled}
                      onChange={(e) => handleSettingChange('email_notifications_enabled', e.target.checked)}
                      sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#f05a28' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#f05a28' } }}
                    />
                  }
                  label="Broadcast critical breaches to Email lists"
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: 13, color: '#e3e4e8' } }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.sms_notifications_enabled}
                      onChange={(e) => handleSettingChange('sms_notifications_enabled', e.target.checked)}
                      sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#f05a28' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#f05a28' } }}
                    />
                  }
                  label="Broadcast high threat events to SMS Gateways"
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: 13, color: '#e3e4e8' } }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.event_aggregation_enabled}
                      onChange={(e) => handleSettingChange('event_aggregation_enabled', e.target.checked)}
                      sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#f05a28' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#f05a28' } }}
                    />
                  }
                  label="Enable automatic threat alert correlation"
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: 13, color: '#e3e4e8' } }}
                />
              </Box>
            </Card>

            {/* Backups */}
            <Card className="glass-panel" sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff', mb: 2 }}>
                💾 Database Backups
              </Typography>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(255,255,255,0.05)' }} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => setBackupDialog(true)}
                  sx={{ bgcolor: '#ff9100', color: '#fff', '&:hover': { bgcolor: '#e65100' } }}
                >
                  Trigger Manual Backup
                </Button>
              </Box>
              {backupStatus === 'creating' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                  <CircularProgress size={18} color="inherit" />
                  <Typography variant="caption" sx={{ color: '#8c909e' }}>Generating database backup archive...</Typography>
                </Box>
              )}
              {backupStatus && typeof backupStatus === 'object' && (
                <Alert severity={backupStatus.success ? 'success' : 'error'} sx={{ mt: 2, bgcolor: backupStatus.success ? 'rgba(46,125,50,0.1)' : 'rgba(211,47,47,0.1)', color: backupStatus.success ? '#00e676' : '#ff1744', border: `1px solid ${backupStatus.success ? '#2e7d32' : '#c62828'}` }}>
                  {backupStatus.message}
                </Alert>
              )}
            </Card>

          </Box>
        </Grid>
      </Grid>

      {/* Save Button */}
      <Box sx={{ mt: 4.5, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleSaveSettings}
          sx={{ bgcolor: '#00e676', color: '#000', fontWeight: 'bold', px: 4, py: 1.2, '&:hover': { bgcolor: '#00c853' } }}
        >
          Save All Configuration Parameters
        </Button>
      </Box>

      {/* Backup Confirmation Dialog */}
      <Dialog open={backupDialog} onClose={() => setBackupDialog(false)} PaperProps={{ sx: { bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: '800', color: '#ff9100' }}>Trigger Manual Backup Task</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ color: '#8c909e', mb: 2 }}>
            This will archive and compress all databases, rules YAML templates, user configurations, and audit trail logs. The output archive will be encrypted and saved locally.
          </Typography>
          <Typography variant="caption" sx={{ color: '#ff1744', fontWeight: 'bold' }}>
            ⚠️ Note: Telemetry processing may experience latency during backup creation.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setBackupDialog(false)} sx={{ color: '#8c909e' }}>Cancel</Button>
          <Button
            onClick={() => {
              setBackupDialog(false);
              handleBackup();
            }}
            variant="contained"
            sx={{ bgcolor: '#ff9100', '&:hover': { bgcolor: '#e65100' } }}
          >
            Start Backup
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SystemSettings;
