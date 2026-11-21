-- Migration 11 : pseudo et photo de profil, amis et blocage, invitations nominatives (amis, e-mail lié à
-- l'adresse vérifiée), total de la cagnotte visible des préparateurs, prochaine action enrichie.
--
-- Décisions produit (2026-11-22) :
--   - les organisateurs et participants voient le total collecté, l'objectif, le reste et leur propre
--     participation ; les montants des autres restent privés (aucun « qui a donné combien ») ; le
--     bénéficiaire ne voit toujours aucune donnée financière. Le total exact permet des déductions par
--     différence dans un petit groupe : l'app le dit sobrement.
--   - être amis ne donne aucun accès aux cagnottes : l'accès reste lié à l'appartenance au groupe.
--   - une invitation nominative (ami ou e-mail) ne fait jamais entrer quelqu'un en silence : la personne
--     choisit « Rejoindre » ou « Refuser ».
--   - bloquer ou retirer un ami ne retire personne d'une cagnotte existante (rien ne casse en silence) ;
--     cela empêche les nouvelles demandes et invitations entre les deux personnes.

-- ---------------------------------------------------------------------------
-- 1. Pseudo unique
-- ---------------------------------------------------------------------------
create or replace function public.username_base(p text)
returns text language sql immutable set search_path = '' as $$
  select left(
    case when char_length(b) >= 3 then b else b || 'complice' end, 14)
  from (select regexp_replace(
                 translate(lower(coalesce(p, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
                 '[^a-z0-9]+', '', 'g') as b) s
$$;

create or replace function public.generate_username(p_name text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_base text := public.username_base(p_name); v_try text; i int := 0;
begin
  loop
    v_try := v_base || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where username = v_try);
    i := i + 1;
    if i > 50 then v_try := v_base || replace(gen_random_uuid()::text, '-', ''); v_try := left(v_try, 20); exit; end if;
  end loop;
  return v_try;
end $$;

alter table public.profiles add column username text;
do $$
declare r record;
begin
  for r in select id, display_name from public.profiles where username is null loop
    update public.profiles set username = public.generate_username(r.display_name) where id = r.id;
  end loop;
end $$;
alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,20}$');
create unique index profiles_username_key on public.profiles (username);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Complice'), 40);
begin
  insert into public.profiles (id, display_name, username) values (new.id, v_name, public.generate_username(v_name));
  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end $$;

-- Changement de pseudo : format, mots réservés, unicité (le message ne dit rien d'autre que « pris »).
create or replace function public.set_username(p_username text)
returns text language plpgsql security definer set search_path = '' as $$
declare v text := lower(trim(both from regexp_replace(coalesce(p_username, ''), '^@+', '')));
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v !~ '^[a-z0-9_.]{3,20}$' then raise exception 'invalid_username' using errcode = 'P0001'; end if;
  if v in ('admin', 'administrateur', 'complice', 'support', 'aide', 'moderateur', 'moderation', 'equipe', 'officiel', 'root', 'system') then
    raise exception 'username_taken' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where username = v and id <> auth.uid()) then
    raise exception 'username_taken' using errcode = 'P0001';
  end if;
  update public.profiles set username = v, updated_at = now() where id = auth.uid();
  return v;
end $$;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(trim(regexp_replace(coalesce(p_username, ''), '^@+', ''))) ~ '^[a-z0-9_.]{3,20}$'
     and not exists (select 1 from public.profiles
                     where username = lower(trim(regexp_replace(coalesce(p_username, ''), '^@+', '')))
                       and id is distinct from auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- 2. Amis et blocage
--    Une ligne par paire (user_low < user_high). Une demande refusée n'est plus visible de personne ;
--    son auteur ne peut pas la relancer pendant 30 jours (la relance est acceptée sans effet).
-- ---------------------------------------------------------------------------
create table public.friendships (
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (user_low, user_high),
  constraint friendships_order check (user_low < user_high),
  constraint friendships_requester check (requested_by in (user_low, user_high))
);
create index friendships_high_idx on public.friendships (user_high);
create index friendships_requested_by_idx on public.friendships (requested_by, created_at);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks
                 where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a))
$$;

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships
                 where user_low = least(p_a, p_b) and user_high = greatest(p_a, p_b) and status = 'accepted')
$$;

-- ---------------------------------------------------------------------------
-- 3. Invitations nominatives dans une cagnotte (amis, ou e-mail retrouvé après connexion)
-- ---------------------------------------------------------------------------
alter table public.invitations
  add column kind text not null default 'link' check (kind in ('link', 'email')),
  add column email_hash text,
  add column email_hint text check (email_hint is null or char_length(email_hint) <= 120);
create index invitations_email_hash_idx on public.invitations (email_hash) where email_hash is not null;

create table public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  inviter_id uuid references public.profiles (id) on delete set null,
  role public.member_role not null default 'participant' check (role <> 'organizer'),
  source text not null default 'friend' check (source in ('friend', 'email')),
  invitation_id uuid references public.invitations (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days'
);
create unique index event_invites_one_pending on public.event_invites (event_id, invitee_id) where status = 'pending';
create index event_invites_invitee_idx on public.event_invites (invitee_id, status);
create index event_invites_inviter_idx on public.event_invites (inviter_id);
create index event_invites_invitation_idx on public.event_invites (invitation_id);

-- Profils visibles en dehors d'une cagnotte commune : relation d'amitié (en cours ou acceptée),
-- invitation nominative en attente entre nous, ou invitation envoyée par moi en tant que gestionnaire.
create or replace function public.profile_visible(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user = auth.uid()
    or exists (select 1 from public.friendships f
               where f.user_low = least(auth.uid(), p_user) and f.user_high = greatest(auth.uid(), p_user)
                 and f.status in ('pending', 'accepted'))
    or exists (select 1 from public.event_invites i
               where i.status = 'pending'
                 and ((i.invitee_id = auth.uid() and i.inviter_id = p_user)
                      or (i.invitee_id = p_user and public.is_manager(i.event_id))))
$$;

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_event_with(id) or public.profile_visible(id));

drop policy avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text
         or public.shares_event_with(public.try_uuid((storage.foldername(name))[1]))
         or public.profile_visible(public.try_uuid((storage.foldername(name))[1]))));

