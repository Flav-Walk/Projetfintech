import type { ContributionResponse, CreateContributionRequest } from '@complice/shared';
import { env, isApiConfigured } from './env';
import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

/** Appel du backend avec le JWT de la session. Délai de 15 s pour les réseaux mobiles lents. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!isApiConfigured) throw new ApiError('api_not_configured', 0);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError('not_authenticated', 401);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (res.status === 204) return undefined as T;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(json.error ?? 'unknown', res.status);
    return json as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('network', 0);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  createContribution: (req: CreateContributionRequest) => request<ContributionResponse>('POST', '/v1/contributions', req),
  myContributions: (eventId?: string) =>
    request<{ contributions: ContributionResponse[] }>('GET', `/v1/contributions${eventId ? `?event_id=${eventId}` : ''}`),
  deleteAccount: () => request<void>('DELETE', '/v1/account', { confirm: 'SUPPRIMER' }),
  health: async () => {
    const res = await fetch(`${env.apiUrl}/health`);
    return (await res.json()) as { status: string; admin_configured: boolean };
  },
};
