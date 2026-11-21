# Suivi des lots

| Lot | Contenu | État |
|---|---|---|
| 1 | Monorepo, branches, analyse de la planche (`DESIGN.md`), contrats, migrations complètes | **fait** |
| 2 | Comptes, création d'événement, invitations, accueil d'événement, membres, réglages, profil | **fait côté code**, non vérifié contre Supabase (migrations à appliquer) |
| 3 | Propositions et votes, contributions simulées | **fait côté code**, testé en base locale ; non vérifié de bout en bout |
| 4 | Missions, discussion, capsule, timbres, rappels | **fait côté code**, testé en base locale ; non vérifié de bout en bout |
| 5 | Vérification distante multi-comptes, téléphone, revue sécurité/accessibilité | **en cours** : migrations 1-6 appliquées à distance ; 7 (privilèges) et 8 (confidentialité) prêtes dans un seul fichier, à appliquer ; puis parcours multi-comptes, Render, téléphone |

## Reprise — vérification distante (2026-11-21)

### Vérifié (exécuté)
- Migrations 1 à 6 appliquées par l'utilisateur (SQL Editor) : 6 versions dans `schema_migrations`,
  `verify.sql` 10/10 dont la tâche `complice-reminders` (`*/10 * * * *`, active).
- Avis Supabase : sécurité, avertissements attendus (RPC `SECURITY DEFINER` volontairement ouvertes,
  `invitation_acceptances` sans politique = fermée) ; performance, index de clés étrangères et
  `auth.uid()` réévalué par ligne dans 21 politiques (à optimiser plus tard, sans effet fonctionnel).
- Branches poussées : `main`, `backend`, `front`.
- 4 comptes de test confirmés créés à distance (organisatrice, participant, bénéficiaire, extérieure) ;
  identifiants dans `supabase/.bundle/comptes-test.txt` (ignoré par Git).
- Premier parcours réel : connexion des 4 comptes, couverture déposée (Storage), `create_event`,
  invitation, aperçu anonyme, page `/i/<jeton>` sur Render, adhésions participant et bénéficiaire,
  jeton épuisé ou inventé refusé (statuts `exhausted` / `invalid`).

### Erreur trouvée et corrigée
- **Aucun membre ne pouvait lire ni écrire une table** (`permission denied for table events`) : sur les
  projets Supabase récents, les nouvelles tables ne reçoivent plus de droits par défaut. Migration 7
  (`20261121000700_table_privileges.sql`) : droits explicites + mêmes retraits qu'avant. Le banc PGlite
  reproduit désormais ce comportement (21/35 échecs sans la migration 7, 36/36 avec).
- Revue de la migration 7 avant application (`aff4a94`) : insertion limitée aux colonnes métier
  (un message ne peut plus être antidaté ; pas de compteur ni de date de publication choisis par le
  client), aucune insertion directe de mission, préférences limitées aux interrupteurs,
  `invitation_acceptances` illisible. Détail et avis Supabase un par un : docs/SECURITE-SUPABASE.md.

### Migration 8 et adaptations de l'app (`a0a78c5`)
Décisions produit (utilisateur, 2026-11-21) : montants individuels privés, plus d'annonce nominative,
progression collective par paliers, aucune donnée financière pour le bénéficiaire.
- SQL (`aa2b349`) : `event_finances`, paliers, annonces anonymes, `revealed_gift`, invitations
  inutilisables muettes, fonctions d'aide muettes pour un non-membre, quotas, politiques optimisées,
  index. Détail : docs/SECURITE-SUPABASE.md (« Suite donnée »).
- App (`cbe674e`) : carte de cagnotte par paliers, « Mes événements » par paliers, objectif via
  `set_event_target`, cadeau du bénéficiaire sans prix, fil d'activité anonyme.
- Vérifié localement : `npm test` SQL 40/40, shared 6/6, backend 8/8 ; typecheck ; ESLint 0 problème ;
  export Android et web. Fichier 7 + 8 validé sur une copie de l'état distant avec données existantes
  (`verify.sql` 11/11, montants repris dans `event_finances`, 0 annonce nominative, relance refusée).
- **Non vérifié** : rendu des écrans modifiés (aucune base à jour pour les afficher), Realtime distant.

