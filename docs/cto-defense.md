# OUSTIANS — CTO Defense Document

**Prepared for:** Ahmed (founder) · **Product:** Oustians (oustians.com) · **Audience:** deans, faculty, IT/security staff, student union, investors, technical students
**Basis:** direct audit of the repository at commit `80ff291`. Every claim cites a file, table, policy or config value that exists *today*.

## How to use this document

- **Say this** = speak it out loud to a non-technical person. 2–4 sentences.
- **Deep dive** = for a technical questioner. File paths, table names, policy names.
- Where an Arabic phrase helps, it is given as `AR:`.

### Status legend (used on every answer)

| Tag | Meaning |
|---|---|
| ✅ | Implemented and verified in code |
| ⚠️ | Partial — works but has a known gap |
| ❌ | Not implemented |
| 🔴 | Risk — implemented but dangerous / must be fixed |

**Golden rule for the whole briefing:** never claim what the code does not do. Every ❌/⚠️/🔴 below has an honest sentence plus a fix in Part 17. Admitting a gap before you are asked is the strongest move available to you; being caught inventing a feature is the weakest.

### Assumptions I had to make (verify these before the meeting — I cannot read your dashboards)

1. **Hosting plan = Vercel Hobby** (no `vercel.json`, no plan marker in the repo). Hobby is *non-commercial use* per Vercel's terms — relevant if you ever monetise. ⚠️
2. **Supabase plan = Free** (no backup config in the repo). Free projects **pause after ~1 week of inactivity** and have no scheduled backups. 🔴 for launch.
3. **Supabase project region is unknown to me** — it decides data residency for Part 5. Check the dashboard (Settings → General → Region) and be ready to name it.
4. **Email confirmation** may be on or off in the dashboard; the code handles both (`src/features/auth/actions.ts:117-128`).
5. **Email sending uses Supabase's built-in SMTP** — no Resend/SendGrid/Brevo key exists anywhere in the repo. Built-in SMTP is heavily rate-limited (a few emails per hour). 🔴 for a 1,000-student launch day.

---

# PART 0 — Discovery Pass & Architecture Overview

## 0.1 The stack, as it actually is

| Layer | What is used | Where |
|---|---|---|
| Framework | **Next.js 16.3.6**, App Router, React 19.2.8, TypeScript 5 (`strict`) | `package.json`, `tsconfig.json` |
| Build | Turbopack via `next build` | `package.json` |
| Styling | **Tailwind CSS v4**, CSS-first design tokens (no `tailwind.config`) | `src/app/globals.css` |
| Icons | `lucide-react` | `src/components/**` |
| i18n | **next-intl 4.14.6**, locales `en` + `ar`, `localePrefix: "always"`, cookie `OUSTIANS_LOCALE` | `src/i18n/routing.ts` |
| Theming | `next-themes` — light / dark / system | `src/components/theme/*` |
| Validation | `zod` v4 — forms and server actions | `src/features/*/validation.ts` |
| Backend | **Supabase**: Postgres + RLS, Auth, Storage, Realtime | `supabase/migrations/*` |
| DB client | `@supabase/ssr` 0.12.7 + `@supabase/supabase-js` 2.117 | `src/lib/supabase/{server,client}.ts` |
| Hosting | **Vercel** (README: `oustians.com`) | README |
| Middleware | `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`) | `src/proxy.ts` |
| Images | `next/image` + dynamic `remotePatterns` allow-list for the Storage host | `next.config.ts` |
| Fonts | Plus Jakarta Sans (Latin) + IBM Plex Sans Arabic, self-hosted via `next/font` | `src/app/fonts.ts` |

**Measured size:** 18,413 lines of TS/TSX across 144 files; 3,971 lines of SQL across 16 migrations (`src/app` 4,803 · `src/features` 9,848 · `src/components` 1,567 · `src/lib` 2,101). **21 pages, 0 API route handlers, 13 server-action modules, 11 runtime deps, 11 dev deps, `npm audit` = 0 vulnerabilities.**

## 0.2 Architecture diagram (text)

```
      Browser (installable web app — "add to home screen" on iOS/Android)
      ├── React 19 client components (chat realtime, composers, sheets)
      └── RSC navigations + fetch
               │  HTTPS · secure cookie
               ▼
      Vercel Edge Middleware ── src/proxy.ts
      │   1. next-intl locale negotiation      (/  →  /en or /ar)
      │   2. refreshSupabaseSession()          (rotates the auth cookie)
      ▼
      Vercel Serverless — Next.js App Router
      ├── 21 server-rendered pages             src/app/[locale]/(app)/**
      ├── 13 server actions ("use server")     ← every write path
      └── guards: requireApprovedMember() / requireAdmin()  (per-request cache)
               │  supabase-js carrying the USER's JWT — never a service key
               ▼
      Supabase
      ├── Auth      (email + password, JWT ~1h, refresh-token rotation)
      ├── Postgres  (28 tables, RLS on all 28, 39 indexes, ~50 functions, 16 triggers)
      ├── Storage   (3 private buckets: avatars, post-media, story-media)
      └── Realtime  (one channel type: chat messages per conversation)
```

**The one architecture sentence that matters:** *the browser reads Postgres directly and RLS decides what it may see; every write goes through a server action or a `SECURITY DEFINER` Postgres function that derives identity from `auth.uid()`. No service-role key exists in the running app.*

