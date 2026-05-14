# BUG-002: Offsite stat tiles render unit/note when value is missing

**Filed:** 2026-05-14
**Severity:** Low — cosmetic, makes a tile look half-loaded
**Status:** Open
**Area:** `components/report/OffsiteCard.tsx`

## Repro

Open a `/report/<id>` where the offsite section has these fields missing on the audit row:
- `indexed_pages_estimate` (null/undefined)
- `brand_serp_mentions` (null/undefined)

Seen on `pyth.network` audit (`200631ce`).

## Expected

Tile renders cleanly: either show the value, or fully hide the tile, or show an explicit "—" with no trailing unit/note.

## Actual

- The big mono value renders `—`
- The unit (`SERP`) and the note (`Across selected keywords`, `Google site: query estimate`) still render below
- The tile looks like it half-loaded — value missing but caption present

## Fix sketch

In `components/report/OffsiteCard.tsx`, the `StatTile` component renders `unit` and `note` unconditionally. When value is `—` (missing), either:

- Suppress `unit` and `note` (cleanest)
- Or replace note with `"unavailable"` in `var(--fg-4)` mono

Decide per design call. Suggest the first — empty tile says "we don't have this" without claiming a measurement.

## Where

`components/report/OffsiteCard.tsx` — the `StatTile` JSX block at the bottom of the file.


---

**Status:** Fixed in `4843978`.

StatTile component now hides unit and note text when value is null/empty.
