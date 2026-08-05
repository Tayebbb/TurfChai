import { apiGet } from './client';

/**
 * Venue discovery endpoints + mappers converting backend DTOs into the
 * exact card shapes the existing pages render, so page markup stays stable.
 */

const AMENITY_LABELS = {
  floodlights: { icon: 'zap', label: 'Floodlit', title: 'Floodlights' },
  parking: { icon: 'parking', label: 'Parking', title: 'Free parking' },
  changing_room: { icon: 'user', label: 'Changing', title: 'Changing room' },
  indoor: { icon: 'indoor', label: 'Indoor', title: 'Indoor facility' },
  youth_friendly: { icon: 'users', label: 'Youth', title: 'Youth-friendly' },
  cafeteria: { icon: 'coffee', label: 'Cafeteria', title: 'Cafeteria' },
};

const SPORT_GLYPHS = { football: '⚽', cricket: '🏏', badminton: '🏸', futsal: '⚽', basketball: '🏀' };

const bdt = (value) =>
  value == null ? null : `৳${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

/** GET /api/v1/venues — paged summaries with discovery filters. */
export async function searchVenues(params = {}) {
  return apiGet('/api/v1/venues', params);
}

/** GET /api/v1/venues/{slug} — full detail for the venue page. */
export async function getVenue(slug) {
  return apiGet(`/api/v1/venues/${encodeURIComponent(slug)}`);
}

/** Backend summary -> home-page scroller card (nearbyVenues shape). */
export function toNearbyCard(venue) {
  return {
    id: venue.slug,
    name: venue.name,
    glyph: SPORT_GLYPHS[venue.sports?.[0]] ?? '⚽',
    distanceKm: venue.distanceKm ?? undefined,
    rating: Number(venue.rating),
    price: venue.fromPrice != null ? Number(venue.fromPrice) : undefined,
    nextSlot: undefined, // live slots arrive with the booking engine
    verified: venue.verified,
  };
}

/** Backend summary -> Explore result card (exploreVenues shape). */
export function toExploreCard(venue) {
  const amenities = (venue.amenities ?? [])
    .map((key) => AMENITY_LABELS[key])
    .filter(Boolean);
  const price = bdt(venue.fromPrice);
  return {
    id: venue.slug,
    name: venue.name,
    verified: venue.verified,
    promo: venue.promotionLabel ?? undefined,
    meta: `${venue.address}${venue.distanceKm != null ? ` \u00b7 ${venue.distanceKm} km` : ''}`,
    rating: String(venue.rating),
    reviews: `(${venue.reviewCount})`,
    ratingLabel: `Rated ${venue.rating} out of 5, ${venue.reviewCount} reviews`,
    cardLabel: `${venue.name}, ${venue.address}${price ? `, from ${price}` : ''}`,
    price,
    priceUnit: venue.slotDurationMin ? `/ ${venue.slotDurationMin} min` : '',
    slots: [], // live slots arrive with the booking engine
    amenities,
  };
}

/** Backend summary -> "similar venues" strip item on the venue page. */
export function toSimilarCard(venue) {
  return {
    id: venue.slug,
    name: venue.name,
    distance: venue.distanceKm != null ? `${venue.distanceKm} km` : venue.area,
    price: bdt(venue.fromPrice),
  };
}