## 0.3 Database inventory (28 tables, RLS enabled on all 28)

`profiles` · `invite_codes` · `invite_code_uses` · `rate_limits` · `universities` · `university_subjects` · `posts` · `post_media` · `post_likes` *(legacy — no app code uses it)* · `post_reactions` · `post_comments` · `comment_reactions` · `connections` · `conversations` · `conversation_members` · `messages` · `notifications` · `events` · `event_rsvps` · `stories` · `story_media` · `story_views` · `presentation_groups` · `presentation_group_members` · `presentation_group_invitations` · `university_roles` · `user_university_roles` · `user_role_audit_logs`

**Storage buckets — all private (`public = false`):**

| Bucket | Size cap | Allowed types | Read rule |
|---|---|---|---|
| `avatars` | 5 MB | jpeg/png/webp | any authenticated member |
| `post-media` | 10 MB | jpeg/png/webp | any approved member |
| `story-media` | 50 MB | jpeg/png/webp/mp4/mov/webm | story audience **or the owner** |

**Enums:** `account_role` = `student | admin` · `account_status` = `pending | approved | rejected | suspended` · `verification_method` = `invite_code | university_email | admin_invite | manual`.

## 0.4 Environment variables (names only — values never printed)

| Name | Scope | Used in |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | `src/lib/env.ts`, `next.config.ts` (image allow-list) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (alias `…ANON_KEY`) | public | `src/lib/env.ts` |
| `NEXT_PUBLIC_SITE_URL` | public | `src/lib/env.ts` (auth redirect URLs) |
| `RATE_LIMIT_SALT` | server | `src/lib/rate-limit.ts` — **optional; falls back to the literal `"oustians"`** 🔴 |
| `SUPABASE_SERVICE_ROLE_KEY` | server | declared in `.env.example`, **never read anywhere in `src/`** ✅ |

`.gitignore` ignores `.env*` but keeps `.env.example`; no JWT-looking (`eyJ…`) string exists in git history; no secret file is tracked. ✅

## 0.5 Auth flow, end to end

1. **Signup** (`signUpAction`, `src/features/auth/actions.ts:52`) → zod → rate-limited 5/hour per hashed IP → `auth.signUp()` with `invite_code` in metadata + `emailRedirectTo`.
2. **The invite code is consumed inside the database** by the `on_auth_user_created` trigger → `handle_new_user()`, i.e. in the same transaction as the `auth.users` insert. A bad or exhausted code aborts everything: **no orphan auth user, no consumed code.**
3. **Approval** — the new profile starts `status='pending'`; `/pending` shows the holding screen; an admin approves in `/admin` (`approval-queue.tsx`).
4. **Login** (`signInAction`) → rate-limited 10/10 min per hashed IP → cookie set → routed by status (approved → app, pending → holding screen, rejected/suspended → blocked).
5. **Every request** — `src/proxy.ts` verifies the JWT **locally** with `getClaims()` (asymmetric keys, process-wide JWKS cache) and only calls the network to refresh an expiring token; then `requireApprovedMember()` (React `cache`, once per request) gates `(app)`.
6. **Logout** — `signOutAction()` → `auth.signOut()` → `/login`. Reachable from Settings **and the profile header**.
7. **No password-reset UI** ❌ · **no account-deletion UI** ❌ (Part 2 / Part 17).

## 0.6 How "OUST students only" is actually enforced

Three independent gates: **(a)** a valid, active, unexpired, unused invite code (`is_invite_code_valid()`, `handle_new_user()`); **(b)** manual admin approval of every account (`profiles.status`); **(c)** every read/write policy in the database requires `is_approved_member()`. **No university-email-domain check exists** — the `verification_method` enum reserves `university_email` but nothing calls it. ⚠️ Honest answer in Part 2.

## 0.7 Deploy and operations reality

`npm run check` = typecheck + ESLint · `npm run build` = Turbopack production build · `npm run db:push` = apply migrations to the linked project. **No CI/CD** (`.github/` absent), **no staging environment**, **no monitoring or error tracking** (no Sentry/PostHog/Vercel Analytics), **no analytics**, **no backup configuration in the repo**. Deploys are Vercel's git-integration builds with one-click rollback to a previous deployment.

## 0.8 Table of contents

0. Discovery Pass & Architecture Overview · 1. Product & Architecture · 2. Authentication & Access Control · 3. Database & Data Model · 4. Security · 5. Privacy & Legal · 6. Moderation & Safety · 7. Performance & Scalability · 8. Reliability & DevOps · 9. Costs & Ownership · 10. Feature-by-Feature Breakdown · 11. UX, Accessibility & Compatibility · 12. Data, Analytics & AI · 13. Integration & Roadmap · 14. Hard-Ball Questions · 15. Questions Nobody Asks · 16. Demo & Talking-Point Kit · 17. Honest Readiness Report

---

# PART 1 — PRODUCT & ARCHITECTURE

