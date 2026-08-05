/**
 * Owner-console sample data shared by more than one screen.
 * Swap for real API responses when the backend lands.
 */

/** Sport registry — chart series colours (Reports) and pitch badge tones (Venue setup). */
export const SPORTS = [
  { key: 'football', label: '⚽ Football', name: 'Football', color: '#06B6D4', tagBg: 'rgba(6,182,212,.15)', badge: 'blue' },
  { key: 'cricket', label: '🏐 Cricket', name: 'Cricket', color: '#E879F9', tagBg: 'rgba(232,121,249,.15)', badge: 'amber' },
  { key: 'badminton', label: '🏸 Badminton', name: 'Badminton', color: '#FB923C', tagBg: 'rgba(251,146,60,.15)', badge: 'info' },
  { key: 'futsal', label: '🥅 Futsal', name: 'Futsal', color: '#A3E635', tagBg: 'rgba(163,230,53,.15)', badge: 'green' },
  { key: 'volleyball', label: '🏐 Volleyball', name: 'Volleyball', color: '#F472B6', tagBg: 'rgba(244,114,182,.15)', badge: '' },
];

/** Emoji + badge tone per sport, keyed by the plain name used in pitch assignment. */
export const SPORT_BADGES = {
  Football: { glyph: '⚽ Football', tone: 'blue' },
  Cricket: { glyph: '🏏 Cricket', tone: 'amber' },
  Futsal: { glyph: '🥅 Futsal', tone: 'green' },
  Badminton: { glyph: '🏸 Badminton', tone: 'info' },
  Volleyball: { glyph: '🏐 Volleyball', tone: '' },
};
