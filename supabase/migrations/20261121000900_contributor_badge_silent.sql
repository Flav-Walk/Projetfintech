-- Le timbre « Complice » (contribution) ne s'annonce plus dans le fil d'activité.
--
-- Constat du parcours distant du 2026-11-21 : award_badge écrivait une activité `badge_awarded`
-- nominative au même instant que l'annonce anonyme `contribution_confirmed`, ce qui révélait qui
-- venait de participer (décision produit : aucune annonce nominative de contribution).
-- Les autres timbres restent annoncés.

create or replace function public.award_badge(p_event uuid, p_user uuid, p_badge public.badge_kind)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_rows integer;
begin
  if p_user is null then return false; end if;
  insert into public.user_badges (event_id, user_id, badge) values (p_event, p_user, p_badge) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 and p_badge <> 'contributor' then
    insert into public.activity (event_id, actor_id, kind, data) values (p_event, p_user, 'badge_awarded', jsonb_build_object('badge', p_badge));
  end if;
  return v_rows > 0;
end $$;

-- Historique : les annonces déjà publiées du timbre « Complice » sont retirées.
delete from public.activity where kind = 'badge_awarded' and data->>'badge' = 'contributor';
