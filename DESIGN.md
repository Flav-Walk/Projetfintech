# DESIGN.md — COMPLICE (v3 « papier, ruban et tampon », 2026-11-24)

## v3 : ce qui change (prime sur les sections v2 ci-dessous)
- **Méthode** : guides `mobile-app-ui-design` (hiérarchie, 60/30/10, grille 8, règle pic-fin) et
  `mobile-design` (cibles 44–48 px, zone du pouce, alternative à chaque geste, animations transform/opacité),
  appliqués sans leurs consignes web (Tailwind, CSS) incompatibles avec le natif.
- **Palette** : papier `#FBF5EE` (60 %), aubergine `#24123D` pour texte, bulles personnelles, boutons
  secondaires et blocs forts (30 %), accents (10 %) : corail = argent/action principale, violet = organisation
  (sélection, progression), soleil = célébration/idée, nuit = capsule et surprise. Plus d'aplats violets répétés.
- **Typographie** : 5 tailles (34/24/19/16/13), Bricolage Grotesque pour titres et chiffres, Nunito pour le
  texte, Caveat seulement pour le rendu d'un mot (jamais pour la saisie).
- **Formes selon la fonction** : étiquette 8 (dates, statuts posés sur une image), champ 14, bloc 18,
  couverture et cartes fortes 22, feuille 28, boutons en pilule. Ombres réservées aux éléments flottants.
- **Composition** : sections sans carte séparées par un filet (« Le cadeau », « Échéances »…), couverture
  pleine largeur en tête de cagnotte, cartes de l'accueil à couverture + échéance en étiquette, une seule
  action principale par bloc, textes d'aide au toucher (« ? », « En savoir plus ») plutôt que permanents.
- **Couvertures** : 6 illustrations SVG originales (`components/cover-art.tsx`) ; priorité photo → illustration
  choisie → illustration selon l'occasion ; l'illustration est toujours dessous (`event-cover.tsx`).
- **Mode démo** : jamais de bandeau ; une étiquette « Mode démo » repliable sur Participer, confirmations
  « Participation enregistrée ».

Jetons : `mobile/src/theme/tokens.ts`. Briques : `components/ui.tsx` (texte, bouton, champ, carte, bandeau),
`components/kit.tsx` (feuille modale, segmenté, lignes, squelettes, balayage), `components/avatar.tsx`,
`components/reactions.tsx`, `components/mascot.tsx`, `lib/toast.tsx`. Ce document fixe les règles.

## Direction
**Chaleureux, complice, clair.** Une app de fête qui reste un outil : en 3 secondes, on sait où en est le
groupe et quoi faire. La chaleur vient du corail, de la mascotte et de l'écriture manuscrite des mots de
capsule ; la clarté d'une hiérarchie stricte : un titre, un état, **une** action principale par écran.
Ce que COMPLICE n'est pas : une app bancaire froide, un jeu à points, un réseau social.

## Couleurs (rôles)
| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Fond | `bg` | `#FFF8F2` | Crème de tous les écrans clairs |
| Surface | `surface` / `surfaceSoft` / `sand` | `#FFFFFF` / `#FDF0E8` / `#F6E8DE` | Cartes et listes / encarts / pistes, segmentés, squelettes |
| Encre | `ink` (aubergine) | `#2A1446` | Texte, barres, icône de l'app (jamais de noir pur) |
| Encre douce | `inkSoft` / `inkFaint` | `#655478` / `#A595B5` | Secondaire (≥ 4,5:1 sur crème) / désactivé, décor |
| **Corail** | `coral` / `coralInk` | `#F2553D` / `#B5361F` | **Argent et action principale** ; `coralInk` pour du texte corail sur fond clair |
| **Violet** | `violet` / `lavender` | `#6A4BF5` / `#EFEAFF` | **Organisation collective** : étapes, vote, missions, sélection |
| Nuit | `night` | `#251149` | Capsule, surprise du bénéficiaire (seuls écrans sombres) |
| Soleil | `sun` / `sunInk` | `#FFC93C` / `#7A5200` | Célébration, étape en cours, ruban de la mascotte |
| Menthe | `mint` / `success` | `#D5F2E3` / `#177E50` | Accompli (≥ 4,5:1 en texte) |
| Erreur | `danger` | `#C62F2F` | Erreurs uniquement (distinct du corail) |

Règle : **le corail parle d'argent, le violet d'organisation** ; jamais mélangés dans un même composant.
Blanc sur corail réservé aux libellés gras ≥ 16 px. Pas de dégradés décoratifs ; ombres basses (`shadow.card`).

## Typographie
- **Titres et montants** : Bricolage Grotesque (ExtraBold 800, Bold 700), interlettrage serré.
  `display` 38, `h1` 28, `h2` 22, `h3` 18 ; `money` 40 et `moneySmall` 18 en chiffres tabulaires.
