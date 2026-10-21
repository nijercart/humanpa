create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  name text not null,
  invite_code text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) unique,
  created_at timestamptz not null default now()
);
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create table public.team_credits (
  team_id uuid primary key references public.teams(id) on delete cascade,
  balance integer not null default 0,
  period_start timestamptz not null default date_trunc('month', now()),
  updated_at timestamptz not null default now()
);
alter table public.needs add column team_id uuid references public.teams(id) on delete set null;
create index needs_team_id_idx on public.needs (team_id);
create index team_members_user_idx on public.team_members (user_id);

grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select on public.team_credits to authenticated;
grant all on public.teams to service_role;
grant all on public.team_members to service_role;
grant all on public.team_credits to service_role;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_credits enable row level security;

create policy "Team owners and members can read teams"
  on public.teams for select to authenticated
  using (auth.uid() = owner_user_id or exists (select 1 from public.team_members m where m.team_id = id and m.user_id = auth.uid()));
create policy "Users can create their own team"
  on public.teams for insert to authenticated with check (auth.uid() = owner_user_id);
create policy "Team owners can update their team"
  on public.teams for update to authenticated using (auth.uid() = owner_user_id);
create policy "Team owners can delete their team"
  on public.teams for delete to authenticated using (auth.uid() = owner_user_id);

create policy "Team members can read the roster"
  on public.team_members for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and (t.owner_user_id = auth.uid() or exists (select 1 from public.team_members m2 where m2.team_id = t.id and m2.user_id = auth.uid()))));
create policy "Users can join a team as members"
  on public.team_members for insert to authenticated
  with check (auth.uid() = user_id and role = 'member' and exists (select 1 from public.teams t where t.id = team_id));
create policy "Users can leave a team"
  on public.team_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.teams t where t.id = team_id and t.owner_user_id = auth.uid()));

create policy "Team members can read the shared pool"
  on public.team_credits for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and (t.owner_user_id = auth.uid() or exists (select 1 from public.team_members m where m.team_id = t.id and m.user_id = auth.uid()))));

create policy "Team members can read team cases"
  on public.needs for select to authenticated
  using (team_id is not null and exists (select 1 from public.team_members m where m.team_id = team_id and m.user_id = auth.uid()));

create policy "Team members can read evidence of team cases"
  on public.need_sources for select to authenticated
  using (exists (select 1 from public.needs n join public.team_members m on m.team_id = n.team_id where n.id = need_id and m.user_id = auth.uid()));
create policy "Team members can read options of team cases"
  on public.need_options for select to authenticated
  using (exists (select 1 from public.needs n join public.team_members m on m.team_id = n.team_id where n.id = need_id and m.user_id = auth.uid()));
create policy "Team members can read steps of team cases"
  on public.need_steps for select to authenticated
  using (exists (select 1 from public.needs n join public.team_members m on m.team_id = n.team_id where n.id = need_id and m.user_id = auth.uid()));

create or replace function public.create_team_with_pool(p_user uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
  v_credits integer;
  v_features boolean;
begin
  select e.team_features, e.monthly_credits into v_features, v_credits from public.current_entitlements(p_user) e;
  if not v_features then
    raise exception 'TEAM_NOT_ALLOWED';
  end if;
  if exists (select 1 from public.team_members where user_id = p_user) then
    raise exception 'ALREADY_IN_TEAM';
  end if;
  insert into public.teams (owner_user_id, name) values (p_user, p_name) returning id into v_team;
  insert into public.team_members (team_id, user_id, role) values (v_team, p_user, 'owner');
  insert into public.team_credits (team_id, balance) values (v_team, v_credits);
  return v_team;
end;
$$;
grant execute on function public.create_team_with_pool(uuid, text) to authenticated;

create or replace function public.spend_credit_any(p_user uuid, p_need uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
  v_spent boolean;
begin
  select tm.team_id into v_team
    from public.team_members tm
    where tm.user_id = p_user
    limit 1;
  if v_team is not null then
    update public.team_credits
      set balance = balance - 1, updated_at = now()
      where team_id = v_team and balance > 0
      returning true into v_spent;
    if v_spent then
      insert into public.credit_transactions (user_id, delta, reason, need_id)
      values (p_user, -1, 'research_team', p_need);
      return true;
    end if;
    return false;
  end if;
  return public.spend_credit(p_user, p_need);
end;
$$;
revoke execute on function public.spend_credit_any(uuid, uuid) from public;
grant execute on function public.spend_credit_any(uuid, uuid) to service_role;

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
    values (p_user, v_credits, 'team_grant', p_event_id);
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