# Oustians — Image Post Publishing Audit Report

## 1. Executive Summary

**What was broken:** Image-post publishing failed with the generic error "Couldn't publish your post — please try again." Text-only posts continued to work.

**Root cause:** Migration `20261027000001_remove_thumbnail_columns.sql` dropped `thumbnail_key`, `thumb_width`, `thumb_height` from `public.post_media` but did **not** update `public.create_post()`. The function still references those dropped columns in its `INSERT INTO post_media`. Every photo-post publish failed with: `column "thumbnail_key" of relation "post_media" does not exist`. The RPC error was swallowed and surfaced as the generic failure message.

**Contributing issue:** The feed read query selected the dropped columns, which would break feed rendering for media posts even after the publish fix.

**Status:** Fixed and verified locally (82/82 tests pass, typecheck clean, lint clean, build succeeds). Requires database migration deployment to production Supabase.

## 2. Problem Description

**User-facing issue:** When a user creates a post with an attached image, the image preview renders correctly. After pressing Publish, the operation fails with:

> "Couldn't publish your post — please try again."

**Reproduction steps:**
1. Open Oustians in a browser (reported on mobile Safari, iPhone).
2. Navigate to `/create`.
3. Enter optional caption text.
4. Select an image file (JPEG, PNG, or WebP).
5. Confirm image preview renders.
6. Click Publish.
7. Observe the generic error.

**Scope:** Photo posts only. Text-only posts were unaffected. Image selection, processing, preview, and Storage upload all worked. The failure occurred at the database insertion step.

## 3. Architecture Overview

### Frontend publishing pipeline

1. **Image selection** (`src/app/[locale]/(app)/create/post-composer.tsx`): User picks a file via `<input type="file">`.
2. **Client-side processing** (`src/features/media/image-process.ts`): `createImageBitmap` applies EXIF orientation, canvas re-encode drops EXIF/GPS, longest edge capped at 2048 px, output as WebP at quality 0.85.
3. **Signed upload ticket** (`src/features/media/actions.ts` → `createPostMediaTicketsAction()`): Server action mints a Supabase Storage signed upload URL for the full-resolution image under path `<user_id>/<uuid>.webp` in the private `post-media` bucket.
4. **Direct upload**: Browser PUTs the processed WebP to the signed URL via `supabase.storage.from(bucket).uploadToSignedUrl()`.
5. **Publish** (`src/features/feed/actions.ts` → `createPostAction()`): Server action validates form data, checks rate limit, downloads the uploaded object from Storage, sniffs real bytes to validate format/size/dimensions, then calls `supabase.rpc("create_post", {...})`.
6. **Database insert** (`public.create_post()` RPC): SECURITY DEFINER function that inserts into `public.posts` and `public.post_media` atomically. Handles idempotent retry.
7. **Feed refresh**: On success, client navigates to `/` and calls `router.refresh()`.

### Database schema

- **`public.posts`**: `id`, `author_id`, `body`, `created_at`. Body may be empty (photo-only posts).
- **`public.post_media`**: `id`, `post_id`, `created_by`, `storage_key`, `mime_type`, `file_size`, `width`, `height`, `alt_text`, `display_order`.
- **`public.create_post()`**: SECURITY DEFINER RPC, the single write path for posts.

### Supabase Storage

