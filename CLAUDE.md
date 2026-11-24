# COMPLICE — instructions projet

App mobile de cadeaux communs (Expo SDK 58 + Supabase + API Fastify). Lire d'abord `docs/SUIVI.md`.

## Commandes (depuis la racine)
- `npm test` : tests SQL (PGlite), paquet partagé, API. À lancer avant toute fusion dans `main`.
- `npm run typecheck` ; lint mobile : `npm run lint --workspace mobile`.
- `npm run backend` (API locale) ; `npm run mobile` (Expo).

## Règles
- Les droits sont en SQL (RLS + RPC `SECURITY DEFINER`). Ne pas dupliquer de règle métier dans l'API ou l'app.
- Toute fonction SQL est fermée par défaut : l'ouvrir explicitement et ajouter un test dans `supabase/tests/`.
- Migration appliquée = non modifiable : en ajouter une nouvelle.
- Montants en centimes entiers. Jamais de montant individuel visible par un autre membre.
- Branches : `front` (mobile), `backend` (API + SQL), `main` (intégré, testé). Propriétaires des contrats : `docs/CONTRATS.md`.
- Design : `DESIGN.md`. Corail = argent, encre aubergine = organisation et sélection, soleil = repère actif (plus de violet ni de lavande depuis la v4).
- Windows : ne pas réécrire de fichier texte avec PowerShell 5.1 `Get-Content/Set-Content` (casse l'UTF-8).
- Expo : `npx expo install` pour les dépendances ; `expo lint` ne fonctionne pas dans le monorepo, utiliser `eslint src`.
