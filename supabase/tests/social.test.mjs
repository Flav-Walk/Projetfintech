// Migration 11 : pseudo, amis, blocage, invitations nominatives (amis, e-mail lié à l'adresse vérifiée),
// total de la cagnotte. Rôles testés : organisateur, participant, ami invité, invité par e-mail sans compte,
// bénéficiaire, personne extérieure, personne bloquée.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, createUser, as, errorOf, createEvent, invite, join } from './helpers.mjs';

let db;
let lea, sarah, tom, camille, intrus, troll;

before(async () => {
  db = await freshDb();
  lea = await createUser(db, 'Léa');
  sarah = await createUser(db, 'Sarah');
  tom = await createUser(db, 'Tom');
  camille = await createUser(db, 'Camille');
  intrus = await createUser(db, 'Intrus');
  troll = await createUser(db, 'Troll');
});

const rpc = async (uid, sql, params = []) => (await as(db, uid, sql, params)).rows[0];
const friendReq = (a, b) => rpc(a, `select public.send_friend_request($1) as r`, [b]).then((x) => x.r.status);
const respond = (a, b, ok) => rpc(a, `select public.respond_friend_request($1, $2) as r`, [b, ok]).then((x) => x.r.status);
const relation = async (a, b) => (await as(db, a, `select relation from public.my_friends() where user_id = $1`, [b])).rows[0]?.relation ?? 'none';

test('pseudo : généré à l’inscription, unique, modifiable, mots réservés refusés', async () => {
  const { rows } = await db.query(`select username from public.profiles where id = any($1)`, [[lea, sarah, tom]]);
  for (const r of rows) assert.match(r.username, /^[a-z0-9_.]{3,20}$/);
  assert.match((await rpc(lea, `select username from public.profiles where id = $1`, [lea])).username, /^lea\d{4}$/, 'accents retirés');
  assert.equal((await rpc(lea, `select public.set_username('@Lea.Martin') as u`)).u, 'lea.martin');
  assert.match(await errorOf(as(db, sarah, `select public.set_username('lea.martin')`)), /username_taken/);
  assert.match(await errorOf(as(db, sarah, `select public.set_username('admin')`)), /username_taken/);
  assert.match(await errorOf(as(db, sarah, `select public.set_username('a b')`)), /invalid_username/);
  assert.equal((await rpc(sarah, `select public.username_available('lea.martin') as ok`)).ok, false);
  assert.equal((await rpc(sarah, `select public.username_available('sarah.k') as ok`)).ok, true);
  await rpc(sarah, `select public.set_username('sarah.k')`);
  await rpc(tom, `select public.set_username('tom.b')`);
  await rpc(camille, `select public.set_username('camille.d')`);
  await rpc(troll, `select public.set_username('troll')`);
  // Le pseudo ne se modifie pas en direct (contournerait les contrôles).
  assert.match(await errorOf(as(db, sarah, `update public.profiles set username = 'x_x_x' where id = $1`, [sarah])), /permission denied/);
});

test('recherche : préfixe de pseudo, jamais d’e-mail, limitée, sans moi ni les personnes bloquées', async () => {
  const res = (await as(db, intrus, `select * from public.search_profiles('@lea')`)).rows;
  assert.equal(res.length, 1);
  assert.deepEqual(Object.keys(res[0]).sort(), ['avatar_path', 'display_name', 'relation', 'user_id', 'username']);
  assert.equal(res[0].relation, 'none');
  assert.equal(res[0].avatar_path, null, 'pas de photo sans relation');
  assert.equal((await as(db, lea, `select * from public.search_profiles('lea')`)).rows.length, 0, 'pas soi-même');
  assert.equal((await as(db, intrus, `select * from public.search_profiles('l')`)).rows.length, 0, 'au moins 2 caractères');
  assert.equal((await as(db, intrus, `select * from public.search_profiles('%')`)).rows.length, 0, 'pas de joker');
  // Les profils restent invisibles en lecture directe sans relation.
  assert.equal((await as(db, intrus, `select id from public.profiles where id = $1`, [lea])).rows.length, 0);
});

