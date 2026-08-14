import { apiGet } from './client';

export async function searchOpenGames(params = {}) {
  return apiGet('/api/v1/solo/open-games', params);
}

export async function getOpenGame(id) {
  return apiGet(`/api/v1/solo/open-games/${id}`);
}

export function toGameFeedCard(game) {
  const isUrgent = game.spotsLeft <= 2;
  const isFull = game.spotsLeft === 0;

  const section = isFull ? 'full' : isUrgent ? 'urgent' : game.spotsLeft <= 3 ? 'almost-full' : 'open';
  const variant = section;

  return {
    id: game.id.toString(),
    section,
    variant,
    name: game.title,
    venue: game.venueName,
    sport: 'football', // Backend might need a sport field, defaulting to football
    skill: (game.skillLevel || 'intermediate').toLowerCase(),
    time: 'tonight', // Can be computed based on game.gameDate
    join: 'instant', // Assuming instant for now
    price: game.pricePerPlayer || 0,
    distance: 1.5, // Dummy distance for now, needs geolocation in real app
    status: {
      tone: isUrgent ? 'red' : isFull ? 'gray' : 'green',
      text: isFull ? 'Full \u00b7 closed' : isUrgent ? `Urgent \u00b7 needs ${game.spotsLeft} player` : `Open \u00b7 ${game.spotsLeft} spots left`,
    },
    skillLabel: game.skillLevel || 'Intermediate',
    joinBadge: { tone: 'green', text: '\u26A1 Instant join' },
    sportIcon: '\u26BD',
    metaParts: [game.area || 'City', game.gameDate],
    metaStrong: `${game.startTime} - ${game.endTime}`,
    priceTone: isUrgent ? 'red' : null,
    host: { initials: game.organizerName?.substring(0, 2).toUpperCase() || 'H', name: game.organizerName || 'Host', rating: '4.8', ratingMuted: false },
    fillNote: `${game.filledCount}/${game.capacity} joined`,
    fillNoteTone: isUrgent ? 'danger' : null,
    fillTone: isUrgent ? 'red' : 'green',
    fillWidth: `${(game.filledCount / game.capacity) * 100}%`,
    avatars: (game.members || []).map((m) => ({ id: m.userId.toString(), initials: m.playerName.substring(0, 2).toUpperCase() })),
    playersNote: isUrgent ? `Waiting for ${game.spotsLeft} more` : `${game.spotsLeft} spots remaining`,
    cta: { label: isFull ? 'Notify me' : 'View & Join \u2192', variant: isFull ? 'secondary' : 'primary' },
    search: `${game.title} ${game.venueName} ${game.area}`.toLowerCase(),
  };
}

export function toHomeGameCard(game) {
  const isUrgent = game.spotsLeft <= 2;
  return {
    id: game.id.toString(),
    title: `${game.title} \u00b7 ${game.venueName}`,
    status: isUrgent ? `Needs ${game.spotsLeft}` : `${game.spotsLeft} spots`,
    statusTone: isUrgent ? 'red' : 'green',
    skill: game.skillLevel || 'Intermediate',
    when: game.startTime || 'Tonight',
    distanceKm: 1.5,
    price: game.pricePerPlayer || 0,
  };
}
