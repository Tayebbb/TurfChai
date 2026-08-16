import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewPage from '@/pages/player/ReviewPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

const BOOKING = {
  id: 88,
  bookingCode: 'BK-0088',
  userId: 1,
  venueId: 7,
  venueName: 'Kick Off Arena',
  venueSlug: 'kick-off-arena',
  pitchName: 'Pitch 1',
  bookingDate: '2026-01-10',
  startTime: '19:00:00',
  endTime: '20:00:00',
  status: 'COMPLETED',
};

/** The page reads its subject from `?bookingId=`, so the query has to be real. */
function renderReview(routes) {
  signIn({ id: 1, role: 'PLAYER' });
  const fetchMock = mockApi(routes);
  renderApp(<ReviewPage />, { route: '/player/review?bookingId=88' });
  return fetchMock;
}

/** The single POST body the page sent, parsed. */
function submittedReview(fetchMock) {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => String(url).includes('/reviews') && init?.method === 'POST',
  );
  return call ? JSON.parse(call[1].body) : null;
}

describe('ReviewPage — submitting a review', () => {
  it('refuses to submit until an overall rating is given, and sends nothing', async () => {
    const fetchMock = renderReview([
      ['/players/me', { body: {} }],
      ['/bookings/88', { body: BOOKING }],
    ]);

    const submit = await screen.findByRole('button', { name: /submit review/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/give an overall rating to submit/i)).toBeInTheDocument();

    await userEvent.click(submit);

    expect(submittedReview(fetchMock)).toBeNull();
  });

  it('posts the rating, the comment and only the categories actually rated', async () => {
    const fetchMock = renderReview([
      ['/players/me', { body: {} }],
      ['/bookings/88', { body: BOOKING }],
      ['/reviews', { body: { id: 501 } }],
    ]);

    await screen.findByRole('button', { name: /submit review/i });

    const overall = within('Overall rating');
    await userEvent.click(overall[4]); // 5 stars
    const surface = within('Surface rating');
    await userEvent.click(surface[2]); // 3 stars

    await userEvent.type(
      screen.getByLabelText(/your review/i),
      'Lights were bright and the turf was in good shape.',
    );

    await userEvent.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() => expect(submittedReview(fetchMock)).not.toBeNull());
    const sent = submittedReview(fetchMock);

    expect(sent.bookingId).toBe(88);
    expect(sent.venueId).toBe(7);
    expect(sent.overallRating).toBe(5);
    expect(sent.comment).toContain('Lights were bright');
    // Unrated categories are omitted rather than sent as a zero.
    expect(sent.subRatings).toEqual({ surface: 3 });
  });

  it('confirms publication only after the API accepts it', async () => {
    renderReview([
      ['/players/me', { body: {} }],
      ['/bookings/88', { body: BOOKING }],
      ['/reviews', { body: { id: 501 } }],
    ]);

    await screen.findByRole('button', { name: /submit review/i });
    await userEvent.click(within('Overall rating')[3]);

    expect(screen.queryByText(/review published/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /submit review/i }));

    expect(await screen.findByText(/review published/i)).toBeInTheDocument();
  });

  it('does not claim success when the server rejects a duplicate review', async () => {
    renderReview([
      ['/players/me', { body: {} }],
      ['/bookings/88', { body: BOOKING }],
      ['/reviews', { status: 409, body: { message: 'You have already reviewed this booking' } }],
    ]);

    await screen.findByRole('button', { name: /submit review/i });
    await userEvent.click(within('Overall rating')[4]);
    await userEvent.click(screen.getByRole('button', { name: /submit review/i }));

    expect(await screen.findByText(/already reviewed this booking/i)).toBeInTheDocument();
    expect(screen.queryByText(/review published/i)).not.toBeInTheDocument();
  });

  it('offers a sign-in route instead of a form when the booking is not readable', async () => {
    renderReview([
      ['/players/me', { body: {} }],
      ['/bookings/88', { status: 401, body: { message: 'Unauthorized' } }],
    ]);

    expect(await screen.findByText(/sign in to review this match/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit review/i })).not.toBeInTheDocument();
  });
});

/** The star buttons of one category row, in ascending order. */
function within(groupLabel) {
  const group = screen.getByRole('radiogroup', { name: groupLabel });
  return Array.from(group.querySelectorAll('button'));
}
