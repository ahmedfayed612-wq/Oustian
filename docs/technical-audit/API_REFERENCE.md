# API Reference — Oustians (no REST; Server Actions + Postgres RPCs)

Convention: every mutation = zod validation → `requireApprovedMember()` (or `requireAdmin()`) → RPC / RLS-guarded query. Errors return localized messages, never throw secrets. Rate limits on auth paths via `consume_rate_limit()`.

## Auth (`src/features/auth/*`)

`signupWithInvite()` (invite code + `is_invite_code_valid`, creates pending profile), `login()` (rate-limited), `signOut()`, `createAvatarUploadTicket()` (SEC-001: no byte sniff), `requireApprovedMember()`, `requireAdmin()`, `getSessionProfile()`.

## Feed (`feed/actions.ts`, `feed/queries.ts` 283 lines)

`createPost()`→`create_post()`, `deletePost()`, `toggleLike()` (legacy) / `setPostReaction()`→`react_to_post()`, `addComment()`→`handle_new_comment`, `deleteComment()`. Reads: campus feed, profile posts, post detail — cursor pagination.

## Reactions (`reactions/actions.ts`, `queries.ts` 268 lines)

4 types fire/insight/same/talk; `UNIQUE(post,user,type)`; triggers `after_*_reaction`→`maintain_reaction_notification()`. Comment reactions mirror. Tests: `queries.test.ts` green.

## Stories (`stories/actions.ts` 354 lines, `queries.ts` 465 lines)

`createStory()`→`create_story()` (photo sniff + video sniff post-`29000000`), `viewStory()`→`view_story()`, `deleteStory()`→`delete_story()`. Reads filter `expires_at > now()` + `can_view_story()`. No cron.

## Groups (`groups/actions.ts` 191 lines, `capacity.ts` 42 lines)

`create_presentation_group/invite/respond/leave` RPCs; cap rule unit-tested (`capacity.test.ts` green).

## Connections / chat / events / notifications / roles / admin / media

Connections: `set_connection()` via actions; suggestions (`suggested-members.ts`, `suggestions.ts`, test green). Chat: `start_conversation()`, `ensure_connection_conversation()`, `list_conversation_previews()`; Realtime subscribe in `thread.tsx`. Events: `handle_new_event/rsvp()`; `rsvp-button.tsx`. Notifications: `queries.ts` 41 lines, read/unread, `notification-button.tsx`. Roles: `set_user_role_verification()` (admin), `role-badge.tsx`. Admin: approval queue + invite-code + role-badge managers (all `requireAdmin`). Media: ticket→direct-upload→commit (`media/actions.ts`, `client-media.ts` 246 lines, `image.ts` 196, `video.ts` 175, `limits.ts`).

## External contracts

None (no webhooks, no third-party APIs). Supabase Auth email default (UNVERIFIED). Idempotency: reaction/comment toggles + unique constraints are idempotent; post/story creates are NOT (retry = duplicate). Concurrency: group-cap + connection-accept races guarded in RPCs (IMPLEMENTED, load test NOT FOUND).
