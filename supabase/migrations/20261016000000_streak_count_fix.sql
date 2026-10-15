-- Chat streak correctness: first active day counts as 1, consecutive days
-- increment by exactly 1, and a broken streak restarts at 1 (a new day-1),
-- not 0. Previously the first day inserted 0 and consecutive days added 2
-- (v_cur := v_cur + 1 then stored v_cur + 1), so streaks read 0, 2, 3...
create or replace function public.record_conversation_day() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_day date := (new.created_at at time zone 'utc')::date;
  v_prev date;
  v_cur int := 0;
  v_long int := 0;
begin
  insert into public.conversation_streak_days (conversation_id, active_date)
  values (new.conversation_id, v_day) on conflict do nothing;
  select last_active_date, current_streak, longest_streak
    into v_prev, v_cur, v_long
    from public.conversation_streaks where conversation_id = new.conversation_id;
  if v_prev is null then
    insert into public.conversation_streaks (conversation_id, current_streak, last_active_date, longest_streak)
    values (new.conversation_id, 1, v_day, 1) on conflict (conversation_id) do nothing;
  elsif v_day = v_prev then
    return new;
  elsif v_day = v_prev + 1 then
    v_cur := coalesce(v_cur, 0) + 1;
    v_long := greatest(coalesce(v_long, 0), v_cur);
    update public.conversation_streaks
      set current_streak = v_cur, last_active_date = v_day, longest_streak = v_long, updated_at = now()
      where conversation_id = new.conversation_id;
  elsif v_day > v_prev + 1 then
    update public.conversation_streaks
      set current_streak = 1, last_active_date = v_day,
          longest_streak = greatest(coalesce(longest_streak, 0), 1), updated_at = now()
      where conversation_id = new.conversation_id;
  end if;
  return new;
end;
$$;

create or replace function public.record_app_visit() returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_prev date;
  v_cur int := 0;
  v_long int := 0;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  insert into public.app_visits (user_id, visit_date) values (v_me, v_day) on conflict do nothing;
  if not found then return; end if;
  select last_visit_date, current_streak, longest_streak
    into v_prev, v_cur, v_long from public.app_streaks where user_id = v_me;
  if v_prev is null then
    insert into public.app_streaks (user_id, current_streak, last_visit_date, longest_streak)
    values (v_me, 1, v_day, 1) on conflict (user_id) do nothing;
  elsif v_day = v_prev + 1 then
    v_cur := coalesce(v_cur, 0) + 1;
    v_long := greatest(coalesce(v_long, 0), v_cur);
    update public.app_streaks
      set current_streak = v_cur, last_visit_date = v_day, longest_streak = v_long, updated_at = now()
      where user_id = v_me;
  elsif v_day > v_prev + 1 then
    update public.app_streaks
      set current_streak = 1, last_visit_date = v_day,
          longest_streak = greatest(coalesce(longest_streak, 0), 1), updated_at = now()
      where user_id = v_me;
  end if;
end;
$$;
