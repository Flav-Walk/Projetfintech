-- Migration 14 : corrections de l'audit du 2026-11-24 et droits des personnes.
-- 1. L'ouverture de la capsule ne peut plus être déplacée dans le passé par une modification (la création le
--    refusait déjà : reveal_in_past). Constat : un gestionnaire ouvrait la capsule immédiatement et
--    irréversiblement, mots en brouillon des autres membres scellés hors de la capsule.
-- 2. export_my_data() : export des données du compte (droit d'accès et portabilité), sans contenu privé d'autrui.
-- 3. purge_stale_data() : effacement planifié des données temporaires (règles à valider, voir docs/CONFIDENTIALITE.md).
-- Aucune donnée existante n'est modifiée par cette migration.

-- ---------------------------------------------------------------------------
-- 1. Dates : ouverture jamais dans le passé
-- ---------------------------------------------------------------------------
create or replace function public.events_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  -- Les fonctions SECURITY DEFINER s'exécutent sous le propriétaire : pas de restriction.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.created_by is distinct from old.created_by
     or new.is_demo is distinct from old.is_demo
     or new.status is distinct from old.status
     or new.beneficiary_user_id is distinct from old.beneficiary_user_id
     or new.selected_proposal_id is distinct from old.selected_proposal_id
     or new.gift_confirmed_at is distinct from old.gift_confirmed_at
     or new.currency is distinct from old.currency then
    raise exception 'protected_column' using errcode = '42501';
  end if;
  if old.status <> 'active' then
    raise exception 'event_locked' using errcode = 'P0001';
  end if;
  if new.cover_path is distinct from old.cover_path and new.cover_path is not null
     and new.cover_path not like auth.uid()::text || '/covers/%' then
    raise exception 'invalid_cover_path' using errcode = 'P0001';
  end if;
  if new.votes_close_at is distinct from old.votes_close_at and old.votes_close_at <= now() then
    raise exception 'votes_already_closed' using errcode = 'P0001';
  end if;
  if new.contributions_close_at is distinct from old.contributions_close_at and old.contributions_close_at <= now() then
    raise exception 'contributions_already_closed' using errcode = 'P0001';
  end if;
  if new.reveal_at is distinct from old.reveal_at and old.reveal_at <= now() then
    raise exception 'already_revealed' using errcode = 'P0001';
  end if;
  -- Nouvelle règle : même règle qu'à la création, l'ouverture se fixe dans le futur.
  if new.reveal_at is distinct from old.reveal_at and new.reveal_at <= now() then
    raise exception 'reveal_in_past' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Export des données du compte
-- ---------------------------------------------------------------------------
-- Contenu : ce que la personne a fourni ou produit, et ses relations. Jamais les messages, mots, brouillons,
-- votes ou participations des autres. Personne fêtée avant l'ouverture : la cagnotte reste anonyme (pas de titre).
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'email_confirmed_at', u.email_confirmed_at, 'created_at', u.created_at, 'last_sign_in_at', to_jsonb(u) -> 'last_sign_in_at')
                from auth.users u where u.id = v_uid),
    'profile', (select jsonb_build_object('display_name', p.display_name, 'username', p.username, 'avatar_path', p.avatar_path, 'created_at', p.created_at)
                from public.profiles p where p.id = v_uid),
    'notification_prefs', (select to_jsonb(n) - 'user_id' from public.notification_prefs n where n.user_id = v_uid),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object(
        'event_id', m.event_id, 'role', m.role, 'status', m.status, 'joined_at', m.joined_at, 'capsule_opened_at', m.capsule_opened_at,
        'title', case when m.role <> 'beneficiary' or public.is_revealed(m.event_id) then e.title end,
        'reveal_at', e.reveal_at) order by m.joined_at)
      from public.event_members m join public.events e on e.id = m.event_id where m.user_id = v_uid), '[]'),
    'proposals', coalesce((select jsonb_agg(to_jsonb(p) - 'author_id' order by p.created_at) from public.proposals p where p.author_id = v_uid), '[]'),
    'proposal_comments', coalesce((select jsonb_agg(to_jsonb(c) - 'author_id' order by c.created_at) from public.proposal_comments c where c.author_id = v_uid), '[]'),
    'reactions', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id') from public.proposal_reactions r where r.user_id = v_uid), '[]'),
    'votes', coalesce((select jsonb_agg(to_jsonb(v) - 'user_id') from public.votes v where v.user_id = v_uid), '[]'),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) - 'author_id' - 'client_id' order by m.created_at) from public.messages m where m.author_id = v_uid), '[]'),
    'capsule_entries', coalesce((select jsonb_agg(to_jsonb(c) - 'author_id' order by c.created_at) from public.capsule_entries c where c.author_id = v_uid), '[]'),
    'thanks', coalesce((select jsonb_agg(to_jsonb(t) - 'author_id') from public.event_thanks t where t.author_id = v_uid), '[]'),
    'contributions', coalesce((select jsonb_agg(jsonb_build_object('event_id', c.event_id, 'amount_cents', c.amount_cents, 'status', c.status,
        'is_simulated', c.is_simulated, 'created_at', c.created_at, 'settled_at', c.settled_at) order by c.created_at)
      from public.contributions c where c.user_id = v_uid), '[]'),
    'badges', coalesce((select jsonb_agg(to_jsonb(b) - 'user_id') from public.user_badges b where b.user_id = v_uid), '[]'),
    'friends', coalesce((select jsonb_agg(jsonb_build_object('username', p.username, 'display_name', p.display_name, 'status', f.status,
        'requested_by_me', f.requested_by = v_uid, 'created_at', f.created_at))
      from public.friendships f join public.profiles p on p.id = case when f.user_low = v_uid then f.user_high else f.user_low end
      where v_uid in (f.user_low, f.user_high)), '[]'),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('username', p.username, 'created_at', b.created_at))
      from public.user_blocks b join public.profiles p on p.id = b.blocked_id where b.blocker_id = v_uid), '[]'),
    'invites_received', coalesce((select jsonb_agg(jsonb_build_object('event_id', i.event_id, 'role', i.role, 'source', i.source, 'status', i.status,
        'created_at', i.created_at, 'expires_at', i.expires_at) order by i.created_at)
      from public.event_invites i where i.invitee_id = v_uid), '[]'),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'event_id', n.event_id, 'created_at', n.created_at, 'read_at', n.read_at) order by n.created_at)
      from public.notifications n where n.user_id = v_uid), '[]')
  );
