# Amis, invitations et confidentialité (migration 11)

Source de vérité : `supabase/migrations/20261122001100_friends_invites_funding.sql`, testée par
`supabase/tests/social.test.mjs` (organisateur, participant, ami invité, invité par e-mail sans compte,
bénéficiaire, personne extérieure, personne bloquée).

## Profil
- **Pseudo unique** (`@lea.martin`) : 3 à 20 caractères `a-z 0-9 . _`, généré à l'inscription à partir du
  prénom, modifiable par `set_username` (unicité et mots réservés contrôlés). Jamais d'e-mail affiché.
- **Photo** : bucket privé `avatars/{user_id}/…`, URL signées de 10 min. Visible de soi, des membres d'une
  cagnotte commune, des amis, et des personnes avec qui une demande ou une invitation est en cours.

## Amis
| Situation | Comportement |
|---|---|
| Recherche | Préfixe du pseudo, 2 caractères minimum, 10 résultats, ni e-mail ni photo sans relation |
| Demande en double | `already_pending`, aucune deuxième notification |
| Demandes croisées | Deviennent une amitié acceptée immédiatement |
| Annulation | La demande et la notification non lue disparaissent |
| Refus | Discret : le refus n'est montré à personne ; une relance dans les 30 jours est acceptée sans effet |
| Quota | 30 demandes envoyées par 24 h |
| Retirer un ami | Supprime la relation seulement : **aucune cagnotte commune n'est modifiée** |

## Blocage
- Supprime l'amitié et les demandes, annule les invitations nominatives en attente entre les deux personnes.
- La personne bloquée ne trouve plus le bloqueur en recherche, ne peut plus lui envoyer de demande ni
  d'invitation (réponse identique à un envoi normal, sans effet : le blocage n'est pas révélé).
- **Les cagnottes communes continuent** : personne n'est retiré en silence. Pour exclure quelqu'un d'un
  groupe, un gestionnaire utilise « Retirer du groupe ».
- Déblocage depuis Profil > Personnes bloquées ; l'amitié n'est pas rétablie automatiquement.

## Inviter dans une cagnotte
| Type | Qui peut l'utiliser | Règles |
|---|---|---|
| **Ami (nominative)** | La personne invitée, dans l'app | Organisateur ou coorganisateur ; uniquement ses amis ; jusqu'à 20 à la fois, 100 par cagnotte et par jour ; expire après 14 jours ; « Rejoindre » ou « Refuser », jamais d'adhésion silencieuse ; pas de relance dans les 7 jours après un refus |
| **E-mail (nominative)** | Seul le compte **vérifié** de cette adresse | Lien personnel à usage unique, 7 jours ; un autre compte reçoit `wrong_account` ; après connexion, l'invitation apparaît dans l'app (rejoindre ou refuser) ; si le compte existe déjà, elle y apparaît tout de suite ; même adresse dans l'heure : rien de plus |
| **Lien de partage** | Toute personne qui a le lien | Durée et nombre d'usages choisis ; désactivable à tout moment |

États suivis par les gestionnaires (`event_invites_overview`) : envoyée, a rejoint, refusée, annulée, expirée.
Les adresses e-mail n'apparaissent que masquées (`ca•••@exemple.fr`).

## Bénéficiaire
- Invitation dédiée (un seul bénéficiaire par cagnotte) : ni titre, ni nombre de membres, ni détail des
  préparatifs dans l'invitation, la notification, le lien ou l'e-mail.
- Après acceptation, la cagnotte reste invisible jusqu'à l'ouverture. L'accueil montre seulement
  « Une surprise se prépare », la date d'ouverture et l'organisateur (`my_surprises`).

## Cagnotte : ce qui est visible
| Donnée | Organisateurs, participants | Bénéficiaire | Extérieur |
|---|---|---|---|
| Total collecté, objectif, reste, % | oui | non | non |
| Ma propre participation | oui (la sienne) | — | non |
| Participation des autres | **jamais** | non | non |
| Annonce d'une nouvelle participation | anonyme, sans montant | non | non |

Limite : le total exact permet des déductions par différence dans un petit groupe ; l'app le signale.

## Suppression de compte
Profil, photo, amitiés, blocages et invitations nominatives sont supprimés (clés étrangères en cascade).
L'organisation d'une cagnotte est transmise (`prepare_account_deletion`) ; les participations restent
comptées sans nom.
