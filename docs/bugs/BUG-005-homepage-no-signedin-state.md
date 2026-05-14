# BUG-005 — Homepage doesn't reflect signed-in state; no sign-out UI

**Severity:** Medium
**Area:** UI / Auth
**Status:** Open
**Discovered:** Manual UI smoke on 2026-05-14 against `https://seo-geo-audit-tool.vercel.app`

## Symptom

When a user is signed in, the homepage `/` still displays the **"Sign in"** button in the header (`app/page.tsx:102-104`). There is no indicator of who is logged in, and no way to sign out from the homepage. The user is functionally stranded — clicking "Sign in" again just reopens the `AuthModal` for a user who is already authenticated.

## Reproduction

1. Sign in via Google OAuth on `https://seo-geo-audit-tool.vercel.app`
2. Get redirected back to `/` (or land on `/` after dismissing post-login routing)
3. Header still shows "Sign in" button
4. No `Sign out` link/button anywhere on the page

## Root cause

`app/page.tsx` is a client component that reads the user via `supabase.auth.getUser()` only at form-submit time (line 58-66), to decide whether to open `AuthModal` or proceed to `/auth/post-login`. The component never tracks user state for render-time UI decisions. The header at lines 100-105 unconditionally renders:

```tsx
<button className="btn btn-ghost btn-sm" onClick={() => setAuthOpen(true)}>
  Sign in
</button>
```

with no `user ? <SignedIn /> : <SignIn />` guard.

## Fix

`app/page.tsx`:
- Add a `useEffect` (or `useState` populated from a `useEffect`) that subscribes to `supabase.auth.onAuthStateChange()` plus an initial `getUser()`.
- When `user` is set, render the user's email (truncated) + a "Sign out" button instead of the "Sign in" button.
- The sign-out button calls `supabase.auth.signOut()` and pushes `router.refresh()` (or `router.push('/')`).

Keep AuthModal flow intact for the unsigned case.

## Workaround for users hitting this in production

DevTools → Application → Cookies → `seo-geo-audit-tool.vercel.app` → delete every cookie starting with `sb-iimkmrwcdymuyhmeyate-` → hard refresh.


---

**Status:** Fixed in `6e3c9f0`.

Homepage now tracks auth state via supabase.auth.getUser() + onAuthStateChange subscription; renders user email + Sign out button when authenticated, falls back to Sign in button otherwise.
