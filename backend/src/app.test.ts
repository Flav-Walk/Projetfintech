import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { ContributionResponse } from '@complice/shared';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { GatewayError, type ClaimedEmail, type DataGateway } from './gateway.js';
import { renderEmail } from './email-templates.js';
import { BrevoMailer, MailerError, type Mailer, type OutgoingEmail } from './mailer.js';
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
  // File d'e-mails en mémoire (même logique que claim_email_batch / complete_email).
  outbox: (ClaimedEmail & { status: string })[] = [];
  invitations: { eventId: string; role: string; email: string }[] = [];
  async prepareEmailInvitation(_jwt: string, eventId: string, role: string, email: string) {
    if (eventId === FORBIDDEN_EVENT) throw new GatewayError('forbidden', 403);
    const dup = this.invitations.some((i) => i.eventId === eventId && i.email === email.toLowerCase());
    if (dup) return { status: 'already_sent' as const };
    this.invitations.push({ eventId, role, email: email.toLowerCase() });
    this.outbox.push({
      id: this.outbox.length + 1, kind: 'invitation', to_email: email.toLowerCase(), event_id: eventId, attempts: 0, status: 'pending',
      payload: { token: 'b'.repeat(64), event_title: 'Les 25 ans de <Camille>', inviter_name: 'Léa', role },
    });
    return { status: 'queued' as const };
  }
  async claimEmails(limit: number) {
    const due = this.outbox.filter((r) => r.status === 'pending' && r.attempts < 3).slice(0, limit);
    for (const r of due) {
      r.status = 'sending';
      r.attempts++;
    }
    return due.map((r) => ({ ...r }));
  }
  async completeEmail(id: number, ok: boolean, _p: string | null, _e: string | null, final = false) {
    const r = this.outbox.find((x) => x.id === id)!;
    r.status = ok ? 'sent' : r.attempts >= 3 || final ? 'failed' : 'pending';
  }
}

const FORBIDDEN_EVENT = '33333333-3333-4333-8333-333333333333';

class FakeMailer implements Mailer {
  configured = true;
  sent: OutgoingEmail[] = [];
  failWith: MailerError | null = null;
  async send(email: OutgoingEmail) {
    if (this.failWith) throw this.failWith;
    this.sent.push(email);
    return { messageId: `<${this.sent.length}@brevo>` };
  }
}

const config = loadConfig({
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_000000',
});

let gateway: FakeGateway;
let mailer: FakeMailer;
beforeEach(() => {
  gateway = new FakeGateway();
  mailer = new FakeMailer();
});

const app = () => buildApp({ config, gateway, payments: new SimulatedPaymentProvider(), mailer });
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

test('lien d’événement (e-mail) : page neutre vers la capsule', async () => {
  const a = await app();
  const ok = await a.inject({ method: 'GET', url: `/e/${EVENT}` });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.body, new RegExp(`complice://event/${EVENT}/capsule`));
  assert.equal((await a.inject({ method: 'GET', url: '/e/pas-un-uuid' })).statusCode, 404);
});

test('invitation par e-mail : authentification, validation, doublon, envoi', async () => {
  const a = await app();
  const url = '/v1/invitations/email';
  assert.equal((await a.inject({ method: 'POST', url, payload: { event_id: EVENT, email: 'ami@exemple.fr' } })).statusCode, 401);
  assert.equal((await a.inject({ method: 'POST', url, headers: auth, payload: { event_id: EVENT, email: 'pas-une-adresse' } })).statusCode, 400);
  assert.equal((await a.inject({ method: 'POST', url, headers: auth, payload: { event_id: EVENT, email: 'a@b.fr', role: 'organizer' } })).statusCode, 400);
  assert.equal((await a.inject({ method: 'POST', url, headers: auth, payload: { event_id: FORBIDDEN_EVENT, email: 'a@b.fr' } })).statusCode, 403);
  const res = await a.inject({ method: 'POST', url, headers: auth, payload: { event_id: EVENT, email: 'Ami@Exemple.fr' } });
  assert.equal(res.statusCode, 202);
  assert.equal(res.json().status, 'queued');
  await a.outbox.drain();
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'ami@exemple.fr');
  assert.match(mailer.sent[0].html, /https:\/\/complice-api\.onrender\.com\/i\/b{64}/);
  const again = await a.inject({ method: 'POST', url, headers: auth, payload: { event_id: EVENT, email: 'ami@exemple.fr' } });
  assert.equal(again.json().status, 'already_sent');
  await a.outbox.drain();
  assert.equal(mailer.sent.length, 1, 'aucun second e-mail');
});

