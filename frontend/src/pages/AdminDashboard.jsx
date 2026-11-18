import React, { useState } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  Button,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import { Settings as SettingsIcon, Dashboard as DashboardIcon } from '@mui/icons-material';
import IntegrationsPanel from '../components/IntegrationsPanel';
import AgentManagement from '../components/AgentManagement';
import RulesConfiguration from '../components/RulesConfiguration';
import SystemSettings from '../components/SystemSettings';
import UserManagement from '../components/UserManagement';

function AdminDashboard() {
  const [currentTab, setCurrentTab] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [user, setUser] = useState({
    name: 'Admin',
    email: 'admin@company.com',
    organization: 'Default Organization'
  });

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: '#1976d2' }}>
        <Toolbar>
          <DashboardIcon sx={{ mr: 2 }} />
          <Box sx={{ flexGrow: 1 }}>
            <h2 style={{ margin: 0, color: 'white' }}>ARGUS Admin Panel</h2>
            <small style={{ color: 'rgba(255,255,255,0.7)' }}>
              Organization: {user.organization}
            </small>
          </Box>
          <Button color="inherit" onClick={() => window.location.href = '/'} sx={{ mr: 2 }}>
            🛡️ Security Dashboard
          </Button>
          <Button color="inherit" sx={{ mr: 2 }}>
            Help & Support
          </Button>
          <Avatar
            onClick={handleMenuOpen}
            sx={{ cursor: 'pointer', bgcolor: '#90caf9' }}
          >
            {user.name[0]}
          </Avatar>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem disabled>{user.email}</MenuItem>
            <MenuItem onClick={() => setCurrentTab(4)}>User Profile</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Navigation Tabs */}
      <AppBar position="static" sx={{ bgcolor: '#fff', color: '#333', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          textColor="primary"
          indicatorColor="primary"
          sx={{ p: 1 }}
        >
          <Tab label="📊 Dashboard" />
          <Tab label="🔌 Integrations" />
          <Tab label="🤖 Agent Management" />
          <Tab label="⚙️ Rules & Automation" />
          <Tab label="👥 User Management" />
          <Tab label="⚙️ System Settings" />
        </Tabs>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 3, overflowY: 'auto' }}>
        {/* Dashboard Tab */}
        {currentTab === 0 && (
          <DashboardTab />
        )}

        {/* Integrations Tab */}
        {currentTab === 1 && (
          <IntegrationsPanel />
        )}

        {/* Agent Management Tab */}
        {currentTab === 2 && (
          <AgentManagement />
        )}

        {/* Rules & Automation Tab */}
        {currentTab === 3 && (
          <RulesConfiguration />
        )}

        {/* User Management Tab */}
        {currentTab === 4 && (
          <UserManagement />
        )}

        {/* System Settings Tab */}
        {currentTab === 5 && (
          <SystemSettings />
        )}
      </Container>
    </Box>
  );
}

// Dashboard Overview Tab
function DashboardTab() {
  const [stats, setStats] = useState({
    totalEndpoints: 2456,
    activeAgents: 2341,
    alertsToday: 156,
    criticalAlerts: 3,
    ticketsCreated: 28,
    uptime: '99.95%'
  });

  return (
    <Box>
      <h1>📊 System Overview</h1>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
        <StatCard title="Total Endpoints" value={stats.totalEndpoints} color="#4caf50" />
        <StatCard title="Active Agents" value={stats.activeAgents} color="#2196f3" />
        <StatCard title="Alerts Today" value={stats.alertsToday} color="#ff9800" />
        <StatCard title="Critical Alerts" value={stats.criticalAlerts} color="#f44336" />
        <StatCard title="Tickets Created" value={stats.ticketsCreated} color="#9c27b0" />
        <StatCard title="System Uptime" value={stats.uptime} color="#00bcd4" />
      </Box>
      
      <Box sx={{ mt: 4, p: 2, bgcolor: 'white', borderRadius: 1 }}>
        <h3>📈 Recent Activity</h3>
        <p>• 5 new agents connected</p>
        <p>• 3 critical alerts generated and ticketed</p>
        <p>• Telemetry sync completed (2456 events processed)</p>
        <p>• 1 integration configuration updated</p>
      </Box>
    </Box>
  );
}

function StatCard({ title, value, color }) {
  return (
    <Box
      sx={{
        bgcolor: 'white',
        p: 2,
        borderRadius: 1,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderLeft: `4px solid ${color}`
      }}
    >
      <p style={{ margin: '0 0 8px 0', color: '#999', fontSize: '14px' }}>{title}</p>
      <h2 style={{ margin: 0, color: color, fontSize: '32px' }}>{value}</h2>
    </Box>
  );
}

export default AdminDashboard;
