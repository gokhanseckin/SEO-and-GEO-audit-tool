-- Watchdog: flip 'running' audits whose heartbeats stopped to 'failed' with sentinel error.
-- Schema note: audits has no updated_at; we use coalesce(last_heartbeat_at, started_at, created_at).
create extension if not exists pg_cron with schema extensions;

create or replace function public.audit_watchdog_sweep() returns void
language sql
security definer
set search_path = public
as $$
  update public.audits
     set status = 'failed',
         error = 'watchdog_timeout',
         completed_at = now()
   where status = 'running'
     and coalesce(last_heartbeat_at, started_at, created_at) < now() - interval '2 minutes';
$$;

revoke all on function public.audit_watchdog_sweep() from public;

-- Schedule every minute. Re-creating with same name is idempotent (it returns the existing job id).
select cron.schedule(
  'audit-watchdog',
  '* * * * *',
  $$select public.audit_watchdog_sweep();$$
);
