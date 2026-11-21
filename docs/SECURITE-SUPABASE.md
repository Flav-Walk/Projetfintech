# Revue de sécurité Supabase

Revue du 2026-11-21, faite sur le projet distant (migrations 1 à 6 appliquées) et sur la migration 7
(`20261121000700_table_privileges.sql`, en attente d'application). Les avis viennent du conseiller
Supabase (Advisors > Security). Pour chacun : l'objet, la justification, le risque qui reste et la
correction.

## Suite donnée : migration 8 (`20261121000800_privacy_hardening.sql`)

Écrite, testée localement (SQL 40/40) et validée sur une copie de l'état distant. **Pas encore appliquée
à distance** (fichier commun 7 + 8 : `supabase/.bundle/apply-7-8.sql`).

| Constat de la revue (§2 et §3) | Correction |
|---|---|
| Déduction d'un montant individuel (annonce nominative + total en temps réel) | Montants sortis de `events` vers `event_finances` (aucun accès client, pas de temps réel) ; paliers de 25 % ; annonce anonyme (historique compris) ; timbre « Complice » visible de son seul titulaire ; `event_contributors` fermé aux clients ; total exact aux gestionnaires une fois la collecte close. Une déduction reste possible dans les très petits groupes. |
| Bénéficiaire : total collecté et prix du cadeau lisibles après l'ouverture | Plus aucun montant dans `events` ; `proposals` réservée aux préparateurs ; cadeau via `revealed_gift`, sans prix ni lien. |
| `preview_invitation` détaille un lien expiré ou épuisé, et donne `event_id` aux visiteurs | Statut seul pour un lien inutilisable ; `event_id` jamais renvoyé à un visiteur non connecté. |
| `is_revealed`, `proposal_event` répondent à un non-membre | Réponse vide ou fausse pour un non-membre (réponse normale pour la tâche planifiée et le service). |
| `contribution_create` : demandes « en attente » illimitées | 5 demandes en attente par heure et par compte (`too_many_pending`). |
| `create_event` : création illimitée | 30 événements par 24 h et par compte (`rate_limited`). |
| `refresh_reminders` : appel en boucle | Au plus une exécution par minute et par compte (table `reminder_checks`). |
| `auth_rls_initplan` (21 politiques) | `auth.uid()` réécrit en `(select auth.uid())` dans toutes les politiques de `public`. |
| `unindexed_foreign_keys` (15) | 15 index ajoutés. |

Les avis `authenticated_security_definer_function_executable` resteront affichés : ces fonctions doivent
rester appelables par les membres. Le risque de chacune est traité ci-dessous ; le déplacement des
fonctions d'aide dans un schéma non exposé n'a pas été retenu, car il impose de réécrire toutes les
fonctions qui les appellent, pour un gain désormais faible.

## 1. Droits accordés par la migration 7

Les projets Supabase récents ne donnent aucun droit de lecture ni d'écriture par défaut sur les tables.
La migration 7 accorde les droits explicitement. La RLS, active sur les 17 tables, filtre ensuite les lignes.

| Rôle | Droits sur les tables `public` |
|---|---|
| `anon` (visiteur) | aucun |
| `service_role` (API Render, script de démo, clé secrète) | lecture et écriture sur toutes les tables ; ignore la RLS par construction |
| `authenticated` (membre connecté) | voir le tableau ci-dessous ; aucun TRUNCATE, REFERENCES, TRIGGER ni MAINTAIN |

Droits de `authenticated`, avec la politique RLS qui les limite :

| Table | Droits | Limite (RLS ou trigger) |
|---|---|---|
| `profiles` | lecture ; modification de `display_name` et `avatar_path` | soi-même, ou une personne d'un même événement |
| `notification_prefs` | lecture ; modification des 5 interrupteurs | soi-même |
| `events` | lecture ; modification des réglages (titre, dates, cagnotte visée…) | lecture si `can_view_event` ; modification par un gestionnaire ; `events_guard` protège statut, total, bénéficiaire, cadeau choisi et échéances passées |
| `event_members`, `activity`, `invitations` | lecture | membres de l'événement ; invitations visibles des gestionnaires seulement (le jeton n'est stocké que haché) |
| `notifications`, `user_badges`, `votes` | lecture | ses propres lignes ; voix des autres seulement si l'événement est en vote public |
| `invitation_acceptances` | aucun | écrite par `accept_invitation` |
| `proposals` | lecture ; création (6 colonnes) ; modification (6 colonnes) | préparateurs ; `proposals_guard` impose l'auteur, 0 voix, statut actif, chemin de photo |
| `proposal_reactions`, `proposal_comments` | lecture ; création ; suppression des siennes (et modification de sa réaction) | préparateurs de l'événement de l'idée |
| `contributions` | lecture | **ses propres contributions seulement** ; création par `contribution_create`, confirmation par le service |
| `tasks` | lecture ; modification de titre, échéance, ordre ; suppression | préparateurs (lecture), gestionnaires (écriture) ; création par `create_task` |
| `messages` | lecture ; création (`event_id`, `author_id`, `body`, `client_id`) | préparateurs ; jamais le bénéficiaire ; date fixée par la base |
| `capsule_entries` | lecture ; création ; modification de `body`, `photo_path`, `status` ; suppression | son mot à tout moment ; les mots publiés seulement après l'ouverture ; `capsule_guard` bloque toute écriture après l'ouverture |

