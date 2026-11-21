# E-mails COMPLICE

Deux circuits distincts, à ne pas confondre :

| | E-mails de compte | E-mails métier |
|---|---|---|
| Contenu | confirmation d'inscription, réinitialisation du mot de passe | invitation à rejoindre une cagnotte, ouverture de la capsule |
| Envoyés par | **Supabase Auth**, via le **SMTP** de Brevo | **l'API COMPLICE** (Render), via **l'API HTTP** de Brevo |
| Identifiants | identifiant SMTP + **clé SMTP** Brevo (Brevo > SMTP & API > SMTP) | **clé API** Brevo (`xkeysib-…`, Brevo > SMTP & API > API Keys) |
| Où les saisir | Supabase > Authentication > Emails > SMTP Settings | `backend/.env` (local) et Render > Environment |
| Modèles | `supabase/templates/confirmation.html`, `recovery.html` (à coller dans Supabase) | `backend/src/email-templates.ts` |

La clé API et la clé SMTP sont **deux secrets différents**. Aucune ne doit apparaître dans l'app mobile,
dans les journaux ou dans Git.

## E-mails de compte (Supabase Auth + SMTP Brevo)
Sans SMTP personnalisé, Supabase n'envoie qu'aux membres de l'organisation Supabase, avec un débit très
limité : un vrai nouvel utilisateur ne reçoit rien (l'app affiche alors « L'e-mail n'a pas pu partir »).

Réglages Supabase :
1. **Authentication > Emails > SMTP Settings** : activer ; hôte `smtp-relay.brevo.com`, port `587` ;
   identifiant = identifiant SMTP Brevo ; mot de passe = clé SMTP Brevo ; expéditeur = adresse validée
   dans Brevo ; nom = `COMPLICE`.
2. **Authentication > Emails > Templates** :
   - « Confirm signup » : objet « Confirme ton adresse pour rejoindre COMPLICE », corps = `supabase/templates/confirmation.html` ;
   - « Reset password » : objet « Choisis un nouveau mot de passe COMPLICE », corps = `supabase/templates/recovery.html`.
   Les deux contiennent le lien (`{{ .ConfirmationURL }}`) **et** le code (`{{ .Token }}`).
3. **Authentication > URL Configuration > Redirect URLs** : callbacks précis listés dans
   [SETUP.md](SETUP.md#auth), pour localhost, l'hôte Expo Go réel et `complice://auth/callback`.
   Le lien de confirmation ramène sur `/auth/callback`, avec le jeton d'invitation
   éventuel : la personne arrive directement dans la bonne cagnotte.
4. **Authentication > Rate Limits** : garder une limite d'envoi raisonnable (l'app impose aussi 60 s
   entre deux renvois).

Expo Go : le lien `exp://…` ne fonctionne que si l'e-mail est ouvert **sur le téléphone qui exécute
Expo Go**, pendant que le serveur Expo tourne. Sinon, le **code reçu (6 à 8 chiffres)** peut être
saisi dans l'écran de vérification. Le lien PKCE doit être ouvert sur l'appareil et dans le
stockage du navigateur qui a initié la demande ; un autre appareil doit utiliser le code.
Version installable : `complice://auth/callback` ouvre l'app directement.

## E-mails métier (API + Brevo)
- File `email_outbox` en base (migration 10), jamais lisible par l'app.
- **Invitation par e-mail** : un gestionnaire saisit une adresse (Membres > Inviter par e-mail) ; la base
  crée un lien à usage unique (7 jours) et met l'e-mail en file. Même adresse dans l'heure : rien de plus.
- **Ouverture de la capsule** : un e-mail par membre, une seule fois, si ses préférences « Capsule » et
  « Aussi par e-mail » sont actives (Profil > Notifications).
- **Envoi** : l'API réserve un lot (atomique), envoie via Brevo, enregistre le résultat. Erreur
  temporaire (réseau, 429, 5xx) : nouvel essai à 5 puis 20 min, 3 essais au plus. Erreur définitive
  (adresse refusée…) : abandon immédiat. Le jeton d'invitation est effacé de la file dès qu'il n'est
  plus utile ; les lignes envoyées ou abandonnées sont supprimées après 30 jours.
- **Réveil** : le plan gratuit de Render s'endort. Toutes les 5 minutes, s'il y a des e-mails en
  attente, la base appelle `POST /internal/outbox/drain` (pg_cron + pg_net), ce qui réveille l'API.
- **Liens** : `https://complice-api.onrender.com/i/<jeton>` (invitation) et `/e/<événement>` (capsule).
  Ces pages ne lisent rien en base et ouvrent l'app (`complice://…`). En Expo Go, la page affiche le code
  d'invitation à coller dans « Rejoindre un groupe ».

Variables (backend/.env et Render) : `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME=COMPLICE`,
`APP_PUBLIC_URL`. `GET /health` indique `email_configured`.

## Domaine expéditeur
Brevo exige un expéditeur validé (Senders & IP > Senders). Pour une bonne délivrabilité, authentifier le
domaine de l'adresse (Brevo > Domains : enregistrements SPF, DKIM et DMARC chez l'hébergeur DNS). Une
adresse Gmail ou Outlook comme expéditeur sera souvent classée en indésirables.

## Vérifier un envoi
Distinguer, à chaque essai :
1. **demande acceptée par Supabase** : absence d'erreur Auth ; cela ne prouve pas à elle seule
   un envoi Brevo (Supabase peut masquer un compte déjà existant). **Accepté par Brevo** : événement
   d'acceptation dans les logs transactionnels ou ligne `sent` avec `provider_message_id` (métier) ;
2. **livré** selon Brevo : Brevo > Transactional > Logs (statut « Delivered ») ;
3. **reçu** : constaté dans la boîte de réception (et non dans les indésirables) ;
4. **lien ouvert et parcours terminé** : l'app arrive sur la bonne cagnotte.
