import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateGameDrawer } from './CreateGameDrawer';
import { renderApp, mockApi, signIn } from '@/test/testUtils';

const venues = {
  items: [
    { id: 7, name: 'Kick Off Arena', area: 'Dhanmondi', slug: 'kick-off-arena' },
  ],
};

describe('CreateGameDrawer', () => {
  beforeEach(() => {
    signIn();
  });

  it('will not post a game that the server would reject', async () => {
    const fetchMock = mockApi([
      ['/api/v1/venues', { body: venues }],
      ['/api/v1/solo/open-games', { body: { id: 1 } }],
    ]);

    renderApp(<CreateGameDrawer isOpen onClose={() => {}} onCreated={() => {}} />);

    await userEvent.click(await screen.findByRole('button', { name: /post game/i }));

    // Required fields are enforced in the browser, so no request is made.
    expect(await screen.findByText(/give your game a title/i)).toBeInTheDocument();
    expect(screen.getByText(/pick the venue you booked/i)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(0);
  });

  it('sends the venue, times and capacity the API requires', async () => {
    const created = [];
    const fetchMock = mockApi([
      ['/api/v1/solo/open-games', { body: { id: 5, title: 'Friday 7-a-side' } }],
      ['/api/v1/venues/kick-off-arena', { body: { pitches: [{ id: 3, name: 'Pitch 1' }] } }],
      ['/api/v1/venues', { body: venues }],
    ]);

    renderApp(
      <CreateGameDrawer isOpen onClose={() => {}} onCreated={(game) => created.push(game)} />,
    );

    await userEvent.type(await screen.findByLabelText(/game title/i), 'Friday 7-a-side');
    await userEvent.selectOptions(await screen.findByLabelText(/^venue$/i), '7');
    await userEvent.clear(screen.getByLabelText(/players needed/i));
    await userEvent.type(screen.getByLabelText(/players needed/i), '10');
    await userEvent.type(screen.getByLabelText(/price per player/i), '250');

    await userEvent.click(screen.getByRole('button', { name: /post game/i }));

    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(
        ([url, init]) => init?.method === 'POST' && String(url).includes('/solo/open-games'),
      );
      expect(posted).toBeTruthy();
      const body = JSON.parse(posted[1].body);
      expect(body.title).toBe('Friday 7-a-side');
      expect(body.venueId).toBe(7);
      expect(body.capacity).toBe(10);
      expect(body.pricePerPlayer).toBe(250);
      expect(body.startTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(body.endTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      // The organiser is taken from the JWT; sending one would be ignored.
      expect(body.organizerUserId).toBeUndefined();
    });

    await waitFor(() => expect(created).toHaveLength(1));
  });

  it('reports a server refusal instead of claiming the game was posted', async () => {
    mockApi([
      ['/api/v1/solo/open-games', { status: 409, body: { message: 'Venue not found' } }],
      ['/api/v1/venues', { body: venues }],
    ]);

    const created = [];
    renderApp(
      <CreateGameDrawer isOpen onClose={() => {}} onCreated={(game) => created.push(game)} />,
    );

    await userEvent.type(await screen.findByLabelText(/game title/i), 'Doomed game');
    await userEvent.selectOptions(await screen.findByLabelText(/^venue$/i), '7');
    await userEvent.type(screen.getByLabelText(/price per player/i), '250');
    await userEvent.click(screen.getByRole('button', { name: /post game/i }));

    expect(await screen.findByText(/venue not found|could not post/i)).toBeInTheDocument();
    expect(created).toHaveLength(0);
  });
});