Autres points vérifiés :
- aucune vue ni vue matérialisée dans `public` ;
- les 55 fonctions ont un `search_path` vide ;
- 34 fonctions sont ouvertes aux membres, 1 aux visiteurs (`preview_invitation`), 3 au seul service
  (`contribution_settle`, `prepare_account_deletion`, `run_due_reminders`), les autres à personne
  (triggers et fonctions internes).

## 2. Confidentialité

**Contributions**
- Un membre ne lit que ses propres lignes (RLS `user_id = auth.uid()`).
- Il ne peut ni insérer ni modifier une contribution directement, et ne peut pas la confirmer.
- `event_funding` donne le total, le nombre de contributeurs et *son* montant.
- `event_contributors`, réservé aux gestionnaires, liste qui a participé, sans montant.

**Risque constaté : déduction d'un montant individuel.**
- Quand une contribution est confirmée, `contribution_settle` ajoute au fil d'activité une ligne
  `contribution_confirmed` au nom du contributeur. Au même moment, `events.collected_cents` augmente.
- Les deux tables sont diffusées en temps réel aux préparateurs.
- Un membre attentif voit donc « Hugo a participé » et la cagnotte passer de 50 € à 80 € : il en déduit 30 €.
- Même chose à deux contributeurs : le total moins son propre montant donne celui de l'autre.
- Cela contredit la règle « jamais de montant individuel visible par un autre membre ». Les pistes de
  correction sont des choix produit, à décider :
  - (a) ne plus nommer le contributeur dans le fil d'activité (« une nouvelle participation ») ;
  - (b) n'afficher qu'un total arrondi ou mis à jour par paliers ;
  - (c) retirer `events` de la diffusion temps réel pour le champ du total.
- Le cas à deux contributeurs reste intrinsèque à l'affichage d'un total.

**Capsule**
- Avant l'ouverture, seul l'auteur voit son mot. Ensuite, seuls les mots publiés sont visibles, et
  uniquement par ceux qui voient l'événement.
- Les photos de capsule suivent la même règle côté Storage (`can_read_media`).
- `capsule_stats` ne donne que des compteurs.
- La table `capsule_entries` n'est pas diffusée en temps réel.

**Bénéficiaire**
- Avant l'ouverture, `can_view_event` est faux : ni événement, ni idées, ni discussion, ni capsule.
- Après l'ouverture, il voit l'événement, donc aussi le total collecté (`collected_cents`). C'est une
  décision produit à confirmer.

## 3. Avis du conseiller Supabase, un par un

### Sécurité

**`rls_enabled_no_policy`, table `invitation_acceptances` (INFO)**
- Objet : journal des adhésions par invitation.
- Justification : écrite uniquement par `accept_invitation`, jamais lue par l'app ; sans politique, la
  RLS refuse tout aux clients.
- Correction : la migration 7 retire aussi le droit de lecture. L'avis continuera de s'afficher, car il
  constate seulement l'absence de politique, qui est voulue.

