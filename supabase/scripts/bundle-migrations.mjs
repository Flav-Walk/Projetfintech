// Regroupe les migrations dans un seul fichier à coller dans le SQL Editor de Supabase.
// Usage : node supabase/scripts/bundle-migrations.mjs [depuis]
//   depuis : préfixe de version à partir duquel inclure (ex. 20261121000600). Par défaut : toutes.
// Le fichier produit (supabase/.bundle/apply.sql) est ignoré par Git ; il est régénéré à chaque appel.
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = process.argv[2] ?? '';
const all = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
const files = all.filter((f) => f >= from);
const versionOf = (f) => f.split('_')[0];
const prior = all.filter((f) => f < from).map(versionOf);
const sqlList = (vs) => (vs.length ? vs.map((v) => `'${v}'`).join(', ') : '');

const parts = [
  '-- COMPLICE : migrations regroupées. Exécuter en une fois dans le SQL Editor (rôle postgres).',
  '-- Tout est dans une transaction : en cas d’erreur, rien n’est appliqué.',
  `-- Contenu : ${files.map(versionOf).join(', ')}${prior.length ? ` ; prérequis déjà enregistrés : ${prior.join(', ')}` : ''}.`,
  'begin;',
  'create schema if not exists supabase_migrations;',
  'create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);',
  // Garde-fou : refuse de s'exécuter sur une base dont l'historique ne correspond pas.
  `do $guard$
declare v_missing text; v_present text;
begin
  select string_agg(v, ', ') into v_missing from unnest(array[${sqlList(prior)}]::text[]) v
    where not exists (select 1 from supabase_migrations.schema_migrations m where m.version = v);
  select string_agg(version, ', ') into v_present from supabase_migrations.schema_migrations
    where version = any (array[${sqlList(files.map(versionOf))}]::text[]);
  if v_missing is not null then raise exception 'COMPLICE : migrations prérequises absentes : %', v_missing; end if;
  if v_present is not null then raise exception 'COMPLICE : migrations déjà enregistrées : % (ne rien rejouer)', v_present; end if;
end $guard$;`,
];
for (const f of files) {
  const version = f.split('_')[0];
  const name = f.replace(/^\d+_/, '').replace(/\.sql$/, '');
  parts.push(`\n-- ===== ${f} =====`, readFileSync(join(root, 'migrations', f), 'utf8'));
  // Enregistre la version comme le ferait `supabase db push`, pour que la CLI reste cohérente ensuite.
  parts.push(
    `create schema if not exists supabase_migrations;`,
    `create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`,
    `insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}') on conflict do nothing;`,
  );
}
parts.push('commit;', "\nselect 'COMPLICE : ' || count(*) || ' migrations enregistrées' as resultat from supabase_migrations.schema_migrations;");

mkdirSync(join(root, '.bundle'), { recursive: true });
const out = join(root, '.bundle', 'apply.sql');
writeFileSync(out, parts.join('\n'), 'utf8');
console.log(`${files.length} migration(s) -> ${out}`);
for (const f of files) console.log(`  ${f}`);
