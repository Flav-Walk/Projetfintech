-- COMPLICE — socle : profils, événements, membres, invitations, activité, notifications.
-- Règle : toute écriture sensible passe par une fonction SECURITY DEFINER atomique.
-- Les tables restent protégées par RLS ; aucune politique ne fait confiance à l'interface.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('organizer', 'co_organizer', 'participant', 'beneficiary');
create type public.member_status as enum ('active', 'left', 'removed');
create type public.event_status as enum ('active', 'revealed', 'archived', 'cancelled');
create type public.vote_visibility as enum ('private', 'public');

-- ---------------------------------------------------------------------------
-- Profils (1-1 avec auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  invitations boolean not null default true,
  votes boolean not null default true,
  tasks boolean not null default true,
  capsule boolean not null default true,
  messages boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Complice'), 40)
  );
  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Événements
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 80),
  beneficiary_name text not null check (char_length(trim(beneficiary_name)) between 1 and 60),
  beneficiary_user_id uuid references public.profiles (id) on delete set null,
  occasion text not null default 'anniversaire' check (char_length(occasion) between 1 and 40),
  description text check (description is null or char_length(description) <= 600),
  cover_path text check (cover_path is null or char_length(cover_path) <= 300),
  target_cents integer not null check (target_cents between 100 and 10000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  collected_cents integer not null default 0 check (collected_cents >= 0),
  gift_at timestamptz not null,
  votes_close_at timestamptz not null,
  contributions_close_at timestamptz not null,
  reveal_at timestamptz not null,
  timezone text not null default 'Europe/Paris' check (char_length(timezone) <= 64),
  vote_visibility public.vote_visibility not null default 'private',
  status public.event_status not null default 'active',
  selected_proposal_id uuid,
  gift_confirmed_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_dates_order check (
    votes_close_at <= reveal_at and contributions_close_at <= reveal_at
  )
);

create table public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  status public.member_status not null default 'active',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_members_user_idx on public.event_members (user_id) where status = 'active';
-- Un seul organisateur actif par événement.
create unique index event_members_one_organizer on public.event_members (event_id)
  where role = 'organizer' and status = 'active';

-- ---------------------------------------------------------------------------
-- Fonctions d'autorisation (SECURITY DEFINER pour éviter la récursion RLS)
-- ---------------------------------------------------------------------------
create or replace function public.my_role(p_event uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select m.role from public.event_members m
  where m.event_id = p_event and m.user_id = auth.uid() and m.status = 'active'
$$;

-- Membres qui préparent : tout sauf le bénéficiaire.
create or replace function public.is_preparer(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role(p_event) in ('organizer', 'co_organizer', 'participant'), false)
$$;

create or replace function public.is_manager(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role(p_event) in ('organizer', 'co_organizer'), false)
$$;

create or replace function public.is_revealed(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select e.status in ('revealed', 'archived') or now() >= e.reveal_at
                   from public.events e where e.id = p_event), false)
$$;

-- Le bénéficiaire ne voit l'événement qu'à partir du dévoilement.
create or replace function public.can_view_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_preparer(p_event)
      or (public.my_role(p_event) = 'beneficiary' and public.is_revealed(p_event))
$$;

create or replace function public.shares_event_with(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_members a
    join public.event_members b on b.event_id = a.event_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = p_user and b.status = 'active'
  )
$$;

-- ---------------------------------------------------------------------------
-- Garde-fous sur la modification directe d'un événement (via RLS par un gestionnaire)
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
     or new.collected_cents is distinct from old.collected_cents
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

create trigger events_guard before update on public.events
  for each row execute function public.events_guard();

