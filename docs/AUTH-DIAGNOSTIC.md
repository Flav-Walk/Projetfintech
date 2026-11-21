# Reprise Auth — 21 novembre 2026

## Incident distant constaté

Une seule inscription normale, autorisée par l'utilisateur avec sa boîte réelle, a été envoyée
à `/auth/v1/signup` avec prénom valide, mot de passe aléatoire et challenge PKCE S256.
Retour web demandé : `http://localhost:8081/auth/callback`.

- Heure : **18:50:04–18:50:05 Europe/Paris** (17:50:04–17:50:05 UTC).
- HTTP : **500**.
- Identifiant : `01a1ff3a-c9d6-74b2-b715-7d4b5e9ad71c`.
- Corps exact :

```json
{"code":500,"error_code":"unexpected_failure","msg":"Error sending confirmation email","error_id":"01a1ff3a-c9d6-74b2-b715-7d4b5e9ad71c"}
```

Le serveur signale une erreur à l'étape d'envoi du mail. La cause SMTP détaillée n'est pas encore
accessible : ne pas conclure à une mauvaise clé, un expéditeur refusé ou un trigger cassé sans logs.
Le diagnostic brut et les paramètres du test sont conservés uniquement dans
`supabase/.bundle/auth-diagnostic/` (ignoré par Git ; contient un mot de passe généré, ne pas partager).
Il ne s'agit pas d'une validation du parcours utilisateur et aucun e-mail reçu n'est confirmé.

## Cause établie (Logs > Auth, lus le 21/11 à 19:10)

Les quatre inscriptions de 17:38 à 17:50 UTC portent la même erreur SMTP :
`525 "5.7.1 Unauthorized IP address"`. Brevo refuse la connexion SMTP venant des serveurs de
Supabase parce que la **restriction d'adresses IP** (Brevo > Sécurité > IP autorisées) est active.
Ce n'est ni la clé SMTP, ni l'expéditeur, ni un trigger : l'authentification n'est même pas atteinte.
Le 401 « IP non autorisée » de l'API Brevo depuis ce poste a la même origine ; il menace aussi
l'envoi des e-mails métier depuis Render, dont les IP sortantes changent.

Correction (côté Brevo, par le titulaire du compte) : désactiver le blocage des IP inconnues,
car les IP sortantes de Supabase Auth et de Render ne sont pas fixes. Les inscriptions ratées
n'ont laissé aucun compte dans `auth.users` (vérifié en lecture seule) : on peut réessayer
avec la même adresse.

État vérifié en lecture seule à 19:10 : registre des migrations = 10 entrées 2026,
13/13 contrôles de `supabase/verify.sql` à `true`, tâches `complice-reminders` et
`complice-email-outbox` actives, `email_outbox` vide ; Render `/health` = `3041d88`, e-mails configurés.

## Vérifications distantes en lecture seule (avant la lecture des logs)

- `/auth/v1/settings` : `disable_signup=false`, fournisseur e-mail actif,
  `mailer_autoconfirm=false` ; confirmation obligatoire conservée.
- Render `/health` : version `3041d88`, `admin_configured=true`, `email_configured=true`.
- Objets migration 10 présents : `event_thanks.event_id`, `notification_prefs.emails`,
  `email_outbox.status` lus avec la clé serveur. Le registre des migrations, les fonctions,
  les triggers et les tâches planifiées n'ont pas été vérifiés à distance. Aucun SQL distant exécuté.
- API Brevo `/v3/senders` : **401, IP locale non autorisée**. Cela empêche de vérifier les
  expéditeurs depuis ce poste ; ce contrôle API est distinct du SMTP Supabase et ne démontre
  pas la cause du 500. Aucun changement de liste d'IP n'a été fait.
- `backend/.env` absent au début. Variables serveur trouvées dans `mobile/.env`, déplacées
  vers `backend/.env`, ajout des URL Supabase/API et de l'origine web locale ; mobile ne garde
  que les variables publiques. Aucun secret affiché ou commité.

## Information indispensable pour terminer la correction SMTP

Dans le projet Supabase, **Logs > Auth**, retrouver `/signup` à l'heure et l'identifiant ci-dessus.
Copier le message SMTP détaillé en retirant toute clé, tout mot de passe et tout jeton.
Si le message signale la base, lire aussi **Logs > Postgres** dans ce créneau.
Un accès via l'intégration Supabase permettrait de lire directement ces éléments ; elle a été
proposée, mais sa connexion n'est pas confirmée.

Selon le message constaté, vérifier **Authentication > Emails > SMTP Settings** : hôte
`smtp-relay.brevo.com`, port `587`, identifiant SMTP fourni par Brevo, **clé SMTP** dans Password,
adresse expéditrice active dans Brevo. La clé API de `backend/.env` ne remplace pas la clé SMTP.
Contrôler aussi les modèles effectivement installés : les fichiers HTML Git ne prouvent pas
leur installation. Les variables prévues sont `{{ .ConfirmationURL }}` et `{{ .Token }}`.
Ne pas désactiver confirmation, PKCE ou RLS. Ne pas retenter avant correction de la cause constatée.

