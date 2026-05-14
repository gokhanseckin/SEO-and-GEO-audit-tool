/**
 * Regression fixtures.
 *
 * Tier 1 (runs by default):
 *   - Verify the 283ac840 row reached a terminal state (never stuck).
 *
 * Tier 2 (skip by default — set E2E_REAL_RUN=1):
 *   - Submit a real audit on example.com and verify it completes.
 *   - WARNING: costs ~$1-2 of Gemini/Serper quota and takes 3-5 minutes.
 */

import { test, expect } from '@playwright/test';
import { createServiceClient } from './setup/supabase';
import { signInTestUser } from './setup/auth';

// ---------------------------------------------------------------------------
// Tier 1 — fast regression (runs always)
// ---------------------------------------------------------------------------

test('regression: 283ac840 row reached a terminal state (complete or failed)', async () => {
  const sb = createServiceClient();

  // UUID prefix search: PostgREST doesn't support LIKE on uuid columns.
  // Use gte/lte bounds — UUIDs with prefix '283ac840' fall in
  // ['283ac840-0000-0000-0000-000000000000', '283ac840-ffff-ffff-ffff-ffffffffffff'].
  const { data, error } = await sb
    .from('audits')
    .select('id, status')
    .gte('id', '283ac840-0000-0000-0000-000000000000')
    .lte('id', '283ac840-ffff-ffff-ffff-ffffffffffff')
    .limit(1);

  if (error) throw new Error(`DB query failed: ${error.message}`);

  if (!data || data.length === 0) {
    // Row not present — skip rather than fail; the regression is moot if
    // the row was already cleaned up.
    test.skip(true, '283ac840 row not present in DB — skipping regression check');
    return;
  }

  const row = data[0];
  expect(
    ['complete', 'failed'],
    `Expected 283ac840 row to be terminal, got: ${row.status}`,
  ).toContain(row.status);
});

// ---------------------------------------------------------------------------
// Tier 2 — real pipeline (expensive, opt-in)
// ---------------------------------------------------------------------------

test('real pipeline run on example.com (skipped unless E2E_REAL_RUN=1)', async ({
  context,
  page,
}) => {
  if (!process.env.E2E_REAL_RUN) {
    test.skip(true, 'expensive — set E2E_REAL_RUN=1 to run');
    return;
  }

  // Extend timeout for full pipeline (3-5 minutes).
  test.setTimeout(360_000);

  await signInTestUser(context);

  // Submit audit via the UI form.
  await page.goto('/');
  await page.getByRole('textbox').fill('example.com');
  await page.getByRole('button', { name: /audit|analyze|start/i }).click();

  // Should redirect to /report/[id]
  await page.waitForURL(/\/report\/[a-f0-9-]{36}/, { timeout: 30_000 });

  const auditId = page.url().match(/\/report\/([a-f0-9-]{36})/)?.[1];
  if (!auditId) throw new Error('could not extract audit id from URL');

  // Poll DB until status reaches a terminal state.
  const sb = createServiceClient();

  const deadline = Date.now() + 300_000; // 5 min
  let finalStatus = '';
  while (Date.now() < deadline) {
    const { data } = await sb
      .from('audits')
      .select('status')
      .eq('id', auditId)
      .single();
    if (data?.status === 'complete' || data?.status === 'failed') {
      finalStatus = data.status;
      break;
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }

  expect(finalStatus, 'audit did not reach terminal state within 5 min').toBe('complete');

  // Reload and assert all 7 section headings present.
  await page.reload();
  const sectionHeadings = [
    'What is this domain?',
    'Keywords we found',
    'On-site SEO health',
    'Off-site signals',
    'Do LLMs recommend you?',
    'Competitors',
    'Article topics to write',
  ];
  for (const heading of sectionHeadings) {
    await expect(
      page.getByRole('heading', { name: heading, exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  // TODO: see docs/HANDOFF.md for notes on extending this test with PDF export
  // and retry-on-failure validation once those endpoints are fully stable.
});
