import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join as pathJoin, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = pathJoin(here, '..', 'migrations');

/** Base neuve : socle Supabase émulé + toutes les migrations, dans l'ordre. */
export async function freshDb() {
  const db = new PGlite();
  await db.exec(readFileSync(pathJoin(here, 'supabase-shim.sql'), 'utf8'));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(pathJoin(migrationsDir, file), 'utf8'));
    } catch (err) {
      throw new Error(`Migration ${file} : ${err.message}`);
    }
  }
  return db;
}

/** Crée un utilisateur Auth (le trigger crée profil et préférences). */
export async function createUser(db, name) {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${name.toLowerCase()}@test.local`, { display_name: name }],
  );
  return rows[0].id;
}

/**
 * Exécute une requête sous l'identité d'un utilisateur (rôle authenticated + claims JWT),
 * comme le ferait PostgREST. Sans uid : rôle anon. uid = 'service' : rôle service_role.
 */
export async function as(db, uid, sql, params = []) {
  return db.transaction(async (tx) => {
    if (uid === 'service') {
      await tx.exec(`set local role service_role`);
    } else if (uid) {
      await tx.exec(`set local role authenticated`);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
    } else {
      await tx.exec(`set local role anon`);
    }
    return tx.query(sql, params);
  });
}

/** Renvoie le message d'erreur Postgres, ou null si la requête réussit. */
export async function errorOf(promise) {
  try {
    await promise;
    return null;
  } catch (err) {
    return err.message;
  }
}

export function inDays(n) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

/** Crée un événement standard via la RPC, sous l'identité de l'organisateur. */
export async function createEvent(db, organizer, overrides = {}) {
  const p = {
    title: 'Les 25 ans de Camille', beneficiary: 'Camille', occasion: 'anniversaire', description: null,
    target: 18000, gift: inDays(30), votes: inDays(10), contrib: inDays(25), reveal: inDays(30), ...overrides,
  };
  const { rows } = await as(db, organizer,
    `select public.create_event($1,$2,$3,$4,$5,$6,$7,$8,$9) as id`,
    [p.title, p.beneficiary, p.occasion, p.description, p.target, p.gift, p.votes, p.contrib, p.reveal]);
  return rows[0].id;
}

export async function invite(db, manager, eventId, role = 'participant', hours = 168, maxUses = null) {
  const { rows } = await as(db, manager, `select public.create_invitation($1, $2, $3, $4) as inv`, [eventId, role, hours, maxUses]);
  return rows[0].inv;
}

/**
 * Personne fêtée : invitation nominative par e-mail (adresse confirmée du compte), puis acceptation dans l'app.
 * Depuis la migration 13, un lien générique ne peut plus attribuer ce rôle.
 */
export async function joinAsBeneficiary(db, manager, eventId, uid) {
  const { rows: [u] } = await db.query(`select email from auth.users where id = $1`, [uid]);
  const { rows: [p] } = await as(db, manager, `select public.prepare_email_invitation($1, 'beneficiary', $2) as r`, [eventId, u.email]);
  if (p.r.status !== 'queued') return p.r;
  const { rows: [i] } = await as(db, uid, `select id from public.my_event_invites() where event_id = $1`, [eventId]);
  return (await as(db, uid, `select public.respond_event_invite($1, true) as r`, [i.id])).rows[0].r;
}

export async function join(db, uid, token) {
  const { rows } = await as(db, uid, `select public.accept_invitation($1) as r`, [token]);
  return rows[0].r;
}
