import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { Chip } from '@/components/ui/Chip';
import { Photo } from '@/components/ui/Photo';
import { SkeletonList } from '@/components/ui/Skeleton';
import { searchVenues, toExploreCard } from '@/api/venues';
import { getSavedVenues, toggleSavedVenue } from '@/api/players';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { toUserMessage } from '@/utils/errorMessage';
import { paths } from '@/routes/paths';
import './ExplorePage.css';

// Leaflet stays out of the main bundle until the map view is rendered.
const VenueMap = lazy(() => import('@/components/common/VenueMap'));

const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

/** Amenity glyphs keyed by `amenities[].icon` in `src/data/venues.js`. */
const AMENITY_ICONS = {
  ball: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.8" {...svgProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  ),
  zap: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  parking: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </svg>
  ),
  user: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  indoor: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  users: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  coffee: (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
};

const HeartIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2.2" {...svgProps}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const CheckIcon = (
  <svg width="10" height="10" viewBox="0 0 24 24" strokeWidth="3.5" {...svgProps}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PinIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const LOCATIONS = [
  { label: 'Any area', value: '' },
  { label: 'Dhanmondi', value: 'Dhanmondi' },
  { label: 'Mohammadpur', value: 'Mohammadpur' },
  { label: 'Mirpur', value: 'Mirpur' },
  { label: 'Uttara', value: 'Uttara' },
  { label: 'Banani', value: 'Banani' },
  { label: 'Gulshan', value: 'Gulshan' },
];

/** Maps to the venue API's `openAt` (HH:mm) — venues open across that time. */
const START_TIMES = [
  { label: 'Any time', value: '' },
  { label: 'Morning · 8:00 AM', value: '08:00' },
  { label: 'Afternoon · 2:00 PM', value: '14:00' },
  { label: 'Evening · 7:00 PM', value: '19:00' },
  { label: 'Night · 9:00 PM', value: '21:00' },
];

const SPORTS = ['Football', 'Cricket', 'Badminton', 'Basketball'];

const PAGE_SIZE = 10;

/** Slider ceiling; at the top notch we send no `maxPrice` at all. */
const PRICE_CEILING = 5000;

/** How far around the player we look once they share their location. */
const NEAR_RADIUS_KM = 15;

/** Filter-drawer labels -> backend amenity keys. Every chip maps to a real key. */
const AMENITY_KEYS = {
  Floodlights: 'floodlights',
  Parking: 'parking',
  'Changing room': 'changing_room',
  Indoor: 'indoor',
  Cafeteria: 'cafeteria',
  'Youth-friendly': 'youth_friendly',
};

const AMENITIES = Object.keys(AMENITY_KEYS);

const AMENITY_LABELS_BY_KEY = Object.fromEntries(
  Object.entries(AMENITY_KEYS).map(([label, key]) => [key, label]),
);

/** URL query -> the exact argument object `searchVenues` accepts. */
function readFilterParams(searchParams) {
  const params = {};
  const area = searchParams.get('area');
  const sport = searchParams.get('sport');
  const openAt = searchParams.get('openAt');
  const maxPrice = Number(searchParams.get('maxPrice'));
  const amenity = searchParams.getAll('amenity').filter((key) => key in AMENITY_LABELS_BY_KEY);
  if (area) params.area = area;
  if (sport) params.sport = sport.toLowerCase();
  if (openAt) params.openAt = openAt;
  if (Number.isFinite(maxPrice) && maxPrice > 0) params.maxPrice = maxPrice;
  if (amenity.length) params.amenity = amenity;
  if (searchParams.get('verified') === 'true') params.verified = true;
  return params;
}

