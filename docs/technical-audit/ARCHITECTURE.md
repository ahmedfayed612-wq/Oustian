# Architecture — Oustians (verified implementation)

## 1. System context

```mermaid
flowchart LR
    U[Student browser<br/>Next.js 16 App Router<br/>en/ar + light/dark] --> V[Vercel<br/>region dub1<br/>Next SSR + Server Actions]
    V --> S[Supabase<br/>Auth + Postgres RLS<br/>Storage + Realtime]
    V --> C[Supabase Storage CDN<br/>avatars / post-media / story-media]
    U --> C
    A[Admin browser] --> V
    style S stroke-dasharray:0
```

No other backend, queue, search, analytics, or payment service exists in code. Email delivery = Supabase Auth default (UNVERIFIED live).

## 2. Container / service architecture

```mermaid
flowchart TB
    subgraph Client["Browser (RSC + client islands)"]
        R["Routes src/app/[locale]/(app|auth)"]
        F["Feature UI src/features/*/*.tsx"]
        SB["Supabase browser client<br/>src/lib/supabase/client.ts"]
    end
    subgraph Server["Next server (Vercel dub1)"]
        P["proxy.ts<br/>locale + session refresh"]
        G["Guards requireApprovedMember/requireAdmin<br/>src/features/auth/session.ts"]
        A["Server Actions src/features/*/actions.ts"]
        SS["Supabase server client<br/>src/lib/supabase/server.ts"]
    end
    subgraph Supa["Supabase project (linked, live UNVERIFIED)"]
        AU["Auth"]
        PG[("Postgres + RLS<br/>28 tables / ~62 policies / ~40 funcs")]
        ST[("Storage<br/>avatars post-media story-media")]
        RT["Realtime (chat)"]
    end
    R --> G --> A --> SS --> PG
    F --> SB --> PG
    F --> SB --> ST
    F --> SB --> RT
    P --> SS
```

## 3. Frontend component & data flow

```mermaid
flowchart LR
    Shell["AppShell + SideNav/BottomNav<br/>RightRail + PageHeader"] --> Feed["Feed (page.tsx + post-card + reaction-bar)"]
    Shell --> Stories["story-tray → story-viewer"]
    Shell --> Groups["groups pages + member actions"]
    Shell --> Chat["chat list + thread (Realtime)"]
    Shell --> Admin["admin approval-queue + invite + role-badge managers"]
    Feed --> Q["queries.ts (server reads)"]
    Feed --> M["actions.ts (mutations) + router.refresh()"]
    Q --> DB[("Postgres")]
    M --> DB
```

Entry: `src/app/[locale]/layout.tsx` (html lang/dir, fonts, ThemeProvider, NextIntlClientProvider) → `(auth)` (login/signup/pending, outside shell) vs `(app)/layout.tsx` (member shell, `requireApprovedMember`) → `admin/layout.tsx` (`requireAdmin`). RSC `staleTimes.dynamic 30s` (`next.config.ts:63-66`); mutations invalidate via `router.refresh()`.

## 4. Backend request processing

```mermaid
sequenceDiagram
    participant B as Browser
    participant P as proxy.ts
    participant G as Guard
    participant A as Server Action
    participant D as Postgres (RLS)
    B->>P: request (locale + session refresh, skipped w/o cookie/env)
    P->>G: route render / action call
    G->>D: requireApprovedMember: profiles lookup (status+role)
    A->>A: zod validation
    A->>D: consume_rate_limit (auth paths) then RPC / insert / update
    D-->>A: result or RLS denial
    A-->>B: revalidate / refresh / error message
```

DB logic lives in Postgres functions (`create_post`, `react_to_post`, `react_to_comment`, `create_story`, `view_story`, `delete_story`, `handle_new_*`, `set_connection`, `ensure_connection_conversation`, `create_presentation_group`, `invite_to_presentation_group`, `respond_presentation_group_invitation`, `leave_presentation_group`, `set_user_role_verification`, …) — see DATABASE_REFERENCE.

## 5. Auth & session sequence

```mermaid
sequenceDiagram
    participant U as User
    participant N as Next
    participant A as Supabase Auth
    participant D as profiles / invite_codes
    U->>N: signup (invite code + university fields)
    N->>D: is_invite_code_valid + insert profile pending
    A-->>N: session (pending)
    U->>N: /pending (pending-refresher polls)
    N->>D: admin approves (admin/approval-queue)
    N-->>U: member shell unlocked
```

OAuth, MFA, email verification, custom recovery UI: NOT FOUND.

## 6. Media upload & delivery

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as Next (ticket action)
    participant S as Storage
    participant D as Postgres
    B->>N: request upload ticket (auth + zod + sniff for posts/stories)
    N-->>B: signed path
    B->>S: direct PUT (avatars / post-media / story-media)
    B->>N: commit mutation (create_post / create_story)
    N->>D: RPC validates owner + writes rows
    B->>S: GET via next/image (30d cache)
```

Avatar path has NO server byte-sniff (SEC-001). Story publish does sniff (fixed in `367be1f`). Expiry = read-time filter (`expires_at > now()`), no cron (see stories section).

## 7. Deployment architecture

```mermaid
flowchart LR
    GH["GitHub main<br/>ahmedfayed612-wq/Oustian"] --> VC["Vercel (dub1)<br/>next build/start"]
    VC --> SU["Supabase linked project<br/>db push applies migrations"]
    VC --> DNS["oustians.com (UNVERIFIED)"]
```

CI/CD workflow diagram: NOT APPLICABLE — no pipeline exists (NOT FOUND). Deploy = manual `git push` → Vercel auto-build (inferred from hosting choice, UNVERIFIED live) + manual `supabase db push`.

## 8. Decisions & trade-offs (evidenced)

- Supabase-everything (no custom server) → fast campus app, but RLS + RPC correctness is the entire security boundary.
- Direct-to-storage uploads → no Vercel bandwidth, but ticket/sniff logic must be airtight (see SEC-001/002).
- Read-time story expiry → no cron ops, but relies on every query filtering + `purge_expired_stories()` being called (PARTIAL — no schedule).
- RSC 30s stale + refresh → snappy nav, live-enough feed; risk = stale admin queues (accepted).
- CSP deferred to M8 → current headers are baseline only.