test('demande d’ami : envoi, doublon, demandes croisées, acceptation, notifications uniques', async () => {
  assert.equal(await friendReq(lea, sarah), 'sent');
  assert.equal(await friendReq(lea, sarah), 'already_pending');
  assert.equal(await relation(lea, sarah), 'outgoing');
  assert.equal(await relation(sarah, lea), 'incoming');
  // Profil visible pendant la demande.
  assert.equal((await as(db, sarah, `select display_name from public.profiles where id = $1`, [lea])).rows[0]?.display_name, 'Léa');
  assert.equal(await respond(sarah, lea, true), 'accepted');
  assert.equal(await relation(lea, sarah), 'friend');
  assert.equal(await friendReq(sarah, lea), 'already_friends');
  // Croisées : Tom demande Léa pendant que Léa demande Tom → amis directement.
  assert.equal(await friendReq(tom, lea), 'sent');
  assert.equal(await friendReq(lea, tom), 'accepted');
  assert.equal(await relation(tom, lea), 'friend');
  const n = await rpc(sarah, `select count(*)::int as n from public.notifications where kind = 'friend_request'`);
  assert.equal(n.n, 1);
  // Personne d'autre ne voit la relation.
  assert.equal((await as(db, intrus, `select * from public.friendships`)).rows.length, 0);
  assert.match(await errorOf(as(db, lea, `insert into public.friendships (user_low, user_high, requested_by) values ($1, $2, $1)`, [lea < intrus ? lea : intrus, lea < intrus ? intrus : lea])), /permission denied/);
});

test('annulation et refus : la demande disparaît, une relance après refus reste sans effet', async () => {
  assert.equal(await friendReq(intrus, camille), 'sent');
  await rpc(intrus, `select public.cancel_friend_request($1)`, [camille]);
  assert.equal(await relation(camille, intrus), 'none');
  assert.equal((await rpc(camille, `select count(*)::int as n from public.notifications where kind = 'friend_request' and read_at is null`)).n, 0, 'notification retirée');
  assert.equal(await friendReq(intrus, camille), 'sent');
  assert.equal(await respond(camille, intrus, false), 'declined');
  assert.equal(await relation(intrus, camille), 'none', 'le refus n’est pas affiché');
  assert.equal(await friendReq(intrus, camille), 'sent', 'relance acceptée sans effet');
  assert.equal(await relation(camille, intrus), 'none');
});

test('blocage : plus de demande ni d’invitation, recherche masquée, relation supprimée', async () => {
  assert.equal(await friendReq(troll, lea), 'sent');
  await rpc(lea, `select public.block_user($1)`, [troll]);
  assert.equal(await relation(lea, troll), 'none');
  assert.equal(await friendReq(troll, lea), 'sent', 'le bloqué ne sait pas qu’il est bloqué');
  assert.equal(await relation(lea, troll), 'none');
  assert.equal((await as(db, troll, `select * from public.search_profiles('lea')`)).rows.length, 0);
  assert.equal((await as(db, lea, `select * from public.search_profiles('troll')`)).rows.length, 0);
  assert.match(await errorOf(as(db, lea, `select public.send_friend_request($1)`, [troll])), /blocked_user/);
  assert.equal((await as(db, lea, `select user_id from public.my_blocked()`)).rows[0].user_id, troll);
  assert.equal((await as(db, troll, `select * from public.user_blocks`)).rows.length, 0, 'le bloqué ne voit pas le blocage');
  await rpc(lea, `select public.unblock_user($1)`, [troll]);
  assert.equal((await as(db, lea, `select * from public.my_blocked()`)).rows.length, 0);
  await rpc(lea, `select public.block_user($1)`, [troll]);
});

