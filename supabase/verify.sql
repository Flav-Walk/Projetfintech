-- COMPLICE : contrôle après application des migrations (SQL Editor, lecture seule).
-- Chaque ligne doit afficher ok = true.
select 'migrations enregistrées' as controle,
       (select count(*) from supabase_migrations.schema_migrations where version like '2026%')::text as valeur,
       (select count(*) from supabase_migrations.schema_migrations where version like '2026%') >= 12 as ok
union all
select 'tables COMPLICE présentes',
       count(*)::text,
       count(*) = 17
  from pg_tables where schemaname = 'public' and tablename in (
    'profiles','notification_prefs','events','event_members','activity','notifications','invitations',
    'invitation_acceptances','proposals','votes','proposal_reactions','proposal_comments','contributions',
    'user_badges','tasks','messages','capsule_entries')
union all
select 'RLS active sur toutes les tables public',
       coalesce(string_agg(tablename, ', ') filter (where not rowsecurity), 'aucune exception'),
       bool_and(rowsecurity)
  from pg_tables where schemaname = 'public'
union all
select 'trigger profil sur auth.users',
       count(*)::text, count(*) = 1
  from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'
union all
select 'buckets privés',
       coalesce(string_agg(id || case when public then ' (PUBLIC!)' else '' end, ', '), 'aucun'),
       count(*) = 2 and not bool_or(public)
  from storage.buckets where id in ('avatars','event-media')
union all
select 'politiques storage.objects',
       count(*)::text, count(*) >= 4
  from pg_policies where schemaname = 'storage' and tablename = 'objects'
union all
select 'tables publiées en Realtime',
       string_agg(tablename, ', ' order by tablename),
       count(*) >= 7
  from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
union all
select 'règlement de contribution fermé aux clients',
       case when has_function_privilege('authenticated', 'public.contribution_settle(uuid, boolean, text, text)', 'execute')
            then 'OUVERT (anomalie)' else 'fermé' end,
       not has_function_privilege('authenticated', 'public.contribution_settle(uuid, boolean, text, text)', 'execute')
union all
select 'privilèges de tables (migration 7)',
       case when has_table_privilege('authenticated', 'public.events', 'select')
             and has_any_column_privilege('authenticated', 'public.proposals', 'insert')
             and not has_table_privilege('authenticated', 'public.tasks', 'insert')
             and not has_column_privilege('authenticated', 'public.messages', 'created_at', 'insert')
             and has_table_privilege('service_role', 'public.events', 'update')
             and not has_table_privilege('authenticated', 'public.events', 'truncate')
             and not has_table_privilege('anon', 'public.events', 'select')
            then 'conformes' else 'ANOMALIE : appliquer 20261121000700_table_privileges' end,
       has_table_privilege('authenticated', 'public.events', 'select')
         and has_any_column_privilege('authenticated', 'public.proposals', 'insert')
         and not has_table_privilege('authenticated', 'public.tasks', 'insert')
         and not has_column_privilege('authenticated', 'public.messages', 'created_at', 'insert')
         and has_table_privilege('service_role', 'public.events', 'update')
         and not has_table_privilege('authenticated', 'public.events', 'truncate')
         and not has_table_privilege('anon', 'public.events', 'select')
union all
select 'montants hors de events, illisibles par les clients (migration 8)',
       case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name like '%cents')
             and not has_any_column_privilege('authenticated', 'public.event_finances', 'select')
             and not has_function_privilege('authenticated', 'public.event_contributors(uuid)', 'execute')
            then 'conformes' else 'ANOMALIE : appliquer 20261121000800_privacy_hardening' end,
       not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name like '%cents')
         and not has_any_column_privilege('authenticated', 'public.event_finances', 'select')
         and not has_function_privilege('authenticated', 'public.event_contributors(uuid)', 'execute')
union all
select 'aucune annonce nominative de contribution (migrations 8 et 9)',
       (select count(*) from public.activity where (kind = 'contribution_confirmed' and actor_id is not null)
          or (kind = 'badge_awarded' and data->>'badge' = 'contributor'))::text,
       not exists (select 1 from public.activity where (kind = 'contribution_confirmed' and actor_id is not null)
          or (kind = 'badge_awarded' and data->>'badge' = 'contributor'))
union all
select 'e-mails et remerciements (migration 10)',
       case when to_regclass('public.email_outbox') is not null and to_regclass('public.event_thanks') is not null
             and not has_any_column_privilege('authenticated', 'public.email_outbox', 'select')
             and has_function_privilege('authenticated', 'public.prepare_email_invitation(uuid, public.member_role, text)', 'execute')
             and not has_function_privilege('authenticated', 'public.claim_email_batch(integer)', 'execute')
            then 'conformes' else 'ANOMALIE : appliquer 20261121001000_emails_thanks_templates' end,
       to_regclass('public.email_outbox') is not null and to_regclass('public.event_thanks') is not null
         and not has_any_column_privilege('authenticated', 'public.email_outbox', 'select')
         and has_function_privilege('authenticated', 'public.prepare_email_invitation(uuid, public.member_role, text)', 'execute')
         and not has_function_privilege('authenticated', 'public.claim_email_batch(integer)', 'execute')
union all
select 'amis, invitations nominatives et total (migration 11)',
       case when to_regclass('public.friendships') is not null and to_regclass('public.event_invites') is not null
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'username')
             and not has_table_privilege('authenticated', 'public.friendships', 'insert')
             and has_function_privilege('authenticated', 'public.search_profiles(text)', 'execute')
             and not has_function_privilege('anon', 'public.search_profiles(text)', 'execute')
            then 'conformes' else 'ANOMALIE : appliquer 20261122001100_friends_invites_funding' end,
       to_regclass('public.friendships') is not null and to_regclass('public.event_invites') is not null
         and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'username')
         and not has_table_privilege('authenticated', 'public.friendships', 'insert')
         and has_function_privilege('authenticated', 'public.search_profiles(text)', 'execute')
         and not has_function_privilege('anon', 'public.search_profiles(text)', 'execute')
union all
select 'couverture illustrée (migration 12)',
       case when has_column_privilege('authenticated', 'public.events', 'cover_art', 'update') then 'conforme'
            else 'ANOMALIE : appliquer 20261123001200_cover_art' end,
       coalesce(has_column_privilege('authenticated', 'public.events', 'cover_art', 'update'), false)
union all
select 'aperçu d''invitation ouvert aux visiteurs',
       case when has_function_privilege('anon', 'public.preview_invitation(text)', 'execute') then 'ouvert' else 'fermé' end,
       has_function_privilege('anon', 'public.preview_invitation(text)', 'execute');

-- Planification des rappels (pg_cron). Si cette requête échoue avec « relation cron.job does not exist »,
-- activer l'extension pg_cron (Database > Extensions) puis exécuter :
--   select cron.schedule('complice-reminders', '*/10 * * * *', 'select public.run_due_reminders()');
select jobname, schedule, command, active from cron.job where jobname = 'complice-reminders';