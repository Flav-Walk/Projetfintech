// Tests des règles d'accès et des règles métier sensibles, exécutés dans un vrai Postgres (PGlite).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, createUser, as, errorOf, inDays, createEvent, invite, join, joinAsBeneficiary } from './helpers.mjs';

let db;
let lea, sarah, hugo, camille, intrus;
let eventId;

before(async () => {
  db = await freshDb();
  lea = await createUser(db, 'Lea');
  sarah = await createUser(db, 'Sarah');
  hugo = await createUser(db, 'Hugo');
  camille = await createUser(db, 'Camille');
  intrus = await createUser(db, 'Intrus');
  eventId = await createEvent(db, lea);
  const inv = await invite(db, lea, eventId);
  assert.equal((await join(db, sarah, inv.token)).status, 'joined');
  assert.equal((await join(db, hugo, inv.token)).status, 'joined');
});

// ---------------------------------------------------------------- comptes et événements
test('le trigger Auth crée profil et préférences', async () => {
  const { rows } = await as(db, lea, `select display_name from public.profiles where id = $1`, [lea]);
  assert.equal(rows[0].display_name, 'Lea');
  const prefs = await as(db, lea, `select * from public.notification_prefs`);
  assert.equal(prefs.rows.length, 1);
});

test('create_event : organisateur, 5 missions par défaut, activité', async () => {
  const { rows } = await as(db, lea, `select role from public.event_members where event_id = $1 and user_id = $2`, [eventId, lea]);
  assert.equal(rows[0].role, 'organizer');
  const tasks = await as(db, lea, `select kind from public.tasks where event_id = $1 order by position`, [eventId]);
  assert.deepEqual(tasks.rows.map((r) => r.kind), ['order', 'pickup', 'wrap', 'card', 'handover']);
});

test('create_event refuse un anonyme et une date de dévoilement passée', async () => {
  assert.match(await errorOf(as(db, null, `select public.create_event('x','y','z',null,1000,now(),now(),now(),now())`)), /permission denied/);
  assert.match(await errorOf(createEvent(db, lea, { votes: inDays(-3), contrib: inDays(-2), reveal: inDays(-1) })), /reveal_in_past/);
});

test('ordre des dates et montants validés par la base', async () => {
  assert.match(await errorOf(createEvent(db, lea, { votes: inDays(40), reveal: inDays(30) })), /events_dates_order/);
  assert.match(await errorOf(createEvent(db, lea, { target: 50 })), /target_cents/);
});

test('isolation : un non-membre ne voit ni événement, ni membres, ni missions, ni activité', async () => {
  for (const sql of [
    `select id from public.events where id = $1`,
    `select user_id from public.event_members where event_id = $1`,
    `select id from public.tasks where event_id = $1`,
    `select id from public.activity where event_id = $1`,
    `select id from public.invitations where event_id = $1`,
  ]) {
    const { rows } = await as(db, intrus, sql, [eventId]);
    assert.equal(rows.length, 0, sql);
  }
  const prof = await as(db, intrus, `select id from public.profiles where id = $1`, [lea]);
  assert.equal(prof.rows.length, 0, 'profil d’un inconnu invisible');
});

test('anon ne lit aucune table', async () => {
  assert.match(await errorOf(as(db, null, `select * from public.events`)), /permission denied/);
  assert.match(await errorOf(as(db, null, `select * from public.profiles`)), /permission denied/);
});

test('écritures directes interdites sur les tables pilotées par RPC', async () => {
  assert.match(await errorOf(as(db, intrus, `insert into public.event_members (event_id, user_id, role) values ($1, $2, 'organizer')`, [eventId, intrus])), /permission denied/);
  assert.match(await errorOf(as(db, lea, `update public.event_finances set collected_cents = 99999 where event_id = $1`, [eventId])), /permission denied/);
  assert.match(await errorOf(as(db, lea, `select * from public.event_finances`)), /permission denied/);
  assert.match(await errorOf(as(db, lea, `update public.events set is_demo = true where id = $1`, [eventId])), /permission denied/);
  assert.match(await errorOf(as(db, sarah, `insert into public.notifications (user_id, kind, dedupe_key) values ($1, 'message', 'x')`, [sarah])), /permission denied/);
});