### Q1 — Why Next.js on Vercel instead of a native app or a plain backend?
**Status:** ✅ Implemented
**Say this:** "We ship one app that runs everywhere — iPhone, Android, laptop — with no app-store review, no two codebases, and no forced update. Students tap a link and they are in; they can also add it to their home screen so it looks and feels like an app. A native app would have tripled the cost and slowed every fix by a week."
**Deep dive:** Next.js 16 App Router gives server-rendered pages (fast first paint on Egyptian mobile data), server actions for writes (no hand-written REST layer), and `next/image` for optimisation. Vercel hosts it with global CDN + automatic HTTPS. Supabase provides auth, database, storage and realtime, so there is no server to patch. Alternative rejected: native React Native (two stores, review cycles, forced minimum-version support, no shared UI language); a hand-rolled Express + Postgres on a VPS (patching, TLS, scaling, backups all become your problem as a first-year student).
`AR:` «طبق واحد بيشتغل على أي موبايل — من غير متجر تطبيقات ولا انتظار موافقة. الطالب بيفتح لينك ويدخل على طول.»

### Q2 — PWA: is it really a PWA? What are the trade-offs?
**Status:** ⚠️ Partial — honest answer required
**Say this:** "It is a web app built for phones: it installs to the home screen, works in both languages, and needs no app store. I want to be precise though — the *installable manifest and offline caching* are the next step, not shipped yet. Today the honest description is 'a mobile-first web app you can add to your home screen'."
**Deep dive:** What exists: `viewportFit: "cover"` and `appleWebApp: { capable: true }` in `src/app/[locale]/layout.tsx`, safe-area padding (`pt-safe`/`pb-safe` in `src/app/globals.css`), a 56 px bottom navigation, and a `themeColor` pair. What is **missing**: `public/manifest.webmanifest` (only `public/icon.svg` exists), a service worker, offline caching, `beforeinstallprompt` handling, and Web Push. Without a manifest, Android Chrome will not offer a real install prompt; iOS "Add to Home Screen" still works but with no icons/splash.
**Fix:** P17-T2-1 — add a manifest + icons, then a minimal service worker.

### Q3 — Push notifications?
**Status:** ❌ Not implemented
**Say this:** "Notifications exist inside the app today — the bell with an unread badge. Real push to a locked phone (Web Push / APNs) is not shipped because on iOS it requires an installed PWA plus an Apple developer path; I have it planned, not claimed."
**Deep dive:** `notifications` rows are written by DB triggers (`handle_new_like`, `handle_new_comment`, `handle_after_reaction`, connection triggers, group triggers) and read by `src/app/[locale]/(app)/notifications/page.tsx`; the unread count is resolved server-side in `(app)/layout.tsx` via `getUnreadNotificationCount()` (`src/features/notifications/queries.ts`). There is no Realtime subscription for notifications (only chat uses Realtime), so the badge refreshes on navigation, not instantly. No push service, no VAPID keys, no `Notification` API usage.

### Q4 — Chat: how does it feel instant without a socket server?
**Status:** ✅ Implemented
**Say this:** "The chat uses Supabase Realtime — a managed websocket service — so a message appears on the other phone in well under a second. We do not run a socket server: Supabase does, and it only ever sends rows that the database rules already say you are allowed to see."
**Deep dive:** `src/app/[locale]/(app)/chat/[id]/thread.tsx:52-72` subscribes to one channel per conversation with `postgres_changes` on `messages` (insert + update). Authorization is not the channel's job: RLS (`messages_select` → `is_conversation_member()`) decides what the subscriber can read. A send throttle trigger (`handle_new_message()`) rejects more than **40 messages per minute per sender**. Optimistic send + dedupe by `id` prevents double-render.

### Q5 — Monolith or microservices? Why one repo?
**Status:** ✅ Implemented
**Say this:** "One deployable app with one database. For a campus product at this stage, a monolith is the professional choice: one thing to deploy, one thing to debug, no network calls between services, and nothing to keep in sync. Splitting into services now would add failure modes without adding capability."
**Deep dive:** Structure: `src/app/[locale]/**` (routes), `src/features/**` (domain modules: auth, feed, chat, connections, stories, groups, roles, media, reactions, notifications, events), `src/components/**` (design system), `src/lib/**` (Supabase clients, rate limiting, env). Domain logic sits in `queries.ts` / `actions.ts` pairs per feature — reads and writes deliberately separated.

### Q6 — Which parts are yours and which are a managed service? What is the lock-in?
**Status:** ✅ Implemented
**Say this:** "The product — every screen, rule, database policy, upload path and notification — is ours and lives in our own GitHub repository. The plumbing is rented: Supabase runs the database, login and files; Vercel runs the hosting. Swapping hosts is a day's work; swapping the database provider is about a week, because our rules are written as standard PostgreSQL."
**Deep dive:** Owned: 18,413 lines TS/TSX + 3,971 lines SQL. Rented: Postgres + Auth + Storage + Realtime (Supabase), CDN/serverless (Vercel), fonts (Google, self-hosted at build). **Lock-in is low-to-moderate:** schema and policies are plain PostgreSQL + RLS, so Supabase→self-hosted is `pg_dump` plus rewriting the auth glue; the vendor-specific code is isolated in `src/lib/supabase/*`. Exit plan: dump the database → move objects to any S3-compatible bucket → swap the client layer. No proprietary query language, no vendor-only data format.

