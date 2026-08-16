import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import RewardsPage from '@/pages/player/RewardsPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

const TIERS = [
  { name: 'BRONZE', minPoints: 0, discountPercent: 0, perks: {} },
  { name: 'SILVER', minPoints: 500, discountPercent: 5, perks: {} },
  { name: 'GOLD', minPoints: 1500, discountPercent: 10, perks: {} },
];

const POINTS = {
  balance: 700,
  walletBalance: 120,
  currentTier: { name: 'SILVER', minPoints: 500, discountPercent: 5, perks: {} },
  nextTier: { name: 'GOLD', minPoints: 1500, discountPercent: 10, perks: {} },
  pointsToNextTier: 800,
  progressPercent: 20,
};

function renderRewards(tiers) {
  signIn({ id: 1, role: 'PLAYER' });
  mockApi([
    ['/players/me', { body: {} }],
    ['/rewards/my-points', { body: { data: POINTS } }],
    ['/rewards/products', { body: { data: [] } }],
    ['/rewards/tiers', { body: { data: tiers } }],
    ['/rewards/activity', { body: { data: [] } }],
  ]);
  renderApp(<RewardsPage />, { route: '/player/rewards' });
}

describe('RewardsPage — the ladder comes from the API', () => {
  it('renders exactly the tiers the API returned', async () => {
    renderRewards(TIERS);

    expect(await screen.findByText('Bronze')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('Gold')).toBeInTheDocument();
    // Platinum was hardcoded into the page; this catalogue does not have it.
    expect(screen.queryByText('Platinum')).not.toBeInTheDocument();
  });

  it('shows each tier’s real threshold and discount', async () => {
    renderRewards(TIERS);

    await screen.findByText('Bronze');
    expect(screen.getByText('500 pts')).toBeInTheDocument();
    expect(screen.getByText('1,500 pts')).toBeInTheDocument();
    expect(screen.getByText('5% off bookings')).toBeInTheDocument();
    expect(screen.getByText('10% off bookings')).toBeInTheDocument();
  });

  it('marks the caller’s real tier as current and the ones above it as locked', async () => {
    renderRewards(TIERS);

    await screen.findByText('Bronze');
    expect(screen.getByText('Current tier')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('follows a changed catalogue instead of a copy baked into the page', async () => {
    renderRewards([
      { name: 'BRONZE', minPoints: 0, discountPercent: 0, perks: {} },
      { name: 'SILVER', minPoints: 900, discountPercent: 7, perks: {} },
      { name: 'GOLD', minPoints: 1500, discountPercent: 10, perks: {} },
    ]);

    await screen.findByText('Bronze');
    expect(screen.getByText('900 pts')).toBeInTheDocument();
    expect(screen.getByText('7% off bookings')).toBeInTheDocument();
    expect(screen.queryByText('500 pts')).not.toBeInTheDocument();
  });
});