test('modification des réglages : gestionnaire oui, participant non', async () => {
  await as(db, lea, `update public.events set description = 'Atelier ou concert' where id = $1`, [eventId]);
  const r = await as(db, sarah, `update public.events set title = 'Piraté' where id = $1 returning id`, [eventId]);
  assert.equal(r.rowCount, 0);
  const { rows } = await as(db, sarah, `select title, description from public.events where id = $1`, [eventId]);
  assert.equal(rows[0].title, 'Les 25 ans de Camille');
  assert.equal(rows[0].description, 'Atelier ou concert');
});

// ---------------------------------------------------------------- invitations
test('invitation : un participant ne peut pas inviter', async () => {
  assert.match(await errorOf(invite(db, sarah, eventId)), /forbidden/);
});

test('invitation : seul l’organisateur invite un co-organisateur', async () => {
  await as(db, lea, `select public.set_member_role($1, $2, 'co_organizer')`, [eventId, sarah]);
  assert.match(await errorOf(invite(db, sarah, eventId, 'co_organizer')), /forbidden/);
  const inv = await invite(db, sarah, eventId, 'participant');
  assert.ok(inv.token.length >= 64);
});

test('invitation : seul le hash du jeton est stocké', async () => {
  const inv = await invite(db, lea, eventId);
  const { rows } = await as(db, lea, `select token_hash from public.invitations where id = $1`, [inv.id]);
  assert.notEqual(rows[0].token_hash, inv.token);
  assert.equal(rows[0].token_hash.length, 64);
});

test('invitation : aperçu anonyme, déjà membre, invalide', async () => {
  const inv = await invite(db, lea, eventId);
  const anonPreview = (await as(db, null, `select public.preview_invitation($1) as p`, [inv.token])).rows[0].p;
  assert.equal(anonPreview.status, 'valid');
  assert.equal(anonPreview.title, 'Les 25 ans de Camille');
  assert.equal(anonPreview.organizer_name, 'Lea');
  assert.equal(anonPreview.event_id, null, 'identifiant jamais donné à un visiteur');
  const memberPreview = (await as(db, hugo, `select public.preview_invitation($1) as p`, [inv.token])).rows[0].p;
  assert.equal(memberPreview.status, 'already_member');
  assert.equal(memberPreview.event_id, eventId);
  assert.equal((await as(db, null, `select public.preview_invitation('nope') as p`)).rows[0].p.status, 'invalid');
  // Lien expiré ou épuisé : le statut seul, aucun détail sur l'événement.
  const expired = await invite(db, lea, eventId);
  await db.query(`update public.invitations set expires_at = now() - interval '1 minute' where id = $1`, [expired.id]);
  assert.deepEqual((await as(db, null, `select public.preview_invitation($1) as p`, [expired.token])).rows[0].p, { status: 'expired' });
  const single = await invite(db, lea, eventId, 'participant', 24, 1);
  await join(db, await createUser(db, 'Rita'), single.token);
  assert.deepEqual((await as(db, intrus, `select public.preview_invitation($1) as p`, [single.token])).rows[0].p, { status: 'exhausted' });
});

test('invitation : rejoindre deux fois ne crée qu’une adhésion et ne consomme pas le lien', async () => {
  const inv = await invite(db, lea, eventId, 'participant', 24, 1);
  const other = await createUser(db, 'Nina');
  assert.equal((await join(db, other, inv.token)).status, 'joined');
  assert.equal((await join(db, other, inv.token)).status, 'already_member');
  const { rows } = await as(db, lea, `select count(*)::int as n from public.event_members where event_id = $1 and user_id = $2`, [eventId, other]);
  assert.equal(rows[0].n, 1);
  const third = await createUser(db, 'Oscar');
  assert.equal((await join(db, third, inv.token)).status, 'exhausted');
});

test('invitation : révoquée et expirée', async () => {
  const inv = await invite(db, lea, eventId);
  await as(db, lea, `select public.revoke_invitation($1)`, [inv.id]);
  const u = await createUser(db, 'Paul');
  assert.equal((await join(db, u, inv.token)).status, 'revoked');
  const inv2 = await invite(db, lea, eventId);
  await db.query(`update public.invitations set expires_at = now() - interval '1 minute' where id = $1`, [inv2.id]);
  assert.equal((await join(db, u, inv2.token)).status, 'expired');
  assert.match(await errorOf(as(db, hugo, `select public.revoke_invitation($1)`, [inv2.id])), /forbidden/, 'participant');
});

