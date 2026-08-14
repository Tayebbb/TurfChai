/**
 * Address <-> coordinate lookups via OpenStreetMap Nominatim.
 *
 * Results are limited to Bangladesh and requests are made one at a time
 * (callers debounce and abort), per Nominatim's usage policy.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const COUNTRY = 'bd';

function toPlace(raw) {
  const parts = raw.address ?? {};
  return {
    id: `${raw.osm_type ?? 'n'}${raw.osm_id ?? raw.place_id}`,
    label: raw.display_name,
    lat: Number(raw.lat),
    lng: Number(raw.lon),
    // the neighbourhood-level name the rest of the app calls "area"
    area:
      parts.suburb ??
      parts.neighbourhood ??
      parts.quarter ??
      parts.city_district ??
      parts.town ??
      parts.city ??
      '',
    address: raw.display_name?.split(',').slice(0, 3).join(',').trim() ?? '',
  };
}

async function request(path, params, signal) {
  const url = new URL(`${NOMINATIM}${path}`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Location lookup failed (${response.status})`);
  return response.json();
}

/** Free-text search -> ranked places. */
export async function searchPlaces(query, { signal, limit = 6 } = {}) {
  const term = query.trim();
  if (term.length < 3) return [];
  const results = await request('/search', { q: term, countrycodes: COUNTRY, limit }, signal);
  return results.map(toPlace);
}

/** Coordinates -> the nearest addressable place. */
export async function reverseGeocode(lat, lng, { signal } = {}) {
  const result = await request('/reverse', { lat, lon: lng, zoom: '18' }, signal);
  if (!result || result.error) return null;
  return toPlace(result);
}
