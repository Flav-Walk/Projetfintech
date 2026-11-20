// Parcours MVP complet et compléments de la migration 20261120000600 (rappels, missions, discussion).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, createUser, as, errorOf, inDays, createEvent, invite, join } from './helpers.mjs';

let db;
let lea, sarah, camille, intrus;
let eventId;

/** Déplace les échéances en tant que propriétaire (simule le temps qui passe). */
async function setDates(patch) {
  const sets = Object.keys(patch).map((k, i) => `${k} = $${i + 2}`).join(', ');
  await db.query(`update public.events set ${sets} where id = $1`, [eventId, ...Object.values(patch)]);
}

before(async () => {
  db = await freshDb();
  lea = await createUser(db, 'Lea');
  sarah = await createUser(db, 'Sarah');
  camille = await createUser(db, 'Camille');
  intrus = await createUser(db, 'Intrus');
  eventId = await createEvent(db, lea);
  const inv = await invite(db, lea, eventId);
  assert.equal((await join(db, sarah, inv.token)).status, 'joined');
  const benef = await invite(db, lea, eventId, 'beneficiary');
  assert.equal((await join(db, camille, benef.token)).status, 'joined');
});

test('parcours : idée, vote, contribution, mission, message, capsule, puis dévoilement', async () => {
  // Idée avec lien et image au bon chemin
  const img = `${eventId}/proposals/${sarah}/a.jpg`;
  const { rows: [p] } = await as(db, sarah,
    `insert into public.proposals (event_id, title, price_cents, product_url, image_path) values ($1, 'Platine vinyle', 12900, 'https://exemple.fr/p', $2) returning id`,
    [eventId, img]);
  await as(db, sarah, `select public.cast_vote($1)`, [p.id]);
  await as(db, lea, `select public.cast_vote($1)`, [p.id]);
  const rank = await as(db, sarah, `select * from public.proposal_ranking($1)`, [eventId]);
  assert.equal(rank.rows[0].vote_count, 2);
  await as(db, lea, `select public.select_gift($1, $2)`, [eventId, p.id]);

  // Contribution : intention (utilisateur) puis règlement (serveur), rejouée sans doublon
  const c1 = await as(db, sarah, `select (public.contribution_create($1, 2500, 'cle-unique-1')).*`, [eventId]);
  const c2 = await as(db, sarah, `select (public.contribution_create($1, 2500, 'cle-unique-1')).*`, [eventId]);
  assert.equal(c1.rows[0].id, c2.rows[0].id);
  await as(db, 'service', `select public.contribution_settle($1, true, 'sim_1')`, [c1.rows[0].id]);
  await as(db, 'service', `select public.contribution_settle($1, true, 'sim_1')`, [c1.rows[0].id]);
  const fund = await as(db, lea, `select public.event_funding($1) as f`, [eventId]);
  assert.equal(fund.rows[0].f.collected_cents, 2500);
  assert.equal(fund.rows[0].f.my_confirmed_cents, 0, 'Léa ne voit pas le montant de Sarah');

  // Mission, message, capsule
  const { rows: [t] } = await as(db, sarah, `select id from public.tasks where event_id = $1 and kind = 'wrap'`, [eventId]);
  assert.equal((await as(db, sarah, `select public.claim_task($1) as r`, [t.id])).rows[0].r.status, 'claimed');
  await as(db, sarah, `select public.complete_task($1)`, [t.id]);
  await as(db, sarah, `insert into public.messages (event_id, body, client_id) values ($1, 'Je m’occupe du papier', 'c1')`, [eventId]);
  await as(db, sarah,
    `insert into public.capsule_entries (event_id, body, photo_path, status) values ($1, 'Joyeux anniversaire !', $2, 'published')`,
    [eventId, `${eventId}/capsule/${sarah}/photo.jpg`]);

  const badges = await as(db, sarah, `select badge from public.user_badges where event_id = $1 and user_id = $2 order by badge`, [eventId, sarah]);
  assert.deepEqual(badges.rows.map((r) => r.badge).sort(), ['contributor', 'helper', 'proposer', 'voter', 'wordsmith']);

  // Avant le dévoilement : le bénéficiaire ne voit rien
  assert.equal((await as(db, camille, `select id from public.capsule_entries where event_id = $1`, [eventId])).rows.length, 0);
  assert.equal((await as(db, camille, `select id from public.events where id = $1`, [eventId])).rows.length, 0);
  assert.equal((await as(db, camille, `select public.can_read_media($1) as ok`, [`${eventId}/capsule/${sarah}/photo.jpg`])).rows[0].ok, false);

  // Dévoilement
  await setDates({ votes_close_at: inDays(-3), contributions_close_at: inDays(-2), reveal_at: inDays(-1) });
  const caps = await as(db, camille, `select body from public.capsule_entries where event_id = $1`, [eventId]);
  assert.deepEqual(caps.rows.map((r) => r.body), ['Joyeux anniversaire !']);
  assert.equal((await as(db, camille, `select public.can_read_media($1) as ok`, [`${eventId}/capsule/${sarah}/photo.jpg`])).rows[0].ok, true);
  // Le bénéficiaire voit le cadeau retenu, jamais la discussion ni les montants
  assert.equal((await as(db, camille, `select id from public.proposals where event_id = $1`, [eventId])).rows.length, 1);
  assert.equal((await as(db, camille, `select id from public.messages where event_id = $1`, [eventId])).rows.length, 0);
  assert.equal((await as(db, camille, `select public.event_funding($1) as f`, [eventId])).rows[0].f, null);
  // Capsule scellée après l'ouverture
  assert.match(await errorOf(as(db, sarah, `update public.capsule_entries set body = 'modifié' where event_id = $1`, [eventId])), /capsule_sealed/);

  // Un extérieur ne voit rien, même après l'ouverture
  for (const sql of [
    `select id from public.capsule_entries where event_id = $1`,
    `select id from public.proposals where event_id = $1`,
    `select id from public.messages where event_id = $1`,
    `select id from public.tasks where event_id = $1`,
  ]) {
    assert.equal((await as(db, intrus, sql, [eventId])).rows.length, 0, sql);
  }
  assert.equal((await as(db, intrus, `select public.can_read_media($1) as ok`, [`${eventId}/capsule/${sarah}/photo.jpg`])).rows[0].ok, false);
});

