-- YugiVault Database Schema
-- Run this in your Supabase SQL Editor

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
  quantity integer default 1 not null,
  last_price_update timestamptz,
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
alter table folders enable row level security;
alter table cards enable row level security;
alter table card_folders enable row level security;

-- Folders: users can only access their own
create policy "Users can view own folders" on folders
  for select using (auth.uid() = user_id);
create policy "Users can insert own folders" on folders
  for insert with check (auth.uid() = user_id);
create policy "Users can update own folders" on folders
  for update using (auth.uid() = user_id);
create policy "Users can delete own folders" on folders
  for delete using (auth.uid() = user_id);

-- Cards: users can only access their own
create policy "Users can view own cards" on cards
  for select using (auth.uid() = user_id);
create policy "Users can insert own cards" on cards
  for insert with check (auth.uid() = user_id);
create policy "Users can update own cards" on cards
  for update using (auth.uid() = user_id);
create policy "Users can delete own cards" on cards
  for delete using (auth.uid() = user_id);

-- Card folders: users can manage through their own cards
create policy "Users can view own card_folders" on card_folders
  for select using (
    exists (select 1 from cards where cards.id = card_id and cards.user_id = auth.uid())
  );
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
  for select using (auth.role() = 'authenticated');

-- Indexes
create index idx_cards_user_id on cards(user_id);
create index idx_cards_set_number on cards(set_number);
create index idx_folders_user_id on folders(user_id);
create index idx_price_cache_fetched on price_cache(fetched_at);
