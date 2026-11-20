# DESIGN.md — COMPLICE

Référence : la planche visuelle retenue (8 écrans, novembre 2026). Les jetons sont implémentés dans
`mobile/src/theme/tokens.ts`. Ce document fixe les règles. Le code les applique.

## Direction

**Chaleureux, complice, clair.** Une application de fête qui reste un outil : on doit savoir en
3 secondes où en est le groupe et quoi faire ensuite. La chaleur vient de la couleur corail, de la
mascotte et des écritures manuscrites. La clarté vient d'une hiérarchie stricte : un titre, un état,
une action principale par écran.

Ce que COMPLICE n'est pas : une app bancaire froide, un jeu à points, un réseau social.

## Couleurs (rôles)

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Fond | `bg` | `#FFF7F2` | Fond crème de tous les écrans clairs |
| Surface | `surface` | `#FFFFFF` | Cartes, champs, listes |
| Surface douce | `surfaceSoft` | `#FDEEE8` | Encadrés d'information (montant, rappel) |
| Lavande | `lavender` | `#EFEAFF` | Organisation, prochaine action, info de confidentialité |
| Encre | `ink` | `#2A1446` | Titres et texte principal (violet très sombre, jamais noir pur) |
| Encre douce | `inkSoft` | `#6B5A7E` | Texte secondaire, métadonnées |
| Corail | `coral` | `#F2553D` | **Argent et action principale** : cagnotte, Participer, Rejoindre, Confirmer |
| Corail clair | `coralSoft` | `#FFE1D9` | Fond de pastille corail, piste de jauge |
| Violet | `violet` | `#6A4BF5` | **Organisation collective** : étapes, vote, missions, capsule, onglet actif secondaire |
| Violet nuit | `night` | `#2B1758` | Écran capsule scellée (seul écran sombre) |
| Jaune | `sun` | `#FFC93C` | Nœud de la mascotte, timbre « Idée », célébration |
| Vert | `success` | `#1F9D61` | Missions terminées, validation |
| Rouge erreur | `danger` | `#C62F2F` | Erreurs uniquement (distinct du corail) |

Règle de séparation (corrige la planche) : **le corail parle d'argent, le violet parle d'organisation.**
La progression financière (jauge corail, %) et la progression collective (étapes violettes, x/5)
ne sont jamais mélangées dans un même composant.

Contraste : texte `ink` sur `bg` ≥ 13:1 ; blanc sur `coral` ≥ 3:1. Le blanc sur corail est donc
réservé aux libellés de bouton en gras ≥ 16 px. Le texte courant sur corail est interdit.

## Typographie

- **Titres** : Nunito Black (900), interlettrage serré (-0,5). Tailles : `display` 40, `h1` 28, `h2` 22, `h3` 18.
- **Texte** : Nunito SemiBold (600) 16 / 22 ; métadonnées Nunito SemiBold 13.
- **Chiffres d'argent** : Nunito Black, chiffres tabulaires. Le montant domine, l'objectif est plus petit (« 135 € / 180 € »).
- **Manuscrit** : Caveat 22, uniquement pour les mots de la capsule et les citations. Jamais pour une action.
- Taille dynamique respectée (`allowFontScaling`), plafonnée à 1,4× sur les titres d'affichage.

## Mise en page

- Gouttière 20 px, rythme 4 px (4, 8, 12, 16, 20, 24, 32).
- Rayons : carte 20, bouton 16, champ 14, pastille 999.
- Ombres très douces (`#2A1446` à 6 %), jamais de bordure grise dure : bordure `#F0E6E0` 1 px.
- Cibles tactiles ≥ 48 px. Bouton principal pleine largeur en bas de contenu.
- Barre d'onglets d'événement : Accueil, Idées, Missions, Capsule, Discussion. Icônes linéaires 1,75 px. Actif en corail.

## Composants

- **Bouton** : `primary` (corail plein), `secondary` (violet plein), `outline` (bord encre 1,5 px), `ghost`.
  États chargement (indicateur + libellé conservé), désactivé (opacité 0,45), pression (échelle 0,98 si les animations sont permises).
- **Champ** : libellé au-dessus, icône à gauche facultative, message d'erreur sous le champ en `danger`, jamais seulement la couleur.
- **Carte cagnotte** : fond corail, montant en blanc, jauge blanche, pourcentage en pastille. Pourcentage = arrondi inférieur, borné à 100.
- **Suivi d'étapes** : 5 pastilles reliées (Groupe, Vote, Achat, Capsule, Jour J). Faite = violet plein + coche ;
  en cours = anneau violet ; à venir = anneau gris. Le compteur « x/5 » compte les étapes faites.
- **Timbre** (`components/stamps.tsx`) : carré blanc à bord perforé (SVG), panneau pastel et pictogramme
  linéaire. Gagné = couleur ; à gagner = gris pointillé avec la condition écrite dessous.
  Couleurs : Idée = jaune, Voix = lavande, Coup de main = menthe, Plume = rose `#FFE1EC`,
  Complice (participation) = corail clair, seul timbre lié à l'argent. Aucun timbre ne dépend du montant.
- **Célébration** (`components/celebration.tsx`) : bandeau violet nuit en haut d'écran avec le timbre gagné,
  250 ms (fondu 150 ms si « Réduire les animations »), annoncé au lecteur d'écran, 3 s puis disparaît.
  Déclenché par la base (une attribution = une célébration).
- **Capsule** : écran violet nuit ; mots en Caveat sur carte blanche légèrement inclinée ; avant
  l'ouverture, seuls des compteurs (mots, photos) sont visibles.
- **Avatar** : rond 36 px avec bord blanc 2 px, pile avec chevauchement de 10 px, « +n » au-delà de 6.
- **Mascotte** : cadeau-cœur corail avec nœud jaune et visage. Elle apparaît à l'accueil, dans les états vides et au dévoilement. Jamais dans une erreur.

## Mouvement

- Durées 150 à 250 ms, courbe douce. Célébration (étape franchie, capsule ouverte) : 600 ms max.
- `Réduire les animations` du système : toutes les animations décoratives sont remplacées par un fondu court ou supprimées.

## Ton et gamification

- Tutoiement, phrases courtes, verbes d'action (« Voter pour le cadeau », « Prendre la mission »).
- Pas de fausse urgence, pas de compte à rebours anxiogène, pas de classement des donateurs.
- Les montants individuels ne sont jamais affichés aux autres. Les timbres récompensent proposer, voter, aider,
  écrire et participer, **sans lien avec le montant donné**.

## Incohérences de la planche corrigées

1. Étapes « 4/5 » avec 5 pastilles cochées : le compteur suit désormais les étapes réellement faites.
2. « Missions 2/5 » avec 3 missions listées : la liste montre toutes les missions et le compteur en découle.
3. Écran de vote « Mon vote » sans possibilité de changer : le vote est modifiable jusqu'à la clôture, avec la date affichée.
4. Écran d'invitation qui demande un e-mail avant de connaître l'utilisateur : l'invitation affiche l'événement, puis propose de créer un compte ou de se connecter, et rejoint automatiquement ensuite.
5. Récapitulatif de contribution : la ligne « Frais » indique « 0 € (simulation) » et un bandeau « Paiement simulé » est visible avant la confirmation.

## Décisions ouvertes

- Mode sombre complet : seul l'écran capsule est sombre au MVP.
- Illustrations des écrans vides : mascotte vectorielle simple au MVP, illustrations dédiées plus tard.
