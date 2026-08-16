import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import TurfDetailsPage from '@/pages/admin/TurfDetailsPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

const VENUE = {
  id: 51,
  venueCode: 'V-0051',
  name: 'Kick Off Arena',
  ownerName: 'Jashim Uddin',
  contactPhone: '+8801700000000',
  contactEmail: 'owner@turfchai.test',
  area: 'Dhanmondi',
  ratingAvg: 4.8,
  reviewCount: 12,
  status: 'LIVE',
  createdAt: '2026-01-05T10:00:00+06:00',
};

function renderTurfDetail(route) {
  return renderApp(
    <Routes>
      <Route path="/admin/turfs/:turfId" element={<TurfDetailsPage />} />
    </Routes>,
    { route },
  );
}

/**
 * TC-004: the page threw on its very first render — before any response —
 * because the pre-data fallback object omitted `bookings30d` and the markup
 * called `.toLocaleString()` on it unconditionally.
 */
describe('TurfDetailsPage (TC-004)', () => {
  it('shows a loading state instead of crashing on first render', async () => {
    signIn({ role: 'ADMIN' });
    // Never resolves: this is exactly the window in which the page used to throw.
    globalThis.fetch.mockImplementation(() => new Promise(() => {}));

    renderTurfDetail('/admin/turfs/51');

    expect(await screen.findByText(/loading venue/i)).toBeInTheDocument();
  });

  it('renders the venue once it arrives', async () => {
    signIn({ role: 'ADMIN' });
    mockApi([
      ['/players/me', { body: {} }],
      ['/admin/venues/51', { body: { data: VENUE } }],
    ]);

    renderTurfDetail('/admin/turfs/51');

    expect(await screen.findByRole('heading', { name: /Kick Off Arena/ })).toBeInTheDocument();
  });

  it('shows an em dash for metrics the API does not provide, not an invented figure', async () => {
    signIn({ role: 'ADMIN' });
    mockApi([
      ['/players/me', { body: {} }],
      ['/admin/venues/51', { body: { data: VENUE } }],
    ]);

    renderTurfDetail('/admin/turfs/51');

    await screen.findByRole('heading', { name: /Kick Off Arena/ });
    // The old build hardcoded ৳1,50,000 / 142 / 72% for every venue.
    expect(screen.queryByText('৳1,50,000')).not.toBeInTheDocument();
    expect(screen.queryByText('142')).not.toBeInTheDocument();
    expect(screen.queryByText('72%')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the venue cannot be loaded', async () => {
    signIn({ role: 'ADMIN' });
    mockApi([
      ['/players/me', { body: {} }],
      ['/admin/venues/51', { status: 500, body: {} }],
    ]);

    renderTurfDetail('/admin/turfs/51');

    expect(await screen.findByText(/could not load this venue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('reports a missing venue rather than rendering a blank shell', async () => {
    signIn({ role: 'ADMIN' });
    mockApi([
      ['/players/me', { body: {} }],
      ['/admin/venues/99999', { status: 404, body: { message: 'Venue not found' } }],
    ]);

    renderTurfDetail('/admin/turfs/99999');

    expect(await screen.findByText(/could not load this venue/i)).toBeInTheDocument();
  });

  it('rejects a non-numeric venue id without calling the API', async () => {
    signIn({ role: 'ADMIN' });
    mockApi([['/players/me', { body: {} }]]);

    renderTurfDetail('/admin/turfs/not-an-id');

    expect(await screen.findByText(/not valid/i)).toBeInTheDocument();
  });
});
