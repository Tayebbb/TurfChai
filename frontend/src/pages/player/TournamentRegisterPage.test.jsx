import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TournamentRegisterPage from './TournamentRegisterPage';
import { renderRoute, mockApi, signIn } from '@/test/testUtils';

const tournament = {
  id: 1,
  code: 'TR-CUP-0091',
  name: 'Ramadan Cup 2027',
  venueSlug: 'mirpur-sports-city',
  venueName: 'Mirpur Sports City',
  date: '2027-08-21',
  windowStart: '08:00:00',
  windowEnd: '18:00:00',
  format: 'KNOCKOUT',
  teamCapacity: 16,
  entryFeePerTeam: 3500,
  prizePool: 40000,
  privacy: 'OPEN',
  status: 'PUBLISHED',
  teams: [{ id: 1, name: 'Dhanmondi Strikers', entryFeeStatus: 'PAID' }],
  fixtures: [],
  reservations: [],
  costs: { subtotal: 42800, discount: 0, total: 42800, deposit: 17120, balance: 25680 },
};

function mount(overrides = []) {
  return mockApi([
    ...overrides,
    ['/api/v1/tournaments/', { body: tournament }],
    // Anything else this page or its providers ask for. Listed last so the
    // specific routes above still win.
    ['', { body: { id: 1, fullName: 'Test Player', role: 'PLAYER' } }],
  ]);
}

function mountPage(overrides = []) {
  const fetchMock = mount(overrides);
  renderRoute(<TournamentRegisterPage />, {
    path: '/player/tournaments/:code/register',
    route: '/player/tournaments/TR-CUP-0091/register',
  });
  return fetchMock;
}

describe('TournamentRegisterPage', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows the real tournament it is registering for', async () => {
    mountPage();
    expect(await screen.findByText(/ramadan cup 2027/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /register your team/i })).toBeInTheDocument();
  });

  it('refuses to submit without a team name and does not call the API', async () => {
    const fetchMock = mountPage();
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: /register your team/i });
    await user.click(screen.getByRole('button', { name: /confirm registration/i }));

    expect(await screen.findByText(/give your team a name/i)).toBeInTheDocument();

    const registerCalls = fetchMock.mock.calls.filter(
      ([url, init]) => String(url).includes('/register') && init?.method === 'POST',
    );
    expect(registerCalls, 'an invalid form must not reach the server').toHaveLength(0);
  });

  it('submits the team name to the register endpoint', async () => {
    const fetchMock = mountPage([
      ['/register', { body: { id: 5, name: 'Dhanmondi Strikers', entryFeeStatus: 'DUE' } }],
    ]);
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: /register your team/i });
    await user.type(screen.getByLabelText(/team name/i), 'Dhanmondi Strikers');
    await user.click(screen.getByLabelText(/rules/i));
    await user.click(screen.getByRole('button', { name: /confirm registration/i }));

    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(
        ([url, init]) => String(url).includes('/register') && init?.method === 'POST',
      );
      expect(posted, 'a valid form must reach the register endpoint').toBeTruthy();
      expect(JSON.parse(posted[1].body).teamName).toBe('Dhanmondi Strikers');
    });
  });

  it('refuses to submit until the tournament rules are accepted', async () => {
    const fetchMock = mountPage();
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: /register your team/i });
    await user.type(screen.getByLabelText(/team name/i), 'Dhanmondi Strikers');
    await user.click(screen.getByRole('button', { name: /confirm registration/i }));

    expect(await screen.findByText(/must accept the tournament rules/i)).toBeInTheDocument();
    const posted = fetchMock.mock.calls.filter(
      ([url, init]) => String(url).includes('/register') && init?.method === 'POST',
    );
    expect(posted, 'registration must not proceed without accepting the rules').toHaveLength(0);
  });

  it('surfaces a server rejection instead of claiming success', async () => {
    mountPage([['/register', { status: 409, body: { message: 'Tournament is full' } }]]);
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: /register your team/i });
    await user.type(screen.getByLabelText(/team name/i), 'Late Arrivals');
    await user.click(screen.getByRole('button', { name: /confirm registration/i }));

    await waitFor(() => {
      expect(screen.queryByText(/you’re registered/i)).toBeNull();
    });
  });

  it('shows a loading state before the tournament arrives', async () => {
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    globalThis.fetch.mockImplementation(async (input) => {
      if (String(input).includes('/players/me')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ id: 1, role: 'PLAYER' }),
          text: async () => '{}',
        };
      }
      await pending;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => tournament,
        text: async () => JSON.stringify(tournament),
      };
    });

    renderRoute(<TournamentRegisterPage />, {
      path: '/player/tournaments/:code/register',
      route: '/player/tournaments/TR-CUP-0091/register',
    });

    // A pending page must show its shell, and must not show the form yet.
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /register your team/i })).toBeNull();
    expect(screen.queryByLabelText(/team name/i)).toBeNull();

    release();
    expect(await screen.findByRole('heading', { name: /register your team/i })).toBeInTheDocument();
  });
});
