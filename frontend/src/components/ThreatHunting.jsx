import API_BASE_URL from '../config/api.js';
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import StorageIcon from '@mui/icons-material/Storage';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import BugReportIcon from '@mui/icons-material/BugReport';
// import SecurityIcon from '@mui/icons-material/Security';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import KasmBrowserModal from './KasmBrowserModal';

/* ─────────────────────────────────────────────────────────────────────────────
   Hunt-type catalogue – matches VQL_MAP keys on the backend
───────────────────────────────────────────────────────────────────────────── */
const HUNT_OPTIONS = [
  {
    value: 'scan_processes',
    label: '🔍 Scan Running Processes',
    description: 'Enumerate every running process, PID, executable path, and owner',
    color: '#00b0ff',
  },
  {
    value: 'scheduled_tasks',
    label: '📅 Check Rogue Scheduled Tasks',
    description: 'List all scheduled tasks — expose persistence mechanisms and rogue jobs',
    color: '#ffd600',
  },
  {
    value: 'network_connections',
    label: '🌐 Search Active Network Connections',
    description: 'Dump live TCP/UDP sockets, remote IPs, ports, and connection state',
    color: '#00e676',
  },
  {
    value: 'windows_services',
    label: '🛠️ Audit Windows Services',
    description: 'Enumerate Windows services, display names, current status, and startup modes',
    color: '#ab47bc',
  },
  {
    value: 'event_log_tampering',
    label: '⚠️ Detect Event Log Tampering (ID 1102)',
    description: 'Query Windows Security Event Logs for Event ID 1102 (Event Log Cleared)',
    color: '#ff1744',
  },
  {
    value: 'local_users',
    label: '👥 Audit Local User Accounts',
    description: 'Audit local user accounts, group IDs, descriptions, and modification times',
    color: '#29b6f6',
  },
  {
    value: 'yara_process_scan',
    label: '🧠 Execute YARA Memory Scan',
    description: 'Scan process memory space using a custom signature pattern',
    color: '#ec407a',
  },
  {
    value: 'browser_extensions',
    label: '🧩 Audit Browser Extensions',
    description: 'Enumerate installed Chrome extensions, profiles, and path details',
    color: '#26a69a',
  },
  {
    value: 'rdp_logons',
    label: '🚪 Monitor Lateral RDP Logons',
    description: 'Detect successful RDP logons (Event ID 4624) from Security Event Logs',
    color: '#ff9100',
  },
  {
    value: 'ransomware_notes',
    label: '🧯 Scan for Ransomware Extensions',
    description: 'Scan folders for suspicious file extensions associated with ransomware',
    color: '#d50000',
  },
];

