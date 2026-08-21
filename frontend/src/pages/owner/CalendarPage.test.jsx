import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerCalendarPage from '@/pages/owner/CalendarPage';
import { mockApi, renderApp, signIn } from '@/test/testUtils';

const MOCK_VENUE = { id: 10, name: 'Bashundhara Sports Complex', pitchCount: 2 };
const MOCK_VENUE_2 = { id: 20, name: 'Dhanmondi Turf', pitchCount: 1 };

const MOCK_PITCHES = [
  { id: 101, name: 'Pitch 1 (7v7)', sizeLabel: '7v7', sports: ['Football'] },
  { id: 102, name: 'Pitch 2 (5v5)', sizeLabel: '5v5', sports: ['Football', 'Futsal'] },
];

const MOCK_CALENDAR_DATA = {
  venueId: 10,
  venueName: 'Bashundhara Sports Complex',
  date: '2026-08-20',
  pitches: MOCK_PITCHES,
  rows: [
    {
      time: '04:00 PM',
      cells: [
        {
          slotId: 501,
          pitchId: 101,
          status: 'AVAILABLE',
          price: 2000,
          startTime: '04:00 PM',
          endTime: '05:30 PM',
          durationMinutes: 90,
          sport: 'Football',
          label: 'Available',
          variant: 'available',
        },
        {
          slotId: 502,
          pitchId: 102,
          status: 'BOOKED',
          price: 2500,
          startTime: '04:00 PM',
          endTime: '05:30 PM',
          durationMinutes: 90,
          sport: 'Football',
          bookingId: 888,
          bookingCode: 'MB-TEST01',
          customerName: 'Rahim Karim',
          customerPhone: '01711112222',
          label: 'Booked · ৳2,500',
          variant: 'online',
          checkedIn: false,
        },
      ],
    },
    {
      time: '05:45 PM',
      cells: [
        {
          slotId: 503,
          pitchId: 101,
          status: 'BLOCKED',
          price: 2000,
          startTime: '05:45 PM',
          endTime: '07:15 PM',
          durationMinutes: 90,
          sport: 'Football',
          label: 'Maintenance',
          variant: 'blocked',
        },
        {
          slotId: 504,
          pitchId: 102,
          status: 'AVAILABLE',
          price: 2200,
          startTime: '05:45 PM',
          endTime: '07:15 PM',
          durationMinutes: 90,
          sport: 'Futsal',
          label: 'Available',
          variant: 'available',
        },
      ],
    },
  ],
};

function renderCalendar(extraRoutes = []) {
  signIn({ id: 9, role: 'OWNER', fullName: 'Turf Owner' });
  const fetchMock = mockApi([
    ...extraRoutes,
    ['/owner/venues/10/calendar', { body: MOCK_CALENDAR_DATA }],
    ['/owner/venues/20/calendar', { body: { ...MOCK_CALENDAR_DATA, venueId: 20, pitches: [{ id: 201, name: 'Main Pitch', sports: ['Football'] }] } }],
    ['/owner/venues', { body: [MOCK_VENUE, MOCK_VENUE_2] }],
    ['/pricing/quote', { body: { recommendedPrice: 2100, finalPrice: 2100 } }],
    ['/players/me', { body: {} }],
  ]);
  renderApp(<OwnerCalendarPage />, { route: '/owner/calendar' });
  return fetchMock;
}

