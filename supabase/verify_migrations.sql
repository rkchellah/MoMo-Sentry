-- MoMo Sentry — confirm 001 + 002 + 003 are live
-- READ ONLY. Paste in the Supabase SQL editor. One result table.

select * from (

  -- 001: table
  select 1 as ord, '001 fraud_checks' as check_name,
         case when to_regclass('public.fraud_checks') is null then 'MISSING' else 'ok' end as value,
         'ok' as expect

  union all

  -- 002: tables
  select 2, '002 momo_profiles',
         case when to_regclass('public.momo_profiles') is null then 'MISSING' else 'ok' end,
         'ok'

  union all

  select 3, '002 agent_sessions',
         case when to_regclass('public.agent_sessions') is null then 'MISSING' else 'ok' end,
         'ok'

  union all

  select 4, '002 booth_agents',
         case when to_regclass('public.booth_agents') is null then 'MISSING' else 'ok' end,
         'ok'

  union all

  -- 002: columns on fraud_checks
  select 5, '002 fraud_checks.agent_id',
         case when exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'fraud_checks' and column_name = 'agent_id'
         ) then 'ok' else 'MISSING' end,
         'ok'

  union all

  select 6, '002 fraud_checks.agent_name',
         case when exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'fraud_checks' and column_name = 'agent_name'
         ) then 'ok' else 'MISSING' end,
         'ok'

  union all

  -- 002: CHECK_FAILED allowed
  select 7, '002 verdict allows CHECK_FAILED',
         case when exists (
           select 1 from pg_constraint
           where conrelid = 'public.fraud_checks'::regclass
             and conname = 'fraud_checks_verdict_check'
             and pg_get_constraintdef(oid) like '%CHECK_FAILED%'
         ) then 'ok' else 'MISSING' end,
         'ok'

  union all

  -- 003: owner seed
  select 8, '003 owners seeded',
         (select count(*)::text from momo_profiles where role = 'owner'),
         '>= 1'

  union all

  -- 003: RLS on for every MoMo table that exists
  select 9, '003 RLS ' || c.relname,
         case when c.relrowsecurity then 'on' else 'OFF' end,
         'on'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname in ('fraud_checks', 'momo_profiles', 'agent_sessions',
                      'booth_agents', 'booth_locations')

  union all

  -- 003: the 001 leak must be gone
  select 10, '003 dropped broad read policy',
         case when exists (
           select 1 from pg_policies
           where schemaname = 'public' and tablename = 'fraud_checks'
             and policyname = 'Authenticated users can read checks'
         ) then 'STILL PRESENT' else 'gone' end,
         'gone'

  union all

  -- Required policies
  select 11, 'policy ' || expected.tablename || ' / ' || expected.policyname,
         case when exists (
           select 1 from pg_policies p
           where p.schemaname = 'public'
             and p.tablename = expected.tablename
             and p.policyname = expected.policyname
         ) then 'ok' else 'MISSING' end,
         'ok'
  from (
    values
      ('fraud_checks', 'Owners read all checks'),
      ('fraud_checks', 'Agents read own checks'),
      ('momo_profiles', 'Users read own profile'),
      ('momo_profiles', 'Users insert own agent profile'),
      ('booth_agents', 'Agents read own booth row'),
      ('booth_agents', 'Owners read all booth rows'),
      ('booth_agents', 'New agent creates own booth row')
  ) as expected(tablename, policyname)

  union all

  -- booth_locations policy only if the table exists
  select 12, 'policy booth_locations / Owners read booth locations',
         case
           when to_regclass('public.booth_locations') is null then 'table missing'
           when exists (
             select 1 from pg_policies
             where schemaname = 'public' and tablename = 'booth_locations'
               and policyname = 'Owners read booth locations'
           ) then 'ok'
           else 'MISSING'
         end,
         'ok (or table missing)'

  union all

  -- Every live policy, so you can see extras
  select 13, 'live policy on ' || tablename, policyname || ' [' || cmd || ']', 'informational'
  from pg_policies
  where schemaname = 'public'
    and tablename in ('fraud_checks', 'momo_profiles', 'agent_sessions',
                      'booth_agents', 'booth_locations')

) verify
order by ord, check_name, value;
