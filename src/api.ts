import type { Claim, DashboardPayload, HealthPayload } from './types';
import { claims as mockClaims, roadmap as mockRoadmap } from './data';
import { dashboardMetrics } from './metrics';

const API_BASE = import.meta.env.VITE_KPORTUSSY_API_BASE_URL ?? '/api';

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${path} failed ${response.status}: ${text.slice(0, 180)}`);
  }
  return response.json() as Promise<T>;
}

export function mockDashboardPayload(): DashboardPayload {
  return {
    mode: 'mock',
    claims: mockClaims,
    roadmap: mockRoadmap,
    metrics: dashboardMetrics(mockClaims),
    events: [],
    generatedAt: new Date().toISOString()
  };
}

export const api = {
  health: () => jsonFetch<HealthPayload>('/health'),
  dashboard: () => jsonFetch<DashboardPayload>('/dashboard'),
  createClaim: (input: Partial<Claim>) => jsonFetch<Claim>('/claims', { method: 'POST', body: JSON.stringify(input) }),
  addEvidence: (claimId: string, input: Record<string, unknown>) => jsonFetch<Claim>(`/claims/${claimId}/evidence-links`, { method: 'POST', body: JSON.stringify(input) }),
  addVerification: (claimId: string, input: Record<string, unknown>) => jsonFetch<Claim>(`/claims/${claimId}/verifications`, { method: 'POST', body: JSON.stringify(input) }),
  updateStatus: (claimId: string, status: string) => jsonFetch<Claim>(`/claims/${claimId}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  recomputeTrust: (claimId: string) => jsonFetch<Claim>('/trust-signals/recompute', { method: 'POST', body: JSON.stringify({ claimId }) })
};