export default function ExplorePage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const filters = useDisclosure(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(() => searchParams.get('q') ?? '');
  const [page, setPage] = useState(0);
  const [near, setNear] = useState(null);
  const [locating, setLocating] = useState(false);

  // Filters live in the URL so the home-page chips can deep-link straight into them.
  const filterParams = useMemo(() => readFilterParams(searchParams), [searchParams]);

  // Sync state when the URL's q param changes while mounted
  // (e.g. from dashboard search bar) — adjusted during render.
  const qParam = searchParams.get('q') ?? '';
  const [prevQParam, setPrevQParam] = useState(qParam);
  if (prevQParam !== qParam) {
    setPrevQParam(qParam);
    setQuery(qParam);
    setDebouncedQuery(qParam);
  }

  // Debounce keystrokes so we don't hit the API on every character.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Live search only; an unreachable API yields the empty state, not a stand-in list.
  const nearKey = near ? `${near.lat},${near.lng},${near.radiusKm}` : '';
  const search = useApi(
    () =>
      searchVenues({
        q: debouncedQuery,
        page,
        size: PAGE_SIZE,
        sort: near ? 'distance' : 'rating',
        ...(near ? { lat: near.lat, lng: near.lng, radiusKm: near.radiusKm } : {}),
        ...filterParams,
      }),
    [debouncedQuery, page, JSON.stringify(filterParams), nearKey],
  );
  // A response without an `items` array (an error envelope, a shape change)
  // used to throw here rather than fall through to the empty state.
  const venues = Array.isArray(search.data?.items) ? search.data.items.map(toExploreCard) : [];
  const totalPages = search.data?.totalPages ?? 1;
  const totalItems = search.data?.totalItems ?? venues.length;

  const mapMarkers = useMemo(
    () =>
      (Array.isArray(search.data?.items) ? search.data.items : [])
        .filter((venue) => venue.lat != null && venue.lng != null)
        .map((venue) => ({
          id: venue.slug,
          lat: Number(venue.lat),
          lng: Number(venue.lng),
          label:
            venue.fromPrice != null
              ? `৳${Number(venue.fromPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
              : '⚽',
          title: venue.name,
          hot: Boolean(venue.promotionLabel),
        })),
    [search.data],
  );

  const applyFilters = (params) => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (params.area) next.set('area', params.area);
    if (params.sport) next.set('sport', params.sport);
    if (params.openAt) next.set('openAt', params.openAt);
    if (params.maxPrice != null) next.set('maxPrice', String(params.maxPrice));
    (params.amenity ?? []).forEach((key) => next.append('amenity', key));
    if (params.verified) next.set('verified', 'true');
    setSearchParams(next, { replace: true });
    setPage(0);
  };

  const toggleNearMe = () => {
    if (near) {
      setNear(null);
      setPage(0);
      showToast('Showing venues from every area again');
      return;
    }
    if (!navigator.geolocation) {
      showToast('Your browser does not support location sharing');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        setNear({
          lat: Number(coords.latitude.toFixed(6)),
          lng: Number(coords.longitude.toFixed(6)),
          radiusKm: NEAR_RADIUS_KM,
        });
        setPage(0);
        showToast(`📍 Showing venues within ${NEAR_RADIUS_KM} km of you`);
      },
      (error) => {
        setLocating(false);
        showToast(
          error.code === error.PERMISSION_DENIED
            ? 'Location blocked — allow location access to search near you'
            : 'Could not get your location — try again',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  // Saved-venue bookmarks (heart buttons); non-fatal if the API is down.
  const { signedIn } = useSession();
  const [savedSlugs, setSavedSlugs] = useState(() => new Set());
  useEffect(() => {
    // Bookmarks belong to a caller. Asking for them while signed out returned
    // 401, and the client treats a 401 as "session over" and clears it.
    if (!signedIn) return;
    getSavedVenues()
      .then((items) => setSavedSlugs(new Set((Array.isArray(items) ? items : []).map((item) => item.slug))))
      .catch(() => {});
  }, [signedIn]);

  const onToggleSave = async (event, venue) => {
    event.preventDefault(); // heart sits inside the venue card link
    if (!signedIn) {
      showToast('Sign in to save venues');
      return;
    }
    try {
      const { saved } = await toggleSavedVenue(venue.id);
      setSavedSlugs((current) => {
        const next = new Set(current);
        if (saved) next.add(venue.id);
        else next.delete(venue.id);
        return next;
      });
      showToast(saved ? `❤️ Saved ${venue.name}` : `Removed ${venue.name} from saved`);
    } catch (error) {
      showToast(toUserMessage(error, 'Could not update saved venues.'));
    }
  };

  return (
    <>
      <PageTitle title="Explore Venues" />
      <main className="wrap" style={{ paddingTop: 24, paddingBottom: 24 }} id="main">
        <h1 className="sr-only">Explore venues</h1>
        {/* ── Single-door search context + filters ── */}
        <div className="search-bar-row">
          <label className="search-context-pill" htmlFor="venue-search" aria-label="Search venues">
            <span className="search-compact-icon" aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }}>
              🔍
            </span>
            <input
              id="venue-search"
              type="search"
              placeholder="Turf, sport, or area…"
              autoComplete="off"
              spellCheck="false"
              aria-label="Search venues"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0); // new search always starts from the first page
              }}
            />
          </label>

          <button
            className={`locate-btn${near ? ' is-on' : ''}`}
            type="button"
            aria-pressed={Boolean(near)}
            disabled={locating}
            title={near ? 'Stop searching near me' : 'Use my current location'}
            onClick={toggleNearMe}
          >
            {PinIcon}
            {locating ? 'Locating…' : near ? 'Near me' : 'Use my location'}
          </button>

          <button className="filters-btn" type="button" aria-label="Open filters" onClick={filters.open}>
            <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Filters
          </button>
        </div>

        <p className="results-meta" role="status">
          {search.loading
            ? 'Searching venues…'
            : search.error
              ? 'Could not load venues.'
              : `${totalItems} venue${totalItems === 1 ? '' : 's'} found · sorted by ${
                  near ? `distance from you (within ${near.radiusKm} km)` : 'rating'
                }`}
        </p>

        {/* ── Split: list + map ── */}
        <div className="split">
          <div className="stack">
            {search.loading ? <SkeletonList count={4} height={180} /> : null}
            {!search.loading && search.error ? (
              // The old copy said "showing samples" while rendering nothing.
              <div className="card" style={{ padding: 20 }}>
                <b>Could not load venues</b>
                <p className="subtle small" style={{ margin: '6px 0 12px' }}>
                  {toUserMessage(search.error, 'Please try again.')}
                </p>
                <Button size="sm" variant="secondary" onClick={search.reload}>
                  Try again
                </Button>
              </div>
            ) : null}
            {!search.loading && !search.error && venues.length === 0 ? (
              <div className="alert-nudge">
                <p className="small" style={{ margin: 0, color: 'var(--text-2)' }}>
                  {near
                    ? `No venues within ${near.radiusKm} km of you — turn off “Near me” to see every area.`
                    : 'No venues match your search — try a different area or clear filters.'}
                </p>
              </div>
            ) : null}
            {!search.loading && venues.map((venue) => (
              <Link key={venue.id} className="vc" to={paths.player.venue(venue.id)} aria-label={venue.cardLabel}>
                <div className="vc-photo">
                  <Photo
                    photos={venue.photos}
                    imgUrl={venue.imgUrl || venue.photos?.[0]}
                    variant={venue.photoVariant}
                    glyph={venue.glyph}
                  />
                  {venue.promo ? <span className="vc-promo">{venue.promo}</span> : null}
                  <button
                    className="vc-save"
                    type="button"
                    aria-label={savedSlugs.has(venue.id) ? `Remove ${venue.name} from saved` : `Save ${venue.name}`}
                    aria-pressed={savedSlugs.has(venue.id)}
                    style={savedSlugs.has(venue.id) ? { color: 'var(--danger)' } : undefined}
                    onClick={(event) => onToggleSave(event, venue)}
                  >
                    {HeartIcon}
                  </button>
                </div>
                <div className="vc-body">
                  <div className="vc-title-row">
                    <div>
                      <div className="vc-name">
                        {venue.name}
                        {venue.verified ? (
                          <span
                            className="verified"
                            style={{ fontSize: 11, verticalAlign: 2, marginLeft: 4 }}
                          >
                            {CheckIcon}
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <div className="vc-meta">{venue.meta}</div>
                    </div>
                    <div className="vc-rating" aria-label={venue.ratingLabel}>
                      {venue.rating}{' '}
                      <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 12 }}>
                        {venue.reviews}
                      </span>
                    </div>
                  </div>
                  <div className="vc-amenities" aria-label="Amenities">
                    {venue.amenities.map((amenity) => (
                      <span key={amenity.label} className="vc-amen" title={amenity.title}>
                        {AMENITY_ICONS[amenity.icon]}
                        {amenity.label}
                      </span>
                    ))}
                  </div>
                  <div className="vc-footer">
                    <div className="vc-price">
                      <b>{venue.price}</b> <span>{venue.priceUnit}</span>
                    </div>
                    <div className="vc-slots" aria-label="Available slots">
                      {venue.slots.map((slot) => (
                        <span key={slot} className="slot-pill">
                          {slot}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {/* No-slot nudge */}
            <div className="alert-nudge">
              <p className="small" style={{ margin: 0, color: 'var(--text-2)' }}>
                Didn&apos;t find a slot that works?{' '}
                <Link to={paths.solo.alerts} style={{ fontWeight: 700, color: 'var(--brand-600)' }}>
                  Set an availability alert
                </Link>{' '}
                and we&apos;ll notify you the moment one opens.
              </p>
            </div>

            {/* Pagination */}
            <div
              className="pagination"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginTop: 32,
              }}
            >
              <Button
                variant="tertiary"
                size="sm"
                disabled={page === 0 || search.loading}
                style={{ padding: '0 12px' }}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                ← Prev
              </Button>
              {Array.from({ length: Math.max(totalPages, 1) }, (_, index) => (
                <Button
                  key={index}
                  variant={index === page ? undefined : 'tertiary'}
                  size="sm"
                  className={index === page ? 'pg-current' : undefined}
                  style={{ width: 36, padding: 0 }}
                  onClick={() => setPage(index)}
                >
                  {index + 1}
                </Button>
              ))}
              <Button
                variant="tertiary"
                size="sm"
                disabled={page >= totalPages - 1 || search.loading}
                style={{ padding: '0 12px' }}
                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              >
                Next →
              </Button>
            </div>
          </div>

          {/* ── Map (OpenStreetMap) ── */}
          {mapMarkers.length > 0 ? (
            <div className="mapbox">
              <Suspense fallback={<div className="mapbox photo map" aria-hidden="true" />}>
                <VenueMap
                  markers={mapMarkers}
                  onMarkerClick={(marker) => navigate(paths.player.venue(marker.id))}
                />
              </Suspense>
            </div>
          ) : (
            <div className="mapbox photo map map-unavailable" role="status">
              {search.loading ? (
                <span>Loading map…</span>
              ) : (
                <span>
                  {search.error
                    ? 'Map unavailable — venue locations could not be loaded.'
                    : 'No venues to show on the map for these filters.'}
                </span>
              )}
            </div>
          )}
        </div>
      </main>

      <FilterDrawer
        key={JSON.stringify(filterParams)}
        isOpen={filters.isOpen}
        onClose={filters.close}
        onApply={applyFilters}
        initial={filterParams}
      />
    </>
  );
}

function FilterDrawer({ isOpen, onClose, onApply, initial }) {
  const [area, setArea] = useState(initial.area ?? '');
  const [startTime, setStartTime] = useState(initial.openAt ?? '');
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice ?? PRICE_CEILING);
  const [verified, setVerified] = useState(Boolean(initial.verified));
  const sports = useFilterChips(
    SPORTS.filter((option) => option.toLowerCase() === initial.sport),
  );
  const amenities = useFilterChips(
    (initial.amenity ?? []).map((key) => AMENITY_LABELS_BY_KEY[key]).filter(Boolean),
  );

  return (
    <Overlay isOpen={isOpen} onClose={onClose} title="Filters" mode="drawer" hideHeader>
      <div className="between">
        <h3>Filters</h3>
        <IconButton label="Close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2.5" {...svgProps}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </IconButton>
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="filter-area">Location</label>
          <Select id="filter-area" value={area} onChange={(event) => setArea(event.target.value)}>
            {LOCATIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="field">
          <label htmlFor="filter-open-at">Open at</label>
          <Select
            id="filter-open-at"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          >
            {START_TIMES.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <span className="hint">Shows venues whose opening hours cover that time.</span>
        </div>
      </div>
      <div className="field">
        <label>Sport</label>
        <div className="row-wrap">
          {SPORTS.map((option) => (
            <Chip key={option} active={sports.isActive(option)} onToggle={() => sports.toggle(option)}>
              {option}
            </Chip>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="filter-max-price">Max price (per booking)</label>
        <input
          id="filter-max-price"
          type="range"
          min="500"
          max={PRICE_CEILING}
          step="100"
          value={maxPrice}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
          style={{ width: '100%', accentColor: 'var(--brand)' }}
          aria-label="Max price"
        />
        <div className="between subtle">
          <span>৳500</span>
          <b>
            {maxPrice >= PRICE_CEILING ? 'Any price' : `৳${maxPrice.toLocaleString('en-BD')}`}
          </b>
          <span>৳{PRICE_CEILING.toLocaleString('en-BD')}+</span>
        </div>
      </div>
      <div className="field">
        <label>Amenities</label>
        <div className="row-wrap">
          {AMENITIES.map((option) => (
            <Chip
              key={option}
              active={amenities.isActive(option)}
              onToggle={() => amenities.toggle(option)}
            >
              {option}
            </Chip>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Trust</label>
        <div className="row-wrap">
          <Chip active={verified} onToggle={() => setVerified((current) => !current)}>
            Verified venues only
          </Chip>
        </div>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <Button
          variant="tertiary"
          onClick={() => {
            onApply({});
            onClose();
          }}
        >
          Reset
        </Button>
        <Button
          variant="primary"
          block
          onClick={() => {
            // useFilterChips exposes a Set
            const amenityKeys = [...amenities.active].map((label) => AMENITY_KEYS[label]).filter(Boolean);
            const sport = [...sports.active][0];
            onApply({
              ...(area ? { area } : {}),
              ...(sport ? { sport: sport.toLowerCase() } : {}),
              ...(startTime ? { openAt: startTime } : {}),
              ...(maxPrice < PRICE_CEILING ? { maxPrice } : {}),
              ...(amenityKeys.length ? { amenity: amenityKeys } : {}),
              ...(verified ? { verified: true } : {}),
            });
            onClose();
          }}
        >
          Apply filters
        </Button>
      </div>
    </Overlay>
  );
}