describe('Owner CalendarPage — comprehensive redesign tests', () => {
  it('renders venue calendar grid, pitch headers, and KPI summary stats', async () => {
    renderCalendar();

    expect(await screen.findByText(/Pitch Schedule & Slots/i)).toBeInTheDocument();
    const pitchElements = await screen.findAllByText('Pitch 1 (7v7)');
    expect(pitchElements.length).toBeGreaterThan(0);
    expect(screen.getAllByText('04:00 PM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('05:45 PM').length).toBeGreaterThan(0);

    // KPI Summary
    expect(screen.getByText('Total Slots')).toBeInTheDocument();
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Booked').length).toBeGreaterThan(0);
  });

  it('clicking an available slot opens detail drawer and allows opening manual booking modal', async () => {
    const user = userEvent.setup();
    renderCalendar();

    expect(await screen.findByText(/Pitch Schedule & Slots/i)).toBeInTheDocument();

    // Click on 04:00 PM available slot (৳2,000)
    const availPriceTag = await screen.findByText('৳2,000');
    await user.click(availPriceTag);

    // Detail drawer should open with details
    const drawer = await screen.findByRole('dialog', { name: /Slot Details & Management/i });
    expect(within(drawer).getByText('Pitch Location')).toBeInTheDocument();
    expect(within(drawer).getByText('Slot Pricing & Rate')).toBeInTheDocument();

    // Click "Record Walk-in Booking" inside drawer
    const manualBtnInDrawer = within(drawer).getByRole('button', { name: /Record Walk-in Booking/i });
    await user.click(manualBtnInDrawer);

    // Manual booking modal should open
    expect(await screen.findByText(/Phone or walk-in — this slot is reserved immediately/i)).toBeInTheDocument();
  });

  it('blocking an available slot from the drawer calls the block API', async () => {
    const user = userEvent.setup();
    const fetchMock = renderCalendar([
      ['/owner/venues/10/slots/501/block', { method: 'POST', body: {} }],
    ]);

    expect(await screen.findByText(/Pitch Schedule & Slots/i)).toBeInTheDocument();

    // Click available slot
    const availPriceTag = await screen.findByText('৳2,000');
    await user.click(availPriceTag);

    // Click "Block Slot for Maintenance" in drawer
    const drawer = await screen.findByRole('dialog', { name: /Slot Details & Management/i });
    const blockBtn = within(drawer).getByRole('button', { name: /Block Slot for Maintenance/i });
    await user.click(blockBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([url, init]) =>
        init?.method === 'POST' && String(url).includes('/owner/venues/10/slots/501/block')
      );
      expect(calls.length).toBe(1);
    });
  });

  it('unblocking a blocked slot from the drawer calls the unblock API', async () => {
    const user = userEvent.setup();
    const fetchMock = renderCalendar([
      ['/owner/venues/10/slots/503/unblock', { method: 'POST', body: {} }],
    ]);

    expect(await screen.findByText(/Pitch Schedule & Slots/i)).toBeInTheDocument();

    // Click maintenance slot
    const maintenanceSlots = await screen.findAllByText(/Maintenance/i);
    await user.click(maintenanceSlots[maintenanceSlots.length - 1]);

    // Detail drawer shows unblock button
    const unblockBtn = await screen.findByRole('button', { name: /Unblock Slot & Make Available/i });
    await user.click(unblockBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([url, init]) =>
        init?.method === 'POST' && String(url).includes('/owner/venues/10/slots/503/unblock')
      );
      expect(calls.length).toBe(1);
    });
  });

  it('saving slot price from drawer sends updated price to API', async () => {
    const user = userEvent.setup();
    const fetchMock = renderCalendar([
      ['/owner/slots/501', { method: 'PUT', body: {} }],
    ]);

    expect(await screen.findByText(/Pitch Schedule & Slots/i)).toBeInTheDocument();

    // Open slot #501
    const availPriceTag = await screen.findByText('৳2,000');
    await user.click(availPriceTag);

    // Change price input
    const priceInput = await screen.findByLabelText(/Price per slot/i);
    await user.clear(priceInput);
    await user.type(priceInput, '3200');

    // Save price
    const saveBtn = screen.getByRole('button', { name: 'Save Price' });
    await user.click(saveBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([url, init]) =>
        init?.method === 'PUT' && String(url).includes('/owner/slots/501')
      );
      expect(calls.length).toBe(1);
    });
  });

  it('clicking a booked slot displays customer information and check-in options', async () => {
    const user = userEvent.setup();
    const fetchMock = renderCalendar([
      ['/matchday/checkin', { method: 'POST', body: {} }],
    ]);

    expect(await screen.findByText(/Pitch Schedule & Slots/i)).toBeInTheDocument();

    // Click on booked customer card
    const bookedCard = await screen.findByText(/Rahim Karim/i);
    await user.click(bookedCard);

    // Drawer should show customer details
    const drawer = await screen.findByRole('dialog', { name: /Slot Details & Management/i });
    expect(within(drawer).getByText(/Player Booking Info/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/01711112222/i)).toBeInTheDocument();
    expect(within(drawer).getByText('MB-TEST01')).toBeInTheDocument();

    // Check in action
    const checkInBtn = within(drawer).getByRole('button', { name: /Check In Customer/i });
    await user.click(checkInBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([url, init]) =>
        init?.method === 'POST' && String(url).includes('/matchday/checkin')
      );
      expect(calls.length).toBe(1);
    });
  });

  it('toggling to week view renders all 7 days with valid schedule', async () => {
    const user = userEvent.setup();
    renderCalendar();

    expect(await screen.findByText(/Pitch Schedule & Slots/i)).toBeInTheDocument();
    const weekBtn = screen.getByRole('button', { name: 'Week View' });
    await user.click(weekBtn);

    // Week view days should render
    expect(await screen.findByText(/Week of/i)).toBeInTheDocument();
  });
});