test('invitation par e-mail : refusée proprement sans Brevo configuré', async () => {
  mailer.configured = false;
  const a = await app();
  const res = await a.inject({ method: 'POST', url: '/v1/invitations/email', headers: auth, payload: { event_id: EVENT, email: 'a@b.fr' } });
  assert.equal(res.statusCode, 503);
  assert.equal(res.json().error, 'email_not_configured');
  assert.equal(gateway.invitations.length, 0, 'aucune invitation créée pour rien');
  assert.equal((await a.inject({ method: 'GET', url: '/health' })).json().email_configured, false);
});

test('file d’e-mails : erreur temporaire retentée, erreur définitive abandonnée', async () => {
  const a = await app();
  mailer.failWith = new MailerError('brevo_503', true);
  await a.inject({ method: 'POST', url: '/v1/invitations/email', headers: auth, payload: { event_id: EVENT, email: 'un@b.fr' } });
  // L'endpoint déclenche un premier envoi en arrière-plan : on attend qu'il ait échoué, puis on relance.
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(gateway.outbox[0].attempts, 1);
  gateway.outbox[0].status = 'pending';
  let r = await a.outbox.drain();
  assert.deepEqual([r.sent, r.retried, r.failed], [0, 1, 0]);
  assert.equal(gateway.outbox[0].status, 'pending');
  mailer.failWith = new MailerError('brevo_400_invalid_parameter', false);
  r = await a.outbox.drain();
  assert.deepEqual([r.sent, r.retried, r.failed], [0, 0, 1]);
  assert.equal(gateway.outbox[0].status, 'failed');
  const drained = await a.inject({ method: 'POST', url: '/internal/outbox/drain' });
  assert.equal(drained.statusCode, 200);
  assert.equal(drained.json().sent, 0);
});

test('modèles d’e-mails : contenu échappé, aucune donnée financière', () => {
  const inv = renderEmail({ id: 1, kind: 'invitation', to_email: 'a@b.fr', event_id: EVENT,
    payload: { token: 'c'.repeat(64), event_title: '<script>x</script>', inviter_name: 'Léa', beneficiary_name: 'Camille', role: 'participant' } }, 'https://api.test/');
  assert.doesNotMatch(inv.html, /<script>x/);
  assert.match(inv.html, /&lt;script&gt;/);
  assert.match(inv.text, /https:\/\/api\.test\/i\/c{64}/);
  const cap = renderEmail({ id: 2, kind: 'capsule_open', to_email: 'c@b.fr', event_id: EVENT,
    payload: { event_title: 'Les 25 ans', beneficiary_name: 'Camille', is_beneficiary: true, display_name: 'Camille' } }, 'https://api.test');
  assert.match(cap.subject, /Ta capsule/);
  assert.match(cap.html, new RegExp(`https://api.test/e/${EVENT}`));
  for (const e of [inv, cap]) assert.doesNotMatch(e.html + e.text, /€|montant|cagnotte de \d|prix/i);
  assert.throws(() => renderEmail({ id: 3, kind: 'invitation', to_email: 'a@b.fr', event_id: EVENT, payload: {} }, 'https://api.test'));
});

test('Brevo : requête conforme, clé jamais renvoyée dans une erreur', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = new BrevoMailer('xkeysib-secret-test-key-0000000', 'contact@complice.app', 'COMPLICE', (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ messageId: '<m1@brevo>' }), { status: 201 });
  }) as typeof fetch);
  const res = await ok.send({ to: 'a@b.fr', subject: 'S', html: '<p>h</p>', text: 't', tag: 'invitation' });
  assert.equal(res.messageId, '<m1@brevo>');
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body.sender, { email: 'contact@complice.app', name: 'COMPLICE' });
  assert.deepEqual(body.to, [{ email: 'a@b.fr' }]);
  const ko = new BrevoMailer('xkeysib-secret-test-key-0000000', 'contact@complice.app', 'COMPLICE', (async () =>
    new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: 401 })) as typeof fetch);
  await assert.rejects(ko.send({ to: 'a@b.fr', subject: 'S', html: 'h', text: 't', tag: 'x' }), (e: MailerError) => {
    assert.equal(e.retryable, false);
    assert.doesNotMatch(e.message, /xkeysib/);
    return true;
  });
  const down = new BrevoMailer('xkeysib-secret-test-key-0000000', 'contact@complice.app', 'COMPLICE', (async () => new Response('', { status: 503 })) as typeof fetch);
  await assert.rejects(down.send({ to: 'a@b.fr', subject: 'S', html: 'h', text: 't', tag: 'x' }), (e: MailerError) => e.retryable === true);
  assert.equal(new BrevoMailer(undefined, 'contact@complice.app', 'COMPLICE').configured, false);
});