test('retrait d’accès : immédiat et définitif via le même lien', async () => {
  const u = await createUser(db, 'Quentin');
  const inv = await invite(db, lea, eventId);
  await join(db, u, inv.token);
  assert.equal((await as(db, u, `select id from public.events where id = $1`, [eventId])).rows.length, 1);
  await as(db, lea, `select public.remove_member($1, $2)`, [eventId, u]);
  assert.equal((await as(db, u, `select id from public.events where id = $1`, [eventId])).rows.length, 0);
  assert.equal((await join(db, u, inv.token)).status, 'removed');
});

test('l’organisateur ne peut pas quitter sans transmettre', async () => {
  assert.match(await errorOf(as(db, lea, `select public.leave_event($1)`, [eventId])), /transfer_required/);
});

// ---------------------------------------------------------------- bénéficiaire
test('bénéficiaire : ne voit rien avant le dévoilement, puis seulement la capsule publiée', async () => {
  const ev = await createEvent(db, lea, { title: 'Surprise pour Camille' });
  const partInv = await invite(db, lea, ev);
  await join(db, sarah, partInv.token);
  assert.equal((await joinAsBeneficiary(db, lea, ev, camille)).status, 'joined');

  await as(db, sarah, `insert into public.capsule_entries (event_id, body, status) values ($1, 'Joyeux anniversaire !', 'published')`, [ev]);
  await as(db, lea, `insert into public.capsule_entries (event_id, body) values ($1, 'brouillon')`, [ev]);
  await as(db, sarah, `insert into public.messages (event_id, body) values ($1, 'On part sur la céramique ?')`, [ev]);

  assert.equal((await as(db, camille, `select id from public.events where id = $1`, [ev])).rows.length, 0);
  assert.equal((await as(db, camille, `select id from public.capsule_entries where event_id = $1`, [ev])).rows.length, 0);
  assert.equal((await as(db, camille, `select id from public.messages where event_id = $1`, [ev])).rows.length, 0);
  assert.equal((await as(db, camille, `select public.event_funding($1) as f`, [ev])).rows[0].f, null);

  // Le groupe voit le compteur scellé, pas le contenu des autres.
  const stats = (await as(db, lea, `select public.capsule_stats($1) as s`, [ev])).rows[0].s;
  assert.equal(stats.words, 1);
  assert.equal((await as(db, lea, `select id from public.capsule_entries where event_id = $1 and author_id = $2`, [ev, sarah])).rows.length, 0);

  // Dévoilement.
  await db.query(`update public.events set votes_close_at = now() - interval '2 days', contributions_close_at = now() - interval '2 days', reveal_at = now() - interval '1 minute' where id = $1`, [ev]);
  assert.equal((await as(db, camille, `select id from public.events where id = $1`, [ev])).rows.length, 1);
  const seen = await as(db, camille, `select body from public.capsule_entries where event_id = $1`, [ev]);
  assert.deepEqual(seen.rows.map((r) => r.body), ['Joyeux anniversaire !'], 'brouillon jamais visible');
  assert.equal((await as(db, camille, `select id from public.messages where event_id = $1`, [ev])).rows.length, 0, 'discussion jamais visible');
  assert.match(await errorOf(as(db, sarah, `update public.capsule_entries set body = 'modifié' where event_id = $1`, [ev])), /capsule_sealed/);
});

test('un second bénéficiaire est refusé', async () => {
  const ev = await createEvent(db, lea);
  await joinAsBeneficiary(db, lea, ev, camille);
  // Plus de lien générique pour ce rôle ; une seconde invitation nominative est refusée.
  assert.match(await errorOf(invite(db, lea, ev, 'beneficiary')), /beneficiary_link_forbidden/);
  assert.match(await errorOf(joinAsBeneficiary(db, lea, ev, intrus)), /beneficiary_taken/);
});

