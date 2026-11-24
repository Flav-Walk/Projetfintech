# DESIGN.md — COMPLICE (v4 « papier, ruban et tampon, sans violet », 2026-11-24)

## v4.1 (lot 10) : personne fêtée et en-têtes
- **En-têtes des onglets de cagnotte** (`EventTabHeader`) : plus de miniature de couverture. Ligne de retour =
  chevron rond + nom de la cagnotte (une seule cible, retour à son accueil), actions à droite ; titre 30 ;
  ligne d'état ; **perforation** de ticket (pointillés) nouée d'un trait de ruban à la couleur de la page
  (soleil Idées, encre Missions, corail Capsule, menthe Discussion). `BackHeader` reprend la perforation (encre).
- **Espace de la personne fêtée** (`app/(app)/surprise/[id].tsx`) : sa seule navigation. Toute entrée dans une
  cagnotte (lien, notification, carte) la redirige ici (`event/[id]/_layout`). Trois états :
  - *scellée* : enveloppe de papier, ruban corail, sceau de cire au verrou soleil (`components/sealed-capsule.tsx`),
    respiration lente ; au toucher, elle frémit et un court message rappelle la date ; compte à rebours en
    blocs (jours/h/min, puis h/min/s) corrigé de l'horloge du téléphone ; date d'ouverture en clair ;
  - *prête* : le verrou s'ouvre, un halo soleil pulse sous le sceau, « Ouvrir ma capsule » apparaît ;
  - *ouverture* (1,7 s, une fois, mémorisée côté serveur) : le sceau se détache, le ruban se dénoue en quatre,
    le rabat se lève, des confettis de papier s'échappent, puis les mots arrivent un par un ; « Passer
    l'animation » ; « Réduire les animations » = fondu court ; haptique de succès au bris du sceau (natif seulement).
  - *souvenirs* : lettres manuscrites signées (avatar + prénom), galerie de photos (visionneuse plein écran),
    merci au groupe, « Revoir l'ouverture ». Capsule vide : message honnête, pas de mise en scène.
- **Le groupe** : la personne fêtée est une étiquette à part (« Recevra la surprise », liseré corail, statut à
  pastille, action adaptée : Inviter [prénom] / Renvoyer / Annuler) ; puis « Préparent la surprise ». Le
  transfert d'organisation n'est expliqué qu'au moment de quitter.

## v4 : ce qui change (prime sur v3 et v2 ci-dessous)
- **Violet et lavande retirés** (`violet`, `violetDark`, `lavender`, `lavenderStrong` n'existent plus dans les
  jetons : toute réintroduction échoue au typage). Décision par rôle, pas par substitution :
  | Rôle | v4 |
  |---|---|
  | Sélection (puces, segmentés, interrupteurs, coches, occasion choisie) | aplat **encre** `ink`, texte blanc ; sélection légère = filet encre sur `sand` |
  | Liens d'action | **encre**, gras, soulignés soleil (`TextLink`), flèche « → » |
  | Navigation (onglet actif) | icône et libellé encre + **repère soleil** de 16×3 sous le libellé ; jamais de pastille colorée |
  | Progression d'organisation (missions, création) | encre sur piste `sand` ; menthe quand c'est fini ; corail réservé à l'argent |
  | Notifications, pastilles de nombre | corail (`coralDark`) |
  | Focus d'un champ | filet encre 2 px |
  | Cartes « organisation » (prochaine étape, cadeau retenu) | aplat encre ; « idée » soleil ; « argent » corail ; « capsule » nuit |
  | Familles d'icônes (journal, activité) | `tints` : argent (corail), soleil (fête, échéance, idée), groupe (sable/encre), fait (menthe), capsule (nuit/soleil) |
  | Illustrations | prune/nuit/rose papier/terre cuite (`blush`, `plum`, `TERRACOTTA` réservé au dessin « départ ») |
