/**
 * Mode démonstration : crée des comptes et un événement fictifs, marqués is_demo = true.
 * Usage (depuis backend/) : DEMO_PASSWORD=… npm run seed:demo
 * Prérequis : migrations appliquées, SUPABASE_SECRET_KEY dans backend/.env.
 * Idempotent pour les comptes (réutilisés s'ils existent) ; crée un nouvel événement de démo à chaque exécution.
 * Le mot de passe n'est jamais écrit dans le dépôt : il vient de la variable DEMO_PASSWORD.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from '../config.js';

const config = loadConfig();
const password = process.env.DEMO_PASSWORD ?? '';
if (!config.SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY manquante (backend/.env).');
if (password.length < 10) throw new Error('Définis DEMO_PASSWORD (10 caractères minimum) pour les comptes de démo.');

const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const PEOPLE = [
  { key: 'lea', name: 'Léa', email: 'lea.demo@example.com' },
  { key: 'sarah', name: 'Sarah', email: 'sarah.demo@example.com' },
  { key: 'hugo', name: 'Hugo', email: 'hugo.demo@example.com' },
  { key: 'camille', name: 'Camille', email: 'camille.demo@example.com' },
] as const;

async function ensureUser(email: string, name: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
  if (error || !data.user) throw new Error(`Création de ${email} : ${error?.message}`);
  return data.user.id;
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Connexion ${email} : ${error.message}`);
  return client;
}

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn} : ${error.message}`);
  return data as T;
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

async function main() {
  const ids: Record<string, string> = {};
  for (const p of PEOPLE) ids[p.key] = await ensureUser(p.email, p.name);
  const lea = await signIn('lea.demo@example.com');
  const sarah = await signIn('sarah.demo@example.com');
  const hugo = await signIn('hugo.demo@example.com');
  const camille = await signIn('camille.demo@example.com');

  const eventId = await rpc<string>(lea, 'create_event', {
    p_title: 'Les 25 ans de Camille (démo)', p_beneficiary_name: 'Camille', p_occasion: 'anniversaire',
    p_description: 'Événement de démonstration : données fictives.', p_target_cents: 18000,
    p_gift_at: days(22), p_votes_close_at: days(8), p_contributions_close_at: days(20), p_reveal_at: days(22),
    p_timezone: 'Europe/Paris', p_cover_path: null, p_vote_visibility: 'private',
  });
  // Marquage démo : seule la clé service peut écrire cette colonne.
  await admin.from('events').update({ is_demo: true }).eq('id', eventId).throwOnError();

  const inv = await rpc<{ token: string }>(lea, 'create_invitation', { p_event: eventId, p_role: 'participant', p_expires_in_hours: 168, p_max_uses: null });
  await rpc(sarah, 'accept_invitation', { p_token: inv.token });
  await rpc(hugo, 'accept_invitation', { p_token: inv.token });
  await rpc(lea, 'set_member_role', { p_event: eventId, p_user: ids.sarah, p_role: 'co_organizer' });
  const benInv = await rpc<{ token: string }>(lea, 'create_invitation', { p_event: eventId, p_role: 'beneficiary', p_expires_in_hours: 720, p_max_uses: 1 });
  await rpc(camille, 'accept_invitation', { p_token: benInv.token });

  const add = async (c: SupabaseClient, title: string, price: number, url: string) =>
    (await c.from('proposals').insert({ event_id: eventId, title, price_cents: price, product_url: url }).select('id').single().throwOnError()).data!.id as string;
  const ceramique = await add(sarah, 'Atelier céramique en duo', 15000, 'https://example.com/atelier-ceramique');
  const concert = await add(hugo, 'Concert de son groupe préféré', 12000, 'https://example.com/concert');
  await add(lea, 'Appareil photo instantané', 17500, 'https://example.com/appareil-photo');
  await rpc(lea, 'cast_vote', { p_proposal: ceramique });
  await rpc(sarah, 'cast_vote', { p_proposal: ceramique });
  await rpc(hugo, 'cast_vote', { p_proposal: concert });

  for (const [client, amount, key] of [[lea, 5000, 'demo-lea'], [sarah, 4000, 'demo-sarah'], [hugo, 4500, 'demo-hugo']] as const) {
    const c = await rpc<{ id: string }>(client, 'contribution_create', { p_event: eventId, p_amount_cents: amount, p_idempotency_key: `${key}-${eventId.slice(0, 8)}` });
    await rpc(admin, 'contribution_settle', { p_contribution: c.id, p_success: true, p_provider_ref: `sim_demo_${key}` });
  }

  const order = (await lea.from('tasks').select('id').eq('event_id', eventId).eq('kind', 'order').single().throwOnError()).data!.id;
  await rpc(lea, 'claim_task', { p_task: order });
  await lea.from('messages').insert({ event_id: eventId, body: 'On part sur la céramique ? Elle en parle depuis des mois !' }).throwOnError();

  console.log(`Événement de démo créé : ${eventId}`);
  console.log('Comptes : lea / sarah / hugo / camille .demo@example.com (mot de passe : DEMO_PASSWORD)');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
