# Suivi des lots

| Lot | Contenu | État |
|---|---|---|
| 1 | Monorepo, branches, analyse de la planche (`DESIGN.md`), contrats, migrations complètes | **fait** |
| 2 | Comptes, création d'événement, invitations, accueil d'événement, membres, réglages, profil | **fait côté code**, non vérifié contre Supabase (migrations à appliquer) |
| 3 | Propositions et votes, contributions simulées | **fait côté code**, testé en base locale ; non vérifié de bout en bout |
| 4 | Missions, discussion, capsule, timbres, rappels | **fait côté code**, testé en base locale ; non vérifié de bout en bout |
| 5 | Vérification distante multi-comptes, téléphone, revue sécurité/accessibilité | **bloqué** : migrations non appliquées à distance |

## Lots 3-4 — 2026-11-20

### Réalisé
- Migration 6 : rappels `vote_closing` / `capsule_open` (pg_cron toutes les 10 min + déclenchement
  par l'app), notification « message » (une par heure et par événement), `create_task`, chemin des
  images de proposition imposé, proposition retirée définitive, `can_view_event` sans NULL.
- Écrans : Idées (classement temps réel, réactions, commentaires, égalité, indisponible, prix modifié,
  choix confirmé), formulaire d'idée (lien, photo privée), Participer (montants, validation, récap,
  simulation explicite, échec et nouvelle tentative, reprise idempotente, historique), Missions
  (prise concurrente, terminer, libérer, (ré)attribuer, rouvrir, créer avec échéance), Discussion
  (pagination, temps réel, file d'envoi sans doublon, reprise), Capsule (brouillon, photo, aperçu,
  scellement, dévoilement, souvenirs), timbres et célébration, notifications par type.
- Outillage : `npm run db:bundle`, `supabase/verify.sql`, `supabase/scripts/apply-remote.mjs`,
  serveur MCP Supabase déclaré dans `.mcp.json`.

### Vérifié (exécuté)
- `npm test` : SQL **35/35** (dont un parcours complet idée → vote → contribution → mission → message
  → capsule → dévoilement, accès d'un extérieur refusé, rappels idempotents), shared **5/5**, backend **8/8**.
- Typage mobile OK, ESLint 0 problème, export web Expo réussi, `npx expo install --check` à jour.
- Fichier regroupé + `verify.sql` exécutés sur une base vierge (PGlite) : 9 contrôles OK.
- `https://complice-api.onrender.com/health` : 200, `admin_configured: true`, version `a640951`.

### Non vérifié / limites
- Aucune table sur le Supabase distant : écrans non testés contre de vraies données, ni sur téléphone.
- Render sert `a640951` et déployait depuis `backend` : branche à passer sur `main`.
- Paiement simulé uniquement ; frais à 0 €.
- Notifications push non implémentées (development build + clés FCM/APNs nécessaires).
- Réactions et commentaires des idées : actualisés au retour sur l'écran (non publiés en Realtime).

## Lots 1-2 — 2026-11-20

### Réalisé
- Schéma complet en 5 migrations : profils, événements, membres et rôles, invitations (hash, expiration,
  révocation, usage unique), propositions, votes, réactions, commentaires, contributions simulées
  idempotentes, missions, discussion, capsule, timbres, notifications in-app, Storage privé, Realtime.
- Toutes les fonctions SQL sont fermées par défaut et ouvertes une par une
  (`20261120000500_function_privileges.sql`).
- API Fastify : `/health`, `/i/:jeton` (page d'ouverture de l'app), `POST/GET /v1/contributions`
  (prestataire simulé derrière une interface), `DELETE /v1/account`. Blueprint Render.
- App Expo :
  - accueil, inscription, connexion, validation de l'e-mail (lien PKCE ou code), mot de passe oublié et nouveau mot de passe, déconnexion ;
  - « Mes événements » (en cours / souvenirs) et création d'événement en 3 étapes avec image facultative ;
  - accueil d'événement (cagnotte, étapes, prochaine action, dates, activité, temps réel) ;
  - membres et invitations (création, partage, révocation, rôles, transmission, retrait, départ) ;
  - réglages (échéances passées verrouillées) ;
  - profil (prénom, préférences de notifications, informations sur les données, suppression du compte) ;
  - notifications in-app ;
  - lien profond `complice://invite/<jeton>` : retour sur l'invitation après connexion ou inscription.
- Mode démo : `npm run seed:demo` (4 comptes, 4 rôles, données marquées `is_demo`).

### Vérifié (exécuté)
- `npm run test:db` : **28/28**. Postgres réel (PGlite) avec émulation des rôles Supabase. Couverture :
  - isolation entre événements et utilisateurs, refus anonymes et écritures directes ;
  - rôles, invitations (valide, invalide, expirée, révoquée, épuisée, déjà membre, retiré), retrait immédiat ;
  - bénéficiaire aveugle avant le dévoilement ;
  - votes (unicité, changement, confidentialité, égalité, clôture, retrait, prix) ;
  - contributions (idempotence, règlement réservé au serveur, total, échec puis nouvelle tentative, confidentialité) ;
  - mission disputée par deux personnes, timbres non cumulables, Storage, suppression de compte ;
  - fonctions internes non appelables.
- `npm run test:shared` : **5/5** ; `npm run test:backend` : **8/8**.
- Typage : `npm run typecheck` OK (shared, backend, mobile) ; ESLint mobile : 0 erreur.
- API compilée lancée en local : `/health` 200, `/i/<jeton>` 200, POST sans jeton 401.
- App en version web (Chromium, 390×844) : accueil, inscription (erreurs de champ), connexion, mot de
  passe oublié, rejoindre (lien invalide), invitation (état d'erreur), redirection de `/events` sans session.

### Faille trouvée et corrigée pendant le lot
Les privilèges par défaut de Supabase rendaient toute fonction exécutable par `authenticated`. Un
utilisateur aurait pu confirmer lui-même son paiement (`contribution_settle`), s'attribuer des timbres
ou créer des notifications. Toutes les fonctions sont désormais fermées par défaut. Un test de
non-régression couvre ce cas.

### Non vérifié / limites
- **Migrations non appliquées** au projet Supabase (pas d'accès administrateur sur le poste) :
  l'app affiche « service pas encore prêt » sur les écrans qui lisent la base.
- Inscription réelle, e-mails, temps réel et Storage non testés de bout en bout.
- Aucun test sur téléphone physique ni émulateur à ce stade (Expo Go non lancé).
- Écrans Idées, Missions, Capsule, Discussion, Participer : marqués « arrive au lot 3/4 ».
- Notifications push : non implémentées (in-app seulement). `vote_closing` et `capsule_open`
  nécessitent une tâche planifiée (pg_cron ou Render cron) : à faire au lot 4.
- Le bénéficiaire qui rejoint avant le dévoilement ne voit pas l'événement dans sa liste (comportement voulu, à signaler dans l'interface).

### Actions manuelles requises
1. Appliquer les 5 migrations (docs/SETUP.md §1).
2. Ajouter les Redirect URLs `complice://**` et `exp://**`, et `{{ .Token }}` dans les modèles d'e-mail.
3. Créer une clé secrète Supabase et la placer dans `backend/.env` (puis Render).
4. Créer le service Render via le Blueprint (docs/SETUP.md §5).
