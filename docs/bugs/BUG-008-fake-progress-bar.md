# BUG-008 — `/analyze` progress bar is fake (hardcoded 40% width + static "~10s")

**Severity:** Low
**Area:** UI
**Status:** Open
**Discovered:** Manual UI smoke on 2026-05-14, decen-masters.com audit

## Symptom

While `/analyze` is in the `starting` phase (crawling the site + asking Gemini for keywords), the progress bar:
- Shows ~40% filled from the moment the page loads and never moves
- Has a CSS shimmer gradient that creates the illusion of activity but no actual progress signal
- Displays the label `~10s` regardless of how long it has actually been running

Real crawl + Gemini call takes anywhere from 8s to 30s depending on the site. The "~10s" estimate is wrong for most domains.

## Root cause

`app/analyze/AnalyzeClient.tsx:285-300` renders the bar with `width: '40%'` (hardcoded) plus a `shimmer` keyframe animation on a gradient. The bar isn't connected to any timer or progress signal. Line 307 prints `~10s` as a static string.

```tsx
<div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '40%', ... animation: 'shimmer 1.6s linear infinite' ... }} />
```

No `useState`, no `useEffect`, no timer.

## Fix

Honest time-based progress that ramps from 5% to ~90% over the expected duration, then sits at 90% until the API call returns and the parent component unmounts `AnalyzeLoading`.

- Track `elapsed` seconds in `AnalyzeLoading` via `setInterval(..., 250)`.
- Map `elapsed → progress`: e.g. linear `min(90, 5 + elapsed * 3)` — reaches 90% at ~28s, then plateaus.
- Replace `width: '40%'` with `width: ${progress}%` with a `transition: 'width 0.4s linear'`.
- Replace static `~10s` with the real elapsed time: e.g. `7s` → `8s` → `9s`.

When the parent transitions to `choosing` or `error`, the loader unmounts and the interval is cleaned up.


---

**Status:** Fixed in `a265c21`.

AnalyzeLoading now tracks elapsed seconds and ramps progress linearly 5% → 90% over ~28s (then plateaus). Replaced static '~10s' label with live elapsed counter.
