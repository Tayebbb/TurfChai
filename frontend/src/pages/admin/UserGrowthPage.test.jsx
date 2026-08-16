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
};

const USERS = [
  {
    id: 7,
    publicId: 'ab12cd34-ef56',
    fullName: 'Rafi Karim',
    role: 'PLAYER',
    area: 'Dhanmondi',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
];

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
      ['/admin/analytics/growth', { body: { data: GROWTH } }],
      ['/admin/users', { body: { data: USERS } }],
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
      ['/admin/analytics/growth', { body: { data: { ...GROWTH, retentionRate: null } } }],
      ['/admin/users', { body: { data: USERS } }],
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

    expect(await screen.findByText(/could not load growth metrics/i)).toBeInTheDocument();
    FABRICATIONS.forEach((value) => {
      expect(screen.queryByText(value)).not.toBeInTheDocument();
    });
  });

  it('does not present an acquisition-channel breakdown the platform never records', async () => {
    renderGrowth([
      ['/players/me', { body: {} }],
      ['/admin/analytics/growth', { body: { data: GROWTH } }],
      ['/admin/users', { body: { data: USERS } }],
    ]);

    await screen.findByText('842');
    expect(screen.getByText(/not tracked yet/i)).toBeInTheDocument();
    // The invented channel table and its costs-per-acquisition.
    expect(screen.queryByText('Meta/Facebook Ads')).not.toBeInTheDocument();
    expect(screen.queryByText('Organic Search')).not.toBeInTheDocument();
    expect(screen.queryByText('৳85')).not.toBeInTheDocument();
  });

  it('lists real registrations with a real elapsed time, not a scripted stream', async () => {
    renderGrowth([
      ['/players/me', { body: {} }],
      ['/admin/analytics/growth', { body: { data: GROWTH } }],
      ['/admin/users', { body: { data: USERS } }],
    ]);

    expect(await screen.findByText('Rafi Karim')).toBeInTheDocument();
    expect(screen.getByText('45 mins ago')).toBeInTheDocument();
    // Names that were hardcoded into the "Real-Time Registration Stream".
    expect(screen.queryByText('Riazul Islam')).not.toBeInTheDocument();
    expect(screen.queryByText('Sheikh Turf Arena')).not.toBeInTheDocument();
  });
});
