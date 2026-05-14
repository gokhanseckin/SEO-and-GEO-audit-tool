# BUG-003: Enriched competitor cards show literal "(fetch failed: Error: http 404)" as Gemini summary

**Filed:** 2026-05-14
**Severity:** Medium — looks broken in front of the user; trust signal in the report
**Status:** Open
**Area:** Backend (`supabase/functions/run-audit/steps/competitors.ts`) primary; UI hide-on-error defensive fix secondary

## Repro

Run an audit where at least one enriched competitor URL fails to fetch (403, 404, blocked, etc.).

Seen on `pyth.network` audit (`200631ce`):
- `vertexaisearch.cloud.google.com` — summary = `"(fetch failed: Error: http 404)"`
- `reddit.com` — summary = `"(fetch failed: Error: http 403)"`

## Expected

One of:
- Drop the enriched card entirely when fetch failed (preferred — there's nothing useful to show).
- Or render the card with the SERP/LLM source chips but no "OUR TAKE · GEMINI" block at all.

## Actual

The card renders with all chrome (favicon, domain, source chips, "OUR TAKE · GEMINI" eyebrow) and the body is the raw error string in quotes, looking like an actual Gemini summary.

## Fix direction

**Primary (backend):** in `supabase/functions/run-audit/steps/competitors.ts` — when the upstream fetch fails, do not write the failure string as `summary`. Either skip the competitor from `enriched[]` entirely, or write `{ domain, sources, summary: null, fetch_error: '...' }` so the client can detect it.

**Secondary (UI defensive):** in `components/report/CompetitorTabs.tsx`, filter enriched entries where `summary` starts with `"(fetch failed"` or is null. Hide that card. Two lines of code; cheap insurance.

## Adjacent: vertexaisearch.cloud.google.com appearing as a competitor

The same audit had `vertexaisearch.cloud.google.com` ranked #1 LLM-cited with 120 cites. That's Gemini's own grounding-redirect host, not a real competitor. Backend should blocklist that hostname (and the redirect URL pattern) when bucketing citations into competitor domains. Likely same area: `supabase/functions/run-audit/steps/competitors.ts` and possibly `steps/geo.ts` where cited URLs are bucketed.

Not the same bug strictly — but the same backend file. Worth handling in the same PR.


---

**Status:** Fixed in `9588e7d`.

competitors.ts uses safeSummary() to filter fetch-error strings before persisting; catch path returns null directly.
