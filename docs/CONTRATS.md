# Branches et contrats partagés

## Branches

- `main` : version intégrée et vérifiée (tests verts). On n'y développe pas directement.
- `front` : développement mobile (`mobile/`).
- `backend` : API et migrations (`backend/`, `supabase/`).
- Chaque branche contient tout le dépôt. La séparation se fait par dossier.
- Cycle : travail sur `front` ou `backend` → tests → fusion dans `main` → `main` refusionnée dans
  `front` et `backend` pour les garder à jour.
- Plusieurs agents en parallèle : un worktree par branche (`git worktree add ../complice-front front`),
  jamais deux agents sur le même worktree.

## Propriétaires des contrats

Un contrat ne change que sur la branche de son propriétaire, puis passe par `main`.

| Contrat | Fichiers | Propriétaire | Consommateurs |
|---|---|---|---|
| Schéma, RLS, RPC, Storage | `supabase/migrations/*` | branche `backend` | mobile, API |
| Codes d'erreur métier | `packages/shared/src/errors.ts` | branche `backend` | mobile |
| Types du domaine et des RPC | `packages/shared/src/domain.ts` | branche `backend` | mobile, API |
| Montants (centimes, format) | `packages/shared/src/money.ts` | branche `backend` | mobile, API |
| API REST `/v1/*` | `backend/src/app.ts` | branche `backend` | `mobile/src/lib/api.ts` |
| Jetons visuels | `mobile/src/theme/tokens.ts`, `DESIGN.md` | branche `front` | mobile |

Règles :
- une migration appliquée ne se modifie plus : on en ajoute une nouvelle ;
- toute nouvelle RPC est ouverte explicitement dans la migration des privilèges, car tout est fermé par défaut ;
- toute nouvelle règle d'accès arrive avec son test dans `supabase/tests/`.
