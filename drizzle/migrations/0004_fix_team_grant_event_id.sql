create or replace function public.grant_team_credits(p_user uuid, p_plan text, p_period_start timestamptz, p_event_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_features boolean;
  v_team uuid;
begin
  select monthly_credits, team_features into v_credits, v_features from public.plans where code = p_plan;
  if v_credits is null or not v_features or v_credits <= 0 then
    return false;
  end if;
  select tm.team_id into v_team from public.team_members tm where tm.user_id = p_user limit 1;
  if v_team is null then
    return false;
  end if;
  begin
    insert into public.credit_transactions (user_id, delta, reason, stripe_event_id)
    values (p_user, v_credits, 'team_grant', p_event_id || '::team');
  exception when unique_violation then
    return false;
  end;
  insert into public.team_credits (team_id, balance, period_start)
  values (v_team, v_credits, p_period_start)
  on conflict (team_id) do update
    set balance = excluded.balance, period_start = excluded.period_start, updated_at = now();
  return true;
end;
$$;
revoke execute on function public.grant_team_credits(uuid, text, timestamptz, text) from public;
grant execute on function public.grant_team_credits(uuid, text, timestamptz, text) to service_role;