/**
 * Tier 1 — Fast happy path (runs by default, <10s, no real pipeline).
 *
 * Strategy:
 *   1. Pre-seed a fully-completed audit row via Supabase service-role.
 *   2. Sign in as the admin test user via magic link.
 *   3. Navigate to /report/[id] and assert all 7 sections render.
 *   4. Clean up the seeded row in a finally block.
 */

import { test, expect } from '@playwright/test';
import { createServiceClient } from './setup/supabase';
import { signInTestUser } from './setup/auth';

// Minimal but structurally valid section payloads.
const PRESEEDED_SECTIONS = {
  description: { blurb: 'Test fixture — pre-seeded audit for e2e.' },
  onsite: {
    pages_crawled: [{ url: 'https://example.com', text_content: '', robots_meta: '' }],
    issues: [],
  },
  offsite: { domain_authority: 50, backlinks: 100 },
  geo: { score: 4, results: [] },
  competitors: { serp: [], enriched: [] },
  article_recommendations: {
    recommendations: [{ title: 'Sample rec', priority: 'high' }],
    citations: [],
  },
  keywords: { selected: ['e2e-test'], candidates: [] },
};

// The 7 section headings as rendered by each card component.
// NOTE: Some h2 headings contain sibling <span> tags (e.g. GeoTable has "GEO · NEW").
// Use getByRole('heading') with partial name to avoid exact-match failures.
const SECTION_HEADINGS = [
  'What is this domain?',
  'Keywords we found',
  'On-site SEO health',
  'Off-site signals',
  'Do LLMs recommend you?',
  'Competitors',
  'Article topics to write',
];

test('happy path: pre-seeded audit renders all 7 sections', async ({ context }) => {
  const sb = createServiceClient();

  // Resolve the test user — must exist in auth.users and public.profiles.
  const {
    data: { users },
  } = await sb.auth.admin.listUsers();
  const user = users.find((u) => u.email === 'gokhanseckin@gmail.com');
  if (!user) throw new Error('admin user not found in auth.users');

  // Insert audit. FK references profiles(id) so the profile must exist already
  // (auto-created via DB trigger on first auth.users insert).
  const { data: audit, error: insertError } = await sb
    .from('audits')
    .insert({
      user_id: user.id,
      domain: 'e2e-happy.test',
      status: 'complete',
      sections: PRESEEDED_SECTIONS,
      serper_query_cap: 0,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError || !audit) {
    throw new Error(`failed to seed audit: ${insertError?.message}`);
  }

  try {
    // Sign in via magic link → sets auth cookies on the browser context.
    await signInTestUser(context);

    const page = await context.newPage();
    await page.goto(`/report/${audit.id}`);

    // Assert every section heading is visible.
    // Use getByRole('heading') with partial name to tolerate sibling <span> tags
    // inside the <h2> (e.g. GeoTable has a "GEO · NEW" chip alongside its title).
    for (const heading of SECTION_HEADINGS) {
      await expect(
        page.getByRole('heading', { name: heading, exact: false }).first(),
      ).toBeVisible({ timeout: 10_000 });
    }

    await page.close();
  } finally {
    // Always clean up — don't leave test rows in production DB.
    await sb.from('audits').delete().eq('id', audit.id);
  }
});
