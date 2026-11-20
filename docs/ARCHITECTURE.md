# Architecture et décisions

## Répartition Supabase / API

| Besoin | Où | Pourquoi |
|---|---|---|
| Comptes, sessions, e-mails | Supabase Auth | natif, rien à dupliquer |
| Lectures (événements, membres, activité…) | App → PostgREST, **RLS** | une seule source de vérité des droits |
| Écritures sensibles (créer, inviter, rejoindre, voter, prendre une mission…) | **Fonctions SQL `SECURITY DEFINER`** appelées en RPC | atomiques, vérifient rôle et dates dans la même transaction |
| Écritures simples (proposer, commenter, écrire un mot, message) | App → table, RLS + triggers de garde | pas de logique serveur à dupliquer |
| Contribution (intention + règlement), suppression de compte | **API Node** | exigent la clé secrète ou un futur prestataire de paiement |
| Page web des liens d'invitation `/i/<jeton>` | API Node | lien partageable qui ouvre l'app |
| Fichiers | Supabase Storage privé, URL signées 10 min | aucune URL publique permanente |
| Temps réel | Supabase Realtime (`postgres_changes`, filtré par RLS) | votes (via `proposals.vote_count`), membres, activité, notifications |

Règle : **les droits sont écrits une seule fois, en SQL.** L'API n'applique pas de règle métier en
double. Elle appelle la base sous l'identité de l'utilisateur (JWT transmis, RLS active). La clé
secrète ne sert que pour `contribution_settle`, `prepare_account_deletion` et `auth.admin.deleteUser`.

## Rôles par événement

| Action | Organisateur | Coorganisateur | Participant | Bénéficiaire |
|---|---|---|---|---|
| Voir la préparation (idées, votes, missions, discussion, activité) | oui | oui | oui | **jamais** |
| Voir l'événement | oui | oui | oui | à partir du dévoilement |
| Modifier les réglages | oui | oui | non | non |
| Inviter (participant / bénéficiaire) | oui | oui | non | non |
| Inviter un coorganisateur, changer les rôles, transmettre | oui | non | non | non |
| Retirer un membre | oui | participants et bénéficiaire | non | non |
| Choisir le cadeau, réattribuer ou rouvrir une mission | oui | oui | non | non |
| Proposer, voter, contribuer, prendre une mission, écrire un mot | oui | oui | oui | non |
| Lire la capsule | après dévoilement | idem | idem | après dévoilement |

## Confidentialité

- **Montants** : chacun ne lit que ses contributions (RLS). Le groupe voit le total et le nombre de
  participations (`event_funding`). Les gestionnaires voient *qui* a participé, sans montant
  (`event_contributors`), pour remercier. Les timbres ne dépendent jamais du montant.
- **Votes** : chacun voit sa voix et le nombre de voix par idée. L'identité des votants n'est visible
  que si l'organisateur active `vote_visibility = 'public'`, avec un avertissement dans l'app.
- **Capsule** : un brouillon n'est visible que par son auteur. Un mot publié reste scellé jusqu'au
  dévoilement, le groupe ne voit que des compteurs (`capsule_stats`). Les photos sont contrôlées par
  les mêmes règles dans Storage.
- **Jetons d'invitation** : 244 bits aléatoires. Seul le hash SHA-256 est stocké, le lien n'est
  affiché qu'une fois à sa création.

## Règles métier clés

- Une voix par membre et par événement (clé primaire), modifiable jusqu'à `votes_close_at`. Retirer
  une proposition ou la déclarer indisponible libère ses voix. Un changement de prix est tracé
  (`previous_price_cents`). Le classement signale les égalités et ne choisit jamais le cadeau :
  `select_gift` est un acte explicite d'un gestionnaire.
- Contributions en centimes. Une clé d'idempotence est unique par utilisateur : le double clic ou la
  requête rejouée renvoie la même ligne, et le règlement rejoué ne change rien. Le total est recalculé
  à partir des seules contributions `confirmed`. Les lignes portent `is_simulated` et `provider = 'simulated'`.
- Prise de mission atomique (`UPDATE … WHERE status = 'open'`) : deux personnes simultanées, un seul gagnant.
- Échéance passée = non modifiable (trigger `events_guard`). Le dévoilement est contrôlé par `now()`
  côté base, jamais par l'horloge du téléphone.
- Timbres : clé primaire `(événement, membre, type)` et `ON CONFLICT DO NOTHING`. Supprimer puis
  recréer une action ne redonne rien.
- Notifications in-app : `dedupe_key` unique par utilisateur, respect des préférences. Pas de push à ce stade.

## Départs et suppression de compte

- Participant ou coorganisateur qui quitte : accès coupé immédiatement. Ses contenus restent.
- Organisateur : doit d'abord transmettre l'organisation (`transfer_ownership`).
- Membre retiré : statut `removed`. L'ancien lien ne permet plus de revenir.
- Suppression de compte (API → `prepare_account_deletion`, puis suppression Auth) :
  - l'organisation passe au coorganisateur le plus ancien, sinon au participant le plus ancien ;
  - un événement sans autre membre est supprimé ;
  - les mots de capsule, votes, réactions et l'avatar sont supprimés ;
  - les messages, propositions et contributions restent, sans auteur.

## Décisions (réversibles)

| # | Décision | Alternative écartée |
|---|---|---|
| D1 | Monorepo npm workspaces, `packages/shared` compilé en CommonJS | dépôt séparé par app |
| D2 | Expo Router, onglets d'événement personnalisés conformes à la planche | onglets natifs (style imposé par la plateforme) |
| D3 | Session Supabase dans AsyncStorage (recommandation Supabase) | SecureStore chiffré (limite 2 Ko, complexité) |
| D4 | Flux PKCE + code OTP pour e-mail et mot de passe | liens seuls (fragiles en Expo Go) |
| D5 | Fastify 5 + zod pour l'API | Express |
| D6 | Tests SQL dans PGlite (vrai Postgres en WASM) avec émulation des rôles Supabase | Docker + Supabase local (indisponible sur le poste) |
| D7 | Frais de contribution à 0 en simulation, calculés côté serveur | frais calculés par le client |
| D8 | Un seul bénéficiaire par événement | plusieurs bénéficiaires |
| D9 | TanStack Query pour cache, reprises et états de chargement | état local par écran |
| D10 | Rappels par pg_cron dans Supabase (10 min) + déclenchement idempotent à l'ouverture de l'app | cron Render (payant), minuterie dans l'API (le plan gratuit s'endort) |
| D11 | Discussion : file d'envoi locale avec `client_id` stable, rejouée au retour réseau ; 23505 = déjà reçu | renvoi naïf (doublons) |
| D12 | Contribution : clé d'idempotence conservée (AsyncStorage) jusqu'à une issue connue | nouvelle clé à chaque appui (risque de double débit) |
