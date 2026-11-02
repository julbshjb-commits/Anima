# ADR 0001 — Socle technique

Date : 2 novembre 2026 · Statut : accepté

## Contexte

Anima doit sortir le 18 janvier 2027 sur le web, iPhone et Android, avec le journal intime et les journaux partagés. L'équipe est réduite, le budget aussi, et les données doivent rester en Europe.

## Décision

- **Monorepo pnpm** : `apps/web` (Next.js 16, App Router), `apps/mobile` (Expo, à venir), `packages/core` (types, schémas Zod, règles partagées).
- **Supabase** hébergé à Francfort : Postgres, authentification par lien e-mail, stockage privé, temps réel.
- **Sécurité dans la base** : chaque table a la RLS activée ; l'appli n'utilise que la clé publique. La clé secrète ne sert qu'à la suppression de compte, côté serveur.
- **Next.js 16** : `proxy.ts` (ex-middleware) rafraîchit la session ; Cache Components activé, donc toute lecture liée à la session est rendue derrière un `<Suspense>`.
- **Photos** envoyées directement du navigateur vers le bucket privé : pas de limite de taille des Server Actions, et la RLS du stockage vérifie le droit d'écrire.

## Conséquences

- On peut tester toutes les règles d'accès sans projet Supabase (`pnpm test:db`, Postgres local).
- Les types de la base sont écrits à la main dans `apps/web/src/lib/database.types.ts` jusqu'à la création du projet ; ensuite on les génère.