-- ---------------------------------------------------------------------------
-- 4. Préférences et types de notification
-- ---------------------------------------------------------------------------
alter table public.notification_prefs add column friends boolean not null default true;
grant update (friends) on public.notification_prefs to authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('invitation', 'vote_closing', 'task_assigned', 'capsule_open', 'gift_selected', 'member_joined',
                  'message', 'thanks', 'friend_request', 'friend_accepted', 'event_invite'));

create or replace function public.notify(p_user uuid, p_event uuid, p_kind text, p_data jsonb, p_dedupe text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_allowed boolean;
begin
  select case
    when p_kind in ('invitation', 'event_invite') then p.invitations
    when p_kind in ('friend_request', 'friend_accepted') then p.friends
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
-- 5. RPC amis
-- ---------------------------------------------------------------------------
create or replace function public.send_friend_request(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); f public.friendships; v_low uuid; v_high uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_user is null or p_user = v_uid or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.user_blocks where blocker_id = v_uid and blocked_id = p_user) then
    raise exception 'blocked_user' using errcode = 'P0001';
  end if;
  -- Bloqué par l'autre : réponse identique à un envoi normal, sans effet (ne révèle pas le blocage).
  if exists (select 1 from public.user_blocks where blocker_id = p_user and blocked_id = v_uid) then
    return jsonb_build_object('status', 'sent');
  end if;
  v_low := least(v_uid, p_user); v_high := greatest(v_uid, p_user);
  select * into f from public.friendships where user_low = v_low and user_high = v_high for update;
  if f.status = 'accepted' then return jsonb_build_object('status', 'already_friends'); end if;
  if f.status = 'pending' and f.requested_by = v_uid then return jsonb_build_object('status', 'already_pending'); end if;
  if f.status = 'pending' then
    -- Demandes croisées : l'autre m'avait déjà demandé, on devient amis.
    update public.friendships set status = 'accepted', responded_at = now() where user_low = v_low and user_high = v_high;
    perform public.notify(p_user, null, 'friend_accepted', jsonb_build_object('from', v_uid), 'friend_accepted:' || v_low || ':' || v_high);
    return jsonb_build_object('status', 'accepted');
  end if;
  if (select count(*) from public.friendships where requested_by = v_uid and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if f.status = 'declined' then
    if f.requested_by = v_uid and f.responded_at > now() - interval '30 days' then
      return jsonb_build_object('status', 'sent');
    end if;
    update public.friendships set status = 'pending', requested_by = v_uid, created_at = now(), responded_at = null
    where user_low = v_low and user_high = v_high;
  else
    insert into public.friendships (user_low, user_high, requested_by) values (v_low, v_high, v_uid);
  end if;
  perform public.notify(p_user, null, 'friend_request', jsonb_build_object('from', v_uid),
    'friend_request:' || v_uid || ':' || p_user || ':' || to_char(now(), 'YYYYMMDD'));
  return jsonb_build_object('status', 'sent');
end $$;

create or replace function public.respond_friend_request(p_user uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); f public.friendships;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into f from public.friendships
  where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user) for update;
  if f.status is distinct from 'pending' or f.requested_by <> p_user then
    return jsonb_build_object('status', case when f.status = 'accepted' then 'already_friends' else 'not_found' end);
  end if;
  update public.friendships set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where user_low = f.user_low and user_high = f.user_high;
  update public.notifications set read_at = coalesce(read_at, now())
  where user_id = v_uid and kind = 'friend_request' and data ->> 'from' = p_user::text;
  if p_accept then
    perform public.notify(p_user, null, 'friend_accepted', jsonb_build_object('from', v_uid), 'friend_accepted:' || f.user_low || ':' || f.user_high);
    return jsonb_build_object('status', 'accepted');
  end if;
  return jsonb_build_object('status', 'declined');
