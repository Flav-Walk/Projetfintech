-- Migration 10 : e-mails métier (file d'envoi), remerciements du bénéficiaire, préférence e-mail,
-- missions par défaut selon l'occasion.
--
-- E-mails métier : la base prépare les messages dans `email_outbox` ; l'API (clé secrète) les envoie via
-- Brevo, avec 3 tentatives au plus. Les e-mails de compte (confirmation, mot de passe) restent gérés par
-- Supabase Auth (SMTP Brevo), jamais par cette file. Aucun e-mail marketing.

-- ---------------------------------------------------------------------------
-- 1. Préférence : recevoir aussi certains avis par e-mail (ouverture de la capsule)
-- ---------------------------------------------------------------------------
alter table public.notification_prefs add column emails boolean not null default true;
grant update (emails) on public.notification_prefs to authenticated;

-- ---------------------------------------------------------------------------
-- 2. File d'e-mails métier
-- ---------------------------------------------------------------------------
create table public.email_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('invitation', 'capsule_open')),
  to_email text not null check (char_length(to_email) between 3 and 320),
  user_id uuid references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  payload jsonb not null default '{}',
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_due_idx on public.email_outbox (next_attempt_at) where status = 'pending';
create index email_outbox_event_idx on public.email_outbox (event_id);
create index email_outbox_user_idx on public.email_outbox (user_id);
alter table public.email_outbox enable row level security;
-- Aucune politique, aucun droit client : adresses et jetons ne sortent jamais vers l'app.
revoke all on public.email_outbox from anon, authenticated;
grant select, insert, update, delete on public.email_outbox to service_role;

-- Réservation atomique d'un lot (aucun envoi en double entre deux instances de l'API).
-- Une ligne restée « sending » plus de 15 min (instance arrêtée) redevient disponible.
create or replace function public.claim_email_batch(p_limit integer default 20)
returns setof public.email_outbox language plpgsql security definer set search_path = '' as $$
begin
  update public.email_outbox set status = 'pending'
  where status = 'sending' and next_attempt_at < now() - interval '15 minutes';
  -- Ménage : pas de conservation inutile des adresses.
  delete from public.email_outbox where status in ('sent', 'failed') and created_at < now() - interval '30 days';
  return query
  update public.email_outbox o set status = 'sending', attempts = o.attempts + 1, next_attempt_at = now()
  where o.id in (
    select id from public.email_outbox
    where status = 'pending' and next_attempt_at <= now() and attempts < 3
    order by next_attempt_at
    limit greatest(1, least(coalesce(p_limit, 20), 50))
    for update skip locked)
  returning o.*;
end $$;

