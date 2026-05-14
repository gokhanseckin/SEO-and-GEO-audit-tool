# BUG-007 — `/analyze` page has no sign-out button or auth state in header

**Severity:** Low
**Area:** UI / Auth
**Status:** Open
**Discovered:** Manual UI smoke on 2026-05-14

## Symptom

The intermediary page `/analyze?domain=X` (where users confirm keywords before running an audit) has a header with `Logo` + breadcrumb `/audit / <domain> / keywords` but no right-side controls. There is no way to sign out, see who is signed in, or navigate back home from this page.

Same pattern as BUG-005 (homepage) but on a different page.

## Reproduction

1. Sign in
2. Submit a domain from homepage → land on `/analyze?domain=X`
3. Scan the page header — no user email, no sign-out, no home link

## Root cause

`app/analyze/AnalyzeClient.tsx:100-130` renders a `<header>` with `justify-content: space-between` (line 103) but only includes a left-side group (Logo + breadcrumb). The right side of the flex container is empty.

## Fix

Mirror the BUG-005 fix on the homepage:
- Track auth state via `supabase.auth.getUser()` + `onAuthStateChange` subscription
- Render the user's email + a "Sign out" button on the right side of the header
- Sign-out handler calls `supabase.auth.signOut()` and pushes `/`

Same import + state + effect + handler pattern as `app/page.tsx`.
