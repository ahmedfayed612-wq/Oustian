-- ============================================================================
-- Fix: aggregated reaction notifications (v2 of the maintenance function)
--
-- Two corrections over the first version, both proven by tests/reactions.e2e.mjs:
--
--  1. `ON CONFLICT (cols)` cannot infer a PARTIAL unique index from the
--     column list alone, so the upsert raised on every reaction whose
--     recipient differed from the actor and rolled the reaction back.
--     Delete-then-insert reaches the same state with no conflict inference;
--     the partial index remains as the hard no-duplicates guarantee.
--
--  2. The count now answers "how many of THIS member's posts/comments did the
--     actor react to" — computed across all of the recipient's content, not
--     just the row that triggered the write — and both kinds of a family
--     (plain vs talk) are recomputed together, so changing same→talk moves the
--     row between types instead of leaving a stale one behind.
--
-- Trigger signature is unchanged: no trigger needs rebuilding.
-- ============================================================================

create or replace function public.maintain_reaction_notification(
  p_recipient uuid,
  p_actor uuid,
  p_type text,
  p_post uuid,
  p_table text,
  p_target uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plain_type text;
  v_talk_type text;
  v_plain_count integer;
  v_talk_count integer;
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;

  if p_table = 'post_reactions' then
    v_plain_type := 'post_reaction';
    v_talk_type := 'post_talk';

    select
      count(*) filter (where pr.reaction <> 'talk'),
      count(*) filter (where pr.reaction = 'talk')
    into v_plain_count, v_talk_count
    from public.post_reactions pr
    where pr.user_id = p_actor
      and exists (
        select 1 from public.posts p
        where p.id = pr.post_id and p.author_id = p_recipient
      );
  else
    v_plain_type := 'comment_reaction';
    v_talk_type := 'comment_talk';

    select
      count(*) filter (where cr.reaction <> 'talk'),
      count(*) filter (where cr.reaction = 'talk')
    into v_plain_count, v_talk_count
    from public.comment_reactions cr
    where cr.user_id = p_actor
      and exists (
        select 1 from public.post_comments c
        where c.id = cr.comment_id and c.author_id = p_recipient
      );
  end if;

  -- Recompute both kinds of this family from scratch: one aggregated row per
  -- (recipient, actor, type) — reacting fifty times never fans out into
  -- fifty notifications, and removing the last reaction removes the row.
  delete from public.notifications
  where recipient_id = p_recipient
    and actor_id = p_actor
    and type in (v_plain_type, v_talk_type);

  if v_plain_count > 0 then
    insert into public.notifications
      (recipient_id, actor_id, type, post_id, reaction_count)
    values (p_recipient, p_actor, v_plain_type, p_post, v_plain_count);
  end if;

  -- Talk keeps its own, slightly more prominent row — still exactly one.
  if v_talk_count > 0 then
    insert into public.notifications
      (recipient_id, actor_id, type, post_id, reaction_count)
    values (p_recipient, p_actor, v_talk_type, p_post, v_talk_count);
  end if;
end;
$$;

comment on function public.maintain_reaction_notification(uuid, uuid, text, uuid, text, uuid) is
  'Recomputes the aggregated plain/talk reaction notifications one actor owes one recipient.';
