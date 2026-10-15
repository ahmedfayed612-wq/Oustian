# Security Audit — Oustians (source-based, 2026-10-15)

## Threat model

Attackers: anonymous internet, pending users, approved members (IDOR/BOLA, spam), rogue admin. Assets: identities, DMs, private profiles, media. Boundary: Supabase RLS + RPCs + storage policies (no custom backend). Out of scope: live exploit, prod data access (none attempted).

## Verified controls

Supabase Auth JWT + SSR refresh (`src/proxy.ts`, skipped w/o cookie/env); `requireApprovedMember/requireAdmin` on member/admin surfaces (`auth/session.ts`); per-op RLS (~62 policies) + `protect_profile_columns()`; storage owner-write/member-read + `can_view_story_object()`; zod everywhere; DB rate limiter on auth paths; post/story byte-sniff; baseline headers (no CSP yet — M8).

## Findings

| ID | Severity / conf. | Issue | Evidence | Impact / fix |
|---|---|---|---|---|
| SEC-001 | Medium / High | Avatar upload lacks server byte-sniff (posts/stories have it) | `auth/avatar-actions.ts:29-69` vs `media/image.ts`, `video.ts` | polyglot avatar; FIX: reuse sniff in ticket action |
| SEC-002 | Medium / Med | Storage открыт read may outlive story expiry for direct-URL holders | `26120000_stories.sql`, `29000200` | align TTL/purge; verify `can_view_story_object()` covers all paths |
| SEC-003 | Medium / Med | No authenticated rate limits beyond auth paths (spam reactions/comments/DMs) | `rate-limit.ts` scope | add `consume_rate_limit` to write actions |
| SEC-004 | Low / High | No CSP yet (headers baseline only) | `next.config.ts:39-51` | add M8 CSP incl. Storage host |
| SEC-005 | Low / Med | Service-role key pattern: scripts `create-admin-user.mjs`, `promote-admin.mjs` need it; code reserves bypass | `scripts/`, `.env.example` | keep server-only, rotate, never log |
| SEC-006 | Info / High | No CI/SAST/dependabot; vuln posture UNVERIFIED | no `.github/`, no scan run | add pipeline + `npm audit`/advisory review |
| SEC-007 | Info / Med | E2E script exists but needs live project; never run here | `tests/reactions.e2e.mjs`, `package.json#test:e2e` | run against preview w/ seed before launch |

No hardcoded secrets found (`.env.local` git-ignored; `.env.example` names only). XSS: React escaping + RLS; unsafe `dangerouslySetInnerHTML`: NOT FOUND (grep). SQLi: query builder + RPC params (no string-built SQL in app code). CSRF: Server Actions + SameSite cookies (framework default). Open redirects: NOT FOUND. Security tests: none dedicated (gap → TD).
