# BUG-010 — Realtime UPDATE handler clobbers populated state with truncated payload

**Severity:** High
**Area:** Frontend / Realtime
**Status:** Open
**Discovered:** Manual UI smoke on 2026-05-14, decen-masters.com audit

## Symptom

Report page renders correctly with all section data, then **spontaneously goes blank** while the user is viewing it. Reported as "I scrolled a bit and all data disappeared." DB row is unchanged — all 7 sections are still populated server-side. The bug is purely client-state corruption.

## Root cause

`app/report/[id]/ReportClient.tsx:73-78` subscribes to `postgres_changes` UPDATE events on the user's audit row and **replaces the entire local audit state** with `payload.new`:

```tsx
.on(
  'postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'audits', filter: `id=eq.${audit.id}` },
  (payload) => setAudit(payload.new as AuditPayload)
)
```

Supabase Realtime has a default payload size limit (~256KB). The `audits.sections` JSONB column commonly exceeds this once `onsite_crawl_cache` contains the full crawled HTML text. When the payload exceeds the limit, Realtime delivers a truncated `payload.new` — fields may be missing or set to `{}`. The handler blindly replaces the populated state with this truncated copy, blanking the UI.

This is triggered every time the row receives an UPDATE — most commonly by the heartbeat loop (every 15s while audit is non-terminal). Even though our audit is `status='complete'`, the heartbeat endpoint (BUG-011) keeps pinging, generating Realtime events that clobber state.

## Fix

Don't trust `payload.new`. Use the Realtime event ONLY as a notification trigger, then refetch the full row via `supabase.from('audits').select('*').eq('id', id).single()` — the REST GET has no payload size limit.

```tsx
.on(
  'postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'audits', filter: `id=eq.${audit.id}` },
  async () => {
    const { data } = await supabase.from('audits').select('*').eq('id', audit.id).single();
    if (data) setAudit(data as AuditPayload);
  }
)
```

Cost: one extra DB round-trip per Realtime event (~10/audit lifetime). Negligible.

Combined with BUG-011 (heartbeat skips terminal audits), eliminates the spurious UPDATE events that triggered this bug in the wild.
