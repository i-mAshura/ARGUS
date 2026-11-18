import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Drawer, List, ListItem, ListItemIcon, ListItemText, ListItemButton, AppBar, Toolbar, Typography, IconButton, InputBase, Avatar, Badge, Chip, Paper, Menu, MenuItem, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CloseIcon from '@mui/icons-material/Close';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DnsIcon from '@mui/icons-material/Dns';
import BugReportIcon from '@mui/icons-material/BugReport';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import ShieldIcon from '@mui/icons-material/Shield';
import GavelIcon from '@mui/icons-material/Gavel';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import GroupIcon from '@mui/icons-material/Group';
import SettingsIcon from '@mui/icons-material/Settings';
import TerminalIcon from '@mui/icons-material/Terminal';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BoltIcon from '@mui/icons-material/Bolt';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import HubIcon from '@mui/icons-material/Hub';
import RadarIcon from '@mui/icons-material/Radar';
import AssignmentIcon from '@mui/icons-material/Assignment';

// Subcomponents
import Overview from './Overview';
import Discover from './Discover';
import Agents from './Agents';
import Vulnerabilities from './Vulnerabilities';
import Fim from './Fim';
import Mitre from './Mitre';
import RulesConfiguration from './RulesConfiguration';
import IntegrationsPanel from './IntegrationsPanel';
import UserManagement from './UserManagement';
import SystemSettings from './SystemSettings';
import Siem from './Siem';
import Compliance from './Compliance';
import MachineLearning from './MachineLearning';
import SoarPlaybooks from './SoarPlaybooks';
import Hygiene from './Hygiene';
import AiCopilot from './AiCopilot';
import AttackPath from './AttackPath';
import Deception from './Deception';
import IncidentTickets from './IncidentTickets';
import Sensors from './Sensors';
import Login from './Login';

const DRAWER_WIDTH = 240;

