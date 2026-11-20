# Installation et configuration

## 1. Supabase (une fois)

Projet : `https://uecptmijcjwmzdebeugk.supabase.co`.

### Appliquer les migrations

Fichiers à exécuter **dans l'ordre** (`supabase/migrations/`) :

1. `20261120000100_core.sql`
2. `20261120000200_gifts_contributions.sql`
3. `20261120000300_organisation_capsule.sql`
4. `20261120000400_storage_realtime.sql`
5. `20261120000500_function_privileges.sql`

Option A — interface : Supabase > SQL Editor > coller chaque fichier > Run.

Option B — CLI (nécessite un jeton d'accès personnel et le mot de passe de la base) :

```bash
npx supabase login                       # ouvre le navigateur
npx supabase link --project-ref uecptmijcjwmzdebeugk
npx supabase db push                     # applique supabase/migrations
```

Vérification : `select count(*) from public.events;` doit répondre 0 sans erreur.

### Auth

Authentication > URL Configuration > **Redirect URLs** : ajouter
- `complice://**` (development build et version installée)
- `exp://**` (Expo Go en développement)

Authentication > Email Templates : pour permettre la saisie d'un **code** (utile en Expo Go, où les
liens s'ouvrent mal), ajouter `{{ .Token }}` dans les modèles « Confirm signup » et « Reset Password »,
par exemple : `Ton code Complice : {{ .Token }}`.

Le service d'e-mail intégré de Supabase est limité (quelques e-mails par heure). Pour des tests à
plusieurs comptes, configurer un SMTP (Authentication > SMTP Settings) ou créer les comptes avec le
script de démo (section 4), qui les confirme directement.

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

## 5. Render

1. Render Dashboard > **New > Blueprint** > dépôt `Flav-Walk/Projetfintech`, branche `main`.
   Render lit `render.yaml` (service `complice-api`, région Francfort, plan gratuit).
2. Renseigner les variables marquées `sync: false` : `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
3. Déployer, puis vérifier `https://<service>.onrender.com/health` (`"status":"ok"`, `"admin_configured":true`).
4. Mettre cette URL dans `EXPO_PUBLIC_API_URL`.

Le plan gratuit met le service en veille : la première requête après inactivité peut prendre ~1 min.
