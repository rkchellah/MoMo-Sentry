-- MoMo Sentry — 001: fraud_checks table
-- Run first in the Supabase SQL editor, then 002, then 003.
-- If this table already exists, skip this file.

create table if not exists fraud_checks (
  id                  uuid primary key default gen_random_uuid(),
  phone_number        text not null,
  verdict             text not null check (verdict in ('SAFE', 'CAUTION', 'STOP')),
  score               float not null,
  signals             text[] default '{}',
  narration           text,
  sim_swapped         boolean default false,
  last_sim_change     timestamptz,
  device_connectivity text,
  device_roaming      boolean default false,
  agent_location      text default 'Unknown',
  checked_at          timestamptz default now()
);

create index if not exists fraud_checks_verdict_checked_at_idx
  on fraud_checks (verdict, checked_at desc);

alter table fraud_checks enable row level security;

drop policy if exists "Authenticated users can read checks" on fraud_checks;
create policy "Authenticated users can read checks"
  on fraud_checks for select
  using (auth.role() = 'authenticated');