- **Bucket `post-media`**: private, 10 MB limit, allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
- **Storage policies**: `post_media_insert_own` (upload into caller's own folder), `post_media_select` (approved members read), `post_media_delete_own` (owner or admin delete).

### RLS

- `posts_insert_own`: `author_id = auth.uid() and public.is_approved_member()`.
- `posts_select`: `public.is_approved_member()`.

## 4. Investigation Methodology

### Source code reviewed
| File | Purpose |
|------|---------|
| `src/app/[locale]/(app)/create/post-composer.tsx` | Image selection, processing, upload, form submission |
| `src/app/[locale]/(app)/create/page.tsx` | Create-post page (server component) |
| `src/features/feed/actions.ts` | `createPostAction` server action — publish path |
| `src/features/feed/validation.ts` | Zod schema for post creation form data |
| `src/features/feed/queries.ts` | Feed hydration — reads post media |
| `src/features/media/actions.ts` | `createPostMediaTicketsAction` — signed upload URLs |
| `src/features/media/limits.ts` | Limits, bucket names, MIME types, key builders |
| `src/features/media/image-process.ts` | Client-side image processing |
| `src/features/media/image.ts` | Server-side byte-level image validation |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server Supabase client |
| `src/lib/supabase/storage.ts` | Signed URL helpers for post media |
| `src/lib/supabase/database.types.ts` | Auto-generated TypeScript types |
| `src/lib/env.ts` | Environment validation |

### Database migrations reviewed
| Migration | Purpose |
|-----------|---------|
| `20260924130200_posts.sql` | Creates `posts` table, original `create_post()` (7-arg) |
| `20260926100000_post_media_photo_posts.sql` | Creates `post_media` table, bucket, storage policies, `create_post()` (7-arg) |
| `20261020000001_photo_thumbnails.sql` | Adds thumbnail columns, recreates `create_post()` (10-arg) |
| `20261027000001_remove_thumbnail_columns.sql` | **Drops thumbnail columns but does NOT update `create_post()`** ← root cause |
| `20261115000000_fix_create_post_after_thumbnail_removal.sql` | **New: fixes `create_post()` to match current schema** |

### Error message traced
- `src/messages/en.json:51`: `"failed": "Couldn't publish your post — please try again."`
- `src/features/feed/actions.ts:104-107`: RPC error → `{ status: "error", code: "post_failed" }` → `t("failed")`

### Production access
No production Supabase credentials are configured in this environment (no `.env.local`). Diagnosis is based on static code analysis of migrations, source code, and type definitions. Fix verified via unit tests, typecheck, lint, and production build — but not against a live database.

## 5. Root-Cause Analysis

### Root Cause 1: `create_post()` function references dropped columns (CONFIRMED)

**Explanation:** Migration `20261020000001_photo_thumbnails.sql` added `thumbnail_key`, `thumb_width`, `thumb_height` columns to `public.post_media` and recreated `public.create_post()` with a 10-parameter signature including `p_media_thumbnail_key`, `p_thumb_height`, `p_thumb_width`. The function's `INSERT INTO post_media` statement listed those columns. Migration `20261027000001_remove_thumbnail_columns.sql` subsequently dropped the three thumbnail columns but **did not** recreate or update `create_post()`. The function still references the dropped columns.

**Evidence:**
- `supabase/migrations/20261020000001_photo_thumbnails.sql:144` — INSERT references `thumbnail_key, thumb_width, thumb_height`
- `supabase/migrations/20261027000001_remove_thumbnail_columns.sql:13-20` — DROPs the three columns
- `supabase/migrations/20261027000001_remove_thumbnail_columns.sql` — contains NO `create or replace function public.create_post` statement
- `src/lib/supabase/database.types.ts` — `create_post` args listed `p_media_thumbnail_key`, `p_thumb_height`, `p_thumb_width` (stale types, now fixed)

**How it caused the failure:** When `createPostAction` calls `supabase.rpc("create_post", {...})` for a photo post, PostgreSQL executes the function body, which reaches `INSERT INTO post_media (... thumbnail_key, thumb_width, thumb_height ...)`. The columns no longer exist, so PostgreSQL raises: `column "thumbnail_key" of relation "post_media" does not exist`. The RPC error is caught by `createPostAction` (line 104), logged, and returned as `{ status: "error", code: "post_failed" }`, which the composer maps to `t("failed")` = "Couldn't publish your post — please try again."

**Why text-only posts worked:** For `p_media_key IS NULL`, the function returns early at the text-post branch (before reaching the broken INSERT). Only the photo-post path touches the missing columns.

### Root Cause 2: Feed query selects dropped columns (CONFIRMED)

**Explanation:** `src/features/feed/queries.ts:84` selected `thumbnail_key, thumb_width, thumb_height` from `public.post_media`. These columns no longer exist after migration `20261027000001_remove_thumbnail_columns.sql`.

**How it would cause failure:** Any feed page containing posts with media would fail when hydrating media, because the SELECT references non-existent columns. Fixed by removing those columns from the SELECT list.

### Secondary issue: Orphaned thumbnail uploads (CONFIRMED)

**Explanation:** The composer uploaded both a full-resolution image and a thumbnail to Supabase Storage, but the thumbnail was never recorded in `post_media` (no column for it after the removal migration). The thumbnail object was orphaned in Storage with no database reference and no cleanup path.

**How it was fixed:** Removed the thumbnail upload from the composer and `createPostMediaTicketsAction`. Only the full-resolution image is uploaded.

### Additional risks (not root causes, but identified during investigation)

| Risk | Status |
|------|--------|
| Feed query selected non-existent columns | FIXED (removed from SELECT) |
| Stale TypeScript types referenced dropped columns | FIXED (types updated) |
| Orphaned thumbnail Storage objects | FIXED (thumbnail upload removed) |
| No live database testing possible | REMAINING (no credentials available) |

## 6. Fixes Implemented

### 6.1 Database migration (NEW)

**File:** `supabase/migrations/20261115000000_fix_create_post_after_thumbnail_removal.sql`

- Drops the broken 10-argument `public.create_post()` function.
- Recreates it with the 7-argument signature matching the current `post_media` schema (no thumbnail parameters).
- The `INSERT INTO post_media` writes only existing columns: `(post_id, created_by, storage_key, mime_type, file_size, width, height, alt_text, display_order)`.
- Preserves idempotent retry, folder-ownership check, media validation, and authorization checks.
- Grants `EXECUTE` to `authenticated` role.
- No data is dropped or modified. Existing posts and media remain intact.

### 6.2 Feed query fix

**File:** `src/features/feed/queries.ts`

- Removed `thumbnail_key, thumb_width, thumb_height` from the `post_media` SELECT list.
- Query now selects: `id, post_id, storage_key, mime_type, width, height, alt_text, display_order`.

### 6.3 Media actions fix

**File:** `src/features/media/actions.ts`

- `PostMediaTickets` type simplified: only `full` (no `thumb`).
- `createPostMediaTicketsAction()` mints a single signed upload URL for the full-resolution image (no thumbnail ticket).

### 6.4 Post composer fix

**File:** `src/app/[locale]/(app)/create/post-composer.tsx`

- Removed `thumbKey` state and `setThumbKey` calls.
- Removed parallel thumbnail upload; only the full-resolution image is uploaded.
- Removed `thumbKey` hidden form input.
- Removed unused `POST_MEDIA_BUCKET` import.
- Updated comments to reflect full-resolution-only upload.

### 6.5 Feed validation fix

**File:** `src/features/feed/validation.ts`

- Removed unused `thumbKey` field from `postSchema`.

### 6.6 Database types fix

**File:** `src/lib/supabase/database.types.ts`

- Removed `thumbnail_key`, `thumb_width`, `thumb_height` from `post_media.Row`, `post_media.Insert`, `post_media.Update`.
- Removed `p_media_thumbnail_key`, `p_thumb_height`, `p_thumb_width` from `create_post.Args`.

### Why each change was necessary

| Change | Reason |
|--------|--------|
| Fix `create_post()` function | The function referenced columns that no longer exist — this was the direct cause of every photo-post publish failure. |
| Remove thumbnail columns from feed SELECT | The feed query would fail for any post with media, even after the publish fix. |
| Remove thumbnail upload from composer | Thumbnails were uploaded but never tracked in the database (orphaned files). Removing eliminates waste and simplifies the pipeline. |
| Remove `thumbKey` from schema and form | No longer needed since thumbnails are not stored. |
| Update database types | Types were stale (reflected pre-removal schema) and would cause type errors. |

## 7. Security Review

**Authentication:** `createPostAction` and `createPostMediaTicketsAction` both call `requireApprovedMember()` before any operation. The `create_post()` RPC is SECURITY DEFINER and checks `auth.uid()` and `is_approved_member()`.

**RLS:** All RLS policies remain enabled and unchanged:
- `posts_insert_own`: `author_id = auth.uid() and public.is_approved_member()` — user can only insert posts as themselves.
- `post_media` RLS: `post_media_rows_select` allows approved members to read attachments; no direct write policy (writes only through `create_post()` SECURITY DEFINER).

**Storage policies:** Unchanged and preserved:
- `post_media_insert_own`: `bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text` — users can only upload into their own folder.
- `post_media_select`: approved members can read post-media objects.
- `post_media_delete_own`: owner or admin can delete.

**No security bypass:** No RLS policies were disabled. No buckets were made public. No service-role keys were exposed. The publish action still validates bytes server-side (downloads from Storage and sniffs signatures) before inserting into the database.

**Path safety:** `buildMediaKey()` constructs paths from the authenticated user's ID and a UUID — the client's filename is never part of the path. The `isValidMediaKey()` guard in `createPostAction` verifies ownership before publish.

**Data integrity:** The idempotent retry in `create_post()` prevents duplicate posts on double-click or lost response. On RPC failure, `createPostAction` removes the uploaded Storage object to prevent orphaned files.

## 8. Testing Results

| Test | Environment | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| Unit tests (82 tests, 20 suites) | Node.js (local) | All pass | All pass | PASS |
| TypeScript typecheck (`tsc --noEmit`) | Local | No errors | No errors | PASS |
| ESLint | Local | No errors | No errors (1 pre-existing warning) | PASS |
| Next.js production build (`next build`) | Local | Success | Success | PASS |
| Publish text-only post | Not tested | — | — | NOT TESTED |
| Publish image post | Not tested | — | — | NOT TESTED |
| Publish image with caption | Not tested | — | — | NOT TESTED |
| Publish image with emoji caption | Not tested | — | — | NOT TESTED |
| Invalid file type rejection | Not tested | — | — | NOT TESTED |
| Oversized image rejection | Not tested | — | — | NOT TESTED |
| Storage upload failure | Not tested | — | — | NOT TESTED |
| Database insertion failure | Not tested | — | — | NOT TESTED |
| Rapid Publish clicks (no duplicates) | Not tested | — | — | NOT TESTED |
| Reload after upload | Not tested | — | — | NOT TESTED |
| Cross-account image access | Not tested | — | — | NOT TESTED |
| Mobile Safari compatibility | Not tested | — | — | NOT TESTED |
| Retry after failure | Not tested | — | — | NOT TESTED |

**Testing limitation:** No `.env.local` with Supabase credentials exists in this environment, so no live database integration tests could be executed. The fix is verified statically (typecheck, lint, build) and through existing unit tests (82/82 passing). Integration testing against a live Supabase project is required before production deployment.

## 9. Remaining Issues

1. **No live database integration testing:** The fix cannot be validated against a real Supabase project in this environment. A deployment to staging or a linked Supabase project is needed to confirm end-to-end photo publishing.

2. **Mobile Safari not directly tested:** The reporter observed the failure on mobile Safari. The fix is browser-agnostic (uses standard Web APIs: `createImageBitmap`, `canvas.toBlob`, `fetch` via Supabase JS client). No mobile-specific code paths were changed. However, actual mobile Safari testing was not possible.

3. **Orphaned Storage objects on connection loss:** If a user loses connection after the Storage upload succeeds but before the database insert completes, the uploaded image object remains in Storage without a corresponding post row. This is a pre-existing limitation (Storage and PostgreSQL are not a single atomic transaction). The `create_post()` idempotent retry protects against duplicate posts on retry, but orphaned objects would require a separate cleanup process.

4. **Existing `post_media` rows with NULL thumbnail columns:** After the `remove_thumbnail_columns` migration, any existing rows never had thumbnail data (the columns were dropped). No data migration is needed.

## 10. Deployment Instructions

### Prerequisites
1. Access to the production Supabase project (via Supabase CLI or Dashboard SQL Editor).
2. The application must be redeployed to Vercel after the database migration is applied.

### Steps (in order)

1. **Apply the database migration** to the production Supabase project:
   ```bash
   # Using Supabase CLI (if linked):
   supabase db push
   
   # Or via Supabase Dashboard SQL Editor, run the contents of:
   # supabase/migrations/20261115000000_fix_create_post_after_thumbnail_removal.sql
   ```

2. **Deploy the application code** to Vercel (the frontend changes are already committed):
   ```bash
   git push origin <branch>
   # Vercel auto-deploys on push
   ```

3. **Verify** that image posts publish successfully in production.

### What is NOT required
- No environment variable changes.
- No new Storage buckets.
- No bucket configuration changes (the `post-media` bucket already exists with correct policies).
- No RLS policy changes.
- No database reset or data migration.

## 11. Final Verdict

**Fixed locally, awaiting production deployment.**

**Justification:** The root cause has been definitively identified: migration `20261027000001_remove_thumbnail_columns.sql` dropped columns from `post_media` without updating `create_post()`, which still references them. The fix recreates `create_post()` without the thumbnail parameters, removes the stale column references from the feed query, stops uploading unused thumbnails, and updates TypeScript types to match the actual schema.

All automated checks pass: 82/82 unit tests, TypeScript typecheck (0 errors), ESLint (0 errors), and Next.js production build. However, the fix has not been validated against a live Supabase database because no production credentials are available in this environment. Deployment of the new migration and application code to production is required to fully resolve the issue.