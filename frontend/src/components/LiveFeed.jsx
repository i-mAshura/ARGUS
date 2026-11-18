/**
 * LiveFeed.jsx
 * ─────────────
 * Displays a real-time scrolling feed of telemetry events and security alerts
 * using the WebSocket live stream from the SpyderXDR backend (via Kafka).
 *
 * Data arrives instantly — no browser refresh needed.
 */

import React, { useState } from 'react';
import {
  Box, Paper, Typography, Chip, Divider, Badge,
  ToggleButtonGroup, ToggleButton, Tooltip,
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import BoltIcon from '@mui/icons-material/Bolt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import useLiveTelemetry from '../hooks/useLiveTelemetry';

const SEV_COLORS = {
  critical: '#ff1744',
  high:     '#ff9100',
  medium:   '#ffd600',
  low:      '#69f0ae',
  info:     '#40c4ff',
};

const EVENT_TYPE_COLORS = {
  process_creation:  '#7c4dff',
  network_connection:'#00b0ff',
  file_modified:     '#ff6d00',
  authentication:    '#76ff03',
  compliance:        '#e040fb',
};

function fallbackVal(item, key, fallback = '') {
  /* Look for *key* at the top level first, then inside event_data */
  if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
    return item[key];
  }
  const ed = item.event_data;
  if (ed && typeof ed === 'object' && ed[key] !== undefined && ed[key] !== null && ed[key] !== '') {
    return ed[key];
  }
  return fallback;
}

function EventRow({ item }) {
  const eventType = fallbackVal(item, 'event_type', '');
  const hostname  = fallbackVal(item, 'hostname',  '');
  const sourceIp  = fallbackVal(item, 'source_ip');
  const agentId   = fallbackVal(item, 'agent_id');
  const rawTs     = fallbackVal(item, 'timestamp');
  const ts        = rawTs ? new Date(rawTs).toLocaleTimeString() : '--:--:--';

  // Detect metric-only events (CPU/RAM data from live metrics endpoint)
  const isMetric = !eventType && !hostname;
  const displayType = isMetric ? 'system_metrics' : (eventType || 'unknown');
  const displayHost = isMetric ? '📊 System Metrics' : (hostname || 'unknown');
  const color     = EVENT_TYPE_COLORS[displayType] || (isMetric ? '#69f0ae' : '#90a4ae');

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1,
        py: 0.6, px: 1, borderBottom: '1px solid rgba(255,255,255,0.04)',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
      }}
    >
      <Typography variant="caption" sx={{ color: '#546e7a', minWidth: 72, mt: 0.1 }}>
        {ts}
      </Typography>
      <Chip
        label={displayType}
        size="small"
        sx={{
          bgcolor: color + '22', color, border: `1px solid ${color}55`,
          fontSize: 10, height: 18, minWidth: 120,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: '#b0bec5', display: 'block', lineHeight: 1.4 }}>
          <strong style={{ color: '#e0e0e0' }}>{displayHost}</strong>
          {sourceIp  ? ` · ${sourceIp}`  : ''}
          {agentId   ? ` · agent: ${agentId.slice(0, 8)}` : ''}
        </Typography>
      </Box>
    </Box>
  );
}

function AlertRow({ item }) {
  const ts = item.first_seen
    ? new Date(item.first_seen).toLocaleTimeString()
    : '--:--:--';
  const sev = (item.severity || 'info').toLowerCase();
  const color = SEV_COLORS[sev] || '#90a4ae';

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1,
        py: 0.6, px: 1, borderBottom: '1px solid rgba(255,255,255,0.04)',
        bgcolor: color + '08',
        '&:hover': { bgcolor: color + '14' },
      }}
    >
      <Typography variant="caption" sx={{ color: '#546e7a', minWidth: 72, mt: 0.1 }}>
        {ts}
      </Typography>
      <Chip
        label={sev.toUpperCase()}
        size="small"
        sx={{
          bgcolor: color + '22', color, border: `1px solid ${color}55`,
          fontSize: 10, height: 18, minWidth: 70,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: '#e0e0e0', fontWeight: 600, display: 'block' }}>
          {item.title || 'Security Alert'}
        </Typography>
        <Typography variant="caption" sx={{ color: '#78909c' }}>
          {item.hostname || '—'}
          {item.detection_type ? ` · ${item.detection_type}` : ''}
        </Typography>
      </Box>
    </Box>
  );
}

export default function LiveFeed() {
  const { events, alerts, connected } = useLiveTelemetry();
  const [tab, setTab] = useState('events');

  const items = tab === 'events' ? events : alerts;

  return (
    <Paper
      sx={{
        bgcolor: '#0d1117', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 2, overflow: 'hidden', height: '100%', display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.2, bgcolor: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BoltIcon sx={{ color: '#ffd600', fontSize: 18 }} />
          <Typography variant="subtitle2" sx={{ color: '#e0e0e0', fontWeight: 700 }}>
            Live Feed
          </Typography>
          <Tooltip title={connected ? 'Connected – streaming live via Kafka' : 'Reconnecting…'}>
            <FiberManualRecordIcon
              sx={{
                fontSize: 10,
                color: connected ? '#69f0ae' : '#f44336',
                animation: connected ? 'pulse 1.5s ease-in-out infinite' : 'none',
                '@keyframes pulse': {
                  '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 },
                },
              }}
            />
          </Tooltip>
        </Box>

        <ToggleButtonGroup
          value={tab}
          exclusive
          onChange={(_, v) => v && setTab(v)}
          size="small"
          sx={{ '& .MuiToggleButton-root': { py: 0.3, px: 1.2, fontSize: 11, color: '#90a4ae', border: '1px solid rgba(255,255,255,0.1)' } }}
        >
          <ToggleButton value="events">
            <Badge badgeContent={events.length} max={99} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: 9 } }}>
              Events
            </Badge>
          </ToggleButton>
          <ToggleButton value="alerts">
            <Badge badgeContent={alerts.length} max={99} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 9 } }}>
              <WarningAmberIcon sx={{ fontSize: 14, mr: 0.4 }} />Alerts
            </Badge>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ── Feed ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
        {items.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
            <Typography variant="caption" sx={{ color: '#546e7a' }}>
              {connected ? 'Waiting for data…' : 'Connecting to stream…'}
            </Typography>
          </Box>
        ) : (
          items.map((item, idx) =>
            tab === 'events'
              ? <EventRow key={item.id || idx} item={item} />
              : <AlertRow key={item.id || idx} item={item} />
          )
        )}
      </Box>

      {/* ── Footer ── */}
      <Box sx={{
        px: 2, py: 0.7, bgcolor: 'rgba(0,0,0,0.3)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <Typography variant="caption" sx={{ color: '#37474f', fontSize: 10 }}>
          {connected
            ? `Streaming live · ${events.length} events · ${alerts.length} alerts buffered`
            : 'Reconnecting to Kafka stream…'}
        </Typography>
      </Box>
    </Paper>
  );
}
