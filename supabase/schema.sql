-- Run this once in Supabase Dashboard > SQL Editor.

create table if not exists profiles (
                                        user_id uuid primary key references auth.users(id) on delete cascade,
    birth_date date,
    birth_time time,
    birth_place text,
    birth_lat float8,
    birth_lng float8,
    birth_tz_offset float8,
    natal_chart jsonb,
    created_at timestamptz default now()
    );

create table if not exists entries (
                                       id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    entry_date date not null,
    moods text[] default '{}',
    energy int,
    period boolean default false,
    cried boolean default false,
    bloated boolean default false,
    acne boolean default false,
    cold_sore boolean default false,
    notes text,
    created_at timestamptz default now(),
    unique (user_id, entry_date)
    );

alter table profiles enable row level security;
alter table entries enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own entries" on entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);