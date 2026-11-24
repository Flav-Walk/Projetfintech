# Suivi des lots

## Lot 9 — Finition visuelle, palette sans violet (2026-11-24)

**Vérifications techniques (sur l'existant, avant toute modification)**
- Migration 12 `cover_art` : enregistrée à distance (12 migrations), droit `update(cover_art)` effectif pour
  `authenticated`, contrainte de valeurs en place.
- Render sert `bb697bb` = tête de `backend` (`/health`, `email_configured: true`).
- CORS sur l'API déployée depuis `http://localhost:8081` : preflight GET/POST 204 avec en-têtes, lecture 200,
  création de participation 201 (simulée, cagnotte d'essai lot 7), 401 lisible, origine inconnue sans ACAO.
- Couverture sur la vraie base (compte Léa, cagnotte d'essai) : dépôt d'une photo PNG réelle (32 134 octets),
  relecture par URL signée identique octet pour octet, illustration « soirée » enregistrée, valeur inconnue
  refusée (23514), état initial restauré et fichier d'essai supprimé. Le sélecteur de galerie lui-même n'a
  pas été piloté (pas de téléphone).

**Finition** (détail des règles : `DESIGN.md` v4)
- Palette : violet et lavande retirés des jetons ; remplacement par rôle (sélection et liens à l'encre,
  repère soleil pour l'onglet actif, progression encre/menthe, corail pour l'argent et les notifications).
  Contrastes relevés (`coralDark` pour les boutons, `inkFaint` 4,7:1), état désactivé sans transparence.
- Menu « + » recomposé et animé (`start-menu.tsx`) ; préparatifs en chantiers parallèles
  (`preparations.tsx`, `lib/preparation.ts`) ; journal regroupé et anonyme (`journal.tsx`, `lib/journal.ts`) ;
  action « Relire / Modifier » dans la lettre de capsule ; famille d'en-têtes (`headers.tsx`) sur Accueil,
  Amis, Activité, Profil, Idées, Missions, Capsule, Discussion et écrans empilés ; couverture « départ » en
  terre cuite ; missions : action de carte en contour.

**Validation**
- Tests : `npm test` (voir le rapport de fin de lot), dont 4 nouveaux tests mobiles (journal, préparatifs).
- Web (rendu Expo, Chromium, compte de démo) : 72 captures 18 écrans × 320/360/390/412 sans débordement ;
  grandes polices simulées (×1,3) en 320 et 390 ; menu « + » : vidéos `docs/captures/menu-plus-{320,390}.webm`,
  planches image par image (ouverture ~280 ms, fermeture ~190 ms, mode réduit), Échap, croix, appuis
  répétés, focus sur « Créer ». Avant/après : `docs/captures/lot9-avant-apres-{iphone-390,petit-320}.png`.
- **Non vérifié sur téléphone** : retour Android, lecteur d'écran natif, haptique, encoche et barre de
  navigation, réglage système de taille de texte, `adjustsFontSizeToFit` des onglets.

## Lot 8 — Refonte UI/UX, CORS, couvertures (2026-11-24)

- **CORS** : cause = `ALLOWED_ORIGINS` absent sur Render → plugin CORS en `origin: false` → preflight 404
  sans en-tête (reproduit sur Render `3041d88`). Correctif : liste configurable et validée (origines Expo web
  locales par défaut, jamais `*`), méthodes GET/POST/DELETE/OPTIONS, en-têtes Authorization/Content-Type,
  en-têtes présents sur les erreurs. Testé : 2 tests API + requêtes réelles depuis l'origine
  `http://localhost:8081` (preflight 204, lecture 200, création 201, 401 lisible, origine inconnue refusée).
  **Effectif sur Render seulement après déploiement de `backend`.**
- **Couvertures blanches** : cause = envoi par `fetch(uri).arrayBuffer()` qui produisait un fichier de
  14 octets (« Anniversaire flav ») ; ni le bucket ni l'URL signée en cause. Correctif : lecture base64 du
  sélecteur, contrôle de la signature (JPEG/PNG/WebP/HEIC) et de la taille ; illustration toujours dessinée
  sous la photo (jamais de rectangle vide). Bibliothèque de 6 couvertures COMPLICE dessinées en SVG
  (migration 12 `cover_art`, **à appliquer** : `supabase/.bundle/apply-12.sql`). Choix photo/illustration
  avec aperçu à la création et dans les réglages.
- **`content.js` 403** : n'existe ni dans l'app ni dans ses dépendances ; nom typique d'un script injecté
  par une extension du navigateur. Navigateur de test sans extension : aucune erreur de console.
- **Refonte** (jetons v3, DESIGN.md) : accueil avant connexion (scène illustrée + promesse), cartes à
  couverture, accueil de cagnotte (couverture pleine largeur, prochaine étape, « Le cadeau », « Échéances »
  regroupées), timbres à noms courts, capsule (ticket d'ouverture, lettre, aperçu, « Déposer »), discussion
  (groupes de messages, jours, saisie), mentions de prototype retirées (« Mode démo » discret).
- Vérifié : SQL 60, shared 6, backend 16, mobile 11 (**93**) ; typage, lint ; 72 captures web sur 320, 360,
  390 et 412 px sans débordement ni erreur de console ; planches avant/après dans [captures/](captures/).
  Non vérifié : téléphone (clavier, zones sûres natives, grandes polices, lecteur d'écran), Render déployé.

## Lot 7 — Amis, invitations nominatives, total de cagnotte, refonte (2026-11-22)

- **Base (migration 11, à appliquer : `supabase/.bundle/apply-11.sql`)** : pseudo unique, recherche, amis,
  blocage, invitations d'amis (rejoindre/refuser), invitation par e-mail liée à l'adresse vérifiée et
  retrouvée après connexion, surprise du bénéficiaire, total de cagnotte pour les préparateurs, prochaine
  action enrichie. Règles : [AMIS-INVITATIONS.md](AMIS-INVITATIONS.md).
- **App** : navigation Accueil · Amis · + · Activité · Profil ; écran Amis (recherche, demandes, balayage) ;
  invitations reçues et surprise à l'accueil ; feuille « Inviter » (amis, e-mail, lien) et suivi des
  invitations ; carte cagnotte avec montants ; photo de profil et pseudo ; réactions dessinées ; lecture des
  mots un par un ; jetons v2, Bricolage Grotesque, mascotte et icône d'app redessinées ([DESIGN.md](../DESIGN.md)).
- Vérifié : SQL 59 (dont 13 nouveaux, multi-rôles), shared 6, backend 14, mobile 8 ; typage, lint ;
  exports web et Android.
- **2026-11-23, à distance** : migration 11 enregistrée (11/11), droits effectifs conformes (écriture
  fermée sur les nouvelles tables, fonctions internes fermées, recherche refusée aux anonymes, tous les
  profils ont un pseudo). Parcours multi-comptes sur la vraie base : **47/47 contrôles** (Léa organisatrice,
  Hugo ami invité, Camille bénéficiaire, Nora extérieure puis bloquée ; participations simulées via
  l'API Render ; cagnotte d'essai « Les 30 ans de Camille (essai lot 7) »).
- Captures web (rendu Expo, comptes de démo) sur 320, 360, 412 et 390 px : 56 captures, aucun débordement
  horizontal ni erreur JS détectés ; planches dans [captures/](captures/). Corrigés après revue : filigrane
  qui chevauchait le texte, pseudo mis en majuscules, interrupteurs hors charte sur le web.
- Non vérifié : Render sert encore `3041d88` (déploiement automatique inactif) ; aucun e-mail métier
  encore envoyé par l'API ; téléphone réel (zones sûres, clavier, grandes polices, lecteur d'écran).

## Cause de l'échec d'inscription (2026-11-21, 19:10)

Logs Auth : `525 5.7.1 Unauthorized IP address` sur chaque `/signup`. La restriction d'IP du compte
Brevo bloque le SMTP de Supabase (et menace l'API depuis Render). À lever dans Brevo > Sécurité.
Migration 10 vérifiée (registre 10, `verify.sql` 13/13) ; Render sert `3041d88`.
Cagnotte de test ouverte : « Pot de départ de Sam (essai) » (votes jusqu'au 26/11, participations
jusqu'au 29/11), lien participant créé (3 usages, expire le 28/11). Détail : [AUTH-DIAGNOSTIC.md](AUTH-DIAGNOSTIC.md).

## Reprise Codex — Auth (2026-11-21)

**Inscription encore bloquée côté envoi de confirmation.** Une seule tentative normale autorisée,
le 21 novembre à 18:50:04 Europe/Paris : HTTP 500, `unexpected_failure`,
`Error sending confirmation email`, identifiant `01a1ff3a-c9d6-74b2-b715-7d4b5e9ad71c`.
Message SMTP détaillé à récupérer dans Logs > Auth avant de modifier la configuration distante.
Cause SMTP précise non établie ; ne pas considérer le parcours réel comme validé.

Corrections : PKCE S256 via les primitives natives d'expo-crypto avant le client Supabase ;
callback sûr (query/fragment, échange unique, recovery, flow id) ; invitation conservée jusqu'à
l'adhésion réussie ; messages Auth et code OTP ; callbacks documentés sans wildcard global.
Secrets déplacés du `.env` mobile au `.env` backend local, tous deux ignorés par Git.

Vérifié : SQL 46, shared 6, backend 14, mobile 6 (**72 tests**), typage, lint, compatibilité Expo,
exports web/Android ; navigateur Chrome (S256, erreur SMTP simulée, invitation, lien expiré).
Render sert `3041d88`, e-mails configurés. Objets migration 10 présents via REST, registre et
contrôles SQL complets encore non vérifiés. Aucune migration rejouée, aucun réglage distant modifié.
API Brevo locale : IP non autorisée, expéditeurs non inspectés ; sans preuve de lien avec le SMTP.

Limites : aucun appareil Android connecté ; acceptation Brevo, livraison, réception, confirmation,
retour réel à la cagnotte et réinitialisation restent à tester. Détail et protocole :
[AUTH-DIAGNOSTIC.md](AUTH-DIAGNOSTIC.md). Les recommandations de callbacks précises dans SETUP.md
remplacent les anciennes mentions historiques de `exp://**` / `complice://**` ci-dessous.

| Lot | Contenu | État |
|---|---|---|
| 1 | Monorepo, branches, analyse de la planche (`DESIGN.md`), contrats, migrations complètes | **fait** |
| 2 | Comptes, création d'événement, invitations, accueil d'événement, membres, réglages, profil | **fait**, vérifié à distance (script et app web) |
| 3 | Propositions et votes, contributions simulées | **fait**, vérifié à distance (script et app web) |
| 4 | Missions, discussion, capsule, timbres, rappels | **fait**, vérifié à distance (script et app web) |
| 5 | Vérification distante multi-comptes, revue sécurité, confidentialité des montants | **fait** (migrations 7 à 9 appliquées) |
| 6 | MVP complet : parcours de compte, e-mails Brevo, invitations par e-mail, remerciements, modèles, brouillons | **fait côté code** ; migration 10, SMTP et clé Brevo à configurer ; essai téléphone à faire |

## Lot 6 — MVP complet (2026-11-21, `main` après fusion de `front` 39a6b83)

### Réalisé
- **Compte** : mot de passe affichable, règles cochées pendant la saisie, renvoi d'e-mail limité à une
  fois par minute, invitation portée par le lien de confirmation, session expirée expliquée,
  déconnexion qui efface brouillons et invitation en attente, messages d'erreur Supabase traduits
  (adresse refusée, trop de demandes, envoi impossible).
- **E-mails** (docs/EMAILS.md) : modèles Auth en français (`supabase/templates`), API Brevo côté
  serveur, file `email_outbox` avec 3 essais, invitation par e-mail, annonce d'ouverture de capsule
  selon les préférences, réveil de l'API par pg_net.
- **Organisation** : modèles d'événement, missions par défaut selon l'occasion et modifiables,
  récapitulatif (cadeau, missions, dates), idées « À découvrir » avant le classement, filtres,
  brouillons locaux (idée, mot de capsule), remerciements du bénéficiaire, retours haptiques.
- **Gamification** : timbre « Complice » retiré de l'affichage, prochaine action « cagnotte » neutre ;
  leviers et dark patterns écartés dans docs/GAMIFICATION.md.
- Canaux temps réel uniques par écran (deux onglets montés ne se coupent plus).

### Vérifié
- `npm test` : SQL 46/46 (dont 7 nouveaux tests de la migration 10), shared 6/6, backend 14/14 (envoi
  Brevo simulé, erreurs temporaires et définitives, contenu échappé, aucune donnée financière dans les
  e-mails, clé jamais renvoyée) ; typecheck, ESLint 0 problème, `expo install --check` à jour.
- Fichier de la migration 10 validé sur une copie de l'état distant (verify.sql 13/13, relance refusée).
- **App web** contre le Supabase distant (Chromium 360×740) : 15 contrôles d'interface sur 17 —
  règles et affichage du mot de passe, absence de boutons Apple/Google, modèle « départ », texte de
  confidentialité, création d'un événement depuis l'interface, récapitulatif, étagère sans timbre
  financier, mission renommée, modes d'affichage des idées et filtre « Mes idées ».
- Inscription d'un **nouveau compte depuis l'interface** : refusée par Supabase pour une adresse
  `@example.com` (domaine réservé), puis limitée (429) par le SMTP intégré ; l'app affiche désormais un
  message explicite. **Réception d'e-mail non vérifiée** : nécessite le SMTP Brevo.

### Non vérifié
- Migration 10 à distance, e-mails réels (envoi, livraison, réception, lien ouvert), API avec Brevo
  sur Render, app sur téléphone (clavier, galerie, haptique, liens profonds).

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
