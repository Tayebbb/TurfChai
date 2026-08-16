import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import UserSegmentsPage from '@/pages/admin/UserSegmentsPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

const SEGMENTS = {
  totalUsers: 843,
  playerCount: 500,
  hostCount: 200,
  inactiveCount: 143,
  avgLifetimeValueBdt: 4200,
  playerTiers: [],
  hostStatus: [],
  cohorts: [],
};

/**
 * The real payload shape. `/admin/users` answers with a paged object; a page
 * that only unwrapped a bare array rendered an empty regional breakdown
 * against the running server while looking fine against an array mock.
 */
const USERS_PAGE = {
  data: {
    items: [
      { id: 1, fullName: 'A One', role: 'PLAYER', area: 'Dhanmondi', createdAt: new Date().toISOString() },
      { id: 2, fullName: 'B Two', role: 'PLAYER', area: 'Dhanmondi', createdAt: new Date().toISOString() },
      { id: 3, fullName: 'C Three', role: 'HOST', area: 'Banani', createdAt: new Date().toISOString() },
      { id: 4, fullName: 'Admin', role: 'ADMIN', area: 'Gulshan', createdAt: new Date().toISOString() },
    ],
    total: 4,
    page: 0,
    size: 100,
    totalPages: 1,
  },
};

function renderSegments(routes) {
  signIn({ id: 2, role: 'ADMIN', fullName: 'Admin One' });
  mockApi(routes);
  renderApp(<UserSegmentsPage />, { route: '/admin/users/segments' });
}

describe('Admin UserSegmentsPage', () => {
  it('breaks regions down from the accounts the API actually returned', async () => {
    renderSegments([
      ['/players/me', { body: {} }],
      ['/admin/analytics/segments', { body: { success: true, data: SEGMENTS } }],
      ['/admin/users', { body: USERS_PAGE }],
    ]);

    // Two players in Dhanmondi and one host in Banani, admins excluded, so the
    // shares are 66.7% and 33.3% of the three non-admin accounts.
    expect(await screen.findByText('Dhanmondi')).toBeInTheDocument();
    expect(screen.getByText('Banani')).toBeInTheDocument();
    expect(screen.getByText(/2 · 66\.7%/)).toBeInTheDocument();
    expect(screen.getByText(/1 · 33\.3%/)).toBeInTheDocument();
    expect(screen.queryByText('Gulshan')).not.toBeInTheDocument();
  });

  it('says the regional split is a sample rather than implying the whole platform', async () => {
    renderSegments([
      ['/players/me', { body: {} }],
      ['/admin/analytics/segments', { body: { success: true, data: SEGMENTS } }],
      ['/admin/users', { body: USERS_PAGE }],
    ]);

    expect(await screen.findByText(/not of the whole platform/i)).toBeInTheDocument();
  });

  it('shows no regions at all when the roster comes back empty', async () => {
    renderSegments([
      ['/players/me', { body: {} }],
      ['/admin/analytics/segments', { body: { success: true, data: SEGMENTS } }],
      ['/admin/users', { body: { data: { items: [], total: 0, page: 0, size: 100, totalPages: 0 } } }],
    ]);

    await screen.findByText(/Regional Distribution/i);
    expect(screen.queryByText('Dhanmondi')).not.toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });
});
