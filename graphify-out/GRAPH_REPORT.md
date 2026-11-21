# Graph Report - Projet FINTECH  (2026-11-21)

## Corpus Check
- 124 files · ~125,652 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 893 nodes · 2207 edges · 79 communities (44 shown, 35 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0a2e8f54`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui.tsx
- seed-demo.ts
- queries.ts
- unwrap
- domain.ts
- capsule.tsx
- contribute.tsx
- backend/package.json
- expo
- scripts
- mobile/package.json
- shared/package.json
- compilerOptions
- compilerOptions
- helpers.mjs
- money.ts
- mobile/tsconfig.json
- Join
- dependencies
- bundle-migrations.mjs
- apply-remote.mjs
- eslint.config.js
- expo-clipboard
- expo-constants
- expo-crypto
- expo-device
- expo-font
- expo-glass-effect
- @expo-google-fonts/caveat
- @expo-google-fonts/nunito
- expo-image
- expo-image-picker
- app.ts
- expo-router
- expo-splash-screen
- expo-status-bar
- expo-symbols
- expo-system-ui
- @expo/ui
- expo-web-browser
- lucide-react-native
- .mcp.json
- react
- react-dom
- react-native
- @react-native-async-storage/async-storage
- app.test.ts
- react-native-gesture-handler
- react-native-reanimated
- react-native-screens
- react-native-url-polyfill
- FakeGateway
- react-native-worklets
- @supabase/supabase-js
- @tanstack/react-query
- SupabaseGateway
- README.md
- server.ts
- Reprise — vérification distante (2026-11-21)
- DESIGN.md — COMPLICE
- DataGateway
- gateway.ts
- Installation et configuration
- Revue de sécurité Supabase
- CreateEvent
- errors.ts
- Architecture et décisions
- Welcome to your Expo app 👋
- E-mails COMPLICE
- Gamification, leviers et dark patterns
- 1. Supabase (une fois)
- Lots 1-2 — 2026-11-20
- AGENTS.md
- COMPLICE — instructions projet
- Lot 6 — MVP complet (2026-11-21, `main` après fusion de `front` 39a6b83)
- Lots 3-4 — 2026-11-20
- expo-haptics
- react-native-safe-area-context
- react-native-svg

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 61 edges
2. `unwrap()` - 56 edges
3. `colors` - 41 edges
4. `T()` - 34 edges
5. `expo-router` - 30 edges
6. `Button()` - 26 edges
7. `space` - 24 edges
8. `useEventId()` - 23 edges
9. `Banner()` - 21 edges
10. `Row()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `submit()` --indirect_call--> `invite()`  [INFERRED]
  mobile/src/app/(auth)/sign-up.tsx → supabase/tests/helpers.mjs
- `FakeGateway` --implements--> `DataGateway`  [EXTRACTED]
  backend/src/app.test.ts → backend/src/gateway.ts
- `app()` --calls--> `buildApp()`  [EXTRACTED]
  backend/src/app.test.ts → backend/src/app.ts
- `AppDeps` --references--> `Config`  [EXTRACTED]
  backend/src/app.ts → backend/src/config.ts
- `AppDeps` --references--> `DataGateway`  [EXTRACTED]
  backend/src/app.ts → backend/src/gateway.ts

## Import Cycles
- None detected.

## Communities (79 total, 35 thin omitted)

### Community 0 - "ui.tsx"
Cohesion: 0.07
Nodes (72): AfterAuth(), OCCASIONS, TEMPLATES, EmailInvitePanel(), send(), NEXT, ICONS, LABELS (+64 more)

### Community 1 - "seed-demo.ts"
Cohesion: 0.20
Nodes (11): Config, loadConfig(), schema, admin, config, days(), ensureUser(), main() (+3 more)

### Community 2 - "queries.ts"
Cohesion: 0.06
Nodes (60): EXPIRY_LABELS, InvitationLine(), InvitePanel(), generate(), MemberLine(), SettingsForm(), save(), MyEvents() (+52 more)

### Community 3 - "unwrap"
Cohesion: 0.08
Nodes (56): IdeaDetail(), SealedCard(), Ideas(), MODE_LABELS, neutralOrder(), ViewMode, DateLine(), CreateTask() (+48 more)

### Community 4 - "domain.ts"
Cohesion: 0.07
Nodes (27): BADGE_LABELS, BadgeKind, CapsuleStats, CapsuleStatus, ClaimResult, ContributionResponse, ContributionStatus, CreateContributionRequest (+19 more)

### Community 5 - "capsule.tsx"
Cohesion: 0.11
Nodes (31): IdeaForm(), Capsule(), EntryEditor(), ThanksCard(), HelpCard(), deleteAccount(), AuthContext, AuthProvider() (+23 more)

### Community 6 - "contribute.tsx"
Cohesion: 0.08
Nodes (41): Contribute(), STATUS_LABEL, Step, EditIdea(), EventLayout(), Members(), EventSettings(), LockableDate() (+33 more)

### Community 7 - "backend/package.json"
Cohesion: 0.06
Nodes (35): dependencies, @complice/shared, fastify, @fastify/cors, @fastify/rate-limit, @supabase/supabase-js, zod, description (+27 more)

### Community 8 - "expo"
Cohesion: 0.06
Nodes (30): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, reactCompiler (+22 more)

### Community 9 - "scripts"
Cohesion: 0.09
Nodes (21): @electric-sql/pglite, description, devDependencies, @electric-sql/pglite, engines, node, name, private (+13 more)

### Community 10 - "mobile/package.json"
Cohesion: 0.10
Nodes (20): eslint, eslint-config-expo, devDependencies, eslint, eslint-config-expo, @types/react, typescript, typescript (+12 more)

### Community 11 - "shared/package.json"
Cohesion: 0.11
Nodes (18): description, devDependencies, @types/node, typescript, files, @types/node, typescript, main (+10 more)

### Community 12 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+7 more)

### Community 13 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+6 more)

### Community 14 - "helpers.mjs"
Cohesion: 0.35
Nodes (11): as(), createEvent(), createUser(), errorOf(), freshDb(), here, inDays(), invite() (+3 more)

### Community 15 - "money.ts"
Cohesion: 0.18
Nodes (13): fundingStepLabel(), AmountValidation, CONTRIBUTION_MAX_CENTS, CONTRIBUTION_MIN_CENTS, formatCents(), formatters, parseAmountToCents(), progressPercent() (+5 more)

### Community 16 - "mobile/tsconfig.json"
Cohesion: 0.18
Nodes (10): compilerOptions, paths, strict, extends, include, @/assets/*, ./assets/*, expo/tsconfig.base (+2 more)

### Community 17 - "Join"
Cohesion: 1.00
Nodes (3): Join(), paste(), submit()

### Community 18 - "dependencies"
Cohesion: 0.18
Nodes (11): expo, expo-linking, dependencies, @complice/shared, expo, expo-linking, @react-native-community/datetimepicker, react-native-web (+3 more)

### Community 19 - "bundle-migrations.mjs"
Cohesion: 0.22
Nodes (6): all, files, out, parts, prior, root

### Community 20 - "apply-remote.mjs"
Cohesion: 0.29
Nodes (5): applied, dryRun, files, pending, root

### Community 32 - "app.ts"
Cohesion: 0.23
Nodes (11): buildApp(), contributionBody, emailInvitationBody, fastify, FastifyInstance, FastifyRequest, uuid, eventLandingPage() (+3 more)

### Community 46 - "app.test.ts"
Cohesion: 0.25
Nodes (7): auth, config, FakeMailer, BrevoMailer, Mailer, MailerError, OutgoingEmail

### Community 51 - "FakeGateway"
Cohesion: 0.17
Nodes (4): requireUser(), FakeGateway, ClaimedEmail, GatewayError

### Community 55 - "SupabaseGateway"
Cohesion: 0.35
Nodes (3): pick(), SupabaseGateway, toGatewayError()

### Community 56 - "README.md"
Cohesion: 0.15
Nodes (8): Branches, Branches et contrats partagés, Propriétaires des contrats, Outillage Claude Code, COMPLICE, Documentation, Démarrage rapide, Structure

### Community 57 - "server.ts"
Cohesion: 0.20
Nodes (8): AppDeps, app(), ChargeRequest, ChargeResult, PaymentProvider, SimulatedPaymentProvider, config, mailer

### Community 58 - "Reprise — vérification distante (2026-11-21)"
Cohesion: 0.17
Nodes (11): Bloqué, Bloqué, Cartes, Erreur trouvée et corrigée, Migration 8 et adaptations de l'app (`a0a78c5`), Parcours distant après migrations 7 et 8 (2026-11-21, `166c5f1`), Reprise — application distante (2026-11-20, depuis `6fa6d61`), Reprise — vérification distante (2026-11-21) (+3 more)

### Community 59 - "DESIGN.md — COMPLICE"
Cohesion: 0.18
Nodes (10): Composants, Couleurs (rôles), DESIGN.md — COMPLICE, Direction, Décisions ouvertes, Incohérences de la planche corrigées, Mise en page, Mouvement (+2 more)

### Community 61 - "gateway.ts"
Cohesion: 0.42
Nodes (5): esc(), layout(), OutboxRow, renderEmail(), DrainResult

### Community 62 - "Installation et configuration"
Cohesion: 0.22
Nodes (9): 2. Backend local, 3. App mobile, 4. Mode démonstration et comptes de test, 5. Render, 6. Premier test sur téléphone (Expo Go), Expo Go ou development build, Installation et configuration, Parcours multi-comptes à tester (+1 more)

### Community 63 - "Revue de sécurité Supabase"
Cohesion: 0.25
Nodes (7): 1. Droits accordés par la migration 7, 2. Confidentialité, 3. Avis du conseiller Supabase, un par un, Performance (sans effet sur la sécurité), Revue de sécurité Supabase, Suite donnée : migration 8 (`20261121000800_privacy_hardening.sql`), Sécurité

### Community 64 - "CreateEvent"
Cohesion: 0.39
Nodes (8): CreateEvent(), applyTemplate(), submit(), validate(), defaultGiftDate(), shift(), deviceTimezone(), useCreateEvent()

### Community 65 - "errors.ts"
Cohesion: 0.29
Nodes (6): ERROR_MESSAGES, ErrorCode, errorCodeFrom(), INVITATION_MESSAGES, InvitationStatus, messageFor()

### Community 66 - "Architecture et décisions"
Cohesion: 0.29
Nodes (7): Architecture et décisions, Confidentialité, Décisions (réversibles), Départs et suppression de compte, Règles métier clés, Répartition Supabase / API, Rôles par événement

### Community 67 - "Welcome to your Expo app 👋"
Cohesion: 0.29
Nodes (6): Get a fresh project, Get started, Join the community, Learn more, Other setup steps, Welcome to your Expo app 👋

### Community 68 - "E-mails COMPLICE"
Cohesion: 0.33
Nodes (5): Domaine expéditeur, E-mails COMPLICE, E-mails de compte (Supabase Auth + SMTP Brevo), E-mails métier (API + Brevo), Vérifier un envoi

### Community 69 - "Gamification, leviers et dark patterns"
Cohesion: 0.33
Nodes (5): Dark patterns écartés, Gamification, leviers et dark patterns, Leviers utilisés, Limites assumées, Règles non négociables

### Community 70 - "1. Supabase (une fois)"
Cohesion: 0.33
Nodes (6): 1. Supabase (une fois), Appliquer les migrations, Auth, Clé secrète, Rappels planifiés (pg_cron), Vérification

### Community 71 - "Lots 1-2 — 2026-11-20"
Cohesion: 0.33
Nodes (6): Actions manuelles requises, Faille trouvée et corrigée pendant le lot, Lots 1-2 — 2026-11-20, Non vérifié / limites, Réalisé, Vérifié (exécuté)

### Community 72 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 73 - "COMPLICE — instructions projet"
Cohesion: 0.50
Nodes (3): Commandes (depuis la racine), COMPLICE — instructions projet, Règles

### Community 74 - "Lot 6 — MVP complet (2026-11-21, `main` après fusion de `front` 39a6b83)"
Cohesion: 0.50
Nodes (4): Lot 6 — MVP complet (2026-11-21, `main` après fusion de `front` 39a6b83), Non vérifié, Réalisé, Vérifié

### Community 75 - "Lots 3-4 — 2026-11-20"
Cohesion: 0.50
Nodes (4): Lots 3-4 — 2026-11-20, Non vérifié / limites, Réalisé, Vérifié (exécuté)

## Knowledge Gaps
- **329 isolated node(s):** `supabase`, `name`, `version`, `private`, `description` (+324 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 376 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-router` connect `ui.tsx` to `queries.ts`, `unwrap`, `capsule.tsx`, `contribute.tsx`, `expo`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `plugins` connect `expo` to `ui.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `supabase`, `name`, `version` to the rest of the system?**
  _329 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07092547092547093 - nodes in this community are weakly interconnected._
- **Should `queries.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05829420970266041 - nodes in this community are weakly interconnected._
- **Should `unwrap` be split into smaller, more focused modules?**
  _Cohesion score 0.08365384615384615 - nodes in this community are weakly interconnected._
- **Should `domain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._