end $$;

-- ---------------------------------------------------------------------------
-- 3. Purge des données temporaires (planifiée chaque nuit)
-- ---------------------------------------------------------------------------
-- Règles proposées, à valider (docs/CONFIDENTIALITE.md) :
--  - invitation par e-mail expirée, utilisée ou annulée depuis plus de 30 jours : empreinte et indice d'adresse effacés ;
--  - file d'e-mails : envoyés ou en échec depuis plus de 30 jours, ou bloqués depuis plus de 7 jours : supprimés ;
--  - invitations dans l'app closes depuis plus de 180 jours : supprimées ;
--  - notifications lues depuis plus de 180 jours : supprimées ;
--  - contrôles de rappels de plus de 7 jours : supprimés.
create or replace function public.purge_stale_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a int; o int; o2 int; i int; n int; r int;
begin
  update public.invitations set email_hash = null, email_hint = null
  where kind = 'email' and (email_hash is not null or email_hint is not null)
    and (greatest(coalesce(revoked_at, '-infinity'), expires_at) < now() - interval '30 days'
         or (use_count >= coalesce(max_uses, 1) and created_at < now() - interval '30 days'));
  get diagnostics a = row_count;
  delete from public.email_outbox where status in ('sent', 'failed') and created_at < now() - interval '30 days';
  get diagnostics o = row_count;
  delete from public.email_outbox where status in ('pending', 'sending') and created_at < now() - interval '7 days';
  get diagnostics o2 = row_count;
  delete from public.event_invites where status <> 'pending' and coalesce(responded_at, created_at) < now() - interval '180 days';
  get diagnostics i = row_count;
  delete from public.notifications where read_at is not null and read_at < now() - interval '180 days';
  get diagnostics n = row_count;
  delete from public.reminder_checks where checked_at < now() - interval '7 days';
  get diagnostics r = row_count;
  return jsonb_build_object('invitations_anonymized', a, 'outbox_deleted', o + o2, 'event_invites_deleted', i, 'notifications_deleted', n, 'reminder_checks_deleted', r);
end $$;

revoke execute on function public.export_my_data(), public.purge_stale_data(), public.events_guard() from public, anon, authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.purge_stale_data() to service_role;

-- Planification (base Supabase avec pg_cron) ; sans pg_cron (tests locaux), rien n'est planifié.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'complice-purge';
    perform cron.schedule('complice-purge', '17 3 * * *', 'select public.purge_stale_data()');
  end if;
end $$;