test('inviter des amis : uniquement des amis, jamais en silence, rejoindre ou refuser', async () => {
  const ev = await createEvent(db, lea, { title: 'Pot de départ de Nora' });
  const res = (await rpc(lea, `select public.invite_friends($1, $2) as r`, [ev, [sarah, tom, intrus, troll, lea]])).r;
  const by = Object.fromEntries(res.map((x) => [x.user_id, x.status]));
  assert.equal(by[sarah], 'invited');
  assert.equal(by[tom], 'invited');
  assert.equal(by[intrus], 'not_friend');
  assert.equal(by[troll], 'not_friend', 'personne bloquée');
  assert.equal(by[lea], 'invalid');
  // Pas d'adhésion silencieuse.
  assert.equal((await as(db, sarah, `select * from public.events where id = $1`, [ev])).rows.length, 0);
  const again = (await rpc(lea, `select public.invite_friends($1, $2) as r`, [ev, [sarah]])).r;
  assert.equal(again[0].status, 'already_invited');
  const mine = (await as(db, sarah, `select * from public.my_event_invites()`)).rows;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].title, 'Pot de départ de Nora');
  assert.equal(mine[0].inviter_name, 'Léa');
  assert.equal((await rpc(sarah, `select public.respond_event_invite($1, true) as r`, [mine[0].id])).r.status, 'joined');
  assert.equal((await as(db, sarah, `select id from public.events where id = $1`, [ev])).rows.length, 1);
  assert.equal((await rpc(sarah, `select public.respond_event_invite($1, true) as r`, [mine[0].id])).r.status, 'accepted', 'action répétée');
  const tomInv = (await as(db, tom, `select id from public.my_event_invites()`)).rows[0].id;
  assert.equal((await rpc(tom, `select public.respond_event_invite($1, false) as r`, [tomInv])).r.status, 'declined');
  assert.equal((await rpc(lea, `select public.invite_friends($1, $2) as r`, [ev, [tom]])).r[0].status, 'declined', 'pas de relance immédiate');
  // Suivi pour l'organisateur ; un participant ne voit pas les invitations ; un intrus ne peut pas inviter.
  const overview = (await as(db, lea, `select display_name, status from public.event_invites_overview($1) order by display_name`, [ev])).rows;
  assert.deepEqual(overview.map((o) => o.status), ['accepted', 'declined']);
  assert.match(await errorOf(as(db, sarah, `select * from public.event_invites_overview($1)`, [ev])), /forbidden/);
  assert.equal((await as(db, sarah, `select * from public.event_invites where event_id = $1 and invitee_id <> $2`, [ev, sarah])).rows.length, 0);
  assert.match(await errorOf(as(db, sarah, `select public.invite_friends($1, $2)`, [ev, [lea]])), /forbidden/);
  assert.match(await errorOf(as(db, intrus, `select public.respond_event_invite($1, true)`, [mine[0].id])) ?? 'ok', /ok/, 'réponse neutre');
  assert.equal((await rpc(intrus, `select public.respond_event_invite($1, true) as r`, [mine[0].id])).r.status, 'invalid');
});

test('annuler une invitation ; retirer un ami ne retire personne de la cagnotte', async () => {
  const ev = await createEvent(db, lea);
  await rpc(lea, `select public.invite_friends($1, $2)`, [ev, [tom]]);
  const inv = (await as(db, lea, `select id from public.event_invites_overview($1)`, [ev])).rows[0].id;
  await rpc(lea, `select public.cancel_event_invite($1)`, [inv]);
  assert.equal((await as(db, tom, `select * from public.my_event_invites() where event_id = $1`, [ev])).rows.length, 0);
  assert.equal((await rpc(tom, `select public.respond_event_invite($1, true) as r`, [inv])).r.status, 'cancelled');
  // Sarah est membre (invitation précédente acceptée sur un autre événement) : on refait ici.
  await rpc(lea, `select public.invite_friends($1, $2)`, [ev, [sarah]]);
  const s = (await as(db, sarah, `select id from public.my_event_invites() where event_id = $1`, [ev])).rows[0].id;
  await rpc(sarah, `select public.respond_event_invite($1, true)`, [s]);
  await rpc(lea, `select public.remove_friend($1)`, [sarah]);
  assert.equal(await relation(lea, sarah), 'none');
  assert.equal((await as(db, sarah, `select id from public.events where id = $1`, [ev])).rows.length, 1, 'toujours membre');
  assert.equal((await as(db, sarah, `select display_name from public.profiles where id = $1`, [lea])).rows.length, 1, 'profil visible via la cagnotte');
  await friendReq(lea, sarah);
  await respond(sarah, lea, true);
});

