// Migration 10 : missions selon l'occasion, remerciements, préférence e-mail, file d'e-mails métier.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, createUser, as, errorOf, inDays, createEvent, invite, join } from './helpers.mjs';

let db;
let lea, sarah, camille, intrus;

before(async () => {
  db = await freshDb();
  lea = await createUser(db, 'Lea');
  sarah = await createUser(db, 'Sarah');
  camille = await createUser(db, 'Camille');
  intrus = await createUser(db, 'Intrus');
});

async function groupEvent(overrides = {}) {
  const ev = await createEvent(db, lea, overrides);
  await join(db, sarah, (await invite(db, lea, ev)).token);
  await join(db, camille, (await invite(db, lea, ev, 'beneficiary', 24, 1)).token);
  return ev;
}
const reveal = (ev) => db.query(
  `update public.events set votes_close_at = now() - interval '2 days', contributions_close_at = now() - interval '2 days', reveal_at = now() - interval '1 minute' where id = $1`, [ev]);

test('missions par défaut adaptées à l’occasion', async () => {
  const birthday = await createEvent(db, lea);
  const leaving = await createEvent(db, lea, { occasion: 'départ' });
  const titles = async (ev) => (await as(db, lea, `select title from public.tasks where event_id = $1 order by position`, [ev])).rows.map((r) => r.title);
  assert.deepEqual(await titles(birthday), ['Commander le cadeau', 'Récupérer le cadeau', 'Emballer le cadeau', 'Préparer la carte', 'Remettre le cadeau']);
  const t = await titles(leaving);
  assert.equal(t.length, 5);
  assert.ok(t.includes('Faire signer la carte par l’équipe'));
  assert.ok(t.includes('Organiser le pot de départ'));
  // Toujours modifiables par un gestionnaire.
  const { rows: [task] } = await as(db, lea, `select id from public.tasks where event_id = $1 order by position limit 1`, [leaving]);
  await as(db, lea, `update public.tasks set title = 'Commander le livre' where id = $1`, [task.id]);
  assert.equal((await as(db, lea, `select title from public.tasks where id = $1`, [task.id])).rows[0].title, 'Commander le livre');
});

test('remerciements : le bénéficiaire, après l’ouverture, une seule fois ; lus par le groupe', async () => {
  const ev = await groupEvent();
  const post = (uid, body) => as(db, uid, `insert into public.event_thanks (event_id, author_id, body) values ($1, $2, $3)`, [ev, uid, body]);
  assert.match(await errorOf(post(camille, 'Merci !')) ?? 'aucune erreur', /row-level security/, 'avant l’ouverture');
  await reveal(ev);
  assert.match(await errorOf(post(sarah, 'Je remercie')) ?? 'aucune erreur', /row-level security/, 'un participant ne remercie pas à la place du bénéficiaire');
  await post(camille, 'Merci à tous, je suis très touchée.');
  assert.match(await errorOf(post(camille, 'Deuxième')) ?? 'aucune erreur', /duplicate key|unique/);
  await as(db, camille, `update public.event_thanks set body = 'Merci infiniment !' where event_id = $1`, [ev]);
  for (const u of [lea, sarah, camille]) {
    assert.equal((await as(db, u, `select body from public.event_thanks where event_id = $1`, [ev])).rows[0]?.body, 'Merci infiniment !');
  }
  assert.equal((await as(db, intrus, `select body from public.event_thanks where event_id = $1`, [ev])).rows.length, 0);
  assert.match(await errorOf(as(db, sarah, `update public.event_thanks set body = 'x' where event_id = $1 returning 1`, [ev]).then((r) => { if (r.rowCount === 0) throw new Error('row-level security'); })) ?? '', /row-level security/);
  const n = await as(db, sarah, `select count(*)::int as n from public.notifications where kind = 'thanks' and event_id = $1`, [ev]);
  assert.equal(n.rows[0].n, 1, 'le groupe est prévenu une fois');
});

test('préférence e-mail : activée par défaut, modifiable par soi seul', async () => {
  assert.equal((await as(db, sarah, `select emails from public.notification_prefs`)).rows[0].emails, true);
  await as(db, sarah, `update public.notification_prefs set emails = false where user_id = $1`, [sarah]);
  assert.equal((await as(db, sarah, `select emails from public.notification_prefs`)).rows[0].emails, false);
  await as(db, sarah, `update public.notification_prefs set emails = true where user_id = $1`, [sarah]);
});

test('ouverture de la capsule : un e-mail par personne qui l’accepte, jamais deux fois', async () => {
  const ev = await groupEvent({ title: 'Surprise e-mail' });
  await as(db, sarah, `update public.notification_prefs set emails = false where user_id = $1`, [sarah]);
  await reveal(ev);
  await as(db, 'service', `select public.run_due_reminders()`);
  await as(db, 'service', `select public.run_due_reminders()`);
  const { rows } = await db.query(`select to_email, kind, status, payload from public.email_outbox where event_id = $1 order by to_email`, [ev]);
  assert.deepEqual(rows.map((r) => r.to_email), ['camille@test.local', 'lea@test.local'], 'Sarah a refusé les e-mails');
  assert.ok(rows.every((r) => r.kind === 'capsule_open' && r.status === 'pending'));
  assert.ok(rows.every((r) => !JSON.stringify(r.payload).match(/cents|price|amount/)), 'aucune donnée financière');
  await as(db, sarah, `update public.notification_prefs set emails = true where user_id = $1`, [sarah]);
});

