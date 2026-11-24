-- Migration 12 : couverture illustrée COMPLICE.
-- Une cagnotte peut avoir une photo (cover_path, bucket privé, inchangé) ou une illustration de la
-- bibliothèque COMPLICE (cover_art, dessinée dans l'app, sans fichier ni ressource externe).
-- Priorité d'affichage : photo, sinon illustration choisie, sinon illustration selon l'occasion.

alter table public.events
  add column cover_art text
  check (cover_art is null or cover_art in ('anniversaire', 'soiree', 'depart', 'mariage', 'amis', 'autre'));

-- Modifiable par un gestionnaire (politique events_update existante), comme cover_path.
grant update (cover_art) on public.events to authenticated;
