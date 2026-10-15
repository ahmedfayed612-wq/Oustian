# Oustians — Technical Audit Index

Authoritative document: `MASTER_TECHNICAL_REPORT.md`.

| File | Purpose |
|---|---|
| `MASTER_TECHNICAL_REPORT.md` | Complete integrated technical report (Parts I–IX + Appendices summary). |
| `TECH_STACK_INVENTORY.md` | Languages, frameworks, packages, tools, runtimes, services, versions + evidence. |
| `ARCHITECTURE.md` | Components, boundaries, data flows, Mermaid diagrams. |
| `DATABASE_REFERENCE.md` | Schema, relationships, constraints, indexes, RLS, functions, data dictionary. |
| `API_REFERENCE.md` | Server actions, RPCs, validation, errors, concurrency. |
| `FEATURE_IMPLEMENTATION_MATRIX.md` | Per-feature status, code refs, DB deps, tests, gaps. |
| `SECURITY_AUDIT.md` | Threat model, controls, findings SEC-001…, remediation. |
| `TESTING_AND_QUALITY.md` | Test inventory, actual command results, quality assessment. |
| `DEPLOYMENT_AND_OPERATIONS.md` | Setup, env vars, build, deploy, CI/CD, backup/recovery. |
| `TECHNICAL_DEBT_AND_ROADMAP.md` | Prioritized backlog TD-001… with effort + verification. |
| `AUDIT_EVIDENCE_INDEX.md` | Paths, symbols, commands run, limitations. |
| `README.md` | This index. |

Audit date: 2026-10-15. Commit inspected: `7604ce4` (branch `main`).
Scope: static source inspection + `typecheck`, `lint`, unit `test` (all executed, green).
Live Supabase project, production data, dashboards: NOT inspected (no credentials) — marked UNVERIFIED where relevant.
No secrets are included in any file.
