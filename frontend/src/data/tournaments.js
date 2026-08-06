/**
 * Host-side tournament fixtures shared by the tournament dashboard,
 * the multi-pitch timeline and the reservation checkout.
 */

/** Ramadan Cup 2027 — the single tournament the prototype ships with. */
export const ramadanCup = {
  id: 'TR-CUP-0091',
  name: 'Ramadan Cup 2027',
  venue: 'Mirpur Sports City',
  date: 'Sat 23 Aug',
  window: '8 AM–6 PM',
  slots: 14,
  slotTotal: '৳44,600',
  discount: '−৳1,800',
  total: '৳42,800',
  deposit: '৳17,120',
  balance: '৳25,680',
  balanceDue: 'Wed 20 Aug',
  depositTxn: '7R2M88',
};

/** Match schedule rendered on the tournament dashboard. */
export const tournamentFixtures = [
  { id: 'r16-a', time: '8:00 AM', pitch: 'A', fixture: 'R16 · Dhanmondi Strikers vs Uttara FC' },
  { id: 'r16-b', time: '8:00 AM', pitch: 'B', fixture: 'R16 · Mirpur Kings vs Banani Blues' },
  { id: 'qf', time: '2:00 PM', pitch: 'A', fixture: 'Quarterfinals begin' },
  { id: 'final', time: '5:00 PM', pitch: 'D', fixture: '🏆 Final · 9-a-side pitch' },
];

/** Pitch column headers for the multi-pitch timeline. */
export const pitchColumns = [
  'Pitch A · 7-a-side',
  'Pitch B · 7-a-side',
  'Pitch C · 7-a-side',
  'Pitch D · 9-a-side',
];

/**
 * Multi-pitch grid. Each cell is either a selectable/addable button
 * (`kind: 'sel' | 'add'`) or an immovable event (`kind: 'ev'`).
 */
export const pitchSchedule = [
  {
    time: '8:00 AM',
    cells: [
      { id: 'a8', kind: 'sel', label: 'Selected ✓', toast: 'Removed Pitch A 8 AM from selection' },
      { id: 'b8', kind: 'sel', label: 'Selected ✓', toast: 'Removed Pitch B 8 AM' },
      { id: 'c8', kind: 'add', label: '+ ৳3,000', toast: 'Added Pitch C 8 AM — total now ৳27,400' },
      { id: 'd8', kind: 'sel', label: 'Selected ✓', toast: 'Removed Pitch D 8 AM' },
    ],
  },
  {
    time: '10:00 AM',
    cells: [
      { id: 'a10', kind: 'sel', label: 'Selected ✓', toast: 'Removed' },
      { id: 'b10', kind: 'sel', label: 'Selected ✓', toast: 'Removed' },
      { id: 'c10', kind: 'ev', tone: 'online', label: 'Booked · league team' },
      { id: 'd10', kind: 'sel', label: 'Selected ✓', toast: 'Removed' },
    ],
  },
  {
    time: '12:00 PM',
    cells: [
      { id: 'a12', kind: 'sel', label: 'Selected ✓', toast: 'Removed' },
      { id: 'b12', kind: 'sel', label: 'Selected ✓', toast: 'Removed' },
      { id: 'c12', kind: 'add', label: '+ ৳3,000', toast: 'Added — conflict check passed ✓' },
      { id: 'd12', kind: 'sel', label: 'Selected ✓', toast: 'Removed' },
    ],
  },
  {
    time: '2:00 PM',
    cells: [
      { id: 'a14', kind: 'sel', label: 'Selected ✓', toast: 'Removed' },
      { id: 'b14', kind: 'ev', tone: 'held', label: 'Held · another checkout' },
      { id: 'c14', kind: 'add', label: '+ ৳3,200', toast: 'Added' },
      { id: 'd14', kind: 'sel', label: 'Selected ✓', toast: 'Removed' },
    ],
  },
  {
    time: '4:00 PM',
    cells: [
      { id: 'a16', kind: 'sel', label: 'Selected ✓ · final', toast: 'Removed' },
      { id: 'b16', kind: 'add', label: '+ ৳3,600', toast: 'Added' },
      { id: 'c16', kind: 'add', label: '+ ৳3,600', toast: 'Added' },
      { id: 'd16', kind: 'sel', label: 'Selected ✓ · final', toast: 'Removed' },
    ],
  },
];
