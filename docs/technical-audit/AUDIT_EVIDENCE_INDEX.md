# Audit Evidence Index — Oustians (2026-10-15, commit 7604ce4, main)

## Commands executed (all read-only, all green unless noted)

`git status/branch/log/remote`, `find src supabase scripts tests docs public`, `npm run typecheck` PASS, `npm run lint` PASS, `npm test` 70/70 PASS, lockfile version resolution via node, `grep` table/policy/function inventories. NOT RUN: `test:e2e` (needs live project), `build` (needs env), vuln/load scans (no tooling).

## Key paths inspected

Root: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `vercel.json`, `eslint.config.mjs`, `prettier.config.mjs`, `.env.example`, `README.md`, `docs/cto-defense.md`. App: `src/proxy.ts`, `src/app/[locale]/layout.tsx`, `(app)/layout.tsx` + all routes (admin/chat/create/events/groups/notifications/profile/search/settings/feed), `(auth)/login,signup,pending`, `src/components/**`, `src/i18n/*`, `src/messages/en+ar.json`. Lib: `src/lib/supabase/{client,server,proxy,storage,database.types}.ts`, `src/lib/{env,rate-limit,profile-options}.ts`. Features: auth/chat/connections/events/feed/groups/media/notifications/reactions/roles/stories (`actions/queries/validation/*.tsx` + 7 unit test files). Migrations: all 16 `supabase/migrations/*.sql` (28 tables, ~62 policies, ~40 funcs). Scripts: `scripts/*.mjs`. Tests: `tests/reactions.e2e.mjs`.

## Not inspected / inaccessible

Live Supabase project (policies/storage/auth config/data), Vercel dashboard/env/domains/logs, `oustians.com` DNS/TLS, email delivery, production telemetry, `supabase/.temp` version pins (noted, not relied on). No private data accessed; no secrets recorded.

## Limitations

Static audit + unit/type/lint only; no integration/e2e/build-against-live; advisory DB not consulted; perf claims are hypotheses with a validation plan, not benchmarks; line numbers cited are best-effort (files move) — paths + symbols are authoritative.
