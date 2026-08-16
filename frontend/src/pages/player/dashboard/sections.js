import { paths } from '@/routes/paths';

/** Percentage of the optional profile fields the player has filled in. */
export function profileCompletion(profile) {
  if (!profile) return { percent: 0, missing: [] };
  const fields = [
    ['a display name', Boolean(profile.fullName)],
    ['your area', Boolean(profile.area)],
    ['a short bio', Boolean(profile.bio)],
    ['a skill level', Boolean(profile.playStyle)],
    ['how you play', Boolean(profile.playerRole)],
    ['preferred sports', Boolean(profile.preferredSports?.length)],
    ['preferred times', Boolean(profile.preferredTimes?.length)],
  ];
  const done = fields.filter(([, filled]) => filled).length;
  return {
    percent: Math.round((done / fields.length) * 100),
    missing: fields.filter(([, filled]) => !filled).map(([label]) => label),
  };
}

/**
 * Sidebar model. `pending: true` marks a section whose backing service does
 * not exist yet — those screens explain what is missing instead of faking data.
 */
export const DASHBOARD_SECTIONS = [
  { path: paths.player.dashboard.root, label: 'Overview', icon: '◎', end: true },
  { path: paths.player.dashboard.tournaments, label: 'Tournaments', icon: '🏆' },
  { path: paths.player.dashboard.venues, label: 'Saved venues', icon: '❤' },
  { path: paths.player.dashboard.bookings, label: 'My bookings', icon: '📅' },
  { path: paths.player.dashboard.teams, label: 'My teams', icon: '👥', pending: true },
  { path: paths.player.dashboard.network, label: 'Player network', icon: '🤝', pending: true },
  { path: paths.player.dashboard.stats, label: 'Statistics', icon: '📈' },
  { path: paths.player.dashboard.wallet, label: 'Wallet', icon: '৳' },
  { path: paths.player.dashboard.notifications, label: 'Notifications', icon: '🔔' },
  { path: paths.player.dashboard.settings, label: 'Profile settings', icon: '⚙' },
];
