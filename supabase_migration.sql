-- MoMo Sentry — fraud_checks table
-- Run this in your Supabase SQL editor

create table fraud_checks (
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

-- Index for the map query (recent flags by location)
create index on fraud_checks (verdict, checked_at desc);

-- RLS: readable by authenticated users, writable by service role only
alter table fraud_checks enable row level security;

create policy "Authenticated users can read checks"
  on fraud_checks for select
  using (auth.role() = 'authenticated');
