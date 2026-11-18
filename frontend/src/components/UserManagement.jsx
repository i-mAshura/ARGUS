import API_BASE_URL from '../config/api.js';
import React, { useState } from 'react';
import { Box, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Alert, Typography, Grid } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CopyIcon from '@mui/icons-material/ContentCopy';
import GroupIcon from '@mui/icons-material/Group';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/api-keys`);
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    fetchUsers();
    fetchApiKeys();
  }, []);

  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [openApiKeyDialog, setOpenApiKeyDialog] = useState(false);
  const [formData, setFormData] = useState({});
  const [newApiKey, setNewApiKey] = useState(null);

  const handleAddUser = () => {
    setFormData({});
    setOpenUserDialog(true);
  };

  const handleSaveUser = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role || 'analyst'
        })
      });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error(e);
    }
    setOpenUserDialog(false);
  };

  const handleDeleteUser = async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateApiKey = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          permissions: formData.permissions || 'ingest_only'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNewApiKey({
          id: data.id,
          name: data.name,
          key: data.key,
          permissions: data.permissions,
          created_at: new Date().toISOString().split('T')[0],
          last_used: 'Never'
        });
        fetchApiKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveApiKey = () => {
    setOpenApiKeyDialog(false);
    setNewApiKey(null);
  };

  const handleDeleteApiKey = async (keyId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/api-keys/${keyId}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchApiKeys();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">
      
      {/* Users Section */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <GroupIcon sx={{ color: '#f05a28', fontSize: 32 }} />
            <Typography variant="h5" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
              Identity & IAM Access
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddUser}
            sx={{ bgcolor: '#f05a28', '&:hover': { bgcolor: '#d84315' } }}
          >
            Create User Account
          </Button>
        </Box>
        <Typography variant="body2" sx={{ color: '#8c909e', mb: 3 }}>
          Manage analyst logons, security clearance roles, and MFA authentication states.
        </Typography>

        <TableContainer component={Paper} className="glass-panel" sx={{ p: 1 }}>
          <Table size="small" className="interactive-table">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11, fontWeight: 'bold' } }}>
                <TableCell>User Profile Name</TableCell>
                <TableCell>Email ID</TableCell>
                <TableCell>Clearance Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>MFA Token State</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} sx={{ '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5 } }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{user.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{user.email}</TableCell>
                  <TableCell>
                    <Chip label={(user.role || 'user').toUpperCase()} size="small" sx={{ height: 18, fontSize: 9, fontWeight: '800', bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' }} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={(user.status || 'active').toUpperCase()}
                      size="small"
                      color="success"
                      sx={{ height: 18, fontSize: 9, fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.mfa_enabled ? '✓ MFA ACTIVE' : '✗ MFA DISABLED'}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 9,
                        fontWeight: 'bold',
                        bgcolor: user.mfa_enabled ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 23, 73, 0.1)',
                        color: user.mfa_enabled ? '#00e676' : '#ff1744'
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 11 }}>{user.created_at}</TableCell>
                  <TableCell>
                    <Button size="small" sx={{ color: '#00b0ff' }}>Edit</Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleDeleteUser(user.id)}
                      sx={{ color: '#ff1744' }}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* API Keys section */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: '800', letterSpacing: 0.5 }}>
            API Access Ingest Keys
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setOpenApiKeyDialog(true)}
            sx={{ color: '#ff9100', borderColor: 'rgba(255,145,0,0.3)', '&:hover': { borderColor: '#ff9100' } }}
          >
            Generate Ingest Token
          </Button>
        </Box>
        <Typography variant="body2" sx={{ color: '#8c909e', mb: 3 }}>
          Manage cryptographic API access keys used by Windows/Linux endpoint agents.
        </Typography>

        <TableContainer component={Paper} className="glass-panel" sx={{ p: 1 }}>
          <Table size="small" className="interactive-table">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#12131a', color: '#8c909e', borderBottom: '1px solid var(--border-color)', fontSize: 11, fontWeight: 'bold' } }}>
                <TableCell>Key Identifier</TableCell>
                <TableCell>Secret API Key Token</TableCell>
                <TableCell>Privilege Scope</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell>Last Checked Active</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id} sx={{ '& td': { borderBottom: '1px solid var(--border-color)', color: '#f0f2f5', py: 1.5 } }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{key.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <code style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#00e5ff' }}>
                        {key.key}
                      </code>
                      <IconButton
                        size="small"
                        onClick={() => navigator.clipboard.writeText(key.key)}
                        sx={{ color: '#8c909e', p: 0.5 }}
                      >
                        <CopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={(key.permissions || 'read').toUpperCase()} size="small" variant="outlined" sx={{ height: 18, fontSize: 8.5, fontWeight: '800', color: '#ffd600', borderColor: 'rgba(255,214,0,0.3)' }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 11 }}>{key.created_at}</TableCell>
                  <TableCell sx={{ fontSize: 11, opacity: 0.8 }}>{key.last_used}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleDeleteApiKey(key.id)}
                      sx={{ color: '#ff1744' }}
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Add User Dialog */}
      <Dialog open={openUserDialog} onClose={() => setOpenUserDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: '800', color: '#ff9100' }}>Add IAM Analyst Account</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Account User Full Name"
            placeholder="e.g. John Doe"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            variant="outlined"
            InputLabelProps={{ style: { color: '#8c909e' } }}
            sx={{ input: { color: '#fff' } }}
          />
          <TextField
            fullWidth
            label="Corporate Email ID Address"
            type="email"
            placeholder="johndoe@company.com"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            margin="normal"
            variant="outlined"
            InputLabelProps={{ style: { color: '#8c909e' } }}
            sx={{ input: { color: '#fff' } }}
          />
          
          <FormControl fullWidth margin="normal" variant="outlined" sx={{ bgcolor: '#1c1e28', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 1 }}>
            <InputLabel sx={{ color: '#8c909e' }}>Clearance Role</InputLabel>
            <Select
              value={formData.role || ''}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              sx={{ color: '#fff' }}
            >
              <MenuItem value="admin">Administrator (Full Systems Access)</MenuItem>
              <MenuItem value="manager">Manager (Approve escalation / reports)</MenuItem>
              <MenuItem value="analyst">Analyst (Investigate threat alerts)</MenuItem>
              <MenuItem value="viewer">Viewer (Read-only overview metrics)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenUserDialog(false)} sx={{ color: '#8c909e' }}>Cancel</Button>
          <Button onClick={handleSaveUser} variant="contained" sx={{ bgcolor: '#f05a28', '&:hover': { bgcolor: '#d84315' } }}>
            Create Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate API Key Dialog */}
      <Dialog open={openApiKeyDialog} onClose={() => setOpenApiKeyDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#12131a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: '800', color: '#ff9100' }}>Generate Ingestion Key Token</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Ingest Identifier / Agent Name"
            placeholder="e.g., prod-server-ingest"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            variant="outlined"
            InputLabelProps={{ style: { color: '#8c909e' } }}
            sx={{ input: { color: '#fff' } }}
          />
          
          <FormControl fullWidth margin="normal" variant="outlined" sx={{ bgcolor: '#1c1e28', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 1 }}>
            <InputLabel sx={{ color: '#8c909e' }}>Privilege Scope</InputLabel>
            <Select
              value={formData.permissions || ''}
              onChange={(e) => setFormData({ ...formData, permissions: e.target.value })}
              sx={{ color: '#fff' }}
            >
              <MenuItem value="full">Full Access (Ingest, Read, Sync)</MenuItem>
              <MenuItem value="read_only">Read Only (Telemetry reads)</MenuItem>
              <MenuItem value="ingest_only">Ingest Only (Agent data streaming only)</MenuItem>
            </Select>
          </FormControl>
          
          {newApiKey && (
            <Alert severity="success" sx={{ mt: 2.5, bgcolor: 'rgba(46,125,50,0.1)', color: '#00e676', border: '1px solid #2e7d32' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Ingest Token Successfully Created:</Typography>
              <code style={{
                display: 'block',
                padding: '10px',
                backgroundColor: '#0b0c10',
                borderRadius: '6px',
                wordBreak: 'break-all',
                color: '#00e5ff',
                fontFamily: 'monospace',
                fontSize: 11.5
              }}>
                {newApiKey.key}
              </code>
              <Typography variant="caption" sx={{ color: '#ff1744', display: 'block', mt: 1.5, fontWeight: 'bold' }}>
                ⚠️ WARNING: Copy the API token key now. It cannot be recovered later!
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenApiKeyDialog(false)} sx={{ color: '#8c909e' }}>Close</Button>
          {!newApiKey && (
            <Button onClick={handleGenerateApiKey} variant="contained" sx={{ bgcolor: '#f05a28', '&:hover': { bgcolor: '#d84315' } }}>
              Generate Token
            </Button>
          )}
          {newApiKey && (
            <Button onClick={handleSaveApiKey} variant="contained" sx={{ bgcolor: '#00e676', color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#00c853' } }}>
              Save & Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UserManagement;
