// Migration 13 : parcours de la personne fêtée. Invitation nominative (ami, e-mail lié à l'adresse confirmée),
// suivi (envoyée, acceptée, expirée, annulée, renvoyée), une seule personne fêtée, pas de passage par erreur
// d'un rôle à l'autre, et accès limité à la capsule à partir de l'heure serveur d'ouverture.
// Rôles : organisatrice (Léa), participante (Sarah), personne fêtée inscrite (Camille), personne fêtée sans
// compte (Nina), participant (Tom), personne extérieure (Intrus).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, createUser, as, errorOf, createEvent, invite, join, inDays } from './helpers.mjs';

let db;
let lea, sarah, camille, tom, intrus;

before(async () => {
  db = await freshDb();
  lea = await createUser(db, 'Lea');
  sarah = await createUser(db, 'Sarah');
  camille = await createUser(db, 'Camille');
  tom = await createUser(db, 'Tom');
  intrus = await createUser(db, 'Intrus');
  // Léa et Camille sont amies (invitation par sélection d'un ami).
  await as(db, lea, `select public.send_friend_request($1)`, [camille]);
  await as(db, camille, `select public.respond_friend_request($1, true)`, [lea]);
});

const one = async (uid, sql, params = []) => (await as(db, uid, sql, params)).rows[0];
const overview = async (ev) => (await as(db, lea, `select kind, role, status, email_hint from public.event_invites_overview($1) where role = 'beneficiary'`, [ev])).rows;
const openNow = (ev) => db.query(`update public.events set votes_close_at = now() - interval '2 days', contributions_close_at = now() - interval '2 days', reveal_at = now() - interval '1 second' where id = $1`, [ev]);

async function groupEvent(overrides = {}) {
  const ev = await createEvent(db, lea, overrides);
  await join(db, sarah, (await invite(db, lea, ev)).token);
  return ev;
}

test('lien générique : ne peut jamais attribuer le rôle bénéficiaire (création et anciens liens)', async () => {
  const ev = await groupEvent();
  assert.match(await errorOf(invite(db, lea, ev, 'beneficiary')), /beneficiary_link_forbidden/);
  // Un ancien lien de bénéficiaire (créé avant la migration) devient inutilisable.
  await db.query(`insert into public.invitations (event_id, token_hash, role, created_by, expires_at, max_uses)
                  values ($1, public.hash_token('ancien-lien-benef'), 'beneficiary', $2, now() + interval '1 day', 1)`, [ev, lea]);
  assert.equal((await one(intrus, `select public.preview_invitation('ancien-lien-benef') as r`)).r.status, 'invalid');
  assert.equal((await join(db, intrus, 'ancien-lien-benef')).status, 'invalid');
  assert.equal((await one(intrus, `select count(*)::int as n from public.event_members where event_id = $1 and user_id = $2`, [ev, intrus])).n, 0);
});

test('ami déjà inscrit : invitation sans rien des préparatifs, acceptée dans l’app, rôle bénéficiaire uniquement', async () => {
  const ev = await groupEvent({ title: 'Les 30 ans de Camille' });
  const [r] = (await one(lea, `select public.invite_friends($1, $2, 'beneficiary') as r`, [ev, [camille]])).r;
  assert.equal(r.status, 'invited');
  assert.deepEqual((await overview(ev)).map((o) => o.status), ['pending']);
  // Une seule personne fêtée : seconde invitation refusée (ami ou e-mail).
  assert.match(await errorOf(as(db, lea, `select public.prepare_email_invitation($1, 'beneficiary', 'autre@exemple.fr')`, [ev])), /beneficiary_taken/);

  const mine = (await as(db, camille, `select * from public.my_event_invites()`)).rows.find((i) => i.event_id === ev);
  assert.equal(mine.role, 'beneficiary');
  assert.equal(mine.title, null, 'ni titre');
  assert.equal(mine.member_count, null, 'ni groupe');
  const notif = (await as(db, camille, `select data from public.notifications where kind = 'event_invite'`)).rows.at(-1);
  assert.equal(notif.data.title, null);

  const res = (await one(camille, `select public.respond_event_invite($1, true) as r`, [mine.id])).r;
  assert.equal(res.status, 'joined');
  assert.equal(res.role, 'beneficiary');
  assert.equal((await db.query(`select beneficiary_user_id from public.events where id = $1`, [ev])).rows[0].beneficiary_user_id, camille);
  assert.deepEqual((await overview(ev)).map((o) => o.status), ['accepted']);
});

