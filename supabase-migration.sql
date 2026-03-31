-- YugiVault Database Schema
-- Run this in your Supabase SQL Editor

-- Migration: Add card_type column (run this if upgrading an existing database)
-- ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_type text;

-- Migration: Add subscriptions table (run this if upgrading an existing database)
-- CREATE TABLE subscriptions (
--   id uuid default gen_random_uuid() primary key,
--   user_id uuid references auth.users(id) on delete cascade not null,
--   plan text not null,
--   status text not null default 'active',
--   paymongo_payment_id text,
--   current_period_start timestamptz not null,
--   current_period_end timestamptz not null,
--   created_at timestamptz default now() not null,
--   updated_at timestamptz default now() not null
-- );
-- ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
-- CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
-- CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Migration: Add profiles table and public read policies
-- Run these if upgrading an existing database:
-- CREATE TABLE profiles (
--   id uuid references auth.users(id) on delete cascade primary key,
--   username text unique not null,
--   display_name text not null,
--   facebook_url text,
--   created_at timestamptz default now() not null,
--   updated_at timestamptz default now() not null
-- );
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
-- CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
-- CREATE UNIQUE INDEX idx_profiles_username ON profiles(username);
--
-- -- Make cards and folders readable by everyone (including unauthenticated for browse):
-- CREATE POLICY "Anyone can view all cards" ON cards FOR SELECT USING (true);
-- CREATE POLICY "Anyone can view all folders" ON folders FOR SELECT USING (true);
-- CREATE POLICY "Anyone can view all card_folders" ON card_folders FOR SELECT USING (true);
-- DROP POLICY IF EXISTS "Users can view own cards" ON cards;
-- DROP POLICY IF EXISTS "Users can view own folders" ON folders;
-- DROP POLICY IF EXISTS "Users can view own card_folders" ON card_folders;

-- Folders/Collections for organizing cards
create table folders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Cards in a user's collection
create table cards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  set_number text not null,        -- e.g. "ROTD-JP001"
  card_name text not null,         -- Japanese name from Yuyutei
  rarity text,                     -- e.g. "UR", "SR", "PSE"
  price integer,                   -- price in yen
  image_url text,                  -- card image URL
  card_type text,                  -- e.g. "Effect Monster", "Spell Card", "Trap Card"
  quantity integer default 1 not null,
  last_price_update timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- User profiles for public collection pages
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text not null,
  facebook_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Junction table: cards can belong to multiple folders
create table card_folders (
  card_id uuid references cards(id) on delete cascade not null,
  folder_id uuid references folders(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (card_id, folder_id)
);

-- Subscriptions for premium access
create table subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  plan text not null,                    -- 'monthly' or 'yearly'
  status text not null default 'active', -- 'active', 'expired', 'cancelled'
  paymongo_payment_id text,             -- PayMongo payment reference
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table subscriptions enable row level security;
create policy "Users can view own subscriptions" on subscriptions
  for select using (auth.uid() = user_id);
create index idx_subscriptions_user_id on subscriptions(user_id);
create index idx_subscriptions_status on subscriptions(status);

-- Price cache to avoid excessive scraping
create table price_cache (
  set_number text not null,
  rarity text not null,
  price integer not null,
  card_name text not null,
  image_url text,
  in_stock boolean default true,
  fetched_at timestamptz default now() not null,
  primary key (set_number, rarity)
);

-- Row Level Security
alter table profiles enable row level security;
alter table folders enable row level security;
alter table cards enable row level security;
alter table card_folders enable row level security;

-- Profiles: public read (including unauthenticated), own write
create policy "Anyone can view profiles" on profiles
  for select using (true);
create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Folders: public read, own write
create policy "Authenticated users can view all folders" on folders
  for select using (true);
create policy "Users can insert own folders" on folders
  for insert with check (auth.uid() = user_id);
create policy "Users can update own folders" on folders
  for update using (auth.uid() = user_id);
create policy "Users can delete own folders" on folders
  for delete using (auth.uid() = user_id);

-- Cards: public read, own write
create policy "Authenticated users can view all cards" on cards
  for select using (true);
create policy "Users can insert own cards" on cards
  for insert with check (auth.uid() = user_id);
create policy "Users can update own cards" on cards
  for update using (auth.uid() = user_id);
create policy "Users can delete own cards" on cards
  for delete using (auth.uid() = user_id);

-- Card folders: public read, own write
create policy "Authenticated users can view all card_folders" on card_folders
  for select using (true);
create policy "Users can insert own card_folders" on card_folders
  for insert with check (
    exists (select 1 from cards where cards.id = card_id and cards.user_id = auth.uid())
  );
create policy "Users can delete own card_folders" on card_folders
  for delete using (
    exists (select 1 from cards where cards.id = card_id and cards.user_id = auth.uid())
  );

-- Price cache: readable by all authenticated users, writable by service role only
alter table price_cache enable row level security;
create policy "Authenticated users can read price cache" on price_cache
  for select using (true);

-- Indexes
create unique index idx_profiles_username on profiles(username);
create index idx_cards_user_id on cards(user_id);
create index idx_cards_set_number on cards(set_number);
create index idx_folders_user_id on folders(user_id);
create index idx_price_cache_fetched on price_cache(fetched_at);
