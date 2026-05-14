# BUG-004: Article "INSPIRED BY" links and GEO cited sources use Gemini grounding-redirect URLs instead of real source URLs

**Filed:** 2026-05-14
**Severity:** Medium — degrades the value of the report's primary citation surface
**Status:** Open
**Area:** Backend — wherever Gemini grounding citations are persisted (`supabase/functions/run-audit/steps/geo.ts`, `steps/article-recs.ts`)

## Repro

Run an audit where Gemini returns grounded answers. Inspect §07 Article recommendations or expand a §05 GEO prompt row.

Seen on `pyth.network` audit (`200631ce`): every "INSPIRED BY" chip on every article card linked to a URL like:
```
https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGcOqqOwX43aBNYBDy_IXcWjUTuY77g8QDy...
```

## Expected

Real source URLs — the destination the redirect resolves to. e.g. `https://docs.solana.com/...`, `https://docs.pyth.network/...`, etc. Favicon + hostname truncation in the UI then displays a recognizable origin.

## Actual

- All grounded citations point to `vertexaisearch.cloud.google.com/grounding-api-redirect/<opaque-token>`.
- UI displays hostname `vertexaisearch.cloud.google.com` (or truncated to 28 chars), which is meaningless to the user.
- Clicking the link does work (Google's redirect resolves), but the user has no way to know where it points before clicking — bad trust UX, especially in a report.

## Why this is bad

The report's whole credibility argument is "we asked Gemini, here's what it actually cited, judge for yourself." If the citation chain is opaque, the report's value drops.

## Fix direction (backend)

The Google Gemini grounding API returns redirect URLs by design. To get the real URL:

1. **Follow the redirect server-side** when persisting cited URLs — `HEAD` request, capture `Location`, store that. Cache because Google's redirects can rate-limit.
2. **Or use the `groundingMetadata.webSearchQueries` + `groundingChunks` fields** if the SDK exposes them — these may have the underlying URL alongside the redirect token.
3. Persist both: `{ url: <resolved>, redirect_url: <google-redirect>, title }` so the UI can show the resolved one and fall back if resolution fails.

**Where:**
- `supabase/functions/run-audit/lib/gemini.ts` — the response parser. Look for where `groundingMetadata.groundingChunks[*].web.uri` is being mapped into `cited_urls`.
- `supabase/functions/run-audit/steps/geo.ts` — uses cited_urls for the GEO prompt rows.
- `supabase/functions/run-audit/steps/article-recs.ts` — uses cited_urls for article sources.

## UI defensive fallback (optional, cheap)

If resolution can't happen server-side for some reason, the client could render redirect URLs with a clearer hostname label like `via Gemini grounding` instead of `vertexaisearch.cloud.google.com`. But this is a band-aid — fix the data.


---

**Status:** Fixed in `1155866`.

resolveGroundingUrl() in lib/gemini.ts follows redirects (HEAD with GET fallback, 6s timeout); applied in steps/geo.ts so both DB-persisted cited_urls and article-recs input get real URLs.
