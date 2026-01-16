-- 003_create_push_events.sql
create extension if not exists pgcrypto;

create table if not exists public.push_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);

create index if not exists push_events_user_kind_idx on public.push_events(user_id, kind);