/* Column colour coding based on keyword heuristics */
function _cellColour(key, value) {
  const v = String(value ?? '').toLowerCase();
  const k = String(key).toLowerCase();

  // Flag suspicious keywords in command lines / executables
  if (k.includes('command') || k.includes('executable') || k.includes('image')) {
    if (['powershell', 'cmd', 'wscript', 'mshta', 'cscript', 'regsvr32'].some((s) => v.includes(s))) {
      return '#ffd600';
    }
  }
  // External IPs (non-private, non-loopback)
  if (k.includes('remoteip') || k.includes('remoteaddr')) {
    if (value && !v.startsWith('127.') && !v.startsWith('0.') && !v.startsWith('::')) {
      return '#ff9100';
    }
  }
  // Non-LISTENING TCP states that indicate active outbound
  if (k === 'state' && v === 'established') return '#00e676';
  if (k === 'state' && ['close_wait', 'time_wait', 'syn_sent'].includes(v)) return '#ff9100';

  return 'inherit';
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────────────────────── */
function ThreatHunting() {
  const [huntType, setHuntType]         = useState('scan_processes');
  const [targetHost, setTargetHost]     = useState('All Endpoints');
  const [loading, setLoading]           = useState(false);
  const [results, setResults]           = useState(null);   // null = not run yet
  const [error, setError]               = useState(null);
  const [huntMeta, setHuntMeta]         = useState(null);   // {hunt_type, target_host, row_count}

  /* ── Kasm Remote Browser Isolation state ──────────────────────────── */
  const [kasmModalOpen, setKasmModalOpen] = useState(false);
  const [kasmModalUrl, setKasmModalUrl]   = useState('');
  const [kasmIndicator, setKasmIndicator] = useState('');
  const [kasmLoading, setKasmLoading]     = useState(false);

  const selectedOption = HUNT_OPTIONS.find((o) => o.value === huntType) || HUNT_OPTIONS[0];

  /* ── Execute hunt ─────────────────────────────────────────────────────── */
  /* ── Indicator detection helpers ──────────────────────────────────── */
  function _isExternalIp(str) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim();
    const ipv4Match = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4Match) return false;
    const parts = ipv4Match.slice(1).map(Number);
    if (parts.some((p) => p > 255)) return false;
    // Private / reserved ranges
    if (parts[0] === 10) return false;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    if (parts[0] === 192 && parts[1] === 168) return false;
    if (parts[0] === 127) return false;
    if (parts[0] === 0) return false;
    if (parts[0] === 169 && parts[1] === 254) return false;
    return true;
  }

  function _looksLikeDomain(str) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim().toLowerCase();
    // Must contain at least one dot, no spaces, not purely numeric
    if (!trimmed.includes('.')) return false;
    if (/\s/.test(trimmed)) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(trimmed)) return false; // already handled by IP check
    // Basic domain pattern: something.something
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(trimmed);
  }

  function _looksLikeUrl(str) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim().toLowerCase();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
  }

  /**
   * Scan a row for external IPs, domains, or malicious URLs.
   * Returns the first match found, or null.
   */
  function _findIndicatorInRow(row) {
    for (const key of Object.keys(row)) {
      const val = row[key];
      if (val == null) continue;
      const str = String(val).trim();
      if (!str || str === '—' || str === 'null' || str === 'None') continue;
      if (_isExternalIp(str)) return str;
      if (_looksLikeUrl(str)) return str;
      if (_looksLikeDomain(str)) return str;
    }
    return null;
  }

  /* ── Kasm Investigate handler ─────────────────────────────────────── */
  const handleInvestigateInKasm = async (indicator) => {
    setKasmLoading(true);
    setKasmModalOpen(true);
    setKasmIndicator(indicator);
    setKasmModalUrl('');

    try {
      const res = await fetch(`${API_BASE_URL}/kasm/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_url: indicator }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setKasmModalUrl(data.kasm_url);
    } catch (err) {
      console.error('Kasm request failed:', err);
      setKasmIndicator(`Error: ${err.message}`);
      setKasmModalUrl('');
    } finally {
      setKasmLoading(false);
    }
  };

  const handleCloseKasmModal = () => {
    setKasmModalOpen(false);
    setKasmModalUrl('');
    setKasmIndicator('');
  };

  const handleExecuteHunt = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setHuntMeta(null);

    try {
      const res = await fetch(`${API_BASE_URL}/hunting/launch-hunt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hunt_type: huntType, target_host: targetHost }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || `HTTP ${res.status}`);
      }

      if (data.status === 'error') {
        throw new Error(data.message || 'Velociraptor returned an error.');
      }

      setResults(data.data || []);
      setHuntMeta({
        hunt_type:   data.hunt_type,
        target_host: data.target_host,
        row_count:   data.row_count ?? (data.data?.length ?? 0),
      });
    } catch (err) {
      console.error('Threat Hunt failed:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /* ── Build dynamic table columns from first data row ─────────────────── */
  const columns = results && results.length > 0 ? Object.keys(results[0]) : [];

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <Box sx={{ color: '#fff' }} className="anim-slide-up">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f05a28 0%, #ff8c42 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 18px rgba(240,90,40,0.45)',
          }}
        >
          <TrackChangesIcon sx={{ fontSize: 24, color: '#fff' }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0.4, color: '#fff' }}>
            Threat Hunting
          </Typography>
          <Typography variant="caption" sx={{ color: '#8c909e' }}>
            Powered by Velociraptor · Live gRPC query engine
          </Typography>
        </Box>

        {/* Status badge */}
        <Chip
          icon={<DeviceHubIcon sx={{ fontSize: 14 }} />}
          label="VELOCIRAPTOR ENGINE"
          size="small"
          sx={{
            ml: 'auto',
            bgcolor: 'rgba(240,90,40,0.12)',
            color: '#f05a28',
            border: '1px solid rgba(240,90,40,0.3)',
            fontWeight: 'bold',
            fontSize: 10,
            letterSpacing: 0.5,
          }}
        />
      </Box>

      {/* ── Stat strip ───────────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            icon: <TrackChangesIcon sx={{ color: '#f05a28', fontSize: 22 }} />,
            label: 'Hunt Types',
            value: HUNT_OPTIONS.length,
            color: '#f05a28',
          },
          {
            icon: <CheckCircleOutlineIcon sx={{ color: '#00e676', fontSize: 22 }} />,
            label: 'Rows Collected',
            value: huntMeta ? huntMeta.row_count : '—',
            color: '#00e676',
          },
          {
            icon: <StorageIcon sx={{ color: '#00b0ff', fontSize: 22 }} />,
            label: 'Last Target',
            value: huntMeta ? huntMeta.target_host : '—',
            color: '#00b0ff',
            small: true,
          },
        ].map((s, i) => (
          <Grid item xs={12} md={4} key={i}>
            <Paper
              className="glass-panel"
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                borderLeft: `3px solid ${s.color}`,
              }}
            >
              {s.icon}
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: '#8c909e', fontWeight: 'bold', letterSpacing: 0.5, fontSize: 10 }}
                >
                  {s.label.toUpperCase()}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    color: s.color,
                    fontSize: s.small ? 14 : 22,
                    lineHeight: 1.2,
                  }}
                >
                  {s.value}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Hunt Control Panel ───────────────────────────────────────────── */}
      <Paper
        className="glass-panel"
        sx={{
          p: 3,
          mb: 3,
          background: 'linear-gradient(135deg, rgba(15,17,26,0.95) 0%, rgba(20,22,34,0.95) 100%)',
          border: '1px solid rgba(240,90,40,0.18)',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2.5, color: '#f0f2f5' }}>
          🎯 Configure Hunt Parameters
        </Typography>

        <Grid container spacing={3} alignItems="flex-end">

          {/* Hunt objective selector */}
          <Grid item xs={12} md={5}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#8c909e', fontSize: 13 }}>Hunting Objective</InputLabel>
              <Select
                id="hunt-type-select"
                value={huntType}
                label="Hunting Objective"
                onChange={(e) => setHuntType(e.target.value)}
                disabled={loading}
                sx={{
                  color: '#fff',
                  fontSize: 13,
                  bgcolor: 'rgba(9,10,15,0.8)',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(240,90,40,0.4)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#f05a28' },
                  '& .MuiSvgIcon-root': { color: '#8c909e' },
                }}
              >
                {HUNT_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {/* Description */}
            <Typography
              variant="caption"
              sx={{ color: '#8c909e', mt: 0.8, display: 'block', fontSize: 11, lineHeight: 1.4 }}
            >
              {selectedOption.description}
            </Typography>
          </Grid>

          {/* Target host input */}
          <Grid item xs={12} md={4}>
            <TextField
              id="hunt-target-host"
              fullWidth
              size="small"
              label="Target Host"
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              disabled={loading}
              placeholder="All Endpoints"
              sx={{
                '& .MuiInputLabel-root': { color: '#8c909e', fontSize: 13 },
                '& .MuiInputBase-input': { color: '#fff', fontSize: 13 },
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(9,10,15,0.8)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(240,90,40,0.4)' },
                  '&.Mui-focused fieldset': { borderColor: '#f05a28' },
                },
              }}
            />
            <Typography variant="caption" sx={{ color: '#8c909e', mt: 0.8, display: 'block', fontSize: 11 }}>
              Specific hostname or "All Endpoints"
            </Typography>
          </Grid>

          {/* Execute button */}
          <Grid item xs={12} md={3}>
            <Button
              id="hunt-execute-btn"
              variant="contained"
              fullWidth
              disabled={loading}
              onClick={handleExecuteHunt}
              startIcon={
                loading ? (
                  <CircularProgress size={16} thickness={5} sx={{ color: '#fff' }} />
                ) : (
                  <PlayArrowIcon />
                )
              }
              sx={{
                bgcolor: loading ? 'rgba(240,90,40,0.5)' : '#f05a28',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: 13,
                py: 1.1,
                borderRadius: '8px',
                letterSpacing: 0.3,
                boxShadow: loading ? 'none' : '0 0 20px rgba(240,90,40,0.35)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: loading ? 'rgba(240,90,40,0.5)' : '#d84e20',
                  boxShadow: '0 0 28px rgba(240,90,40,0.55)',
                },
                '&.Mui-disabled': {
                  bgcolor: 'rgba(240,90,40,0.5)',
                  color: 'rgba(255,255,255,0.7)',
                },
              }}
            >
              {loading ? 'Querying Endpoints via Velociraptor...' : 'Execute Live Hunt'}
            </Button>
          </Grid>

        </Grid>
      </Paper>

      {/* ── Loading State ─────────────────────────────────────────────────── */}
      {loading && (
        <Paper
          className="glass-panel"
          sx={{
            p: 4,
            mb: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2.5,
            border: '1px solid rgba(240,90,40,0.25)',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: 64,
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress
              size={64}
              thickness={2}
              sx={{
                color: '#f05a28',
                position: 'absolute',
                animation: 'MuiCircularProgress-keyframes-circular-rotate 1.2s linear infinite',
              }}
            />
            <TrackChangesIcon sx={{ color: '#f05a28', fontSize: 28 }} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#f05a28' }}>
              Live Hunt In Progress
            </Typography>
            <Typography variant="caption" sx={{ color: '#8c909e' }}>
              Querying endpoints via Velociraptor gRPC · Streaming VQL results...
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[...Array(3)].map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#f05a28',
                  opacity: 0.7,
                  animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
                  '@keyframes pulse': {
                    '0%, 100%': { transform: 'scale(1)', opacity: 0.4 },
                    '50%': { transform: 'scale(1.5)', opacity: 1 },
                  },
                }}
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* ── Error display ─────────────────────────────────────────────────── */}
      {error && !loading && (
        <Alert
          severity="error"
          icon={<ErrorOutlineIcon />}
          sx={{
            mb: 3,
            bgcolor: 'rgba(255,23,68,0.08)',
            border: '1px solid rgba(255,23,68,0.3)',
            color: '#ff5252',
            '& .MuiAlert-icon': { color: '#ff1744' },
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            Velociraptor Hunt Failed
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11.5 }}>
            {error}
          </Typography>
        </Alert>
      )}

      {/* ── Hunt Summary Banner ───────────────────────────────────────────── */}
      {huntMeta && results && !loading && (
        <Paper
          className="glass-panel"
          sx={{
            p: 2,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderLeft: `3px solid ${selectedOption.color}`,
            background: `linear-gradient(90deg, rgba(15,17,26,0.98) 0%, rgba(20,22,34,0.98) 100%)`,
          }}
        >
          <CheckCircleOutlineIcon sx={{ color: '#00e676', fontSize: 22 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#f0f2f5' }}>
              Hunt Complete —{' '}
              <span style={{ color: selectedOption.color }}>
                {HUNT_OPTIONS.find((o) => o.value === huntMeta.hunt_type)?.label || huntMeta.hunt_type}
              </span>
            </Typography>
            <Typography variant="caption" sx={{ color: '#8c909e' }}>
              Target: <strong style={{ color: '#fff' }}>{huntMeta.target_host}</strong>
              &nbsp;·&nbsp;
              {huntMeta.row_count} rows returned
            </Typography>
          </Box>
          <Chip
            label={`${huntMeta.row_count} RESULTS`}
            size="small"
            sx={{
              bgcolor: huntMeta.row_count > 0 ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.06)',
              color: huntMeta.row_count > 0 ? '#00e676' : '#8c909e',
              border: '1px solid',
              borderColor: huntMeta.row_count > 0 ? 'rgba(0,230,118,0.3)' : 'rgba(255,255,255,0.1)',
              fontWeight: 'bold',
              fontSize: 10,
              letterSpacing: 0.5,
            }}
          />
        </Paper>
      )}

      {/* ── Results Data Grid ─────────────────────────────────────────────── */}
      {results !== null && !loading && (
        <Paper className="glass-panel" sx={{ p: 0, overflow: 'hidden' }}>
          {/* Table header bar */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(9,10,15,0.6)',
            }}
          >
            <BugReportIcon sx={{ color: '#f05a28', fontSize: 18 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#f0f2f5', fontSize: 13 }}>
              Live Hunt Results
            </Typography>
            {columns.length > 0 && (
              <Typography variant="caption" sx={{ color: '#8c909e', ml: 0.5 }}>
                · {columns.length} columns auto-detected
              </Typography>
            )}
          </Box>

          {results.length === 0 ? (
            <Box
              sx={{
                py: 8,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <HourglassEmptyIcon sx={{ color: '#8c909e', fontSize: 42 }} />
              <Typography variant="subtitle2" sx={{ color: '#8c909e', fontWeight: 'bold' }}>
                No results returned for this hunt
              </Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                Velociraptor found no matching records · Try a different host or hunt type
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 520, overflowX: 'auto' }} className="interactive-table">
              <Table size="small" stickyHeader>
                {/* Dynamic column headers — built from Object.keys(results[0]) */}
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        bgcolor: '#0d0e16',
                        color: '#8c909e',
                        fontSize: 10,
                        fontWeight: 'bold',
                        letterSpacing: 0.6,
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        py: 1.2,
                        px: 2,
                        width: 44,
                        textAlign: 'center',
                      }}
                    >
                      #
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell
                        key={col}
                        sx={{
                          bgcolor: '#0d0e16',
                          color: '#8c909e',
                          fontSize: 10,
                          fontWeight: 'bold',
                          letterSpacing: 0.6,
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          py: 1.2,
                          px: 2,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.toUpperCase()}
                      </TableCell>
                    ))}                      {/* Kasm Action column header */}
                      <TableCell
                        sx={{
                          bgcolor: '#0d0e16',
                          color: '#8c909e',
                          fontSize: 10,
                          fontWeight: 'bold',
                          letterSpacing: 0.6,
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          py: 1.2,
                          px: 2,
                          whiteSpace: 'nowrap',
                          width: 160,
                          textAlign: 'center',
                        }}
                      >
                        ACTIONS
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {results.map((row, rowIdx) => {
                      const indicator = _findIndicatorInRow(row);
                      return (
                        <TableRow
                          key={rowIdx}
                          hover
                          sx={{
                            '& td': {
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              py: 1,
                              px: 2,
                              fontSize: 12,
                              color: '#d0d3dc',
                              transition: 'background 0.15s ease',
                            },
                            '&:hover td': { bgcolor: 'rgba(240,90,40,0.04)' },
                          }}
                        >
                          {/* Row index */}
                          <TableCell
                            sx={{
                              color: '#555',
                              fontSize: 10,
                              fontFamily: 'monospace',
                              textAlign: 'center',
                            }}
                          >
                            {rowIdx + 1}
                          </TableCell>

                          {/* Dynamic data cells */}
                          {columns.map((col) => {
                            const val = row[col];
                            const displayVal = val == null ? '—' : String(val);
                            const colour = _cellColour(col, val);

                            return (
                              <TableCell key={col}>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontFamily:
                                      col.toLowerCase().includes('command') ||
                                      col.toLowerCase().includes('executable') ||
                                      col.toLowerCase().includes('ip') ||
                                      col.toLowerCase().includes('port')
                                        ? 'monospace'
                                        : 'inherit',
                                    fontSize: 11.5,
                                    color: colour,
                                    fontWeight: colour !== 'inherit' ? 'bold' : 'normal',
                                    display: 'block',
                                    maxWidth: 240,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={displayVal}
                                >
                                  {displayVal}
                                </Typography>
                              </TableCell>
                            );
                          })}

                          {/* Kasm Investigate action cell */}
                          <TableCell sx={{ textAlign: 'center', py: 0.6 }}>
                            {indicator ? (
                              <Box
                                component="button"
                                onClick={() => handleInvestigateInKasm(indicator)}
                                disabled={kasmLoading}
                                title={`Investigate ${indicator} in Kasm Remote Browser`}
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.6,
                                  px: 1.2,
                                  py: 0.5,
                                  borderRadius: '6px',
                                  border: '1px solid rgba(240,90,40,0.25)',
                                  bgcolor: 'rgba(240,90,40,0.08)',
                                  color: '#f05a28',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  fontFamily: 'inherit',
                                  whiteSpace: 'nowrap',
                                  '&:hover': {
                                    bgcolor: 'rgba(240,90,40,0.18)',
                                    borderColor: 'rgba(240,90,40,0.5)',
                                    boxShadow: '0 0 12px rgba(240,90,40,0.2)',
                                  },
                                  '&:active': {
                                    transform: 'scale(0.96)',
                                  },
                                  '&.Mui-disabled, &:disabled': {
                                    opacity: 0.5,
                                    cursor: 'not-allowed',
                                  },
                                }}
                              >
                                <OpenInNewIcon sx={{ fontSize: 13 }} />
                                Investigate in Kasm
                              </Box>
                            ) : (
                              <Typography
                                variant="caption"
                                sx={{ color: '#3a3c46', fontSize: 10, fontStyle: 'italic' }}
                              >
                                No indicator
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* ── Kasm Remote Browser Isolation Modal ───────────────────────── */}
      <KasmBrowserModal
        open={kasmModalOpen}
        kasmUrl={kasmModalUrl}
        indicator={kasmLoading ? 'Requesting Kasm session...' : kasmIndicator}
        onClose={handleCloseKasmModal}
      />

      {/* ── Empty state when hunt hasn't been run ────────────────────────── */}
      {results === null && !loading && !error && (
        <Paper
          className="glass-panel"
          sx={{
            p: 6,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            border: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: 'rgba(240,90,40,0.08)',
              border: '2px dashed rgba(240,90,40,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrackChangesIcon sx={{ fontSize: 34, color: 'rgba(240,90,40,0.5)' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#8c909e', mt: 0.5 }}>
            No Hunt Executed Yet
          </Typography>
          <Typography variant="caption" sx={{ color: '#555', maxWidth: 380, lineHeight: 1.6 }}>
            Select a hunting objective, set your target host, and click{' '}
            <strong style={{ color: '#f05a28' }}>Execute Live Hunt</strong> to stream real-time
            endpoint telemetry from Velociraptor.
          </Typography>
          <Divider sx={{ width: '60%', borderColor: 'rgba(255,255,255,0.06)', my: 0.5 }} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            {HUNT_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                size="small"
                onClick={() => setHuntType(opt.value)}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.04)',
                  color: opt.color,
                  border: `1px solid ${opt.color}33`,
                  cursor: 'pointer',
                  fontSize: 11,
                  '&:hover': {
                    bgcolor: `${opt.color}14`,
                  },
                }}
              />
            ))}
          </Box>
        </Paper>
      )}

    </Box>
  );
}

export default ThreatHunting;
