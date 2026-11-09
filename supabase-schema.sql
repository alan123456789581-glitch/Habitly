create table if not exists public.habitly_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.habitly_profiles enable row level security;

create policy "Users can read their own Habitly profile"
  on public.habitly_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own Habitly profile"
  on public.habitly_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own Habitly profile"
  on public.habitly_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
