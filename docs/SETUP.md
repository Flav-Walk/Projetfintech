# Installation et configuration

## 1. Supabase (une fois)

Projet : `https://uecptmijcjwmzdebeugk.supabase.co`.

### Appliquer les migrations

7 fichiers dans `supabase/migrations/`, dans l'ordre (1 à 5 : schéma ; 6 : rappels, discussion,
missions ; 7 : privilèges explicites sur les tables). Chaque option enregistre les versions dans `supabase_migrations.schema_migrations`, comme
`supabase db push`, pour que les outils restent cohérents ensuite.

Option A — un seul copier-coller (recommandé) :
1. `npm run db:bundle` produit `supabase/.bundle/apply.sql` (ignoré par Git ; `npm run db:bundle -- 20261120000600`
   pour ne prendre que les migrations à partir d'une version).
2. Supabase > SQL Editor > New query > coller tout le fichier > Run. Une seule transaction : en cas
   d'erreur, rien n'est appliqué.
3. Avec une version de départ, le fichier commence par un garde-fou : il s'arrête sans rien modifier si
   une migration antérieure n'est pas enregistrée, ou si l'une des migrations incluses l'est déjà.

État au 2026-11-21 : migrations 1 à 6 appliquées et enregistrées. Reste la 7 :
`npm run db:bundle -- 20261121000700`, puis étape 2. Sans elle, l'app et l'API ne peuvent ni lire ni écrire.

Privilèges : sur les projets Supabase récents, une nouvelle table du schéma `public` ne donne à `anon`,
`authenticated` et `service_role` que TRUNCATE, REFERENCES, TRIGGER et MAINTAIN. Toute migration qui
crée une table doit donc accorder ses droits explicitement (modèle : `20261121000700_table_privileges.sql`).
Le banc PGlite (`supabase/tests/supabase-shim.sql`) reproduit ce comportement.

Option B — script avec jeton d'accès personnel (supabase.com/dashboard/account/tokens, préfixe `sbp_`) :
`supabase/.env` (ignoré par Git) contient `SUPABASE_ACCESS_TOKEN=sbp_…`, puis
`node --env-file=supabase/.env supabase/scripts/apply-remote.mjs` (`--dry-run` pour lister sans appliquer).
N'applique que les migrations absentes, puis lance les contrôles. Révoquer le jeton après usage.

Option C — serveur MCP Supabase (déclaré dans `.mcp.json`) : redémarrer Claude Code, `/mcp` > supabase >
authentification, puis demander l'application des migrations.

### Vérification

Coller `supabase/verify.sql` dans le SQL Editor : chaque ligne doit afficher `ok = true` (7 migrations,
17 tables, RLS partout, trigger profil, buckets privés, politiques Storage, 7 tables Realtime, règlement
fermé aux clients, privilèges de tables conformes, aperçu d'invitation ouvert). La dernière requête liste la tâche `complice-reminders`.

### Rappels planifiés (pg_cron)

La migration 6 active `pg_cron` et planifie `run_due_reminders()` toutes les 10 minutes (fin de vote dans
moins de 24 h, ouverture de capsule). Si la dernière requête de `verify.sql` échoue : Database >
Extensions > activer `pg_cron`, puis
`select cron.schedule('complice-reminders', '*/10 * * * *', 'select public.run_due_reminders()');`.
Sans pg_cron, l'app déclenche aussi `refresh_reminders()` à l'ouverture et au retour au premier plan
(idempotent) : les rappels arrivent alors à la prochaine ouverture d'un membre.

### Auth

Lecture publique (`GET /auth/v1/settings`, 2026-11-20) : e-mail activé, inscription ouverte,
**confirmation d'e-mail obligatoire** (`mailer_autoconfirm: false`), aucun fournisseur tiers. Les
Redirect URLs, modèles d'e-mail et SMTP ne sont pas lisibles sans accès administrateur : à contrôler
dans le tableau de bord.

Authentication > URL Configuration > **Redirect URLs** : ajouter
- `complice://**` (development build et version installée)
- `exp://**` (Expo Go en développement)

Authentication > Email Templates : pour permettre la saisie d'un **code** (utile en Expo Go, où les
liens s'ouvrent mal), ajouter `{{ .Token }}` dans les modèles « Confirm signup » et « Reset Password »,
par exemple : `Ton code Complice : {{ .Token }}`.

Le service d'e-mail intégré de Supabase est limité (quelques e-mails par heure) et n'envoie qu'aux
adresses des membres de l'organisation Supabase. Pour des tests à plusieurs comptes, configurer un SMTP
(Authentication > SMTP Settings) ou créer les comptes avec le script de démo (section 4), qui les
confirme directement (nécessite la clé secrète dans `backend/.env`).

### Clé secrète

Project Settings > API Keys > **Secret keys** : créer une clé et la placer uniquement dans
`backend/.env` (`SUPABASE_SECRET_KEY`) et dans les variables Render. Jamais dans `mobile/`.

## 2. Backend local

```bash
cp backend/.env.example backend/.env   # compléter SUPABASE_SECRET_KEY
npm run backend                        # http://localhost:3000/health
```

## 3. App mobile

```bash
cp mobile/.env.example mobile/.env
npm run mobile                         # puis scanner le QR code avec Expo Go
```

### Relier le téléphone au backend

`EXPO_PUBLIC_API_URL` dans `mobile/.env` :
- téléphone sur le même Wi-Fi que le PC : `http://<IP du PC>:3000` (`ipconfig`, adresse IPv4).
  Autoriser Node.js dans le pare-feu Windows (réseau privé) ;
- émulateur Android : `http://10.0.2.2:3000` ;
- Render : `https://<nom-du-service>.onrender.com`.

Relancer Expo après toute modification de `.env`.

### Expo Go ou development build

Tout le MVP actuel fonctionne dans **Expo Go** (SDK 58) : Supabase, AsyncStorage, SVG, sélecteur
d'images, sélecteur de date, presse-papiers. Limites d'Expo Go :
- le schéma `complice://` n'est pas enregistré : un lien d'invitation partagé n'ouvre pas l'app.
  Contournement : écran « Rejoindre un groupe », coller le lien ;
- les notifications push distantes ne sont pas disponibles (non utilisées à ce stade).

Development build (Android, possible sur ce PC Windows) :

```bash
cd mobile
npx expo install expo-dev-client
npx expo run:android            # Android Studio + SDK requis ; JDK 17 recommandé
# ou dans le cloud : npx eas-cli@latest build --platform android --profile development
```

iOS : build uniquement via EAS (cloud) et compte Apple Developer payant.

## 4. Mode démonstration et comptes de test

```bash
cd backend
DEMO_PASSWORD='<mot de passe de 10+ caractères>' npm run seed:demo
```

PowerShell : `$env:DEMO_PASSWORD='…'; npm run seed:demo`.

Le script crée 4 comptes confirmés (`lea|sarah|hugo|camille.demo@example.com`) et un événement
marqué `is_demo = true` (badge « Données de démo » dans l'app) :

| Compte | Rôle | Ce qu'il permet de tester |
|---|---|---|
| Léa | Organisatrice | réglages, invitations, rôles, retrait, choix du cadeau |
| Sarah | Coorganisatrice | invitations participant, gestion limitée |
| Hugo | Participant | proposer, voter, contribuer, missions |
| Camille | Bénéficiaire | ne voit rien avant l'ouverture ; capsule après |

Les données de démo sont identifiables : `events.is_demo`, `contributions.is_simulated`, e-mails en `@example.com`.

Sans clé secrète (état du 2026-11-21), 4 comptes confirmés ont été créés directement en SQL sur le projet
distant : `lea` (organisatrice), `hugo` (participant), `camille` (bénéficiaire), `nora` (extérieure),
tous en `.demo@example.com`. Mot de passe commun dans `supabase/.bundle/comptes-test.txt` (ignoré par Git,
présent sur le poste de développement seulement). `seed:demo` les réutilise s'il est lancé plus tard.

## 5. Render

Service en ligne : `https://complice-api.onrender.com`.

1. Render Dashboard > **New > Blueprint** > dépôt `Flav-Walk/Projetfintech`, branche `main`.
   Render lit `render.yaml` (service `complice-api`, région Francfort, plan gratuit).
2. Renseigner les variables marquées `sync: false` : `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
3. Déployer, puis vérifier `https://<service>.onrender.com/health` (`"status":"ok"`, `"admin_configured":true`).
4. Mettre cette URL dans `EXPO_PUBLIC_API_URL`.

Service créé à la main (hors Blueprint) : complice-api > **Settings > Build & Deploy** :
- **Branch** : `main` (pas `backend`) ;
- **Health Check Path** : `/health` ;
- **Auto-Deploy** : « On Commit ».

Contrôle : après un push sur `main`, `/health` renvoie `"version"` = les 7 premiers caractères du
commit de `main` (variable `RENDER_GIT_COMMIT`). `/` répond 404 : c'est normal, l'API n'a pas de page d'accueil.

`render.yaml` déclare un `buildFilter` : seul un push qui modifie `backend/**`, `packages/shared/**`,
`package.json` ou `package-lock.json` déclenche un déploiement. Un push limité à `mobile/`, `docs/` ou
`supabase/` laisse volontairement l'ancienne version en ligne.

Diagnostic du 2026-11-20 : `/health` sert `a640951` alors que `main` et `backend` sont à `6fa6d61`, et
que deux commits intermédiaires (`de186f2`, `24b20d3`) touchent les chemins filtrés. Le build reproduit
localement réussit. La cause est donc côté Render (auto-deploy désactivé, build en échec, branche ou
Blueprint non synchronisé) : à lire dans complice-api > **Events** et **Logs**, puis
**Manual Deploy > Deploy latest commit** si besoin.

## 6. Premier test sur téléphone (Expo Go)

1. Installer **Expo Go** (Play Store / App Store), version compatible SDK 58.
2. `mobile/.env` :
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://uecptmijcjwmzdebeugk.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   EXPO_PUBLIC_API_URL=https://complice-api.onrender.com
   ```
3. Depuis la racine : `npm run mobile`, puis scanner le QR code (Android : Expo Go ; iPhone : appareil photo).
   Si le téléphone n'est pas sur le même réseau que le PC : `cd mobile && npx expo start --tunnel`.
4. Ouvrir `https://complice-api.onrender.com/health` dans le navigateur du téléphone une minute avant
   (réveil du plan gratuit).

Photos : l'app n'utilise que la galerie. `app.json` désactive les permissions caméra et micro
d'`expo-image-picker` (Android ne demande plus `RECORD_AUDIO`, iOS n'affiche plus de texte caméra).

Toutes les dépendances sont celles du SDK 58 (`npx expo install --check` : à jour) et fonctionnent dans
Expo Go ; un development build n'est nécessaire que pour les liens `complice://` et les notifications push.

### Parcours multi-comptes à tester

| # | Compte | Action | Attendu |
|---|---|---|---|
| 1 | Organisatrice | créer un événement, Membres > partager un lien participant et un lien bénéficiaire | lien `…/i/<jeton>` |
| 2 | Participant | Rejoindre > coller le lien, s'inscrire ou se connecter | arrive sur l'événement |
| 3 | Participant | Idées > proposer (prix, lien, photo), voter, changer de voix | classement à jour chez l'organisatrice sans recharger |
| 4 | Participant | Participer > 25 € > Confirmer (puis « Tester un refus ») | total collecté mis à jour ; montant visible du seul participant |
| 5 | Les deux | Missions > « Prendre la mission » sur la même mission | un seul gagne, l'autre voit « Trop tard » |
| 6 | Participant | Discussion > message ; Capsule > mot + photo > Sceller | compteurs scellés chez l'organisatrice, contenu invisible |
| 7 | Organisatrice | Réglages > avancer l'ouverture de la capsule (ou attendre la date) | le bénéficiaire voit l'événement et découvre la capsule |
| 8 | Compte extérieur | ouvrir un lien d'événement ou d'idée | « Événement introuvable » |

Le plan gratuit met le service en veille : la première requête après inactivité peut prendre ~1 min.
