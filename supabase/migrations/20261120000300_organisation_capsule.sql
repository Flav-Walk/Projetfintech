-- COMPLICE — missions, discussion, capsule, badges (timbres), étapes collectives.

create type public.task_status as enum ('open', 'claimed', 'done');
create type public.capsule_status as enum ('draft', 'published');
create type public.badge_kind as enum ('proposer', 'voter', 'helper', 'wordsmith', 'contributor', 'host');

-- ---------------------------------------------------------------------------
-- Badges : clé primaire = attribution unique par membre, événement et type.
-- Supprimer puis recréer l'action ne redonne rien (ON CONFLICT DO NOTHING, jamais de retrait).
-- ---------------------------------------------------------------------------
create table public.user_badges (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge public.badge_kind not null,
  awarded_at timestamptz not null default now(),
  primary key (event_id, user_id, badge)
);

create or replace function public.award_badge(p_event uuid, p_user uuid, p_badge public.badge_kind)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_rows integer;
begin
  if p_user is null then return false; end if;
  insert into public.user_badges (event_id, user_id, badge) values (p_event, p_user, p_badge) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    insert into public.activity (event_id, actor_id, kind, data) values (p_event, p_user, 'badge_awarded', jsonb_build_object('badge', p_badge));
  end if;
  return v_rows > 0;
end $$;

-- ---------------------------------------------------------------------------
-- Missions
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 80),
  kind text not null default 'custom' check (kind in ('order', 'pickup', 'wrap', 'card', 'handover', 'custom')),
  due_at timestamptz,
  assignee_id uuid references public.profiles (id) on delete set null,
  status public.task_status not null default 'open',
  position integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_assignee_status check ((status = 'open') = (assignee_id is null) or status = 'done')
);
create index tasks_event_idx on public.tasks (event_id, position);

create or replace function public.events_default_tasks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.tasks (event_id, title, kind, position, created_by) values
    (new.id, 'Commander le cadeau', 'order', 1, new.created_by),
    (new.id, 'Récupérer le cadeau', 'pickup', 2, new.created_by),
    (new.id, 'Emballer le cadeau', 'wrap', 3, new.created_by),
    (new.id, 'Préparer la carte', 'card', 4, new.created_by),
    (new.id, 'Remettre le cadeau', 'handover', 5, new.created_by);
  return null;
end $$;
create trigger events_default_tasks after insert on public.events
  for each row execute function public.events_default_tasks();