### Q7 — What AI tools were used, and how was the code reviewed?
**Status:** ✅ Implemented (process answer)
**Say this:** "AI assistance was used as a coding accelerator, and every change had to pass a fixed gate before it was accepted: TypeScript in strict mode, ESLint with zero warnings, 70 automated test cases, and a production build that must succeed. Anything that failed a gate was fixed or reverted — nothing ships on 'it looked right'."
**Deep dive:** Gates: `npm run typecheck` (`tsc --noEmit`, `strict: true`), `npm run lint` (eslint-config-next + react-hooks), `npm test` → **70/70 across 7 suites** (`node:test`, no framework dependency), `npm run build` must exit 0 with all routes generated. Honest caveats: **the tests cover pure logic; there is no end-to-end suite in CI**, and the one integration script (`tests/reactions.e2e.mjs`) needs a paid Supabase management token, so it is manual. Non-testable surfaces (RLS, storage policies) are human-reviewed migration by migration, with a structural validator for SQL. That review — not a test — is what caught the story-media read-policy bug.

### Q8 — Offline behaviour: what happens with no internet?
**Status:** ⚠️ Partial
**Say this:** "The browser keeps the app shell, so a lost connection does not blank the screen, but we do not cache feed content for offline reading yet. If the network drops, the action fails and we tell the student clearly instead of pretending it worked."
**Deep dive:** Route caching via `experimental.staleTimes: { dynamic: 30, static: 180 }` in `next.config.ts` makes revisits instant. Every mutation surfaces an error state (composer `uploadFailed`, connect-button revert, rate-limit copy). **No service worker ⇒ no true offline mode.** On Egyptian mobile data this is a real UX gap (not a security one).

### Q9 — How does it behave on a low-end Android phone?
**Status:** ⚠️ Partial
**Say this:** "It is server-rendered HTML with a small JavaScript bundle, tuned for phones first: a 56-pixel bottom bar, safe-area handling, one content column, photos sized to the screen. On a weak phone it is usable; the heaviest thing we ask is a photo or video upload."
**Deep dive:** Server components deliver data-complete HTML; client JS is limited to interactive islands (composers, sheets, reaction bar, chat thread, story viewer). Risks: no bundle-size budget enforced in CI; the story viewer and reaction animations are the heaviest client surfaces; `next/image` handles avatars but **post/story media uses plain `<img>`** (`post-card.tsx:374`, `story-viewer.tsx:379`) — those bytes are not image-optimised, they rely on CDN caching of the signed URL.

### Q10 — What happens on the very first visit, technically?
**Status:** ✅ Implemented
**Say this:** "The first link negotiates their language automatically — Arabic or English — and remembers it. If they are not signed in they land on login; if they are, they go straight to the feed."
**Deep dive:** `src/proxy.ts` runs next-intl middleware with `localeDetection: true`; `/` → `/en` or `/ar` from `Accept-Language`, remembered in the `OUSTIANS_LOCALE` cookie (1 year, `sameSite: lax`). `localePrefix: "always"` keeps URLs explicit. The same proxy then refreshes the Supabase session if an `sb-…-auth-token` cookie exists — anonymous requests skip that work. `(app)` routes are gated by `requireApprovedMember()`.

### Q11 — Why Postgres row-level security rather than filtering in app code?
**Status:** ✅ Implemented
**Say this:** "Because the rule belongs next to the data. Even if someone bypassed my app and queried the database directly with the key that ships in the browser, the database itself refuses to return other people's private rows. That is a much stronger promise than 'my code checks it'."
**Deep dive:** All 28 tables have RLS; every policy calls a helper (`is_approved_member()`, `is_admin()`, `is_conversation_member()`, `are_connected()`, `can_view_story()`, `owns_story()`). The browser holds only the publishable key — no service-role key in the app. **Your best live demo:** run a query as one student's JWT against another student's `messages` or `story_media` and show **0 rows**. Caveat to disclose: a few *product-level* privacy features are enforced at render time, not in policy — see Q39.

### Q12 — What is the single most important engineering decision here?
**Status:** ✅ Implemented
**Say this:** "That identity is never trusted from the client. Every write function reads `auth.uid()` from the verified token, builds the storage path from it, and re-checks permissions inside the database. A tampered request can only ever act as the person who sent it."
**Deep dive:** `create_media_upload_ticket` builds the key as `<auth.uid()>/<uuid>.<ext>`; `create_story()` re-validates the folder prefix against `auth.uid()`; `set_connection()` locks the pair row `for update`; `create_post` rate-limits before inserting; `protect_profile_columns()` raises `profile_field_protected` if a non-admin touches `role`, `status`, `approved_at/by`, `rejection_reason`, `invite_code_id` or `verification_method`. **Self-promotion to admin is blocked in the database**, not merely hidden in the UI.

### Q13 — Why not Firebase / MongoDB / a simpler stack?
**Status:** ✅ Implemented
**Say this:** "Because a university social network is mostly *relationships and permissions*: who may see which row. That is exactly what a relational database with row-level security is for. A document store would have pushed all of that logic into my application code, where one mistake exposes everyone's data."
**Deep dive:** The product needs multi-table invariants (connections ↔ conversations ↔ messages; groups ↔ invitations ↔ a hard 10-member cap under concurrency; stories ↔ viewers with dedupe). Those are enforced with foreign keys, `unique` constraints, partial indexes, `CHECK` constraints, `FOR UPDATE` locks inside `SECURITY DEFINER` functions and 16 triggers — none of which a document database gives you. Firebase also has no equivalent of "the database refuses to return rows you may not see" with SQL-level joins.

