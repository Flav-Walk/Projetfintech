# COMPLICE — cartographie des données et confidentialité (2026-11-24)

Document de travail établi à partir du schéma de la base (migrations 1 à 14), du code de l'app et de l'API,
et des configurations du dépôt. Ce n'est **pas** une attestation de conformité au RGPD : les bases juridiques,
durées et informations légales signalées « à valider » relèvent de l'éditeur.

## Informations indispensables manquantes (une seule demande)
À fournir par l'éditeur avant toute publication :
1. Identité et coordonnées du **responsable du traitement** (personne ou société, adresse) et, le cas échéant, du DPO.
2. **Adresse de contact** pour l'exercice des droits.
3. **Région du projet Supabase** (Dashboard > Project Settings > General > Region) — non vérifiable depuis le dépôt.
4. **Région réelle du service Render** (le blueprint `render.yaml` demande Francfort ; à confirmer dans le tableau de bord).
5. Signature des **DPA** (accords de sous-traitance) Supabase, Render et Brevo, et pays des éventuels sous-traitants ultérieurs.
6. Validation des **durées de conservation** proposées ci-dessous.

## Prestataires (sous-traitants)
| Prestataire | Rôle | Données | Région | Vérifié |
|---|---|---|---|---|
| Supabase | Base Postgres, authentification, stockage des photos, temps réel, tâches planifiées | Toutes les données de l'app | Non indiquée dans le dépôt | Non : à relever dans le tableau de bord |
| Render | API COMPLICE (contributions simulées, invitations par e-mail, suppression de compte, pages publiques) | Jetons de session en transit, journaux HTTP (IP, chemin, code) | `region: frankfurt` dans `render.yaml` | Configuration seulement |
| Brevo | Envoi des e-mails : codes Auth (SMTP configuré dans Supabase) et e-mails métier (API depuis Render) | Adresse du destinataire, contenu de l'e-mail | Non indiquée dans le dépôt | Non : à confirmer dans le DPA Brevo |

Aucune donnée n'est envoyée à un service d'analyse, de publicité ou de suivi : vérifié dans les dépendances de
l'app (aucun SDK d'analyse) et dans les appels réseau mesurés (Supabase et API COMPLICE uniquement).

## Cartographie
Durées : **propositions à valider**. « Purge » = `purge_stale_data()` (migration 14), planifiée chaque nuit par pg_cron.

