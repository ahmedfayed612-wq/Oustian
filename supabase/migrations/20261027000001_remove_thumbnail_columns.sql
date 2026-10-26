-- ============================================================================
-- Remove thumbnail columns from post_media (photo processing v2: full-resolution only)
-- ============================================================================
-- This migration removes the thumbnail_key, thumb_width, thumb_height columns
-- that were added in 20261020000001_photo_thumbnails.sql, since the feed now
-- renders full-resolution images only on demand.
--
-- Reversible: columns can be recreated if needed, but all code has been refactored
-- to use full-resolution URLs directly.
-- ============================================================================

-- 1. Remove thumbnail columns from post_media table
alter table public.post_media
  drop column if exists thumbnail_key;

alter table public.post_media
  drop column if exists thumb_width;

alter table public.post_media
  drop column if exists thumb_height;

-- 2. Remove the thumbnail index
drop index if exists post_media_thumbnail_key_idx;

-- 3. Reset the bucket file size limit back to 10 MB (was raised to 12 MB for thumbnails)
do $$
begin
  update storage.buckets
     set file_size_limit = 10485760 -- 10 MB
   where id = 'post-media';
end $$;

-- ---------------------------------------------------------------------------
-- Rollback (manual):
--   alter table public.post_media add column if not exists thumbnail_key text unique
--     check (thumbnail_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
--   alter table public.post_media add column if not exists thumb_width int check (thumb_width >= 1);
--   alter table public.post_media add column if not exists thumb_height int check (thumb_height >= 1);
--   create index if not exists post_media_thumbnail_key_idx
--     on public.post_media (thumbnail_key) where thumbnail_key is not null;
--   do $$ begin update storage.buckets set file_size_limit = 12582912 where id = 'post-media'; end $$;
-- ---------------------------------------------------------------------------