test('sans compte : e-mail sans titre, compte créé, adresse confirmée par code, capsule verrouillée retrouvée', async () => {
  const ev = await groupEvent({ title: 'Pot de départ de Nina' });
  const q = (await one(lea, `select public.prepare_email_invitation($1, 'beneficiary', 'Nina@Exemple.fr') as r`, [ev])).r;
  assert.equal(q.status, 'queued');
  const { rows: [mail] } = await db.query(`select to_email, payload from public.email_outbox where event_id = $1 and kind = 'invitation'`, [ev]);
  assert.equal(mail.to_email, 'nina@exemple.fr');
  assert.equal(mail.payload.event_title, null, 'rien des préparatifs dans l’e-mail');
  assert.equal(mail.payload.beneficiary_name, null);
  assert.deepEqual((await overview(ev)).map((o) => [o.kind, o.status, o.email_hint]), [['email', 'pending', 'ni•••@exemple.fr']]);

  // Aperçu du lien : la date d'ouverture de la capsule, pas le titre.
  const prev = (await as(db, null, `select public.preview_invitation($1) as r`, [mail.payload.token])).rows[0].r;
  assert.equal(prev.status, 'valid');
  assert.equal(prev.title, null);
  assert.equal(prev.role, 'beneficiary');

  // Une autre personne (adresse différente) ne peut pas récupérer l'accès.
  assert.equal((await join(db, intrus, mail.payload.token)).status, 'wrong_account');
  // Nina crée son compte : tant que l'adresse n'est pas confirmée par le code, l'accès est refusé.
  const { rows: [nu] } = await db.query(`insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values ('nina@exemple.fr', '{"display_name":"Nina"}', null) returning id`);
  assert.equal((await join(db, nu.id, mail.payload.token)).status, 'wrong_account');
  await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [nu.id]);
  const ok = await join(db, nu.id, mail.payload.token);
  assert.equal(ok.status, 'joined');
  assert.equal(ok.role, 'beneficiary');
  assert.notEqual((await join(db, intrus, mail.payload.token)).status, 'joined', 'lien à usage unique et nominatif');

  const cap = (await one(nu.id, `select public.beneficiary_capsule($1) as c`, [ev])).c;
  assert.equal(cap.state, 'sealed');
  assert.deepEqual(Object.keys(cap).sort(), ['cover_art', 'cover_path', 'event_id', 'occasion', 'opened_at', 'organizer_name', 'reveal_at', 'server_now', 'state', 'timezone', 'title']);
  assert.equal(cap.title, null);
  assert.equal(cap.cover_path, null);
  assert.equal(cap.organizer_name, 'Lea');
  assert.deepEqual((await overview(ev)).map((o) => o.status), ['accepted']);
});

