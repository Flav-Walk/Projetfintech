-- Migration 13 : parcours de la personne fêtée (bénéficiaire).
-- 1. Invitation nominative seulement (ami ou e-mail lié à l'adresse confirmée) : un lien générique ne peut plus
--    attribuer le rôle bénéficiaire, et un membre déjà préparateur ne peut pas le devenir par erreur.
-- 2. Une seule personne fêtée : contrôle commun (membre, invitation en attente non expirée, e-mail non utilisé).
-- 3. Renvoyer une invitation (ami ou e-mail) ; l'adresse est relue côté serveur, jamais renvoyée au client.
-- 4. Ce que voit la personne fêtée : seulement la capsule (mots et photos publiés) à partir de l'heure serveur
--    d'ouverture. Plus de cadeau choisi, de photo d'idée ni de compteurs de préparatifs, même après l'ouverture.
-- 5. État de sa capsule (heure serveur pour le compte à rebours) et ouverture déjà vue (ne se rejoue pas).

-- ---------------------------------------------------------------------------
-- 1. Liens : jamais pour le rôle bénéficiaire
-- ---------------------------------------------------------------------------
create or replace function public.create_invitation_internal(p_event uuid, p_role public.member_role, p_expires_in_hours integer, p_max_uses integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + make_interval(hours => p_expires_in_hours);
  insert into public.invitations (event_id, token_hash, role, created_by, expires_at, max_uses)
  values (p_event, public.hash_token(v_token), p_role, auth.uid(), v_expires, p_max_uses)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', v_expires, 'role', p_role);
end $$;

-- Lien de partage (onglet « Lien ») : participants et coorganisateurs uniquement.
create or replace function public.create_invitation(p_event uuid, p_role public.member_role default 'participant',
                                                    p_expires_in_hours integer default 168, p_max_uses integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_role = 'beneficiary' then raise exception 'beneficiary_link_forbidden' using errcode = 'P0001'; end if;
  return public.create_invitation_internal(p_event, p_role, p_expires_in_hours, p_max_uses);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Une seule personne fêtée
-- ---------------------------------------------------------------------------
create or replace function public.beneficiary_slot_taken(p_event uuid, p_except uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events where id = p_event and beneficiary_user_id is not null)
      or exists (select 1 from public.event_invites i where i.event_id = p_event and i.role = 'beneficiary'
                 and i.status = 'pending' and i.expires_at > now()
                 and (p_except is null or (i.id <> p_except and i.invitation_id is distinct from p_except)))
      or exists (select 1 from public.invitations v where v.event_id = p_event and v.role = 'beneficiary' and v.kind = 'email'
                 and v.revoked_at is null and v.expires_at > now() and v.use_count < coalesce(v.max_uses, 1)
                 and (p_except is null or v.id <> p_except)
                 and not exists (select 1 from public.event_invites i where i.invitation_id = v.id and i.status <> 'pending'))
$$;

-- Un membre actif garde son rôle : accepter une invitation de bénéficiaire en étant préparateur est refusé.
create or replace function public.join_event_as(p_event uuid, p_user uuid, p_role public.member_role)
returns text language plpgsql security definer set search_path = '' as $$
declare ev public.events; m public.event_members;
begin
  select * into ev from public.events where id = p_event for update;
  if ev.id is null or ev.status in ('cancelled', 'archived') then return 'event_closed'; end if;
  select * into m from public.event_members where event_id = p_event and user_id = p_user;
  if m.status = 'active' then
    return case when (p_role = 'beneficiary') <> (m.role = 'beneficiary') then 'role_conflict' else 'already_member' end;
  end if;
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
  if p_role = 'beneficiary' and (cardinality(p_users) <> 1 or public.beneficiary_slot_taken(p_event)) then
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
      when exists (select 1 from public.event_invites where event_id = p_event and invitee_id = u and status = 'pending' and expires_at > now()) then 'already_invited'
      when exists (select 1 from public.event_invites where event_id = p_event and invitee_id = u and status = 'declined'
                   and responded_at > now() - interval '7 days') then 'declined'
      else 'invited' end;
    if v_status = 'invited' then
      -- Une invitation expirée encore « en attente » est close avant la nouvelle (index d'unicité).
      update public.event_invites set status = 'expired', responded_at = now()
      where event_id = p_event and invitee_id = u and status = 'pending' and expires_at <= now();
      insert into public.event_invites (event_id, invitee_id, inviter_id, role) values (p_event, u, v_uid, p_role) returning id into v_id;
      perform public.notify(u, null, 'event_invite',
        jsonb_build_object('invite_id', v_id, 'from', v_uid, 'role', p_role,
                           'title', case when p_role = 'beneficiary' then null else ev.title end),
        'event_invite:' || v_id);
    end if;
    v_res := v_res || jsonb_build_object('user_id', u, 'status', v_status);
  end loop;
  return v_res;
end $$;

create or replace function public.prepare_email_invitation(p_event uuid, p_role public.member_role, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_inv jsonb; ev public.events; v_inviter text;
        v_target uuid; v_hint text; v_hash text; v_ei uuid; v_benef boolean := p_role = 'beneficiary';
begin
  if not public.is_manager(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or char_length(v_email) > 320 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if v_benef and public.beneficiary_slot_taken(p_event) then
    raise exception 'beneficiary_taken' using errcode = 'P0001';
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
    if public.is_blocked_between(auth.uid(), v_target) then
      return jsonb_build_object('status', 'queued');
    end if;
  end if;
  v_hint := left(split_part(v_email, '@', 1), 2) || '•••@' || split_part(v_email, '@', 2);
  v_inv := public.create_invitation_internal(p_event, p_role, 168, 1);
  update public.invitations set kind = 'email', email_hash = v_hash, email_hint = left(v_hint, 120)
  where id = (v_inv ->> 'id')::uuid;
  select * into ev from public.events where id = p_event;
  select display_name into v_inviter from public.profiles where id = auth.uid();
  insert into public.email_outbox (kind, to_email, event_id, payload, dedupe_key)
  values ('invitation', v_email, p_event,
    jsonb_build_object('token', v_inv ->> 'token',
                       -- Personne fêtée : ni titre ni prénom dans le message (rien des préparatifs).
                       'event_title', case when v_benef then null else ev.title end,
                       'beneficiary_name', case when v_benef then null else ev.beneficiary_name end,
                       'inviter_name', v_inviter, 'role', p_role, 'expires_at', v_inv ->> 'expires_at', 'personal', true),
    'invitation:' || (v_inv ->> 'id'));
  if v_target is not null then
    update public.event_invites set status = 'expired', responded_at = now()
    where event_id = p_event and invitee_id = v_target and status = 'pending' and expires_at <= now();
  end if;
  if v_target is not null and not exists (select 1 from public.event_invites where event_id = p_event and invitee_id = v_target and status = 'pending') then
    insert into public.event_invites (event_id, invitee_id, inviter_id, role, source, invitation_id, expires_at)
    values (p_event, v_target, auth.uid(), p_role, 'email', (v_inv ->> 'id')::uuid, (v_inv ->> 'expires_at')::timestamptz)
    returning id into v_ei;
    perform public.notify(v_target, null, 'event_invite',
      jsonb_build_object('invite_id', v_ei, 'from', auth.uid(), 'role', p_role, 'title', case when v_benef then null else ev.title end),
      'event_invite:' || v_ei);
  end if;
  return jsonb_build_object('status', 'queued', 'invitation_id', v_inv ->> 'id', 'expires_at', v_inv ->> 'expires_at');
end $$;

create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare inv public.invitations; v_uid uuid := auth.uid(); v_status text; ev public.events;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into inv from public.invitations where token_hash = public.hash_token(coalesce(p_token, '')) for update;
  if inv.id is null then return jsonb_build_object('status', 'invalid'); end if;
  -- Anciens liens génériques de bénéficiaire : inutilisables (accès récupérable par n'importe qui).
  if inv.role = 'beneficiary' and inv.kind <> 'email' then return jsonb_build_object('status', 'invalid'); end if;
  if inv.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  select * into ev from public.events where id = inv.event_id;
  if ev.status in ('cancelled', 'archived') then return jsonb_build_object('status', 'event_closed'); end if;
  if exists (select 1 from public.event_members where event_id = inv.event_id and user_id = v_uid and status = 'active') then
    return jsonb_build_object('status', case when (inv.role = 'beneficiary') <> (public.my_role(inv.event_id) = 'beneficiary') then 'role_conflict' else 'already_member' end,
                              'event_id', inv.event_id, 'role', public.my_role(inv.event_id));
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
  if inv.id is null or (inv.role = 'beneficiary' and inv.kind <> 'email') then return jsonb_build_object('status', 'invalid'); end if;
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
    'title', case when inv.role = 'beneficiary' then null else ev.title end,
    'beneficiary_name', case when inv.role = 'beneficiary' then null else ev.beneficiary_name end,
    'occasion', case when inv.role = 'beneficiary' then null else ev.occasion end,
    -- Personne fêtée : la date d'ouverture de sa capsule, pas celle des préparatifs.
    'gift_at', case when inv.role = 'beneficiary' then ev.reveal_at else ev.gift_at end, 'timezone', ev.timezone, 'organizer_name', v_org,
    'member_count', case when inv.role = 'beneficiary' then null else v_members end,
    'role', inv.role, 'expires_at', inv.expires_at);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Renvoyer une invitation (ami : nouvelle invitation ; e-mail : nouveau lien, l'ancien est révoqué)
-- ---------------------------------------------------------------------------
create or replace function public.resend_event_invitation(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare i public.event_invites; inv public.invitations; v_email text; v_event uuid; v_res jsonb;
begin
  select * into i from public.event_invites where id = p_id for update;
  if i.id is not null and i.invitation_id is null then
    -- Invitation d'un ami.
    if not public.is_manager(i.event_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    if i.status not in ('pending', 'expired', 'cancelled') then return jsonb_build_object('status', i.status); end if;
    if i.role = 'beneficiary' and public.beneficiary_slot_taken(i.event_id, i.id) then
      raise exception 'beneficiary_taken' using errcode = 'P0001';
    end if;
    update public.event_invites set status = 'cancelled', responded_at = now() where id = i.id and status = 'pending';
    delete from public.notifications where user_id = i.invitee_id and kind = 'event_invite' and data ->> 'invite_id' = i.id::text and read_at is null;
    if i.role = 'beneficiary' then
      return (public.invite_friends(i.event_id, array[i.invitee_id], 'beneficiary') -> 0);
    end if;
    return (public.invite_friends(i.event_id, array[i.invitee_id], i.role) -> 0);
  end if;
  -- Invitation par e-mail (rattachée ou non à un compte).
  select * into inv from public.invitations where id = coalesce(i.invitation_id, p_id) and kind = 'email' for update;
  if inv.id is null or not public.is_manager(inv.event_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if inv.use_count >= coalesce(inv.max_uses, 1) then return jsonb_build_object('status', 'accepted'); end if;
  select o.to_email into v_email from public.email_outbox o where o.dedupe_key = 'invitation:' || inv.id;
  if v_email is null then return jsonb_build_object('status', 'resend_unavailable'); end if;
  update public.invitations set revoked_at = coalesce(revoked_at, now()) where id = inv.id;
  update public.event_invites set status = 'cancelled', responded_at = now() where invitation_id = inv.id and status = 'pending';
  v_event := inv.event_id;
  v_res := public.prepare_email_invitation(v_event, inv.role, v_email);
  return v_res - 'invitation_id' || jsonb_build_object('status', v_res ->> 'status');
end $$;

-- ---------------------------------------------------------------------------
-- 4. La personne fêtée ne voit que la capsule
-- ---------------------------------------------------------------------------
-- Cadeau retenu : réservé aux préparateurs (la personne fêtée ne le voit plus, même après l'ouverture).
create or replace function public.revealed_gift(p_event uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_preparer(p_event) and p.id is not null then
    jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description, 'image_path', p.image_path) end
  from public.events e left join public.proposals p on p.id = e.selected_proposal_id
  where e.id = p_event
$$;

-- Médias : photos d'idées réservées aux préparateurs ; photos de capsule publiées et ouvertes seulement.
create or replace function public.can_read_media(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare f text[] := string_to_array(p_name, '/'); v_first uuid := public.try_uuid(f[1]);
begin
  if v_first is null then return false; end if;
  if f[2] = 'covers' then
    return v_first = auth.uid()
      or exists (select 1 from public.events e where e.cover_path = p_name and public.can_view_event(e.id));
  elsif f[2] = 'proposals' then
    return public.is_preparer(v_first);
  elsif f[2] = 'capsule' then
    return f[3] = auth.uid()::text
      or (public.is_revealed(v_first) and public.can_view_event(v_first)
          and exists (select 1 from public.capsule_entries c where c.event_id = v_first and c.photo_path = p_name and c.status = 'published'));
  end if;
  return false;
end $$;

-- Progression : rien des préparatifs pour la personne fêtée (ni idées, ni missions, ni votes, ni participation).
create or replace function public.event_progress(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ev public.events; v_preparers int; v_published int; v_tasks_done int; v_tasks int; v_steps jsonb; v_next text;
        v_voted boolean; v_contributed boolean; v_entry public.capsule_status; v_my_tasks int; v_open_tasks int;
        v_proposals int; v_my_proposals int; v_my_done int;
begin
  if not public.can_view_event(p_event) then return null; end if;
  if public.my_role(p_event) = 'beneficiary' then
    return jsonb_build_object(
      'steps', '[]'::jsonb, 'steps_done', 0, 'tasks_done', 0, 'tasks_total', 0, 'tasks_open', 0,
      'proposals', 0, 'my_proposals', 0, 'capsule_published', 0, 'preparers', 0, 'my_capsule', 'none',
      'voted', false, 'next_action', 'open_capsule', 'my_role', 'beneficiary',
      'votes_open', false, 'contributions_open', false, 'revealed', public.is_revealed(p_event));
  end if;
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
-- 5. Capsule de la personne fêtée : état, heure serveur, ouverture déjà vue
-- ---------------------------------------------------------------------------
alter table public.event_members add column capsule_opened_at timestamptz;

-- Avant l'ouverture : la date, l'heure du serveur et qui prépare (l'organisateur), rien d'autre
-- (ni titre, ni compteur, ni auteur). Après : le titre et la couverture de la cagnotte.
create or replace function public.beneficiary_capsule(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ev public.events; m public.event_members; v_open boolean;
begin
  select * into m from public.event_members where event_id = p_event and user_id = auth.uid() and status = 'active' and role = 'beneficiary';
  if m.user_id is null then return null; end if;
  select * into ev from public.events where id = p_event;
  if ev.status = 'cancelled' then return jsonb_build_object('state', 'cancelled', 'server_now', now()); end if;
  v_open := public.is_revealed(p_event);
  return jsonb_build_object(
    'event_id', ev.id,
    'state', case when v_open then 'open' else 'sealed' end,
    'reveal_at', ev.reveal_at, 'timezone', ev.timezone, 'server_now', now(),
    'organizer_name', (select p.display_name from public.event_members o join public.profiles p on p.id = o.user_id
                       where o.event_id = ev.id and o.role = 'organizer' and o.status = 'active'),
    'opened_at', m.capsule_opened_at,
    'title', case when v_open then ev.title end,
    'occasion', case when v_open then ev.occasion end,
    'cover_path', case when v_open then ev.cover_path end,
    'cover_art', case when v_open then ev.cover_art end);
end $$;

-- L'animation d'ouverture n'est jouée qu'une fois (sur tous les appareils).
create or replace function public.mark_capsule_opened(p_event uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v timestamptz;
begin
  if public.my_role(p_event) is distinct from 'beneficiary' or not public.is_revealed(p_event) then
    raise exception 'capsule_sealed' using errcode = 'P0001';
  end if;
  update public.event_members set capsule_opened_at = coalesce(capsule_opened_at, now())
  where event_id = p_event and user_id = auth.uid() returning capsule_opened_at into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------
revoke execute on function
  public.create_invitation_internal(uuid, public.member_role, integer, integer),
  public.beneficiary_slot_taken(uuid, uuid),
  public.create_invitation(uuid, public.member_role, integer, integer),
  public.join_event_as(uuid, uuid, public.member_role),
  public.invite_friends(uuid, uuid[], public.member_role),
  public.prepare_email_invitation(uuid, public.member_role, text),
  public.accept_invitation(text), public.preview_invitation(text),
  public.resend_event_invitation(uuid),
  public.revealed_gift(uuid), public.can_read_media(text), public.event_progress(uuid),
  public.beneficiary_capsule(uuid), public.mark_capsule_opened(uuid)
from public, anon, authenticated;

grant execute on function public.preview_invitation(text) to anon, authenticated;
grant execute on function
  public.create_invitation(uuid, public.member_role, integer, integer),
  public.invite_friends(uuid, uuid[], public.member_role),
  public.prepare_email_invitation(uuid, public.member_role, text),
  public.accept_invitation(text), public.resend_event_invitation(uuid),
  public.revealed_gift(uuid), public.event_progress(uuid),
  public.beneficiary_capsule(uuid), public.mark_capsule_opened(uuid)
to authenticated;
-- can_read_media est appelée par les politiques Storage (rôle authenticated).
grant execute on function public.can_read_media(text) to authenticated;
