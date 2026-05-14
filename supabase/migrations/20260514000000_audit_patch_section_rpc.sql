-- Atomic JSONB patch for audit.sections to prevent concurrent-writer races.
-- Replaces read-merge-write in supabase/functions/run-audit/lib/db.ts:patchSection.
create or replace function public.audit_patch_section(
  p_id uuid,
  p_key text,
  p_value jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  update public.audits
     set sections = coalesce(sections, '{}'::jsonb) || jsonb_build_object(p_key, p_value)
   where id = p_id;
$$;

revoke all on function public.audit_patch_section(uuid, text, jsonb) from public;
grant execute on function public.audit_patch_section(uuid, text, jsonb) to service_role;
