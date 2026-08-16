import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewsPage from './ReviewsPage';
import { renderApp, mockApi, signIn } from '@/test/testUtils';

const summary = (overrides = {}) => ({
  venueSlug: 'kick-off-arena',
  averageRating: '4.5',
  totalReviews: 1,
  ratingBreakdown: [],
  categoryAverages: [],
  items: [
    {
      id: 101,
      author: 'Rahim Ahmed',
      initials: 'RA',
      rating: 4,
      text: 'Good turf.',
      needsResponse: true,
      response: '',
      ...overrides,
    },
  ],
});

describe('owner ReviewsPage', () => {
  beforeEach(() => {
    signIn({ role: 'OWNER', fullName: 'Owner One' });
  });

  it('cannot publish an empty response', async () => {
    mockApi([['/api/v1/owner/reviews', { body: summary() }]]);
    renderApp(<ReviewsPage />);

    const button = await screen.findByRole('button', { name: /publish response/i });
    expect(button).toBeDisabled();
  });

  it('sends the typed response to the backend and only then reports success', async () => {
    const fetchMock = mockApi([['/api/v1/owner/reviews', { body: summary() }]]);
    renderApp(<ReviewsPage />);

    const box = await screen.findByLabelText(/your response/i);
    await userEvent.type(box, 'Thanks for playing!');
    await userEvent.click(screen.getByRole('button', { name: /publish response/i }));

    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(posted).toBeTruthy();
      expect(posted[0]).toContain('/api/v1/owner/reviews/101/response');
      expect(JSON.parse(posted[1].body)).toEqual({ response: 'Thanks for playing!' });
    });

    expect(await screen.findByText(/response published/i)).toBeInTheDocument();
  });

  it('reports the failure instead of claiming the response was published', async () => {
    mockApi([
      ['/api/v1/owner/reviews/101/response', { status: 500, body: { message: 'boom' } }],
      ['/api/v1/owner/reviews', { body: summary() }],
    ]);
    renderApp(<ReviewsPage />);

    const box = await screen.findByLabelText(/your response/i);
    await userEvent.type(box, 'Thanks!');
    await userEvent.click(screen.getByRole('button', { name: /publish response/i }));

    expect(await screen.findByText(/could not publish your response/i)).toBeInTheDocument();
    expect(screen.queryByText(/response published/i)).not.toBeInTheDocument();
  });

  it('shows an already-published response instead of the editor', async () => {
    mockApi([
      ['/api/v1/owner/reviews', { body: summary({ needsResponse: false, response: 'Cheers!' }) }],
    ]);
    renderApp(<ReviewsPage />);

    expect(await screen.findByText(/your response/i)).toBeInTheDocument();
    expect(screen.getByText(/cheers!/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish response/i })).not.toBeInTheDocument();
  });
});
