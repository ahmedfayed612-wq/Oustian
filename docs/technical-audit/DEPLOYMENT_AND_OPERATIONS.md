# Deployment & Operations — Oustians

## Local setup (clean machine)

1. `npm install` 2. `cp .env.example .env.local`, fill `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (+ optional `RATE_LIMIT_SALT`; `SUPABASE_SERVICE_ROLE_KEY` only for scripts) 3. `supabase link` then `supabase db push` (verify `29000000` split fix first) 4. `npm run dev` → `/en` or `/ar`. Without env: app boots, Supabase paths throw clear errors. Admin seed: `node scripts/create-admin-user.mjs` / `promote-admin.mjs` (needs service-role; keep off Vercel env).

## Env vars (names only, no values)

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (+ legacy anon fallback), `SUPABASE_SERVICE_ROLE_KEY` (server/scripts only), `RATE_LIMIT_SALT`. Supabase Site URL must match app URL.

## Build/deploy

`npm run build` → `npm start`; `vercel.json` pins `dub1`. CI/CD: NONE (no `.github/`). Release = push `main` → Vercel build (UNVERIFIED live) + manual `db push`. Rollback: Vercel redeploy + down-migration (down scripts NOT FOUND — add before risky DDL). Secrets: Vercel env dashboard (UNVERIFIED access). Logs/monitoring/alerts: NONE in code (Supabase/Vercel dashboards UNVERIFIED). Backup/recovery: Supabase PITR (plan-dependent, UNVERIFIED) — confirm before launch. Domain/TLS: `oustians.com` per README (UNVERIFIED). No Dockerfile/IaC.