-- Prise atomique : la condition "libre" est dans l'UPDATE, un seul des deux concurrents gagne.
create or replace function public.claim_task(p_task uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task;
  if t.id is null or not public.is_preparer(t.event_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.tasks set assignee_id = auth.uid(), status = 'claimed', updated_at = now()
  where id = p_task and status = 'open' and assignee_id is null
  returning * into t;
  if t.id is null then
    select * into t from public.tasks where id = p_task;
    return jsonb_build_object('status', case when t.assignee_id = auth.uid() then 'already_yours' else 'taken' end, 'assignee_id', t.assignee_id);
  end if;
  insert into public.activity (event_id, actor_id, kind, data) values (t.event_id, auth.uid(), 'task_claimed', jsonb_build_object('task_id', t.id, 'title', t.title));
  return jsonb_build_object('status', 'claimed');
end $$;

create or replace function public.complete_task(p_task uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task for update;
  if t.id is null or not public.is_preparer(t.event_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if t.status = 'done' then return; end if;
  if t.assignee_id is distinct from auth.uid() and not public.is_manager(t.event_id) then raise exception 'not_assignee' using errcode = '42501'; end if;
  update public.tasks set status = 'done', completed_at = now(), assignee_id = coalesce(assignee_id, auth.uid()), updated_at = now() where id = p_task;
  insert into public.activity (event_id, actor_id, kind, data) values (t.event_id, auth.uid(), 'task_done', jsonb_build_object('task_id', t.id, 'title', t.title));
  perform public.award_badge(t.event_id, coalesce(t.assignee_id, auth.uid()), 'helper');
end $$;

create or replace function public.release_task(p_task uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task for update;
  if t.id is null or not public.is_preparer(t.event_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if t.status = 'done' and not public.is_manager(t.event_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if t.assignee_id is distinct from auth.uid() and not public.is_manager(t.event_id) then raise exception 'not_assignee' using errcode = '42501'; end if;
  update public.tasks set status = 'open', assignee_id = null, completed_at = null, updated_at = now() where id = p_task;
end $$;

-- Réattribution par un gestionnaire (vers un membre préparateur actif).
create or replace function public.assign_task(p_task uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task for update;
  if t.id is null or not public.is_manager(t.event_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.event_members where event_id = t.event_id and user_id = p_user and status = 'active' and role <> 'beneficiary') then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  update public.tasks set assignee_id = p_user, status = 'claimed', completed_at = null, updated_at = now() where id = p_task;
  if p_user <> auth.uid() then
    perform public.notify(p_user, t.event_id, 'task_assigned', jsonb_build_object('task_id', t.id, 'title', t.title), 'task_assigned:' || t.id || ':' || p_user || ':' || extract(epoch from now())::bigint / 3600);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Discussion privée (préparateurs uniquement ; le bénéficiaire n'y a jamais accès)
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  client_id text check (client_id is null or char_length(client_id) <= 64),
  created_at timestamptz not null default now(),
  unique (author_id, client_id)
);
create index messages_event_idx on public.messages (event_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Capsule : un mot par membre et par événement ; brouillon privé, publication scellée
-- jusqu'au dévoilement. Seul l'auteur voit son contenu avant l'ouverture.
-- ---------------------------------------------------------------------------
create table public.capsule_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text check (body is null or char_length(body) <= 1000),
  photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  status public.capsule_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, author_id),
  constraint capsule_not_empty check (status = 'draft' or coalesce(char_length(trim(body)), 0) > 0 or photo_path is not null)
);

create or replace function public.capsule_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if current_user in ('authenticated', 'anon') then
    if public.is_revealed(new.event_id) then raise exception 'capsule_sealed' using errcode = 'P0001'; end if;
    if new.photo_path is not null and new.photo_path not like new.event_id::text || '/capsule/' || auth.uid()::text || '/%' then
      raise exception 'invalid_photo_path' using errcode = 'P0001';
    end if;
    if tg_op = 'UPDATE' and new.author_id is distinct from old.author_id then raise exception 'protected_column' using errcode = '42501'; end if;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status = 'draft') then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end $$;
create trigger capsule_guard before insert or update on public.capsule_entries
  for each row execute function public.capsule_guard();

create or replace function public.capsule_award()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' then perform public.award_badge(new.event_id, new.author_id, 'wordsmith'); end if;
  return null;
end $$;
create trigger capsule_award after insert or update of status on public.capsule_entries
  for each row execute function public.capsule_award();

create or replace function public.proposals_award()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.award_badge(new.event_id, new.author_id, 'proposer');
  insert into public.activity (event_id, actor_id, kind, data) values (new.event_id, new.author_id, 'proposal_added', jsonb_build_object('proposal_id', new.id, 'title', new.title));
  return null;
end $$;
create trigger proposals_award after insert on public.proposals
  for each row execute function public.proposals_award();

-- Compteurs scellés visibles par le groupe (sans contenu).
create or replace function public.capsule_stats(p_event uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.can_view_event(p_event) then jsonb_build_object(
    'words', count(*) filter (where status = 'published' and coalesce(char_length(trim(body)), 0) > 0),
    'photos', count(*) filter (where status = 'published' and photo_path is not null),
    'authors', count(*) filter (where status = 'published')
  ) end
  from public.capsule_entries where event_id = p_event
$$;

-- ---------------------------------------------------------------------------
-- Étapes collectives (calculées, jamais saisies) et prochaine action personnelle.
-- Groupe : au moins 2 préparateurs. Vote : cadeau choisi. Achat : mission "Commander" terminée.
-- Capsule : au moins un mot publié par la moitié des préparateurs. Jour J : dévoilement.
-- ---------------------------------------------------------------------------
create or replace function public.event_progress(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ev public.events; v_preparers int; v_published int; v_tasks_done int; v_tasks int; v_steps jsonb; v_next text; v_voted boolean; v_contributed boolean; v_entry public.capsule_status; v_my_tasks int;
begin
  if not public.can_view_event(p_event) then return null; end if;
  select * into ev from public.events where id = p_event;
  select count(*) into v_preparers from public.event_members where event_id = p_event and status = 'active' and role <> 'beneficiary';
  select count(*) into v_published from public.capsule_entries where event_id = p_event and status = 'published';
  select count(*) filter (where status = 'done'), count(*) into v_tasks_done, v_tasks from public.tasks where event_id = p_event;
  select exists (select 1 from public.votes where event_id = p_event and user_id = auth.uid()) into v_voted;
  select exists (select 1 from public.contributions where event_id = p_event and user_id = auth.uid() and status = 'confirmed') into v_contributed;
  select status into v_entry from public.capsule_entries where event_id = p_event and author_id = auth.uid();
  select count(*) into v_my_tasks from public.tasks where event_id = p_event and assignee_id = auth.uid() and status = 'claimed';

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
    when not v_voted and now() < ev.votes_close_at and ev.selected_proposal_id is null then 'vote'
    when public.is_manager(p_event) and ev.selected_proposal_id is null and now() >= ev.votes_close_at then 'select_gift'
    when not v_contributed and now() < ev.contributions_close_at then 'contribute'
    when v_my_tasks > 0 then 'finish_task'
    when v_entry is distinct from 'published' then 'write_capsule'
    else 'wait_reveal' end;

  return jsonb_build_object(
    'steps', v_steps,
    'steps_done', (select count(*) from jsonb_array_elements(v_steps) s where (s ->> 'done')::boolean),
    'tasks_done', v_tasks_done, 'tasks_total', v_tasks,
    'next_action', v_next, 'my_role', public.my_role(p_event),
    'votes_open', ev.status = 'active' and now() < ev.votes_close_at,
    'contributions_open', ev.status = 'active' and now() < ev.contributions_close_at,
    'revealed', public.is_revealed(p_event));
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.user_badges enable row level security;
alter table public.tasks enable row level security;
alter table public.messages enable row level security;
alter table public.capsule_entries enable row level security;

create policy badges_select on public.user_badges for select to authenticated using (user_id = auth.uid() or public.is_preparer(event_id));

create policy tasks_select on public.tasks for select to authenticated using (public.is_preparer(event_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_manager(event_id) and status = 'open' and assignee_id is null);
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_manager(event_id)) with check (public.is_manager(event_id));
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_manager(event_id));

create policy messages_select on public.messages for select to authenticated using (public.is_preparer(event_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_preparer(event_id));

create policy capsule_select on public.capsule_entries for select to authenticated
  using (author_id = auth.uid() or (status = 'published' and public.is_revealed(event_id) and public.can_view_event(event_id)));
create policy capsule_insert on public.capsule_entries for insert to authenticated
  with check (author_id = auth.uid() and public.is_preparer(event_id));
create policy capsule_update on public.capsule_entries for update to authenticated
  using (author_id = auth.uid() and public.is_preparer(event_id)) with check (author_id = auth.uid());
create policy capsule_delete on public.capsule_entries for delete to authenticated
  using (author_id = auth.uid() and not public.is_revealed(event_id));

-- ---------------------------------------------------------------------------
-- Privilèges
-- ---------------------------------------------------------------------------
revoke all on public.user_badges, public.tasks, public.messages, public.capsule_entries from anon;
revoke insert, update, delete on public.user_badges from authenticated;
revoke update on public.tasks from authenticated;
grant update (title, due_at, position) on public.tasks to authenticated;
revoke update, delete on public.messages from authenticated;
revoke update on public.capsule_entries from authenticated;
grant update (body, photo_path, status) on public.capsule_entries to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.preview_invitation(text) to anon, authenticated;
grant execute on function public.claim_task(uuid), public.complete_task(uuid), public.release_task(uuid),
  public.assign_task(uuid, uuid), public.capsule_stats(uuid), public.event_progress(uuid) to authenticated;
