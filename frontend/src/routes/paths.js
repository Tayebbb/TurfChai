/**
 * Single source of truth for every URL in the app.
 * Components must never hard-code a path string.
 */
export const paths = {
  landing: '/',
  auth: '/auth',

  player: {
    root: '/player',
    home: '/player',
    onboarding: '/player/onboarding',
    explore: '/player/explore',
    venue: (venueId = ':venueId') => `/player/venues/${venueId}`,
    checkout: '/player/checkout',
    bookingSuccess: '/player/booking-success',
    bookings: '/player/bookings',
    bookingDetail: (bookingId = ':bookingId') => `/player/bookings/${bookingId}`,
    splitPayment: '/player/split-payment',
    paymentRetry: '/player/payment-retry',
    matchday: '/player/matchday',
    review: '/player/review',
    cancel: '/player/cancel',
    rewards: '/player/rewards',
  },

  solo: {
    root: '/solo',
    openGames: '/solo/open-games',
    game: (gameId = ':gameId') => `/solo/games/${gameId}`,
    alerts: '/solo/alerts',
    ticket: '/solo/ticket',
  },

  host: {
    root: '/host',
    hub: '/player?mode=host',
    tournament: '/host/tournament',
    multiPitch: '/host/multi-pitch',
    reserve: '/host/reserve',
  },

  owner: {
    root: '/owner',
    dashboard: '/owner',
    calendar: '/owner/calendar',
    bookings: '/owner/bookings',
    payments: '/owner/payments',
    venueSetup: '/owner/venue-setup',
    customers: '/owner/customers',
    promotions: '/owner/promotions',
    reviews: '/owner/reviews',
    staff: '/owner/staff',
    onboarding: '/owner/onboarding',
  },

  admin: {
    root: '/admin',
    login: '/admin/login',
    dashboard: '/admin',
    turfRequests: '/admin/turf-requests',
    requestReview: (requestId = ':requestId') => `/admin/turf-requests/${requestId}`,
    turfs: '/admin/turfs',
    turfDetails: (turfId = ':turfId') => `/admin/turfs/${turfId}`,
    users: '/admin/users',
    userGrowth: '/admin/users/growth',
    userSegments: '/admin/users/segments',
    activity: '/admin/activity',
    admins: '/admin/admins',
    profile: '/admin/profile',
  },
};

/** Dashboard modes available on the unified player home. */
export const DASHBOARD_MODES = ['player', 'solo', 'host'];
