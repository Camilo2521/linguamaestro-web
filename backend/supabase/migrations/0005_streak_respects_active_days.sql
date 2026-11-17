-- LinguaMaestro — streak respects the user's chosen active days
-- Run this in the Supabase SQL Editor on top of 0001-0004.
-- Idempotent: safe to re-run.
--
-- users.active_days (set once during onboarding: which days of the week
-- the learner plans to study) was captured but never consulted by anything
-- — update_streak broke the streak over any calendar gap, including days
-- the user had explicitly marked as rest days. A user who picked "Mon-Fri"
-- would still lose their streak every single weekend. This makes gaps that
-- fall entirely on non-active days free, the same way a genuine day off
-- was always meant to work.
--
-- Also corrects the `active_days` default from '{1,2,3,4,5}' to
-- '{0,1,2,3,4}' — the frontend's day picker is 0=Mon..6=Sun, so the old
-- default actually meant Tue-Sat, not Mon-Fri. This only affects rows
-- created before onboarding runs (onboarding always overwrites the value),
-- so it's a low-impact but correct fix.

alter table public.users
  alter column active_days set default '{0,1,2,3,4}';

create or replace function public.update_streak(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_last date;
  v_current integer;
  v_longest integer;
  v_freezes integer;
  v_active_days integer[];
  v_today date := current_date;
  v_missed_active_days integer;
begin
  if p_user_id != auth.uid() then
    return;
  end if;

  select last_activity_date, current_streak, longest_streak, streak_freezes, active_days
    into v_last, v_current, v_longest, v_freezes, v_active_days
    from public.users where id = p_user_id;

  if v_last = v_today then
    return; -- already logged today, streak unchanged
  end if;

  if v_last is null then
    v_current := 1;
  else
    -- Only count, as a "missed" day, a day strictly between the last logged
    -- activity and today that was one of the user's own scheduled active_days
    -- (0=Mon..6=Sun). A gap that falls entirely on days the user configured
    -- as rest days doesn't touch the streak — that's the whole point of
    -- letting them pick a routine during onboarding. A null/empty active_days
    -- falls back to treating every day as active (old, pure-calendar behavior).
    select count(*) into v_missed_active_days
    from generate_series(v_last + 1, v_today - 1, interval '1 day') gs(day)
    where v_active_days is null
       or array_length(v_active_days, 1) is null
       or (extract(isodow from gs.day)::integer - 1) = any(v_active_days);

    if v_missed_active_days = 0 then
      v_current := v_current + 1;
    elsif v_missed_active_days = 1 and v_freezes > 0 then
      v_current := v_current + 1;
      v_freezes := v_freezes - 1;
    else
      v_current := 1;
    end if;
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
