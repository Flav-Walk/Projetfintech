import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { ContributionResponse } from '@complice/shared';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { GatewayError, type DataGateway } from './gateway.js';
import { SimulatedPaymentProvider } from './payments.js';

const EVENT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

/** Double en mémoire qui reproduit l'idempotence de contribution_create / contribution_settle. */
class FakeGateway implements DataGateway {
  adminConfigured = true;
  rows = new Map<string, ContributionResponse>();
  byKey = new Map<string, string>();
  deleted: string[] = [];
  settleCalls = 0;

  async verifyUser(jwt: string) {
    return jwt === 'valid-jwt' ? { id: USER } : null;
  }
  async createContribution(_jwt: string, eventId: string, amount: number, key: string) {
    const existing = this.byKey.get(key);
    if (existing) {
      const c = this.rows.get(existing)!;
      if (c.amount_cents !== amount) throw new GatewayError('idempotency_conflict', 409);
      return c;
    }
    const id = `c${this.rows.size + 1}`.padEnd(36, '0');
    const c: ContributionResponse = {
      id, event_id: eventId, amount_cents: amount, fee_cents: 0, total_cents: amount, status: 'pending',
      is_simulated: true, failure_reason: null, created_at: new Date().toISOString(), settled_at: null,
    };
    this.rows.set(id, c);
    this.byKey.set(key, id);
    return c;
  }
  async settleContribution(id: string, success: boolean, _ref: string, reason?: string) {
    this.settleCalls++;
    const c = this.rows.get(id)!;
    if (c.status === 'pending') {
      c.status = success ? 'confirmed' : 'failed';
      c.failure_reason = success ? null : reason ?? null;
      c.settled_at = new Date().toISOString();
    }
    return c;
  }
  async listMyContributions() {
    return [...this.rows.values()];
  }
  async deleteAccount(userId: string) {
    this.deleted.push(userId);
  }
}

const config = loadConfig({
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_000000',
});

let gateway: FakeGateway;
beforeEach(() => {
  gateway = new FakeGateway();
});

const app = () => buildApp({ config, gateway, payments: new SimulatedPaymentProvider() });
const auth = { authorization: 'Bearer valid-jwt' };

test('GET /health', async () => {
  const res = await (await app()).inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, 'ok');
  assert.equal(res.json().payment_provider, 'simulated');
});

test('contributions : authentification obligatoire', async () => {
  const a = await app();
  assert.equal((await a.inject({ method: 'POST', url: '/v1/contributions', payload: {} })).statusCode, 401);
  assert.equal((await a.inject({ method: 'POST', url: '/v1/contributions', headers: { authorization: 'Bearer bad' }, payload: {} })).statusCode, 401);
});

test('contributions : validation du montant et de la clé', async () => {
  const a = await app();
  for (const payload of [
    { event_id: EVENT, amount_cents: 50, idempotency_key: 'abcdefgh1' },
    { event_id: EVENT, amount_cents: 15.5, idempotency_key: 'abcdefgh1' },
    { event_id: 'pas-un-uuid', amount_cents: 1500, idempotency_key: 'abcdefgh1' },
    { event_id: EVENT, amount_cents: 1500, idempotency_key: 'court' },
  ]) {
    const res = await a.inject({ method: 'POST', url: '/v1/contributions', headers: auth, payload });
    assert.equal(res.statusCode, 400, JSON.stringify(payload));
  }
});

test('contributions : succès puis requête rejouée sans double débit', async () => {
  const a = await app();
  const payload = { event_id: EVENT, amount_cents: 1500, idempotency_key: 'tentative-0001' };
  const first = await a.inject({ method: 'POST', url: '/v1/contributions', headers: auth, payload });
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().status, 'confirmed');
  const replay = await a.inject({ method: 'POST', url: '/v1/contributions', headers: auth, payload });
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.json().id, first.json().id);
  assert.equal(gateway.rows.size, 1);
  assert.equal(gateway.settleCalls, 1);
});

test('contributions : échec simulé puis nouvelle tentative', async () => {
  const a = await app();
  const fail = await a.inject({ method: 'POST', url: '/v1/contributions', headers: auth, payload: { event_id: EVENT, amount_cents: 2000, idempotency_key: 'tentative-0002', simulate: 'failure' } });
  assert.equal(fail.json().status, 'failed');
  assert.match(fail.json().failure_reason, /simulation/);
  const retry = await a.inject({ method: 'POST', url: '/v1/contributions', headers: auth, payload: { event_id: EVENT, amount_cents: 2000, idempotency_key: 'tentative-0003' } });
  assert.equal(retry.json().status, 'confirmed');
});

test('contributions : conflit de clé', async () => {
  const a = await app();
  await a.inject({ method: 'POST', url: '/v1/contributions', headers: auth, payload: { event_id: EVENT, amount_cents: 1500, idempotency_key: 'tentative-0004' } });
  const res = await a.inject({ method: 'POST', url: '/v1/contributions', headers: auth, payload: { event_id: EVENT, amount_cents: 3000, idempotency_key: 'tentative-0004' } });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().error, 'idempotency_conflict');
});

test('suppression de compte : confirmation explicite requise', async () => {
  const a = await app();
  assert.equal((await a.inject({ method: 'DELETE', url: '/v1/account', headers: auth, payload: {} })).statusCode, 400);
  const ok = await a.inject({ method: 'DELETE', url: '/v1/account', headers: auth, payload: { confirm: 'SUPPRIMER' } });
  assert.equal(ok.statusCode, 204);
  assert.deepEqual(gateway.deleted, [USER]);
});

test('lien d’invitation : page sans fuite, jeton validé', async () => {
  const a = await app();
  const token = 'a'.repeat(64);
  const res = await a.inject({ method: 'GET', url: `/i/${token}` });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, new RegExp(`complice://invite/${token}`));
  assert.equal(res.headers['cache-control'], 'no-store');
  const bad = await a.inject({ method: 'GET', url: '/i/<script>' });
  assert.equal(bad.statusCode, 404);
  assert.doesNotMatch(bad.body, /<script>alert/);
});
