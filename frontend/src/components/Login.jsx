import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Tabs, Tab, Alert, CircularProgress, InputAdornment, IconButton } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import LinkIcon from '@mui/icons-material/Link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SecurityIcon from '@mui/icons-material/Security';

function Login({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState(0); // 0 = Login, 1 = Signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Dynamic credentials from backend seeding
  const [defaultEmail, setDefaultEmail] = useState('admin@argus.com');
  const [defaultPassword, setDefaultPassword] = useState('');

  // Fetch dynamic credentials on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/saas/auth/default-credentials`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data) => {
        if (data && data.email && data.password) {
          setDefaultEmail(data.email);
          setDefaultPassword(data.password);
        }
      })
      .catch((err) => {
        console.warn('Could not retrieve dynamic credentials, using default fallbacks.', err);
      });
  }, []);
  
  // Signup specific fields
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleAutofill = () => {
    setEmail(defaultEmail);
    setPassword(defaultPassword);
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    
    try {
      if (activeTab === 0) {
        // Login Flow
        const queryParams = new URLSearchParams({ email, password }).toString();
        const response = await fetch(`${API_BASE_URL}/saas/auth/login?${queryParams}`, {
          method: 'POST',
        });
        const data = await response.json();
        
        if (response.ok && data.status === 'success') {
          setSuccessMsg('Authentication successful! Loading ARGUS Console...');
          setTimeout(() => {
            onLoginSuccess(data.token);
          }, 1000);
        } else {
          setErrorMsg(data.detail || 'Authentication failed. Please check your credentials.');
        }
      } else {
        // Signup Flow
        const queryParams = new URLSearchParams({
          name,
          email,
          password,
          organization_name: orgName,
          organization_slug: orgSlug
        }).toString();
        
        const response = await fetch(`${API_BASE_URL}/saas/auth/signup?${queryParams}`, {
          method: 'POST',
        });
        const data = await response.json();
        
        if (response.ok && data.status === 'success') {
          setSuccessMsg('Account and Tenant workspace registered successfully! Logging in...');
          setTimeout(() => {
            onLoginSuccess(data.token);
          }, 1500);
        } else {
          setErrorMsg(data.detail || 'Registration failed. Ensure email and organization are unique.');
        }
      }
    } catch (err) {
      setErrorMsg('Cannot reach authentication server. Verify backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 20% 30%, #151824 0%, #090a0f 70%)',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        overflowY: 'auto',
        px: 2,
        py: 4
      }}
    >
      <Paper
        elevation={24}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: 4,
          borderRadius: 3,
          bgcolor: 'rgba(18, 19, 26, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          textAlign: 'center'
        }}
      >
        {/* Shield Icon Logo */}
        <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: 2, bgcolor: 'rgba(240, 90, 40, 0.1)', mb: 2 }}>
          <SecurityIcon sx={{ color: '#f05a28', fontSize: 36 }} />
        </Box>
        
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0.5, color: '#fff' }}>
          ARGUS <span style={{ color: '#f05a28' }}>XDR</span> Portal
        </Typography>
        <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 3 }}>
          Extended Detection, Response & Enterprise SIEM Console
        </Typography>



        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, bgcolor: 'rgba(211, 47, 47, 0.1)', color: '#ff5252', border: '1px solid rgba(211,47,47,0.2)', fontSize: 12, textAlign: 'left' }}>
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert severity="success" sx={{ mb: 2.5, bgcolor: 'rgba(56, 142, 60, 0.1)', color: '#69f0ae', border: '1px solid rgba(56,142,60,0.2)', fontSize: 12, textAlign: 'left' }}>
            {successMsg}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activeTab === 1 && (
            <TextField
              required
              fullWidth
              size="small"
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: '#8c909e', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                bgcolor: 'rgba(28, 30, 40, 0.5)',
                borderRadius: '4px',
                label: { color: '#8c909e', fontSize: 13 },
                input: { color: '#fff', fontSize: 13 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.05)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
              }}
            />
          )}

          <TextField
            required
            fullWidth
            size="small"
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon sx={{ color: '#8c909e', fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              bgcolor: 'rgba(28, 30, 40, 0.5)',
              borderRadius: '4px',
              label: { color: '#8c909e', fontSize: 13 },
              input: { color: '#fff', fontSize: 13 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.05)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
            }}
          />

          <TextField
            required
            fullWidth
            size="small"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon sx={{ color: '#8c909e', fontSize: 18 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small" sx={{ color: '#8c909e' }}>
                    {showPassword ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              bgcolor: 'rgba(28, 30, 40, 0.5)',
              borderRadius: '4px',
              label: { color: '#8c909e', fontSize: 13 },
              input: { color: '#fff', fontSize: 13 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.05)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
            }}
          />

          {activeTab === 1 && (
            <>
              <TextField
                required
                fullWidth
                size="small"
                label="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BusinessIcon sx={{ color: '#8c909e', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  bgcolor: 'rgba(28, 30, 40, 0.5)',
                  borderRadius: '4px',
                  label: { color: '#8c909e', fontSize: 13 },
                  input: { color: '#fff', fontSize: 13 },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.05)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
                }}
              />

              <TextField
                required
                fullWidth
                size="small"
                label="Organization Slug (e.g. AcmeCorp)"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon sx={{ color: '#8c909e', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  bgcolor: 'rgba(28, 30, 40, 0.5)',
                  borderRadius: '4px',
                  label: { color: '#8c909e', fontSize: 13 },
                  input: { color: '#fff', fontSize: 13 },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.05)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
                }}
              />
            </>
          )}

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              mt: 1.5,
              py: 1,
              bgcolor: '#f05a28',
              '&:hover': { bgcolor: '#d84e20' },
              fontWeight: 'bold',
              borderRadius: '6px'
            }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : activeTab === 0 ? 'Sign In' : 'Create Workspace'}
          </Button>

          {activeTab === 0 && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                borderRadius: 1.5,
                bgcolor: 'rgba(240, 90, 40, 0.04)',
                border: '1px dashed rgba(240, 90, 40, 0.2)',
                textAlign: 'left'
              }}
            >
              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 1, fontWeight: 'bold' }}>
                Default Seeded Tenant:
              </Typography>
              <Typography variant="caption" sx={{ color: '#fff', display: 'block', fontFamily: 'monospace', fontSize: 11 }}>
                Email: {defaultEmail}
              </Typography>
              <Typography variant="caption" sx={{ color: '#fff', display: 'block', fontFamily: 'monospace', fontSize: 11, mb: 1.5 }}>
                Password: {defaultPassword}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={handleAutofill}
                sx={{
                  fontSize: 10,
                  py: 0.5,
                  color: '#f05a28',
                  borderColor: 'rgba(240, 90, 40, 0.4)',
                  '&:hover': { borderColor: '#f05a28', bgcolor: 'rgba(240,90,40,0.03)' }
                }}
              >
                Auto-fill default credentials
              </Button>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default Login;
