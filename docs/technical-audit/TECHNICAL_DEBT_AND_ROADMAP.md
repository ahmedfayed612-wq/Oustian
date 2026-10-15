# Technical Debt & Roadmap — Oustians

Effort: S <1d, M 1–3d, L 1–2w (single dev, assumptions noted). Priority: P0 launch-blocker → P3 cleanup.

| ID | Finding | Priority | Effort | Verification |
|---|---|---|---|---|
| TD-001 | Avatar ticket lacks byte-sniff (SEC-001) | P0 | S | upload polyglot rejected; suite green |
| TD-002 | No story purge schedule; tombstones accumulate | P0 | S–M | expired rows purged nightly; reads still filtered |
| TD-003 | No CI (typecheck+lint+test) / SAST / audit | P0 | S | `.github/workflows` green on PR |
| TD-004 | No CSP (SEC-004, planned M8) | P1 | S | header asserted in preview |
| TD-005 | Missing tests: auth/guards/chat/events/notifs/RLS/storage | P1 | M | new suites green; e2e vs preview |
| TD-006 | Write-path rate limits (SEC-003) | P1 | S–M | burst test 429s correctly |
| TD-007 | Search `ilike` full-scan; no post/event search | P1 | M | FTS index + latency measured |
| TD-008 | Oversized modules (`post-card` 607, `story-viewer` 462, `composer` 487) | P2 | M | split, no behavior change, tests green |
| TD-009 | No observability (error tracking, logs, alerts) | P1 | S–M | error sink + alert drill |
| TD-010 | No backup/restore proof (PITR plan UNVERIFIED) | P0 | S | restore drill on staging |
| TD-011 | README milestones stale (M2/M4 text vs shipped code) | P2 | S | docs match `git log` |
| TD-012 | No rollback/down-migration story | P1 | S | down scripts or snapshot SOP |

Roadmap: (1) P0 hardening (TD-001–003, TD-010) → (2) abuse/visibility (TD-004,006,009) → (3) scale (TD-002,007) → (4) quality (TD-005,008,011,012). Outstanding external verification: live Supabase config/policies/storage, `oustians.com` DNS/TLS, Vercel env/regions, Auth email templates, `db push` dry-run of all 16 migrations.
