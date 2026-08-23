-- MoMo Sentry — preflight for 003_rls_lockdown.sql
--
-- READ ONLY. Nothing here writes, drops or alters anything. Run it in the
-- Supabase SQL editor with 001 + 002 already applied, and read every row
-- before pasting 003.
--
-- One statement on purpose: the Supabase editor only shows the result of the
-- last statement, so all checks are UNION ALL'd into a single table.

select * from (

  -- 1. Is an owner seeded?
  -- 003 restricts fraud_checks to owners and own-agents. 002 left the owner
  -- INSERT as a commented-out line. If this returns 0, the owner queue goes
  -- blank the moment 003 runs and it will look like a regression.
  -- Expect: >= 1. If 0, seed the owner FIRST.
  select 1 as ord, 'owners seeded' as check_name, count(*)::text as value
  from momo_profiles where role = 'owner'

  union all

  -- 2. booth_agents shape.
  -- 002 used CREATE TABLE IF NOT EXISTS. If this table predates 002 (hackathon
  -- era), 002's definition was silently skipped and the live table may lack
  -- user_id, latitude or longitude.
  -- Expect: id, user_id, name, phone, primary_location, latitude, longitude.
  -- No user_id means 003's own-row policies cannot work as written.
  select 2, 'booth_agents columns',
         coalesce(string_agg(column_name, ', ' order by ordinal_position), 'TABLE MISSING')
  from information_schema.columns
  where table_schema = 'public' and table_name = 'booth_agents'

  union all

  -- 3. How many agents 003 will backfill into momo_profiles.
  -- These are the accounts that would 403 once authz.py stops falling back to
  -- "a booth_agents row exists". Informational; 003 handles them.
  select 3, 'agents to backfill', count(*)::text
  from booth_agents ba
  where ba.user_id is not null
    and not exists (select 1 from momo_profiles p where p.user_id = ba.user_id)

  union all

  -- 4. Agent rows with no user_id.
  -- 003 cannot backfill these and they can never satisfy an own-row policy.
  -- Expect 0. Anything else is an orphan record: link it to an auth user or
  -- accept that it becomes owner-visible only.
  select 4, 'agents with NULL user_id', count(*)::text
  from booth_agents where user_id is null

  union all

  -- 5. Does booth_locations exist? Section 4 of 003 guards on this and skips
  -- silently if absent. MISSING here means the owner map has no site list.
  select 5, 'booth_locations',
         coalesce(to_regclass('public.booth_locations')::text, 'MISSING')

  union all

  -- 6. Historical checks with no agent_id (everything logged before 002 added
  -- the column). After 003 an agent cannot read these. The owner still sees
  -- all of them, so this is expected, not a fault.
  select 6, 'checks with NULL agent_id', count(*)::text
  from fraud_checks where agent_id is null

  union all

  -- 7. Tables with RLS still OFF. With Supabase's default grants, RLS off
  -- means the public anon key has full read AND write.
  -- Expect now: booth_agents, and booth_locations if it exists.
  -- Expect after 003: no rows.
  select 7, 'RLS IS OFF', c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    and c.relname in ('fraud_checks', 'momo_profiles', 'agent_sessions',
                      'booth_agents', 'booth_locations')

  union all

  -- 8. Every policy currently on the MoMo tables.
  -- Expect to see "Authenticated users can read checks" on fraud_checks —
  -- that is the leak 003 drops. If it is already gone, 003's drop is a no-op
  -- and someone has been here before you.
  select 8, 'policy on ' || tablename, policyname || '  [' || cmd || ']'
  from pg_policies
  where schemaname = 'public'
    and tablename in ('fraud_checks', 'momo_profiles', 'agent_sessions',
                      'booth_agents', 'booth_locations')

) preflight
order by ord, check_name, value;
