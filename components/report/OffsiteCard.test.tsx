import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OffsiteCard } from './OffsiteCard';

// StatTile is a private function inside OffsiteCard.tsx.
// We test it indirectly via OffsiteCard with controlled data.

describe('StatTile empty-state guard (BUG-002)', () => {
  it('hides unit and note when domain_age is null', () => {
    render(
      <OffsiteCard
        data={{
          domain_age_days: undefined,
        }}
      />
    );
    // domain_age tile renders '—' → its note (e.g. "1095 days") must not appear
    const dayNotes = screen.queryAllByText(/^\d+ days$/);
    expect(dayNotes).toHaveLength(0);
  });

  it('hides unit and note when indexed_pages_estimate is null', () => {
    render(
      <OffsiteCard
        data={{
          indexed_pages_estimate: undefined,
          brand_serp_mentions: undefined,
          domain_age_days: undefined,
          https: undefined,
        }}
      />
    );

    // "Indexed pages" tile: value is '—', note should NOT appear
    expect(screen.queryByText('Google site: query estimate')).toBeNull();
    // "Brand mentions" tile: value is '—', note should NOT appear
    expect(screen.queryByText('Across selected keywords')).toBeNull();
    // "HTTPS" tile: value is '—', note "TLS" should NOT appear
    expect(screen.queryByText('TLS')).toBeNull();
  });

  it('shows unit and note when values are present', () => {
    render(
      <OffsiteCard
        data={{
          indexed_pages_estimate: 500,
          brand_serp_mentions: 3,
          domain_age_days: 1095, // 3 years
          https: true,
        }}
      />
    );

    // "Indexed pages" note should appear
    expect(screen.getByText('Google site: query estimate')).toBeTruthy();
    // "Brand mentions" note should appear
    expect(screen.getByText('Across selected keywords')).toBeTruthy();
    // "HTTPS" note should appear
    expect(screen.getByText('TLS')).toBeTruthy();
    // "Brand mentions" unit
    expect(screen.getByText('SERP')).toBeTruthy();
  });
});