-- Résultat d'un envoi : envoyé, ou nouvelle tentative différée (5, 20 min), abandon après 3 essais.
-- Le jeton d'invitation est effacé dès qu'il n'est plus utile.
-- p_final : erreur définitive (adresse refusée, données incomplètes) : abandon sans nouvel essai.
create or replace function public.complete_email(p_id bigint, p_ok boolean, p_provider_id text, p_error text, p_final boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.email_outbox;
begin
  select * into r from public.email_outbox where id = p_id for update;
  if r.id is null or r.status <> 'sending' then return; end if;
  if p_ok then
    update public.email_outbox set status = 'sent', sent_at = now(), provider_message_id = left(p_provider_id, 200),
      last_error = null, payload = payload - 'token' where id = p_id;
  elsif r.attempts >= 3 or coalesce(p_final, false) then
    update public.email_outbox set status = 'failed', last_error = left(p_error, 300), payload = payload - 'token' where id = p_id;
  else
    update public.email_outbox set status = 'pending', last_error = left(p_error, 300),
      next_attempt_at = now() + case r.attempts when 1 then interval '5 minutes' else interval '20 minutes' end
    where id = p_id;
  end if;
end $$;

-- Invitation par e-mail : un gestionnaire crée un lien à usage unique et l'e-mail part en file.
-- Même adresse pour le même événement dans l'heure : rien de plus (évite les doublons).
create or replace function public.prepare_email_invitation(p_event uuid, p_role public.member_role, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_inv jsonb; ev public.events; v_inviter text;
begin
  if not public.is_manager(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or char_length(v_email) > 320 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.email_outbox where event_id = p_event and kind = 'invitation' and to_email = v_email
             and created_at > now() - interval '1 hour') then
    return jsonb_build_object('status', 'already_sent');
  end if;
  if (select count(*) from public.email_outbox where event_id = p_event and kind = 'invitation'
      and created_at > now() - interval '24 hours') >= 50 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_inv := public.create_invitation(p_event, p_role, 168, 1);
  select * into ev from public.events where id = p_event;
  select display_name into v_inviter from public.profiles where id = auth.uid();
  insert into public.email_outbox (kind, to_email, event_id, payload, dedupe_key)
  values ('invitation', v_email, p_event,
    jsonb_build_object('token', v_inv ->> 'token', 'event_title', ev.title, 'beneficiary_name', ev.beneficiary_name,
                       'inviter_name', v_inviter, 'role', p_role, 'expires_at', v_inv ->> 'expires_at'),
    'invitation:' || (v_inv ->> 'id'));
  return jsonb_build_object('status', 'queued', 'invitation_id', v_inv ->> 'id', 'expires_at', v_inv ->> 'expires_at');
end $$;

-- Ouverture de la capsule : un e-mail pour chaque notification « capsule_open » d'une personne qui
-- accepte les e-mails (la notification respecte déjà la préférence « capsule »). Une seule fois.
create or replace function public.notifications_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_email text; ev public.events;
begin
  if new.kind <> 'capsule_open' then return null; end if;
  if not exists (select 1 from public.notification_prefs where user_id = new.user_id and emails) then return null; end if;
  select email into v_email from auth.users where id = new.user_id;
  if v_email is null then return null; end if;
  select * into ev from public.events where id = new.event_id;
  insert into public.email_outbox (kind, to_email, user_id, event_id, payload, dedupe_key)
  values ('capsule_open', v_email, new.user_id, new.event_id,
    jsonb_build_object('event_title', ev.title, 'beneficiary_name', ev.beneficiary_name,
                       'is_beneficiary', public.my_role_of(new.event_id, new.user_id) = 'beneficiary',
                       'display_name', (select display_name from public.profiles where id = new.user_id)),
    'capsule_open:' || new.event_id || ':' || new.user_id)
  on conflict (dedupe_key) do nothing;
  return null;
end $$;

-- Rôle d'un membre donné (usage interne : déclencheurs et tâches planifiées, sans auth.uid()).
create or replace function public.my_role_of(p_event uuid, p_user uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select role from public.event_members where event_id = p_event and user_id = p_user and status = 'active'
$$;

create trigger notifications_email after insert on public.notifications
  for each row execute function public.notifications_email();

-- Réveil de l'API quand des e-mails attendent (le plan gratuit de Render s'endort) : pg_net appelle
-- /internal/outbox/drain toutes les 5 minutes, seulement s'il y a quelque chose à envoyer.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      create extension if not exists pg_net;
      perform cron.schedule('complice-email-outbox', '*/5 * * * *',
        $job$select net.http_post(url := 'https://complice-api.onrender.com/internal/outbox/drain',
               body := '{}'::jsonb, headers := '{"content-type":"application/json"}'::jsonb)
             where exists (select 1 from public.email_outbox where status = 'pending' and next_attempt_at <= now())$job$);
    exception when others then
      raise notice 'Réveil de l''API non planifié (%) : les e-mails partiront au prochain réveil de l''API.', sqlerrm;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Remerciements du bénéficiaire, après l'ouverture
-- ---------------------------------------------------------------------------
create table public.event_thanks (
  event_id uuid primary key references public.events (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.event_thanks enable row level security;
create policy thanks_select on public.event_thanks for select to authenticated
  using (public.can_view_event(event_id));
create policy thanks_insert on public.event_thanks for insert to authenticated
  with check (author_id = (select auth.uid()) and public.my_role(event_id) = 'beneficiary' and public.is_revealed(event_id));
create policy thanks_update on public.event_thanks for update to authenticated
  using (author_id = (select auth.uid()) and public.my_role(event_id) = 'beneficiary')
  with check (author_id = (select auth.uid()));
revoke all on public.event_thanks from anon, authenticated;
grant select on public.event_thanks to authenticated;
grant insert (event_id, author_id, body) on public.event_thanks to authenticated;
grant update (body) on public.event_thanks to authenticated;
grant select, insert, update, delete on public.event_thanks to service_role;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('invitation', 'vote_closing', 'task_assigned', 'capsule_open', 'gift_selected', 'member_joined', 'message', 'thanks'));

create or replace function public.event_thanks_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    insert into public.activity (event_id, actor_id, kind) values (new.event_id, new.author_id, 'thanks_posted');
    insert into public.notifications (user_id, event_id, kind, data, dedupe_key)
    select m.user_id, new.event_id, 'thanks', jsonb_build_object('title', e.title), 'thanks:' || new.event_id
    from public.event_members m join public.events e on e.id = m.event_id
    join public.notification_prefs np on np.user_id = m.user_id and np.capsule
    where m.event_id = new.event_id and m.status = 'active' and m.role <> 'beneficiary'
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end $$;
create trigger event_thanks_after before insert or update on public.event_thanks
  for each row execute function public.event_thanks_after();

-- ---------------------------------------------------------------------------
-- 4. Missions par défaut selon l'occasion (toujours modifiables ensuite par un gestionnaire)
-- ---------------------------------------------------------------------------
create or replace function public.events_default_tasks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.occasion = 'départ' then
    insert into public.tasks (event_id, title, kind, position, created_by) values
      (new.id, 'Commander le cadeau', 'order', 1, new.created_by),
      (new.id, 'Récupérer le cadeau', 'pickup', 2, new.created_by),
      (new.id, 'Faire signer la carte par l’équipe', 'card', 3, new.created_by),
      (new.id, 'Organiser le pot de départ', 'custom', 4, new.created_by),
      (new.id, 'Remettre le cadeau', 'handover', 5, new.created_by);
  elsif new.occasion = 'naissance' then
    insert into public.tasks (event_id, title, kind, position, created_by) values
      (new.id, 'Commander le cadeau', 'order', 1, new.created_by),
      (new.id, 'Récupérer le cadeau', 'pickup', 2, new.created_by),
      (new.id, 'Préparer la carte', 'card', 3, new.created_by),
      (new.id, 'Convenir d’un moment avec les parents', 'custom', 4, new.created_by),
      (new.id, 'Remettre le cadeau', 'handover', 5, new.created_by);
  else
    insert into public.tasks (event_id, title, kind, position, created_by) values
      (new.id, 'Commander le cadeau', 'order', 1, new.created_by),
      (new.id, 'Récupérer le cadeau', 'pickup', 2, new.created_by),
      (new.id, 'Emballer le cadeau', 'wrap', 3, new.created_by),
      (new.id, 'Préparer la carte', 'card', 4, new.created_by),
      (new.id, 'Remettre le cadeau', 'handover', 5, new.created_by);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Droits des fonctions (fermées par défaut depuis 20261120000500)
-- ---------------------------------------------------------------------------
revoke execute on function public.claim_email_batch(integer), public.complete_email(bigint, boolean, text, text, boolean),
  public.prepare_email_invitation(uuid, public.member_role, text), public.notifications_email(),
  public.my_role_of(uuid, uuid), public.event_thanks_after() from public, anon, authenticated;
grant execute on function public.claim_email_batch(integer), public.complete_email(bigint, boolean, text, text, boolean) to service_role;
grant execute on function public.prepare_email_invitation(uuid, public.member_role, text) to authenticated;