test('file d’e-mails : fermée aux clients, traitée par le service avec tentatives limitées', async () => {
  for (const u of [lea, intrus]) {
    assert.match(await errorOf(as(db, u, `select * from public.email_outbox`)), /permission denied/);
    assert.match(await errorOf(as(db, u, `select * from public.claim_email_batch(10)`)), /permission denied/);
  }
  const ev = await createEvent(db, lea);
  const inv = await invite(db, lea, ev, 'participant', 168, 1);
  await as(db, 'service', `insert into public.email_outbox (kind, to_email, event_id, payload, dedupe_key) values ('invitation', 'ami@test.local', $1, $2, $3)`,
    [ev, { token: inv.token, event_title: 'Les 25 ans de Camille' }, `invitation:${inv.id}`]);
  assert.match(await errorOf(as(db, 'service', `insert into public.email_outbox (kind, to_email, event_id, dedupe_key) values ('invitation', 'ami@test.local', $1, $2)`, [ev, `invitation:${inv.id}`])), /duplicate key|unique/, 'pas de doublon');

  const claim = async () => (await as(db, 'service', `select * from public.claim_email_batch(50)`)).rows.filter((r) => r.to_email === 'ami@test.local');
  let [mail] = await claim();
  assert.equal(mail.attempts, 1);
  assert.equal((await claim()).length, 0, 'une ligne en cours d’envoi n’est pas reprise');
  // Échec temporaire : nouvelle tentative différée.
  await as(db, 'service', `select public.complete_email($1, false, null, 'timeout')`, [mail.id]);
  let row = (await db.query(`select status, next_attempt_at > now() as later from public.email_outbox where id = $1`, [mail.id])).rows[0];
  assert.deepEqual(row, { status: 'pending', later: true });
  // Trois échecs : abandon, jeton effacé.
  for (let i = 0; i < 2; i++) {
    await db.query(`update public.email_outbox set next_attempt_at = now() where id = $1`, [mail.id]);
    [mail] = await claim();
    await as(db, 'service', `select public.complete_email($1, false, null, 'timeout')`, [mail.id]);
  }
  row = (await db.query(`select status, attempts, payload from public.email_outbox where id = $1`, [mail.id])).rows[0];
  assert.equal(row.status, 'failed');
  assert.equal(row.attempts, 3);
  assert.equal(row.payload.token, undefined, 'jeton d’invitation effacé après abandon');

  // Erreur définitive : abandon immédiat.
  const inv3 = await invite(db, lea, ev, 'participant', 168, 1);
  await as(db, 'service', `insert into public.email_outbox (kind, to_email, event_id, payload, dedupe_key) values ('invitation', 'refuse@test.local', $1, $2, $3)`,
    [ev, { token: inv3.token }, `invitation:${inv3.id}`]);
  const [m3] = (await as(db, 'service', `select * from public.claim_email_batch(50)`)).rows.filter((r) => r.to_email === 'refuse@test.local');
  await as(db, 'service', `select public.complete_email($1, false, null, 'brevo_400_invalid_parameter', true)`, [m3.id]);
  assert.equal((await db.query(`select status from public.email_outbox where id = $1`, [m3.id])).rows[0].status, 'failed');

  // Succès : envoyé, jeton effacé.
  const inv2 = await invite(db, lea, ev, 'participant', 168, 1);
  await as(db, 'service', `insert into public.email_outbox (kind, to_email, event_id, payload, dedupe_key) values ('invitation', 'ami2@test.local', $1, $2, $3)`,
    [ev, { token: inv2.token }, `invitation:${inv2.id}`]);
  const [m2] = (await as(db, 'service', `select * from public.claim_email_batch(50)`)).rows.filter((r) => r.to_email === 'ami2@test.local');
  await as(db, 'service', `select public.complete_email($1, true, 'msg-123', null)`, [m2.id]);
  const sent = (await db.query(`select status, provider_message_id, payload, sent_at is not null as dated from public.email_outbox where id = $1`, [m2.id])).rows[0];
  assert.equal(sent.status, 'sent');
  assert.equal(sent.provider_message_id, 'msg-123');
  assert.equal(sent.payload.token, undefined);
  assert.equal(sent.dated, true);
});

test('invitation par e-mail : seul un gestionnaire peut la préparer', async () => {
  const ev = await groupEvent();
  assert.match(await errorOf(as(db, sarah, `select public.prepare_email_invitation($1, 'participant', 'ami@test.local')`, [ev])), /forbidden/);
  const r = (await as(db, lea, `select public.prepare_email_invitation($1, 'participant', 'Ami@Test.local') as r`, [ev])).rows[0].r;
  assert.equal(r.status, 'queued');
  const again = (await as(db, lea, `select public.prepare_email_invitation($1, 'participant', 'ami@test.local') as r`, [ev])).rows[0].r;
  assert.equal(again.status, 'already_sent', 'même adresse dans l’heure : pas de second e-mail');
  const { rows } = await db.query(`select to_email, payload from public.email_outbox where event_id = $1 and kind = 'invitation'`, [ev]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].to_email, 'ami@test.local');
  assert.match(rows[0].payload.token, /^[a-f0-9]{64}$/);
  assert.equal(rows[0].payload.inviter_name, 'Lea');
  assert.match(await errorOf(as(db, lea, `select public.prepare_email_invitation($1, 'participant', 'pas-une-adresse')`, [ev])), /invalid_email/);
  assert.match(await errorOf(as(db, null, `select public.prepare_email_invitation($1, 'participant', 'x@y.fr')`, [ev])), /permission denied/);
});