test('annulée, expirée, renvoyée : statuts suivis, ancien lien inutilisable, nouvel e-mail à la même adresse', async () => {
  const ev = await groupEvent();
  const r1 = (await one(lea, `select public.prepare_email_invitation($1, 'beneficiary', 'zoe@exemple.fr') as r`, [ev])).r;
  const tok1 = (await db.query(`select payload from public.email_outbox where dedupe_key = $1`, [`invitation:${r1.invitation_id}`])).rows[0].payload.token;

  // Renvoyer : nouveau lien, l'ancien est révoqué ; l'adresse n'est jamais renvoyée au client.
  const re = (await one(lea, `select public.resend_event_invitation($1) as r`, [r1.invitation_id])).r;
  assert.equal(re.status, 'queued');
  assert.ok(!JSON.stringify(re).includes('zoe@'), 'adresse non exposée');
  const outs = (await db.query(`select to_email, payload from public.email_outbox where event_id = $1 and kind = 'invitation' order by created_at`, [ev])).rows;
  assert.equal(outs.length, 2);
  assert.ok(outs.every((o) => o.to_email === 'zoe@exemple.fr'));
  const { rows: [zoe] } = await db.query(`insert into auth.users (email, raw_user_meta_data) values ('zoe@exemple.fr', '{"display_name":"Zoé"}') returning id`);
  assert.equal((await join(db, zoe.id, tok1)).status, 'revoked');
  assert.deepEqual((await overview(ev)).map((o) => o.status).sort(), ['cancelled', 'pending']);
  assert.match(await errorOf(as(db, sarah, `select public.resend_event_invitation($1)`, [r1.invitation_id])), /forbidden/, 'gestionnaires seulement');

  // Annuler : plus d'accès.
  const pending = (await as(db, lea, `select id from public.event_invites_overview($1) where status = 'pending'`, [ev])).rows[0];
  await as(db, lea, `select public.cancel_email_invitation($1)`, [pending.id]);
  const tok2 = outs[1].payload.token;
  assert.equal((await join(db, zoe.id, tok2)).status, 'revoked');
  assert.deepEqual((await overview(ev)).map((o) => o.status), ['cancelled', 'cancelled']);

  // Expirée : ne bloque plus une nouvelle invitation, et ne s'accepte pas.
  const r3 = (await one(lea, `select public.invite_friends($1, $2, 'beneficiary') as r`, [ev, [camille]])).r;
  assert.equal(r3[0].status, 'invited');
  await db.query(`update public.event_invites set expires_at = now() - interval '1 minute' where event_id = $1 and invitee_id = $2`, [ev, camille]);
  const [exp] = (await as(db, lea, `select status from public.event_invites_overview($1) where invitee_id = $2`, [ev, camille])).rows;
  assert.equal(exp.status, 'expired');
  const myOld = (await db.query(`select id from public.event_invites where event_id = $1 and invitee_id = $2`, [ev, camille])).rows[0];
  assert.equal((await one(camille, `select public.respond_event_invite($1, true) as r`, [myOld.id])).r.status, 'expired');
  // Renvoyer l'invitation d'un ami expirée : nouvelle invitation acceptable.
  const re2 = (await one(lea, `select public.resend_event_invitation($1) as r`, [myOld.id])).r;
  assert.equal(re2.status, 'invited');
  const fresh = (await as(db, camille, `select id from public.my_event_invites() where event_id = $1`, [ev])).rows[0];
  assert.equal((await one(camille, `select public.respond_event_invite($1, true) as r`, [fresh.id])).r.role, 'beneficiary');
});

test('pas de changement de rôle par erreur : un préparateur n’accepte pas le rôle bénéficiaire, et inversement', async () => {
  const ev = await groupEvent();
  await as(db, tom, `select public.send_friend_request($1)`, [lea]);
  await as(db, lea, `select public.respond_friend_request($1, true)`, [tom]);
  await as(db, lea, `select public.invite_friends($1, $2, 'beneficiary')`, [ev, [tom]]);
  // Tom rejoint d'abord comme participant par un lien, puis tente d'accepter l'invitation de bénéficiaire.
  await join(db, tom, (await invite(db, lea, ev)).token);
  const i = (await db.query(`select id from public.event_invites where event_id = $1 and invitee_id = $2 and role = 'beneficiary'`, [ev, tom])).rows[0];
  assert.equal((await one(tom, `select public.respond_event_invite($1, true) as r`, [i.id])).r.status, 'role_conflict');
  assert.equal((await one(tom, `select public.my_role($1) as r`, [ev])).r, 'participant');
  assert.equal((await db.query(`select beneficiary_user_id from public.events where id = $1`, [ev])).rows[0].beneficiary_user_id, null);
  // Un membre déjà actif n'est pas réinvité comme bénéficiaire.
  assert.equal((await one(lea, `select public.prepare_email_invitation($1, 'beneficiary', 'sarah@test.local') as r`, [ev])).r.status, 'already_member');
  assert.equal((await one(lea, `select public.invite_friends($1, $2, 'beneficiary') as r`, [ev, [tom]])).r[0].status, 'already_member');
});