test('bénéficiaire invité comme ami : surprise préservée, aucune donnée de préparation', async () => {
  await friendReq(lea, camille);
  await respond(camille, lea, true);
  const ev = await createEvent(db, lea, { title: 'Les 30 ans de Camille', beneficiary: 'Camille' });
  assert.match(await errorOf(as(db, lea, `select public.invite_friends($1, $2, 'beneficiary')`, [ev, [camille, sarah]])), /beneficiary_taken/, 'un seul bénéficiaire');
  await rpc(lea, `select public.invite_friends($1, $2, 'beneficiary')`, [ev, [camille]]);
  const inv = (await as(db, camille, `select * from public.my_event_invites()`)).rows[0];
  assert.equal(inv.title, null);
  assert.equal(inv.member_count, null);
  const notif = await rpc(camille, `select data from public.notifications where kind = 'event_invite' order by id desc limit 1`);
  assert.equal(notif.data.title, null);
  await rpc(camille, `select public.respond_event_invite($1, true)`, [inv.id]);
  assert.equal((await as(db, camille, `select id from public.events where id = $1`, [ev])).rows.length, 0, 'événement invisible avant l’ouverture');
  assert.equal((await rpc(camille, `select public.event_funding($1) as f`, [ev])).f, null);
  const surprise = (await as(db, camille, `select * from public.my_surprises()`)).rows;
  assert.equal(surprise.length, 1);
  assert.deepEqual(Object.keys(surprise[0]).sort(), ['event_id', 'organizer_name', 'reveal_at']);
});

test('invitation par e-mail : liée à l’adresse vérifiée, retrouvée après connexion, autre compte refusé', async () => {
  const ev = await createEvent(db, lea, { title: 'Crémaillère' });
  const r = (await rpc(lea, `select public.prepare_email_invitation($1, 'participant', 'Nouvelle.Amie@Exemple.fr') as r`, [ev])).r;
  assert.equal(r.status, 'queued');
  assert.equal((await rpc(lea, `select public.prepare_email_invitation($1, 'participant', 'nouvelle.amie@exemple.fr') as r`, [ev])).r.status, 'already_sent');
  const { rows: [out] } = await db.query(`select payload from public.email_outbox where event_id = $1`, [ev]);
  const token = out.payload.token;
  // Suivi organisateur : adresse masquée.
  const ov = (await as(db, lea, `select kind, email_hint, status from public.event_invites_overview($1)`, [ev])).rows;
  assert.deepEqual(ov, [{ kind: 'email', email_hint: 'no•••@exemple.fr', status: 'pending' }]);
  // Un autre compte qui obtient le lien ne peut pas l'utiliser.
  assert.equal((await rpc(intrus, `select public.preview_invitation($1) as p`, [token])).p.status, 'wrong_account');
  assert.equal((await rpc(intrus, `select public.accept_invitation($1) as r`, [token])).r.status, 'wrong_account');
  // Création du compte avec la bonne adresse : adresse non confirmée → rien.
  const { rows: [nu] } = await db.query(`insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values ('nouvelle.amie@exemple.fr', '{"display_name":"Nina"}', null) returning id`);
  assert.equal((await rpc(nu.id, `select public.claim_email_invites() as n`)).n, 0, 'adresse pas encore vérifiée');
  await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [nu.id]);
  assert.equal((await rpc(nu.id, `select public.claim_email_invites() as n`)).n, 1);
  assert.equal((await rpc(nu.id, `select public.claim_email_invites() as n`)).n, 0, 'une seule fois');
  const mine = (await as(db, nu.id, `select * from public.my_event_invites()`)).rows;
  assert.equal(mine[0].source, 'email');
  assert.equal(mine[0].title, 'Crémaillère');
  assert.equal((await rpc(nu.id, `select public.respond_event_invite($1, true) as r`, [mine[0].id])).r.status, 'joined');
  assert.equal((await rpc(nu.id, `select public.accept_invitation($1) as r`, [token])).r.status, 'already_member');
  assert.equal((await rpc(lea, `select status from public.event_invites_overview($1)`, [ev])).status, 'accepted');
  // Compte existant : l'invitation apparaît directement dans son app.
  const ev2 = await createEvent(db, lea, { title: 'Brunch' });
  await rpc(lea, `select public.prepare_email_invitation($1, 'participant', 'intrus@test.local')`, [ev2]);
  assert.equal((await as(db, intrus, `select title from public.my_event_invites()`)).rows[0]?.title, 'Brunch');
  // Bloqué : réponse normale, aucun envoi ni invitation.
  const before = (await db.query(`select count(*)::int as n from public.email_outbox`)).rows[0].n;
  assert.equal((await rpc(lea, `select public.prepare_email_invitation($1, 'participant', 'troll@test.local') as r`, [ev2])).r.status, 'queued');
  assert.equal((await db.query(`select count(*)::int as n from public.email_outbox`)).rows[0].n, before);
  assert.equal((await as(db, troll, `select * from public.my_event_invites()`)).rows.length, 0);
});