Vérification SQL en lecture seule pour le registre, si besoin :

```sql
select version, name from supabase_migrations.schema_migrations order by version;
select pg_get_functiondef('public.handle_new_user()'::regprocedure);
select tgname, tgenabled, pg_get_triggerdef(oid)
from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
```

Puis exécuter les contrôles de `supabase/verify.sql`. Ne pas rejouer les migrations.

## Corrections mobiles

- `@supabase/auth-js` 2.119.2, `generatePKCEChallenge` : test de `crypto.subtle` et `TextEncoder`,
  puis SHA-256 ; leur absence provoquait le retour en `plain` et le warning Android.
- `expo-crypto` ~58.0.8 déjà installé et inclus dans Expo Go SDK 58 : adaptateur natif minimal
  `getRandomValues` / `subtle.digest(SHA-256)` chargé avant `createClient`.
  L'entropie et le hash viennent des primitives Expo, sans algorithme cryptographique maison.
  Sur web, le WebCrypto du navigateur est conservé. Cet adaptateur n'implémente pas toutes les
  opérations SubtleCrypto (par exemple `importKey`/`verify`) ; l'app n'utilise pas `getClaims`.
- Erreurs Auth 500 traduites sans détail serveur. Callback : erreurs query/fragment filtrées,
  échange unique pendant le rejeu des effets React, reprise du type recovery et du flow id éventuel.
- Invitation persistante jusqu'à une adhésion réussie ou un résultat « déjà membre », y compris
  lors d'une reprise réseau. Récupération du mot de passe : invitation portée dans le retour aussi.
- Écran de vérification : code de 6 à 8 chiffres et texte qui distingue demande et réception.

## Validation réelle restante

Les tests locaux utilisent une réponse Auth simulée pour examiner les requêtes PKCE ; ils
n'attestent ni le SMTP natif sur téléphone, ni la réception d'un mail. Aucun appareil dans `adb devices`.

Après correction SMTP et autorisation des callbacks précis de SETUP.md :

1. Relancer Expo depuis `mobile/` : `npx expo start --clear`.
2. Web : ouvrir `http://localhost:8081`, une invitation participant valide et non épuisée,
   puis « Créer un compte et rejoindre ». Utiliser une vraie boîte sans compte précréé.
   La tentative de diagnostic a échoué ; vérifier dans Auth > Users si une entrée subsiste
   avant de choisir création ou renvoi de confirmation, sans création administrative.
3. Créer le compte une seule fois. Noter heure, statut et identifiant de requête si erreur.
4. Dans Brevo Transactional > Logs : distinguer **acceptation** et **Delivered**. Demander
   ensuite à l'utilisateur s'il a **reçu** le mail (boîte et indésirables).
5. Ouvrir le lien dans le même navigateur/profil ; vérifier le retour à la bonne cagnotte.
   Autre appareil ou Expo Go : saisir le code dans l'écran de vérification de la demande initiale.
6. Se déconnecter, puis se reconnecter avec le mot de passe choisi.
7. Demander une réinitialisation ; refaire les trois contrôles (acceptation, livraison, réception).
   Ouvrir le lien ou saisir le code, enregistrer le nouveau mot de passe, se déconnecter et se
   reconnecter avec celui-ci.
8. Android Expo Go : scanner le QR code, refaire une demande autorisée ; vérifier l'absence du
   warning WebCrypto et le challenge `code_challenge_method=s256` dans la requête réseau.
   Le lien `complice://` demande une version installée ; le callback Expo Go utilise son adresse réelle.
9. Lien expiré/déjà consommé : message contrôlé, invitation conservée, possibilité de reprendre
   avec le code ou la connexion après confirmation. Sur une autre installation, PKCE n'a pas
   son vérificateur : utiliser le code, ne pas contourner PKCE.

Sources techniques : [Expo Crypto SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/),
[Expo Linking SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/linking/),
[Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
code des dépendances installées dans `node_modules/@supabase/auth-js/src/lib/helpers.ts`.

## Vérifications locales exécutées

- SQL 46/46, shared 6/6, backend 14/14 et mobile 6/6 : **72 tests**.
- TypeScript des trois workspaces, ESLint mobile, dépendances Expo compatibles SDK 58.
- Exports web et Android/Hermes réussis.
- Chrome headless sur l'export web : lien expiré en fragment, message sûr et invitation persistante ;
  formulaire d'inscription avec réponse SMTP 500 simulée, une seule requête S256, message traduit,
  invitation conservée. Aucun e-mail émis par ces contrôles navigateur.
- Secrets serveur absents des fichiers suivis et des exports ; aucun historique Git des `.env` locaux.
- Android : compilation vérifiée, aucune exécution sur appareil. Envoi accepté par Brevo,
  livraison, réception et fin des parcours réels restent non vérifiés.