**`anon_security_definer_function_executable`, fonction `preview_invitation` (WARN)**
- Objet : aperçu d'un lien d'invitation avant connexion.
- Ce qui est sûr : le jeton fait 256 bits et n'est stocké que haché, il ne peut pas être deviné.
- Risque réel : quiconque détient le lien, même **expiré ou épuisé**, obtient le titre, le prénom du
  bénéficiaire, l'occasion, la date, le prénom de l'organisateur, le nombre de membres et l'identifiant
  de l'événement.
- Correction proposée (migration 8) : ne renvoyer ces détails que pour un lien valide (ou à un membre
  déjà inscrit), et ne jamais renvoyer `event_id` à un visiteur.

**`authenticated_security_definer_function_executable` (WARN, 34 fonctions)**

Toutes vérifient l'identité ou le rôle dès leurs premières lignes (code lu en base). Le risque qui reste
dépend de chacune :

| Fonction | Contrôle d'accès | Risque restant | Correction |
|---|---|---|---|
| `accept_invitation` | connecté ; jeton haché | essais illimités, mais 256 bits | aucune |
| `create_event` | connecté | création illimitée (spam, stockage) | quota par compte (migration 8) |
| `create_invitation`, `revoke_invitation` | gestionnaire ; co-organisateur limité | aucun constaté | aucune |
| `set_member_role`, `transfer_ownership` | organisatrice seulement | aucun constaté | aucune |
| `remove_member` | organisatrice ; co-organisateur pour participant et bénéficiaire | aucun constaté | aucune |
| `leave_event` | membre ; organisatrice doit transmettre | aucun constaté | aucune |
| `cast_vote`, `clear_vote` | préparateur, vote ouvert, idée active | aucun constaté | aucune |
| `select_gift` | gestionnaire, idée active du même événement | aucun constaté | aucune |
| `contribution_create` | préparateur, collecte ouverte, idempotence | un client peut créer des lignes `pending` sans passer par l'API, sans effet sur le total | quota de lignes en attente, ou création réservée au service |
| `create_task`, `assign_task` | gestionnaire ; cible membre non bénéficiaire | aucun constaté | aucune |
| `claim_task`, `complete_task`, `release_task` | préparateur ; titulaire ou gestionnaire | aucun constaté | aucune |
| `mark_notifications_read` | ses notifications | aucun | aucune |
| `refresh_reminders` | connecté, pour soi | appel en boucle possible (idempotent, coût faible) | limite de fréquence si besoin |
| `event_funding` | préparateur | déduction d'un montant (§2) | décision produit |
| `event_contributors` | gestionnaire | liste qui a participé, sans montant | voulu (relances) |
| `event_progress`, `capsule_stats` | `can_view_event` | compteurs seulement | aucune |
| `proposal_ranking` | préparateur | aucun constaté | aucune |
| `preview_invitation` (connecté) | jeton | voir l'avis visiteur | migration 8 |
| `my_role`, `is_preparer`, `is_manager`, `can_view_event`, `shares_event_with` | ne répondent que pour l'appelant | aucun | à déplacer hors de l'API (ci-dessous) |
| `can_read_media`, `can_write_media` | ne répondent que pour l'appelant | aucun | idem |
| `is_revealed` | **aucun** | avec un identifiant d'événement, un non-membre apprend s'il existe et s'il est ouvert | idem, ou contrôle d'appartenance |
| `proposal_event` | **aucun** | avec un identifiant d'idée, un non-membre obtient l'identifiant de l'événement | idem |

Les 11 dernières sont des fonctions d'aide des politiques RLS : elles doivent rester exécutables, mais
rien n'oblige à les exposer dans `/rest/v1/rpc`. La correction recommandée par Supabase est de les
déplacer dans un schéma non exposé (`private`) et de faire pointer les politiques vers ce schéma. Les
identifiants sont des UUID aléatoires, donc l'impact est faible ; la correction est prévue en migration 8.

### Performance (sans effet sur la sécurité)
- `auth_rls_initplan` (21 politiques) : `auth.uid()` est réévalué à chaque ligne. Correction : l'écrire
  `(select auth.uid())`, en migration 8.
- `unindexed_foreign_keys` (15) : clés étrangères sans index (auteurs, `created_by`…). Ajouter les index
  utiles aux requêtes réelles.
- `unused_index` (10) : la base vient d'être créée ; à réévaluer après usage réel.