- **Texte** : Nunito SemiBold 16/23 ; `label` Nunito Bold 14 ; `overline` 12 majuscules espacées.
- **Manuscrit** : Caveat, uniquement pour les mots de la capsule.
- Taille dynamique respectée ; plafonnée à 1,4× pour `display`/`money`, 1,2–1,3× dans les barres d'onglets.
Licences : Bricolage Grotesque, Nunito, Caveat — SIL Open Font License (paquets `@expo-google-fonts`).

## Navigation
- **Principale** (`(app)/(main)`) : Accueil · Amis · **+** · Activité · Profil. Le « + » central ouvre une
  feuille « Créer une cagnotte / Rejoindre avec un lien ». Pastilles : invitations reçues (Accueil), demandes
  d'ami (Amis), notifications non lues (Activité). L'onglet Profil montre la photo.
- **Espace d'une cagnotte** (`event/[id]/(tabs)`) : Accueil · Idées · Missions · Capsule · Discussion,
  onglet actif sur pastille lavande. Membres, réglages et participation s'ouvrent par-dessus (pile).
- Les souvenirs (cagnottes ouvertes) sont dans Accueil > Souvenirs.

## Composants
- **Bouton** : `primary` corail, `secondary` violet, `outline`, `ghost`, `danger`, `white` ; 54 px (44 compact),
  rayon 18 ; chargement (indicateur + libellé), désactivé 45 %, pression échelle 0,98.
- **Champ** : libellé au-dessus, icône à gauche, élément à droite facultatif (ex. coche « disponible »),
  erreur sous le champ en texte, jamais seulement en couleur.
- **Feuille modale** (`Sheet`) : poignée, titre, bouton fermer, contenu défilant, pied fixe ; glisse du bas.
- **Segmenté**, **puces de choix**, **lignes de liste** groupées (`Group` + `Divider`), **squelettes** de chargement.
- **Balayage** (`SwipeRow`) : actions rapides (retirer, bloquer) ; toujours doublées d'un bouton et exposées
  comme actions d'accessibilité.
- **Toast** : confirmation brève en bas, avec action facultative ; annoncé au lecteur d'écran.
- **Carte cagnotte** : corail, total en `money`, « / objectif », jauge animée, % et reste, « Ta participation »,
  clôture, note de confidentialité. **Jamais** de montant d'un autre membre.
- **Préparatifs** : violet, 5 étapes reliées (faite = blanc coché, en cours = soleil numéroté) et 3 compteurs.
- **Prochaine étape** : carte colorée selon le type (violet organisation, soleil idée/attente, nuit capsule,
  corail clair cagnotte), grand pictogramme en filigrane, un seul bouton.
- **Avatar** : photo ronde ou initiales sur pastel stable par personne ; pile avec chevauchement, « +n ».
- **Timbres** : bord perforé SVG, Idée/Voix/Coup de main/Plume ; aucun timbre lié à l'argent n'est affiché.
- **Réactions** : 5 visages dessinés (J'adore, Coup de cœur, Trop drôle, À voir, Bof) dans le style de la
  mascotte ; plus aucun emoji système comme icône d'interface.

## Mascotte, logo, icône
- **Cadô** : cœur-cadeau corail, ruban et nœud soleil, visage aubergine. Humeurs : joie, clin d'œil, calme,
  surprise, fête (confettis). Dans l'accueil, les états vides, la surprise et le dévoilement ; jamais dans une erreur.
- **Logo** : Cadô + « complice » en Bricolage Grotesque ExtraBold minuscule.
- **Icône d'app** : Cadô sur fond aubergine, lisible jusqu'à 29 px (vérifié) ; Android adaptatif (premier plan
  dans la zone de sécurité, version monochrome). Générée depuis le SVG (`mobile/assets/images`).

## Mouvement
150–320 ms, courbes douces ; jauges qui se remplissent (700 ms) ; apparitions en fondu montant décalé dans
les listes ; transition de pile glissée ; célébration ≤ 600 ms. « Réduire les animations » : fondus courts
ou aucune animation (jauges directement à leur valeur, squelettes fixes, feuilles en fondu).

## Ton
Tutoiement, phrases courtes, verbes d'action. Pas de fausse urgence, pas de classement des donateurs, pas de
culpabilisation. Voir `docs/GAMIFICATION.md` (leviers, gestes familiers, dark patterns refusés).

## Adaptation aux écrans
Gouttière 20 px ; aucune hauteur fixe sur un texte ; rangées qui passent à la ligne (`flexWrap`) ; filtres en
défilement horizontal ; zones sûres (encoche, barre de navigation Android) via `useSafeAreaInsets` ; clavier :
`KeyboardAvoidingView` dans les écrans et les feuilles ; cibles ≥ 44 px.