test('lien de partage : règles inchangées (plusieurs personnes, sans adresse)', async () => {
  const ev = await createEvent(db, lea);
  const inv = await invite(db, lea, ev, 'participant', 24, 2);
  assert.equal((await join(db, intrus, inv.token)).status, 'joined');
  assert.equal((await join(db, tom, inv.token)).status, 'joined');
  assert.equal((await join(db, troll, inv.token)).status, 'exhausted');
});

test('cagnotte : total, objectif, reste et part personnelle pour les préparateurs ; rien pour les autres', async () => {
  const ev = await createEvent(db, lea, { target: 20000 });
  await join(db, sarah, (await invite(db, lea, ev)).token);
  await join(db, camille, (await invite(db, lea, ev, 'beneficiary', 24, 1)).token);
  const pay = async (uid, cents, key) => {
    const { rows: [c] } = await as(db, uid, `select (public.contribution_create($1, $2, $3)).id`, [ev, cents, key]);
    await as(db, 'service', `select public.contribution_settle($1, true, 'sim')`, [c.id]);
  };
  await pay(lea, 5000, 'cle-essai-0001');
  await pay(sarah, 2500, 'cle-essai-0002');
  const f = (await rpc(sarah, `select public.event_funding($1) as f`, [ev])).f;
  assert.equal(f.collected_cents, 7500);
  assert.equal(f.target_cents, 20000);
  assert.equal(f.remaining_cents, 12500);
  assert.equal(f.percent, 37);
  assert.equal(f.my_confirmed_cents, 2500);
  assert.ok(f.contributions_close_at);
  assert.equal((await rpc(lea, `select public.event_funding($1) as f`, [ev])).f.my_confirmed_cents, 5000);
  // Jamais par personne, jamais pour le bénéficiaire ni un extérieur, table illisible.
  assert.equal((await rpc(camille, `select public.event_funding($1) as f`, [ev])).f, null);
  assert.equal((await rpc(intrus, `select public.event_funding($1) as f`, [ev])).f, null);
  assert.match(await errorOf(as(db, sarah, `select * from public.event_finances`)), /permission denied/);
  assert.equal((await as(db, sarah, `select * from public.contributions where event_id = $1 and user_id <> $2`, [ev, sarah])).rows.length, 0);
  assert.match(await errorOf(as(db, sarah, `select * from public.event_contributors($1)`, [ev])), /permission denied/);
  const list = (await as(db, sarah, `select * from public.my_events_funding() where event_id = $1`, [ev])).rows[0];
  assert.equal(list.collected_cents, 7500);
  assert.equal((await as(db, camille, `select * from public.my_events_funding()`)).rows.length, 0);
  // Aucune activité ne dit qui a donné ni combien.
  const act = (await as(db, sarah, `select actor_id, data from public.activity where event_id = $1 and kind = 'contribution_confirmed'`, [ev])).rows;
  assert.ok(act.every((a) => a.actor_id === null && !JSON.stringify(a.data).match(/amount|cents/)));
});

