# BUG-011 — Heartbeat endpoint accepts pings for terminal audits

**Severity:** Medium
**Area:** Backend / API
**Status:** Open
**Discovered:** Manual UI smoke on 2026-05-14, decen-masters.com audit

## Symptom

`audits.last_heartbeat_at` continues advancing for ~27 minutes AFTER `completed_at` was set. Specifically:

| Field | Value |
|---|---|
| `completed_at` | 2026-05-14 15:38:40 |
| `last_heartbeat_at` | 2026-05-14 16:05:13 |
| `status` | `complete` |

That's roughly 108 heartbeat writes against a row that should never have received them.

## Root cause

`app/api/audits/[id]/heartbeat/route.ts:11-17` updates `last_heartbeat_at` for any audit owned by the requesting user, with no check on `status`. Even when the audit is `complete` or `failed`, the endpoint cheerfully writes the timestamp.

Client-side `app/report/[id]/ReportClient.tsx:84-92` correctly stops scheduling pings when `audit.status` is terminal, but if the local state hasn't yet reflected the terminal status (e.g. Realtime event hasn't arrived, or a stale tab is still open from earlier), the client keeps pinging. The server has no defense.

Each ping is a DB write → Realtime emits an UPDATE event → cascades into BUG-010 (state-clobbering) on any other open viewer.

## Fix

Make the endpoint check current status before writing. If terminal, no-op with 200:

```ts
const { data: audit } = await svc.from('audits').select('id, user_id, status').eq('id', id).single();
if (!audit || audit.user_id !== user.id) {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}
if (audit.status === 'complete' || audit.status === 'failed') {
  return NextResponse.json({ ok: true, skipped: 'terminal_status' });
}
await svc.from('audits').update({ last_heartbeat_at: new Date().toISOString() }).eq('id', id);
return NextResponse.json({ ok: true });
```

Cheap defense in depth. Prevents the BUG-010 amplification path even if the client has stale local state.
