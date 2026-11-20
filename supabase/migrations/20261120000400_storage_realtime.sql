-- COMPLICE — Storage privé (URL signées courtes, jamais d'URL publique permanente) et Realtime.
--
-- Arborescence imposée :
--   avatars      : {user_id}/{fichier}
--   event-media  : {user_id}/covers/{fichier}                 (couverture, avant création de l'événement)
--                  {event_id}/proposals/{user_id}/{fichier}    (photo de proposition)
--                  {event_id}/capsule/{user_id}/{fichier}      (photo de capsule, scellée)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('event-media', 'event-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create or replace function public.can_read_media(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare f text[] := string_to_array(p_name, '/'); v_first uuid := public.try_uuid(f[1]);
begin
  if v_first is null then return false; end if;
  if f[2] = 'covers' then
    return v_first = auth.uid()
      or exists (select 1 from public.events e where e.cover_path = p_name and public.can_view_event(e.id));
  elsif f[2] = 'proposals' then
    return public.is_preparer(v_first)
      or exists (select 1 from public.proposals p join public.events e on e.selected_proposal_id = p.id
                 where p.image_path = p_name and public.can_view_event(e.id));
  elsif f[2] = 'capsule' then
    return f[3] = auth.uid()::text
      or (public.is_revealed(v_first) and public.can_view_event(v_first)
          and exists (select 1 from public.capsule_entries c where c.photo_path = p_name and c.status = 'published'));
  end if;
  return false;
end $$;

create or replace function public.can_write_media(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare f text[] := string_to_array(p_name, '/'); v_first uuid := public.try_uuid(f[1]);
begin
  if v_first is null or array_length(f, 1) < 3 then return false; end if;
  if f[2] = 'covers' then
    return v_first = auth.uid() and array_length(f, 1) = 3;
  elsif f[2] = 'proposals' then
    return f[3] = auth.uid()::text and array_length(f, 1) = 4 and public.is_preparer(v_first);
  elsif f[2] = 'capsule' then
    return f[3] = auth.uid()::text and array_length(f, 1) = 4 and public.is_preparer(v_first) and not public.is_revealed(v_first);
  end if;
  return false;
end $$;

create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text
         or public.shares_event_with(public.try_uuid((storage.foldername(name))[1]))));
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy media_read on storage.objects for select to authenticated
  using (bucket_id = 'event-media' and public.can_read_media(name));
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'event-media' and public.can_write_media(name));
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'event-media' and public.can_write_media(name));
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'event-media' and public.can_write_media(name));

revoke execute on function public.try_uuid(text), public.can_read_media(text), public.can_write_media(text) from public, anon;
grant execute on function public.try_uuid(text), public.can_read_media(text), public.can_write_media(text) to authenticated;

-- Realtime : les abonnés ne reçoivent que les lignes que la RLS leur autorise.
-- (votes exclus : l'identité des votants est privée ; le classement suit proposals.vote_count.)
alter publication supabase_realtime add table
  public.events, public.event_members, public.proposals, public.messages, public.tasks,
  public.activity, public.notifications;
