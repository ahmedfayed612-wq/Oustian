-- ============================================================================
-- Story media: let the author read their own object
--
-- THE BUG: `create_story` publishes in two steps —
--
--   1. the browser uploads to `<owner>/<uuid>.<ext>` (insert policy: own folder)
--   2. the publish action downloads that object and sniffs its real bytes
--      (photo signature / video container) BEFORE any row exists
--   3. only then does `create_story()` insert `stories` + `story_media`
--
-- but the storage SELECT policy was written as
--
--     using (bucket_id = 'story-media' and public.can_view_story_object(name))
--
-- and `can_view_story_object()` resolves an object path through `story_media`.
-- At step 2 there is no row yet, so the predicate is false for everyone —
-- including the author — and every single publish failed with a denied
-- download, surfaced to the member as "we couldn't read that file".
--
-- The fix widens the policy by exactly one clause: the folder's owner can
-- always read their own objects. That is the pre-publish window (the bytes
-- they just uploaded, before we have recorded them), it leaks nothing (the
-- insert policy guarantees `folder[0] = auth.uid()`, so nobody else gains
-- anything), and it matches `can_view_story`, which has always let an author
-- see their own story.
--
-- The audience rule for everyone else is unchanged: connections still go
-- through `can_view_story_object()`, so visibility and expiry keep working
-- exactly as before.
-- ============================================================================

drop policy if exists story_media_select on storage.objects;

create policy story_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'story-media'
    and (
      -- The audience: resolved through the story row (visibility + expiry).
      public.can_view_story_object(name)
      -- The author: their own folder, before and after publishing.
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

comment on policy story_media_select on storage.objects is
  'Reads story media if the member is in the story audience OR owns the object (the publish action sniffs its own upload before the row exists).';
