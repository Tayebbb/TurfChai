import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequestReviewPage from '@/pages/admin/RequestReviewPage';
import { mockApi, renderRoute, signIn } from '@/test/testUtils';

const REQUEST = {
  id: 12,
  requestCode: 'TR-0012',
  venueName: 'Riverside Turf',
  area: 'Mohammadpur',
  pitchCount: 2,
  sportsCsv: 'Football',
  status: 'PENDING',
  ownerUserId: 44,
  ownerEmail: 'owner44@turfchai.test',
  ownerPhone: '+8801700000044',
  docTradeLicense: 'VERIFIED',
  docOwnerNid: 'PENDING',
  docUtilityBill: 'PENDING',
  createdAt: '2026-01-02T09:00:00+06:00',
};

/**
 * The page is keyed by the request *code*, not the numeric id, so it has to be
 * mounted under the real route pattern for `useParams()` to resolve.
 */
function renderRequestReview(routes) {
  signIn({ id: 2, role: 'ADMIN' });
  const fetchMock = mockApi(routes);
  renderRoute(<RequestReviewPage />, {
    path: '/admin/turf-requests/:requestId',
    route: '/admin/turf-requests/TR-0012',
  });
  return fetchMock;
}

/** Every review write, as `[url, body]` pairs. */
function reviewCalls(fetchMock) {
  return fetchMock.mock.calls
    .filter(([url, init]) => init?.method === 'POST' && String(url).includes('/review'))
    .map(([url, init]) => [String(url), init.body ? JSON.parse(init.body) : null]);
}

describe('Admin RequestReviewPage — approving and rejecting', () => {
  it('shows the submission the API returned before offering any decision', async () => {
    renderRequestReview([
      ['/players/me', { body: {} }],
      ['/admin/turf-requests/TR-0012', { body: REQUEST }],
    ]);

    expect(
      await screen.findByRole('heading', { name: /Riverside Turf \(TR-0012\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Mohammadpur')).toBeInTheDocument();
    expect(screen.getByText('2 Pitches')).toBeInTheDocument();
  });

  it('approving posts APPROVE to the request code', async () => {
    const fetchMock = renderRequestReview([
      ['/players/me', { body: {} }],
      ['/admin/turf-requests/TR-0012/review', { body: { status: 'APPROVED' } }],
      ['/admin/turf-requests/TR-0012', { body: REQUEST }],
    ]);

    await screen.findByRole('heading', { name: /Riverside Turf/ });
    await userEvent.click(screen.getByRole('button', { name: /approve request/i }));

    await waitFor(() => expect(reviewCalls(fetchMock)).toHaveLength(1));
    const [url, body] = reviewCalls(fetchMock)[0];
    expect(url).toContain('/admin/turf-requests/TR-0012/review');
    expect(body).toMatchObject({ action: 'APPROVE' });
  });

  it('rejecting sends the reason the admin typed, not an empty note', async () => {
    const fetchMock = renderRequestReview([
      ['/players/me', { body: {} }],
      ['/admin/turf-requests/TR-0012/review', { body: { status: 'REJECTED' } }],
      ['/admin/turf-requests/TR-0012', { body: REQUEST }],
    ]);

    await screen.findByRole('heading', { name: /Riverside Turf/ });
    await userEvent.click(screen.getByRole('button', { name: /reject request/i }));

    await userEvent.type(
      await screen.findByLabelText(/rejection reason/i),
      'Trade license expired',
    );
    await userEvent.click(screen.getByRole('button', { name: /confirm rejection/i }));

    await waitFor(() => expect(reviewCalls(fetchMock)).toHaveLength(1));
    expect(reviewCalls(fetchMock)[0][1]).toMatchObject({
      action: 'REJECT',
      note: 'Trade license expired',
    });
  });

  it('does not announce an approval the server refused', async () => {
    renderRequestReview([
      ['/players/me', { body: {} }],
      [
        '/admin/turf-requests/TR-0012/review',
        { status: 409, body: { message: 'This request has already been reviewed' } },
      ],
      ['/admin/turf-requests/TR-0012', { body: REQUEST }],
    ]);

    await screen.findByRole('heading', { name: /Riverside Turf/ });
    await userEvent.click(screen.getByRole('button', { name: /approve request/i }));

    expect(await screen.findByText(/already been reviewed/i)).toBeInTheDocument();
    expect(screen.queryByText(/approved! Venue is now live/i)).not.toBeInTheDocument();
  });

  it('surfaces a load failure instead of rendering decision buttons on nothing', async () => {
    renderRequestReview([
      ['/players/me', { body: {} }],
      ['/admin/turf-requests/TR-0012', { status: 500, body: { message: 'ORA-00942: table missing' } }],
    ]);

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    // A 500 must not leak the server's own wording to an operator screen.
    expect(screen.queryByText(/ORA-00942/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve request/i })).not.toBeInTheDocument();
  });
});
