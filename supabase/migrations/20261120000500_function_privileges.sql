-- COMPLICE — consolidation des droits d'exécution.
-- Supabase accorde par défaut EXECUTE à anon et authenticated sur toute fonction du schéma public.
-- On ferme tout, puis on ouvre une liste explicite. Les fonctions internes (badges, notifications,
-- triggers, règlement des paiements, suppression de compte) ne sont jamais appelables par un client.

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Aperçu d'invitation : accessible avant connexion.
grant execute on function public.preview_invitation(text) to anon, authenticated;

-- Fonctions d'autorisation (utilisées par les politiques RLS évaluées sous le rôle authenticated).
grant execute on function
  public.my_role(uuid), public.is_preparer(uuid), public.is_manager(uuid), public.is_revealed(uuid),
  public.can_view_event(uuid), public.shares_event_with(uuid), public.proposal_event(uuid),
  public.try_uuid(text), public.can_read_media(text), public.can_write_media(text)
to authenticated;

-- RPC exposées à l'application.
grant execute on function
  public.create_event(text, text, text, text, integer, timestamptz, timestamptz, timestamptz, timestamptz, text, text, public.vote_visibility),
  public.create_invitation(uuid, public.member_role, integer, integer),
  public.revoke_invitation(uuid),
  public.accept_invitation(text),
  public.set_member_role(uuid, uuid, public.member_role),
  public.transfer_ownership(uuid, uuid),
  public.remove_member(uuid, uuid),
  public.leave_event(uuid),
  public.mark_notifications_read(bigint[]),
  public.cast_vote(uuid),
  public.clear_vote(uuid),
  public.proposal_ranking(uuid),
  public.select_gift(uuid, uuid),
  public.contribution_create(uuid, integer, text),
  public.event_funding(uuid),
  public.event_contributors(uuid),
  public.claim_task(uuid),
  public.complete_task(uuid),
  public.release_task(uuid),
  public.assign_task(uuid, uuid),
  public.capsule_stats(uuid),
  public.event_progress(uuid)
to authenticated;

-- Réservé au serveur (clé secrète).
grant execute on function
  public.contribution_settle(uuid, boolean, text, text),
  public.prepare_account_deletion(uuid)
to service_role;
