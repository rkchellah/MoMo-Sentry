-- MoMo Sentry — 003: close the shared-database read/write leaks
-- Run in the Supabase SQL editor after 002_production_auth.sql.
--
-- WHY
--   MoMo Sentry and PAR-Map share one Supabase project, so they share one
--   auth.users pool. Until now that meant:
--
--     a) "Authenticated users can read checks" let any PAR-Map session read
--        every fraud_checks row - phone numbers, verdicts, booth locations.
--     b) booth_agents and booth_locations had RLS DISABLED. With Supabase's
--        default grants that is full read AND WRITE for anyone holding the
--        anon key, which ships in the frontend bundle. booth_agents stores
--        agent name, phone and coordinates.
--
--   (b) is the wider hole. Both close here.
--
-- WHAT BREAKS, ACCEPTED
--   PAR-Map's leftover /sentry and /agent pages read these tables with a
--   PAR-Map session. After this they return zero rows or an RLS error. That
--   is a dead hackathon demo, not the loan map.
--
--   NOT touched, and still working: customers, profiles, teams, kmz_layers,
--   buffer_layers, Storage. No ALTER, no DROP, no new policy on any of them.
--
-- ORDER
--   Run 002_production_auth.sql first. It creates momo_profiles.
--   Seed at least one owner in momo_profiles and confirm the owner queue
--   loads BEFORE running this. Dropping the broad policy first makes an
--   unseeded owner screen look like a regression. Rollback is at the bottom.

do $$
begin
  if to_regclass('public.momo_profiles') is null then
    raise exception 'momo_profiles does not exist. Run 002_production_auth.sql first, then this file.';
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- 1. Backfill momo_profiles
-- ---------------------------------------------------------------------------
-- authz.py is being changed so role comes only from momo_profiles, with no
-- fallback to "a booth_agents row exists". Any hackathon-era agent registered
-- before agent-register.tsx started writing momo_profiles would 403 silently.
-- Runs first: the policies below read this table.

insert into momo_profiles (user_id, role)
select ba.user_id, 'agent'
from booth_agents ba
where ba.user_id is not null
  and not exists (
    select 1 from momo_profiles p where p.user_id = ba.user_id
  )
on conflict (user_id) do nothing;


-- ---------------------------------------------------------------------------
-- 2. fraud_checks - one read path, owner or own-agent
-- ---------------------------------------------------------------------------
-- Postgres ORs SELECT policies together, so the broad policy has to go or the
-- owner/agent rules below are decorative.

alter table fraud_checks enable row level security;

drop policy if exists "Authenticated users can read checks" on fraud_checks;

drop policy if exists "Owners read all checks" on fraud_checks;
create policy "Owners read all checks"
  on fraud_checks for select
  using (
    exists (
      select 1 from momo_profiles p
      where p.user_id = auth.uid() and p.role = 'owner'
    )
  );

drop policy if exists "Agents read own checks" on fraud_checks;
create policy "Agents read own checks"
  on fraud_checks for select
  using (
    exists (
      select 1 from booth_agents a
      where a.user_id = auth.uid()
        and a.id::text = fraud_checks.agent_id::text
    )
  );

-- No client INSERT/UPDATE/DELETE policy. FastAPI writes with the service role,
-- which bypasses RLS.


-- ---------------------------------------------------------------------------
-- 3. booth_agents - was fully open to the anon key
-- ---------------------------------------------------------------------------

alter table booth_agents enable row level security;

drop policy if exists "Agents read own booth row" on booth_agents;
create policy "Agents read own booth row"
  on booth_agents for select
  using (auth.uid() = user_id);

drop policy if exists "Owners read all booth rows" on booth_agents;
create policy "Owners read all booth rows"
  on booth_agents for select
  using (
    exists (
      select 1 from momo_profiles p
      where p.user_id = auth.uid() and p.role = 'owner'
    )
  );

-- agent-register.tsx inserts this row from the browser straight after signUp.
-- It can only satisfy auth.uid() = user_id if signUp returns a session, i.e.
-- email confirmation is OFF for this project. If you turn confirmation on,
-- this insert must move behind FastAPI and the service role.
drop policy if exists "New agent creates own booth row" on booth_agents;
create policy "New agent creates own booth row"
  on booth_agents for insert
  with check (auth.uid() = user_id);

-- No UPDATE or DELETE policy: an agent cannot rename or relocate a booth, and
-- cannot delete anyone. Service role only.


-- ---------------------------------------------------------------------------
-- 4. booth_locations - same exposure, no owner column to key on
-- ---------------------------------------------------------------------------
-- Created outside this repo's migrations, so guard on existence. Only the
-- owner map (fraudService.getBoothLocations) reads it; the agent screen uses
-- booth_agents.primary_location instead. Add an agent policy here if that
-- changes.

do $$
begin
  if to_regclass('public.booth_locations') is not null then
    execute 'alter table booth_locations enable row level security';
    execute 'drop policy if exists "Owners read booth locations" on booth_locations';
    execute $p$
      create policy "Owners read booth locations"
        on booth_locations for select
        using (
          exists (
            select 1 from momo_profiles p
            where p.user_id = auth.uid() and p.role = 'owner'
          )
        )
    $p$;
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- 5. agent_sessions - already correct, asserted here
-- ---------------------------------------------------------------------------
-- RLS on, zero client policies, so DeepSeek session memory is service-role
-- only. 002 did this; re-asserted because it is easy to lose in a rebuild.

alter table agent_sessions enable row level security;


-- ---------------------------------------------------------------------------
-- Verify (run as an authenticated non-owner, non-agent session, NOT as
-- service_role - the service role bypasses RLS and every check will pass)
-- ---------------------------------------------------------------------------
--   select count(*) from fraud_checks;    -- expect 0
--   select count(*) from booth_agents;    -- expect 0
--   select count(*) from booth_locations; -- expect 0
--
-- As the seeded owner: all three return rows.
-- As an agent: own booth row, own checks, zero booth_locations.


-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
--   create policy "Authenticated users can read checks"
--     on fraud_checks for select using (auth.role() = 'authenticated');
--   alter table booth_agents disable row level security;
--   alter table booth_locations disable row level security;
