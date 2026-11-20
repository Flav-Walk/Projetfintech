-- COMPLICE — compléments MVP : rappels planifiés, notifications de discussion,
-- création de mission par RPC, contrôle du chemin des images de proposition.

-- ---------------------------------------------------------------------------
-- 1. Images de proposition : chemin imposé {event}/proposals/{auteur}/{fichier}.
--    Empêche de référencer la photo d'un autre événement pour la rendre lisible.
-- ---------------------------------------------------------------------------
create or replace function public.proposals_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      new.vote_count := 0; new.status := 'active'; new.previous_price_cents := null; new.price_changed_at := null;
      new.author_id := auth.uid();
      if new.image_path is not null and new.image_path not like new.event_id::text || '/proposals/' || auth.uid()::text || '/%' then
        raise exception 'invalid_image_path' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;
  new.updated_at := now();
  if new.price_cents is distinct from old.price_cents then
    new.previous_price_cents := old.price_cents;
    new.price_changed_at := now();
  end if;
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if new.vote_count is distinct from old.vote_count or new.event_id is distinct from old.event_id
     or new.author_id is distinct from old.author_id then
    raise exception 'protected_column' using errcode = '42501';
  end if;
  if old.author_id is distinct from auth.uid() then
    -- Un gestionnaire non auteur ne peut que changer le statut (indisponible / actif).
    if new.title is distinct from old.title or new.price_cents is distinct from old.price_cents
       or new.product_url is distinct from old.product_url or new.description is distinct from old.description
       or new.image_path is distinct from old.image_path or new.status = 'withdrawn' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  if new.image_path is distinct from old.image_path and new.image_path is not null
     and new.image_path not like new.event_id::text || '/proposals/' || auth.uid()::text || '/%' then
    raise exception 'invalid_image_path' using errcode = 'P0001';
  end if;
  -- Une proposition retirée ne revient pas (les voix ont été libérées).
  if old.status = 'withdrawn' and new.status <> 'withdrawn' then
    raise exception 'proposal_withdrawn' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Un non-membre obtenait NULL (refus de fait en RLS) : on renvoie explicitement false.
create or replace function public.can_view_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_preparer(p_event)
      or coalesce(public.my_role(p_event) = 'beneficiary' and public.is_revealed(p_event), false)
$$;

-- ---------------------------------------------------------------------------
-- 2. Missions : création par un gestionnaire (auteur fixé côté serveur, attribution facultative).
-- ---------------------------------------------------------------------------
create or replace function public.create_task(p_event uuid, p_title text, p_due_at timestamptz default null, p_assignee uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_manager(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select status from public.events where id = p_event) <> 'active' then raise exception 'event_locked' using errcode = 'P0001'; end if;
  insert into public.tasks (event_id, title, kind, due_at, position, created_by)
  values (p_event, trim(p_title), 'custom', p_due_at,
          coalesce((select max(position) from public.tasks where event_id = p_event), 0) + 1, auth.uid())
  returning id into v_id;
  if p_assignee is not null then
    perform public.assign_task(v_id, p_assignee);
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Discussion : notification aux autres préparateurs (préférence « messages »),
--    au plus une par heure et par événement pour ne pas inonder.
-- ---------------------------------------------------------------------------
create or replace function public.messages_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(m.user_id, new.event_id, 'message', jsonb_build_object('author_id', new.author_id),
                        'message:' || new.event_id || ':' || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'))
  from public.event_members m
  where m.event_id = new.event_id and m.status = 'active' and m.role <> 'beneficiary'
    and m.user_id is distinct from new.author_id;
  return null;
end $$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.messages_notify();

-- ---------------------------------------------------------------------------
-- 4. Rappels planifiés, idempotents (dedupe_key) et soumis aux préférences.
--    - vote_closing : vote qui se termine dans moins de 24 h, aucun cadeau choisi,
--      envoyé aux préparateurs qui n'ont pas encore voté.
--    - capsule_open : capsule ouverte depuis moins de 7 jours, envoyé à tous les membres.
--    p_user non nul : limite le traitement aux événements de cet utilisateur.
-- ---------------------------------------------------------------------------
create or replace function public.run_due_reminders(p_user uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_total integer := 0; v_rows integer;
begin
  insert into public.notifications (user_id, event_id, kind, data, dedupe_key)
  select m.user_id, e.id, 'vote_closing',
         jsonb_build_object('title', e.title, 'votes_close_at', e.votes_close_at),
         'vote_closing:' || e.id
  from public.events e
  join public.event_members m on m.event_id = e.id and m.status = 'active' and m.role <> 'beneficiary'
  join public.notification_prefs np on np.user_id = m.user_id and np.votes
  where e.status = 'active' and e.selected_proposal_id is null
    and now() < e.votes_close_at and e.votes_close_at <= now() + interval '24 hours'
    and not exists (select 1 from public.votes v where v.event_id = e.id and v.user_id = m.user_id)
    and (p_user is null or exists (select 1 from public.event_members x where x.event_id = e.id and x.user_id = p_user and x.status = 'active'))
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  insert into public.notifications (user_id, event_id, kind, data, dedupe_key)
  select m.user_id, e.id, 'capsule_open',
         jsonb_build_object('title', e.title, 'beneficiary_name', e.beneficiary_name),
         'capsule_open:' || e.id
  from public.events e
  join public.event_members m on m.event_id = e.id and m.status = 'active'
  join public.notification_prefs np on np.user_id = m.user_id and np.capsule
  where e.status in ('active', 'revealed') and now() >= e.reveal_at and e.reveal_at > now() - interval '7 days'
    and (p_user is null or exists (select 1 from public.event_members x where x.event_id = e.id and x.user_id = p_user and x.status = 'active'))
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;

  return v_total;
end $$;

-- Déclenchement par l'app (ouverture, retour au premier plan) : filet de sécurité sans planificateur.
create or replace function public.refresh_reminders()
returns integer language sql security definer set search_path = '' as $$
  select case when auth.uid() is null then 0 else public.run_due_reminders(auth.uid()) end
$$;

-- Planification dans la base si pg_cron est disponible (Supabase : oui). Sinon, l'app et le
-- backend restent les déclencheurs. Un échec ici n'annule pas la migration.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('complice-reminders', '*/10 * * * *', 'select public.run_due_reminders()');
    exception when others then
      raise notice 'pg_cron non configuré (%) : rappels déclenchés par l''app.', sqlerrm;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Droits (fermés par défaut depuis 20261120000500)
-- ---------------------------------------------------------------------------
revoke execute on function public.create_task(uuid, text, timestamptz, uuid), public.messages_notify(),
  public.run_due_reminders(uuid), public.refresh_reminders() from public, anon, authenticated;
grant execute on function public.create_task(uuid, text, timestamptz, uuid), public.refresh_reminders() to authenticated;
grant execute on function public.run_due_reminders(uuid) to service_role;
