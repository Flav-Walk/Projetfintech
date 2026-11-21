# Gamification, leviers et dark patterns

COMPLICE cherche à rendre l'organisation d'un cadeau commun plus simple et plus agréable, pas à
maximiser le temps passé dans l'app ni les montants versés. Chaque levier ci-dessous est une
**hypothèse à tester**, pas un résultat prouvé.

## Règles non négociables
- **La gamification ne récompense jamais l'argent.** Aucun timbre, classement, message ou animation ne
  dépend du fait de participer ni du montant. Le timbre « Complice » existe en base pour l'historique,
  mais il n'est ni affiché, ni annoncé, ni proposé comme « à gagner » (migration 9, `stamps.tsx`).
- **Les récompenses correspondent à de vraies actions**, attribuées une seule fois par événement (clé
  unique en base) : répéter une action ne rapporte rien de plus.
- **Pas d'incitation sans lien avec l'organisation** : pas de série quotidienne, pas de notification de
  relance générique, pas de faux compte à rebours.

## Leviers utilisés

| Amélioration | Difficulté visée | Levier | Bénéfice attendu (hypothèse) |
|---|---|---|---|
| Étapes de préparation (Groupe, Vote, Achat, Capsule, Jour J) | « Où en est-on ? » se pose dans la discussion | Progression visible, objectif collectif | Moins de questions répétées, sentiment d'avancer ensemble |
| Prochaine action contextualisée | Ne pas savoir quoi faire en ouvrant l'app | Réduction de la charge mentale, petit engagement | Une action claire par visite ; disparaît quand elle est faite |
| Récapitulatif (cadeau, missions, dates) | Décisions noyées dans la discussion | Mémoire externe | Retrouver une décision en un coup d'œil |
| Modèles (anniversaire, départ, naissance) | Formulaire long, dates à inventer | Valeurs par défaut utiles | Création plus rapide, dates cohérentes ; tout reste modifiable |
| Missions par défaut selon l'occasion | Oublier une étape (carte, pot de départ) | Liste prête à l'emploi | Répartition plus juste des tâches |
| Timbres Idée, Voix, Coup de main, Plume | Contributions non financières invisibles | Reconnaissance | Valoriser ceux qui aident sans payer davantage |
| Confirmation immédiate (toast, retour haptique) | Doute « est-ce que ça a marché ? » | Retour immédiat | Moins de doubles appuis, confiance |
| Idées « À découvrir » avant le classement | Le premier en tête capte les voix | Ordre neutre propre à chacun | Votes plus réfléchis ; les nombres de voix restent réels et consultables |
| Capsule scellée jusqu'à une vraie date | Garder la surprise | Anticipation | Envie d'écrire un mot, découverte marquante |
| Remerciements du bénéficiaire | Le groupe ne sait pas si le cadeau a plu | Réciprocité, clôture | Fin d'événement positive, souvenir complet |
| Prochaine étape « pour toi » (migration 11) : inviter → proposer → voter → choisir → finir sa mission → écrire son mot → prendre une mission → cagnotte (en dernier, neutre) | Ne pas savoir par où commencer | Petit engagement, une seule action | L'action change dès qu'elle est faite ; jamais de pression sur l'argent |
| Préparatifs : compteurs Idées, Missions x/y, Mots scellés x/y | Reconnaissance collective invisible | Progression collective visible | Chacun voit ce qui reste, sans comparaison individuelle |
| Total de la cagnotte visible (migration 11) | « Où en est la cagnotte ? » | Transparence collective | Le groupe voit le total et le reste ; jamais qui a donné combien |
| Lecture des mots un par un (capsule ouverte) | Une longue liste dilue l'émotion | Anticipation, révélation progressive | Découverte marquante, page finale de remerciement collectif |
| Amis et invitations en deux touches | Recopier des liens dans plusieurs messageries | Réseau existant, effort minimal | Groupes formés plus vite ; chacun accepte ou refuse |

## Gestes familiers repris (pas des dark patterns)
Barre d'onglets avec bouton central « + », tirer pour actualiser, balayer une ligne pour révéler ses actions
(toujours doublées d'un bouton accessible), pastilles de nouveautés, confirmations brèves avec retour haptique,
feuilles modales en bas d'écran, lecture « story » des souvenirs. Ces gestes réduisent l'effort ; aucun ne
pousse à payer, à revenir sans raison, ni ne masque une information.

## Ce qui a été demandé et refusé
Une demande de « dark patterns » a été formulée le 2026-11-22. Ils ne sont pas implémentés : ils iraient contre
les règles ci-dessus et contre la confiance attendue d'une app qui manipule de l'argent entre proches
(pratiques commerciales trompeuses, consentement vicié). Les leviers familiers ci-dessus en tiennent lieu.

## Dark patterns écartés

| Pratique | Pourquoi elle est tentante | Ce que fait COMPLICE |
|---|---|---|
| Afficher qui a donné et combien | « Effet de groupe » sur les montants | Montants individuels privés ; seul le total est partagé ; annonces anonymes |
| Timbre ou classement liés à la participation | Augmenter le taux de paiement | Aucun timbre financier visible |
| Montants suggérés élevés, pré-sélectionnés | Augmenter le panier | Suggestions modestes, rien de présélectionné, montant libre |
| Frais révélés au dernier moment | Conversion | Frais affichés avant confirmation (0 € en simulation), paiement simulé indiqué avant de confirmer |
| Faux compte à rebours, fausse activité | Urgence artificielle | Dates réelles fixées par le groupe ; activité uniquement issue d'actions réelles |
| Relances culpabilisantes (« tout le monde a participé sauf toi ») | Pression sociale | Aucune relance financière ; la prochaine action « cagnotte » est formulée sans insistance |
| Consentement pré-coché, e-mails marketing | Croissance de la base | Préférences par défaut limitées à l'organisation ; aucun e-mail marketing ; e-mails désactivables |
| Suppression de compte cachée ou en plusieurs étapes | Rétention | Profil > Supprimer mon compte : une confirmation, conséquences expliquées avant |
| Série quotidienne, notification sans objet | Rétention | Aucune |

## Limites assumées
- Le total exact permet des déductions par différence, surtout dans un petit groupe (à deux, le total moins
  sa propre part donne celle de l'autre). L'app le dit sur la carte de la cagnotte et au moment de participer.
- Les effets attendus ci-dessus n'ont pas été mesurés.
