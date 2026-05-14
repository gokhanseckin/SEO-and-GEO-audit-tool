# BUG-006 — Resubmitting same domain creates duplicate `pending` audits

**Severity:** Medium
**Area:** Backend / UX
**Status:** Open
**Discovered:** Manual UI smoke on 2026-05-14

## Symptom

Submitting the same domain twice from the homepage (or refreshing `/analyze?domain=X`) creates a new `audits` row each time, all in `status='pending'`, without deduplication. The Supabase DB accumulates orphan rows that the user has no way to discard from the UI.

Observed in production: four `pending` rows for `pyth.network` and one for `brix.money` for a single admin user.

## Reproduction

1. Sign in to `https://seo-geo-audit-tool.vercel.app`
2. Submit `pyth.network` from the homepage → land on `/analyze?domain=pyth.network`
3. Don't click "Run" — abandon the page
4. Go back to homepage → submit `pyth.network` again
5. Inspect DB: two `pending` audits for `pyth.network`, same user, both with `status='pending'`, `started_at=null`

Also reproduces by simply refreshing `/analyze?domain=pyth.network` (since `AnalyzeClient.tsx:23-31` calls `/api/audits/start` on every mount).

## Root cause

`app/api/audits/start/route.ts:30-40` has an `existing` query that fetches the user's MOST RECENT audit (ANY domain, ANY status) and blocks non-admins from creating another (quota check). For admins it does NOT dedup at all — every POST creates a new row.

```ts
const { data: existing } = await supabase
  .from('audits')
  .select('id, status')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (existing && profile?.role !== 'admin') {
  return NextResponse.json({ error: 'quota_exceeded', existing_audit_id: existing.id }, { status: 409 });
}
```

The intent (quota enforcement for non-admins) is correct; the gap is dedup-by-domain.

## Fix (v1 — server-side dedup)

Add a same-domain dedup check BEFORE the broad existing query. If the user has a `pending` or `running` audit for this exact domain, return its ID rather than inserting a new row:

```ts
const { data: existingForDomain } = await supabase
  .from('audits')
  .select('id, status')
  .eq('user_id', user.id)
  .eq('domain', domain)
  .in('status', ['pending', 'running'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (existingForDomain) {
  return NextResponse.json({ audit_id: existingForDomain.id });
}
```

The client (`AnalyzeClient.tsx`) receives the same `{ audit_id }` shape regardless of whether the row was newly created or returned from dedup — no client change required.

## Future improvement (post-v1, deferred)

A proper UX would show a modal on the homepage when the user resubmits a domain they have any audit (pending/running/complete) for: **Resume / View report / Start fresh**. That requires:
- A new `?force=true` param on `/api/audits/start` to bypass the dedup on user request
- A client-side check (or a new HEAD-style endpoint) that asks "do I have an audit for this domain?" before submission
- Modal UI with the three actions
- For `Start fresh` on a completed audit, archive the old one (`status='archived'`) so the report URL still works

Logged here for future planning. Not in scope for v1 stabilization.

## Workaround (current cleanup)

SQL to delete orphan pending rows for the testing user:

```sql
delete from public.audits
 where status = 'pending'
   and started_at is null
   and last_heartbeat_at is null
 returning id, domain, user_id;
```

Safer scoped version that targets a specific user:

```sql
delete from public.audits
 where user_id = '<UUID>'
   and status = 'pending'
   and started_at is null
returning id, domain;
```


---

**Status:** Fixed in `2ce5015`.

Server-side dedup in /api/audits/start checks for existing (user_id, domain) audit in pending/running status before insert; returns the existing audit_id if found instead of creating a duplicate row.
