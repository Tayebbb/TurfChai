/**
 * Booking fixtures shared by the player checkout → ticket → detail journey.
 * Mirrors the Dhaka sample data used by the HTML prototype.
 */

/** TC-48291 — the reference booking every player screen hangs off. */
export const fridayBooking = {
  ref: 'TC-48291',
  venue: 'Kick Off Arena',
  pitch: 'Pitch 2',
  format: '7-a-side',
  address: 'House 12, Road 27, Dhanmondi, Dhaka',
  date: 'Fri 8 Aug 2026',
  dateShort: 'Fri 8 Aug',
  playTime: '7:30–9:00 PM',
  /** Spaced variant used by the checkout summary and the booking detail grid. */
  playTimeSpaced: '7:30 – 9:00 PM',
  arriveBy: '7:20 PM',
  total: '৳2,550',
  phone: '01811 223 344',
};

/**
 * Team split roster for TC-48291. `paid` rows show a green badge, the rest
 * render a "Remind" button with the prototype's per-player toast.
 */
export const splitRoster = [
  {
    id: 'rk',
    initials: 'RK',
    name: 'You (captain)',
    note: 'Paid via bKash · covers own share',
    paid: true,
  },
  { id: 'ta', initials: 'TA', tone: 'b', name: 'Tanvir Ahmed', note: 'Paid 3h ago · bKash', paid: true },
  { id: 'sm', initials: 'SM', tone: 'c', name: 'Sabbir Mahmud', note: 'Paid yesterday · Nagad', paid: true },
  { id: 'nh', initials: 'NH', tone: 'd', name: 'Nayeem Hasan', note: 'Paid yesterday · card', paid: true },
  { id: 'ju', initials: 'JU', name: 'Jubayer Islam', note: 'Paid 2d ago · bKash', paid: true },
  { id: 'ar', initials: 'AR', tone: 'b', name: 'Arif Rahman', note: 'Paid 2d ago · bKash', paid: true },
  {
    id: 'mi',
    initials: 'MI',
    tone: 'c',
    name: 'Mehedi Islam',
    note: 'Invited Mon · opened link',
    action: 'Remind',
    toast: 'Reminder sent to Mehedi 🔔',
  },
  {
    id: 'fk',
    initials: 'FK',
    tone: 'd',
    name: 'Fahim Khan',
    note: 'Invited Mon',
    action: 'Remind',
    toast: 'Reminder sent to Fahim 🔔',
  },
  {
    id: 'si',
    initials: 'SI',
    name: 'Shakil Islam',
    note: 'Invited Tue',
    action: 'Remind',
    toast: 'Reminder sent to Shakil 🔔',
  },
  {
    id: 'open',
    initials: '+',
    tone: 'b',
    name: '1 open share',
    note: 'Not yet assigned',
    action: 'Invite contact',
    toast: 'Contact picker opened 👥',
  },
];
