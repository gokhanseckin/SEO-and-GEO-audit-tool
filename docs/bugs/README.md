# Bug log

| ID | Severity | Area | Title | Status |
|---|---|---|---|---|
| [BUG-001](BUG-001-complete-status-with-empty-sections.md) | High | Pipeline | Audit marked `status=complete` but `sections` is empty | Fixed in `00070ce` |
| [BUG-002](BUG-002-offsite-tile-empty-value-styling.md) | Low | UI | Offsite stat tiles render unit/note when value is missing | Fixed in `4843978` |
| [BUG-003](BUG-003-enriched-competitor-fetch-failed-summary.md) | Medium | Backend | Enriched competitor cards show literal fetch-error string as Gemini summary | Fixed in `9588e7d` |
| [BUG-004](BUG-004-grounding-redirect-as-source-url.md) | Medium | Backend | Article and GEO citations use Gemini grounding-redirect URLs instead of real source URLs | Fixed in `1155866` |
| [BUG-005](BUG-005-homepage-no-signedin-state.md) | Medium | UI / Auth | Homepage doesn't reflect signed-in state; no sign-out button | Fixed in `6e3c9f0` |
| [BUG-006](BUG-006-duplicate-pending-audits-on-resubmit.md) | Medium | Backend / UX | Resubmitting same domain creates duplicate pending audits | Fixed in `2ce5015` |
| [BUG-007](BUG-007-analyze-page-no-signout.md) | Low | UI / Auth | `/analyze` page has no sign-out button or auth state in header | Fixed in `2ce5015` |
| [BUG-008](BUG-008-fake-progress-bar.md) | Low | UI | `/analyze` progress bar is fake (40% hardcoded, "~10s" static) | Fixed in `a265c21` |
| [BUG-009](BUG-009-relevance-always-high.md) | Medium | LLM | Keyword relevance scores cluster high (all green pills) | Fix A shipped in `e3d9232` (retest pending) |
| [BUG-010](BUG-010-realtime-replace-clobbers-state.md) | High | Frontend / Realtime | Realtime UPDATE handler clobbers state with truncated payload (report blanks on viewing) | Fixed in `49a4032` |
| [BUG-011](BUG-011-heartbeat-keeps-firing-after-complete.md) | Medium | Backend / API | Heartbeat endpoint accepts pings for terminal audits | Fixed in `49a4032` |
| [BUG-012](BUG-012-indexed-pages-capped-at-10.md) | Medium | Backend / UI | Indexed pages estimate pinned at 10 (reads `organic.length` instead of `searchInformation.totalResults`) | Fixed (pending commit) |
