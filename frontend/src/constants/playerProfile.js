/**
 * Single source of truth for the player registration/onboarding + profile
 * settings forms. The backend stores lower-case `value`s (see
 * UserProfileService.toCsv) — always match on `value`, display `label`.
 */

export const PLAYER_AREAS = [
  'Dhanmondi',
  'Gulshan',
  'Banani',
  'Mirpur',
  'Uttara',
  'Mohammadpur',
  'Bashundhara',
  'Motijheel',
  'Wari',
  'Lalbagh',
  'Khilgaon',
  'Rampura',
  'Badda',
  'Tejgaon',
  'Farmgate',
  'Shyamoli',
  'Adabor',
  'Mohakhali',
  'Baridhara',
  'Pallabi',
  'Kafrul',
  'Cantonment',
  'Demra',
  'Jatrabari',
  'Keraniganj',
  'Elephant Road',
  'New Market',
  'Azimpur',
  'Hatirpool',
  'Kalabagan',
  'Zigatola',
  'Hazaribagh',
  'Rayerbazar',
  'Kamrangirchar',
];

export const PLAYER_SPORTS = [
  { value: 'football', label: 'Football', icon: '⚽' },
  { value: 'cricket', label: 'Cricket', icon: '🏏' },
  { value: 'badminton', label: 'Badminton', icon: '🏸' },
  { value: 'basketball', label: 'Basketball', icon: '🏀' },
  { value: 'futsal', label: 'Futsal', icon: '🎾' },
];

export const PLAYER_TIMES = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'late night', label: 'Late night' },
  { value: 'weekends', label: 'Weekends' },
];

export const PLAYER_SKILLS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const PLAYER_POSITIONS = [
  { value: 'Striker / Forward', label: 'Striker / Forward' },
  { value: 'Winger', label: 'Winger' },
  { value: 'Midfielder', label: 'Midfielder' },
  { value: 'Defender', label: 'Defender' },
  { value: 'Goalkeeper', label: 'Goalkeeper' },
];

/** Map a backend skill value (lower-case) to its display label. */
export function skillLabel(value) {
  return PLAYER_SKILLS.find((s) => s.value === value)?.label ?? value;
}

/** Map a backend sport value (lower-case) to its display label. */
export function sportLabel(value) {
  return PLAYER_SPORTS.find((s) => s.value === value)?.label ?? value;
}

/** Map a backend time value (lower-case) to its display label. */
export function timeLabel(value) {
  return PLAYER_TIMES.find((t) => t.value === value)?.label ?? value;
}