test('avant l’ouverture : rien de la capsule ni des préparatifs, par l’API comme par les médias', async () => {
  const ev = await groupEvent({ votes: inDays(1), contrib: inDays(1), gift: inDays(2), reveal: inDays(2) });
  await as(db, lea, `select public.invite_friends($1, $2, 'beneficiary')`, [ev, [camille]]);
  const inv = (await as(db, camille, `select id from public.my_event_invites() where event_id = $1`, [ev])).rows[0];
  await as(db, camille, `select public.respond_event_invite($1, true)`, [inv.id]);
  const photo = `${ev}/capsule/${sarah}/p.jpg`;
  await as(db, sarah, `insert into public.capsule_entries (event_id, body, photo_path, status) values ($1, 'Bon anniversaire', $2, 'published')`, [ev, photo]);
  await as(db, lea, `insert into public.capsule_entries (event_id, body) values ($1, 'brouillon de Léa')`, [ev]);

  const cap = (await one(camille, `select public.beneficiary_capsule($1) as c`, [ev])).c;
  assert.equal(cap.state, 'sealed');
  assert.ok(Math.abs(new Date(cap.server_now) - Date.now()) < 60000, 'heure serveur fournie');
  assert.equal(cap.title, null);
  for (const [sql, label] of [
    [`select id from public.capsule_entries where event_id = $1`, 'mots'],
    [`select id from public.events where id = $1`, 'cagnotte'],
    [`select user_id from public.event_members where event_id = $1 and user_id <> auth.uid()`, 'membres'],
  ]) assert.equal((await as(db, camille, sql, [ev])).rows.length, 0, label);
  assert.equal((await one(camille, `select public.capsule_stats($1) as s`, [ev])).s, null, 'aucun compteur');
  assert.equal((await one(camille, `select public.event_progress($1) as p`, [ev])).p, null);
  assert.equal((await one(camille, `select public.can_read_media($1) as ok`, [photo])).ok, false, 'photo avant l’heure refusée');
  assert.match(await errorOf(as(db, camille, `select public.mark_capsule_opened($1)`, [ev])), /capsule_sealed/);
  // Aucune notification ne dévoile un dépôt de mot.
  assert.equal((await as(db, camille, `select id from public.notifications where event_id = $1`, [ev])).rows.length, 0);
});