### Q14 — What would you do differently if you started again?
**Status:** ✅ Implemented (credibility answer)
**Say this:** "Three things: I would add the CI pipeline and error monitoring from day one, I would write the storage read policies with the publish flow in mind (that ordering bug cost me a day), and I would set up a real transactional email provider before launch."
**Deep dive:** Specifically: (1) no CI means the gates are manual discipline; (2) the story-media bug (Q97) was a policy/flow ordering issue; (3) Supabase's built-in SMTP is not adequate for launch-day volume; (4) `post_likes` is now dead schema from before the reaction system — migration clutter; (5) the `rate_limits` table has no pruning job.

---

# PART 2 — AUTHENTICATION & ACCESS CONTROL

### Q15 — How do you verify a student is really an OUST student?
**Status:** ⚠️ Partial — answer this one precisely
**Say this:** "Two gates, both human-checked: an invite code that only the university community has, and manual approval of every account before it can see anything. What I have *not* built yet is automatic university-email verification — that is the next layer, and I will not pretend otherwise."
**Deep dive:** `invite_codes` (regex `^[A-Z0-9][A-Z0-9-]{3,31}$`, `max_uses` 1–500, `uses <= max_uses`, optional `expires_at`, `is_active`) consumed inside `handle_new_user()` **in the same transaction as the auth insert**. Then `profiles.status='pending'` until an admin approves. `verification_method` reserves `university_email`, but only the invite path is wired; no email-domain allow-list exists in the codebase. `AR:` «كل حساب بيتوثّق على مرحلتين: كود دعوة + موافقة إدارية. التحقق الآلي بإيميل الجامعة هو الخطوة الجاية.»

### Q16 — Can an outsider get in without an invite code?
**Status:** ✅ Implemented
**Say this:** "Not through the app. The code is checked inside the database, in the same transaction that creates the account, so a forged request cannot skip it. And even with a code, no account can read a single row until an admin approves it."
**Deep dive:** `handle_new_user()` calls `is_invite_code_valid()` and raises `invalid_invite_code`, aborting the whole `auth.users` insert. The trigger is on `auth.users`, so even a direct `auth.signUp()` call outside the UI goes through it. The function is `SECURITY DEFINER` with a pinned `search_path`.

### Q17 — Can someone create many accounts with one code?
**Status:** ✅ Implemented
**Say this:** "A code has a maximum number of uses and every redemption is recorded, so a code meant for one person cannot quietly become twenty accounts — and we can trace exactly which accounts used which code."
**Deep dive:** `max_uses` (1–500) with `CHECK (uses <= max_uses)` and an atomic counter; `invite_code_uses` is an audit table readable only by admins. Creating codes is admin-only and rate-limited (60/hour). Signup is additionally limited to **5 attempts/hour per hashed IP**.

### Q18 — What roles exist? Students, doctors, staff, dean, union?
**Status:** ⚠️ Partial — must be answered carefully
**Say this:** "There are two *system* roles: student and admin, and the admin role carries real power so only an existing admin can grant it. On top of that sits a separate, deliberately powerless layer of *university badges* — doctor, teaching assistant, student-union member — which show identity on a profile and grant zero technical privileges. A badge can never be traded for access."
**Deep dive:** `account_role` = `student | admin` only. Badges: `university_roles` (13 seeded definitions), `user_university_roles`, `user_role_audit_logs`, `set_user_role_verification()` — admin-only writes. Render-only. Gaps to admit: **no teacher/dean/staff system role, and badges gate nothing** (least privilege by design) — so a fake "doctor" is a *moderation* issue, not a breach (Q105).

### Q19 — Who can promote someone to admin? Can a user escalate themselves?
**Status:** ✅ Implemented
**Say this:** "Only an existing admin, and the database physically prevents self-escalation: if an account tries to change its own role or status, the write is rejected before it is stored."
**Deep dive:** `BEFORE UPDATE` trigger `profiles_protect_columns` → `protect_profile_columns()` returns early only for `postgres`/`supabase_admin`/`service_role`/`supabase_auth_admin` or when `is_admin(auth.uid())`; otherwise any change to `status`, `role`, `approved_at/by`, `rejection_reason`, `invite_code_id`, `verification_method` raises `profile_field_protected`. Two independent controls: the policy (`profiles_update_own` = own row only; `profiles_update_admin` for admins) **and** the trigger.

### Q20 — How are sessions handled? Where is the token stored?
**Status:** ⚠️ Partial — disclose this detail honestly
**Say this:** "The session is a signed JWT from Supabase, kept in a cookie, rotated automatically, and verified on every request before a page renders. One honest technical detail: as in every Supabase SSR app, that cookie is readable by JavaScript — which is exactly why I never inject raw HTML anywhere in the product."
**Deep dive:** `@supabase/ssr` defaults: `httpOnly: false`, `sameSite: "lax"`, `maxAge` 400 days, `secure` on HTTPS (`node_modules/@supabase/ssr/dist/main/utils/constants.js`). `httpOnly: false` is required because the browser client reads the session, so **an XSS bug would become session theft**. Existing mitigations: React escapes interpolation; **no `dangerouslySetInnerHTML`, no `eval`, no `innerHTML` anywhere in `src/`**; 11 dependencies; `npm audit` clean. Missing mitigation: **no CSP** (Q70). Access tokens are short-lived (~1 h) with refresh rotation; `getClaims()` verifies locally against cached JWKS.