test('image de proposition : chemin imposé (événement + auteur)', async () => {
  const other = await createEvent(db, lea);
  const bad = `${other}/proposals/${lea}/x.jpg`;
  const ev2 = await createEvent(db, lea);
  assert.match(await errorOf(as(db, lea,
    `insert into public.proposals (event_id, title, price_cents, image_path) values ($1, 'Idée', 1000, $2)`, [ev2, bad])), /invalid_image_path/);
  const { rows: [p] } = await as(db, lea, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Idée', 1000) returning id`, [ev2]);
  assert.match(await errorOf(as(db, lea, `update public.proposals set image_path = $2 where id = $1`, [p.id, bad])), /invalid_image_path/);
  await as(db, lea, `update public.proposals set image_path = $2 where id = $1`, [p.id, `${ev2}/proposals/${lea}/ok.jpg`]);
});

test('proposition retirée : définitif, voix libérées', async () => {
  const ev = await createEvent(db, lea);
  const { rows: [p] } = await as(db, lea, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Idée C', 1000) returning id`, [ev]);
  await as(db, lea, `select public.cast_vote($1)`, [p.id]);
  await as(db, lea, `update public.proposals set status = 'withdrawn' where id = $1`, [p.id]);
  assert.equal((await as(db, lea, `select count(*)::int as n from public.votes where event_id = $1`, [ev])).rows[0].n, 0);
  assert.match(await errorOf(as(db, lea, `update public.proposals set status = 'active' where id = $1`, [p.id])), /proposal_withdrawn/);
});

test('create_task : réservé aux gestionnaires, auteur imposé, attribution notifiée', async () => {
  const ev = await createEvent(db, lea);
  const inv = await invite(db, lea, ev);
  await join(db, sarah, inv.token);
  assert.match(await errorOf(as(db, sarah, `select public.create_task($1, 'Réserver le resto')`, [ev])), /forbidden/);
  const { rows: [r] } = await as(db, lea, `select public.create_task($1, 'Réserver le resto', $2, $3) as id`, [ev, inDays(3), sarah]);
  const t = await as(db, sarah, `select created_by, assignee_id, status, due_at from public.tasks where id = $1`, [r.id]);
  assert.equal(t.rows[0].created_by, lea);
  assert.equal(t.rows[0].assignee_id, sarah);
  assert.equal(t.rows[0].status, 'claimed');
  const n = await as(db, sarah, `select kind from public.notifications where kind = 'task_assigned' and event_id = $1`, [ev]);
  assert.equal(n.rows.length, 1);
  // Rouvrir une mission terminée : gestionnaire seulement
  await as(db, sarah, `select public.complete_task($1)`, [r.id]);
  assert.match(await errorOf(as(db, sarah, `select public.release_task($1)`, [r.id])), /forbidden/);
  await as(db, lea, `select public.release_task($1)`, [r.id]);
  assert.equal((await as(db, lea, `select status from public.tasks where id = $1`, [r.id])).rows[0].status, 'open');
});

test('deux membres prennent la même mission : un seul gagne', async () => {
  const ev = await createEvent(db, lea);
  const inv = await invite(db, lea, ev);
  await join(db, sarah, inv.token);
  const { rows: [t] } = await as(db, lea, `select id from public.tasks where event_id = $1 and kind = 'order'`, [ev]);
  const [a, b] = await Promise.all([
    as(db, lea, `select public.claim_task($1) as r`, [t.id]),
    as(db, sarah, `select public.claim_task($1) as r`, [t.id]),
  ]);
  const statuses = [a.rows[0].r.status, b.rows[0].r.status].sort();
  assert.deepEqual(statuses, ['claimed', 'taken']);
});

test('message : notifie les autres préparateurs ayant activé la préférence, une fois par heure', async () => {
  const ev = await createEvent(db, lea);
  const inv = await invite(db, lea, ev);
  await join(db, sarah, inv.token);
  await as(db, sarah, `update public.notification_prefs set messages = true where user_id = $1`, [sarah]);
  await as(db, lea, `insert into public.messages (event_id, body) values ($1, 'Salut')`, [ev]);
  await as(db, lea, `insert into public.messages (event_id, body) values ($1, 'Encore moi')`, [ev]);
  const n = await as(db, sarah, `select count(*)::int as n from public.notifications where kind = 'message' and event_id = $1`, [ev]);
  assert.equal(n.rows[0].n, 1);
  const self = await as(db, lea, `select count(*)::int as n from public.notifications where kind = 'message' and event_id = $1`, [ev]);
  assert.equal(self.rows[0].n, 0, 'pas de notification pour son propre message (et préférence désactivée par défaut)');
  assert.match(await errorOf(as(db, intrus, `insert into public.messages (event_id, body) values ($1, 'x')`, [ev])), /row-level security/);
});

test('rappels : fin de vote (non-votants) et ouverture de capsule, idempotents', async () => {
  const ev = await createEvent(db, lea, { votes: new Date(Date.now() + 6 * 3600e3).toISOString() });
  const inv = await invite(db, lea, ev);
  await join(db, sarah, inv.token);
  const { rows: [p] } = await as(db, lea, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Idée', 1000) returning id`, [ev]);
  await as(db, lea, `select public.cast_vote($1)`, [p.id]);

  assert.match(await errorOf(as(db, sarah, `select public.run_due_reminders()`)), /permission denied/);
  await as(db, sarah, `select public.refresh_reminders()`);
  await as(db, sarah, `select public.refresh_reminders()`);
  const vs = await as(db, sarah, `select count(*)::int as n from public.notifications where kind = 'vote_closing' and event_id = $1`, [ev]);
  assert.equal(vs.rows[0].n, 1, 'Sarah n’a pas voté : un seul rappel');
  const vl = await as(db, lea, `select count(*)::int as n from public.notifications where kind = 'vote_closing' and event_id = $1`, [ev]);
  assert.equal(vl.rows[0].n, 0, 'Léa a voté : pas de rappel');

  // Un extérieur ne déclenche rien pour un événement qui n'est pas le sien
  await db.query(`update public.events set votes_close_at = now() - interval '2 hours', contributions_close_at = now() - interval '2 hours', reveal_at = now() - interval '1 hour' where id = $1`, [ev]);
  await as(db, intrus, `select public.refresh_reminders()`);
  assert.equal((await db.query(`select count(*)::int as n from public.notifications where kind = 'capsule_open' and event_id = $1`, [ev])).rows[0].n, 0);

  await as(db, 'service', `select public.run_due_reminders()`);
  await as(db, 'service', `select public.run_due_reminders()`);
  const co = await db.query(`select count(*)::int as n from public.notifications where kind = 'capsule_open' and event_id = $1`, [ev]);
  assert.equal(co.rows[0].n, 2, 'Léa et Sarah, une fois chacune');
});
