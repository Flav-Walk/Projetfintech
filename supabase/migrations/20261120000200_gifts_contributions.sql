-- COMPLICE — propositions, votes, réactions, commentaires, contributions simulées.

create type public.proposal_status as enum ('active', 'withdrawn', 'unavailable');
create type public.contribution_status as enum ('pending', 'confirmed', 'failed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Propositions
-- ---------------------------------------------------------------------------
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 80),
  price_cents integer not null check (price_cents between 0 and 10000000),
  previous_price_cents integer,
  price_changed_at timestamptz,
  product_url text check (product_url is null or (product_url ~* '^https?://' and char_length(product_url) <= 1000)),
  description text check (description is null or char_length(description) <= 400),
  image_path text check (image_path is null or char_length(image_path) <= 300),
  status public.proposal_status not null default 'active',
  vote_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposals_event_idx on public.proposals (event_id);

alter table public.events
  add constraint events_selected_proposal_fk foreign key (selected_proposal_id) references public.proposals (id) on delete set null;

-- Garde-fous : l'auteur modifie le contenu, le gestionnaire peut marquer indisponible.
create or replace function public.proposals_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      new.vote_count := 0; new.status := 'active'; new.previous_price_cents := null; new.price_changed_at := null;
      new.author_id := auth.uid();
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
  return new;
end $$;
create trigger proposals_guard before insert or update on public.proposals
  for each row execute function public.proposals_guard();