### Q21 — Can you log someone out everywhere / remote-wipe a stolen phone?
**Status:** ❌ Not implemented
**Say this:** "There is no 'sign out of all devices' button today. What I can do immediately is suspend the account, which locks it out of every screen on every device — but a proper session-revocation control is on my list, not in the product."
**Deep dive:** `signOutAction()` only signs out the current browser. Suspension is effective anyway because every policy requires `is_approved_member()` (which requires `status='approved'`), so a suspended token renders nothing. Fix is small: an admin-only route calling the Supabase Admin API + a `sessions_revoked_at` column for hard enforcement (P17-T2-2).

### Q22 — Password reset, and how strong must passwords be?
**Status:** ❌ reset · ⚠️ rules
**Say this:** "There is no 'forgot password' screen yet — today a locked-out student is handled by an admin. Password rules are enforced by the form: minimum length and a complexity requirement, with Supabase hashing them with bcrypt, so nobody — including me — can read them."
**Deep dive:** `src/features/auth/validation.ts` (`signUpSchema`) validates the password server-side before the request; Supabase Auth hashes with bcrypt and never returns the hash. **Gap:** no reset screen and no recovery flow, although `signUpAction` already passes `emailRedirectTo` with a comment about "confirmation and recovery links" — the plumbing anticipates it. Fix: add a `/forgot-password` route calling `auth.resetPasswordForEmail()` plus a `/reset` page for `auth.updateUser()` (P17-T1-4 — a launch blocker if a student forgets a password on day one).

### Q23 — Brute-force protection on login?
**Status:** ✅ Implemented
**Say this:** "Ten failed attempts per ten minutes per network, and five signups per hour — counted in the database so it survives serverless restarts. Supabase also throttles the auth endpoint itself."
**Deep dive:** `rate_limits` table (fixed window) + `consume_rate_limit()` (SECURITY DEFINER), rules in `src/lib/rate-limit.ts:19-35`: `signIn` 10/10 min, `signUp` 5/hour, `inviteCheck` 30/10 min, `profileUpdate` 30/10 min, plus per-feature rules (posts 10/10 min, reactions 120/10 min, chat start 30/10 min, story view 300/10 min, group create 10/10 min …). Keys are **SHA-256 hashed** so no IP or email is stored. Two honest weaknesses: the salt falls back to the literal `"oustians"` if `RATE_LIMIT_SALT` is unset 🔴, and a broken limiter **fails open** by design (`return true`) so it can never lock people out — a deliberate availability-over-strictness trade-off you should state as such.

### Q24 — How does account approval work end to end?
**Status:** ✅ Implemented
**Say this:** "A new account is invisible until an admin approves it. The approval screen lists who is waiting with their name, faculty and code, and one click flips the status — the action is recorded against the admin who did it."
**Deep dive:** `/admin` → `approval-queue.tsx` → server action (`admin:approval`, 100/10 min) → policy `profiles_update_admin` (admin-only) → `protect_profile_columns()` allows it because the caller is an admin; `approved_at`/`approved_by` are stamped. Rejection stores `rejection_reason`. Unapproved states are intercepted by `requireApprovedMember()` and redirected to `/pending`.

### Q25 — Suspension: what actually happens to a banned user?
**Status:** ✅ Implemented
**Say this:** "The moment an admin sets an account to suspended, every screen and every database read stops returning anything for that account — they cannot even see the feed. Their old posts remain, because suspension removes access; removing content is a separate deliberate action."
**Deep dive:** `account_status` includes `suspended`; `is_approved_member()` requires `status='approved'`, so all read policies return zero rows and `requireApprovedMember()` redirects to `/pending`, which renders the suspension message. Content is not cascaded away.

### Q26 — Can a student impersonate a doctor or a dean?
**Status:** ⚠️ Partial
**Say this:** "In the system, no: badges are granted only by an admin and every grant is logged. What a student *can* do is write 'Dr.' in their display name, because there is no moderation queue for names yet. That is a moderation gap, not a security one."
**Deep dive:** `set_user_role_verification()` is the only writer of `user_university_roles`, admin-gated, with an audit row per transition. But `profiles.full_name` is user-editable (`profiles_update_own`) with no reserved-prefix filter and no approval step. Fix: block reserved prefixes ("Dr.", "Prof.", "أ.د") on `full_name` + a report button (P17-T2-3).

### Q27 — Do teachers/staff need accounts, and what could they see?
**Status:** ❌ Not implemented (design gap)
**Say this:** "Today the app is students-only. If the university wants staff accounts, they need a staff role with read-only powers defined in the database — not just a badge — and I would want the university to approve that scope before I build it."
**Deep dive:** No `teacher`/`staff` role; `admin` is all-or-nothing (`is_admin()`), no scoped permissions. Adding staff = new enum value + `is_staff()` helper + per-table policy branches + a privacy decision about whether staff may read student posts. A dean will ask this; answer with the design, not a promise.

### Q28 — What happens to data when an account is deleted or revoked?
**Status:** ⚠️ Partial
**Say this:** "Deleting an account removes their personal rows through database cascade rules; suspending keeps the history but removes all access. There is no self-service deletion yet — an admin does it."
**Deep dive:** Cascades declared across `profiles` → posts, comments, connections, conversation membership, messages, stories, RSVPs, group membership. **Storage objects are not cascaded** — bucket objects must be removed separately (Q247). No admin UI for deletion; done in the Supabase dashboard today.

