-- Confidentialité des montants et durcissement issu de la revue du 2026-11-21 (docs/SECURITE-SUPABASE.md).
--
-- Décisions produit :
--   - les montants individuels restent privés : plus d'annonce nominative de contribution ;
--   - les membres voient une progression collective par paliers (0, 25, 50, 75, 100 %) et leur propre
--     montant ; le total exact n'est donné qu'aux gestionnaires, une fois la collecte close (achat) ;
--   - le bénéficiaire ne voit aucune donnée financière (ni objectif, ni total, ni prix du cadeau).
-- Les paliers réduisent la précision de ce qu'on peut déduire ; ils ne garantissent pas qu'aucune
-- déduction ne soit possible (par exemple dans un groupe de deux personnes).

-- ---------------------------------------------------------------------------
-- 1. Montants hors de la table events
--    events est lue par tous les membres (bénéficiaire compris après l'ouverture) et diffusée en temps
--    réel : elle ne doit plus contenir de montant. Les montants vont dans une table sans accès client.
-- ---------------------------------------------------------------------------
create table public.event_finances (
  event_id uuid primary key references public.events (id) on delete cascade,
  target_cents integer not null check (target_cents between 100 and 10000000),
  collected_cents integer not null default 0 check (collected_cents >= 0),
  updated_at timestamptz not null default now()
);
alter table public.event_finances enable row level security;
-- Aucune politique et aucun droit client : lecture par event_funding / my_events_funding seulement.
revoke all on public.event_finances from anon, authenticated;
grant select, insert, update, delete on public.event_finances to service_role;

insert into public.event_finances (event_id, target_cents, collected_cents)
select id, target_cents, collected_cents from public.events;

-- Garde-fou des réglages, sans la colonne collected_cents.
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
  -- Une échéance déjà passée ne peut plus être déplacée (évite de rouvrir un vote clos en douce).
  if new.votes_close_at is distinct from old.votes_close_at and old.votes_close_at <= now() then
    raise exception 'votes_already_closed' using errcode = 'P0001';
  end if;
  if new.contributions_close_at is distinct from old.contributions_close_at and old.contributions_close_at <= now() then
    raise exception 'contributions_already_closed' using errcode = 'P0001';
  end if;
  if new.reveal_at is distinct from old.reveal_at and old.reveal_at <= now() then
    raise exception 'already_revealed' using errcode = 'P0001';
  end if;
  return new;
end $$;

alter table public.events drop column target_cents, drop column collected_cents;

-- Total recalculé depuis les seules contributions confirmées, dans la table privée.
create or replace function public.contributions_recount()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.event_finances set collected_cents = (
    select coalesce(sum(amount_cents), 0) from public.contributions
    where event_id = coalesce(new.event_id, old.event_id) and status = 'confirmed'
  ), updated_at = now()
  where event_id = coalesce(new.event_id, old.event_id);
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Création d'événement : objectif dans event_finances, quota anti-abus
-- ---------------------------------------------------------------------------
create or replace function public.create_event(
  p_title text,
  p_beneficiary_name text,
  p_occasion text,
  p_description text,
  p_target_cents integer,
  p_gift_at timestamptz,
  p_votes_close_at timestamptz,
  p_contributions_close_at timestamptz,
  p_reveal_at timestamptz,
  p_timezone text default 'Europe/Paris',
  p_cover_path text default null,
  p_vote_visibility public.vote_visibility default 'private'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if (select count(*) from public.events where created_by = v_uid and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if p_reveal_at <= now() then raise exception 'reveal_in_past' using errcode = 'P0001'; end if;
  if p_cover_path is not null and p_cover_path not like v_uid::text || '/covers/%' then
    raise exception 'invalid_cover_path' using errcode = 'P0001';
  end if;
  insert into public.events (title, beneficiary_name, occasion, description, gift_at,
    votes_close_at, contributions_close_at, reveal_at, timezone, cover_path, vote_visibility, created_by)
  values (trim(p_title), trim(p_beneficiary_name), coalesce(nullif(trim(p_occasion), ''), 'anniversaire'),
    nullif(trim(p_description), ''), p_gift_at, p_votes_close_at, p_contributions_close_at,
    p_reveal_at, coalesce(p_timezone, 'Europe/Paris'), p_cover_path, coalesce(p_vote_visibility, 'private'), v_uid)
  returning id into v_id;
  insert into public.event_finances (event_id, target_cents) values (v_id, p_target_cents);
  insert into public.event_members (event_id, user_id, role) values (v_id, v_uid, 'organizer');
  insert into public.activity (event_id, actor_id, kind) values (v_id, v_uid, 'event_created');
  return v_id;
end $$;

-- Objectif modifiable par un gestionnaire tant que l'événement est actif et la collecte ouverte.
create or replace function public.set_event_target(p_event uuid, p_target_cents integer)
returns void language plpgsql security definer set search_path = '' as $$
declare ev public.events;
begin
  if not public.is_manager(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into ev from public.events where id = p_event;
  if ev.status <> 'active' then raise exception 'event_locked' using errcode = 'P0001'; end if;
  if now() >= ev.contributions_close_at then raise exception 'contributions_already_closed' using errcode = 'P0001'; end if;
  if p_target_cents is null or p_target_cents not between 100 and 10000000 then
    raise exception 'invalid_target_amount' using errcode = 'P0001';
  end if;
  update public.event_finances set target_cents = p_target_cents, updated_at = now() where event_id = p_event;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Cagnotte : paliers collectifs, montant personnel, total exact limité
-- ---------------------------------------------------------------------------
create or replace function public.funding_step(p_collected integer, p_target integer)
returns integer language sql immutable set search_path = '' as $$
  select case when p_target is null or p_target <= 0 then 0
              else least(100, (floor(p_collected::numeric * 100 / p_target / 25) * 25)::int) end
$$;

drop function public.event_funding(uuid);
create function public.event_funding(p_event uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_preparer(p_event) then jsonb_build_object(
    'target_cents', f.target_cents,
    'progress_step', public.funding_step(f.collected_cents, f.target_cents),
    'goal_reached', f.collected_cents >= f.target_cents,
    'contributions_open', e.status = 'active' and now() < e.contributions_close_at,
    'my_confirmed_cents', (select coalesce(sum(amount_cents), 0) from public.contributions
                           where event_id = p_event and status = 'confirmed' and user_id = auth.uid()),
    -- Total exact : gestionnaires seulement, collecte close (pour l'achat du cadeau).
    'collected_cents', case when public.is_manager(p_event) and (e.status <> 'active' or now() >= e.contributions_close_at)
                            then f.collected_cents end
  ) end
  from public.events e join public.event_finances f on f.event_id = e.id
  where e.id = p_event
$$;

-- Liste « Mes événements » : un palier par événement préparé, jamais de montant.
create or replace function public.my_events_funding()
returns table (event_id uuid, progress_step integer, goal_reached boolean)
language sql stable security definer set search_path = '' as $$
  select f.event_id, public.funding_step(f.collected_cents, f.target_cents), f.collected_cents >= f.target_cents
  from public.event_finances f
  join public.event_members m on m.event_id = f.event_id
  where m.user_id = auth.uid() and m.status = 'active' and m.role <> 'beneficiary'
$$;

-- ---------------------------------------------------------------------------
-- 4. Contributions : plus d'annonce nominative, quota de demandes en attente
-- ---------------------------------------------------------------------------
create or replace function public.contribution_create(p_event uuid, p_amount_cents integer, p_idempotency_key text)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions; ev public.events;
begin
  if not public.is_preparer(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.contributions where user_id = auth.uid() and idempotency_key = p_idempotency_key;
  if c.id is not null then
    if c.event_id <> p_event or c.amount_cents <> p_amount_cents then raise exception 'idempotency_conflict' using errcode = 'P0001'; end if;
    return c;
  end if;
  select * into ev from public.events where id = p_event;
  if ev.status <> 'active' or now() >= ev.contributions_close_at then raise exception 'contributions_closed' using errcode = 'P0001'; end if;
  if p_amount_cents is null or p_amount_cents not between 100 and 100000 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
  -- Le parcours normal (API) règle chaque demande aussitôt : 5 demandes en attente en une heure = abus.
  if (select count(*) from public.contributions where user_id = auth.uid() and status = 'pending'
      and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many_pending' using errcode = 'P0001';
  end if;
  insert into public.contributions (event_id, user_id, amount_cents, fee_cents, idempotency_key)
  values (p_event, auth.uid(), p_amount_cents, 0, p_idempotency_key)
  on conflict (user_id, idempotency_key) do nothing
  returning * into c;
  if c.id is null then
    select * into c from public.contributions where user_id = auth.uid() and idempotency_key = p_idempotency_key;
  end if;
  return c;
end $$;

create or replace function public.contribution_settle(p_contribution uuid, p_success boolean, p_provider_ref text, p_failure_reason text default null)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions;
begin
  select * into c from public.contributions where id = p_contribution for update;
  if c.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if c.status <> 'pending' then return c; end if;
  update public.contributions set
    status = case when p_success then 'confirmed'::public.contribution_status else 'failed'::public.contribution_status end,
    provider_ref = p_provider_ref, failure_reason = case when p_success then null else left(p_failure_reason, 200) end,
    settled_at = now()
  where id = c.id returning * into c;
  if p_success then
    -- Annonce anonyme : le fil indique une nouvelle participation, jamais qui ni combien.
    insert into public.activity (event_id, actor_id, kind) values (c.event_id, null, 'contribution_confirmed');
    perform public.award_badge(c.event_id, c.user_id, 'contributor');
  end if;
  return c;
end $$;

-- Historique : les annonces déjà publiées deviennent anonymes.
update public.activity set actor_id = null where kind = 'contribution_confirmed';

-- La liste nominative des contributeurs n'est plus exposée aux clients (fonction conservée pour le serveur).
revoke execute on function public.event_contributors(uuid) from authenticated;
grant execute on function public.event_contributors(uuid) to service_role;

-- Le timbre « Complice » (contribution) n'est visible que de son titulaire.
drop policy badges_select on public.user_badges;
create policy badges_select on public.user_badges for select to authenticated
  using (user_id = auth.uid() or (public.is_preparer(event_id) and badge <> 'contributor'));

-- ---------------------------------------------------------------------------
-- 5. Bénéficiaire : le cadeau retenu sans prix ni lien
-- ---------------------------------------------------------------------------
drop policy proposals_select on public.proposals;
create policy proposals_select on public.proposals for select to authenticated
  using (public.is_preparer(event_id));

create or replace function public.revealed_gift(p_event uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.can_view_event(p_event) and p.id is not null then
    jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description, 'image_path', p.image_path) end
  from public.events e left join public.proposals p on p.id = e.selected_proposal_id
  where e.id = p_event
$$;

-- ---------------------------------------------------------------------------
-- 6. Invitations : un lien inutilisable ne révèle rien
-- ---------------------------------------------------------------------------
create or replace function public.preview_invitation(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare inv public.invitations; ev public.events; v_status text; v_org text; v_members integer; v_member public.event_members;
begin
  select * into inv from public.invitations where token_hash = public.hash_token(coalesce(p_token, ''));
  if inv.id is null then return jsonb_build_object('status', 'invalid'); end if;
  select * into ev from public.events where id = inv.event_id;
  select * into v_member from public.event_members where event_id = inv.event_id and user_id = auth.uid();
  v_status := case
    when inv.revoked_at is not null then 'revoked'
    when ev.status in ('cancelled', 'archived') then 'event_closed'
    when v_member.status = 'active' then 'already_member'
    when v_member.status = 'removed' then 'removed'
    when inv.expires_at <= now() then 'expired'
    when inv.max_uses is not null and inv.use_count >= inv.max_uses then 'exhausted'
    else 'valid' end;
  -- Révoqué, expiré, épuisé, fermé, retiré : le statut seul.
  if v_status not in ('valid', 'already_member') then
    return jsonb_build_object('status', v_status);
  end if;
  select p.display_name into v_org from public.event_members m join public.profiles p on p.id = m.user_id
    where m.event_id = ev.id and m.role = 'organizer' and m.status = 'active';
  select count(*) into v_members from public.event_members where event_id = ev.id and status = 'active' and role <> 'beneficiary';
  return jsonb_build_object(
    'status', v_status,
    -- L'identifiant de l'événement n'est jamais donné à un visiteur non connecté.
    'event_id', case when auth.uid() is not null then ev.id end,
    'title', ev.title, 'beneficiary_name', ev.beneficiary_name,
    'occasion', ev.occasion, 'gift_at', ev.gift_at, 'timezone', ev.timezone, 'organizer_name', v_org,
    'member_count', v_members, 'role', inv.role, 'expires_at', inv.expires_at);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Fonctions d'aide appelables par l'API : aucune réponse pour un non-membre
--    (auth.uid() nul = tâche planifiée ou service : réponse normale)
-- ---------------------------------------------------------------------------
create or replace function public.is_revealed(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select e.status in ('revealed', 'archived') or now() >= e.reveal_at
                   from public.events e
                   where e.id = p_event
                     and (auth.uid() is null or exists (
                       select 1 from public.event_members m where m.event_id = e.id and m.user_id = auth.uid()))), false)
$$;

create or replace function public.proposal_event(p_proposal uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select p.event_id from public.proposals p
  where p.id = p_proposal
    and (auth.uid() is null or exists (
      select 1 from public.event_members m where m.event_id = p.event_id and m.user_id = auth.uid() and m.status = 'active'))
$$;

-- ---------------------------------------------------------------------------
-- 8. Rappels déclenchés par l'app : au plus une fois par minute et par personne
-- ---------------------------------------------------------------------------
create table public.reminder_checks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  checked_at timestamptz not null default now()
);
alter table public.reminder_checks enable row level security;
revoke all on public.reminder_checks from anon, authenticated;
grant select, insert, update, delete on public.reminder_checks to service_role;

drop function public.refresh_reminders();
create function public.refresh_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return 0; end if;
  if exists (select 1 from public.reminder_checks where user_id = v_uid and checked_at > now() - interval '1 minute') then
    return 0;
  end if;
  insert into public.reminder_checks (user_id, checked_at) values (v_uid, now())
  on conflict (user_id) do update set checked_at = excluded.checked_at;
  return public.run_due_reminders(v_uid);
end $$;

-- ---------------------------------------------------------------------------
-- 9. Performance : auth.uid() évalué une fois par requête dans les politiques, index des clés étrangères
-- ---------------------------------------------------------------------------
do $$
declare r record; v_using text; v_check text; v_sql text;
begin
  for r in
    select tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
      and coalesce(qual, '') not like '%SELECT auth.uid()%' and coalesce(with_check, '') not like '%SELECT auth.uid()%'
  loop
    v_using := replace(r.qual, 'auth.uid()', '(select auth.uid())');
    v_check := replace(r.with_check, 'auth.uid()', '(select auth.uid())');
    v_sql := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if v_using is not null then v_sql := v_sql || ' using (' || v_using || ')'; end if;
    if v_check is not null then v_sql := v_sql || ' with check (' || v_check || ')'; end if;
    execute v_sql;
  end loop;
end $$;

create index if not exists activity_actor_idx on public.activity (actor_id);
create index if not exists capsule_entries_author_idx on public.capsule_entries (author_id);
create index if not exists events_beneficiary_user_idx on public.events (beneficiary_user_id);
create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists events_selected_proposal_idx on public.events (selected_proposal_id);
create index if not exists invitation_acceptances_user_idx on public.invitation_acceptances (user_id);
create index if not exists invitations_created_by_idx on public.invitations (created_by);
create index if not exists notifications_event_idx on public.notifications (event_id);
create index if not exists proposal_comments_author_idx on public.proposal_comments (author_id);
create index if not exists proposal_reactions_user_idx on public.proposal_reactions (user_id);
create index if not exists proposals_author_idx on public.proposals (author_id);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_created_by_idx on public.tasks (created_by);
create index if not exists user_badges_user_idx on public.user_badges (user_id);
create index if not exists votes_user_idx on public.votes (user_id);

-- ---------------------------------------------------------------------------
-- 10. Droits des fonctions (fermées par défaut depuis 20261120000500)
-- ---------------------------------------------------------------------------
revoke execute on function public.event_funding(uuid), public.my_events_funding(), public.set_event_target(uuid, integer),
  public.revealed_gift(uuid), public.refresh_reminders(), public.funding_step(integer, integer) from public, anon;
grant execute on function public.event_funding(uuid), public.my_events_funding(), public.set_event_target(uuid, integer),
  public.revealed_gift(uuid), public.refresh_reminders() to authenticated;
revoke execute on function public.funding_step(integer, integer) from authenticated;