-- ---------------------------------------------------------------------------
-- Votes : une voix par membre et par événement, modifiable jusqu'à la clôture.
-- ---------------------------------------------------------------------------
create table public.votes (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index votes_proposal_idx on public.votes (proposal_id);

-- Compteur dénormalisé recalculé depuis la table votes (jamais incrémenté à l'aveugle).
create or replace function public.votes_recount()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.proposals set vote_count = (select count(*) from public.votes where proposal_id = old.proposal_id) where id = old.proposal_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.proposals set vote_count = (select count(*) from public.votes where proposal_id = new.proposal_id) where id = new.proposal_id;
  end if;
  return null;
end $$;
create trigger votes_recount after insert or update or delete on public.votes
  for each row execute function public.votes_recount();

create or replace function public.cast_vote(p_proposal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.proposals; ev public.events;
begin
  select * into p from public.proposals where id = p_proposal;
  if p.id is null or not public.is_preparer(p.event_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into ev from public.events where id = p.event_id;
  if ev.status <> 'active' or now() >= ev.votes_close_at then raise exception 'votes_closed' using errcode = 'P0001'; end if;
  if p.status <> 'active' then raise exception 'proposal_not_active' using errcode = 'P0001'; end if;
  insert into public.votes (event_id, user_id, proposal_id) values (p.event_id, auth.uid(), p.id)
  on conflict (event_id, user_id) do update set proposal_id = excluded.proposal_id, updated_at = now()
  where public.votes.proposal_id <> excluded.proposal_id;
  perform public.award_badge(p.event_id, auth.uid(), 'voter');
end $$;

create or replace function public.clear_vote(p_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_preparer(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select now() >= votes_close_at from public.events where id = p_event) then raise exception 'votes_closed' using errcode = 'P0001'; end if;
  delete from public.votes where event_id = p_event and user_id = auth.uid();
end $$;

-- Retrait ou indisponibilité : les voix portées sont libérées pour que chacun revote.
create or replace function public.proposals_release_votes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'active' and old.status = 'active' then
    delete from public.votes where proposal_id = new.id;
  end if;
  return null;
end $$;
create trigger proposals_release_votes after update of status on public.proposals
  for each row execute function public.proposals_release_votes();

-- Classement : comptes visibles par le groupe ; égalité signalée ; jamais d'achat automatique.
create or replace function public.proposal_ranking(p_event uuid)
returns table (proposal_id uuid, vote_count integer, rank integer, tied boolean)
language sql stable security definer set search_path = '' as $$
  with ranked as (
    select id, vote_count, rank() over (order by vote_count desc)::int as rnk
    from public.proposals where event_id = p_event and status = 'active' and public.is_preparer(p_event)
  )
  select r.id, r.vote_count, r.rnk, (count(*) over (partition by r.rnk)) > 1 and r.vote_count > 0
  from ranked r order by r.rnk, r.vote_count desc
$$;

-- Choix explicite du cadeau par un gestionnaire, après ou avant clôture.
create or replace function public.select_gift(p_event uuid, p_proposal uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_manager(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_proposal is not null and not exists (select 1 from public.proposals where id = p_proposal and event_id = p_event and status = 'active') then
    raise exception 'invalid_proposal' using errcode = 'P0001';
  end if;
  update public.events set selected_proposal_id = p_proposal, gift_confirmed_at = case when p_proposal is null then null else now() end
  where id = p_event and status = 'active';
  insert into public.activity (event_id, actor_id, kind, data) values (p_event, auth.uid(), 'gift_selected', jsonb_build_object('proposal_id', p_proposal));
  insert into public.notifications (user_id, event_id, kind, data, dedupe_key)
  select m.user_id, p_event, 'gift_selected', jsonb_build_object('proposal_id', p_proposal), 'gift_selected:' || p_event || ':' || coalesce(p_proposal::text, 'none')
  from public.event_members m join public.notification_prefs np on np.user_id = m.user_id
  where m.event_id = p_event and m.status = 'active' and m.role <> 'beneficiary' and m.user_id <> auth.uid() and np.votes
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Réactions et commentaires
-- ---------------------------------------------------------------------------
create table public.proposal_reactions (
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😍', '😂', '🤔', '👎')),
  created_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

create table public.proposal_comments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index proposal_comments_idx on public.proposal_comments (proposal_id, created_at);

create or replace function public.proposal_event(p_proposal uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select event_id from public.proposals where id = p_proposal
$$;

-- ---------------------------------------------------------------------------
-- Contributions simulées (montants en centimes, idempotence par clé)
-- ---------------------------------------------------------------------------
create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  amount_cents integer not null check (amount_cents between 100 and 100000),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  total_cents integer generated always as (amount_cents + fee_cents) stored,
  currency text not null default 'EUR',
  status public.contribution_status not null default 'pending',
  provider text not null default 'simulated',
  provider_ref text,
  is_simulated boolean not null default true,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  failure_reason text,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (user_id, idempotency_key)
);
create index contributions_event_idx on public.contributions (event_id) where status = 'confirmed';

-- Total commun recalculé depuis les seules contributions confirmées.
create or replace function public.contributions_recount()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.events set collected_cents = (
    select coalesce(sum(amount_cents), 0) from public.contributions where event_id = coalesce(new.event_id, old.event_id) and status = 'confirmed'
  ) where id = coalesce(new.event_id, old.event_id);
  return null;
end $$;
create trigger contributions_recount after insert or update of status or delete on public.contributions
  for each row execute function public.contributions_recount();

-- Étape 1 (appelée par le backend avec le JWT de l'utilisateur) : intention de contribution.
-- La même clé d'idempotence renvoie la même ligne : un double clic ne crée rien de plus.
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
  insert into public.contributions (event_id, user_id, amount_cents, fee_cents, idempotency_key)
  values (p_event, auth.uid(), p_amount_cents, 0, p_idempotency_key)
  on conflict (user_id, idempotency_key) do nothing
  returning * into c;
  if c.id is null then
    select * into c from public.contributions where user_id = auth.uid() and idempotency_key = p_idempotency_key;
  end if;
  return c;
end $$;

-- Étape 2 (prestataire / webhook, clé service uniquement) : issue du paiement. Idempotente.
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
    insert into public.activity (event_id, actor_id, kind) values (c.event_id, c.user_id, 'contribution_confirmed');
    perform public.award_badge(c.event_id, c.user_id, 'contributor');
  end if;
  return c;
end $$;

-- Synthèse financière visible par le groupe : total et nombre de contributeurs, jamais les montants individuels.
create or replace function public.event_funding(p_event uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_preparer(p_event) then jsonb_build_object(
    'collected_cents', e.collected_cents, 'target_cents', e.target_cents,
    'contributor_count', (select count(distinct user_id) from public.contributions where event_id = p_event and status = 'confirmed'),
    'my_confirmed_cents', (select coalesce(sum(amount_cents), 0) from public.contributions where event_id = p_event and status = 'confirmed' and user_id = auth.uid())
  ) end
  from public.events e where e.id = p_event
$$;

-- Les gestionnaires voient qui a participé (pour remercier), sans les montants.
create or replace function public.event_contributors(p_event uuid)
returns table (user_id uuid) language sql stable security definer set search_path = '' as $$
  select distinct c.user_id from public.contributions c
  where c.event_id = p_event and c.status = 'confirmed' and c.user_id is not null and public.is_manager(p_event)
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.proposals enable row level security;
alter table public.votes enable row level security;
alter table public.proposal_reactions enable row level security;
alter table public.proposal_comments enable row level security;
alter table public.contributions enable row level security;

create policy proposals_select on public.proposals for select to authenticated
  using (public.is_preparer(event_id)
         or (public.can_view_event(event_id) and id = (select selected_proposal_id from public.events where id = event_id)));
create policy proposals_insert on public.proposals for insert to authenticated
  with check (public.is_preparer(event_id) and author_id = auth.uid()
              and exists (select 1 from public.events e where e.id = event_id and e.status = 'active' and now() < e.votes_close_at));
create policy proposals_update on public.proposals for update to authenticated
  using (public.is_preparer(event_id) and (author_id = auth.uid() or public.is_manager(event_id)))
  with check (public.is_preparer(event_id));

-- Identité des votants : la sienne toujours ; celle des autres seulement si l'événement l'a rendue publique.
create policy votes_select on public.votes for select to authenticated
  using (user_id = auth.uid()
         or (public.is_preparer(event_id) and exists (select 1 from public.events e where e.id = event_id and e.vote_visibility = 'public')));

create policy reactions_select on public.proposal_reactions for select to authenticated using (public.is_preparer(public.proposal_event(proposal_id)));
create policy reactions_insert on public.proposal_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_preparer(public.proposal_event(proposal_id)));
create policy reactions_update on public.proposal_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_preparer(public.proposal_event(proposal_id)));
create policy reactions_delete on public.proposal_reactions for delete to authenticated using (user_id = auth.uid());

create policy comments_select on public.proposal_comments for select to authenticated using (public.is_preparer(public.proposal_event(proposal_id)));
create policy comments_insert on public.proposal_comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_preparer(public.proposal_event(proposal_id)));
create policy comments_delete on public.proposal_comments for delete to authenticated using (author_id = auth.uid());

-- Montants individuels : chacun ne voit que les siens.
create policy contributions_select on public.contributions for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Privilèges
-- ---------------------------------------------------------------------------
revoke all on public.proposals, public.votes, public.proposal_reactions, public.proposal_comments, public.contributions from anon;
revoke insert, update, delete on public.votes, public.contributions from authenticated;
revoke update on public.proposals from authenticated;
grant update (title, price_cents, product_url, description, image_path, status) on public.proposals to authenticated;
revoke delete on public.proposals from authenticated;
revoke update on public.proposal_comments from authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.preview_invitation(text) to anon, authenticated;
grant execute on function public.cast_vote(uuid), public.clear_vote(uuid), public.proposal_ranking(uuid),
  public.select_gift(uuid, uuid), public.proposal_event(uuid), public.contribution_create(uuid, integer, text),
  public.event_funding(uuid), public.event_contributors(uuid) to authenticated;
grant execute on function public.contribution_settle(uuid, boolean, text, text) to service_role;
