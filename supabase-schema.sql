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

create table if not exists public.habitly_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (sender_id, recipient_id)
);

alter table public.habitly_friend_requests enable row level security;

create policy "Users can view their friend requests"
  on public.habitly_friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can update received friend requests"
  on public.habitly_friend_requests for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create table if not exists public.habitly_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.habitly_posts enable row level security;

create policy "Authenticated users can view posts"
  on public.habitly_posts for select
  to authenticated
  using (true);

create policy "Users can create their own posts"
  on public.habitly_posts for insert
  with check (auth.uid() = user_id);

create table if not exists public.habitly_post_likes (
  post_id uuid not null references public.habitly_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.habitly_post_likes enable row level security;

create policy "Authenticated users can view post likes"
  on public.habitly_post_likes for select
  to authenticated
  using (true);

create policy "Users can manage their own post likes"
  on public.habitly_post_likes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.find_habitly_user(target_handle text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select user_id
  from public.habitly_profiles
  where lower(data->'user'->>'handle') = lower(trim(both '@' from target_handle))
  limit 1
$$;

create or replace function public.send_habitly_friend_request(target_handle text)
returns public.habitly_friend_requests
language plpgsql
security definer
set search_path = public
as $$
declare target_id uuid;
declare request_row public.habitly_friend_requests;
begin
  target_id := public.find_habitly_user(target_handle);
  if target_id is null then raise exception '找不到這個使用者 ID'; end if;
  if target_id = auth.uid() then raise exception '不能加自己為好友'; end if;
  insert into public.habitly_friend_requests (sender_id, recipient_id)
  values (auth.uid(), target_id)
  on conflict (sender_id, recipient_id) do update set status = 'pending'
  returning * into request_row;
  return request_row;
end
$$;

grant execute on function public.find_habitly_user(text) to authenticated;
grant execute on function public.send_habitly_friend_request(text) to authenticated;
