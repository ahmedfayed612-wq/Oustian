# Oustians

The private social app for **Obour University for Science and Technology (OUST)**.
Campus-only, bilingual (Arabic RTL + English LTR), mobile-first, installable.

> **Status: M0 (foundation) complete.** Auth, feed, events, chat and the admin
> panel land in the milestones listed at the bottom of this file.

---

## Stack

| Concern    | Choice                                                      |
| ---------- | ----------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, TypeScript, Turbopack)              |
| Styling    | Tailwind CSS v4 (CSS-first tokens in `src/app/globals.css`) |
| i18n       | `next-intl` 4 — locales `en`, `ar`, full RTL                |
| Theming    | `next-themes` — light / dark / system                       |
| Backend    | Supabase (Auth, Postgres + RLS, Storage, Realtime)          |
| Icons      | `lucide-react`                                              |
| Validation | `zod`                                                       |
| Hosting    | Vercel (`oustians.com`)                                     |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values (only needed from M1)
npm run dev                  # http://localhost:3000 -> redirects to /en or /ar
```

The app runs without Supabase credentials: anything that needs a project throws
a clear error instead of failing silently.

### Scripts

| Script                  | What it does                                    |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Dev server                                      |
| `npm run build`         | Production build                                |
| `npm run typecheck`     | `tsc --noEmit`                                  |
| `npm run lint`          | ESLint (`eslint-config-next`)                   |
| `npm run check`         | typecheck + lint (use before pushing)           |
| `npm run format`        | Prettier, including Tailwind class sorting      |
| `npm run db:new <name>` | Create a migration in `supabase/migrations`     |
| `npm run db:push`       | Apply migrations to the linked Supabase project |
| `npm run db:types`      | Regenerate `src/lib/supabase/database.types.ts` |

## Project structure

```
src/
  app/
    [locale]/            # every screen lives here (en + ar)
      layout.tsx         # <html lang dir>, fonts, providers, AppShell
      page.tsx           # home (becomes the two-tab feed in M3)
      events|chat|create|profile|settings|notifications|admin/
      not-found.tsx      # localized 404
      [...rest]/         # unknown paths inside a locale -> not-found
    global-not-found.tsx # 404 for requests the i18n proxy never matched
    globals.css          # design tokens (light + dark) — single source of truth
    fonts.ts             # Plus Jakarta Sans + IBM Plex Sans Arabic
  components/
    brand/BrandMark.tsx  # swappable placeholder logo (see file header)
    layout/              # AppShell, TopBar, SideNav, BottomNav, switches
    theme/               # ThemeProvider, ThemeToggle
    ui/                  # Button, IconButton, Card, Chip, Skeleton, EmptyState
  features/              # feature modules land here (auth, feed, chat, ...)
  i18n/                  # routing, navigation, request config
  lib/
    env.ts               # validated public env vars
    supabase/            # browser + server clients, proxy session refresh
    utils/cn.ts
  messages/{en,ar}.json  # every user-facing string
  proxy.ts               # Next 16 proxy: locale routing + Supabase session
supabase/migrations/     # SQL migrations (RLS included) — M1 onwards
```

## Design system

All tokens live in `src/app/globals.css`. Change them there, never in a
component.

| Token       | Light     | Dark      | Used for                    |
| ----------- | --------- | --------- | --------------------------- |
| `--brand`   | `#0F5C6B` | `#3FA3B5` | primary actions, active nav |
| `--accent`  | `#B99A5B` | `#D2B676` | gold highlights, "Going"    |
| `--bg`      | `#FAF8F4` | `#0C1517` | page background             |
| `--surface` | `#FFFFFF` | `#142125` | cards, sheets               |
| `--text`    | `#12262B` | `#EAF1F2` | body copy                   |
| `--muted`   | `#6B7F84` | `#8FA5AA` | secondary copy              |
| `--danger`  | `#D0453B` | `#EF6A60` | destructive actions         |

`--muted-ink`, `--accent-ink`, `--on-brand` … are WCAG-AA corrections of the
decorative fills; use the `-ink` / `on-` tokens whenever the color carries text.

Utility conventions:

- Radii: `rounded-card` (18px), `rounded-card-lg` (20px), `rounded-control`,
  `rounded-pill`.
