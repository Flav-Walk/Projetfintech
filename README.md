# COMPLICE

Application mobile de cagnottes gamifiées pour préparer un cadeau à plusieurs : cagnotte (simulée),
idées et votes, missions, discussion, et une capsule de mots et photos dévoilée à la personne fêtée.

## Structure

| Dossier | Contenu |
|---|---|
| `mobile/` | App Expo SDK 58 (React Native 0.88, TypeScript, Expo Router) |
| `backend/` | API Node.js + Fastify (TypeScript), prête pour Render |
| `supabase/` | Migrations SQL (schéma, RLS, RPC, Storage, Realtime) et tests de sécurité |
| `packages/shared/` | Contrats partagés : montants en centimes, codes d'erreur, types des RPC |
| `docs/` | Installation, architecture, contrats, suivi |
| `DESIGN.md` | Règles visuelles tirées de la planche de référence |

## Démarrage rapide

```bash
npm install                      # à la racine (espaces de travail npm)
cp mobile/.env.example mobile/.env
cp backend/.env.example backend/.env   # ajouter SUPABASE_SECRET_KEY
npm test                         # SQL (PGlite) + paquet partagé + API
npm run backend                  # API sur http://localhost:3000
npm run mobile                   # Expo : QR code pour Expo Go
```

Les migrations doivent être appliquées au projet Supabase avant que l'app ne fonctionne avec des
données réelles : voir [docs/SETUP.md](docs/SETUP.md).

## Documentation

- [docs/SETUP.md](docs/SETUP.md) — Supabase, Render, téléphone, Expo Go, comptes de démo.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — répartition Supabase / API, droits, confidentialité, décisions.
- [docs/CONTRATS.md](docs/CONTRATS.md) — branches, propriétaires des contrats partagés.
- [docs/SUIVI.md](docs/SUIVI.md) — état des lots, vérifications, limites.
- [docs/OUTILLAGE.md](docs/OUTILLAGE.md) — outils Claude Code utilisés et leur état.