| Catégorie | Données | Finalité | Base juridique à examiner | Accès | Stockage | Conservation proposée | Suppression / export |
|---|---|---|---|---|---|---|---|
| Compte | e-mail, mot de passe (haché par Supabase Auth), date de confirmation | Connexion, confirmation par code, réinitialisation | Exécution du contrat (service demandé) | La personne ; jamais les autres membres | Supabase Auth | Durée du compte | Suppression du compte (API `DELETE /v1/account`) ; export : `export_my_data()` |
| Profil | prénom, pseudo, photo | Se reconnaître entre membres et amis | Contrat | Membres des mêmes cagnottes, amis, personnes invitées par elle ; recherche : pseudo et prénom seulement, photo seulement en cas de relation | `profiles`, bucket privé `avatars` | Durée du compte | Supprimés avec le compte (photo comprise) ; export |
| Session | jetons d'accès et de rafraîchissement | Rester connecté | Contrat | L'appareil | Stockage local de l'app (AsyncStorage) ; Supabase Auth | Jusqu'à déconnexion ou expiration | Effacés à la déconnexion, avec le cache et les brouillons locaux |
| Relations | demandes d'ami, amitiés, blocages | Inviter facilement, se protéger | Contrat / intérêt légitime (blocage) | Les deux personnes ; blocage : son auteur seul | `friendships`, `user_blocks` | Durée du compte | Supprimés avec le compte ; export |
| Invitations (personne sans compte) | adresse e-mail en clair dans la file d'envoi, empreinte SHA-256 et indice masqué (`ni•••@domaine`) sur l'invitation | Envoyer une invitation personnelle et la rattacher au bon compte après confirmation de l'adresse | Intérêt légitime de la personne qui invite, à examiner (la personne invitée n'a rien demandé) | Le serveur ; l'organisation voit seulement l'indice masqué | `email_outbox`, `invitations` | Adresse en clair : 30 jours après l'envoi (ou 7 jours si bloquée) ; empreinte et indice : effacés 30 jours après expiration, utilisation ou annulation | Purge automatique ; aucun compte créé sans la personne |
| Groupes et rôles | appartenance, rôle, dates | Organiser la cagnotte | Contrat | Membres de la cagnotte ; la personne fêtée seulement après l'ouverture | `event_members`, `events` | Durée de la cagnotte | Départ du groupe ; suppression du compte (organisation transmise, sinon cagnotte supprimée) |
| Préparatifs | idées, réactions, commentaires, votes, missions, journal | Choisir et organiser le cadeau | Contrat | Préparateurs seulement (jamais la personne fêtée) ; votes privés sauf choix contraire de l'organisation | `proposals`, `votes`, `tasks`, `activity`… | Durée de la cagnotte | Compte supprimé : idées et commentaires conservés sans auteur, votes et réactions supprimés |
| Participations (simulées) | montant, statut | Total de la cagnotte | Contrat | La personne seule pour son montant ; le groupe voit le total | `contributions`, `event_finances` | Durée de la cagnotte | Compte supprimé : montant conservé dans le total, sans auteur ; export |
| Messages | texte de la discussion | Se coordonner | Contrat | Préparateurs | `messages` | Durée de la cagnotte | Compte supprimé : messages conservés sans auteur ; export |
| Capsule | mots, photos, brouillons | Surprise le jour J | Contrat | Brouillon : son auteur seul ; mot déposé : groupe et personne fêtée **après l'ouverture** | `capsule_entries`, bucket privé `event-media` | Durée de la cagnotte | Compte supprimé : mots et photos supprimés ; export (textes et chemins) |
| Remerciement | message de la personne fêtée | Remercier le groupe | Contrat | Membres après l'ouverture | `event_thanks` | Durée de la cagnotte | Compte supprimé : conservé sans auteur |
| Notifications | type, cagnotte, date de lecture | Informer dans l'app | Contrat | La personne | `notifications` | Lues : 180 jours | Purge ; supprimées avec le compte |
| E-mail facultatif | annonce d'ouverture de capsule | Prévenir le jour J | Consentement (préférence « Aussi par e-mail », désactivable) | La personne | `email_outbox` (30 jours) | 30 jours après envoi | Préférence ; purge |
| Journaux techniques | IP, méthode, chemin, code HTTP ; en-tête Authorization masqué | Sécurité, diagnostic | Intérêt légitime | Hébergeurs | Render (journaux de l'API), Supabase (journaux de la plateforme) | Selon les hébergeurs (non configuré dans le dépôt) | — |

## Cas de la personne invitée sans compte
- **Données conservées** : l'adresse en clair dans la file d'e-mails (30 jours après l'envoi), et sur l'invitation une
  empreinte SHA-256 de l'adresse et un indice masqué (`ni•••@exemple.fr`), effacés 30 jours après expiration,
  utilisation ou annulation. L'organisation ne voit jamais l'adresse complète.
- **Information reçue** : l'e-mail dit qui invite, que le lien est personnel, valable 7 jours, et qu'aucun compte n'est
  créé sans elle. La personne fêtée reçoit un message sans titre ni détail des préparatifs ; la page web du lien est
  neutre pour tout le monde (corrigé le 2026-11-24).
- **Relances** : aucune relance automatique. L'organisation peut renvoyer (un nouvel e-mail, l'ancien lien est révoqué).
- **Expiration** : 7 jours ; le lien n'est utilisable que par un compte dont l'adresse confirmée est la même.
- **Abus** : 1 envoi par heure et par adresse, 50 par jour et par cagnotte (contrôles en base) ; la limite de débit de
  l'API ne se contourne plus par un en-tête forgé (corrigé le 2026-11-24). Une personne bloquée n'est pas invitée.
- **Limite** : il n'existe pas de liste d'opposition (« ne plus jamais m'inviter ») pour une adresse sans compte.
  Décision à prendre.

## Photos
- Avant l'envoi, l'image est redimensionnée (côté long ≤ 1 600 px) et ré-encodée en JPEG, ce qui retire les
  métadonnées ; à l'envoi, les segments Exif/XMP/IPTC/commentaires (JPEG) et texte/eXIf (PNG) sont retirés en plus
  (`stripImageMetadata`, testé). HEIC/WebP non ré-encodés en cas d'échec de la préparation : métadonnées possibles.
- Buckets privés (5 Mo, types image seulement), lecture par URL signée de 10 minutes après contrôle des droits
  (`can_read_media`) ; photos d'idées réservées aux préparateurs ; photos de capsule seulement publiées et après l'ouverture.
- Aucune permission demandée avant le geste « choisir une photo » (sélecteur système).

## Textes de l'app et des pages publiques
- App : Profil > « Tes données » (`mobile/src/app/(app)/privacy.tsx`), « Exporter mes données », préférences d'e-mail.
- Web : `/confidentialite` (servie par l'API), marquée « version de travail » tant que les informations ci-dessus manquent.
