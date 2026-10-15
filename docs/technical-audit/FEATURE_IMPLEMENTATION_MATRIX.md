# Feature Implementation Matrix — Oustians

Status: IMPLEMENTED = code exists (behavior not live-verified); PARTIAL = gaps noted. Tests: `npm test` 70/70 green 2026-10-15.

| # | Feature | Status | Frontend | Backend | DB | Tests | Gaps |
|---|---|---|---|---|---|---|---|
| 44 | Accounts/profiles | IMPLEMENTED | `(auth)/login,signup,pending`, `profile/[username]`, `profile/edit` + avatar-uploader | signup/login/signOut, avatar ticket, guards | `profiles`, `invite_codes(_uses)` | none e2e | OAuth/MFA/recovery UI NOT FOUND; avatar no sniff (SEC-001) |
| 45 | Feed/posts | IMPLEMENTED | `(app)/page.tsx`, `post-card.tsx` 607 lines, `FeedComposer`, `create/post-composer` | `createPost/deletePost/toggleLike`→`create_post()` | `posts`, `post_media` | media image/video tests | video-post UI UNVERIFIED; unbounded-feed perf plan missing |
| 46 | Reactions/comments | IMPLEMENTED | `reaction-bar/button/users-sheet` | `setPostReaction`, comment actions→`react_to_*` | `post_reactions`, `comment_reactions`, `post_comments`(+replies) | `reactions/queries.test.ts` + `tests/reactions.e2e.mjs` (script NOT RUN — needs live project) | dedup races under load UNVERIFIED |
| 47 | Stories | PARTIAL | `story-tray/viewer/composer` (viewer 462 lines) | `create/view/delete_story()` | `stories`, `story_media`, `story_views` | `stories/queries.test.ts` green | NO purge cron; cleanup relies on reads (TD-002) |
| 48 | Presentation Groups | IMPLEMENTED | `groups/` pages + member/invite components | create/invite/respond/leave RPCs | 3 group tables | `capacity.test.ts` green | concurrent-cap load test missing |
| 49 | Roles/badges | IMPLEMENTED | `role-badge.tsx`, admin `role-badge-manager` | `set_user_role_verification()` + audit log | 5 university tables | `roles/queries.test.ts` green | revocation UX UNVERIFIED |
| 50 | Connections/suggest | IMPLEMENTED | `connect-button`, sheets, suggested module | `set_connection()`, `suggested-members.ts` | `connections` | `suggestions.test.ts` green | ranking = recency/university only; block flow PARTIAL |
| 51 | Notifications | IMPLEMENTED | `notifications/page`, `notification-button` | triggers + `maintain_reaction_notification()` | `notifications` | none dedicated | push/email NOT FOUND; prefs NOT FOUND |
| 52 | Search | PARTIAL | `search/page.tsx` (`ilike`) | direct RLS SELECT | `profiles` | none | no FTS, no post/event search |
| 53 | i18n/responsive | IMPLEMENTED | `messages/en+ar.json` 534 lines each, RTL, LocaleSwitcher, AppShell/BottomNav | locale cookie→`profiles.language` | `profiles.language` | none locale | a11y/RTL QA evidence NOT FOUND |
| 54a | Events | IMPLEMENTED | `events/` pages + `rsvp-button` | event/rsvp handlers | `events`, `event_rsvps` | none | edit/reminders follow-ups per README |
| 54b | Chat | IMPLEMENTED | `chat/` list + `thread.tsx` (Realtime) | `start/ensure/list_conversation` | 3 chat tables | none | pagination/attachment limits UNVERIFIED |
| 54c | Admin/moderation | IMPLEMENTED | `admin/` queue + invite + badges | `requireAdmin` everywhere | all | none | reports module NOT FOUND; audit export NOT FOUND |
| 54d | Settings | IMPLEMENTED | `settings/page.tsx` | profile update | `profiles` | none | deletion flow UNVERIFIED |

Traceability: requirement → file → table → RPC → test is 1:1 in tables above; full path list in `AUDIT_EVIDENCE_INDEX.md`.
