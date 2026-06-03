import { useCallback, useEffect, useState } from 'react';
import { api, mockDashboardPayload } from './api';
import type { DashboardPayload, HealthPayload } from './types';

export function useDashboardData(refreshMs = 5000) {
  const [payload, setPayload] = useState<DashboardPayload>(() => mockDashboardPayload());
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextPayload, nextHealth] = await Promise.all([api.dashboard(), api.health()]);
      setPayload(nextPayload);
      setHealth(nextHealth);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPayload((current) => current.mode === 'mock' ? current : mockDashboardPayload());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => { void refresh(); }, refreshMs);
    return () => window.clearInterval(id);
  }, [paused, refresh, refreshMs]);

  return { ...payload, health, loading, error, paused, setPaused, refresh, lastUpdatedAt };
}
