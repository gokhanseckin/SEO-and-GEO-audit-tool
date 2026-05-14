import type { BrowserContext } from '@playwright/test';
import { createServiceClient } from './supabase';

/**
 * Signs in the test user by injecting a Supabase session into the browser context.
 *
 * Auth flow:
 *   1. Admin API generates a magic link (implicit flow — returns tokens in fragment).
 *   2. We follow the link server-side (Node fetch) to extract access_token + refresh_token.
 *   3. We POST the tokens to /api/e2e-auth (a dev-only Next.js route) which calls
 *      supabase.auth.setSession() server-side, causing @supabase/ssr to write the
 *      correct httpOnly session cookies into the browser context's response.
 *   4. Playwright picks up the Set-Cookie headers → subsequent pages are authenticated.
 *
 * After this call the browser context carries valid auth cookies for the test user.
 */
export async function signInTestUser(
  ctx: BrowserContext,
  email = 'gokhanseckin@gmail.com',
) {
  const sb = createServiceClient();
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

  // 1. Generate magic link.
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${baseURL}/auth/callback` },
  });
  if (error || !data) throw new Error(`generateLink failed: ${error?.message}`);

  const actionLink = data.properties?.action_link;
  if (!actionLink) throw new Error('no action_link in generateLink response');

  // 2. Follow the Supabase verify redirect server-side to extract fragment tokens.
  //    The verify endpoint returns 303 → <redirectTo>#access_token=...&refresh_token=...
  const resp = await fetch(actionLink, { redirect: 'manual' });
  const location = resp.headers.get('location');
  if (!location) throw new Error(`no Location header from verify endpoint (status ${resp.status})`);

  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  const hashIdx = location.indexOf('#');
  if (hashIdx !== -1) {
    const params = new URLSearchParams(location.slice(hashIdx + 1));
    accessToken = params.get('access_token');
    refreshToken = params.get('refresh_token');
  }
  if (!accessToken || !refreshToken) {
    throw new Error(`Could not extract tokens from redirect: ${location.slice(0, 200)}`);
  }

  // 3. POST tokens to the dev-only e2e-auth route via the browser context so the
  //    Set-Cookie response headers land in ctx's cookie jar.
  const page = await ctx.newPage();
  await page.goto(baseURL); // Establish context origin

  // Use fetch inside the browser page — cookies in the response will be stored.
  const result = await page.evaluate(
    async ({ url, body }: { url: string; body: string }) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        credentials: 'include',
      });
      return { ok: r.ok, status: r.status, text: await r.text() };
    },
    {
      url: `${baseURL}/api/e2e-auth`,
      body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
    },
  );

  if (!result.ok) {
    throw new Error(`e2e-auth route failed (${result.status}): ${result.text}`);
  }

  await page.close();
}
