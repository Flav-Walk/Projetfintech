# Outillage Claude Code

État constaté le 2026-11-20 sur le poste de développement.

| Outil | État | Usage dans COMPLICE |
|---|---|---|
| Superpowers | installé (plugin) | méthode : plan court, vérification avant annonce, débogage |
| ECC | agents installés via le socle global (`ecc-*`) | revue SQL et sécurité prévue en fin de lot (`ecc-database-reviewer`, `ecc-security-reviewer`) |
| Claude Mem | plugin installé, **désactivé par défaut** dans le socle global | activable pour ce projet sur demande. La mémoire native Claude Code est utilisée en attendant. Aucun secret ni donnée personnelle n'y est stocké |
| Graphify | skill installé | carte à générer quand les lots 3-4 seront en place (`/graphify`) ; sortie `graphify-out/` |
| Find Skills | skill installé | recherche de skills Expo, Supabase et accessibilité à faire au lot 5. Aucune installation sans accord |
| One Skill to Rule Them All | plugin `task-observer` installé | observe les corrections récurrentes ; toute modification de skill passe par son approbation |
| Gist murataslan1 | lu | « Claude Stack » en 5 couches, non technique. Retenu : contexte durable dans le dépôt (docs/, DESIGN.md), worktrees pour le parallèle |
| Floorplan | non installé | carte interactive des parcours à produire au lot 5 (vérifier licence et installation) |
| Recent, Aceternity UI | références consultables | Aceternity est une bibliothèque web (React DOM, Tailwind, Framer Motion), non transposable telle quelle en React Native : on n'en reprend que des idées d'interaction, réimplémentées avec Reanimated |
| Refero | consulté | structure de `DESIGN.md` (direction, typographie, rôles de couleur, mise en page, décisions ouvertes) |
| Plugin Claude « expo » | déclaré par le gabarit (`mobile/.claude/settings.json`), **non installé** sur le poste | à installer si utile (`/plugin`) : il apporte la documentation Expo à jour |

Bloquants d'accès :
- Supabase : aucun jeton d'administration sur le poste, migrations non appliquées. Voir docs/SETUP.md §1 ;
- Docker arrêté : pas de Supabase local. Les tests SQL utilisent PGlite ;
- le compte GitHub actif dans `gh` n'a que la lecture. Les push passent par le compte `Flav-Walk` (admin), sans changer le compte actif.
