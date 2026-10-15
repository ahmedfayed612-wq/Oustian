# Testing & Quality — Oustians

## Actual results (2026-10-15, Node 24.21.0)

| Command | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | PASS, zero errors |
| `npm run lint` (`eslint`) | PASS, zero warnings/errors |
| `npm test` (`node --test` 7 files) | 70 tests / 18 suites, ALL PASS (192ms) |
| `npm run test:e2e` | NOT RUN (requires live Supabase project) |
| `npm run build` | NOT RUN (would need env + network; static check via typecheck/lint instead) |
| Vuln/load/perf scans | NOT RUN (no tooling in repo) |

## Coverage (by module, unit)

Reactions, media image/video, stories queries, group capacity, roles queries, connection suggestions — covered. Auth/session, feed queries, chat, events, notifications, guards, RLS policies, storage policies: NO automated tests (gaps → TD-005).

## Quality assessment

Strengths: strict TS, tidy feature-slice layout (`queries/actions/validation/*.tsx`), zod boundaries, small RPC-centered mutations, localized errors, consistent naming, 44px targets, one-h1, `aria-current`. Debts: `post-card.tsx` 607 / `story-viewer` 462 / `story-composer` 487 / `stories/queries` 465 lines (split candidates); search `ilike` unindexed; no error-tracking/telemetry client; no story-purge cron; README milestone text stale vs git log (M2 connections + M4 polls partially shipped despite "pending").