-- ---------------------------------------------------------------------------
-- Activité et notifications in-app
-- ---------------------------------------------------------------------------
create table public.activity (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_event_idx on public.activity (event_id, created_at desc);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  kind text not null check (kind in ('invitation', 'vote_closing', 'task_assigned', 'capsule_open', 'gift_selected', 'member_joined', 'message')),
  data jsonb not null default '{}',
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.log_activity(p_event uuid, p_kind text, p_data jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.activity (event_id, actor_id, kind, data) values (p_event, auth.uid(), p_kind, coalesce(p_data, '{}'))
$$;

-- Notification idempotente (dedupe_key) et soumise aux préférences.
create or replace function public.notify(p_user uuid, p_event uuid, p_kind text, p_data jsonb, p_dedupe text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_allowed boolean;
begin
  select case
    when p_kind = 'invitation' then p.invitations
    when p_kind in ('vote_closing', 'gift_selected') then p.votes
    when p_kind = 'task_assigned' then p.tasks
    when p_kind = 'capsule_open' then p.capsule
    when p_kind = 'message' then p.messages
    else true end
  into v_allowed
  from public.notification_prefs p where p.user_id = p_user;
  if coalesce(v_allowed, true) then
    insert into public.notifications (user_id, event_id, kind, data, dedupe_key)
    values (p_user, p_event, p_kind, coalesce(p_data, '{}'), p_dedupe)
    on conflict (user_id, dedupe_key) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Invitations (jeton secret, seul le hash est stocké)
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  token_hash text not null unique,
  role public.member_role not null default 'participant' check (role <> 'organizer'),
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  max_uses integer check (max_uses is null or max_uses between 1 and 200),
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index invitations_event_idx on public.invitations (event_id);

create table public.invitation_acceptances (
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (invitation_id, user_id)
);

create or replace function public.hash_token(p_token text)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

-- ---------------------------------------------------------------------------
-- RPC : événements
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
  if p_reveal_at <= now() then raise exception 'reveal_in_past' using errcode = 'P0001'; end if;
  if p_cover_path is not null and p_cover_path not like v_uid::text || '/covers/%' then
    raise exception 'invalid_cover_path' using errcode = 'P0001';
  end if;
  insert into public.events (title, beneficiary_name, occasion, description, target_cents, gift_at,
    votes_close_at, contributions_close_at, reveal_at, timezone, cover_path, vote_visibility, created_by)
  values (trim(p_title), trim(p_beneficiary_name), coalesce(nullif(trim(p_occasion), ''), 'anniversaire'),
    nullif(trim(p_description), ''), p_target_cents, p_gift_at, p_votes_close_at, p_contributions_close_at,
    p_reveal_at, coalesce(p_timezone, 'Europe/Paris'), p_cover_path, coalesce(p_vote_visibility, 'private'), v_uid)
  returning id into v_id;
  insert into public.event_members (event_id, user_id, role) values (v_id, v_uid, 'organizer');
  insert into public.activity (event_id, actor_id, kind) values (v_id, v_uid, 'event_created');
  return v_id;
end $$;

create or replace function public.create_invitation(
  p_event uuid,
  p_role public.member_role default 'participant',
  p_expires_in_hours integer default 168,
  p_max_uses integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text; v_id uuid; v_expires timestamptz;
begin
  if not public.is_manager(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role = 'organizer' then raise exception 'invalid_role' using errcode = 'P0001'; end if;
  if p_role = 'co_organizer' and public.my_role(p_event) <> 'organizer' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select status from public.events where id = p_event) <> 'active' then
    raise exception 'event_locked' using errcode = 'P0001';
  end if;
  if p_expires_in_hours is null or p_expires_in_hours not between 1 and 720 then
    raise exception 'invalid_expiry' using errcode = 'P0001';
  end if;
  -- 2 UUID v4 = 244 bits aléatoires. Seul le hash est conservé.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + make_interval(hours => p_expires_in_hours);
  insert into public.invitations (event_id, token_hash, role, created_by, expires_at, max_uses)
  values (p_event, public.hash_token(v_token), p_role, auth.uid(), v_expires, p_max_uses)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', v_expires, 'role', p_role);
end $$;

create or replace function public.revoke_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_event uuid;
begin
  select event_id into v_event from public.invitations where id = p_invitation;
  if v_event is null or not public.is_manager(v_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.invitations set revoked_at = coalesce(revoked_at, now()) where id = p_invitation;
end $$;

-- Statut d'une invitation sans la consommer. Accessible sans compte (écran d'accueil du lien).
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
  if v_status in ('revoked', 'event_closed', 'removed') then
    return jsonb_build_object('status', v_status);
  end if;
  select p.display_name into v_org from public.event_members m join public.profiles p on p.id = m.user_id
    where m.event_id = ev.id and m.role = 'organizer' and m.status = 'active';
  select count(*) into v_members from public.event_members where event_id = ev.id and status = 'active' and role <> 'beneficiary';
  return jsonb_build_object(
    'status', v_status, 'event_id', ev.id, 'title', ev.title, 'beneficiary_name', ev.beneficiary_name,
    'occasion', ev.occasion, 'gift_at', ev.gift_at, 'timezone', ev.timezone, 'organizer_name', v_org,
    'member_count', v_members, 'role', inv.role, 'expires_at', inv.expires_at);
end $$;

-- Acceptation atomique : verrou sur l'invitation, adhésion unique (clé primaire), compteur d'usage.
create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare inv public.invitations; ev public.events; v_uid uuid := auth.uid(); v_member public.event_members;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into inv from public.invitations where token_hash = public.hash_token(coalesce(p_token, '')) for update;
  if inv.id is null then return jsonb_build_object('status', 'invalid'); end if;
  if inv.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  select * into ev from public.events where id = inv.event_id for update;
  if ev.status in ('cancelled', 'archived') then return jsonb_build_object('status', 'event_closed'); end if;
  select * into v_member from public.event_members where event_id = inv.event_id and user_id = v_uid;
  if v_member.status = 'active' then return jsonb_build_object('status', 'already_member', 'event_id', inv.event_id); end if;
  if v_member.status = 'removed' then return jsonb_build_object('status', 'removed'); end if;
  if inv.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if inv.max_uses is not null and inv.use_count >= inv.max_uses then return jsonb_build_object('status', 'exhausted'); end if;
  if inv.role = 'beneficiary' and ev.beneficiary_user_id is not null then
    return jsonb_build_object('status', 'beneficiary_taken');
  end if;

  insert into public.event_members (event_id, user_id, role, status, joined_at)
  values (inv.event_id, v_uid, inv.role, 'active', now())
  on conflict (event_id, user_id) do update set role = excluded.role, status = 'active', joined_at = now(), updated_at = now();
  update public.invitations set use_count = use_count + 1 where id = inv.id;
  insert into public.invitation_acceptances (invitation_id, user_id) values (inv.id, v_uid) on conflict do nothing;
  if inv.role = 'beneficiary' then
    update public.events set beneficiary_user_id = v_uid where id = inv.event_id;
  else
    insert into public.activity (event_id, actor_id, kind) values (inv.event_id, v_uid, 'member_joined');
  end if;
  return jsonb_build_object('status', 'joined', 'event_id', inv.event_id, 'role', inv.role);
end $$;

-- ---------------------------------------------------------------------------
-- RPC : gestion des membres
-- ---------------------------------------------------------------------------
create or replace function public.set_member_role(p_event uuid, p_user uuid, p_role public.member_role)
returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.event_members;
begin
  if public.my_role(p_event) is distinct from 'organizer' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('co_organizer', 'participant') then raise exception 'invalid_role' using errcode = 'P0001'; end if;
  select * into v_target from public.event_members where event_id = p_event and user_id = p_user and status = 'active' for update;
  if v_target.user_id is null or v_target.role not in ('co_organizer', 'participant') then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  update public.event_members set role = p_role, updated_at = now() where event_id = p_event and user_id = p_user;
  insert into public.activity (event_id, actor_id, kind, data)
  values (p_event, auth.uid(), 'role_changed', jsonb_build_object('user_id', p_user, 'role', p_role));
end $$;

create or replace function public.transfer_ownership(p_event uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role(p_event) is distinct from 'organizer' then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.event_members where event_id = p_event and user_id = p_user
                 and status = 'active' and role in ('co_organizer', 'participant')) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  update public.event_members set role = 'co_organizer', updated_at = now() where event_id = p_event and user_id = auth.uid();
  update public.event_members set role = 'organizer', updated_at = now() where event_id = p_event and user_id = p_user;
  insert into public.activity (event_id, actor_id, kind, data) values (p_event, auth.uid(), 'ownership_transferred', jsonb_build_object('user_id', p_user));
end $$;

-- Retrait d'accès : immédiat (RLS lit le statut à chaque requête), et le lien ne permet plus de revenir.
create or replace function public.remove_member(p_event uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.member_role; v_me public.member_role := public.my_role(p_event);
begin
  select role into v_target from public.event_members where event_id = p_event and user_id = p_user and status = 'active';
  if v_target is null then raise exception 'invalid_target' using errcode = 'P0001'; end if;
  if v_target = 'organizer' or p_user = auth.uid() then raise exception 'invalid_target' using errcode = 'P0001'; end if;
  if not (v_me = 'organizer' or (v_me = 'co_organizer' and v_target in ('participant', 'beneficiary'))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.event_members set status = 'removed', updated_at = now() where event_id = p_event and user_id = p_user;
  if v_target = 'beneficiary' then
    update public.events set beneficiary_user_id = null where id = p_event and beneficiary_user_id = p_user;
  end if;
end $$;

create or replace function public.leave_event(p_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role(p_event) is null then raise exception 'not_member' using errcode = 'P0001'; end if;
  if public.my_role(p_event) = 'organizer' then raise exception 'transfer_required' using errcode = 'P0001'; end if;
  update public.event_members set status = 'left', updated_at = now() where event_id = p_event and user_id = auth.uid();
  update public.events set beneficiary_user_id = null where id = p_event and beneficiary_user_id = auth.uid();
end $$;

create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
$$;

-- Avant suppression d'un compte (appelée par le backend avec la clé service) :
-- l'organisation est transmise au co-organisateur le plus ancien, sinon au participant le plus ancien ;
-- un événement sans autre membre est supprimé avec ses contenus.
create or replace function public.prepare_account_deletion(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; v_next uuid;
begin
  for r in select event_id from public.event_members where user_id = p_user and role = 'organizer' and status = 'active' loop
    select user_id into v_next from public.event_members
      where event_id = r.event_id and user_id <> p_user and status = 'active' and role in ('co_organizer', 'participant')
      order by (role = 'co_organizer') desc, joined_at asc limit 1;
    update public.event_members set status = 'left', updated_at = now() where event_id = r.event_id and user_id = p_user;
    if v_next is null then
      delete from public.events where id = r.event_id;
    else
      update public.event_members set role = 'organizer', updated_at = now() where event_id = r.event_id and user_id = v_next;
      insert into public.activity (event_id, actor_id, kind, data) values (r.event_id, null, 'ownership_transferred', jsonb_build_object('user_id', v_next, 'reason', 'account_deleted'));
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.activity enable row level security;
alter table public.notifications enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_acceptances enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_event_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy prefs_select on public.notification_prefs for select to authenticated using (user_id = auth.uid());
create policy prefs_update on public.notification_prefs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy events_select on public.events for select to authenticated using (public.can_view_event(id));
create policy events_update on public.events for update to authenticated
  using (public.is_manager(id)) with check (public.is_manager(id));

-- Les membres voient la liste des membres actifs ; le bénéficiaire seulement après le dévoilement.
create policy members_select on public.event_members for select to authenticated
  using (user_id = auth.uid() or public.can_view_event(event_id));

create policy activity_select on public.activity for select to authenticated using (public.is_preparer(event_id));

create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());

create policy invitations_select on public.invitations for select to authenticated using (public.is_manager(event_id));

-- Aucune politique d'écriture directe sur members/invitations/activity/notifications : RPC uniquement.

-- ---------------------------------------------------------------------------
-- Privilèges : rien pour anon hormis l'aperçu d'invitation.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;
revoke update on public.events from authenticated;
grant update (title, beneficiary_name, occasion, description, cover_path, target_cents, gift_at,
  votes_close_at, contributions_close_at, reveal_at, timezone, vote_visibility) on public.events to authenticated;
revoke insert, delete on public.events, public.event_members, public.invitations, public.invitation_acceptances,
  public.activity, public.notifications, public.profiles, public.notification_prefs from authenticated;
revoke update on public.event_members, public.invitations, public.invitation_acceptances, public.activity, public.notifications from authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.preview_invitation(text) to anon, authenticated;
grant execute on function
  public.my_role(uuid), public.is_preparer(uuid), public.is_manager(uuid), public.is_revealed(uuid),
  public.can_view_event(uuid), public.shares_event_with(uuid),
  public.create_event(text, text, text, text, integer, timestamptz, timestamptz, timestamptz, timestamptz, text, text, public.vote_visibility),
  public.create_invitation(uuid, public.member_role, integer, integer), public.revoke_invitation(uuid),
  public.accept_invitation(text), public.set_member_role(uuid, uuid, public.member_role),
  public.transfer_ownership(uuid, uuid), public.remove_member(uuid, uuid), public.leave_event(uuid),
  public.mark_notifications_read(bigint[])
to authenticated;
revoke execute on function public.log_activity(uuid, text, jsonb), public.notify(uuid, uuid, text, jsonb, text),
  public.prepare_account_deletion(uuid), public.handle_new_user() from authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
