import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from '@/pages/admin/UsersPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

function user(id) {
  return {
    id,
    fullName: `Person ${id}`,
    phone: `+88017000000${id}`,
    role: 'PLAYER',
    status: 'ACTIVE',
    reliabilityScore: 90,
    gamesAttended: 3,
    createdAt: '2026-01-05T10:00:00+06:00',
  };
}

const PAGE_ONE = {
  data: {
    items: Array.from({ length: 25 }, (_, i) => user(i + 1)),
    total: 842,
    page: 0,
    size: 25,
    totalPages: 34,
  },
};

function renderUsers() {
  signIn({ id: 2, role: 'ADMIN', fullName: 'Admin One' });
  const fetchMock = mockApi([
    ['/api/v1/me', { body: { id: 2, fullName: 'Admin One', role: 'ADMIN' } }],
    ['/admin/users', { body: PAGE_ONE }],
  ]);
  renderApp(<UsersPage />, { route: '/admin/users' });
  return fetchMock;
}

function rosterCalls(fetchMock) {
  return fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/admin/users'));
}

/**
 * TC-014: the roster arrived whole — 842 accounts, 421 KB, ~17k DOM nodes —
 * and refetched on every keystroke.
 */
describe('Admin UsersPage — paged roster', () => {
  it('asks for one page, not the whole roster', async () => {
    const fetchMock = renderUsers();

    await screen.findByText('Person 1');
    const [url] = rosterCalls(fetchMock);
    expect(url).toContain('page=0');
    expect(url).toContain('size=25');
  });

  it('renders only the rows on this page and reports the real total', async () => {
    renderUsers();

    await screen.findByText('Person 1');
    expect(screen.getAllByRole('row').length).toBeLessThan(30);
    expect(screen.getByText(/Showing 25 of 842 accounts/)).toBeInTheDocument();
  });

  it('advances the page rather than growing the list', async () => {
    const fetchMock = renderUsers();

    await screen.findByText('Person 1');
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));

    await waitFor(() => {
      expect(rosterCalls(fetchMock).some((u) => u.includes('page=1'))).toBe(true);
    });
  });

  it('debounces the search instead of querying per keystroke', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = renderUsers();
    await screen.findByText('Person 1');
    const before = rosterCalls(fetchMock).length;

    const box = screen.getByLabelText('Search name, phone, ID');
    await userEvent.type(box, 'rahman');

    // Typed six characters; nothing new should have been requested yet.
    expect(rosterCalls(fetchMock).length).toBe(before);

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => {
      expect(rosterCalls(fetchMock).some((u) => u.includes('q=rahman'))).toBe(true);
    });
    const searchCalls = rosterCalls(fetchMock).filter((u) => u.includes('q='));
    expect(searchCalls.length).toBeLessThanOrEqual(2);
    vi.useRealTimers();
  });

  /** The dialog rendered `<Overlay>` without `isOpen`, so it always returned null. */
  it('opens the edit dialog when Edit Profile is pressed', async () => {
    renderUsers();

    await screen.findByText('Person 1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Edit Profile' })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByDisplayValue('Person 1')).toBeInTheDocument();
  });

  it('gives the scrolling table keyboard access', async () => {
    renderUsers();

    await screen.findByText('Person 1');
    const region = screen.getByRole('region', { name: 'User accounts' });
    expect(region).toHaveAttribute('tabindex', '0');
  });
});