test('prochaine action : proposer, voter, écrire, prendre une mission, puis la cagnotte en dernier', async () => {
  const ev = await createEvent(db, lea);
  await join(db, sarah, (await invite(db, lea, ev)).token);
  const next = async (uid) => (await rpc(uid, `select public.event_progress($1) as p`, [ev])).p.next_action;
  assert.equal(await next(sarah), 'propose');
  const { rows: [p] } = await as(db, sarah, `insert into public.proposals (event_id, title, price_cents) values ($1, 'Platine vinyle', 15000) returning id`, [ev]);
  assert.equal(await next(sarah), 'vote');
  await as(db, sarah, `select public.cast_vote($1)`, [p.id]);
  assert.equal(await next(sarah), 'write_capsule');
  await as(db, sarah, `insert into public.capsule_entries (event_id, author_id, body, status) values ($1, $2, 'Joyeux anniversaire !', 'published')`, [ev, sarah]);
  assert.equal(await next(sarah), 'claim_task');
  const { rows: [t] } = await as(db, sarah, `select id from public.tasks where event_id = $1 limit 1`, [ev]);
  await as(db, sarah, `select public.claim_task($1)`, [t.id]);
  assert.equal(await next(sarah), 'finish_task');
  await as(db, sarah, `select public.complete_task($1)`, [t.id]);
  assert.equal(await next(sarah), 'contribute');
  const prog = (await rpc(sarah, `select public.event_progress($1) as p`, [ev])).p;
  assert.equal(prog.my_capsule, 'published');
  assert.equal(prog.proposals, 1);
  assert.equal(prog.voted, true);
});

test('couverture illustrée (migration 12) : gestionnaire seulement, valeurs de la bibliothèque', async () => {
  const ev = await createEvent(db, lea);
  await join(db, sarah, (await invite(db, lea, ev)).token);
  await as(db, lea, `update public.events set cover_art = 'mariage' where id = $1`, [ev]);
  assert.equal((await as(db, sarah, `select cover_art from public.events where id = $1`, [ev])).rows[0].cover_art, 'mariage');
  assert.match(await errorOf(as(db, lea, `update public.events set cover_art = 'https://ailleurs.example/x.png' where id = $1`, [ev])), /check constraint/);
  const r = await as(db, sarah, `update public.events set cover_art = 'soiree' where id = $1 returning 1`, [ev]);
  assert.equal(r.rowCount, 0, 'un participant ne modifie pas la couverture (RLS)');
  // Photo : chemin imposé par la base (dossier de l'auteur), jamais une URL externe.
  assert.match(await errorOf(as(db, lea, `update public.events set cover_path = 'https://ailleurs.example/x.png' where id = $1`, [ev])), /invalid_cover_path/);
});

test('suppression de compte : relations et invitations disparaissent, cagnottes intactes', async () => {
  const gone = await createUser(db, 'Partant');
  await friendReq(gone, lea);
  await respond(lea, gone, true);
  const ev = await createEvent(db, lea);
  await rpc(lea, `select public.invite_friends($1, $2)`, [ev, [gone]]);
  await as(db, 'service', `select public.prepare_account_deletion($1)`, [gone]);
  await db.query(`delete from auth.users where id = $1`, [gone]);
  assert.equal(await relation(lea, gone), 'none');
  assert.equal((await db.query(`select count(*)::int as n from public.event_invites where invitee_id = $1`, [gone])).rows[0].n, 0);
  assert.equal((await as(db, lea, `select id from public.events where id = $1`, [ev])).rows.length, 1);
});