test('après l’ouverture : mots et photos publiés seulement ; jamais cagnotte, idées, votes, missions, discussion, journal', async () => {
  const ev = await groupEvent({ title: 'Les 40 ans de Camille' });
  await as(db, lea, `select public.invite_friends($1, $2, 'beneficiary')`, [ev, [camille]]);
  const inv = (await as(db, camille, `select id from public.my_event_invites() where event_id = $1`, [ev])).rows[0];
  await as(db, camille, `select public.respond_event_invite($1, true)`, [inv.id]);
  const photo = `${ev}/capsule/${sarah}/p.jpg`;
  const draftPhoto = `${ev}/capsule/${lea}/d.jpg`;
  const idea = `${ev}/proposals/${sarah}/i.jpg`;
  await as(db, sarah, `insert into public.capsule_entries (event_id, body, photo_path, status) values ($1, 'Joyeux anniversaire', $2, 'published')`, [ev, photo]);
  await as(db, lea, `insert into public.capsule_entries (event_id, body, photo_path) values ($1, 'brouillon', $2)`, [ev, draftPhoto]);
  const { rows: [p] } = await as(db, sarah, `insert into public.proposals (event_id, title, price_cents, image_path) values ($1, 'Vélo', 30000, $2) returning id`, [ev, idea]);
  await as(db, sarah, `select public.cast_vote($1)`, [p.id]);
  await as(db, lea, `select public.select_gift($1, $2)`, [ev, p.id]);
  await as(db, sarah, `insert into public.messages (event_id, body) values ($1, 'On commande ?')`, [ev]);
  const { rows: [c] } = await as(db, sarah, `select (public.contribution_create($1, 2000, 'cle-benef-0001')).id`, [ev]);
  await as(db, 'service', `select public.contribution_settle($1, true, 'sim')`, [c.id]);

  await openNow(ev);
  const cap = (await one(camille, `select public.beneficiary_capsule($1) as c`, [ev])).c;
  assert.equal(cap.state, 'open');
  assert.equal(cap.title, 'Les 40 ans de Camille');
  const words = (await as(db, camille, `select body, status, author_id from public.capsule_entries where event_id = $1`, [ev])).rows;
  assert.deepEqual(words.map((w) => w.body), ['Joyeux anniversaire'], 'brouillons jamais lisibles');
  assert.equal((await one(camille, `select public.can_read_media($1) as ok`, [photo])).ok, true);
  assert.equal((await one(camille, `select public.can_read_media($1) as ok`, [draftPhoto])).ok, false);
  assert.equal((await one(camille, `select public.can_read_media($1) as ok`, [idea])).ok, false, 'photo d’idée');

  for (const [sql, label] of [
    [`select 1 from public.proposals where event_id = $1`, 'idées'],
    [`select 1 from public.votes where event_id = $1`, 'votes'],
    [`select 1 from public.tasks where event_id = $1`, 'missions'],
    [`select 1 from public.messages where event_id = $1`, 'discussion'],
    [`select 1 from public.activity where event_id = $1`, 'journal'],
    [`select 1 from public.contributions where event_id = $1`, 'participations'],
  ]) assert.equal((await as(db, camille, sql, [ev])).rows.length, 0, label);
  assert.equal((await one(camille, `select public.event_funding($1) as f`, [ev])).f, null, 'cagnotte');
  assert.equal((await one(camille, `select public.revealed_gift($1) as g`, [ev])).g, null, 'cadeau retenu');
  assert.match(await errorOf(as(db, camille, `select * from public.event_finances where event_id = $1`, [ev])), /permission denied/);
  const prog = (await one(camille, `select public.event_progress($1) as p`, [ev])).p;
  assert.equal(prog.tasks_total + prog.proposals + prog.capsule_published + prog.preparers, 0, 'aucun compteur des préparatifs');
  assert.equal(prog.next_action, 'open_capsule');

  // Ouverture mémorisée une fois (ne se rejoue pas), puis retour ultérieur.
  const t1 = (await one(camille, `select public.mark_capsule_opened($1) as t`, [ev])).t;
  const t2 = (await one(camille, `select public.mark_capsule_opened($1) as t`, [ev])).t;
  assert.equal(String(t1), String(t2));
  assert.ok((await one(camille, `select public.beneficiary_capsule($1) as c`, [ev])).c.opened_at);
  assert.match(await errorOf(as(db, sarah, `select public.mark_capsule_opened($1)`, [ev])), /capsule_sealed/, 'réservé à la personne fêtée');
  // Remercier le groupe.
  await as(db, camille, `insert into public.event_thanks (event_id, body) values ($1, 'Merci à tous !')`, [ev]);
  assert.equal((await as(db, sarah, `select body from public.event_thanks where event_id = $1`, [ev])).rows[0].body, 'Merci à tous !');
  // Une personne extérieure ne voit toujours rien.
  assert.equal((await as(db, intrus, `select id from public.capsule_entries where event_id = $1`, [ev])).rows.length, 0);
  assert.equal((await one(intrus, `select public.beneficiary_capsule($1) as c`, [ev])).c, null);
});