- **Contrastes** : bouton principal `coralDark` (4,8:1 avec le blanc ; le corail vif reste pour les aplats
  d'illustration et la cagnotte en grands chiffres) ; `inkFaint` passe à `#7B697D` (4,7:1 sur papier).
  Désactivé = aplat sable + texte `inkFaint` (plus de transparence qui grisait en mauve).
- **En-têtes** (`components/headers.tsx`), une famille :
  - `ScreenHeader` (Accueil, Amis, Activité, Profil) : surtitre corail facultatif (date), titre 32, ligne d'état
    (`HeaderMeta`, pastille de couleur alignée sur la 1re ligne), actions rondes à droite ou avatar ;
  - `EventTabHeader` (Idées, Missions, Capsule, Discussion) : ligne de contexte = mini-couverture de la cagnotte
    + son titre (retour à son accueil) + actions ; titre 30 sur toute la largeur ; ligne d'état ;
  - `BackHeader` (écrans empilés) : retour rond, titre 28, contexte ;
  - `HeaderAction` : seul bouton d'en-tête (44 px, filet `inkLine`, appui sable ; variante `cover` sur image).
  Le détail de marque est contextuel (couverture de la cagnotte, pseudo en billet pointillé, date du jour),
  jamais une décoration répétée.
- **Menu « + »** (`components/start-menu.tsx`) : une valeur d'animation pilote tout. Ouverture 280 ms
  (courbe sortie douce, sans rebond), fermeture 190 ms ; voile papier 94 % ; le pictogramme tourne de 45°
  (+ → ×) et le bouton passe du corail à l'encre ; les deux choix sortent du bouton, le plus proche d'abord.
  Fenêtre modale (focus piégé, focus sur « Créer »), retour Android et Échap ferment, appuis répétés repartent
  de la position courante, « Réduire les animations » = fondu court sans déplacement. Pictogrammes dessinés :
  paquet ficelé (créer), billet avec lien (rejoindre).
- **Préparatifs** (`components/preparations.tsx`, logique `lib/preparation.ts`) : quatre chantiers parallèles
  (groupe, cadeau, achat et missions, capsule), sans numéros. États réels : fait (tampon menthe incliné),
  en cours (soleil), pas commencé (pointillés) ; « À toi » sur le chantier de ta prochaine action ; jauge fine
  seulement si quelque chose a commencé ; ruban « Jour J » en pied.
- **Journal** (`components/journal.tsx`, logique `lib/journal.ts`) : repères carrés par famille reliés par un
  filet, action puis date ; actions consécutives regroupées (< 3 h, même jour) ; 4 entrées puis
  « Tout l'historique » en feuille. Participations : « Une nouvelle participation a été enregistrée. », jamais
  de nom, d'avatar ni de montant.
- **Capsule** : « Relire / Modifier » est une action texte posée dans la lettre (enveloppe scellée / plume
  dessinées), sans fond hors appui ; l'aperçu s'affiche dans le même cadre ; l'état général du mot est dans
  l'en-tête, la ligne d'état sous l'éditeur n'apparaît que pendant une modification ou après dépôt.
- **Boutons** : libellé sur deux lignes au besoin (grandes polices) ; dans les listes répétées (missions),
  l'action de carte est `outline` compacte, pas un aplat corail par carte.

## v3 (historique)
- **Méthode** : guides `mobile-app-ui-design` (hiérarchie, 60/30/10, grille 8, règle pic-fin) et
  `mobile-design` (cibles 44–48 px, zone du pouce, alternative à chaque geste, animations transform/opacité),
  appliqués sans leurs consignes web (Tailwind, CSS) incompatibles avec le natif.
- **Palette** : papier `#FBF5EE` (60 %), aubergine `#24123D` pour texte, bulles personnelles, boutons
  secondaires et blocs forts (30 %), accents (10 %) : corail = argent/action principale, ~~violet = organisation~~
  (remplacé en v4), soleil = célébration/idée, nuit = capsule et surprise.
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
