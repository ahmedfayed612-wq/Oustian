-- ============================================================================
-- M7 — notifications
--
-- A row appears when someone likes or comments on YOUR post. Only triggers
-- insert (clients hold no insert grant): members read, mark read and dismiss
-- their own rows. `type` is a CHECK list so new kinds ship as a trivial ALTER.
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type text not null check (type in ('post_like', 'post_comment')),
  post_id uuid references public.posts (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Generated only by triggers: likes and comments on your posts.';

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

-- One notification per like/comment for the post's author, never for
-- yourself. SECURITY DEFINER because clients cannot insert into this table.
create or replace function public.handle_feed_interaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post_author uuid;
  v_actor uuid;
  v_type text;
begin
  if tg_table_name = 'post_likes' then
    v_actor := new.user_id;
    v_type := 'post_like';
  else
    v_actor := new.author_id;
    v_type := 'post_comment';
  end if;

  select author_id into v_post_author
  from public.posts
  where id = new.post_id;

  if v_post_author is null or v_post_author = v_actor then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, post_id)
  values (v_post_author, v_actor, v_type, new.post_id);

  return new;
end;
$$;

drop trigger if exists post_likes_after_insert on public.post_likes;
create trigger post_likes_after_insert
  after insert on public.post_likes
  for each row execute function public.handle_feed_interaction();

drop trigger if exists post_comments_after_insert on public.post_comments;
create trigger post_comments_after_insert
  after insert on public.post_comments
  for each row execute function public.handle_feed_interaction();

-- ---------------------------------------------------------------------------
-- Row Level Security: your notifications, nobody else's.
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (recipient_id = auth.uid());

-- No insert grant on purpose: rows come from triggers only.

revoke all on public.notifications from anon, authenticated;
grant select, update, delete on public.notifications to authenticated;