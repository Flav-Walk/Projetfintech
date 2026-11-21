-- Privilèges explicites sur les tables du schéma public.
--
-- Constat (projet distant, 2026-11-21) : sur les projets Supabase récents, une nouvelle table du schéma
-- public ne donne à anon / authenticated / service_role que TRUNCATE, REFERENCES, TRIGGER et MAINTAIN.
-- Les migrations 1 à 3 supposaient l'ancien comportement (tout accordé, puis retraits ciblés) :
-- à distance, aucun membre ne pouvait lire ni écrire (« permission denied for table events »).
--
-- Cette migration rend l'état indépendant des privilèges par défaut du projet : elle accorde
-- explicitement les droits puis réapplique exactement les retraits des migrations 1 à 3.
-- Les lignes restent filtrées par la RLS (active sur toutes les tables). Toute nouvelle table
-- devra recevoir ses propres GRANT dans sa migration.

-- 1. Aucun accès anonyme aux tables ; plus de TRUNCATE/REFERENCES/TRIGGER pour les clients.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
  end if;
end $$;

-- 2. Droits de base (filtrés par la RLS), puis le service (API Render, script de démo).
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

-- 3. Retraits identiques aux migrations 1 à 3 (REVOKE au niveau table retire aussi les droits par
--    colonne : les GRANT par colonne sont donc rejoués après).
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;
revoke update on public.events from authenticated;
grant update (title, beneficiary_name, occasion, description, cover_path, target_cents, gift_at,
  votes_close_at, contributions_close_at, reveal_at, timezone, vote_visibility) on public.events to authenticated;
revoke insert, delete on public.events, public.event_members, public.invitations, public.invitation_acceptances,
  public.activity, public.notifications, public.profiles, public.notification_prefs from authenticated;
revoke update on public.event_members, public.invitations, public.invitation_acceptances, public.activity, public.notifications from authenticated;

revoke insert, update, delete on public.votes, public.contributions from authenticated;
revoke update on public.proposals from authenticated;
grant update (title, price_cents, product_url, description, image_path, status) on public.proposals to authenticated;
revoke delete on public.proposals from authenticated;
revoke update on public.proposal_comments from authenticated;

revoke insert, update, delete on public.user_badges from authenticated;
revoke update on public.tasks from authenticated;
grant update (title, due_at, position) on public.tasks to authenticated;
revoke update, delete on public.messages from authenticated;
revoke update on public.capsule_entries from authenticated;
grant update (body, photo_path, status) on public.capsule_entries to authenticated;
