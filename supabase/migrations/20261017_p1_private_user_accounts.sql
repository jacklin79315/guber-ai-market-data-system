-- P1.1 account storage, separate from market-data tables.
create schema if not exists app_private;
create table if not exists app_private.user_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text,
  role text not null check (role in ('admin','viewer')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_-]{3,40}$')
);
revoke all on schema app_private from public, anon, authenticated;
revoke all on app_private.user_accounts from public, anon, authenticated;
create unique index if not exists one_admin_only on app_private.user_accounts (role) where role='admin';
-- Admin password is intentionally unset until a secure password is chosen.
insert into app_private.user_accounts (username,role,password_hash)
values ('guber','admin',null)
on conflict (username) do nothing;
