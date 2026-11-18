import API_BASE_URL from '../config/api.js';
import React, { useState, useEffect } from 'react';
import { Box, Button, Drawer, List, ListItem, ListItemIcon, ListItemText, ListItemButton, AppBar, Toolbar, Typography, IconButton, InputBase, Avatar, Badge, Chip, Paper, Menu, MenuItem } from '@mui/material';
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
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import CloudIcon from '@mui/icons-material/Cloud';

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
import SystemMetrics from './SystemMetrics';
import Login from './Login';
import ThreatHunting from './ThreatHunting';
import CloudSiem from './CloudSiem';

const DRAWER_WIDTH = 240;

function ArgusDashboard() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeSection, setActiveSection] = useState('overview');
  const [dashboardMode, setDashboardMode] = useState('traditional');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [alertCount, setAlertCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState(null);
  const [unreadAlerts, setUnreadAlerts] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const handleNotifOpen = async (event) => {
    setNotifAnchorEl(event.currentTarget);
    setNotifLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/?status=new&limit=5`);
      if (response.ok) {
        const data = await response.json();
        setUnreadAlerts(data.alerts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleNotifClose = () => {
    setNotifAnchorEl(null);
  };

  const handleAcknowledgeAll = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/acknowledge-all`, {
        method: 'POST'
      });
      if (response.ok) {
        setAlertCount(0);
        setUnreadAlerts([]);
        handleNotifClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Global fetch interceptor to automatically inject Authorization token header
  // and rewrite localhost:8001 → localhost:8002 (backend moved to avoid Velociraptor port conflict)
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
      let targetUrl = url;
      const activeToken = localStorage.getItem('token');
      if (activeToken) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${activeToken}`
        };
      }
      return originalFetch(targetUrl, options);
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

  const traditionalMenu = [
    { id: 'overview', text: 'Overview', icon: <DashboardIcon /> },
    { id: 'siem', text: 'SIEM Log Search', icon: <TerminalIcon /> },
    { id: 'discover', text: 'Security Events', icon: <VisibilityIcon /> },
    { id: 'agents', text: 'Agents Console', icon: <DnsIcon /> },
    { id: 'metrics', text: 'Live System Metrics', icon: <RadarIcon /> },
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
    { id: 'threat_hunting', text: 'Threat Hunting', icon: <TravelExploreIcon /> },
    { id: 'rules', text: 'Rules Configuration', icon: <GavelIcon /> },
    { id: 'integrations', text: 'Integrations Panel', icon: <SettingsInputComponentIcon /> },
    { id: 'users', text: 'User Management', icon: <GroupIcon /> },
    { id: 'settings', text: 'System Settings', icon: <SettingsIcon /> },
  ];

  const cloudMenu = [
    { id: 'cloud_dashboard', text: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'cloud_graph', text: 'Threat Graph', icon: <HubIcon /> },
    { id: 'cloud_logs', text: 'Log Explorer', icon: <TerminalIcon /> },
    { id: 'cloud_triage', text: 'Alert Triage', icon: <AssignmentIcon /> },
    { id: 'cloud_posture', text: 'CSPM Posture', icon: <ShieldIcon /> },
    { id: 'soar', text: 'SOAR Playbooks', icon: <BoltIcon /> },
    { id: 'tickets', text: 'Incident Tickets', icon: <AssignmentIcon /> },
    { id: 'integrations', text: 'Integrations Panel', icon: <SettingsInputComponentIcon /> },
    { id: 'settings', text: 'System Settings', icon: <SettingsIcon /> },
  ];

  const menuItems = dashboardMode === 'traditional' ? traditionalMenu : cloudMenu;

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
                borderRadius: '8px',
                bgcolor: '#f05a28',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: '#fff',
                fontSize: 18
              }}
            >
              A
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', letterSpacing: 0.5, color: '#fff' }}>
              ARGUS <span style={{ color: '#f05a28', fontSize: 13, fontWeight: 'bold' }}>Console</span>
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
            
            {/* Segmented Console Switcher */}
            <Box sx={{ display: 'flex', border: '1px solid #222430', borderRadius: '20px', overflow: 'hidden', mr: 1, bgcolor: '#1c1e28' }}>
              <Button
                size="small"
                onClick={() => { setDashboardMode('traditional'); setActiveSection('overview'); }}
                sx={{
                  px: 2,
                  py: 0.5,
                  borderRadius: 0,
                  fontSize: 11,
                  fontWeight: 'bold',
                  color: dashboardMode === 'traditional' ? '#fff' : '#9598a3',
                  bgcolor: dashboardMode === 'traditional' ? '#f05a28' : 'transparent',
                  border: 'none',
                  '&:hover': { bgcolor: dashboardMode === 'traditional' ? '#d84e20' : 'rgba(255,255,255,0.02)' }
                }}
              >
                Endpoint Console
              </Button>
              <Button
                size="small"
                onClick={() => { setDashboardMode('cloud'); setActiveSection('cloud_dashboard'); }}
                sx={{
                  px: 2,
                  py: 0.5,
                  borderRadius: 0,
                  fontSize: 11,
                  fontWeight: 'bold',
                  color: dashboardMode === 'cloud' ? '#fff' : '#9598a3',
                  bgcolor: dashboardMode === 'cloud' ? '#f05a28' : 'transparent',
                  border: 'none',
                  '&:hover': { bgcolor: dashboardMode === 'cloud' ? '#d84e20' : 'rgba(255,255,255,0.02)' }
                }}
              >
                Cloud Console
              </Button>
            </Box>

            {selectedAgent !== 'all' && (
              <Chip
                label={`Agent: ${selectedAgent}`}
                onDelete={handleClearAgent}
                deleteIcon={<CloseIcon style={{ color: '#ff9100' }} />}
                sx={{ bgcolor: 'rgba(255, 145, 0, 0.1)', color: '#ff9100', border: '1px solid rgba(255, 145, 0, 0.3)', fontWeight: 'bold', fontSize: 11 }}
              />
            )}
            
            <IconButton sx={{ color: '#9598a3' }} onClick={handleNotifOpen}>
              <Badge badgeContent={alertCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <Menu
              anchorEl={notifAnchorEl}
              open={Boolean(notifAnchorEl)}
              onClose={handleNotifClose}
              PaperProps={{
                sx: {
                  bgcolor: '#12131a',
                  border: '1px solid #222430',
                  color: '#fff',
                  width: 320,
                  maxHeight: 400,
                  p: 1
                }
              }}
            >
              <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222430', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Notifications</Typography>
                {alertCount > 0 && (
                  <Chip
                    label="Mark all read"
                    size="small"
                    onClick={handleAcknowledgeAll}
                    sx={{ bgcolor: 'rgba(240, 90, 40, 0.15)', color: '#f05a28', fontWeight: 'bold', fontSize: 10, cursor: 'pointer' }}
                  />
                )}
              </Box>
              {notifLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <Typography variant="caption" color="#9598a3">Loading alerts...</Typography>
                </Box>
              ) : unreadAlerts.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="caption" color="#9598a3">No new alerts found</Typography>
                </Box>
              ) : (
                unreadAlerts.map((alert) => {
                  const getSevColor = (sev) => {
                    if (sev === 'critical') return '#ff1744';
                    if (sev === 'high') return '#ff9100';
                    if (sev === 'medium') return '#ffd600';
                    return '#00e676';
                  };
                  return (
                    <MenuItem
                      key={alert.id}
                      onClick={() => {
                        setActiveSection('discover');
                        handleNotifClose();
                      }}
                      sx={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        borderBottom: '1px solid #1c1e28',
                        py: 1,
                        whiteSpace: 'normal',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 0.5 }}>
                        <Chip
                          label={alert.severity.toUpperCase()}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: 8,
                            fontWeight: 'bold',
                            bgcolor: `rgba(${alert.severity === 'critical' ? '255,23,68' : alert.severity === 'high' ? '255,145,0' : '255,214,0'}, 0.15)`,
                            color: getSevColor(alert.severity)
                          }}
                        />
                        <Typography variant="caption" color="#666" sx={{ fontSize: 9 }}>
                          {alert.hostname}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontSize: 12, fontWeight: 'bold', mb: 0.5 }}>
                        {alert.title}
                      </Typography>
                      <Typography variant="caption" color="#9598a3" sx={{ fontSize: 10 }}>
                        {alert.description}
                      </Typography>
                    </MenuItem>
                  );
                })
              )}
            </Menu>

            <Avatar sx={{ bgcolor: '#f05a28', cursor: 'pointer', width: 32, height: 32, fontSize: 14, fontWeight: 'bold' }} onClick={handleProfileOpen}>
              A
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
                        // Reset search query filter when navigating directly
                        setSearchQuery('');
                        setSearchVal('');
                      }
                    }}
                    sx={{
                      py: 1,
                      px: 2.5,
                      borderLeft: active ? '3px solid #f05a28' : '3px solid transparent',
                      bgcolor: active ? 'rgba(240, 90, 40, 0.05)' : 'transparent',
                      color: active ? '#fff' : '#9598a3',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.02)',
                        color: '#fff'
                      }
                    }}
                  >
                    <ListItemIcon sx={{ color: active ? '#f05a28' : '#9598a3', minWidth: 40 }}>
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

        {['cloud_dashboard', 'cloud_graph', 'cloud_logs', 'cloud_triage', 'cloud_posture'].includes(activeSection) && (
          <CloudSiem section={activeSection} />
        )}
        
        {activeSection === 'discover' && (
          <Discover selectedAgent={selectedAgent} searchQuery={searchQuery} onQueryChange={setSearchQuery} />
        )}

        {activeSection === 'agents' && (
          <Agents selectedAgentId={selectedAgent} onSelectAgent={setSelectedAgent} />
        )}

        {activeSection === 'metrics' && (
          <SystemMetrics />
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

        {activeSection === 'threat_hunting' && (
          <ThreatHunting />
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

export default ArgusDashboard;
