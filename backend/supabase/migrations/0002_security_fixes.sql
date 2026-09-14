-- LinguaMaestro — security patch
-- Run this in the Supabase SQL Editor on top of 0001_init.sql.
-- Idempotent: safe to re-run.
--
-- Fixes a critical ownership gap: increment_xp / update_streak are
-- `security definer` RPCs callable directly from the browser with the
-- anon key (supabase.rpc(...)), and previously took a raw target id with
-- no check that it belonged to the calling user — any authenticated user
-- could inflate or deflate any other user's XP, study hours, or streak.

create or replace function public.increment_xp(p_enrollment_id uuid, p_xp integer) returns void
language sql security definer set search_path = public as $$
  update public.enrollments
  set xp_total = xp_total + p_xp,
      total_study_hours = total_study_hours + (p_xp::numeric / 100)
  where id = p_enrollment_id
    and user_id = auth.uid();
$$;

create or replace function public.update_streak(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_last date;
  v_current integer;
  v_longest integer;
  v_freezes integer;
  v_today date := current_date;
  v_gap integer;
begin
  if p_user_id != auth.uid() then
    return;
  end if;

  select last_activity_date, current_streak, longest_streak, streak_freezes
    into v_last, v_current, v_longest, v_freezes
    from public.users where id = p_user_id;

  if v_last = v_today then
    return; -- already logged today, streak unchanged
  end if;

  v_gap := case when v_last is null then null else v_today - v_last end;

  if v_gap is null or v_gap = 1 then
    v_current := v_current + 1;
  elsif v_gap = 2 and v_freezes > 0 then
    v_current := v_current + 1;
    v_freezes := v_freezes - 1;
  else
    v_current := 1;
  end if;

  v_longest := greatest(v_longest, v_current);

  update public.users
  set current_streak = v_current,
      longest_streak = v_longest,
      streak_freezes = v_freezes,
      last_activity_date = v_today
  where id = p_user_id;
end;
$$;
