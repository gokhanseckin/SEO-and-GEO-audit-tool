# BUG-001: Audit marked `status=complete` but `sections` is empty

**Filed:** 2026-05-14
**Severity:** High — silently destroys completed audit results, user sees empty report with green "Complete" pill
**Status:** Open
**Reporter:** Gökhan
**Area:** Audit pipeline (Supabase edge function `run-audit` + retry flow)
**Not:** UI bug. The frontend faithfully renders whatever the DB row says.

---

## Repro

1. Run an audit through `/analyze` → `/report/<id>`.
2. Wait for it to complete the first time (sections populate, `status='complete'`).
3. Trigger a re-run on the same audit ID (or whatever path led to this in the wild).
4. End state: row has `status='complete'`, `sections='{}'`, `elapsed` shows the *original* first-run elapsed time.

Observed once on audit `200631ce-7bc4-43cb-a757-cb957178fd8a` (domain `pyth.network`) on 2026-05-14 around 07:43–07:47 local.

## Expected

One of:
- `status='running'` while sections are being repopulated, then `status='complete'` once all 7 sections land — OR —
- `status='failed'` with an `error` message if the re-run couldn't proceed — OR —
- The original sections are preserved through the re-run and only swapped in atomically at the end.

A row should never simultaneously have `status='complete'` and `sections='{}'`.

## Actual

- `status='complete'` (StatusPill renders green "COMPLETE")
- `sections='{}'` (every section component falls through to its skeleton state)
- `ProgressRing` shows `0 of 7 ready`
- Elapsed time shows `1m 03s` — frozen from the *first* run, even though a second run happened after

UI is correct given the data. Inconsistency is in the row.

## Evidence

- Earlier MCP read of the same row (during this session) confirmed sections were populated:
  - 17 issues in §03 Onsite
  - Description blurb present
  - GEO 0/8 prompts populated
  - Competitors enriched cards present
  - 9 article recommendations
- Later screenshot from user shows the same row with `status='complete'` and every section skeleton-rendering.
- No backend code was changed between the two reads.

## Suspected causes (pick the one)

### Hypothesis A — Retry flow wipes sections then marks complete
Some code path does:
```sql
UPDATE audits SET sections = '{}' WHERE id = ...;  -- clear before re-run
-- ... pipeline runs, but never re-populates sections ...
UPDATE audits SET status = 'complete' WHERE id = ...;  -- ends up complete with {}
```
**Where to look:**
- `supabase/functions/run-audit/index.ts` — the entry point. Check whether it clears sections at start.
- `app/api/audits/[id]/run/route.ts` — the dispatcher. Does it reset the row?
- Any `retry` or `rerun` handler.

### Hypothesis B — Pipeline marks complete on partial failure
If a step throws but the orchestrator catches and continues to the "mark complete" step instead of "mark failed", you'd land here.
**Where to look:**
- `supabase/functions/run-audit/index.ts` — the final `UPDATE audits SET status=...` call. What does it do when steps threw?
- Check whether `status='partial'` is ever written.

### Hypothesis C — Realtime channel pushed an empty payload
The client subscribes to `postgres_changes` on the row in `app/report/[id]/ReportClient.tsx:71-80`. If Postgres emitted an UPDATE event mid-write where the row was momentarily `{}`, the client would store that state and stop reverting.
**Where to look:**
- Replication payload for the affected row at the time of the event. Does Postgres ever publish an intermediate state with `sections='{}'`?
- A safer client merge would be: only apply incoming sections if `Object.keys(new.sections).length >= Object.keys(prev.sections).length`. But the right fix is on the writer side.

## How to diagnose live

```sql
select id, status, started_at, completed_at, last_heartbeat_at,
       jsonb_object_keys(sections) as section_keys, error
from audits
where id = '200631ce-7bc4-43cb-a757-cb957178fd8a';
```
- If `section_keys` returns 0 rows and `status='complete'` → confirmed.
- Then check `supabase` function logs for that `audit_id` between `07:43` and `07:47` to find the offending UPDATE.

## Fix direction (when ready)

1. **Atomic writes**: never `UPDATE sections = '{}'`. Either patch in new keys per step (the existing pattern), or write to a temp column and swap atomically.
2. **Status invariant**: enforce in the writer: `status='complete'` requires `jsonb_object_keys(sections) @> array['description','keywords','onsite','offsite','geo','competitors','article_recommendations']`. A DB check constraint would catch this:
   ```sql
   alter table audits add constraint audits_complete_has_sections
     check (status <> 'complete' or jsonb_typeof(sections) = 'object' and sections <> '{}'::jsonb);
   ```
   (Tune the predicate — empty-but-truly-failed audits should go to `status='failed'` anyway.)
3. **Client defensive merge** (defense in depth): in `ReportClient.tsx`, refuse to overwrite locally-known sections with a strictly smaller payload. Drop fewer keys → keep the richer state. Not the primary fix.

## Related bugs

- [BUG-002](BUG-002-offsite-tile-empty-value-styling.md) — Offsite tile styling when values are missing
- [BUG-003](BUG-003-enriched-competitor-fetch-failed-summary.md) — Enriched competitor cards show fetch-error string as summary
- [BUG-004](BUG-004-grounding-redirect-as-source-url.md) — Grounding redirect URLs surfaced instead of resolved source URLs


---

**Status:** Fixed in `00070ce`.

atomic patchSection RPC eliminates the concurrent read-modify-write race that allowed sections to be merged out of order. pg_cron watchdog (commit 2d94be3) catches any future stuck audits.
