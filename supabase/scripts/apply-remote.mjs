// Applique les migrations manquantes au projet Supabase distant via l'API de gestion,
// puis exécute supabase/verify.sql. Jeton lu dans supabase/.env (ignoré par Git), jamais affiché.
//
//   supabase/.env :  SUPABASE_ACCESS_TOKEN=sbp_...   (supabase.com/dashboard/account/tokens)
//                    SUPABASE_PROJECT_REF=uecptmijcjwmzdebeugk
//   Usage :          node --env-file=supabase/.env supabase/scripts/apply-remote.mjs [--dry-run]
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF ?? 'uecptmijcjwmzdebeugk';
const dryRun = process.argv.includes('--dry-run');
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN absent (supabase/.env).');
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} : ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : [];
}

const applied = new Set(
  (
    await query(
      `select version from supabase_migrations.schema_migrations
       where to_regclass('supabase_migrations.schema_migrations') is not null`,
    ).catch(() => [])
  ).map((r) => r.version),
);
const files = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
const pending = files.filter((f) => !applied.has(f.split('_')[0]));
console.log(`Projet ${ref} : ${applied.size} migration(s) enregistrée(s), ${pending.length} à appliquer.`);
for (const f of pending) console.log(`  - ${f}`);

if (!dryRun && pending.length > 0) {
  // Une seule transaction : en cas d'erreur, rien n'est appliqué.
  const parts = ['begin;', 'create schema if not exists supabase_migrations;',
    'create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);'];
  for (const f of pending) {
    parts.push(readFileSync(join(root, 'migrations', f), 'utf8'));
    parts.push(`insert into supabase_migrations.schema_migrations (version, name) values ('${f.split('_')[0]}', '${f.replace(/^\d+_/, '').replace(/\.sql$/, '')}') on conflict do nothing;`);
  }
  parts.push('commit;');
  await query(parts.join('\n'));
  console.log('Migrations appliquées.');
}

const checks = readFileSync(join(root, 'verify.sql'), 'utf8').split('-- Planification')[0];
let ok = true;
try {
  for (const r of await query(checks)) {
    ok &&= r.ok === true;
    console.log(`${r.ok ? 'OK ' : 'KO '} ${r.controle} => ${r.valeur}`);
  }
} catch (e) {
  ok = false;
  console.log(`Contrôle impossible : ${e.message}`);
}
try {
  const cron = await query(`select jobname, schedule, active from cron.job where jobname = 'complice-reminders'`);
  console.log(cron.length ? `OK  rappels planifiés (pg_cron ${cron[0].schedule}, actif=${cron[0].active})` : 'KO  tâche pg_cron absente');
} catch {
  console.log('--  pg_cron non activé : rappels déclenchés par l’app uniquement');
}
process.exit(ok ? 0 : 2);
