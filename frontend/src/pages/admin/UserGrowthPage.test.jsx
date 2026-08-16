import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import UserGrowthPage from '@/pages/admin/UserGrowthPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

const GROWTH = {
  totalUsers: 842,
  newUsersToday: 3,
  activeRatio: 61.4,
  retentionRate: 44.9,
  signupLabels: ['Mon', 'Tue', 'Wed'],
  signupCounts: [2, 5, 3],
  channels: [
    { id: 'organic-search', channel: 'Organic Search', newUsers: 120, conversionRate: 12.5, cac: '৳40' },
  ],
};

const USERS = [
  {
    id: 7,
    publicId: 'ab12cd34-ef56',
    fullName: 'Rafi Karim',
    role: 'PLAYER',
    area: 'Dhanmondi',
    email: 'rafi.karim@example.com',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
];

/**
 * The real payload shape. `/admin/users` answers with a paged object, and a
 * mock that returned a bare array let a page which only unwrapped arrays pass
 * here while rendering an empty stream against the running server.
 */
const USERS_PAGE = { data: { items: USERS, total: 1, page: 0, size: 25, totalPages: 1 } };

/** Values the page used to invent whenever the API was slow or unreachable. */
const FABRICATIONS = ['41,270', '+248 Today', '89.4%', '84.2%'];

function renderGrowth(routes) {
  signIn({ id: 2, role: 'ADMIN', fullName: 'Admin One' });
  mockApi(routes);
  renderApp(<UserGrowthPage />, { route: '/admin/users/growth' });
}

describe('Admin UserGrowthPage — no invented growth figures', () => {
  it('shows the numbers the API returned', async () => {
    renderGrowth([
      ['/players/me', { body: {} }],
      ['/admin/analytics/growth', { body: { success: true, data: GROWTH } }],
      ['/admin/users', { body: USERS_PAGE }],
    ]);

    expect(await screen.findByText('842')).toBeInTheDocument();
    expect(screen.getByText('+3 Today')).toBeInTheDocument();
    expect(screen.getByText('61.4%')).toBeInTheDocument();
    expect(screen.getByText('44.9%')).toBeInTheDocument();
    FABRICATIONS.forEach((value) => {
      expect(screen.queryByText(value)).not.toBeInTheDocument();
    });
  });

  it('admits when the return rate could not be measured instead of showing zero', async () => {
    renderGrowth([
      ['/players/me', { body: {} }],
      ['/admin/analytics/growth', { body: { success: true, data: { ...GROWTH, retentionRate: null } } }],
      ['/admin/users', { body: USERS_PAGE }],
    ]);

    await screen.findByText('842');
    expect(screen.getByText(/not enough account history/i)).toBeInTheDocument();
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });

  it('reports a failure instead of falling back to a demo user base', async () => {
    renderGrowth([
      ['/players/me', { body: {} }],
      ['/admin/analytics/growth', { status: 500, body: {} }],
      ['/admin/users', { body: { data: [] } }],
    ]);

    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/live analytics/i)).not.toBeInTheDocument();
    FABRICATIONS.forEach((value) => {
      expect(screen.queryByText(value)).not.toBeInTheDocument();
    });
  });

  it('shows only the acquisition channels the API actually reports', async () => {
    renderGrowth([
      ['/players/me', { body: {} }],
      ['/admin/analytics/growth', { body: { success: true, data: GROWTH } }],
      ['/admin/users', { body: USERS_PAGE }],
    ]);

    // The one channel the API returned is rendered with its own figures...
    expect(await screen.findByText('Organic Search')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    // ...and the rest of the table that used to be hardcoded is not.
    expect(screen.queryByText('Meta/Facebook Ads')).not.toBeInTheDocument();
    expect(screen.queryByText('TikTok Campaigns')).not.toBeInTheDocument();
    expect(screen.queryByText('৳85')).not.toBeInTheDocument();
  });

  it('presents no channel breakdown at all when the platform reports none', async () => {
    renderGrowth([
      ['/players/me', { body: {} }],
      ['/admin/analytics/growth', { body: { success: true, data: { ...GROWTH, channels: [] } } }],
      ['/admin/users', { body: USERS_PAGE }],
    ]);

    await screen.findByText('842');
    expect(screen.queryByText('Organic Search')).not.toBeInTheDocument();
    expect(screen.queryByText('Meta/Facebook Ads')).not.toBeInTheDocument();
    expect(screen.queryByText('Referrals')).not.toBeInTheDocument();
  });

  it('lists real registrations with a real elapsed time, not a scripted stream', async () => {
    renderGrowth([
      ['/players/me', { body: {} }],
      ['/admin/analytics/growth', { body: { success: true, data: GROWTH } }],
      ['/admin/users', { body: USERS_PAGE }],
    ]);

    expect(await screen.findByText('Rafi Karim')).toBeInTheDocument();
    expect(screen.getByText('45 min ago')).toBeInTheDocument();
    // Names that were hardcoded into the "Real-Time Registration Stream".
    expect(screen.queryByText('Riazul Islam')).not.toBeInTheDocument();
    expect(screen.queryByText('Sheikh Turf Arena')).not.toBeInTheDocument();
  });
});
