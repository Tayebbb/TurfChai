import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { Chip } from '@/components/ui/Chip';
import { Photo } from '@/components/ui/Photo';
import { SkeletonList } from '@/components/ui/Skeleton';
import { searchVenues, toExploreCard } from '@/api/venues';
import { getSavedVenues, toggleSavedVenue } from '@/api/players';
import { exploreMapPins, exploreVenues as exploreVenuesFallback } from '@/data/venues';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useToast } from '@/hooks/useToast';
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

const LOCATIONS = ['Dhanmondi', 'Mohammadpur', 'Mirpur', 'Uttara', 'Banani / Gulshan'];
const START_TIMES = ['7:00 PM', 'Any time', 'Morning', 'Evening'];
const DURATIONS = ['60 min', '90 min', '120 min'];
const SPORTS = ['Football', 'Cricket', 'Badminton', 'Basketball'];
const AMENITIES = [
  'Within 3 km',
  '4.5+ rating',
  'Artificial grass',
  'Natural grass',
  'Floodlights',
  'Parking',
  'Changing room',
  'Parent-friendly',
  'Instant booking',
  'Has promotion',
];

const PAGE_SIZE = 10;

/** Filter-drawer labels -> backend amenity keys (unmapped labels are UI-only). */
const AMENITY_KEYS = {
  Floodlights: 'floodlights',
  Parking: 'parking',
  'Changing room': 'changing_room',
  'Parent-friendly': 'youth_friendly',
};

export default function ExplorePage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const filters = useDisclosure(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [view, setView] = useState('list');
  const [page, setPage] = useState(0);
  const [filterParams, setFilterParams] = useState({});

  // Debounce keystrokes so we don't hit the API on every character.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Live search; falls back to the sample list when the API is unreachable.
  const search = useApi(
    () => searchVenues({ q: debouncedQuery, page, size: PAGE_SIZE, sort: 'rating', ...filterParams }),
    [debouncedQuery, page, JSON.stringify(filterParams)],
  );
  const venues = search.data ? search.data.items.map(toExploreCard) : exploreVenuesFallback;
  const totalPages = search.data?.totalPages ?? 1;
  const totalItems = search.data?.totalItems ?? venues.length;

  const mapMarkers = useMemo(
    () =>
      (search.data?.items ?? [])
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
    setFilterParams(params);
    setPage(0);
  };

  // Saved-venue bookmarks (heart buttons); non-fatal if the API is down.
  const [savedSlugs, setSavedSlugs] = useState(() => new Set());
  useEffect(() => {
    getSavedVenues()
      .then((items) => setSavedSlugs(new Set(items.map((item) => item.slug))))
      .catch(() => {});
  }, []);

  const onToggleSave = async (event, venue) => {
    event.preventDefault(); // heart sits inside the venue card link
    if (!search.data) {
      showToast('Saving is unavailable while offline');
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
    } catch {
      showToast('Could not update saved venues — try again');
    }
  };

  return (
    <>
      <PageTitle title="Explore Venues" />
      <main className="wrap" style={{ paddingTop: 24, paddingBottom: 24 }} id="main">
        {/* ── Single-door search context + filters ── */}
        <div className="search-bar-row">
          <label className="search-context-pill" htmlFor="venue-search" aria-label="Search venues">
            <div className="scp-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2.5" {...svgProps}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              id="venue-search"
              type="search"
              placeholder="Location · Date · Time"
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

          <div className="view-seg" role="group" aria-label="View mode">
            <button
              className={view === 'list' ? 'on' : undefined}
              type="button"
              onClick={() => setView('list')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}
                {...svgProps}
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              List
            </button>
            <button
              className={view === 'map' ? 'on' : undefined}
              type="button"
              onClick={() => {
                setView('map');
                showToast('Full-screen map view (split view on desktop)');
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}
                {...svgProps}
              >
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              Map
            </button>
          </div>
        </div>

        <p className="results-meta" role="status">
          {search.loading
            ? 'Searching venues…'
            : `${totalItems} venue${totalItems === 1 ? '' : 's'} found · sorted by rating`}
          {search.error ? ' · live results unavailable, showing samples' : ''}
        </p>

        {/* ── Split: list + map ── */}
        <div className="split">
          <div className="stack">
            {search.loading ? <SkeletonList count={4} height={180} /> : null}
            {!search.loading && venues.length === 0 ? (
              <div className="alert-nudge">
                <p className="small" style={{ margin: 0, color: 'var(--text-2)' }}>
                  No venues match your search — try a different area or clear filters.
                </p>
              </div>
            ) : null}
            {!search.loading && venues.map((venue) => (
              <Link key={venue.id} className="vc" to={paths.player.venue(venue.id)} aria-label={venue.cardLabel}>
                <div className="vc-photo">
                  <Photo variant={venue.photoVariant} />
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
                  style={
                    index === page
                      ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)', width: 36, padding: 0 }
                      : { width: 36, padding: 0 }
                  }
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
            <div
              className="mapbox photo map"
              role="img"
              aria-label="Map of Dhanmondi area showing venue prices"
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>Dhanmondi · map view</span>
              {exploreMapPins.map((pin) => (
                <span
                  key={pin.id}
                  className={pin.hot ? 'mappin hot' : 'mappin'}
                  style={{ top: pin.top, left: pin.left }}
                >
                  {pin.price}
                </span>
              ))}
            </div>
          )}
        </div>
      </main>

      <FilterDrawer isOpen={filters.isOpen} onClose={filters.close} onApply={applyFilters} />
    </>
  );
}

function FilterDrawer({ isOpen, onClose, onApply }) {
  const [location, setLocation] = useState('Dhanmondi');
  const [date, setDate] = useState('Today, 4 Aug');
  const [startTime, setStartTime] = useState('7:00 PM');
  const [maxPrice, setMaxPrice] = useState(3000);
  const duration = useFilterChips(['90 min']);
  const sports = useFilterChips(['Football']);
  const amenities = useFilterChips();

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

      <div className="field" style={{ marginTop: 12 }}>
        <label>Location</label>
        <Select value={location} onChange={(event) => setLocation(event.target.value)}>
          {LOCATIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </Select>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Date</label>
          <Input value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="field">
          <label>Start time</label>
          <Select value={startTime} onChange={(event) => setStartTime(event.target.value)}>
            {START_TIMES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="field">
        <label>Duration</label>
        <div className="row-wrap">
          {DURATIONS.map((option) => (
            <Chip
              key={option}
              active={duration.isActive(option)}
              onToggle={() => duration.toggle(option)}
            >
              {option}
            </Chip>
          ))}
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
        <label>Max price (per booking)</label>
        <input
          type="range"
          min="500"
          max="5000"
          value={maxPrice}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
          style={{ width: '100%', accentColor: 'var(--brand)' }}
          aria-label="Max price"
        />
        <div className="between subtle">
          <span>৳500</span>
          <b>৳{maxPrice.toLocaleString('en-BD')}</b>
          <span>৳5,000+</span>
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
      <div className="row" style={{ marginTop: 16 }}>
        <Button
          variant="tertiary"
          onClick={() => {
            duration.clear();
            sports.clear();
            amenities.clear();
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
              area: location.split(' /')[0],
              sport: sport?.toLowerCase(),
              maxPrice,
              ...(amenityKeys.length ? { amenity: amenityKeys } : {}),
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
