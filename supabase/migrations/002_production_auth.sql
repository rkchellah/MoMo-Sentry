-- MoMo Sentry — production auth, roles, sessions, CHECK_FAILED
-- Run in the Supabase SQL editor after 001_fraud_checks.sql

alter table fraud_checks add column if not exists agent_id text;
alter table fraud_checks add column if not exists agent_name text;

alter table fraud_checks drop constraint if exists fraud_checks_verdict_check;
alter table fraud_checks add constraint fraud_checks_verdict_check
  check (verdict in ('SAFE', 'CAUTION', 'STOP', 'CHECK_FAILED'));

create table if not exists momo_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('agent', 'owner')),
  created_at timestamptz default now()
);

create table if not exists agent_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists booth_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  primary_location text,
  latitude double precision,
  longitude double precision
);

alter table momo_profiles enable row level security;
alter table agent_sessions enable row level security;
alter table fraud_checks enable row level security;
-- Do not enable new RLS on booth_agents / booth_locations here.
-- PAR-Map leftover /sentry still lists those tables as any authenticated user.

-- Keep "Authenticated users can read checks" until PAR-Map leftover /sentry
-- is retired. Postgres ORs SELECT policies — adding owner/agent rules does
-- not hide rows from existing PAR-Map sessions.

drop policy if exists "Owners read all checks" on fraud_checks;
drop policy if exists "Agents read own checks" on fraud_checks;
drop policy if exists "Users read own profile" on momo_profiles;
drop policy if exists "Users insert own agent profile" on momo_profiles;

create policy "Owners read all checks"
  on fraud_checks for select
  using (
    exists (
      select 1 from momo_profiles p
      where p.user_id = auth.uid() and p.role = 'owner'
    )
  );

create policy "Agents read own checks"
  on fraud_checks for select
  using (
    exists (
      select 1 from booth_agents a
      where a.user_id = auth.uid()
        and a.id::text = fraud_checks.agent_id::text
    )
  );

create policy "Users read own profile"
  on momo_profiles for select
  using (auth.uid() = user_id);

create policy "Users insert own agent profile"
  on momo_profiles for insert
  with check (auth.uid() = user_id and role = 'agent');

-- No client policies on agent_sessions: service role only.

-- Seed the first owner after you create the Auth user:
-- insert into momo_profiles (user_id, role)
-- values ('00000000-0000-0000-0000-000000000000', 'owner');

-- booth_locations RLS is left as PAR-Map already configured it.