end $$;

create or replace function public.cancel_friend_request(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  delete from public.friendships
  where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user) and status = 'pending' and requested_by = v_uid;
  delete from public.notifications
  where user_id = p_user and kind = 'friend_request' and data ->> 'from' = v_uid::text and read_at is null;
end $$;

create or replace function public.remove_friend(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  delete from public.friendships
  where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user) and status = 'accepted';
end $$;

-- Blocage : supprime la relation, annule les invitations nominatives en attente entre les deux personnes.
-- N'affecte aucune adhésion existante : une cagnotte commune continue de fonctionner.
create or replace function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_user is null or p_user = v_uid or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_uid, p_user) on conflict do nothing;
  delete from public.friendships where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user);
  update public.event_invites set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((inviter_id = p_user and invitee_id = v_uid) or (inviter_id = v_uid and invitee_id = p_user));
  delete from public.notifications
  where user_id = v_uid and read_at is null and kind in ('friend_request', 'event_invite') and data ->> 'from' = p_user::text;
end $$;

create or replace function public.unblock_user(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_user
$$;

create or replace function public.my_friends()
returns table (user_id uuid, username text, display_name text, avatar_path text, relation text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_path,
         case when f.status = 'accepted' then 'friend' when f.requested_by = auth.uid() then 'outgoing' else 'incoming' end,
         coalesce(f.responded_at, f.created_at)
  from public.friendships f
  join public.profiles p on p.id = case when f.user_low = auth.uid() then f.user_high else f.user_low end
  where auth.uid() in (f.user_low, f.user_high) and f.status in ('pending', 'accepted')
  order by p.display_name
$$;

create or replace function public.my_blocked()
returns table (user_id uuid, username text, display_name text, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, b.created_at
  from public.user_blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid() order by b.created_at desc
$$;

-- Recherche par pseudo : préfixe, 10 résultats, jamais d'e-mail ; les personnes bloquées (dans un sens
-- ou dans l'autre) n'apparaissent pas. La photo n'est donnée que si la relation l'autorise déjà.
create or replace function public.search_profiles(p_query text)
returns table (user_id uuid, username text, display_name text, avatar_path text, relation text)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := lower(trim(regexp_replace(coalesce(p_query, ''), '^@+', '')));
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if char_length(v_q) < 2 or v_q !~ '^[a-z0-9_.]+$' then return; end if;
  return query
  select p.id, p.username, p.display_name,
         case when public.profile_visible(p.id) or public.shares_event_with(p.id) then p.avatar_path end,
         coalesce((select case when f.status = 'accepted' then 'friend' when f.requested_by = auth.uid() then 'outgoing' else 'incoming' end
                   from public.friendships f
                   where f.user_low = least(auth.uid(), p.id) and f.user_high = greatest(auth.uid(), p.id)
                     and f.status in ('pending', 'accepted')), 'none')
  from public.profiles p
  where p.username like replace(replace(v_q, '_', '\_'), '.', '.') || '%'
    and p.id <> auth.uid()
    and not public.is_blocked_between(auth.uid(), p.id)
  order by (p.username = v_q) desc, char_length(p.username), p.username
  limit 10;
end $$;

-- ---------------------------------------------------------------------------
-- 6. RPC invitations nominatives
-- ---------------------------------------------------------------------------
-- Adhésion commune (lien, ami, e-mail) : vérifications identiques partout.
create or replace function public.join_event_as(p_event uuid, p_user uuid, p_role public.member_role)
returns text language plpgsql security definer set search_path = '' as $$
declare ev public.events; m public.event_members;
begin
  select * into ev from public.events where id = p_event for update;
  if ev.id is null or ev.status in ('cancelled', 'archived') then return 'event_closed'; end if;
  select * into m from public.event_members where event_id = p_event and user_id = p_user;
  if m.status = 'active' then return 'already_member'; end if;
  if m.status = 'removed' then return 'removed'; end if;
  if p_role = 'beneficiary' and ev.beneficiary_user_id is not null then return 'beneficiary_taken'; end if;
  insert into public.event_members (event_id, user_id, role, status, joined_at)
  values (p_event, p_user, p_role, 'active', now())
  on conflict (event_id, user_id) do update set role = excluded.role, status = 'active', joined_at = now(), updated_at = now();
  if p_role = 'beneficiary' then
    update public.events set beneficiary_user_id = p_user where id = p_event;
  else
    insert into public.activity (event_id, actor_id, kind) values (p_event, p_user, 'member_joined');
  end if;
  return 'joined';
end $$;

create or replace function public.invite_friends(p_event uuid, p_users uuid[], p_role public.member_role default 'participant')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); ev public.events; u uuid; v_res jsonb := '[]'; v_status text; v_id uuid; m public.event_members;
begin
  if not public.is_manager(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role = 'organizer' then raise exception 'invalid_role' using errcode = 'P0001'; end if;
  if p_role = 'co_organizer' and public.my_role(p_event) <> 'organizer' then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into ev from public.events where id = p_event;
  if ev.status <> 'active' then raise exception 'event_locked' using errcode = 'P0001'; end if;
  if p_users is null or cardinality(p_users) not between 1 and 20 then raise exception 'invalid_request' using errcode = 'P0001'; end if;
  if p_role = 'beneficiary' and (cardinality(p_users) <> 1 or ev.beneficiary_user_id is not null
     or exists (select 1 from public.event_invites where event_id = p_event and role = 'beneficiary' and status = 'pending')) then
    raise exception 'beneficiary_taken' using errcode = 'P0001';
  end if;
  if (select count(*) from public.event_invites where event_id = p_event and created_at > now() - interval '24 hours') + cardinality(p_users) > 100 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  foreach u in array (select array_agg(distinct x) from unnest(p_users) x) loop
    select * into m from public.event_members where event_id = p_event and user_id = u;
    v_status := case
      when u = v_uid then 'invalid'
      when not public.are_friends(v_uid, u) or public.is_blocked_between(v_uid, u) then 'not_friend'
      when m.status = 'active' then 'already_member'
      when m.status = 'removed' then 'removed'
      when exists (select 1 from public.event_invites where event_id = p_event and invitee_id = u and status = 'pending') then 'already_invited'
      when exists (select 1 from public.event_invites where event_id = p_event and invitee_id = u and status = 'declined'
                   and responded_at > now() - interval '7 days') then 'declined'
      else 'invited' end;
    if v_status = 'invited' then
      insert into public.event_invites (event_id, invitee_id, inviter_id, role) values (p_event, u, v_uid, p_role) returning id into v_id;
      perform public.notify(u, null, 'event_invite',
        jsonb_build_object('invite_id', v_id, 'from', v_uid, 'role', p_role,
                           -- Bénéficiaire : rien qui dévoile les préparatifs.
                           'title', case when p_role = 'beneficiary' then null else ev.title end),
        'event_invite:' || v_id);
    end if;
    v_res := v_res || jsonb_build_object('user_id', u, 'status', v_status);
  end loop;
  return v_res;
end $$;

create or replace function public.respond_event_invite(p_invite uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); i public.event_invites; v_status text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into i from public.event_invites where id = p_invite and invitee_id = v_uid for update;
  if i.id is null then return jsonb_build_object('status', 'invalid'); end if;
  if i.status <> 'pending' then return jsonb_build_object('status', i.status, 'event_id', case when i.status = 'accepted' then i.event_id end); end if;
  update public.notifications set read_at = coalesce(read_at, now())
  where user_id = v_uid and kind = 'event_invite' and data ->> 'invite_id' = i.id::text;
  if i.expires_at <= now() then
    update public.event_invites set status = 'expired', responded_at = now() where id = i.id;
    return jsonb_build_object('status', 'expired');
  end if;
  if not p_accept then
    update public.event_invites set status = 'declined', responded_at = now() where id = i.id;
    return jsonb_build_object('status', 'declined');
  end if;
  v_status := public.join_event_as(i.event_id, v_uid, i.role);
  if v_status in ('joined', 'already_member') then
    update public.event_invites set status = 'accepted', responded_at = now() where id = i.id;
    if i.invitation_id is not null then
      update public.invitations set use_count = use_count + 1 where id = i.invitation_id;
      insert into public.invitation_acceptances (invitation_id, user_id) values (i.invitation_id, v_uid) on conflict do nothing;
    end if;
    return jsonb_build_object('status', v_status, 'event_id', i.event_id, 'role', i.role);
  end if;
  update public.event_invites set status = 'cancelled', responded_at = now() where id = i.id;
  return jsonb_build_object('status', v_status);
end $$;

create or replace function public.cancel_event_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.event_invites;
begin
  select * into i from public.event_invites where id = p_invite for update;
  if i.id is null or not public.is_manager(i.event_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if i.status <> 'pending' then return; end if;
  update public.event_invites set status = 'cancelled', responded_at = now() where id = i.id;
  if i.invitation_id is not null then
    update public.invitations set revoked_at = coalesce(revoked_at, now()) where id = i.invitation_id;
  end if;
  delete from public.notifications where user_id = i.invitee_id and kind = 'event_invite' and data ->> 'invite_id' = i.id::text and read_at is null;
end $$;

-- Invitations reçues en attente. Pour le bénéficiaire, ni titre ni nom : la surprise reste entière.
create or replace function public.my_event_invites()
returns table (id uuid, event_id uuid, role public.member_role, source text, inviter_name text, inviter_avatar text,
               title text, occasion text, gift_at timestamptz, member_count integer, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.event_id, i.role, i.source, p.display_name, p.avatar_path,
         case when i.role = 'beneficiary' then null else e.title end,
         case when i.role = 'beneficiary' then null else e.occasion end,
         case when i.role = 'beneficiary' then null else e.gift_at end,
         case when i.role = 'beneficiary' then null else
           (select count(*)::int from public.event_members m where m.event_id = e.id and m.status = 'active' and m.role <> 'beneficiary') end,
         i.created_at, i.expires_at
  from public.event_invites i
  join public.events e on e.id = i.event_id
  left join public.profiles p on p.id = i.inviter_id
  where i.invitee_id = auth.uid() and i.status = 'pending' and i.expires_at > now() and e.status = 'active'
  order by i.created_at desc
$$;

-- Suivi des invitations d'une cagnotte (gestionnaires) : nominatives et par e-mail, sans adresse complète.
create or replace function public.event_invites_overview(p_event uuid)
returns table (id uuid, kind text, invitee_id uuid, display_name text, username text, avatar_path text, email_hint text,
               role public.member_role, status text, created_at timestamptz, responded_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_manager(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select i.id, i.source, i.invitee_id, p.display_name, p.username, p.avatar_path, inv.email_hint, i.role,
         case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
         i.created_at, i.responded_at, i.expires_at
  from public.event_invites i
  join public.profiles p on p.id = i.invitee_id
  left join public.invitations inv on inv.id = i.invitation_id
  where i.event_id = p_event and i.created_at > now() - interval '60 days'
  union all
  -- E-mails pas encore rattachés à un compte.
  select inv.id, 'email', null, null, null, null, inv.email_hint, inv.role,
         case when inv.revoked_at is not null then 'cancelled'
              when inv.use_count >= coalesce(inv.max_uses, 1) then 'accepted'
              when inv.expires_at <= now() then 'expired' else 'pending' end,
         inv.created_at, null, inv.expires_at
  from public.invitations inv
  where inv.event_id = p_event and inv.kind = 'email' and inv.created_at > now() - interval '60 days'
    and not exists (select 1 from public.event_invites i where i.invitation_id = inv.id)
  order by 10 desc;
end $$;

-- Annulation d'une invitation par e-mail pas encore rattachée (révoque le lien personnel).
create or replace function public.cancel_email_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_event uuid;
begin
  select event_id into v_event from public.invitations where id = p_invitation and kind = 'email';
  if v_event is null or not public.is_manager(v_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.invitations set revoked_at = coalesce(revoked_at, now()) where id = p_invitation;
  update public.event_invites set status = 'cancelled', responded_at = now() where invitation_id = p_invitation and status = 'pending';
end $$;

-- Adresse e-mail vérifiée de l'utilisateur courant (jamais renvoyée au client).
create or replace function public.my_verified_email_hash()
returns text language sql stable security definer set search_path = '' as $$
  select public.hash_token(lower(trim(u.email))) from auth.users u
  where u.id = auth.uid() and u.email is not null and u.email_confirmed_at is not null
$$;

-- Après connexion : les invitations par e-mail adressées à mon adresse vérifiée deviennent des
-- invitations dans l'app (rejoindre ou refuser), une seule fois chacune.
create or replace function public.claim_email_invites()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_hash text := public.my_verified_email_hash(); r record; v_id uuid; n integer := 0;
begin
  if v_uid is null or v_hash is null then return 0; end if;
  for r in
    select inv.* from public.invitations inv join public.events e on e.id = inv.event_id
    where inv.kind = 'email' and inv.email_hash = v_hash and inv.revoked_at is null and inv.expires_at > now()
      and inv.use_count < coalesce(inv.max_uses, 1) and e.status = 'active'
      and not exists (select 1 from public.event_members m where m.event_id = inv.event_id and m.user_id = v_uid)
      and not exists (select 1 from public.event_invites i where i.invitation_id = inv.id)
      and not public.is_blocked_between(v_uid, inv.created_by)
  loop
    if exists (select 1 from public.event_invites where event_id = r.event_id and invitee_id = v_uid and status = 'pending') then
      continue;
    end if;
    insert into public.event_invites (event_id, invitee_id, inviter_id, role, source, invitation_id, expires_at)
    values (r.event_id, v_uid, r.created_by, r.role, 'email', r.id, r.expires_at) returning id into v_id;
    perform public.notify(v_uid, null, 'event_invite',
      jsonb_build_object('invite_id', v_id, 'from', r.created_by, 'role', r.role,
                         'title', case when r.role = 'beneficiary' then null else (select title from public.events where id = r.event_id) end),
      'event_invite:' || v_id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Invitation par e-mail : lien personnel lié à l'adresse (accepté seulement par le compte vérifié
-- portant cette adresse). Si un compte existe déjà, l'invitation apparaît aussi dans son app.
create or replace function public.prepare_email_invitation(p_event uuid, p_role public.member_role, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_inv jsonb; ev public.events; v_inviter text;
        v_target uuid; v_hint text; v_hash text; v_ei uuid;
begin
  if not public.is_manager(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or char_length(v_email) > 320 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  v_hash := public.hash_token(v_email);
  if exists (select 1 from public.invitations where event_id = p_event and kind = 'email' and email_hash = v_hash
             and revoked_at is null and created_at > now() - interval '1 hour') then
    return jsonb_build_object('status', 'already_sent');
  end if;
  if (select count(*) from public.invitations where event_id = p_event and kind = 'email'
      and created_at > now() - interval '24 hours') >= 50 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select id into v_target from auth.users where lower(email) = v_email and email_confirmed_at is not null;
  if v_target is not null then
    if exists (select 1 from public.event_members where event_id = p_event and user_id = v_target and status = 'active') then
      return jsonb_build_object('status', 'already_member');
    end if;
    -- Blocage entre les deux personnes : réponse normale, aucun envoi.
    if public.is_blocked_between(auth.uid(), v_target) then
      return jsonb_build_object('status', 'queued');
    end if;
  end if;
  v_hint := left(split_part(v_email, '@', 1), 2) || '•••@' || split_part(v_email, '@', 2);
  v_inv := public.create_invitation(p_event, p_role, 168, 1);
  update public.invitations set kind = 'email', email_hash = v_hash, email_hint = left(v_hint, 120)
  where id = (v_inv ->> 'id')::uuid;
  select * into ev from public.events where id = p_event;
  select display_name into v_inviter from public.profiles where id = auth.uid();
  insert into public.email_outbox (kind, to_email, event_id, payload, dedupe_key)
  values ('invitation', v_email, p_event,
    jsonb_build_object('token', v_inv ->> 'token', 'event_title', ev.title, 'beneficiary_name', ev.beneficiary_name,
                       'inviter_name', v_inviter, 'role', p_role, 'expires_at', v_inv ->> 'expires_at', 'personal', true),
    'invitation:' || (v_inv ->> 'id'));
  if v_target is not null and not exists (select 1 from public.event_invites where event_id = p_event and invitee_id = v_target and status = 'pending') then
    insert into public.event_invites (event_id, invitee_id, inviter_id, role, source, invitation_id, expires_at)
    values (p_event, v_target, auth.uid(), p_role, 'email', (v_inv ->> 'id')::uuid, (v_inv ->> 'expires_at')::timestamptz)
    returning id into v_ei;
    perform public.notify(v_target, null, 'event_invite',
      jsonb_build_object('invite_id', v_ei, 'from', auth.uid(), 'role', p_role, 'title', case when p_role = 'beneficiary' then null else ev.title end),
      'event_invite:' || v_ei);
  end if;
  return jsonb_build_object('status', 'queued', 'invitation_id', v_inv ->> 'id', 'expires_at', v_inv ->> 'expires_at');
end $$;

-- Lien : un lien personnel (e-mail) n'est accepté que par le compte vérifié de cette adresse.
create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare inv public.invitations; v_uid uuid := auth.uid(); v_status text; ev public.events;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into inv from public.invitations where token_hash = public.hash_token(coalesce(p_token, '')) for update;
  if inv.id is null then return jsonb_build_object('status', 'invalid'); end if;
  if inv.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  select * into ev from public.events where id = inv.event_id;
  if ev.status in ('cancelled', 'archived') then return jsonb_build_object('status', 'event_closed'); end if;
  if exists (select 1 from public.event_members where event_id = inv.event_id and user_id = v_uid and status = 'active') then
    return jsonb_build_object('status', 'already_member', 'event_id', inv.event_id);
  end if;
  if exists (select 1 from public.event_members where event_id = inv.event_id and user_id = v_uid and status = 'removed') then
    return jsonb_build_object('status', 'removed');
  end if;
  if inv.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if inv.max_uses is not null and inv.use_count >= inv.max_uses then return jsonb_build_object('status', 'exhausted'); end if;
  if inv.kind = 'email' and inv.email_hash is distinct from public.my_verified_email_hash() then
    return jsonb_build_object('status', 'wrong_account');
  end if;
  v_status := public.join_event_as(inv.event_id, v_uid, inv.role);
  if v_status <> 'joined' then return jsonb_build_object('status', v_status); end if;
  update public.invitations set use_count = use_count + 1 where id = inv.id;
  insert into public.invitation_acceptances (invitation_id, user_id) values (inv.id, v_uid) on conflict do nothing;
  update public.event_invites set status = 'accepted', responded_at = now() where invitation_id = inv.id and status = 'pending';
  return jsonb_build_object('status', 'joined', 'event_id', inv.event_id, 'role', inv.role);
end $$;

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
    when inv.kind = 'email' and auth.uid() is not null and inv.email_hash is distinct from public.my_verified_email_hash() then 'wrong_account'
    else 'valid' end;
  if v_status not in ('valid', 'already_member', 'wrong_account') then
    return jsonb_build_object('status', v_status);
  end if;
  select p.display_name into v_org from public.event_members m join public.profiles p on p.id = m.user_id
    where m.event_id = ev.id and m.role = 'organizer' and m.status = 'active';
  select count(*) into v_members from public.event_members where event_id = ev.id and status = 'active' and role <> 'beneficiary';
  return jsonb_build_object(
    'status', v_status,
    'event_id', case when auth.uid() is not null and v_status = 'already_member' then ev.id end,
    'personal', inv.kind = 'email', 'email_hint', case when inv.kind = 'email' then inv.email_hint end,
    -- Lien bénéficiaire : rien sur les préparatifs.
    'title', case when inv.role = 'beneficiary' then null else ev.title end,
    'beneficiary_name', case when inv.role = 'beneficiary' then null else ev.beneficiary_name end,
    'occasion', case when inv.role = 'beneficiary' then null else ev.occasion end,
    'gift_at', ev.gift_at, 'timezone', ev.timezone, 'organizer_name', v_org,
    'member_count', case when inv.role = 'beneficiary' then null else v_members end,
    'role', inv.role, 'expires_at', inv.expires_at);
end $$;

-- Surprises en préparation pour moi (bénéficiaire, avant l'ouverture) : la date et l'organisateur,
-- rien d'autre. L'événement lui-même reste invisible jusqu'au dévoilement.
create or replace function public.my_surprises()
returns table (event_id uuid, reveal_at timestamptz, organizer_name text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.reveal_at,
         (select p.display_name from public.event_members o join public.profiles p on p.id = o.user_id
          where o.event_id = e.id and o.role = 'organizer' and o.status = 'active')
  from public.event_members m join public.events e on e.id = m.event_id
  where m.user_id = auth.uid() and m.status = 'active' and m.role = 'beneficiary'
    and e.status = 'active' and now() < e.reveal_at
$$;

-- ---------------------------------------------------------------------------
-- 7. Cagnotte : total exact pour les préparateurs, jamais pour le bénéficiaire ni par personne
-- ---------------------------------------------------------------------------
drop function public.event_funding(uuid);
create function public.event_funding(p_event uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_preparer(p_event) then jsonb_build_object(
    'target_cents', f.target_cents,
    'collected_cents', f.collected_cents,
    'remaining_cents', greatest(f.target_cents - f.collected_cents, 0),
    'percent', case when f.target_cents > 0 then floor(f.collected_cents::numeric * 100 / f.target_cents)::int else 0 end,
    'progress_step', public.funding_step(f.collected_cents, f.target_cents),
    'goal_reached', f.collected_cents >= f.target_cents,
    'contributions_open', e.status = 'active' and now() < e.contributions_close_at,
    'contributions_close_at', e.contributions_close_at,
    'my_confirmed_cents', (select coalesce(sum(amount_cents), 0) from public.contributions
                           where event_id = p_event and status = 'confirmed' and user_id = auth.uid())
  ) end
  from public.events e join public.event_finances f on f.event_id = e.id
  where e.id = p_event
$$;

drop function public.my_events_funding();
create function public.my_events_funding()
returns table (event_id uuid, collected_cents integer, target_cents integer, percent integer, goal_reached boolean)
language sql stable security definer set search_path = '' as $$
  select f.event_id, f.collected_cents, f.target_cents,
         case when f.target_cents > 0 then floor(f.collected_cents::numeric * 100 / f.target_cents)::int else 0 end,
         f.collected_cents >= f.target_cents
  from public.event_finances f
  join public.event_members m on m.event_id = f.event_id
  where m.user_id = auth.uid() and m.status = 'active' and m.role <> 'beneficiary'
$$;

-- ---------------------------------------------------------------------------
-- 8. Étapes et prochaine action : proposer, voter, choisir, prendre ou finir une mission, écrire.
--    La participation financière n'est jamais poussée en premier (formulation neutre, en dernier).
-- ---------------------------------------------------------------------------
create or replace function public.event_progress(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ev public.events; v_preparers int; v_published int; v_tasks_done int; v_tasks int; v_steps jsonb; v_next text;
        v_voted boolean; v_contributed boolean; v_entry public.capsule_status; v_my_tasks int; v_open_tasks int;
        v_proposals int; v_my_proposals int; v_my_done int;
begin
  if not public.can_view_event(p_event) then return null; end if;
  select * into ev from public.events where id = p_event;
  select count(*) into v_preparers from public.event_members where event_id = p_event and status = 'active' and role <> 'beneficiary';
  select count(*) into v_published from public.capsule_entries where event_id = p_event and status = 'published';
  select count(*) filter (where status = 'done'), count(*), count(*) filter (where status = 'open')
    into v_tasks_done, v_tasks, v_open_tasks from public.tasks where event_id = p_event;
  select count(*), count(*) filter (where author_id = auth.uid())
    into v_proposals, v_my_proposals from public.proposals where event_id = p_event and status = 'active';
  select exists (select 1 from public.votes where event_id = p_event and user_id = auth.uid()) into v_voted;
  select exists (select 1 from public.contributions where event_id = p_event and user_id = auth.uid() and status = 'confirmed') into v_contributed;
  select status into v_entry from public.capsule_entries where event_id = p_event and author_id = auth.uid();
  select count(*) filter (where status = 'claimed'), count(*) filter (where status = 'done')
    into v_my_tasks, v_my_done from public.tasks where event_id = p_event and assignee_id = auth.uid();

  v_steps := jsonb_build_array(
    jsonb_build_object('key', 'group', 'done', v_preparers >= 2),
    jsonb_build_object('key', 'vote', 'done', ev.selected_proposal_id is not null),
    jsonb_build_object('key', 'purchase', 'done', exists (select 1 from public.tasks where event_id = p_event and kind = 'order' and status = 'done')),
    jsonb_build_object('key', 'capsule', 'done', v_published * 2 >= greatest(v_preparers, 1)),
    jsonb_build_object('key', 'reveal', 'done', public.is_revealed(p_event))
  );

  v_next := case
    when public.my_role(p_event) = 'beneficiary' then 'open_capsule'
    when public.is_revealed(p_event) then 'view_memories'
    when v_preparers < 2 and public.is_manager(p_event) then 'invite'
    when ev.selected_proposal_id is null and now() < ev.votes_close_at and v_proposals = 0 then 'propose'
    when not v_voted and now() < ev.votes_close_at and ev.selected_proposal_id is null then 'vote'
    when public.is_manager(p_event) and ev.selected_proposal_id is null and now() >= ev.votes_close_at then 'select_gift'
    when v_my_tasks > 0 then 'finish_task'
    when v_entry is distinct from 'published' then 'write_capsule'
    when v_open_tasks > 0 and v_my_done = 0 then 'claim_task'
    when not v_contributed and now() < ev.contributions_close_at then 'contribute'
    else 'wait_reveal' end;

  return jsonb_build_object(
    'steps', v_steps,
    'steps_done', (select count(*) from jsonb_array_elements(v_steps) s where (s ->> 'done')::boolean),
    'tasks_done', v_tasks_done, 'tasks_total', v_tasks, 'tasks_open', v_open_tasks,
    'proposals', v_proposals, 'my_proposals', v_my_proposals,
    'capsule_published', v_published, 'preparers', v_preparers,
    'my_capsule', coalesce(v_entry::text, 'none'), 'voted', v_voted,
    'next_action', v_next, 'my_role', public.my_role(p_event),
    'votes_open', ev.status = 'active' and now() < ev.votes_close_at,
    'contributions_open', ev.status = 'active' and now() < ev.contributions_close_at,
    'revealed', public.is_revealed(p_event));
end $$;

-- ---------------------------------------------------------------------------
-- 9. RLS et droits
-- ---------------------------------------------------------------------------
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.event_invites enable row level security;

create policy friendships_select on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_low, user_high) and status in ('pending', 'accepted'));
create policy blocks_select on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy event_invites_select on public.event_invites for select to authenticated
  using (invitee_id = (select auth.uid()) or public.is_manager(event_id));

-- Lecture seule pour l'app ; toute écriture passe par les RPC.
revoke all on public.friendships, public.user_blocks, public.event_invites from anon, authenticated;
grant select on public.friendships, public.user_blocks, public.event_invites to authenticated;
grant select, insert, update, delete on public.friendships, public.user_blocks, public.event_invites to service_role;

-- Le pseudo ne change que par set_username (unicité et mots réservés contrôlés).
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;

alter publication supabase_realtime add table public.friendships, public.event_invites;

revoke execute on function
  public.username_base(text), public.generate_username(text), public.set_username(text), public.username_available(text),
  public.is_blocked_between(uuid, uuid), public.are_friends(uuid, uuid), public.profile_visible(uuid),
  public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.cancel_friend_request(uuid),
  public.remove_friend(uuid), public.block_user(uuid), public.unblock_user(uuid), public.my_friends(), public.my_blocked(),
  public.search_profiles(text), public.join_event_as(uuid, uuid, public.member_role),
  public.invite_friends(uuid, uuid[], public.member_role), public.respond_event_invite(uuid, boolean),
  public.cancel_event_invite(uuid), public.my_event_invites(), public.event_invites_overview(uuid),
  public.cancel_email_invitation(uuid), public.my_verified_email_hash(), public.claim_email_invites(),
  public.prepare_email_invitation(uuid, public.member_role, text), public.accept_invitation(text),
  public.preview_invitation(text), public.my_surprises(), public.event_funding(uuid), public.my_events_funding(),
  public.event_progress(uuid), public.notify(uuid, uuid, text, jsonb, text), public.handle_new_user()
from public, anon, authenticated;

grant execute on function public.preview_invitation(text) to anon, authenticated;
grant execute on function
  public.profile_visible(uuid),
  public.set_username(text), public.username_available(text),
  public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.cancel_friend_request(uuid),
  public.remove_friend(uuid), public.block_user(uuid), public.unblock_user(uuid), public.my_friends(), public.my_blocked(),
  public.search_profiles(text),
  public.invite_friends(uuid, uuid[], public.member_role), public.respond_event_invite(uuid, boolean),
  public.cancel_event_invite(uuid), public.my_event_invites(), public.event_invites_overview(uuid),
  public.cancel_email_invitation(uuid), public.claim_email_invites(),
  public.prepare_email_invitation(uuid, public.member_role, text), public.accept_invitation(text),
  public.my_surprises(), public.event_funding(uuid), public.my_events_funding(), public.event_progress(uuid)
to authenticated;
