import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ContributionResponse } from '@complice/shared';
import type { Config } from './config.js';

/**
 * Accès aux données du backend. Deux identités distinctes :
 *  - `asUser(jwt)` : requêtes sous l'identité de l'appelant, la RLS s'applique ;
 *  - `admin` : clé secrète, réservée au règlement des paiements et à la suppression de compte.
 * L'interface permet de remplacer Supabase par un double dans les tests.
 */
export interface DataGateway {
  readonly adminConfigured: boolean;
  verifyUser(jwt: string): Promise<{ id: string } | null>;
  createContribution(jwt: string, eventId: string, amountCents: number, idempotencyKey: string): Promise<ContributionResponse>;
  settleContribution(id: string, success: boolean, providerRef: string, failureReason?: string): Promise<ContributionResponse>;
  listMyContributions(jwt: string, eventId?: string): Promise<ContributionResponse[]>;
  deleteAccount(userId: string): Promise<void>;
}

export class GatewayError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

const CONTRIBUTION_COLUMNS = 'id, event_id, amount_cents, fee_cents, total_cents, status, is_simulated, failure_reason, created_at, settled_at';

function toGatewayError(error: { message?: string; code?: string } | null): GatewayError {
  const msg = error?.message ?? 'unknown';
  if (/permission denied|row-level security|forbidden/i.test(msg)) return new GatewayError('forbidden', 403);
  const code = /^[a-z_]+$/.test(msg) ? msg : 'unknown';
  return new GatewayError(code, code === 'unknown' ? 500 : 409);
}

export class SupabaseGateway implements DataGateway {
  private admin: SupabaseClient | null;
  readonly adminConfigured: boolean;

  constructor(private config: Config) {
    this.admin = config.SUPABASE_SECRET_KEY
      ? createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
    this.adminConfigured = this.admin !== null;
  }

  private asUser(jwt: string): SupabaseClient {
    return createClient(this.config.SUPABASE_URL, this.config.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
  }

  private requireAdmin(): SupabaseClient {
    if (!this.admin) throw new GatewayError('server_not_configured', 503);
    return this.admin;
  }

  async verifyUser(jwt: string) {
    const { data, error } = await this.asUser(jwt).auth.getUser(jwt);
    if (error || !data.user) return null;
    return { id: data.user.id };
  }

  async createContribution(jwt: string, eventId: string, amountCents: number, idempotencyKey: string) {
    const { data, error } = await this.asUser(jwt).rpc('contribution_create', {
      p_event: eventId,
      p_amount_cents: amountCents,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw toGatewayError(error);
    return pick(data as ContributionResponse);
  }

  async settleContribution(id: string, success: boolean, providerRef: string, failureReason?: string) {
    const { data, error } = await this.requireAdmin().rpc('contribution_settle', {
      p_contribution: id,
      p_success: success,
      p_provider_ref: providerRef,
      p_failure_reason: failureReason ?? null,
    });
    if (error) throw toGatewayError(error);
    return pick(data as ContributionResponse);
  }

  async listMyContributions(jwt: string, eventId?: string) {
    let q = this.asUser(jwt).from('contributions').select(CONTRIBUTION_COLUMNS).order('created_at', { ascending: false }).limit(100);
    if (eventId) q = q.eq('event_id', eventId);
    const { data, error } = await q;
    if (error) throw toGatewayError(error);
    return (data ?? []) as ContributionResponse[];
  }

  async deleteAccount(userId: string) {
    const admin = this.requireAdmin();
    // Photos de capsule de l'utilisateur : supprimées avec ses mots (contenu personnel).
    const { data: entries } = await admin.from('capsule_entries').select('photo_path').eq('author_id', userId).not('photo_path', 'is', null);
    const photos = (entries ?? []).map((e: { photo_path: string | null }) => e.photo_path).filter((p): p is string => !!p);
    if (photos.length > 0) await admin.storage.from('event-media').remove(photos);
    const { error } = await admin.rpc('prepare_account_deletion', { p_user: userId });
    if (error) throw toGatewayError(error);
    // Fichiers personnels : avatar et couvertures déposées par l'utilisateur.
    for (const [bucket, prefix] of [['avatars', userId], ['event-media', `${userId}/covers`]] as const) {
      const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      if (files && files.length > 0) {
        await admin.storage.from(bucket).remove(files.map((f) => `${prefix}/${f.name}`));
      }
    }
    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) throw new GatewayError('account_deletion_failed', 500);
  }
}

function pick(c: ContributionResponse): ContributionResponse {
  return {
    id: c.id, event_id: c.event_id, amount_cents: c.amount_cents, fee_cents: c.fee_cents, total_cents: c.total_cents,
    status: c.status, is_simulated: c.is_simulated, failure_reason: c.failure_reason, created_at: c.created_at, settled_at: c.settled_at,
  };
}
