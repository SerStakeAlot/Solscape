-- Solscape prototype schema (Phase 1: client-authoritative, RLS-guarded).
-- Tables match what net.js expects: characters, world, players.

-- Per-user cloud save
create table if not exists public.characters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Shared world state (single row id='pool')
create table if not exists public.world (
  id text primary key,
  pool numeric not null default 0,
  treasury numeric not null default 0,
  price numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- Leaderboard
create table if not exists public.players (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Player',
  combat int not null default 3,
  kills int not null default 0,
  raids_w int not null default 0,
  duels_w int not null default 0,
  earned numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.characters enable row level security;
alter table public.world enable row level security;
alter table public.players enable row level security;

-- characters: owner-only access
drop policy if exists "characters select own" on public.characters;
create policy "characters select own" on public.characters
  for select using (auth.uid() = user_id);
drop policy if exists "characters insert own" on public.characters;
create policy "characters insert own" on public.characters
  for insert with check (auth.uid() = user_id);
drop policy if exists "characters update own" on public.characters;
create policy "characters update own" on public.characters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- world: readable and writable by any signed-in player (prototype only;
-- Phase 2 moves pool updates server-side)
drop policy if exists "world select" on public.world;
create policy "world select" on public.world
  for select using (auth.role() = 'authenticated');
drop policy if exists "world insert" on public.world;
create policy "world insert" on public.world
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "world update" on public.world;
create policy "world update" on public.world
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- players: leaderboard readable by all signed-in users, writable by owner
drop policy if exists "players select" on public.players;
create policy "players select" on public.players
  for select using (auth.role() = 'authenticated');
drop policy if exists "players insert own" on public.players;
create policy "players insert own" on public.players
  for insert with check (auth.uid() = user_id);
drop policy if exists "players update own" on public.players;
create policy "players update own" on public.players
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime: net.js listens for postgres_changes on world
do $$
begin
  alter publication supabase_realtime add table public.world;
exception when duplicate_object then null;
end $$;
