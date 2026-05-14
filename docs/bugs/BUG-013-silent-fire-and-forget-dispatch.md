# BUG-013: Silent fire-and-forget Edge Function dispatch

**Filed:** 2026-05-14
**Severity:** High — silently strands audits in `status='running'` with zero observability when the Edge Function gateway rejects the request.
**Status:** Fixed
**Area:** `app/api/audits/[id]/run/route.ts`

## Repro

1. Cause the Supabase Edge Function gateway to reject the dispatch — e.g. redeploy `run-audit` without `--no-verify-jwt`, which flips `verify_jwt` to `true` and rejects the service-role bearer with 401.
2. Sign in, audit any domain, pick keywords, click **Run full audit**.
3. UI returns 202, redirects to `/report/<id>`. The audit row is flipped to `status='running'`.
4. Edge Function is **never invoked**. No section data appears.
5. Report page sits forever — the browser keeps pinging `/api/audits/[id]/heartbeat`, which keeps `last_heartbeat_at` fresh, so the pg_cron watchdog (`> 2 min since heartbeat`) never sweeps the row.

Real instance: audit `10862b87-e138-45bd-9c43-1bfd4bedb48b` (vercel.com), stuck at `running` for 50+ minutes after `started_at`. Edge Function gateway log shows `POST | 401 | .../functions/v1/run-audit` at the same second as `started_at`. No 5xx, no client-visible error.

## Root cause

`app/api/audits/[id]/run/route.ts` performed a **fire-and-forget** dispatch with no result inspection:

```ts
fetch(fnUrl, { ... })
  .catch((e) => console.error('edge dispatch failed:', e));
return NextResponse.json({ ok: true }, { status: 202 });
```

Three independent failure modes were all silent:

1. **`.catch()` only catches promise rejections** (network errors). A non-2xx HTTP response resolves normally — so a 401/403/5xx response was completely ignored.
2. **The promise was not awaited.** Even when the dispatch did fail (network error or non-ok), the Next.js route returned 202 before the failure path could even log. On Vercel's runtime, the isolate may also be torn down before the unawaited fetch completes, so the request may not even leave the function.
3. **The audit row was already flipped to `status='running'`** before dispatch. A silent dispatch failure left the row stranded — and the browser's heartbeat pings indefinitely keep the watchdog from sweeping it.

By contrast, the retry route at `app/api/audits/[id]/retry/route.ts:25` awaits the dispatch and returns 502 on `!r.ok`. That's the correct pattern.

## Fix

Adopt the retry-route pattern in `run/route.ts`:

```ts
let dispatch: Response;
try {
  dispatch = await fetch(fnUrl, { ... });
} catch (e) {
  await svc.from('audits').update({
    status: 'failed',
    error: `edge_dispatch_network: ${String(e).slice(0, 500)}`,
  }).eq('id', id);
  return NextResponse.json({ error: 'dispatch_failed', detail: String(e) }, { status: 502 });
}

if (!dispatch.ok) {
  const detail = await dispatch.text();
  await svc.from('audits').update({
    status: 'failed',
    error: `edge_dispatch_${dispatch.status}: ${detail.slice(0, 500)}`,
  }).eq('id', id);
  return NextResponse.json({ error: 'dispatch_failed', status: dispatch.status, detail }, { status: 502 });
}

return NextResponse.json({ ok: true }, { status: 202 });
```

Guarantees on failure:
- Audit row is reset to `status='failed'` with a diagnostic `error` string (`edge_dispatch_401: ...`).
- Client gets `502 dispatch_failed` with the gateway's reason.
- Retry button is enabled (retry endpoint requires `status='failed'`).
- The audit doesn't disappear into "running forever" limbo.

## Tests

Added `__tests__/app/api/audits/run.test.ts` covering:
- 202 happy path
- 502 + audit reset when dispatch returns non-ok
- 502 + audit reset when dispatch network-errors

## Related

- Discovered while investigating audit `10862b87-e138-45bd-9c43-1bfd4bedb48b` stuck for ~50 min on vercel.com.
- The 401 root cause was a `supabase functions deploy run-audit` that omitted `--no-verify-jwt`, flipping `verify_jwt` from `false` to `true`. Deploy command for `run-audit` must always include `--no-verify-jwt`.
- BUG-011 (heartbeat fires for terminal audits) is in the same family — both touch the "is this audit really alive?" signal. The watchdog gate (`heartbeat > 2min`) is necessary but not sufficient on its own; without this fix the browser's heartbeat could indefinitely mask a stuck audit.

---

**Status:** Fixed in `53504a1`.

## Follow-up: prevent verify_jwt regression

To stop a future bare `supabase functions deploy run-audit` from re-introducing the same 401, two guardrails were added:

1. **`supabase/config.toml`** now pins per-function config:
   ```toml
   [functions.run-audit]
   verify_jwt = false
   ```
   The Supabase CLI respects this on deploy — the `--no-verify-jwt` flag becomes redundant.

2. **`package.json`** adds an `npm run deploy:fn` script that always passes `--no-verify-jwt`, as belt-and-suspenders.
