-- ============================================================
-- SEO + GEO Audit Tool — initial schema
-- ============================================================

-- ============ 1. ADMIN ALLOWLIST ============
create table public.admin_emails (
  email text primary key,
  created_at timestamptz default now()
);

insert into public.admin_emails (email) values ('gokhanseckin@gmail.com');

-- ============ 2. PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  audits_used int not null default 0,
  created_at timestamptz default now()
);

-- ============ 3. AUDITS ============
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  domain text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'complete', 'failed')),
  llm_provider text not null default 'gemini',
  serper_query_cap int not null default 15 check (serper_query_cap <= 20),
  sections jsonb not null default '{}'::jsonb,
  error text,
  last_heartbeat_at timestamptz,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index audits_user_id_idx on public.audits(user_id);
create index audits_status_idx on public.audits(status);

-- ============ 4. EMAIL DELIVERIES ============
create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('completion_fallback', 'pdf_export')),
  resend_message_id text,
  status text not null check (status in ('queued', 'sent', 'failed')),
  error text,
  created_at timestamptz default now()
);

create index email_deliveries_audit_idx on public.email_deliveries(audit_id);

-- ============ 5. TRIGGERS ============

-- Auto-create profile on auth.users insert, assigning admin role if email is in allowlist
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when exists (select 1 from public.admin_emails where email = new.email)
         then 'admin' else 'user' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quota enforcement (1 lifetime for user, 20/UTC-day for admin)
create or replace function public.check_audit_quota() returns trigger
language plpgsql as $$
declare
  user_role text;
  cnt int;
begin
  select role into user_role from public.profiles where id = new.user_id;
  if user_role = 'admin' then
    select count(*) into cnt from public.audits
      where user_id = new.user_id
        and created_at >= date_trunc('day', now() at time zone 'UTC');
    if cnt >= 20 then
      raise exception 'admin_daily_quota_exceeded';
    end if;
  else
    select count(*) into cnt from public.audits where user_id = new.user_id;
    if cnt >= 1 then
      raise exception 'user_lifetime_quota_exceeded';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_audit_quota
  before insert on public.audits
  for each row execute function public.check_audit_quota();

-- Increment audits_used counter
create or replace function public.increment_audits_used() returns trigger
language plpgsql as $$
begin
  update public.profiles set audits_used = audits_used + 1 where id = new.user_id;
  return new;
end;
$$;

create trigger bump_audits_used
  after insert on public.audits
  for each row execute function public.increment_audits_used();

-- ============ 6. ROW-LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.audits enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.admin_emails enable row level security;

-- Profiles: read+update own
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id);

-- Audits: read own, insert own. No update/delete policy — service role only.
create policy "own audits read" on public.audits
  for select using (auth.uid() = user_id);
create policy "own audits insert" on public.audits
  for insert with check (auth.uid() = user_id);

-- Email deliveries: read own only
create policy "own deliveries read" on public.email_deliveries
  for select using (auth.uid() = user_id);

-- admin_emails: no policies = no client access. Service role only.

-- ============ 7. REALTIME ============
-- Enable Realtime publication for audits table so the report UI can subscribe
alter publication supabase_realtime add table public.audits;
