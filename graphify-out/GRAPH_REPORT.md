# Graph Report - Projet FINTECH  (2026-11-21)

## Corpus Check
- 133 files · ~106,393 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 709 nodes · 1859 edges · 55 communities (21 shown, 34 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Création et participation
- API Fastify
- Membres et invitations
- Idées et missions
- Types métier partagés
- Formulaires et capsule
- Accueil et discussion
- Dépendances API
- Configuration Expo
- Outillage tests SQL
- Dépendances mobile (dev)
- Paquet partagé
- Config TS API
- Config TS partagé
- Banc de test PGlite
- Contributions côté app
- Config TS mobile
- Lien d’invitation
- Dépendances Expo
- Regroupement des migrations
- Application distante
- Config ESLint
- Dépendance expo-clipboard
- Dépendance expo-constants
- Dépendance expo-crypto
- Dépendance expo-device
- Dépendance expo-font
- Dépendance expo-glass-effect
- Dépendance @expo-google-fonts/caveat
- Dépendance @expo-google-fonts/nunito
- Dépendance expo-image
- Dépendance expo-image-picker
- Dépendance expo-linking
- Dépendance expo-router
- Dépendance expo-splash-screen
- Dépendance expo-status-bar
- Dépendance expo-symbols
- Dépendance expo-system-ui
- Dépendance @expo/ui
- Dépendance expo-web-browser
- Dépendance lucide-react-native
- Serveur MCP Supabase
- Dépendance react
- Dépendance react-dom
- Dépendance react-native
- Dépendance @react-native-async-storage/async-storage
- Dépendance @react-native-community/datetimepicker
- Dépendance react-native-gesture-handler
- Dépendance react-native-reanimated
- Dépendance react-native-screens
- Dépendance react-native-url-polyfill
- Dépendance react-native-web
- Dépendance react-native-worklets
- Dépendance @supabase/supabase-js
- Dépendance @tanstack/react-query

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 57 edges
2. `unwrap()` - 50 edges
3. `colors` - 40 edges
4. `T()` - 33 edges
5. `expo-router` - 30 edges
6. `Button()` - 26 edges
7. `useEventId()` - 23 edges
8. `space` - 23 edges
9. `Banner()` - 20 edges
10. `formatEventDate()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `EventLayout()` --calls--> `useEventId()`  [EXTRACTED]
  mobile/src/app/(app)/event/[id]/_layout.tsx → mobile/src/lib/use-event-context.ts
- `requireUser()` --calls--> `GatewayError`  [EXTRACTED]
  backend/src/app.ts → backend/src/gateway.ts
- `CreateEvent()` --calls--> `useAuth()`  [EXTRACTED]
  mobile/src/app/(app)/create.tsx → mobile/src/lib/auth.tsx
- `Capsule()` --calls--> `useEvent()`  [EXTRACTED]
  mobile/src/app/(app)/event/[id]/(tabs)/capsule.tsx → mobile/src/lib/queries.ts
- `Capsule()` --calls--> `useProgress()`  [EXTRACTED]
  mobile/src/app/(app)/event/[id]/(tabs)/capsule.tsx → mobile/src/lib/queries.ts

## Import Cycles
- None detected.

## Communities (55 total, 34 thin omitted)

### Community 0 - "Création et participation"
Cohesion: 0.08
Nodes (62): OCCASIONS, STATUS_LABEL, Step, EventLayout(), ICONS, LABELS, ForgotPassword(), submit() (+54 more)

### Community 1 - "API Fastify"
Cohesion: 0.06
Nodes (33): AppDeps, buildApp(), requireUser(), contributionBody, fastify, FastifyRequest, app(), auth (+25 more)

### Community 2 - "Membres et invitations"
Cohesion: 0.07
Nodes (52): EXPIRY_LABELS, InvitationLine(), InvitePanel(), generate(), MemberLine(), SettingsForm(), save(), MyEvents() (+44 more)

### Community 3 - "Idées et missions"
Cohesion: 0.11
Nodes (47): EditIdea(), IdeaDetail(), Members(), EventSettings(), Ideas(), CreateTask(), Missions(), ConfirmButton() (+39 more)

### Community 4 - "Types métier partagés"
Cohesion: 0.05
Nodes (42): BADGE_LABELS, BadgeKind, CapsuleStats, CapsuleStatus, ClaimResult, ContributionResponse, ContributionStatus, CreateContributionRequest (+34 more)

### Community 5 - "Formulaires et capsule"
Cohesion: 0.09
Nodes (30): CreateEvent(), submit(), validate(), defaultGiftDate(), shift(), IdeaForm(), Capsule(), EntryEditor() (+22 more)

### Community 6 - "Accueil et discussion"
Cohesion: 0.09
Nodes (33): LockableDate(), SealedCard(), Chat(), Item, DateLine(), EventHome(), HelpCard(), NEXT (+25 more)

### Community 7 - "Dépendances API"
Cohesion: 0.06
Nodes (35): dependencies, @complice/shared, fastify, @fastify/cors, @fastify/rate-limit, @supabase/supabase-js, zod, description (+27 more)

### Community 8 - "Configuration Expo"
Cohesion: 0.06
Nodes (30): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, reactCompiler (+22 more)

### Community 9 - "Outillage tests SQL"
Cohesion: 0.09
Nodes (21): @electric-sql/pglite, description, devDependencies, @electric-sql/pglite, engines, node, name, private (+13 more)

### Community 10 - "Dépendances mobile (dev)"
Cohesion: 0.10
Nodes (20): eslint, eslint-config-expo, devDependencies, eslint, eslint-config-expo, @types/react, typescript, typescript (+12 more)

### Community 11 - "Paquet partagé"
Cohesion: 0.11
Nodes (18): description, devDependencies, @types/node, typescript, files, @types/node, typescript, main (+10 more)

### Community 12 - "Config TS API"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+7 more)

### Community 13 - "Config TS partagé"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+6 more)

### Community 14 - "Banc de test PGlite"
Cohesion: 0.36
Nodes (10): as(), createEvent(), createUser(), errorOf(), freshDb(), here, inDays(), invite() (+2 more)

### Community 15 - "Contributions côté app"
Cohesion: 0.27
Nodes (11): Contribute(), api, Attempt, attemptKey(), contributionKeys, loadAttempt(), newAttempt(), saveAttempt() (+3 more)

### Community 16 - "Config TS mobile"
Cohesion: 0.18
Nodes (10): compilerOptions, paths, strict, extends, include, @/assets/*, ./assets/*, expo/tsconfig.base (+2 more)

### Community 17 - "Lien d’invitation"
Cohesion: 0.27
Nodes (8): AfterAuth(), goAuth(), Join(), paste(), submit(), extractInviteToken(), savePendingInvite(), takePendingInvite()

### Community 18 - "Dépendances Expo"
Cohesion: 0.22
Nodes (9): expo, dependencies, @complice/shared, expo, react-native-safe-area-context, react-native-svg, @complice/shared, react-native-safe-area-context (+1 more)

### Community 19 - "Regroupement des migrations"
Cohesion: 0.22
Nodes (6): all, files, out, parts, prior, root

### Community 20 - "Application distante"
Cohesion: 0.29
Nodes (5): applied, dryRun, files, pending, root

## Knowledge Gaps
- **244 isolated node(s):** `supabase`, `name`, `version`, `private`, `description` (+239 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 279 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-router` connect `Création et participation` to `Membres et invitations`, `Idées et missions`, `Accueil et discussion`, `Configuration Expo`, `Lien d’invitation`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `plugins` connect `Configuration Expo` to `Création et participation`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `supabase`, `name`, `version` to the rest of the system?**
  _244 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Création et participation` be split into smaller, more focused modules?**
  _Cohesion score 0.0790137837313143 - nodes in this community are weakly interconnected._
- **Should `API Fastify` be split into smaller, more focused modules?**
  _Cohesion score 0.060285563194077206 - nodes in this community are weakly interconnected._
- **Should `Membres et invitations` be split into smaller, more focused modules?**
  _Cohesion score 0.0655367231638418 - nodes in this community are weakly interconnected._
- **Should `Idées et missions` be split into smaller, more focused modules?**
  _Cohesion score 0.11090225563909774 - nodes in this community are weakly interconnected._