### Q29 — Login with Google / Microsoft / university SSO?
**Status:** ❌ Not implemented
**Say this:** "Email and password only today. SSO is the natural upgrade if the university has a Google or Microsoft tenant, and Supabase can add it without changing my database rules."
**Deep dive:** No OAuth providers configured, no `signInWithOAuth` calls. Adding it needs an OAuth client, redirect URLs, and a decision that SSO *replaces* the invite code while still respecting manual approval.

### Q30 — Two-factor authentication?
**Status:** ❌ Not implemented
**Say this:** "Not built. For students I judged the friction higher than the risk, but for *admin* accounts it matters most — that is where I would add it first, and it is a small change in Supabase."
**Deep dive:** Supabase Auth supports TOTP MFA; no `mfa` calls in the codebase. Priority = admin accounts, which can approve, suspend, grant badges and read the approval queue (P17-T2-4).

### Q31 — What stops a script creating 1,000 fake accounts?
**Status:** ⚠️ Partial
**Say this:** "You cannot sign up without a valid invite code; no account can do anything until a human approves it; and signup is limited to five attempts per hour per network. A determined attacker with a leaked code could queue junk accounts, but they would sit in the approval queue where a human sees them."
**Deep dive:** `auth:signup` 5/h per hashed IP; per-code `max_uses`; manual approval; unique constraints on username/email. **Missing:** CAPTCHA (Turnstile), email-domain allow-list, disposable-email detection. Cheapest real improvement: Turnstile on the signup form (P17-T2-5).

### Q32 — Admins can read everything — how is that controlled?
**Status:** ⚠️ Partial
**Say this:** "Admins see the approval queue, invite codes and badge grants. What an admin *cannot* do through the product is read private chats — the chat policy is member-only with no admin override. I keep the number of admins deliberately tiny."
**Deep dive:** Admin surfaces: `/admin` + `profiles_select_admin`/`profiles_update_admin`. `messages_select` = `is_conversation_member(conversation_id)`, **no admin branch** — a provable privacy property and your strongest answer here. Unvarnished caveat: whoever holds the service-role key or dashboard access (i.e. the founder) can read everything in SQL. Say that plainly before anyone discovers it.

### Q33 — What if an admin account is hacked?
**Status:** ⚠️ Partial
**Say this:** "That is my worst-case account compromise. An attacker with admin rights could approve accounts, suspend students and grant badges — but they could not read private chats, and everything they do is attributed and recoverable."
**Deep dive:** Blast radius: approve/reject/suspend (`protect_profile_columns` permits admins), create invite codes, grant badges. Not possible through the product: reading `messages`. Recovery: revoke the admin's `role`, re-approve/suspend affected accounts, rotate the service-role key (dashboard), audit `user_role_audit_logs` + `approved_by` stamps. Fixes: MFA for admins (Q30), a second admin, and an `admin_audit_log` table covering approvals/suspensions (only badge changes are logged today) — P17-T1-5.

---

# PART 3 — DATABASE & DATA MODEL

### Q34 — Explain your database in plain language.
**Status:** ✅ Implemented
**Say this:** "Twenty-eight tables. One row per person, one row per post, one row per photo, one row per message, and the links between them — who is connected to whom, who reacted to what, who belongs to which presentation group. Everything is a real relationship with a rule attached, so the database itself cannot store something impossible, like two reactions from the same person or an eleventh member in a ten-person group."
**Deep dive:** Groups of tables — **Identity**: `profiles`, `universities`, `university_subjects`, `university_roles`, `user_university_roles`, `user_role_audit_logs`, `invite_codes`, `invite_code_uses`, `rate_limits`. **Social**: `posts`, `post_media`, `post_reactions`, `post_comments`, `comment_reactions`, `post_likes` (dead), `connections`, `conversations`, `conversation_members`, `messages`, `notifications`. **Campus**: `events`, `event_rsvps`, `presentation_groups`, `presentation_group_members`, `presentation_group_invitations`, `stories`, `story_media`, `story_views`. 39 indexes, ~50 functions, 16 triggers.

### Q35 — Walk me through the relationships that matter.
**Status:** ✅ Implemented
**Say this:** "A person has many posts; a post has media, reactions and comments; a comment can have one level of replies. A connection is a single row for a pair of people — that is how we avoid duplicate friend requests. A conversation only exists for people who are members of it, and a presentation group is capped at ten with invitations that expire when the spots fill."
**Deep dive:** `connections` stores one row per pair with `least()/greatest()` normalisation (so A→B and B→A cannot both exist) plus a status. `post_comments.parent_id` with `ensure_comment_parent()` flattening to a single nesting level. `conversations` + `conversation_members` (composite PK, `last_read_at` cursor); accepting a connection fires `connections_ensure_conversation` to open the thread. `presentation_group_members` with a `FOR UPDATE`-guarded insert in `invite_to_presentation_group`/`respond_presentation_group_invitation` enforcing the 10-member cap.

