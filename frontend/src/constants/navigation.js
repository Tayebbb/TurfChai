import { paths } from '@/routes/paths';

/** Desktop pill nav shown in the player/solo/host topbar. */
export const PLAYER_NAV_LINKS = [
  { to: paths.player.explore, label: 'Explore Venues' },
  { to: paths.solo.openGames, label: 'Open Games' },
  { to: paths.player.bookings, label: 'My Bookings' },
  { to: paths.player.rewards, label: 'Rewards' },
];

/** Mobile bottom bar shown under 820px for player/solo/host. */
export const PLAYER_BOTTOM_NAV = [
  { to: paths.player.home, label: 'Home', icon: '🏠', end: true },
  { to: paths.player.explore, label: 'Explore', icon: '🔍' },
  { to: paths.solo.openGames, label: 'Open Games', icon: '⚽' },
  { to: paths.player.bookings, label: 'Bookings', icon: '📅' },
];

/** Marketing topbar on the public landing page. */
export const PUBLIC_NAV_LINKS = [
  { to: paths.player.explore, label: 'Explore Venues' },
  { to: paths.solo.openGames, label: 'Open Games' },
  { to: paths.owner.onboarding, label: 'For Owners' },
  { to: paths.host.hub, label: 'Tournaments' },
];

/** Owner workspace sidebar. */
export const OWNER_NAV_LINKS = [
  { to: paths.owner.dashboard, label: 'Overview', icon: '📊', end: true },
  { to: paths.owner.calendar, label: 'Calendar', icon: '🗓️' },
  { to: paths.owner.bookings, label: 'Bookings', icon: '📅' },
  { to: paths.owner.payments, label: 'Reports', icon: '📈' },
  { to: paths.owner.venueSetup, label: 'Venues', icon: '🏟️' },
  { to: paths.owner.customers, label: 'Customers', icon: '👥' },
  { to: paths.owner.promotions, label: 'Promotions', icon: '🎁' },
  { to: paths.owner.reviews, label: 'Reviews', icon: '⭐' },
  { to: paths.owner.staff, label: 'Staff & Shifts', icon: '🧑‍🤝‍🧑' },
];

/** Admin console navigation. */
export const ADMIN_NAV_LINKS = [
  { to: paths.admin.dashboard, label: 'Overview', end: true },
  { to: paths.admin.turfRequests, label: 'Turf requests' },
  { to: paths.admin.turfs, label: 'Turfs' },
  { to: paths.admin.users, label: 'Users' },
  { to: paths.admin.activity, label: 'Activity' },
  { to: paths.admin.admins, label: 'Admins' },
];
