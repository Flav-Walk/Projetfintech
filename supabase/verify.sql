-- COMPLICE : contrôle après application des migrations (SQL Editor, lecture seule).
-- Chaque ligne doit afficher ok = true.
select 'migrations enregistrées' as controle,
       (select count(*) from supabase_migrations.schema_migrations where version like '2026%')::text as valeur,
       (select count(*) from supabase_migrations.schema_migrations where version like '2026%') >= 7 as ok
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
select 'aperçu d''invitation ouvert aux visiteurs',
       case when has_function_privilege('anon', 'public.preview_invitation(text)', 'execute') then 'ouvert' else 'fermé' end,
       has_function_privilege('anon', 'public.preview_invitation(text)', 'execute');

-- Planification des rappels (pg_cron). Si cette requête échoue avec « relation cron.job does not exist »,
-- activer l'extension pg_cron (Database > Extensions) puis exécuter :
--   select cron.schedule('complice-reminders', '*/10 * * * *', 'select public.run_due_reminders()');
select jobname, schedule, command, active from cron.job where jobname = 'complice-reminders';