### Q36 — Prove a user cannot read another user's private data.
**Status:** ✅ Implemented — this is your money demo
**Say this:** "I can prove it live. Every table has row-level security: the database filters every single query by the logged-in identity. If I run a query *as* student A asking for student B's messages, the database returns nothing — not because my app hides it, but because it is not allowed to return the row."
**Deep dive:** Live proof sequence: (1) log in as A, open devtools, copy the access token; (2) in the Supabase SQL editor, `set request.jwt.claims` to A's claims, or simply call the REST endpoint with `apikey: <publishable>` and `Authorization: Bearer <A's JWT>` and `GET /rest/v1/messages?select=*` → only A's conversations return; (3) try `story_media` for a non-connection → empty; (4) show `profiles` returning only approved members. Table-by-table map: `messages` → conversation membership; `conversations`/`conversation_members` → membership; `posts`/`post_media`/`post_comments`/`post_reactions`/`comment_reactions` → approved members; `stories`/`story_media` → `can_view_story()` (author, or connected within 24 h); `connections` → either side of the row; `notifications` → `recipient_id = auth.uid()`; `event_rsvps` → approved members; groups → members; `rate_limits` → function-only; `invite_codes`/`invite_code_uses` → admin-only; `user_*_roles`/audit → read for members, write admin-only.

### Q37 — Is the "private profile" enforced in the database?
**Status:** ⚠️ Partial — **disclose this before anyone finds it**
**Say this:** "Partly, and I will be exact because this is the kind of thing a technical person will test. The *switch* hides a private profile's bio, faculty and graduation year from other students in the app. But the database rule is 'any approved member may read profile rows' — the hiding happens in the screen layer, not in the database. So a student who inspected the API could still read those fields. I know exactly how to fix it and it is a small migration."
**Deep dive:** `src/features/profile/*` and `supabase/migrations/20260924130000_profile_privacy.sql` — that migration's own header states the design: *"The RLS boundary stays 'approved members only' — nothing secret is stored here, so the gating happens where the profile is rendered, not in policy."* So `profiles_select_approved` returns the full row (including `bio`, `faculty`, `graduation_year`, `is_private`) to any approved member. **Fix:** a Postgres view `profiles_public` that nulls those columns when `is_private` and the viewer is neither owner nor admin, then point reads at the view; or a per-column policy via `security_invoker` view (P17-T1-2). This is the single most likely "gotcha" for a security-minded IT person at the demo.

### Q38 — Race conditions: double reactions, double requests, the 11th group member?
**Status:** ✅ Implemented
**Say this:** "Three specific races are closed at the database level: you cannot react twice to the same post (a unique key on the pair), you cannot create two connection requests between the same two people (one row per pair), and two people accepting the last group invite at the same instant cannot produce eleven members, because the database locks the group row while it counts."
**Deep dive:** `post_reactions` unique on `(post_id, user_id)` with `react_to_post()` upsert semantics; `comment_reactions` likewise. `connections` normalised pair + `set_connection()` taking the row `FOR UPDATE`. `invite_to_presentation_group()` / `respond_presentation_group_invitation()` `SELECT … FOR UPDATE` the group row before counting members (`>= 10` guard, `20260928000000_groups_and_roles.sql:314,397`). Stories: `view_story()` inserts into `story_views` whose PK is `(story_id, viewer_id)` so repeat views never inflate the count; `create_story()` is idempotent on `storage_key` so a double-tap cannot create two stories.

### Q39 — Migrations, versioning and seeds?
**Status:** ✅ Implemented
**Say this:** "Sixteen numbered SQL migrations, applied in order, forward-only — the database is the source of truth for its own history. The only seed data is the university and its subject list, written so it can be re-run safely."
**Deep dive:** `supabase/migrations/*.sql`, named `YYYYMMDDHHMMSS_description.sql`; applied with `supabase db push`; generated TypeScript types come from the live schema (`npm run db:types` → `src/lib/supabase/database.types.ts`, 42.5k lines, committed so the app compiles without a database connection). Seeds: `universities` (OUST, fixed UUID `0000…0001`), `university_subjects` (~30 rows across four faculties), `university_roles` (13 definitions) — all `on conflict do nothing`. No seed users, no fake accounts, no demo data in production paths. **Gap:** no down-migrations and no staging database to rehearse against (P17-T2-6).

### Q40 — Indexes: are the important queries actually fast?
**Status:** ✅ Implemented
**Say this:** "Thirty-nine indexes, written for the queries the app actually runs — the feed by date, a profile's posts, unread notifications, unread messages, and the expiry sweep for stories. That is why the screens stay fast as the tables grow."
**Deep dive:** Examples: `posts_author_idx (author_id, created_at desc)`, `notifications_unread_idx (recipient_id) where read_at is null`, `notifications_recipient_idx (recipient_id, created_at desc)`, conversation/message indexes for the inbox, `stories_expires_idx (expires_at)`, `story_media_storage_key` unique, plus the tables' PK/unique keys. **Gap:** search has **no index** for `ILIKE %term%` on `full_name`/`username` (no `pg_trgm`), so search is a sequential scan today — invisible at campus scale, but it is the first thing to fix when the member table grows (P17-T2-7).

### Q41 — Unbounded queries anywhere?
**Status:** ⚠️ Partial
**Say this:** "Every list I ship has a hard limit: thirty posts, a hundred comments, a hundred viewers, fifty conversations. Nothing can ask the database for 'everything'. What we do not have yet is pagination — you get the most recent page, not infinite scroll."
**Deep dive:** `listFeedPosts` limit 30, `listAuthorPosts` 30, `listPostComments` 100, `listStoryViewers` 100, `listConnectedMembers` 50, `listSuggestedMembers` bounded candidate page. `rate_limits` grows unbounded (no pruning job) — a slow table-growth issue, not a query issue (Q243). Feed/comments have **no cursor pagination**, so an old post is unreachable from the feed once it falls off the first 30 (Q116).

<!-- CHUNK-END -->