function AmunRaDashboard() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [alertCount, setAlertCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notiAnchorEl, setNotiAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Global fetch interceptor to automatically inject Authorization token header
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
      const activeToken = localStorage.getItem('token');
      if (activeToken) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${activeToken}`
        };
      }
      return originalFetch(url, options);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (token) {
      fetchAlertCount();
      const interval = setInterval(fetchAlertCount, 15000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchAlertCount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/stats/summary`);
      if (response.ok) {
        const data = await response.json();
        setAlertCount(data.new_alerts || 0);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQuery(searchVal);
    setActiveSection('discover');
  };

  const handleClearAgent = () => {
    setSelectedAgent('all');
  };

  const handleProfileOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setAnchorEl(null);
  };

  const handleNotiClick = async (event) => {
    setNotiAnchorEl(event.currentTarget);
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/?status=new&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.alerts || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotiClose = () => {
    setNotiAnchorEl(null);
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/acknowledge-all`, {
        method: 'POST'
      });
      if (res.ok) {
        setAlertCount(0);
        setNotifications([]);
        handleNotiClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    window.location.reload();
  };

  // Render premium login screen if not authenticated
  if (!token) {
    return <Login onLoginSuccess={(tok) => {
      localStorage.setItem('token', tok);
      setToken(tok);
    }} />;
  }

  const menuItems = [
    { id: 'overview', text: 'Overview', icon: <DashboardIcon /> },
    { id: 'siem', text: 'SIEM Log Search', icon: <TerminalIcon /> },
    { id: 'discover', text: 'Security Events', icon: <VisibilityIcon /> },
    { id: 'agents', text: 'Agents Console', icon: <DnsIcon /> },
    { id: 'sensors', text: 'Sensors Console', icon: <RadarIcon /> },
    { id: 'vulnerabilities', text: 'Vulnerabilities', icon: <BugReportIcon /> },
    { id: 'fim', text: 'File Integrity (FIM)', icon: <FolderZipIcon /> },
    { id: 'mitre', text: 'MITRE ATT&CK Matrix', icon: <ShieldIcon /> },
    { id: 'compliance', text: 'Compliance & Posture', icon: <FactCheckIcon /> },
    { id: 'ml', text: 'ML Anomaly Engine', icon: <PsychologyIcon /> },
    { id: 'soar', text: 'SOAR Playbooks', icon: <BoltIcon /> },
    { id: 'tickets', text: 'Incident Tickets', icon: <AssignmentIcon /> },
    { id: 'hygiene', text: 'IT Hygiene & Hardening', icon: <HealthAndSafetyIcon /> },
    { id: 'ai_copilot', text: 'AI Threat Copilot', icon: <SmartToyIcon /> },
    { id: 'attack_path', text: 'Attack Path Simulator', icon: <HubIcon /> },
    { id: 'deception', text: 'Deception Honey-Tokens', icon: <RadarIcon /> },
    { id: 'rules', text: 'Rules Configuration', icon: <GavelIcon /> },
    { id: 'integrations', text: 'Integrations Panel', icon: <SettingsInputComponentIcon /> },
    { id: 'users', text: 'User Management', icon: <GroupIcon /> },
    { id: 'settings', text: 'System Settings', icon: <SettingsIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#090a0f', color: '#e3e4e8' }}>
      
      {/* Top Header */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#12131a', borderBottom: '1px solid #222430', boxShadow: 'none' }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', px: 2 }}>
          
          {/* Logo / Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="span"
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ffd700 0%, #ff3d00 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: '#fff',
                fontSize: 16,
                boxShadow: '0 0 12px rgba(255, 215, 0, 0.4)'
              }}
            >
              ☀️
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', letterSpacing: 0.5, color: '#fff' }}>
              AMUN RA <span style={{ color: '#ffd700', fontSize: 13, fontWeight: 'bold' }}>Console</span>
            </Typography>
          </Box>

          {/* Search Box / Redirect */}
          <Box component="form" onSubmit={handleSearchSubmit} sx={{ display: 'flex', alignItems: 'center', bgcolor: '#1c1e28', px: 1.5, py: 0.5, borderRadius: '24px', width: '35%', border: '1px solid #232630' }}>
            <SearchIcon sx={{ color: '#9598a3', mr: 1 }} />
            <InputBase
              placeholder="Search alerts globally..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              sx={{ color: '#fff', width: '100%', fontSize: 13 }}
            />
          </Box>

          {/* Alerts / Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {selectedAgent !== 'all' && (
              <Chip
                label={`Agent: ${selectedAgent}`}
                onDelete={handleClearAgent}
                deleteIcon={<CloseIcon style={{ color: '#ffd700' }} />}
                sx={{ bgcolor: 'rgba(255, 215, 0, 0.1)', color: '#ffd700', border: '1px solid rgba(255, 215, 0, 0.3)', fontWeight: 'bold', fontSize: 11 }}
              />
            )}
            
            <IconButton sx={{ color: '#9598a3' }} onClick={handleNotiClick}>
              <Badge badgeContent={alertCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            {/* Notification Menu */}
            <Menu
              anchorEl={notiAnchorEl}
              open={Boolean(notiAnchorEl)}
              onClose={handleNotiClose}
              PaperProps={{
                sx: {
                  bgcolor: '#12131a',
                  border: '1px solid #222430',
                  color: '#fff',
                  width: 320,
                  maxHeight: 400,
                  mt: 1.5,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }
              }}
            >
              <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222430' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: 13 }}>Security Alerts</Typography>
                {notifications.length > 0 && (
                  <Button size="small" onClick={handleMarkAllRead} sx={{ fontSize: 11, color: '#ffd700', textTransform: 'none', fontWeight: 'bold' }}>
                    Mark all read
                  </Button>
                )}
              </Box>
              <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <MenuItem key={n.id} onClick={handleNotiClose} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 1.5, px: 2, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: n.severity === 'critical' ? '#ff1744' : n.severity === 'high' ? '#ff9100' : '#ffd600', fontSize: 11 }}>
                          {n.title}
                        </Typography>
                        <Chip 
                          label={n.severity.toUpperCase()} 
                          size="small" 
                          sx={{ 
                            height: 14, 
                            fontSize: 7, 
                            fontWeight: 'bold',
                            bgcolor: n.severity === 'critical' ? 'rgba(255,23,73,0.15)' : 'rgba(255,145,0,0.15)',
                            color: n.severity === 'critical' ? '#ff1744' : '#ff9100'
                          }} 
                        />
                      </Box>
                      <Typography variant="caption" sx={{ color: '#9598a3', display: 'block', mb: 0.5, fontSize: 10 }}>
                        {n.description}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.4, fontSize: 8 }}>
                        Host: {n.hostname}
                      </Typography>
                    </MenuItem>
                  ))
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center', color: '#8c909e' }}>
                    <Typography variant="body2" sx={{ fontSize: 12 }}>No active new notifications</Typography>
                  </Box>
                )}
              </Box>
            </Menu>

            <Avatar sx={{ bgcolor: '#ffd700', cursor: 'pointer', width: 32, height: 32, fontSize: 14, fontWeight: 'bold', color: '#090a0f' }} onClick={handleProfileOpen}>
              AR
            </Avatar>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleProfileClose} PaperProps={{ sx: { bgcolor: '#12131a', border: '1px solid #222430', color: '#fff' } }}>
              <MenuItem sx={{ fontSize: 13 }} onClick={handleProfileClose}>Profile Settings</MenuItem>
              <MenuItem sx={{ fontSize: 13 }} onClick={handleLogout}>Log Out</MenuItem>
            </Menu>
          </Box>

        </Toolbar>
      </AppBar>

      {/* Sidebar Navigation */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box', bgcolor: '#12131a', borderRight: '1px solid #222430', color: '#9598a3' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', py: 2 }}>
          <List>
            {menuItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => {
                      setActiveSection(item.id);
                      if (item.id === 'discover') {
                        setSearchQuery('');
                        setSearchVal('');
                      }
                    }}
                    sx={{
                      py: 1,
                      px: 2.5,
                      borderLeft: active ? '3px solid #ffd700' : '3px solid transparent',
                      bgcolor: active ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                      color: active ? '#fff' : '#9598a3',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.02)',
                        color: '#fff'
                      }
                    }}
                  >
                    <ListItemIcon sx={{ color: active ? '#ffd700' : '#9598a3', minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 13, fontWeight: active ? 'bold' : 'normal' }} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>

      {/* Main Workspace */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, pt: 11, overflowX: 'hidden' }}>
        
        {/* Render pages dynamically */}
        {activeSection === 'overview' && (
          <Overview selectedAgent={selectedAgent} onSelectSection={setActiveSection} />
        )}

        {activeSection === 'siem' && (
          <Siem selectedAgent={selectedAgent} />
        )}
        
        {activeSection === 'discover' && (
          <Discover selectedAgent={selectedAgent} searchQuery={searchQuery} onQueryChange={setSearchQuery} />
        )}

        {activeSection === 'agents' && (
          <Agents selectedAgentId={selectedAgent} onSelectAgent={setSelectedAgent} />
        )}

        {activeSection === 'sensors' && (
          <Sensors />
        )}

        {activeSection === 'vulnerabilities' && (
          <Vulnerabilities selectedAgent={selectedAgent} />
        )}

        {activeSection === 'fim' && (
          <Fim selectedAgent={selectedAgent} />
        )}

        {activeSection === 'mitre' && (
          <Mitre activeAlerts={[]} />
        )}

        {activeSection === 'compliance' && (
          <Compliance selectedAgent={selectedAgent} />
        )}

        {activeSection === 'ml' && (
          <MachineLearning selectedAgent={selectedAgent} />
        )}

        {activeSection === 'soar' && (
          <SoarPlaybooks />
        )}

        {activeSection === 'tickets' && (
          <IncidentTickets />
        )}

        {activeSection === 'hygiene' && (
          <Hygiene selectedAgent={selectedAgent} />
        )}

        {activeSection === 'ai_copilot' && (
          <AiCopilot selectedAgent={selectedAgent} />
        )}

        {activeSection === 'attack_path' && (
          <AttackPath selectedAgent={selectedAgent} />
        )}

        {activeSection === 'deception' && (
          <Deception selectedAgent={selectedAgent} />
        )}

        {activeSection === 'rules' && (
          <RulesConfiguration />
        )}

        {activeSection === 'integrations' && (
          <IntegrationsPanel />
        )}

        {activeSection === 'users' && (
          <UserManagement />
        )}

        {activeSection === 'settings' && (
          <SystemSettings />
        )}

      </Box>

    </Box>
  );
}

export default AmunRaDashboard;
