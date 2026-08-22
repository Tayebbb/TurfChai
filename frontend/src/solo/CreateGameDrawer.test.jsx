import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateGameDrawer } from './CreateGameDrawer';
import { renderApp, mockApi, signIn } from '@/test/testUtils';

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowIso = tomorrow.toISOString().split('T')[0];

const bookings = [
  {
    id: 12,
    bookingCode: 'TC-ABC123',
    status: 'CONFIRMED',
    venueId: 7,
    venueName: 'Kick Off Arena',
    venueArea: 'Dhanmondi',
    pitchId: 3,
    pitchName: 'Pitch 1',
    bookingDate: tomorrowIso,
    startTime: '20:00',
    endTime: '21:30',
    amount: 2500,
  },
];

describe('CreateGameDrawer', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows empty state when user has no active bookings', async () => {
    mockApi([
      ['/api/v1/bookings', { body: [] }],
    ]);

    renderApp(<CreateGameDrawer isOpen onClose={() => {}} onCreated={() => {}} />);

    expect(await screen.findByText(/no eligible bookings found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /explore & book venues/i })).toBeInTheDocument();
  });

  it('will not post a game if required fields are missing', async () => {
    const fetchMock = mockApi([
      ['/api/v1/bookings', { body: bookings }],
      ['/api/v1/solo/open-games', { body: { id: 1 } }],
    ]);

    renderApp(<CreateGameDrawer isOpen onClose={() => {}} onCreated={() => {}} />);

    const select = await screen.findByLabelText(/select your booked turf/i);
    expect(select).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /post game/i }));

    expect(await screen.findByText(/pick the booked game you want to host/i)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(0);
  });

  it('sends the booked venue, pitch, times and capacity the API requires', async () => {
    const created = [];
    const fetchMock = mockApi([
      ['/api/v1/solo/open-games', { body: { id: 5, title: 'Friday 7-a-side' } }],
      ['/api/v1/bookings', { body: bookings }],
    ]);

    renderApp(
      <CreateGameDrawer isOpen onClose={() => {}} onCreated={(game) => created.push(game)} />,
    );

    await userEvent.selectOptions(await screen.findByLabelText(/select your booked turf/i), '12');

    // Title auto-suggests or can be typed
    const titleInput = screen.getByLabelText(/game title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Friday 7-a-side');

    await userEvent.clear(screen.getByLabelText(/players needed/i));
    await userEvent.type(screen.getByLabelText(/players needed/i), '10');

    await userEvent.click(screen.getByRole('button', { name: /post game/i }));

    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(
        ([url, init]) => init?.method === 'POST' && String(url).includes('/solo/open-games'),
      );
      expect(posted).toBeTruthy();
      const body = JSON.parse(posted[1].body);
      expect(body.title).toBe('Friday 7-a-side');
      expect(body.venueId).toBe(7);
      expect(body.pitchId).toBe(3);
      expect(body.gameDate).toBe(tomorrowIso);
      expect(body.capacity).toBe(10);
      expect(body.pricePerPlayer).toBe(250);
      expect(body.startTime).toBe('20:00:00');
      expect(body.endTime).toBe('21:30:00');
    });

    await waitFor(() => expect(created).toHaveLength(1));
  });

  it('reports a server refusal instead of claiming the game was posted', async () => {
    mockApi([
      ['/api/v1/solo/open-games', { status: 409, body: { message: 'Slot already has an open game' } }],
      ['/api/v1/bookings', { body: bookings }],
    ]);

    const created = [];
    renderApp(
      <CreateGameDrawer isOpen onClose={() => {}} onCreated={(game) => created.push(game)} />,
    );

    await userEvent.selectOptions(await screen.findByLabelText(/select your booked turf/i), '12');
    await userEvent.click(screen.getByRole('button', { name: /post game/i }));

    expect(await screen.findByText(/slot already has an open game|could not post/i)).toBeInTheDocument();
    expect(created).toHaveLength(0);
  });
});
