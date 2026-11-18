import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PublicIcon from '@mui/icons-material/Public';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * KasmBrowserModal – Remote Browser Isolation overlay
 *
 * Renders a full-screen modal with an <iframe> pointed at the Kasm Workspaces
 * session URL returned by the POST /api/v1/kasm/request endpoint.
 *
 * If the Kasm server is unreachable (e.g. no Kasm server running locally),
 * the modal displays a helpful fallback message so the user knows what's
 * happening rather than staring at a blank white iframe.
 *
 * Props:
 *   open        : boolean   – show/hide the modal
 *   kasmUrl     : string    – the destination URL for the iframe
 *   indicator   : string    – the original indicator being investigated
 *   onClose     : () => void
 */
const IFRAME_TIMEOUT_MS = 10000; // 10 seconds before showing fallback

function KasmBrowserModal({ open, kasmUrl, indicator, onClose }) {
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const timeoutRef = useRef(null);

  /* ── Timeout: if iframe doesn't load within IFRAME_TIMEOUT_MS, show fallback ── */
  useEffect(() => {
    if (!open || !kasmUrl) return;

    // Reset state when a new URL is provided
    setIframeError(false);
    setIframeLoaded(false);

    timeoutRef.current = setTimeout(() => {
      // Only trigger if the iframe hasn't successfully loaded yet
      setIframeLoaded((loaded) => {
        if (!loaded) {
          setIframeError(true);
          return true; // mark as "loaded" (into error state)
        }
        return loaded;
      });
    }, IFRAME_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [open, kasmUrl]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleIframeError = useCallback(() => {
    setIframeError(true);
    setIframeLoaded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleRetry = useCallback(() => {
    setIframeError(false);
    setIframeLoaded(false);
    // Restart timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIframeLoaded((loaded) => {
        if (!loaded) {
          setIframeError(true);
          return true;
        }
        return loaded;
      });
    }, IFRAME_TIMEOUT_MS);
  }, []);

  if (!open || !kasmUrl) return null;

  // Extract domain from URL for display
  let kasmDomain = 'Kasm Server';
  try {
    kasmDomain = new URL(kasmUrl).hostname;
  } catch (e) {
    // ignore
  }

  return (
    <Box
      onClick={handleBackdropClick}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        bgcolor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        animation: 'fadeIn 0.2s ease-out',
        '@keyframes fadeIn': {
          '0%':   { opacity: 0 },
          '100%': { opacity: 1 },
        },
      }}
    >
      {/* ── Header bar ───────────────────────────────────────────────── */}
      <Paper
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1.2,
          mb: 1,
          bgcolor: '#0d0e16',
          border: '1px solid rgba(240,90,40,0.25)',
          borderRadius: 1,
          flexShrink: 0,
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #f05a28 0%, #ff8c42 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(240,90,40,0.35)',
          }}
        >
          <PublicIcon sx={{ fontSize: 18, color: '#fff' }} />
        </Box>

        {/* Title info */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, color: '#f0f2f5', fontSize: 13 }}
          >
            Kasm Remote Browser Isolation
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#9598a3',
              fontSize: 11,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Investigating: <span style={{ color: '#f05a28' }}>{indicator}</span>
          </Typography>
        </Box>

        {/* Status indicator */}
        {iframeError ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1,
              py: 0.3,
              borderRadius: '12px',
              bgcolor: 'rgba(255,23,68,0.1)',
              border: '1px solid rgba(255,23,68,0.25)',
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ff1744' }} />
            <Typography variant="caption" sx={{ color: '#ff1744', fontSize: 10, fontWeight: 600 }}>
              Unreachable
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1,
              py: 0.3,
              borderRadius: '12px',
              bgcolor: 'rgba(0,230,118,0.1)',
              border: '1px solid rgba(0,230,118,0.25)',
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: '#00e676',
                animation: iframeLoaded ? 'none' : 'pulse 1.2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 0.4 },
                  '50%': { opacity: 1 },
                },
              }}
            />
            <Typography variant="caption" sx={{ color: '#00e676', fontSize: 10, fontWeight: 600 }}>
              {iframeLoaded ? 'Connected' : 'Connecting...'}
            </Typography>
          </Box>
        )}

        {/* Open in new tab */}
        <IconButton
          component="a"
          href={kasmUrl}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          sx={{
            color: '#8c909e',
            '&:hover': { color: '#00b0ff', bgcolor: 'rgba(0,176,255,0.08)' },
          }}
          title="Open in new tab"
        >
          <OpenInNewIcon sx={{ fontSize: 18 }} />
        </IconButton>

        {/* Close button */}
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: '#8c909e',
            '&:hover': { color: '#ff1744', bgcolor: 'rgba(255,23,68,0.08)' },
          }}
          title="Close"
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Paper>

      {/* ── Iframe / Fallback container ───────────────────────────────── */}
      <Box
        sx={{
          flexGrow: 1,
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.06)',
          bgcolor: '#090a0f',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Show fallback overlay when iframe errors */}
        {iframeError ? (
          <Box
            sx={{
              textAlign: 'center',
              px: 4,
              py: 6,
              maxWidth: 520,
            }}
          >
            <CloudOffIcon sx={{ fontSize: 56, color: 'rgba(255,255,255,0.08)', mb: 2 }} />
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: '#e3e4e8', mb: 1 }}
            >
              Kasm Workspaces Not Reachable
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: '#9598a3', mb: 2.5, lineHeight: 1.6, fontSize: 13 }}
            >
              The Kasm Remote Browser Isolation server at{' '}
              <span style={{ color: '#f05a28', fontFamily: 'monospace', fontSize: 12 }}>
                {kasmDomain}
              </span>{' '}
              could not be reached. This is expected in development mode.
            </Typography>

            <Paper
              sx={{
                p: 2,
                mb: 3,
                bgcolor: 'rgba(240,90,40,0.06)',
                border: '1px solid rgba(240,90,40,0.15)',
                textAlign: 'left',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#f05a28',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: 1,
                }}
              >
                <WarningAmberIcon sx={{ fontSize: 14 }} />
                How to Connect
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 0.8, fontSize: 11, lineHeight: 1.5 }}>
                1. Deploy a Kasm Workspaces server and note its hostname
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', mb: 0.8, fontSize: 11, lineHeight: 1.5 }}>
                2. Update{' '}
                <span style={{ color: '#e3e4e8', fontFamily: 'monospace' }}>
                  KASM_BASE_URL
                </span>{' '}
                in{' '}
                <span style={{ color: '#e3e4e8', fontFamily: 'monospace' }}>
                  backend/app/api/v1/endpoints_kasm.py
                </span>
              </Typography>
              <Typography variant="caption" sx={{ color: '#8c909e', display: 'block', fontSize: 11, lineHeight: 1.5 }}>
                3. Replace the URL builder with a real Kasm session API call
              </Typography>
            </Paper>

            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleRetry}
                sx={{
                  color: '#00b0ff',
                  borderColor: 'rgba(0,176,255,0.3)',
                  fontSize: 12,
                  '&:hover': { borderColor: '#00b0ff', bgcolor: 'rgba(0,176,255,0.06)' },
                }}
              >
                Retry Connection
              </Button>
              <Button
                variant="outlined"
                size="small"
                component="a"
                href={kasmUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                sx={{
                  color: '#f05a28',
                  borderColor: 'rgba(240,90,40,0.3)',
                  fontSize: 12,
                  '&:hover': { borderColor: '#f05a28', bgcolor: 'rgba(240,90,40,0.06)' },
                }}
              >
                Open in New Tab
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            {/* Loading overlay while iframe loads */}
            {!iframeLoaded && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: '#090a0f',
                  zIndex: 1,
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: '2px solid rgba(240,90,40,0.15)',
                    borderTopColor: '#f05a28',
                    animation: 'spin 0.8s linear infinite',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
                <Typography variant="caption" sx={{ color: '#9598a3', fontSize: 11 }}>
                  Connecting to Kasm Workspaces...
                </Typography>
              </Box>
            )}

            <iframe
              src={kasmUrl}
              title="Kasm Remote Browser Isolation"
              width="100%"
              height="100%"
              style={{
                border: 'none',
                display: 'block',
              }}
              allow="camera; microphone; clipboard-read; clipboard-write; autoplay; fullscreen"
              onError={handleIframeError}
              onLoad={handleIframeLoad}
            />
          </>
        )}
      </Box>

      {/* ── Footer hint ───────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.8,
          mt: 1,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: iframeError ? '#ff1744' : (iframeLoaded ? '#00e676' : '#ff9100'),
            boxShadow: iframeError ? '0 0 6px #ff1744' : (iframeLoaded ? '0 0 6px #00e676' : '0 0 6px #ff9100'),
          }}
        />
        <Typography variant="caption" sx={{ color: '#666', fontSize: 10 }}>
          {iframeError
            ? 'Kasm server unreachable · Update KASM_BASE_URL in backend config when server is deployed'
            : (iframeLoaded
              ? 'Secure remote browser session · Traffic routed through Kasm Workspaces'
              : 'Establishing secure connection to Kasm Workspaces...')
          }
        </Typography>
      </Box>
    </Box>
  );
}

export default KasmBrowserModal;
