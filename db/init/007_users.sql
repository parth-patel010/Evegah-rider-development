-- Auth users table (replaces Firebase Authentication).
-- Passwords are stored as bcrypt hashes computed by the API at insert/update time.
-- pgcrypto extension is created by 001_rider_drafts.sql; we don't re-create here to keep ordering simple.

create table if not exists public.users (
  uid uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text,
  role text not null default 'employee',
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

-- The application always queries by lowercased email; keep an expression index for fast lookup.
create index if not exists users_email_lower_idx
  on public.users ((lower(email)));

-- Re-use the shared updated_at trigger function defined in 001_rider_drafts.sql.
drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- Note on data integrity:
-- Existing tables (rider_drafts, battery_swaps, payment_dues) store employee_uid as plain text
-- (often equal to a Firebase uid or the literal string 'system') and are NOT declared as FKs to
-- this table. Adding FKs would require backfilling/cleaning historical rows and is intentionally
-- left out of this migration.
