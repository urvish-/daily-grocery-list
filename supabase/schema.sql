-- Run this in Supabase Dashboard → SQL Editor → Run
-- Free tier: https://supabase.com (no credit card)

create table if not exists households (
  id text primary key,
  meta jsonb not null default '{}',
  members jsonb not null default '{}',
  items jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table households enable row level security;

-- MVP: household id in URL acts as secret key
drop policy if exists "household_public" on households;
create policy "household_public" on households
  for all using (true) with check (true);

-- Enable realtime
alter publication supabase_realtime add table households;