### Parcours distant après migrations 7 et 8 (2026-11-21, `166c5f1`)
Testé **par script** (API publiques : clé publique Supabase, 4 vrais comptes, API Render `a640951`) :
**96/96** — création (couverture, 5 missions), invitations (aperçu visiteur sans identifiant, lien
épuisé muet, participant ne peut pas inviter), idées (photo, compteur forgé refusé), votes (changement,
confidentialité), choix du cadeau, participations via Render (confirmée, refus simulé, nouvelle
tentative, requête rejouée sans second débit, paliers, montant personnel, pas de total exact pendant la
collecte), missions (prise simultanée : un seul gagnant, création directe refusée), discussion (doublon
et antidatage refusés), **temps réel** (Léa reçoit message et annonces anonymes ; Nora et Camille ne
reçoivent rien), capsule (scellée), refus pour Nora et Camille avant l'ouverture (14 accès chacun),
puis après l'ouverture : Camille voit l'événement, le cadeau sans prix, les mots et la photo, aucune
donnée financière ; capsule non modifiable ; total exact pour l'organisatrice seulement, collecte close ;
rappel « capsule ouverte ».

Vérifié **dans l'interface** (version web de l'app, Chromium 390×844, données distantes) : 23/24 — liste
« Mes événements » par paliers, carte de cagnotte, écran Participer, total exact pour l'organisatrice
collecte close, réglages (objectif), vue de Hugo (palier, sa participation, pas de total), onglet Idées,
vue de Camille (aucun montant, cadeau sans prix, capsule), événements inaccessibles pour Camille et Nora.
Échec attendu : appel de l'API Render depuis le navigateur bloqué par CORS (aucune origine web
autorisée ; sans effet sur l'app native).

Défauts trouvés et corrigés :
- **Timbre « Complice » annoncé nominativement** dans le fil au moment de chaque participation → migration 9
  (`fcd3f4b`), **à appliquer**.
- **Onglet Idées en erreur pour tous** (embarquement `profiles` ambigu pour PostgREST) → relation nommée
  (`9f11df3`). Les 15 lectures de tables de l'app passent contre l'API réelle.

Non vérifié : app native sur téléphone (clavier, galerie photo, liens), rendu temps réel à l'écran.

### Bloqué
- **Render** : sert toujours `a640951` ; aucun push sur `backend` n'a déclenché de déploiement, même
  ceux qui touchent `packages/shared`. Cause à lire dans le tableau de bord (Events). La version en ligne
  fonctionne avec la nouvelle base (parcours ci-dessus).
