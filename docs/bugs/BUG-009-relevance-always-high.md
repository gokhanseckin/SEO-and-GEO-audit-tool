# BUG-009 — Keyword relevance scores cluster at high values (all green)

**Severity:** Medium
**Area:** Backend / LLM prompt
**Status:** Open (investigated; fix deferred)
**Discovered:** Manual UI smoke on 2026-05-14, decen-masters.com audit

## Symptom

On the `/analyze` keyword picker, every candidate keyword pill is colored **green** (relevance > 0.75 → `var(--signal)`). It's never the case that a real site is genuinely "high relevance" on every term Gemini suggests — yet the UI shows it that way every time.

UI thresholds (`AnalyzeClient.tsx:377`):

```ts
k.relevance > 0.75 ? 'var(--signal)' /* green */
  : k.relevance > 0.55 ? 'var(--amber)' /* amber */
  : 'var(--fg-4)' /* grey */
```

If every keyword Gemini returns is > 0.75, the colour signal is dead — there's no visible distinction between "this is core to the site" and "this is a tangent".

## Root cause

Three compounding factors:

### 1. The prompt sets up a self-fulfilling extraction (`lib/llm/gemini.ts:62-67`)

```
You are an SEO analyst. From the website text below, extract 20-30 candidate keywords for SEO targeting.
Mix head terms, long-tail phrases, and question-style queries. For each, estimate relevance 0..1 based on how clearly the site is about that topic.
Return ONLY valid JSON: an array of {"term": string, "relevance": number, "type": "head"|"long-tail"|"question"}.
```

The model is asked to **extract relevant keywords** and **score their relevance** in the same call. By construction, every term it generates was chosen because it seemed relevant — so the score is post-hoc justification, not independent measurement. The model's natural calibration is to compress the score range upward.

### 2. No comparison baseline or anchoring in the prompt

The prompt doesn't ask the model to spread scores across the 0..1 range, nor does it provide reference examples ("a perfect-match term scores 0.95; a tangential one scores 0.45"). Without anchors, LLMs default to grade-inflated scores in the 0.7-0.95 band.

### 3. Sort + truncate amplifies the effect (`app/api/audits/start/route.ts:58-59`)

```ts
candidates.sort((a, b) => b.relevance - a.relevance);
```

The 20-30 candidates are sorted by relevance desc. If the model returns a distribution like `[0.95, 0.92, 0.90, 0.88, 0.85, 0.83, 0.80, 0.78, 0.75, 0.72, 0.68, 0.65, ...]`, the top 10 shown to the user (the default selection) are all > 0.7 → all green. The lower-relevance tail is hidden in the "Show more" candidates list — invisible by default.

Net: Gemini's compressed range × top-N truncation = "all green, always."

## Fix options (NOT YET IMPLEMENTED, deferred)

Three independent levers — could ship any one or a combination:

### A. Better prompt — force range spread + anchors

```
For each keyword, set relevance using this rubric:
  0.90-1.00 = the site exists primarily to serve this topic (1-2 terms at most)
  0.70-0.89 = directly relevant; explicitly named/described on the site
  0.50-0.69 = adjacent; mentioned or implied but not central
  0.30-0.49 = tangential; could plausibly bring qualified traffic
  0.00-0.29 = off-topic or speculative
Aim for at least 5 candidates below 0.70.
```

Cheapest to ship; behavior depends on how well the model follows the rubric.

### B. Display percentile, not raw score

Re-bucket on the client: top 1/3 of returned candidates = green, middle 1/3 = amber, bottom 1/3 = grey. Always a visible distribution regardless of model calibration.

Pro: deterministic UX. Con: hides absolute relevance signal — a uniformly excellent set of 30 candidates would still get 10 grey ones for cosmetic reasons.

### C. Drop the colour signal entirely

If relevance scoring is unreliable, remove the green/amber/grey colour from the pills. Keep the score in the tooltip for power users; let the user pick keywords by reading them, not by relying on the colour.

Lowest risk. Reduces UI noise.

## Recommendation (when picking it up)

Start with **A** (prompt rubric). If after retesting the spread is still narrow (e.g. all keywords still > 0.7), follow with **B** (client-side percentile). Avoid **C** until both A and B fail — colour signal is valuable when it's accurate.

## Not in scope for v1

The smoke caught this but fixing it well requires retesting against several real domains to see how the distribution shifts. Not blocking ship. Track as a v1.1 polish item.


---

**Status:** Fix attempt A shipped in `e3d9232`.

Rewrote extractKeywords prompt with explicit 5-band rubric (0.9-1.0 core, 0.7-0.89 direct, 0.5-0.69 adjacent, 0.3-0.49 tangential, 0.0-0.29 off-topic) and added two hard requirements: at least 5 candidates must score below 0.70 and scores must distribute across the full 0..1 range. If the spread is still too narrow on retest, escalate to option B (client-side percentile bucketing).