// ---------------------------------------------------------------- propositions et votes
test('votes : une voix modifiable, compteur juste, identités privées par défaut', async () => {
  const ev = await createEvent(db, lea);
  const inv = await invite(db, lea, ev);
  await join(db, sarah, inv.token);
  await join(db, hugo, inv.token);
  const p1 = (await as(db, sarah, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Atelier céramique', 15000) returning id`, [ev])).rows[0].id;
  const p2 = (await as(db, hugo, `insert into public.proposals (event_id, title, price_cents, product_url) values ($1, 'Concert', 12000, 'https://exemple.fr/concert') returning id`, [ev])).rows[0].id;

  await as(db, lea, `select public.cast_vote($1)`, [p1]);
  await as(db, sarah, `select public.cast_vote($1)`, [p1]);
  await as(db, hugo, `select public.cast_vote($1)`, [p2]);
  await as(db, hugo, `select public.cast_vote($1)`, [p1]); // changement d'avis
  await as(db, hugo, `select public.cast_vote($1)`, [p1]); // double clic
  const counts = await as(db, lea, `select id, vote_count from public.proposals where event_id = $1 order by vote_count desc`, [ev]);
  assert.deepEqual(counts.rows.map((r) => r.vote_count), [3, 0]);

  const visible = await as(db, sarah, `select user_id from public.votes where event_id = $1`, [ev]);
  assert.deepEqual(visible.rows.map((r) => r.user_id), [sarah], 'seule sa propre voix est visible');

  await as(db, lea, `update public.events set vote_visibility = 'public' where id = $1`, [ev]);
  assert.equal((await as(db, sarah, `select user_id from public.votes where event_id = $1`, [ev])).rows.length, 3);

  // Le classement ne choisit pas le cadeau.
  assert.equal((await as(db, lea, `select selected_proposal_id from public.events where id = $1`, [ev])).rows[0].selected_proposal_id, null);
  assert.match(await errorOf(as(db, sarah, `select public.select_gift($1, $2)`, [ev, p1])), /forbidden/);

  // Retrait : les voix sont libérées.
  await as(db, sarah, `update public.proposals set status = 'withdrawn' where id = $1`, [p1]);
  assert.equal((await as(db, lea, `select count(*)::int as n from public.votes where event_id = $1`, [ev])).rows[0].n, 0);

  // Changement de prix tracé.
  await as(db, hugo, `update public.proposals set price_cents = 13000 where id = $1`, [p2]);
  const pr = (await as(db, lea, `select previous_price_cents, price_changed_at from public.proposals where id = $1`, [p2])).rows[0];
  assert.equal(pr.previous_price_cents, 12000);
  assert.ok(pr.price_changed_at);

  // Un gestionnaire peut marquer indisponible, pas réécrire la proposition d'un autre.
  await as(db, lea, `update public.proposals set status = 'unavailable' where id = $1`, [p2]);
  assert.match(await errorOf(as(db, lea, `update public.proposals set title = 'autre' where id = $1`, [p2])), /forbidden/);
  // Un participant non auteur ne peut rien modifier.
  const r = await as(db, sarah, `update public.proposals set status = 'active' where id = $1 returning id`, [p2]);
  assert.equal(r.rowCount, 0);
});

test('votes : égalité signalée et vote clos refusé', async () => {
  const ev = await createEvent(db, lea);
  const inv = await invite(db, lea, ev);
  await join(db, sarah, inv.token);
  const a = (await as(db, lea, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Idée A', 1000) returning id`, [ev])).rows[0].id;
  const b = (await as(db, lea, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Idée B', 1000) returning id`, [ev])).rows[0].id;
  await as(db, lea, `select public.cast_vote($1)`, [a]);
  await as(db, sarah, `select public.cast_vote($1)`, [b]);
  const ranking = (await as(db, lea, `select * from public.proposal_ranking($1)`, [ev])).rows;
  assert.ok(ranking.every((r) => r.tied && r.rank === 1));
  await db.query(`update public.events set votes_close_at = now() - interval '1 minute' where id = $1`, [ev]);
  assert.match(await errorOf(as(db, sarah, `select public.cast_vote($1)`, [a])), /votes_closed/);
  assert.match(await errorOf(as(db, lea, `update public.events set votes_close_at = now() + interval '3 days' where id = $1`, [ev])), /votes_already_closed/);
  await as(db, lea, `select public.select_gift($1, $2)`, [ev, a]);
  assert.equal((await as(db, sarah, `select selected_proposal_id from public.events where id = $1`, [ev])).rows[0].selected_proposal_id, a);
});

test('un non-membre ne peut ni proposer ni voter', async () => {
  assert.match(await errorOf(as(db, intrus, `insert into public.proposals (event_id, title, price_cents) values ($1, 'X', 100)`, [eventId])), /row-level security/);
  const p = (await as(db, lea, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Appareil photo', 17500) returning id`, [eventId])).rows[0].id;
  assert.match(await errorOf(as(db, intrus, `select public.cast_vote($1)`, [p])), /forbidden/);
});

// ---------------------------------------------------------------- contributions
test('contributions : idempotence, confirmation par le service uniquement, total recalculé', async () => {
  const ev = await createEvent(db, lea);
  const inv = await invite(db, lea, ev);
  await join(db, sarah, inv.token);
  const c1 = (await as(db, sarah, `select (public.contribution_create($1, 1500, 'key-sarah-0001')).*`, [ev])).rows[0];
  const c1bis = (await as(db, sarah, `select (public.contribution_create($1, 1500, 'key-sarah-0001')).*`, [ev])).rows[0];
  assert.equal(c1.id, c1bis.id, 'double clic : même contribution');
  assert.equal(c1.status, 'pending');
  assert.match(await errorOf(as(db, sarah, `select public.contribution_create($1, 2000, 'key-sarah-0001')`, [ev])), /idempotency_conflict/);

  assert.match(await errorOf(as(db, sarah, `select public.contribution_settle($1, true, 'sim_1')`, [c1.id])), /permission denied/);
  await as(db, 'service', `select public.contribution_settle($1, true, 'sim_1')`, [c1.id]);
  await as(db, 'service', `select public.contribution_settle($1, true, 'sim_1')`, [c1.id]); // webhook rejoué
  const f = (await as(db, sarah, `select public.event_funding($1) as f`, [ev])).rows[0].f;
  assert.equal(f.my_confirmed_cents, 1500);
  assert.equal(f.collected_cents, 1500, 'total du groupe');
  assert.equal(f.remaining_cents, 16500);
  assert.equal(f.contributor_count, undefined, 'plus de compteur de contributeurs');

  // Échec puis nouvelle tentative avec une nouvelle clé.
  const c2 = (await as(db, lea, `select (public.contribution_create($1, 3000, 'key-lea-00001')).*`, [ev])).rows[0];
  await as(db, 'service', `select public.contribution_settle($1, false, 'sim_2', 'Carte refusée (simulation)')`, [c2.id]);
  assert.equal((await as(db, lea, `select public.event_funding($1) as f`, [ev])).rows[0].f.collected_cents, 1500, 'un échec ne compte pas');
  const c3 = (await as(db, lea, `select (public.contribution_create($1, 3000, 'key-lea-00002')).*`, [ev])).rows[0];
  await as(db, 'service', `select public.contribution_settle($1, true, 'sim_3')`, [c3.id]);
  const fl = (await as(db, lea, `select public.event_funding($1) as f`, [ev])).rows[0].f;
  assert.equal(fl.collected_cents, 4500, '15 € + 30 €');
  assert.equal(fl.percent, 25);
  assert.equal(fl.my_confirmed_cents, 3000, 'part personnelle seulement');

  // Montants individuels privés, aucune annonce nominative.
  const seenByLea = await as(db, lea, `select user_id from public.contributions where event_id = $1`, [ev]);
  assert.ok(seenByLea.rows.every((r) => r.user_id === lea));
  assert.match(await errorOf(as(db, lea, `select user_id from public.event_contributors($1)`, [ev])), /permission denied/);
  const named = await as(db, lea, `select count(*)::int as n from public.activity where event_id = $1 and kind = 'contribution_confirmed' and actor_id is not null`, [ev]);
  assert.equal(named.rows[0].n, 0);
  // Le timbre « Complice » ne doit pas non plus apparaître dans le fil (il nommerait le contributeur).
  const badgeAct = await as(db, lea, `select count(*)::int as n from public.activity where event_id = $1 and kind = 'badge_awarded' and data->>'badge' = 'contributor'`, [ev]);
  assert.equal(badgeAct.rows[0].n, 0, 'aucune annonce du timbre « Complice »');
  const badges = await as(db, lea, `select user_id from public.user_badges where event_id = $1 and badge = 'contributor'`, [ev]);
  assert.deepEqual(badges.rows.map((r) => r.user_id), [lea], 'timbre « Complice » des autres invisible');

  // Bornes, quota de demandes en attente et clôture.
  assert.match(await errorOf(as(db, sarah, `select public.contribution_create($1, 50, 'key-sarah-0002')`, [ev])), /invalid_amount/);
  for (let i = 0; i < 5; i++) await as(db, sarah, `select public.contribution_create($1, 1000, $2)`, [ev, `key-pending-${i}0`]);
  assert.match(await errorOf(as(db, sarah, `select public.contribution_create($1, 1000, 'key-pending-50')`, [ev])), /too_many_pending/);
  await db.query(`update public.events set contributions_close_at = now() - interval '1 minute', votes_close_at = now() - interval '1 minute' where id = $1`, [ev]);
  assert.match(await errorOf(as(db, sarah, `select public.contribution_create($1, 1000, 'key-sarah-0003')`, [ev])), /contributions_closed/);
  assert.match(await errorOf(as(db, intrus, `select public.contribution_create($1, 1000, 'key-intrus-001')`, [ev])), /forbidden/);

  // Collecte close : même total pour tous les préparateurs, collecte signalée close.
  const closed = (await as(db, sarah, `select public.event_funding($1) as f`, [ev])).rows[0].f;
  assert.equal(closed.collected_cents, 4500);
  assert.equal(closed.contributions_open, false);
  assert.equal((await as(db, intrus, `select public.event_funding($1) as f`, [ev])).rows[0].f, null);
});

test('cagnotte : objectif modifiable par un gestionnaire, total dans « Mes événements »', async () => {
  const ev = await createEvent(db, lea, { target: 10000 });
  const inv = await invite(db, lea, ev);
  await join(db, sarah, inv.token);
  assert.match(await errorOf(as(db, sarah, `select public.set_event_target($1, 20000)`, [ev])), /forbidden/);
  assert.match(await errorOf(as(db, lea, `select public.set_event_target($1, 50)`, [ev])), /invalid_target_amount/);
  await as(db, lea, `select public.set_event_target($1, 8000)`, [ev]);
  await join(db, hugo, inv.token);
  const c = (await as(db, hugo, `select (public.contribution_create($1, 4000, 'key-target-001')).*`, [ev])).rows[0];
  await as(db, 'service', `select public.contribution_settle($1, true, 'sim_t')`, [c.id]);
  const mine = (await as(db, sarah, `select * from public.my_events_funding() where event_id = $1`, [ev])).rows[0];
  assert.equal(mine.collected_cents, 4000);
  assert.equal(mine.target_cents, 8000);
  assert.equal(mine.percent, 50);
  assert.equal(mine.goal_reached, false);
  assert.equal((await as(db, intrus, `select * from public.my_events_funding() where event_id = $1`, [ev])).rows.length, 0);
});

test('fonctions d’aide : aucune réponse pour un non-membre', async () => {
  const p = (await as(db, lea, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Lampe', 3000) returning id`, [eventId])).rows[0].id;
  assert.equal((await as(db, intrus, `select public.proposal_event($1) as e`, [p])).rows[0].e, null);
  assert.equal((await as(db, sarah, `select public.proposal_event($1) as e`, [p])).rows[0].e, eventId);
  const past = await createEvent(db, lea);
  await db.query(`update public.events set votes_close_at = now() - interval '2 days', contributions_close_at = now() - interval '2 days', reveal_at = now() - interval '1 day' where id = $1`, [past]);
  assert.equal((await as(db, intrus, `select public.is_revealed($1) as r`, [past])).rows[0].r, false);
  assert.equal((await as(db, lea, `select public.is_revealed($1) as r`, [past])).rows[0].r, true);
});

test('politiques : auth.uid() évalué une fois par requête', async () => {
  const { rows } = await db.query(`
    select policyname from pg_policies where schemaname = 'public'
      and (replace(coalesce(qual, '') || coalesce(with_check, ''), 'SELECT auth.uid()', '') like '%auth.uid()%')`);
  assert.deepEqual(rows, []);
  const wrapped = await db.query(`select count(*)::int as n from pg_policies where schemaname = 'public' and (coalesce(qual, '') || coalesce(with_check, '')) like '%SELECT auth.uid()%'`);
  assert.ok(wrapped.rows[0].n >= 20);
});

test('création d’événements : quota par compte sur 24 h', async () => {
  const spammer = await createUser(db, 'Spam');
  for (let i = 0; i < 30; i++) await createEvent(db, spammer);
  assert.match(await errorOf(createEvent(db, spammer)), /rate_limited/);
});

// ---------------------------------------------------------------- missions
test('missions : prise concurrente, un seul gagnant', async () => {
  const ev = await createEvent(db, lea);
  const inv = await invite(db, lea, ev);
  await join(db, sarah, inv.token);
  await join(db, hugo, inv.token);
  const task = (await as(db, lea, `select id from public.tasks where event_id = $1 and kind = 'wrap'`, [ev])).rows[0].id;
  const [a, b] = await Promise.all([
    as(db, sarah, `select public.claim_task($1) as r`, [task]),
    as(db, hugo, `select public.claim_task($1) as r`, [task]),
  ]);
  const statuses = [a.rows[0].r.status, b.rows[0].r.status].sort();
  assert.deepEqual(statuses, ['claimed', 'taken']);
  const winner = a.rows[0].r.status === 'claimed' ? sarah : hugo;
  const loser = winner === sarah ? hugo : sarah;
  assert.match(await errorOf(as(db, loser, `select public.complete_task($1)`, [task])), /not_assignee/);
  await as(db, winner, `select public.complete_task($1)`, [task]);
  // Badge "helper" idempotent : rouvrir puis refaire ne redonne rien.
  await as(db, lea, `select public.release_task($1)`, [task]);
  await as(db, winner, `select public.claim_task($1)`, [task]);
  await as(db, winner, `select public.complete_task($1)`, [task]);
  const badges = await as(db, winner, `select badge from public.user_badges where event_id = $1 and user_id = $2 and badge = 'helper'`, [ev, winner]);
  assert.equal(badges.rows.length, 1);
  const awards = await db.query(`select count(*)::int as n from public.activity where event_id = $1 and kind = 'badge_awarded' and actor_id = $2 and data->>'badge' = 'helper'`, [ev, winner]);
  assert.equal(awards.rows[0].n, 1);
  // Réattribution par l'organisateur + notification.
  await as(db, lea, `select public.assign_task($1, $2)`, [task, loser]);
  const notif = await as(db, loser, `select kind from public.notifications where event_id = $1`, [ev]);
  assert.ok(notif.rows.some((r) => r.kind === 'task_assigned'));
  assert.match(await errorOf(as(db, sarah, `select public.assign_task($1, $2)`, [task, sarah])), /forbidden/);
});

test('badge "proposer" : supprimer et recréer ne redonne pas de récompense', async () => {
  const ev = await createEvent(db, lea);
  await as(db, lea, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Idée A', 1000)`, [ev]);
  await as(db, lea, `update public.proposals set status = 'withdrawn' where event_id = $1`, [ev]);
  await as(db, lea, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Idée B', 1000)`, [ev]);
  const n = await db.query(`select count(*)::int as n from public.user_badges where event_id = $1 and badge = 'proposer'`, [ev]);
  assert.equal(n.rows[0].n, 1);
});

test('fonctions internes non appelables par un client (anti-triche, anti-spam)', async () => {
  const internal = [
    [`select public.award_badge($1, $2, 'helper')`, [eventId, sarah]],
    [`select public.notify($1, $2, 'message', '{}'::jsonb, 'spam')`, [lea, eventId]],
    [`select public.log_activity($1, 'fake')`, [eventId]],
    [`select public.contribution_settle(gen_random_uuid(), true, 'x')`, []],
    [`select public.prepare_account_deletion($1)`, [lea]],
  ];
  for (const [sql, params] of internal) {
    assert.match(await errorOf(as(db, sarah, sql, params)) ?? 'aucune erreur', /permission denied/, sql);
  }
  // Les RPC publiques restent accessibles.
  assert.equal(await errorOf(as(db, sarah, `select public.event_progress($1)`, [eventId])), null);
  // Anonyme : seulement l'aperçu d'invitation.
  assert.match(await errorOf(as(db, null, `select public.event_progress($1)`, [eventId])) ?? 'aucune erreur', /permission denied/);
});

test('privilèges de tables explicites (indépendants des droits par défaut du projet)', async () => {
  const priv = async (role, table, p) =>
    (await db.query(`select has_table_privilege($1, $2, $3) as ok`, [role, `public.${table}`, p])).rows[0].ok;
  // Les clients lisent et écrivent via la RLS…
  assert.equal(await priv('authenticated', 'events', 'select'), true);
  const anyCol = async (role, table, p) =>
    (await db.query(`select has_any_column_privilege($1, $2, $3) as ok`, [role, `public.${table}`, p])).rows[0].ok;
  assert.equal(await anyCol('authenticated', 'proposals', 'insert'), true);
  assert.equal(await anyCol('authenticated', 'messages', 'insert'), true);
  assert.equal(await priv('authenticated', 'capsule_entries', 'delete'), true);
  // … sans opérations dangereuses ni écritures réservées au serveur.
  for (const table of ['events', 'contributions', 'messages', 'capsule_entries']) {
    assert.equal(await priv('authenticated', table, 'truncate'), false, `truncate ${table}`);
    assert.equal(await priv('anon', table, 'select'), false, `anon select ${table}`);
  }
  assert.equal(await priv('authenticated', 'contributions', 'insert'), false);
  assert.equal(await priv('authenticated', 'votes', 'insert'), false);
  assert.equal(await priv('authenticated', 'user_badges', 'insert'), false);
  assert.equal(await priv('authenticated', 'messages', 'update'), false);
  // Insertion limitée aux colonnes métier : pas de date, de compteur ni de statut choisis par le client.
  assert.equal(await priv('authenticated', 'tasks', 'insert'), false, 'missions créées via create_task uniquement');
  assert.equal(await anyCol('authenticated', 'invitation_acceptances', 'select'), false);
  assert.match(await errorOf(as(db, sarah, `insert into public.messages (event_id, body, created_at) values ($1, 'antidaté', now() - interval '1 year')`, [eventId])) ?? 'aucune erreur', /permission denied/);
  assert.match(await errorOf(as(db, sarah, `insert into public.proposals (event_id, title, price_cents, vote_count) values ($1, 'Truquée', 100, 99)`, [eventId])) ?? 'aucune erreur', /permission denied/);
  assert.match(await errorOf(as(db, sarah, `insert into public.capsule_entries (event_id, body, published_at) values ($1, 'x', now())`, [eventId])) ?? 'aucune erreur', /permission denied/);
  assert.match(await errorOf(as(db, sarah, `update public.notification_prefs set user_id = $1`, [hugo])) ?? 'aucune erreur', /permission denied/);
  // Le service (API, démo) peut marquer un événement de démonstration.
  assert.equal(await priv('service_role', 'events', 'update'), true);
  assert.equal(await errorOf(as(db, 'service', `update public.events set is_demo = true where id = $1`, [eventId])), null);
  await as(db, 'service', `update public.events set is_demo = false where id = $1`, [eventId]);
});

// ---------------------------------------------------------------- storage
test('storage : chemins imposés et capsule scellée', async () => {
  const ok = `${eventId}/capsule/${sarah}/photo.jpg`;
  await as(db, sarah, `insert into storage.objects (bucket_id, name) values ('event-media', $1)`, [ok]);
  assert.match(await errorOf(as(db, sarah, `insert into storage.objects (bucket_id, name) values ('event-media', $1)`, [`${eventId}/capsule/${hugo}/x.jpg`])), /row-level security/);
  assert.match(await errorOf(as(db, intrus, `insert into storage.objects (bucket_id, name) values ('event-media', $1)`, [`${eventId}/proposals/${intrus}/x.jpg`])), /row-level security/);
  assert.equal((await as(db, hugo, `select name from storage.objects where name = $1`, [ok])).rows.length, 0, 'photo de capsule invisible avant dévoilement');
  assert.equal((await as(db, sarah, `select name from storage.objects where name = $1`, [ok])).rows.length, 1);
  await as(db, sarah, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${sarah}/a.jpg`]);
  assert.equal((await as(db, hugo, `select name from storage.objects where bucket_id = 'avatars'`)).rows.length, 1, 'co-membre voit l’avatar');
  assert.equal((await as(db, intrus, `select name from storage.objects where bucket_id = 'avatars'`)).rows.length, 0);
});

// ---------------------------------------------------------------- progression et suppression de compte
test('event_progress : étapes et prochaine action', async () => {
  const p = (await as(db, hugo, `select public.event_progress($1) as p`, [eventId])).rows[0].p;
  assert.equal(p.steps.length, 5);
  assert.equal(p.steps[0].done, true);
  assert.equal(p.next_action, 'vote');
  assert.equal((await as(db, intrus, `select public.event_progress($1) as p`, [eventId])).rows[0].p, null);
});

test('suppression de compte : organisation transmise, événement orphelin supprimé', async () => {
  const solo = await createUser(db, 'Solo');
  const soloEvent = await createEvent(db, solo);
  const shared = await createEvent(db, solo);
  const inv = await invite(db, solo, shared);
  await join(db, hugo, inv.token);
  assert.match(await errorOf(as(db, solo, `select public.prepare_account_deletion($1)`, [solo])), /permission denied/);
  await as(db, 'service', `select public.prepare_account_deletion($1)`, [solo]);
  await db.query(`delete from auth.users where id = $1`, [solo]);
  assert.equal((await db.query(`select id from public.events where id = $1`, [soloEvent])).rows.length, 0);
  const org = await db.query(`select user_id from public.event_members where event_id = $1 and role = 'organizer'`, [shared]);
  assert.equal(org.rows[0].user_id, hugo);
});