- **Migrations 7 et 8 à distance** (appliquées par l'utilisateur le 2026-11-21) : l'écriture SQL par Claude est refusée par le classificateur du mode
  automatique (« Undermining Oversight »), refus respecté. Fichier unique à coller dans le SQL Editor :
  `supabase/.bundle/apply-7-8.sql` (régénérer : `npm run db:bundle -- 20261121000700`).
- Parcours multi-comptes complet, refus d'accès et dévoilement : dès les migrations 7 et 8 appliquées.
- Render sert toujours `a640951` après le push (voir docs/SETUP.md §5) : déploiement manuel requis.

### Cartes
- Graphify : `graphify-out/` (graph.html, GRAPH_REPORT.md, graph.json), code seul (AST, 0 jeton) :
  709 nœuds, 1 859 liens, 55 communautés. Limites : SQL absent (`tree_sitter_sql` non installé :
  `uv tool install --upgrade "graphifyy[sql]"`), documents et images non extraits. Mise à jour :
  `/graphify . --update`.
- Floorplan : plugin installé au niveau du projet (`.claude/settings.json` : marketplace
  `haydenschmitty/floorplan`, plugin `floorplan@floorplan`). Chargé à la prochaine session de Claude
  Code dans ce dépôt ; la carte n'est pas encore générée (demander « un floorplan de COMPLICE »).

## Reprise — application distante (2026-11-20, depuis `6fa6d61`)

### Vérifié (exécuté)
- MCP Supabase connecté au projet `uecptmijcjwmzdebeugk`. Base trouvée vierge, puis **migration 1
  (`20261120000100_core`) appliquée** et enregistrée (version = préfixe du fichier, format CLI).
  Contrôle à distance : 8 tables, 22 fonctions, 10 politiques, 4 types, 0 utilisateur, aucun bucket.
- Fichier des migrations 2 à 6 (`npm run db:bundle -- 20261120000200`) validé sur PGlite à partir de
  l'état distant (migration 1 seule) : `verify.sql` 9/9 OK ; relance refusée par le garde-fou ;
  refusé si la migration 1 n'est pas enregistrée, sans aucune modification.
- `npm test` : SQL 35/35, shared 5/5, backend 8/8 ; typecheck OK ; ESLint mobile 0 problème.
- Auth (lecture publique) : e-mail seul, inscription ouverte, confirmation d'e-mail obligatoire.
- Render : `/health` 200, `admin_configured: true`, **version `a640951`** alors que `main` = `6fa6d61` ;
  `/i/<jeton 64 hex>` 200, `no-store`, lien `complice://invite/…` présent. Build Render reproduit en
  local (shared + backend) : OK.
- Mobile : `npx expo install --check` à jour ; export Android (Hermes) et web réussi ; permissions
  caméra/micro d'`expo-image-picker` retirées (inutilisées) ; KeyboardAvoidingView sur 6 écrans de saisie.

### Bloqué
- **Migrations 2 à 6** : trois appels d'écriture MCP (`execute_sql` ×2, `apply_migration` ×1) refusés
  (`declined`, sans cause). Aucune règle `deny` ni hook ne vise `mcp__supabase__*` : refus à la
  validation de l'appel. Débloquer : appliquer le fichier dans le SQL Editor (docs/SETUP.md §1), ou
  ajouter `mcp__supabase__execute_sql` et `mcp__supabase__apply_migration` à `permissions.allow`.
- **Render** : cause du retard à lire dans complice-api > Events / Logs (extension Chrome non connectée,
  pas de clé API Render).
- **Parcours multi-comptes** : après les migrations ; comptes confirmés via `seed:demo` (clé secrète dans
  `backend/.env`) ou SMTP personnalisé.
- Graphify : aucun index (`graphify-out/` absent) ; Floorplan : non installé.

## Lots 3-4 — 2026-11-20

### Réalisé
- Migration 6 : rappels `vote_closing` / `capsule_open` (pg_cron toutes les 10 min + déclenchement
  par l'app), notification « message » (une par heure et par événement), `create_task`, chemin des
  images de proposition imposé, proposition retirée définitive, `can_view_event` sans NULL.
- Écrans : Idées (classement temps réel, réactions, commentaires, égalité, indisponible, prix modifié,
  choix confirmé), formulaire d'idée (lien, photo privée), Participer (montants, validation, récap,
  simulation explicite, échec et nouvelle tentative, reprise idempotente, historique), Missions
  (prise concurrente, terminer, libérer, (ré)attribuer, rouvrir, créer avec échéance), Discussion
  (pagination, temps réel, file d'envoi sans doublon, reprise), Capsule (brouillon, photo, aperçu,
  scellement, dévoilement, souvenirs), timbres et célébration, notifications par type.
- Outillage : `npm run db:bundle`, `supabase/verify.sql`, `supabase/scripts/apply-remote.mjs`,
  serveur MCP Supabase déclaré dans `.mcp.json`.

### Vérifié (exécuté)
- `npm test` : SQL **35/35** (dont un parcours complet idée → vote → contribution → mission → message
  → capsule → dévoilement, accès d'un extérieur refusé, rappels idempotents), shared **5/5**, backend **8/8**.
- Typage mobile OK, ESLint 0 problème, export web Expo réussi, `npx expo install --check` à jour.
- Fichier regroupé + `verify.sql` exécutés sur une base vierge (PGlite) : 9 contrôles OK.
- `https://complice-api.onrender.com/health` : 200, `admin_configured: true`, version `a640951`.

### Non vérifié / limites
- Aucune table sur le Supabase distant : écrans non testés contre de vraies données, ni sur téléphone.
- Render sert `a640951` et déployait depuis `backend` : branche à passer sur `main`.
- Paiement simulé uniquement ; frais à 0 €.
- Notifications push non implémentées (development build + clés FCM/APNs nécessaires).
- Réactions et commentaires des idées : actualisés au retour sur l'écran (non publiés en Realtime).

## Lots 1-2 — 2026-11-20

### Réalisé
- Schéma complet en 5 migrations : profils, événements, membres et rôles, invitations (hash, expiration,
  révocation, usage unique), propositions, votes, réactions, commentaires, contributions simulées
  idempotentes, missions, discussion, capsule, timbres, notifications in-app, Storage privé, Realtime.
- Toutes les fonctions SQL sont fermées par défaut et ouvertes une par une
  (`20261120000500_function_privileges.sql`).
- API Fastify : `/health`, `/i/:jeton` (page d'ouverture de l'app), `POST/GET /v1/contributions`
  (prestataire simulé derrière une interface), `DELETE /v1/account`. Blueprint Render.
- App Expo :
  - accueil, inscription, connexion, validation de l'e-mail (lien PKCE ou code), mot de passe oublié et nouveau mot de passe, déconnexion ;
  - « Mes événements » (en cours / souvenirs) et création d'événement en 3 étapes avec image facultative ;
  - accueil d'événement (cagnotte, étapes, prochaine action, dates, activité, temps réel) ;
  - membres et invitations (création, partage, révocation, rôles, transmission, retrait, départ) ;
  - réglages (échéances passées verrouillées) ;
  - profil (prénom, préférences de notifications, informations sur les données, suppression du compte) ;
  - notifications in-app ;
  - lien profond `complice://invite/<jeton>` : retour sur l'invitation après connexion ou inscription.
- Mode démo : `npm run seed:demo` (4 comptes, 4 rôles, données marquées `is_demo`).

### Vérifié (exécuté)
- `npm run test:db` : **28/28**. Postgres réel (PGlite) avec émulation des rôles Supabase. Couverture :
  - isolation entre événements et utilisateurs, refus anonymes et écritures directes ;
  - rôles, invitations (valide, invalide, expirée, révoquée, épuisée, déjà membre, retiré), retrait immédiat ;
  - bénéficiaire aveugle avant le dévoilement ;
  - votes (unicité, changement, confidentialité, égalité, clôture, retrait, prix) ;
  - contributions (idempotence, règlement réservé au serveur, total, échec puis nouvelle tentative, confidentialité) ;
  - mission disputée par deux personnes, timbres non cumulables, Storage, suppression de compte ;
  - fonctions internes non appelables.
- `npm run test:shared` : **5/5** ; `npm run test:backend` : **8/8**.
- Typage : `npm run typecheck` OK (shared, backend, mobile) ; ESLint mobile : 0 erreur.
- API compilée lancée en local : `/health` 200, `/i/<jeton>` 200, POST sans jeton 401.
- App en version web (Chromium, 390×844) : accueil, inscription (erreurs de champ), connexion, mot de
  passe oublié, rejoindre (lien invalide), invitation (état d'erreur), redirection de `/events` sans session.

### Faille trouvée et corrigée pendant le lot
Les privilèges par défaut de Supabase rendaient toute fonction exécutable par `authenticated`. Un
utilisateur aurait pu confirmer lui-même son paiement (`contribution_settle`), s'attribuer des timbres
ou créer des notifications. Toutes les fonctions sont désormais fermées par défaut. Un test de
non-régression couvre ce cas.

### Non vérifié / limites
- **Migrations non appliquées** au projet Supabase (pas d'accès administrateur sur le poste) :
  l'app affiche « service pas encore prêt » sur les écrans qui lisent la base.
- Inscription réelle, e-mails, temps réel et Storage non testés de bout en bout.
- Aucun test sur téléphone physique ni émulateur à ce stade (Expo Go non lancé).
- Écrans Idées, Missions, Capsule, Discussion, Participer : marqués « arrive au lot 3/4 ».
- Notifications push : non implémentées (in-app seulement). `vote_closing` et `capsule_open`
  nécessitent une tâche planifiée (pg_cron ou Render cron) : à faire au lot 4.
- Le bénéficiaire qui rejoint avant le dévoilement ne voit pas l'événement dans sa liste (comportement voulu, à signaler dans l'interface).

### Actions manuelles requises
1. Appliquer les 5 migrations (docs/SETUP.md §1).
2. Ajouter les Redirect URLs `complice://**` et `exp://**`, et `{{ .Token }}` dans les modèles d'e-mail.
3. Créer une clé secrète Supabase et la placer dans `backend/.env` (puis Render).
4. Créer le service Render via le Blueprint (docs/SETUP.md §5).
