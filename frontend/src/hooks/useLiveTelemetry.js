import API_BASE_URL from '../config/api.js';
/**
 * useLiveTelemetry
 * ─────────────────
 * React hook that opens a persistent WebSocket to the SpyderXDR backend and
 * streams live telemetry events + alerts.
 *
 * Usage:
 *   const { events, alerts, connected } = useLiveTelemetry();
 *
 * The hook auto-reconnects on disconnect with exponential back-off.
 * All state lives in memory (capped at maxItems).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = `ws://${window.location.hostname}:8001/api/v1/metrics`;
const LIVE_METRICS_URL = `${API_BASE_URL}/events/metrics/live`;
const MAX_EVENTS = 200;
const MAX_ALERTS = 100;

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickMetric = (source, keys) => {
  if (!source || typeof source !== 'object') return 0;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== null && source[key] !== '') {
      return source[key];
    }
  }
  return 0;
};

export default function useLiveTelemetry() {
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const retryMs = useRef(3000);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retryMs.current = 3000;
    };

    ws.onmessage = (e) => {
      try {
        const raw = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        const payload = raw.payload || raw.data || raw;
        const eventData = payload.event_data || payload.data || payload;
        const isMetricFrame =
          raw.type === 'metrics' ||
          payload.type === 'metrics' ||
          payload.event_type === 'metrics' ||
          payload.event_type === 'performance_metric' ||
          payload.event_type === 'cpu_ram_performance' ||
          payload.metric_type === 'performance_metric';

        const cpuValue = safeNumber(
          pickMetric(raw, ['cpu_percent', 'cpu_usage_percent', 'cpu_usage', 'cpu']) ||
          pickMetric(payload, ['cpu_percent', 'cpu_usage_percent', 'cpu_usage', 'cpu']) ||
          pickMetric(eventData, ['cpu_percent', 'cpu_usage_percent', 'cpu_usage', 'cpu'])
        );

        const memValue = safeNumber(
          pickMetric(raw, ['ram_percent', 'memory_percent', 'memory_usage_percent', 'memory_usage', 'memory']) ||
          pickMetric(payload, ['ram_percent', 'memory_percent', 'memory_usage_percent', 'memory_usage', 'memory']) ||
          pickMetric(eventData, ['ram_percent', 'memory_percent', 'memory_usage_percent', 'memory_usage', 'memory'])
        );

        if (isMetricFrame || cpuValue > 0 || memValue > 0) {
          setCpuUsage(prev => (cpuValue > 0 || prev <= 0 ? cpuValue : prev));
          setMemoryUsage(prev => (memValue > 0 || prev <= 0 ? memValue : prev));
        }

        if (raw.type === 'event') {
          setEvents(prev => [payload, ...prev].slice(0, MAX_EVENTS));
        } else if (raw.type === 'alert') {
          setAlerts(prev => [payload, ...prev].slice(0, MAX_ALERTS));
        } else if (isMetricFrame || payload.event_type || payload.metric_type) {
          setEvents(prev => [payload, ...prev].slice(0, MAX_EVENTS));
        }
      } catch (error) {
        console.warn('Failed to parse metric event:', error);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (wsRef.current === ws) {
        retryRef.current = setTimeout(() => {
          connect();
        }, retryMs.current);
      }
    };

    ws.onerror = (error) => {
      console.warn('WebSocket connection issue:', error);
      ws.close();
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 25_000);

    ws.addEventListener('close', () => clearInterval(pingInterval), { once: true });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitialMetrics = async () => {
      try {
        const res = await fetch(LIVE_METRICS_URL);
        if (!res.ok || cancelled) return;

        const data = await res.json();
        const payload = data.payload || data;
        const eventData = payload.event_data || payload.data || payload;
        const cpuValue = safeNumber(
          pickMetric(payload, ['cpu_percent', 'cpu_usage_percent', 'cpu_usage', 'cpu']) ||
          pickMetric(eventData, ['cpu_percent', 'cpu_usage_percent', 'cpu_usage', 'cpu']) ||
          pickMetric(data, ['cpu_percent', 'cpu_usage_percent', 'cpu_usage', 'cpu'])
        );
        const memValue = safeNumber(
          pickMetric(payload, ['ram_percent', 'memory_percent', 'memory_usage_percent', 'memory_usage', 'memory']) ||
          pickMetric(eventData, ['ram_percent', 'memory_percent', 'memory_usage_percent', 'memory_usage', 'memory']) ||
          pickMetric(data, ['ram_percent', 'memory_percent', 'memory_usage_percent', 'memory_usage', 'memory'])
        );

        if (Number.isFinite(cpuValue) && cpuValue > 0) {
          setCpuUsage(cpuValue);
        }
        if (Number.isFinite(memValue) && memValue > 0) {
          setMemoryUsage(memValue);
        }

        if ((cpuValue > 0 || memValue > 0) && !cancelled) {
          setEvents(prev => [{ type: 'metrics', payload: { event_type: 'cpu_ram_performance', event_data: eventData } }, ...prev].slice(0, MAX_EVENTS));
        }
      } catch (error) {
        console.warn('Failed to load initial live metrics snapshot:', error);
      }
    };

    loadInitialMetrics();
    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryRef.current);
      // Only close the WebSocket if it's fully open.
      // Avoids React StrictMode warning: "WebSocket is closed before the connection is established"
      // which happens when the first StrictMode render's cleanup closes a still-connecting socket.
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { events, alerts, connected, cpuUsage, memoryUsage };
}
