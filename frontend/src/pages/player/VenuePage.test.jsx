import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import VenuePage from '@/pages/player/VenuePage';
import { mockApi, renderRoute, signIn } from '@/test/testUtils';

const BASE_VENUE = {
  id: 5,
  slug: 'metro-futsal',
  name: 'Metro Futsal',
  area: 'Gulshan',
  address: 'Gulshan Circle-1',
  rating: 4.5,
  reviewCount: 0,
  verified: true,
  amenities: [],
  photos: [],
  rules: [],
  cancelPolicy: 'FREE_24H_50_6H',
  status: 'LIVE',
  basePrice: 1000,
  openTime: '06:00:00',
  closeTime: '23:00:00',
  pitches: [],
  pricing: [],
};

function renderVenue(venue) {
  signIn({ id: 1, role: 'PLAYER' });
  mockApi([
    ['/players/me', { body: {} }],
    ['/venues/metro-futsal/reviews', { body: { items: [], hasMore: false } }],
    ['/venues/metro-futsal', { body: venue }],
    ['/slots', { body: [] }],
    ['/venues', { body: { items: [] } }],
  ]);
  renderRoute(<VenuePage />, {
    path: '/player/venues/:venueId',
    route: '/player/venues/metro-futsal',
  });
}

describe('VenuePage — venue-specific truth, not a fixed template', () => {
  it('says so when the venue has published no house rules', async () => {
    renderVenue(BASE_VENUE);

    expect(await screen.findByText(/has not published any house rules/i)).toBeInTheDocument();
    // Rules that were previously invented for every venue with none of its own.
    expect(screen.queryByText(/no metal studs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/arrive 10 minutes before/i)).not.toBeInTheDocument();
  });

  it('shows the venue’s own rules when it has them', async () => {
    renderVenue({ ...BASE_VENUE, rules: ['Bibs provided at reception', 'No metal studs'] });

    expect(await screen.findByText('Bibs provided at reception')).toBeInTheDocument();
    expect(screen.queryByText(/has not published any house rules/i)).not.toBeInTheDocument();
  });

  it('renders the standard refund ladder for FREE_24H_50_6H', async () => {
    renderVenue(BASE_VENUE);

    expect(await screen.findByText('Cancel 24h+ before')).toBeInTheDocument();
    expect(screen.getByText('50% refund')).toBeInTheDocument();
  });

  it('renders a different ladder for a strict venue instead of the same table', async () => {
    renderVenue({ ...BASE_VENUE, cancelPolicy: 'STRICT_NO_REFUND' });

    expect(await screen.findByText('Any cancellation')).toBeInTheDocument();
    expect(screen.queryByText('Cancel 24h+ before')).not.toBeInTheDocument();
    expect(screen.queryByText('50% refund')).not.toBeInTheDocument();
  });

  it('renders the six-hour ladder for a flexible venue', async () => {
    renderVenue({ ...BASE_VENUE, cancelPolicy: 'FLEXIBLE_6H' });

    expect(await screen.findByText('Cancel 6h+ before')).toBeInTheDocument();
    expect(screen.queryByText('50% refund')).not.toBeInTheDocument();
  });

  it('counts the parent-review tab from real tags, not a fixed 18', async () => {
    signIn({ id: 1, role: 'PLAYER' });
    mockApi([
      ['/players/me', { body: {} }],
      [
        '/venues/metro-futsal/reviews',
        {
          body: {
            items: [
              { id: 1, authorName: 'A', overallRating: 5, tags: ['verified_booking', 'parent'] },
              { id: 2, authorName: 'B', overallRating: 4, tags: ['verified_booking'] },
            ],
            hasMore: false,
          },
        },
      ],
      ['/venues/metro-futsal', { body: { ...BASE_VENUE, reviewCount: 2 } }],
      ['/slots', { body: [] }],
      ['/venues', { body: { items: [] } }],
    ]);
    renderRoute(<VenuePage />, {
      path: '/player/venues/:venueId',
      route: '/player/venues/metro-futsal',
    });

    expect(await screen.findByText('All (2)')).toBeInTheDocument();
    expect(screen.getByText('Parents (1)')).toBeInTheDocument();
    expect(screen.queryByText('Parents (18)')).not.toBeInTheDocument();
  });
});
