# BUG-012: Indexed pages estimate pinned at 10

**Filed:** 2026-05-14
**Severity:** Medium — data-integrity bug in a user-visible stat. Off by 1–4 orders of magnitude for any domain with real index presence.
**Status:** Fixed
**Area:** `supabase/functions/run-audit/steps/offsite.ts`, `supabase/functions/run-audit/lib/serper.ts`

## Repro

1. Audit any domain that has many pages indexed on Google (e.g. `vercel.com`, `stripe.com`).
2. Open `/report/<id>` → Off-site signals → **Indexed pages** tile.
3. Tile renders `10`, regardless of true index size.

Audit a tiny site (<10 indexed URLs) and the tile correctly shows 3–7 — the cap only manifests when the real value is ≥10.

## Expected

The tile reflects Google's reported total — e.g. `12,400` for a site with ~12k indexed pages.

## Actual

Always `10` when the true count is ≥10. Confirmed in two real audits (current 5–6 page domain showed the true count; prior hundreds-of-pages domain still showed `10`).

## Root cause

`supabase/functions/run-audit/steps/offsite.ts:34` (pre-fix):

```ts
const indexedPagesEstimate = siteSerp?.organic?.length ?? 0;
```

`siteSerp.organic` is the page-1 results array. The Serper call at `supabase/functions/run-audit/lib/serper.ts:20` hardcodes `num: 10`, so `organic.length` saturates at 10 by construction.

The actual count Google reports lives at `searchInformation.totalResults` (numeric string, e.g. `"1230"`), which the `SerperResult` interface did not declare and the offsite step did not read.

## Fix

1. Extend `SerperResult` interface to include `searchInformation?: { totalResults?: string }`.
2. Read `searchInformation.totalResults`, parse to `Number()`, guard with `Number.isFinite`, fall back to `organic.length` if Serper omits the field:

   ```ts
   const rawTotal = siteSerp?.searchInformation?.totalResults;
   const parsedTotal = rawTotal != null ? Number(rawTotal) : NaN;
   const indexedPagesEstimate = Number.isFinite(parsedTotal)
     ? parsedTotal
     : siteSerp?.organic?.length ?? 0;
   ```
3. Format the frontend tile with `toLocaleString()` so large counts read as `12,400` instead of `12400`.

## Out of scope

- Historical audits keep their stored value of `10` until re-run. No backfill migration.
- Brand-mentions tile (`brand_serp_mentions`) legitimately counts within page 1 of a brand-name SERP — its 10-cap is by design, not a bug.

## Verification

Real audit smoke: audit `vercel.com`, confirm Indexed pages tile shows a comma-formatted integer >>10. Then audit a small site (<10 pages) and confirm the fallback path still renders the true small count.

---

**Status:** Fixed in `6eabe7c`.

- Edge Function: `SerperResult` extended; offsite step reads `searchInformation.totalResults` with fallback.
- Frontend: `OffsiteCard` formats with `toLocaleString()`.
- Requires Edge Function redeploy (`supabase functions deploy run-audit`).
