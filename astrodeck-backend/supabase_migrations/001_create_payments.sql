-- supabase_migrations/001_create_payments.sql
-- Run in Supabase SQL Editor (project Astrodeck).
-- Creates an idempotent payments ledger for PIX (premium + coins).

create extension if not exists pgcrypto;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  identifier text not null unique,
  user_id uuid not null references public.users(id) on delete cascade,

  kind text not null check (kind in ('premium','coins')),
  plan_id text,
  pack_id text,

  coins int4,
  amount numeric(10,2) not null,
  currency text not null default 'BRL',

  status text not null default 'created',
  dustpay_status text,
  dustpay_transaction_id text,

  dustpay_request jsonb,
  dustpay_response jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  applied_at timestamptz
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_status_idx on public.payments(status);
