// Audit du 2026-11-24 (migration 14) : constats démontrés puis corrigés.
// - Un gestionnaire pouvait déplacer l'ouverture de la capsule dans le passé (ouverture immédiate, irréversible).
// - Export des données du compte : seulement ses propres données, rien de privé appartenant à d'autres.
// - Purge des données temporaires (adresses d'invitation, file d'e-mails, notifications anciennes).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, createUser, as, errorOf, createEvent, invite, join, joinAsBeneficiary, inDays } from './helpers.mjs';

let db, lea, sarah, tom, camille;
before(async () => {
  db = await freshDb();
  lea = await createUser(db, 'Lea');
  sarah = await createUser(db, 'Sarah');
  tom = await createUser(db, 'Tom');
  camille = await createUser(db, 'Camille');
});
const one = async (uid, sql, params = []) => (await as(db, uid, sql, params)).rows[0];

test('dates : l’ouverture de la capsule ne peut pas être déplacée dans le passé (même par un gestionnaire)', async () => {
  const ev = await createEvent(db, lea);
  await join(db, sarah, (await invite(db, lea, ev, 'co_organizer')).token);
  await as(db, sarah, `insert into public.capsule_entries (event_id, body) values ($1, 'brouillon pas fini')`, [ev]);
  for (const who of [lea, sarah]) {
    assert.match(
      await errorOf(as(db, who, `update public.events set votes_close_at = now() - interval '2 hours', contributions_close_at = now() - interval '2 hours', reveal_at = now() - interval '1 hour' where id = $1`, [ev])),
      /reveal_in_past/,
    );
  }
  assert.equal((await one(lea, `select public.is_revealed($1) as r`, [ev])).r, false, 'capsule toujours scellée');
  // Avancer l'ouverture à une date future reste possible.
  await as(db, lea, `update public.events set reveal_at = $2, gift_at = $2 where id = $1`, [ev, inDays(40)]);
  assert.equal((await one(lea, `select reveal_at > now() as ok from public.events where id = $1`, [ev])).ok, true);
});

test('export des données : mes données seulement, rien de privé des autres membres', async () => {
  const ev = await createEvent(db, lea, { title: 'Pot de départ de Tom' });
  await join(db, sarah, (await invite(db, lea, ev)).token);
  await joinAsBeneficiary(db, lea, ev, tom);
  await as(db, sarah, `insert into public.messages (event_id, body) values ($1, 'message de Sarah')`, [ev]);
  await as(db, lea, `insert into public.messages (event_id, body) values ($1, 'message de Léa')`, [ev]);
  await as(db, sarah, `insert into public.capsule_entries (event_id, body) values ($1, 'brouillon de Sarah')`, [ev]);
  await as(db, lea, `insert into public.capsule_entries (event_id, body, status) values ($1, 'mot de Léa', 'published')`, [ev]);
  const { rows: [c] } = await as(db, lea, `select (public.contribution_create($1, 2500, 'cle-export-0001')).id`, [ev]);
  await as(db, 'service', `select public.contribution_settle($1, true, 'sim')`, [c.id]);
  const { rows: [c2] } = await as(db, sarah, `select (public.contribution_create($1, 4200, 'cle-export-0002')).id`, [ev]);
  await as(db, 'service', `select public.contribution_settle($1, true, 'sim')`, [c2.id]);

  const x = (await one(lea, `select public.export_my_data() as x`)).x;
  const s = JSON.stringify(x);
  assert.equal(x.account.email, 'lea@test.local');
  assert.ok(s.includes('message de Léa') && s.includes('mot de Léa'));
  assert.ok(!s.includes('message de Sarah') && !s.includes('brouillon de Sarah'), 'contenus des autres absents');
  assert.ok(!s.includes('4200'), 'participation de Sarah absente');
  assert.equal(x.contributions[0].amount_cents, 2500);
  assert.ok(x.memberships.some((m) => m.title === 'Pot de départ de Tom' && m.role === 'organizer'));
  // La personne fêtée n'apprend rien de la surprise par l'export avant l'ouverture.
  const t = (await one(tom, `select public.export_my_data() as x`)).x;
  const m = t.memberships.find((r) => r.event_id === ev);
  assert.equal(m.role, 'beneficiary');
  assert.equal(m.title, null, 'titre caché avant l’ouverture');
  assert.ok(!JSON.stringify(t).includes('Pot de départ'));
  assert.match(await errorOf(as(db, null, `select public.export_my_data()`)), /permission denied/);
});

test('purge : adresses d’invitation expirées effacées, file d’e-mails et notifications anciennes supprimées', async () => {
  const ev = await createEvent(db, lea);
  const r = (await one(lea, `select public.prepare_email_invitation($1, 'participant', 'ancien@exemple.fr') as r`, [ev])).r;
  const fresh = (await one(lea, `select public.prepare_email_invitation($1, 'participant', 'recent@exemple.fr') as r`, [ev])).r;
  await db.query(`update public.invitations set expires_at = now() - interval '40 days', created_at = now() - interval '47 days' where id = $1`, [r.invitation_id]);
  await db.query(`update public.email_outbox set status = 'sent', created_at = now() - interval '40 days' where dedupe_key = $1`, [`invitation:${r.invitation_id}`]);
  await db.query(`insert into public.notifications (user_id, kind, data, read_at, created_at, dedupe_key) values ($1, 'friend_request', '{}', now() - interval '200 days', now() - interval '200 days', 'vieille')`, [lea]);
  assert.match(await errorOf(as(db, lea, `select public.purge_stale_data()`)), /permission denied/, 'réservée au serveur');
  const n = (await one('service', `select public.purge_stale_data() as n`)).n;
  assert.ok(n.invitations_anonymized >= 1 && n.outbox_deleted >= 1 && n.notifications_deleted >= 1, JSON.stringify(n));
  const old = (await db.query(`select email_hash, email_hint from public.invitations where id = $1`, [r.invitation_id])).rows[0];
  assert.deepEqual(old, { email_hash: null, email_hint: null });
  const kept = (await db.query(`select email_hash is not null as h from public.invitations where id = $1`, [fresh.invitation_id])).rows[0];
  assert.equal(kept.h, true, 'invitation en cours conservée');
  assert.equal((await db.query(`select count(*)::int as n from public.email_outbox where to_email = 'ancien@exemple.fr'`)).rows[0].n, 0);
});