- Shadows: `shadow-soft` (resting), `shadow-lift` (raised/hover).
- Type: body 16px, `text-body` (15px) for dense copy, 44px minimum tap target.
- Motion: 150-250ms `ease-out-soft`; `prefers-reduced-motion` is honored.

### Swapping in the real logo

Replace the two `<path>` elements in `PeakMark`
(`src/components/brand/BrandMark.tsx`) with the official artwork, keeping it
token- or `currentColor`-driven so both themes still work. Nothing else in the
codebase references the artwork.

The university's official logo is **not** embedded anywhere — it needs the
university's permission.

## Bilingual + RTL rules (non-negotiable)

1. Every user-facing string lives in `src/messages/{en,ar}.json`, including
   `aria-label`s. No literals in components.
2. Logical CSS properties only: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
   `text-start`, `border-s` / `border-e`. Never `left` / `right`.
3. Directional icons mirror through the `rtl:` variant defined in
   `globals.css` (e.g. `rtl:-scale-x-100`). Never mirror logos, avatars, photos
   or numbers.
4. User-generated content renders with `dir="auto"` once the feed lands (M3).
5. Western digits (`0-9`) in both locales; dates and relative times go through
   `next-intl` formatters with the `Africa/Cairo` time zone.
6. QA every screen at `/en/...` **and** `/ar/...` before closing a milestone.

## Supabase

Nothing is hard-coded: the browser client (`src/lib/supabase/client.ts`), the
server client (`src/lib/supabase/server.ts`) and the proxy session refresh
(`src/lib/supabase/proxy.ts`) all read validated env vars.

```bash
# one-time per machine (Docker must be running for a local stack)
npx supabase login
npx supabase link --project-ref <your-ref>

npm run db:new add_profiles_and_invite_codes
npm run db:push      # apply to the linked project
npm run db:types     # regenerate the typed client
```

From M1 on, **every table has RLS enabled** and every access rule is enforced in
a policy — the UI is never the security boundary. The tricky ones (public vs.
private posts, blocks, chat request limits, unapproved users) get automated
tests.

## Deploy

1. Push the repo to GitHub and import it in Vercel.
2. Add the env vars from `.env.example` (Production + Preview).
3. Add `oustians.com` in Vercel → Domains, then follow the DNS instructions.
4. Apply migrations to the production project with `npm run db:push`.

## Milestones

- [x] **M0 Foundation** — scaffold, design tokens, fonts, i18n + RTL, theming,
      `BrandMark`, app shell + navigation, Supabase wiring, docs
- [ ] **M1 Auth & profiles** — profiles/invite-code migrations, sign-up with
      invite code, profile setup, pending approval, admin approval
- [ ] **M2 Connections** — requests, blocks, search, private profiles
- [ ] **M3 Feed** — posts, media, likes, comments, visibility RLS + RLS tests
- [ ] **M4 Polls** · **M5 Events** · **M6 Chat** · **M7 Notifications, reports,
      admin** · **M8 Polish & launch (PWA, QA, seed data)**

## Assumptions & decisions (logged per milestone)

**M0**

- Locale prefix is always present (`/en/...`, `/ar/...`) so links are
  unambiguous and both directions are easy to QA. `defaultLocale` is `en`; the
  browser's `Accept-Language` wins on first visit (`localeDetection: true`) and
  the choice is persisted in the `OUSTIANS_LOCALE` cookie (later mirrored to
  `profiles.language`).
- Tailwind v4 with a CSS-first theme — there is no `tailwind.config.ts`.
- `lucide-react` for icons (free, tree-shaken by Next).
- Next 16 renamed `middleware.ts` to `proxy.ts`; `src/proxy.ts` does locale
  routing and Supabase session refresh, and is skipped entirely when Supabase
  env vars are absent (so the project runs before a Supabase project exists).
- Session refresh is also skipped when a request carries no auth cookie, to keep
  anonymous renders on the fast path.
- `--muted` is kept exactly as documented, but text uses `--muted-ink` (a
  slightly darker teal-grey) so secondary copy passes WCAG AA on `--bg`.
- The PWA icon set (192/512 PNG), manifest and offline fallback are M8 work; M0
  ships `themeColor`, `appleWebApp` metadata and an SVG favicon.
- Minimum tap target: primary buttons are 44px (`min-h-11`); the denser `sm`
  size (40px) is reserved for secondary desktop actions.
