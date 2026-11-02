# Anima

Journal intime et journaux partagés. Privé par défaut, hébergé en Europe.

## Structure

- `apps/web` : l'appli web (Next.js 16).
- `apps/mobile` : l'appli iPhone et Android (Expo SDK 58). Voir `apps/mobile/README.md`.
- `packages/core` : types de la base, humeurs, couvertures, codes d'invitation, dates, partagés par le web et le mobile.
- `supabase/migrations` : schéma de la base et règles d'accès (RLS).
- `supabase/tests` : tests des règles d'accès, lancés sur un Postgres local.
- `docs/adr` : décisions d'architecture.

## Lancer

```bash
pnpm install
pnpm test          # tests du package core
pnpm test:db       # tests des règles d'accès (Postgres 16 local requis)
cp apps/web/.env.example apps/web/.env.local   # puis renseigner Supabase
pnpm dev:web

cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:mobile   # puis Expo Go ou un simulateur
```

Sans variables Supabase, l'appli affiche un écran « pas encore reliée à sa base » : aucune donnée fictive.
