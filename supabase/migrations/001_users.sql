-- 001_users.sql — users table mirrored from auth.users + Trust Score columns
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  phone text,
  display_name text not null,
  avatar_url text,
  trust_score int default null,
  trust_tier text default 'Unrated',
  joined_at timestamptz not null default now(),
  is_admin boolean not null default false
);

create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_trust_score on public.users(trust_score desc);

-- Auto-create public.users row when someone signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.phone
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
