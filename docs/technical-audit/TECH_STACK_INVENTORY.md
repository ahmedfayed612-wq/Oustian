# Tech Stack Inventory — Oustians (evidence-based, 2026-10-15)

Confidence: VERIFIED = read from repo file + cross-checked. Installed versions resolved via node from `package-lock.json`.

## 1. Languages

| Language | Role / location | Toolchain | Evidence |
|---|---|---|---|
| TypeScript (strict) | All app code `src/**/*.ts(x)` | `typescript@5.9.3`, `strict:true`, target ES2017, `moduleResolution bundler`, `@/*`→`src/*` | `package.json`, `tsconfig.json` VERIFIED |
| JavaScript ESM | `scripts/*.mjs`, `tests/*.mjs`, configs | Node 24.21.0 local; no `engines` constraint | `scripts/`, `tests/` VERIFIED |
| SQL (Postgres) | 16 migrations, RLS, ~40 funcs | Supabase Postgres (server version UNVERIFIED) | `supabase/migrations/*.sql` VERIFIED |
| CSS | `src/app/globals.css` (276 lines, Tailwind v4 tokens, light+dark) | `tailwindcss@4.3.3` | `globals.css` VERIFIED |
| HTML/JSX | RSC + client islands (App Router) | `next@16.3.6`, `react@19.2.8` | `src/app/**` VERIFIED |
| JSON | manifests, messages (534-line `en`/`ar`), `vercel.json` | — | VERIFIED; no YAML CI, no TOML, no `.sh` |

## 2. Frontend (installed versions)

`next 16.3.6`, `react 19.2.8`, `react-dom 19.2.8`, `next-intl 4.14.6` (en/ar, RTL, `OUSTIANS_LOCALE` cookie→`profiles.language`), `next-themes 0.4.6`, `lucide-react 1.47.0`, `clsx`+`tailwind-merge` (`src/lib/utils/cn.ts`), `next/image` (Supabase host allow-listed from env, 30d cache — `next.config.ts:13-73`), `next/font` (Jakarta + Plex Arabic, `src/app/fonts.ts`).

## 3. Backend (Supabase + Next server layer)

| Item | Detail | Evidence |
|---|---|---|
| Auth | Email/password + invite-code gate + admin approval; `handle_new_user` trigger; `requireApprovedMember()` / `requireAdmin()` | `20260924120000_*`, `src/features/auth/session.ts`, `src/proxy.ts` |
| Postgres + RLS | 28 tables, ~62 policies, ~40 functions/triggers | `supabase/migrations/*.sql` |
| Storage | Buckets `avatars`, `post-media`, `story-media`; direct browser upload via ticket actions | `storage.ts`, `src/features/media/*` |
| Realtime | Chat threads subscribe from browser; no socket server | `chat/[id]/thread.tsx`, README M6 |
| Server Actions | Mutations in `src/features/*/actions.ts`, zod-validated | `feed/stories/groups/reactions/actions.ts` |
| Rate limit | Postgres `consume_rate_limit` + `rate_limits`, salt `RATE_LIMIT_SALT` | `src/lib/rate-limit.ts` |
| Validation | `zod@4.6.5` schemas per feature | `src/features/*/validation.ts` |
| Jobs/cron | NOT FOUND — story expiry is read-time filter + callable `purge_expired_stories()` with no schedule | `26120000_stories.sql`, `stories/queries.ts` |

## 4. Data / caching / search

Only DB = Supabase Postgres. No Redis, no search engine (search = `ilike` on profiles — `search/page.tsx`). No ORM (`supabase-js@2.117.1` + `ssr@0.12.7`). Cache: RSC `staleTimes.dynamic 30s` + `router.refresh()`; image CDN 30d. No service worker/offline (M8 per README).

## 5. AuthN/Z

Supabase Auth JWT + SSR refresh (`src/proxy.ts`, `src/lib/supabase/*`). Model: `account_status` enum, `is_admin`, `university_roles` + `user_university_roles` + audit logs. OAuth/MFA/email-verify UI: NOT FOUND. Recovery = Supabase default (UNVERIFIED).

## 6. Dev and AI tools

Cline: CONFIRMED by developer brief (no repo config — NOT FOUND). Model/provider: UNKNOWN. MCP: NOT FOUND. Git+GitHub VERIFIED (`origin …/Oustian.git`, `main`, `7604ce4`). npm+lockfile VERIFIED (8160 lines, v3). ESLint-next VERIFIED green. Prettier VERIFIED config. `tsc --noEmit` VERIFIED green 2026-10-15. `node --test` VERIFIED 70/70. Supabase CLI `2.117.0` VERIFIED (linked-project temp files). CI/CD NOT FOUND (no `.github/`). Docker/IaC NOT FOUND.

## 7. Infra and external services

Vercel `dub1` (`vercel.json`), domain `oustians.com` per README (live UNVERIFIED). Supabase linked project (live config UNVERIFIED). Email/SMS/push/analytics/monitoring/payments/maps/CDN: NOT FOUND. Headers: `nosniff`, `Referrer-Policy`, `DENY`, `Permissions-Policy`, HSTS — no CSP yet (deferred M8, `next.config.ts:39-51`).

## 8. Direct dependencies (installed)

Runtime: `next 16.3.6`, `react 19.2.8`, `react-dom 19.2.8`, `@supabase/ssr 0.12.7`, `@supabase/supabase-js 2.117.1`, `clsx`, `lucide-react 1.47.0`, `next-intl 4.14.6`, `next-themes 0.4.6`, `tailwind-merge`, `zod 4.6.5`. Dev: `@tailwindcss/postcss`, `@types/*`, `eslint`+`eslint-config-next 16.3.6`, `prettier`+tailwind plugin, `supabase 2.117.0`, `tailwindcss 4.3.3`, `typescript 5.9.3`. Vuln scan: NOT RUN (advisories UNVERIFIED). Full tree: `package-lock.json`.
