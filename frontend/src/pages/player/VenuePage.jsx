import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { DateStrip, SlotGrid } from '@/components/booking/SlotGrid';
import { Segmented } from '@/components/navigation/Tabs';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Photo } from '@/components/ui/Photo';
import { Stars } from '@/components/ui/Stars';
import { Verified } from '@/components/ui/Tags';
import { getVenue, searchVenues, toSimilarCard } from '@/api/venues';
import { getActiveHold, getVenueSlots } from '@/api/bookings';
import { getSavedVenues, toggleSavedVenue } from '@/api/players';
import { getVenueReviews } from '@/api/venueReviews';
import { getToken } from '@/api/client';
import { shareOrCopy } from '@/utils/deviceActions';
import { toUserMessage } from '@/utils/errorMessage';

import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useSlotStream } from '@/hooks/useSlotStream';
import { useToast } from '@/hooks/useToast';
import { useSession } from '@/hooks/useSession';
import { Alert } from '@/components/ui/Alert';
import { paths } from '@/routes/paths';
import './VenuePage.css';

const VenueMap = lazy(() => import('@/components/common/VenueMap'));

const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

/** Next 7 real calendar days — availability per day still needs the booking service. */
function nextSevenDays(from) {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(from);
    date.setDate(date.getDate() + offset);
    return {
      // Local parts, not toISOString(): east of UTC the ISO date rolls back a
      // day before dawn, so in Dhaka a 1am visitor saw "Fri 15" but queried
      // the 14th. Matches `isoDay` in api/openGames.js.
      id: [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-'),
      weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      day: String(date.getDate()),
    };
  });
}

const GALLERY = [
  { id: 'hero', variant: undefined },
  { id: 'alt1', variant: 'alt1' },
  { id: 'alt2', variant: 'alt2' },
  { id: 'alt3', variant: 'alt3' },
];

const formatLabel = (format) => (format ? format.replaceAll('_', '-') : null);

function formatSurface(surface) {
  if (!surface) return null;
  const s = String(surface).toUpperCase();
  switch (s) {
    case 'ARTIFICIAL_TURF':
      return 'Artificial Turf';
    case 'NATURAL_GRASS':
      return 'Natural Grass';
    case 'HYBRID_TURF':
      return 'Hybrid Turf';
    case 'INDOOR_WOOD':
      return 'Indoor Hardwood';
    case 'RUBBER':
      return 'Rubber Mat';
    default:
      return surface.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatLighting(lighting) {
  if (!lighting) return null;
  const l = String(lighting).toUpperCase();
  switch (l) {
    case 'FLOODLIT':
      return 'Floodlit';
    case 'DAYLIGHT_ONLY':
      return 'Daylight Only';
    case 'INDOOR_LIGHT':
      return 'Indoor Lighting';
    default:
      return lighting.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** Spec cells built from the venue's first active pitch + opening hours. */
function specsOf(venue) {
  if (!venue) return [];
  const pitch = venue.pitches?.[0];
  const cells = [];
  if (pitch?.surfaceType) {
    cells.push({
      label: 'Surface',
      value: formatSurface(pitch.surfaceType),
      sub: pitch.indoor ? 'Indoor facility' : 'Open-air pitch',
    });
  }
  if (pitch?.lighting) {
    cells.push({ label: 'Lighting', value: formatLighting(pitch.lighting), sub: 'Full night coverage' });
  }
  if (pitch?.format) {
    cells.push({
      label: 'Format',
      value: formatLabel(pitch.format),
      sub: pitch.maxPlayers ? `Max ${pitch.maxPlayers} players` : null,
    });
  }
  if (venue.openTime && venue.closeTime) {
    cells.push({
      label: 'Open hours',
      value: `${formatTime(venue.openTime)} – ${formatTime(venue.closeTime)}`,
      sub: venue.pitches?.length ? `${venue.pitches.length} pitch${venue.pitches.length > 1 ? 'es' : ''}` : null,
    });
  }
  return cells;
}

/** '18:00:00' -> '6:00 PM' */
function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

const bdt = (value) =>
  value == null ? null : `৳${Math.round(Number(value)).toLocaleString('en-IN')}`;

/** Backend SlotResponse -> the { id, time, price, status } shape SlotGrid renders. */
function toGridSlot(slot) {
  // Defensive: the live stream overlays this field, so never assume it is set.
  const rawStatus = String(slot.status ?? 'available').toLowerCase();
  // The server decides what is sellable. A slot can be AVAILABLE and still be
  // unbookable because its start time has passed, so `bookable` wins over
  // `status` — rendering it as open would offer a time the API will refuse.
  const elapsed = slot.bookable === false && rawStatus === 'available';
  const status = elapsed ? 'blocked' : rawStatus;
  // A slot held by the current caller (e.g. they navigated away mid-checkout
  // and came back) stays clickable so they can get back to checkout, instead
  // of landing on a dead "Held" cell with no way back to the payment page.
  const mine = status === 'held' && Boolean(slot.heldByMe);
  const unavailableLabel = elapsed
    ? 'Started'
    : status === 'held'
      ? mine
        ? 'Resume booking'
        : 'Held'
      : status === 'blocked'
        ? 'Unavailable'
        : 'Booked';
  const price =
    status === 'available' ? (
      <>
        <span className="slot-price">{bdt(slot.price)}</span>
        <span className="slot-meta">ends {formatTime(slot.endTime)}</span>
      </>
    ) : (
      <span className="slot-meta">{unavailableLabel}</span>
    );
  return {
    id: slot.id,
    time: formatTime(slot.startTime),
    price,
    rawPrice: slot.price,
    status,
    mine,
    startTime: slot.startTime,
    endTime: slot.endTime,
    pitchName: slot.pitchName,
    durationMinutes: slot.durationMinutes,
  };
}

/** Vocabulary and icons for standard venue amenities */
const AMENITY_VOCAB = {
  floodlights: { label: 'Floodlights for night play', emoji: '💡' },
  parking: { label: 'On-site parking', emoji: '🅿️' },
  changing: { label: 'Changing room & shower', emoji: '👕' },
  changing_room: { label: 'Changing room & shower', emoji: '👕' },
  washroom: { label: 'Washroom & Shower', emoji: '🚿' },
  water: { label: 'Drinking water & cooler', emoji: '🚰' },
  water_cooler: { label: 'Drinking water & cooler', emoji: '🚰' },
  kit: { label: 'Bibs & match balls', emoji: '⚽' },
  cafeteria: { label: 'Cafeteria & Snacks on site', emoji: '☕' },
  firstaid: { label: 'First aid & medical kit', emoji: '🩹' },
  seating: { label: 'Dugout & Spectator seating', emoji: '🪑' },
  wifi: { label: 'Free high-speed Wi-Fi', emoji: '📶' },
  cctv: { label: '24/7 CCTV Security', emoji: '📹' },
  prayer: { label: 'Dedicated Prayer Area', emoji: '🕌' },
  generator: { label: 'Generator Backup', emoji: '⚡' },
  lockers: { label: 'Secure Lockers', emoji: '🔒' },
  ac_lounge: { label: 'AC Dugout / Lounge', emoji: '❄️' },
  sound: { label: 'Sound System', emoji: '🔊' },
  scoreboard: { label: 'Scoreboard & Timer', emoji: '🔢' },
  warmup: { label: 'Warm-up Area', emoji: '🏋️' },
  ev_charger: { label: 'EV Charger', emoji: '🔌' },
  indoor: { label: 'Indoor facility', emoji: '🏟️' },
  youth_friendly: { label: 'Youth-friendly facility', emoji: '👥' },
};

function detectAmenityEmoji(text) {
  if (!text) return '✨';
  const t = String(text).toLowerCase();
  if (t.includes('pray') || t.includes('namaz') || t.includes('mosque')) return '🕌';
  if (t.includes('cctv') || t.includes('camera') || t.includes('security') || t.includes('guard')) return '📹';
  if (t.includes('locker') || t.includes('storage') || t.includes('vault')) return '🔒';
  if (t.includes('shower') || t.includes('bath')) return '🚿';
  if (t.includes('washroom') || t.includes('toilet') || t.includes('restroom')) return '🚽';
  if (t.includes('light') || t.includes('led') || t.includes('flood')) return '💡';
  if (t.includes('park') || t.includes('car') || t.includes('bike')) return '🅿️';
  if (t.includes('ac') || t.includes('air') || t.includes('cool') || t.includes('lounge')) return '❄️';
  if (t.includes('cafe') || t.includes('coffee') || t.includes('tea') || t.includes('snack') || t.includes('food') || t.includes('canteen')) return '☕';
  if (t.includes('water') || t.includes('drink') || t.includes('cooler')) return '🚰';
  if (t.includes('sound') || t.includes('music') || t.includes('speaker') || t.includes('audio')) return '🔊';
  if (t.includes('ball') || t.includes('bib') || t.includes('kit') || t.includes('jersey')) return '⚽';
  if (t.includes('medic') || t.includes('first') || t.includes('aid') || t.includes('doctor')) return '🩹';
  if (t.includes('seat') || t.includes('dugout') || t.includes('bench') || t.includes('gallery')) return '🪑';
  if (t.includes('wifi') || t.includes('internet') || t.includes('net')) return '📶';
  if (t.includes('gen') || t.includes('power') || t.includes('electric') || t.includes('backup')) return '⚡';
  if (t.includes('score') || t.includes('board') || t.includes('timer')) return '🔢';
  if (t.includes('gym') || t.includes('fitness') || t.includes('warm')) return '🏋️';
  if (t.includes('ev') || t.includes('charge')) return '🔌';
  if (t.includes('shoe') || t.includes('boot') || t.includes('turf')) return '👟';
  return '✨';
}

function detectRuleEmoji(text) {
  if (!text) return '📌';
  const t = String(text).toLowerCase();
  if (t.includes('shoe') || t.includes('stud') || t.includes('cleat') || t.includes('spike') || t.includes('boot')) return '👟';
  if (t.includes('smok') || t.includes('vape') || t.includes('cigar')) return '🚭';
  if (t.includes('time') || t.includes('arrive') || t.includes('early') || t.includes('punctual')) return '⏱️';
  if (t.includes('clean') || t.includes('trash') || t.includes('bin') || t.includes('waste')) return '🗑️';
  if (t.includes('food') || t.includes('eat') || t.includes('gum') || t.includes('drink')) return '🍕';
  if (t.includes('id') || t.includes('nid') || t.includes('card')) return '🪪';
  if (t.includes('overtime') || t.includes('late') || t.includes('penalty')) return '⏳';
  if (t.includes('sleep') || t.includes('nap')) return '🛌';
  if (t.includes('pet') || t.includes('dog') || t.includes('cat') || t.includes('animal')) return '🐕';
  if (t.includes('alcohol') || t.includes('liquor') || t.includes('beer')) return '🚫';
  if (t.includes('respect') || t.includes('fair') || t.includes('foul') || t.includes('fight')) return '🤝';
  return '📌';
}

const RULE_ICONS = {
  ok: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  partial: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  none: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};

/**
 * The refund ladder this venue actually runs, mirroring RefundCalculatorService.
 * It used to be a fixed 24h/6h table shown on every venue regardless of the
 * policy the refund engine would really apply.
 */
function policyTiersOf(cancelPolicy) {
  switch (cancelPolicy) {
    case 'STRICT_NO_REFUND':
      return [{ label: 'Any cancellation', sub: 'No refund', icon: RULE_ICONS.none }];
    case 'FLEXIBLE_6H':
      return [
        { label: 'Cancel 6h+ before', sub: 'Full refund', icon: RULE_ICONS.ok },
        { label: 'Cancel under 6h before', sub: 'No refund', icon: RULE_ICONS.none },
      ];
    case 'FREE_24H_50_6H':
    default:
      return [
        { label: 'Cancel 24h+ before', sub: 'Full refund', icon: RULE_ICONS.ok },
        { label: 'Cancel 6 – 24h before', sub: '50% refund', icon: RULE_ICONS.partial },
        { label: 'Cancel under 6h before', sub: 'No refund', icon: RULE_ICONS.none },
      ];
  }
}

function formatCancelSummary(cancelPolicy) {
  switch (cancelPolicy) {
    case 'STRICT_NO_REFUND':
      return 'Non-refundable';
    case 'FLEXIBLE_6H':
      return 'Free cancel until 6h before';
    case 'FREE_24H_50_6H':
    default:
      return 'Free cancel until 24h before';
  }
}

function VenueGalleryCarousel({ photos = [], venueName, verified }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const total = photos.length;

  const nextSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Auto-rotation every 4.5 seconds when not paused and multiple photos exist
  useEffect(() => {
    if (isPaused || total <= 1 || isLightboxOpen) return;
    const timer = setInterval(nextSlide, 4500);
    return () => clearInterval(timer);
  }, [isPaused, total, isLightboxOpen, nextSlide]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, nextSlide, prevSlide]);

  const activePhoto = photos[currentIndex] || photos[0] || {};

  return (
    <div
      className="venue-carousel-container"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      aria-label="Venue photo gallery carousel"
    >
      {/* ── Main Hero Frame ── */}
      <div className="venue-carousel-main">
        {/* Slides Track */}
        <div
          className="venue-carousel-track"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {photos.map((item, idx) => (
            <div
              key={item.id || idx}
              className="venue-carousel-slide"
              onClick={() => setIsLightboxOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsLightboxOpen(true)}
              aria-label={`View photo ${idx + 1} of ${total}`}
            >
              <Photo
                variant={item.variant}
                imgUrl={item.url}
                glyph={item.glyph}
                className="venue-carousel-img"
              />
              <div className="venue-carousel-gradient-overlay" />
            </div>
          ))}
        </div>

        {/* Top Badges */}
        {verified ? (
          <div className="venue-carousel-topbar" style={{ justifyContent: 'flex-end' }}>
            <Badge tone="green" dot={false} style={{ backdropFilter: 'blur(8px)', background: 'rgba(16, 185, 129, 0.25)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#fff' }}>
              ✓ Verified Venue
            </Badge>
          </div>
        ) : null}

        {/* Prev / Next Arrows */}
        {total > 1 ? (
          <>
            <button
              type="button"
              className="venue-carousel-nav-btn venue-carousel-prev"
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
              aria-label="Previous photo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button
              type="button"
              className="venue-carousel-nav-btn venue-carousel-next"
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
              aria-label="Next photo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </>
        ) : null}

        {/* Bottom Bar: Dots */}
        {total > 1 ? (
          <div className="venue-carousel-bottombar" style={{ justifyContent: 'center' }}>
            <div className="venue-carousel-dots" role="tablist" aria-label="Photo dots">
              {photos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === currentIndex}
                  className={`venue-carousel-dot ${idx === currentIndex ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Thumbnail Strip ── */}
      {total > 1 ? (
        <div className="venue-carousel-thumbs" role="tablist" aria-label="Photo thumbnails">
          {photos.map((item, idx) => (
            <button
              key={item.id || idx}
              type="button"
              role="tab"
              aria-selected={idx === currentIndex}
              className={`venue-carousel-thumb ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Select photo ${idx + 1}`}
            >
              <Photo
                variant={item.variant}
                imgUrl={item.url}
                glyph={item.glyph}
                style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
              />
            </button>
          ))}
        </div>
      ) : null}

      {/* ── Lightbox Modal ── */}
      {isLightboxOpen ? (
        <div className="venue-lightbox" onClick={() => setIsLightboxOpen(false)} role="dialog" aria-modal="true">
          <div className="venue-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="venue-lightbox-close"
              onClick={() => setIsLightboxOpen(false)}
              aria-label="Close fullscreen view"
            >
              ✕
            </button>

            <div className="venue-lightbox-view">
              <Photo
                variant={activePhoto.variant}
                imgUrl={activePhoto.url}
                glyph={activePhoto.glyph}
                className="venue-lightbox-img"
              />
            </div>

            <div className="venue-lightbox-footer">
              <div>
                <b style={{ color: '#fff', fontSize: 16 }}>{venueName}</b>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginLeft: 8 }}>
                  Photo {currentIndex + 1} of {total}
                </span>
              </div>
              {total > 1 ? (
                <div className="row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="venue-lightbox-btn"
                    onClick={prevSlide}
                    aria-label="Previous photo"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="venue-lightbox-btn"
                    onClick={nextSlide}
                    aria-label="Next photo"
                  >
                    ›
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function VenuePage() {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const session = useSession();
  const isOwner = session?.role === 'OWNER' || session?.user?.role === 'OWNER';
  const rules = useDisclosure(false);
  // Captured once per mount so the strip doesn't shift while the page is open.
  const [dates] = useState(() => nextSevenDays(new Date()));
  const [dateId, setDateId] = useState(() => dates[0].id);
  const [slotId, setSlotId] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('all');
  // Mirrors `slotId` for the stream callback, which must not depend on it —
  // re-subscribing on every selection would tear down the connection.
  const selectedSlotIdRef = useRef(slotId);
  useEffect(() => {
    selectedSlotIdRef.current = slotId;
  });


  const detail = useApi(() => getVenue(venueId), [venueId]);
  const venue = detail.data;

  const similarApi = useApi(
    () => searchVenues({ size: 4, sort: 'rating' }).then((page) =>
      page.items.filter((item) => item.slug !== venueId).slice(0, 3).map(toSimilarCard)),
    [venueId],
  );
  const similarVenues = similarApi.data ?? [];

  // Live slot availability for the selected day; refetches when the venue
  // resolves (numeric id, not the slug in the URL) or the date changes.
  const slotsApi = useApi(
    () => (venue?.id ? getVenueSlots(venue.id, dateId) : Promise.resolve([])),
    [venue?.id, dateId],
  );

  // Statuses pushed by the SSE stream since the last snapshot, keyed by slot
  // id. Kept as an overlay rather than mutating `slotsApi.data` so a refetch
  // always wins and the two sources can never drift apart permanently.
  const [liveStatus, setLiveStatus] = useState({});
  const streamKey = `${venue?.id ?? ''}@${dateId}`;
  const [lastStreamKey, setLastStreamKey] = useState(streamKey);
  if (lastStreamKey !== streamKey) {
    // Adjust-state-during-render: a stale overlay must never survive a switch
    // to another venue or day.
    setLastStreamKey(streamKey);
    setLiveStatus({});
  }

  const applyLiveChange = useCallback(
    ({ slotId: changedId, status }) => {
      setLiveStatus((current) =>
        current[changedId] === status ? current : { ...current, [changedId]: status },
      );
      // Losing the slot you were about to book is the one case worth
      // interrupting for — otherwise checkout would 409 on the hold. Read the
      // selection from a ref: doing this inside a setState updater would fire
      // the toast twice under StrictMode's double invocation.
      if (status !== 'AVAILABLE' && selectedSlotIdRef.current === changedId) {
        setSlotId(null);
        showToast('That slot was just taken — pick another time');
      }
    },
    [showToast],
  );

  const resyncSlots = useCallback(() => {
    setLiveStatus({});
    slotsApi.reload();
  }, [slotsApi]);

  useSlotStream({
    venueId: venue?.id,
    date: dateId,
    enabled: Boolean(venue?.id),
    onSlotChange: applyLiveChange,
    onResync: resyncSlots,
  });

  const slots = useMemo(
    () =>
      (slotsApi.data ?? []).map((slot) => {
        const liveOverride = liveStatus[slot.id];
        if (!liveOverride) return toGridSlot(slot);
        // The overlay only ever touches `status` — `bookable` was left at
        // whatever it was in the original fetch. That's stale the moment a
        // hold lapses: the slot was fetched while HELD (bookable: false),
        // the SSE hook's own expiry timer flips the overlay to AVAILABLE,
        // and toGridSlot's "AVAILABLE but not bookable" rule then misread
        // that stale `false` as the slot having *started*, mislabeling a
        // perfectly free slot "Started" until the next full refetch.
        return toGridSlot({
          ...slot,
          status: liveOverride,
          bookable: liveOverride === 'AVAILABLE' ? true : slot.bookable,
        });
      }),
    [slotsApi.data, liveStatus],
  );

  const specs = useMemo(() => specsOf(venue), [venue]);
  const venueAmenities = venue?.amenities;
  const amenities = useMemo(() => {
    const rawList = venueAmenities
      ? Array.isArray(venueAmenities)
        ? venueAmenities
        : String(venueAmenities).split(',').map((a) => a.trim()).filter(Boolean)
      : [];

    return rawList.map((rawKey) => {
      const normalized = rawKey.toLowerCase().replaceAll(' ', '_');
      const standard = AMENITY_VOCAB[normalized];
      const emoji = standard?.emoji ?? detectAmenityEmoji(rawKey);
      const label = standard?.label ?? rawKey.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        key: rawKey,
        label,
        emoji,
      };
    });
  }, [venueAmenities]);

  const venueRulesRaw = venue?.rules;
  const venueRulesList = useMemo(() => {
    if (venueRulesRaw) {
      const list = Array.isArray(venueRulesRaw) ? venueRulesRaw : String(venueRulesRaw).split(',').map((r) => r.trim());
      return list.filter(Boolean);
    }
    return [];
  }, [venueRulesRaw]);

  const venueAddress = venue?.address;
  const venueArea = venue?.area;
  const locationAddress = useMemo(() => {
    if (!venue) return 'House 12, Road 27, Dhanmondi, Dhaka';
    const addr = (venueAddress || '').trim();
    const area = (venueArea || '').trim();

    if (!addr && !area) return 'Dhaka, Bangladesh';

    // Collect all comma-separated segments from address and area
    const rawTokens = `${addr}, ${area}`
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const uniqueTokens = [];
    for (const token of rawTokens) {
      if (!uniqueTokens.some((u) => u.toLowerCase() === token.toLowerCase())) {
        uniqueTokens.push(token);
      }
    }

    return uniqueTokens.length > 0 ? uniqueTokens.join(', ') : 'Dhaka, Bangladesh';
  }, [venue, venueAddress, venueArea]);

  const cancelPolicy = venue?.cancelPolicy;
  const policyTiers = useMemo(() => policyTiersOf(cancelPolicy), [cancelPolicy]);

  const venuePhotos = venue?.photos;
  const venueName = venue?.name;
  const photoList = useMemo(() => {
    if (venuePhotos && venuePhotos.length > 0) {
      const list = Array.isArray(venuePhotos) ? venuePhotos : String(venuePhotos).split(',').map((p) => p.trim());
      const filtered = list.filter(Boolean);
      if (filtered.length > 0) {
        return filtered.map((url, idx) => ({
          id: `venue-photo-${idx}`,
          url,
          title: `${venueName || 'Venue'} photo ${idx + 1}`,
          variant: idx === 0 ? undefined : `alt${(idx % 3) + 1}`,
        }));
      }
    }
    return [
      { id: 'default-hero', variant: undefined, glyph: '🏟️', title: 'Main Turf Arena' },
      { id: 'default-alt1', variant: 'alt1', glyph: '🌙', title: 'Night Floodlights' },
      { id: 'default-alt2', variant: 'alt2', glyph: '🥅', title: 'Goal Area' },
      { id: 'default-alt3', variant: 'alt3', glyph: '🏃', title: 'Player Bench & Pitch' },
    ];
  }, [venuePhotos, venueName]);

  const pitch = venue?.pitches?.[0];
  /** Cheapest active rule drives the headline "from" price. */
  const cheapestRule = useMemo(() => {
    const rules = venue?.pricing ?? [];
    return rules.length
      ? rules.reduce((min, rule) => (Number(rule.rate) < Number(min.rate) ? rule : min))
      : null;
  }, [venue]);
  const offPeakRule = venue?.pricing?.find((rule) => rule.windowType === 'OFF_PEAK');
  const slotDuration = cheapestRule?.slotDurationMin ?? 90;
  const pitchLine = pitch
    ? [pitch.name, formatLabel(pitch.format), `${slotDuration}-min slots`].filter(Boolean).join(' · ')
    : `${slotDuration}-min slots`;

  const selectedDateLabel = useMemo(() => {
    const picked = dates.find((date) => date.id === dateId) ?? dates[0];
    return new Date(`${picked.id}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }, [dates, dateId]);

  const mapMarker = useMemo(
    () =>
      venue?.lat != null && venue?.lng != null
        ? [{ id: venue.slug, lat: Number(venue.lat), lng: Number(venue.lng), label: '⚽', title: venue.name }]
        : [],
    [venue],
  );

  const openDirections = () => {
    if (venue?.lat != null && venue?.lng != null) {
      window.open(
        `https://www.openstreetmap.org/directions?to=${venue.lat}%2C${venue.lng}`,
        '_blank',
        'noopener',
      );
    } else {
      showToast('Directions unavailable — venue location not loaded');
    }
  };

  // Saved state for this venue's heart button. The venue page is public, so
  // the caller-scoped bookmark list is only read once there is a session.
  const signedIn = Boolean(getToken());

  const [reviewPageSize, setReviewPageSize] = useState(10);
  const reviewsApi = useApi(
    () => (venueId ? getVenueReviews(venueId, { page: 0, size: reviewPageSize }) : Promise.resolve(null)),
    [venueId, reviewPageSize],
  );
  const allReviews = Array.isArray(reviewsApi.data?.items) ? reviewsApi.data.items : [];
  
  const name = venue?.name ?? (detail.loading ? 'Loading Venue...' : 'Turf Venue');
  const metaLine = venue ? [venue.address, venue.area].filter(Boolean).join(', ') : '';

  const reviewCount = useMemo(() => {
    if (venue?.reviewCount != null && venue.reviewCount > 0) return venue.reviewCount;
    if (reviewsApi.data?.totalItems != null && reviewsApi.data.totalItems > 0) return reviewsApi.data.totalItems;
    return allReviews.length;
  }, [venue?.reviewCount, reviewsApi.data?.totalItems, allReviews.length]);

  const rating = useMemo(() => {
    const raw = venue?.rating ?? reviewsApi.data?.averageRating;
    if (raw != null && Number(raw) > 0) {
      return Number(raw).toFixed(1);
    }
    if (allReviews.length > 0) {
      const avg = allReviews.reduce((sum, r) => sum + (r.overallRating || r.rating || 0), 0) / allReviews.length;
      return avg.toFixed(1);
    }
    return '0.0';
  }, [venue?.rating, reviewsApi.data?.averageRating, allReviews]);

  // The "Parents" tab carried a hardcoded count of 18 and filtered nothing.
  const parentReviews = allReviews.filter((review) => review.tags?.includes('parent'));
  const reviewItems = reviewFilter === 'parents' ? parentReviews : allReviews;
  const reviewFilters = [
    { id: 'all', label: `All (${allReviews.length})` },
    { id: 'parents', label: `Parents (${parentReviews.length})` },
  ];
  const [isSaved, setIsSaved] = useState(false);
  useEffect(() => {
    if (!signedIn) return;
    getSavedVenues()
      .then((items) => setIsSaved(items.some((item) => item.slug === venueId)))
      .catch(() => {});
  }, [venueId, signedIn]);

  const onToggleSave = async () => {
    if (!signedIn) {
      showToast('Sign in to save venues');
      return;
    }
    try {
      const { saved } = await toggleSavedVenue(venueId);
      setIsSaved(saved);
      showToast(saved ? '❤️ Saved to favourites' : 'Removed from favourites');
    } catch {
      showToast('Could not update saved venues — try again');
    }
  };

  const [slotWarn, setSlotWarn] = useState(false);
  const [bookChecking, setBookChecking] = useState(false);

  const selectedSlot = slots.find((slot) => slot.id === slotId);
  const activeSlotPrice = selectedSlot && selectedSlot.rawPrice != null ? bdt(selectedSlot.rawPrice) : null;
  const activeSlotDuration = selectedSlot?.durationMinutes ?? slotDuration;
  // Checkout has no slot-by-id endpoint, so it re-reads the slot from this
  // venue's day list — hence the venue slug and date travel with the slotId.
  const checkoutHref = selectedSlot
    ? `${paths.player.checkout}?slotId=${selectedSlot.id}&venue=${encodeURIComponent(venueId)}&date=${encodeURIComponent(dateId)}`
    : null;

  // Checked here, before navigating, rather than letting checkout make the
  // call and bounce back with a 409 — a player who already has a different
  // slot on hold gets the "you already have one in progress" message right
  // where they clicked "Book", not after a redirect that has to unwind.
  // Skipped when resuming their own hold (`selectedSlot.mine`): that IS the
  // active hold, so there is nothing to conflict with.
  const handleBookClick = async (e) => {
    e.preventDefault();
    if (!signedIn) {
      if (selectedSlot && checkoutHref) {
        navigate(`${paths.auth}?redirect=${encodeURIComponent(checkoutHref)}`);
      } else {
        navigate(`${paths.auth}?redirect=${encodeURIComponent(window.location.pathname)}`);
      }
      return;
    }
    if (!selectedSlot) {
      setSlotWarn(true);
      return;
    }
    if (selectedSlot.mine) {
      navigate(checkoutHref);
      return;
    }
    setBookChecking(true);
    try {
      const active = await getActiveHold();
      if (active?.slotId && String(active.slotId) !== String(selectedSlot.id)) {
        showToast(
          active.pitchName
            ? `You already have a slot on hold at ${active.pitchName} — finish or release it first`
            : 'You already have a slot on hold elsewhere — finish or release it first',
        );
        return;
      }
      navigate(checkoutHref);
    } catch {
      // Fail open: an unreachable active-hold check must not block a
      // legitimate booking attempt — checkout's own hold call still
      // enforces the one-hold rule server-side.
      navigate(checkoutHref);
    } finally {
      setBookChecking(false);
    }
  };

  if (detail.error && detail.error.status === 404) {
    return (
      <>
        <PageTitle title="Venue not found" />
        <main className="wrap" style={{ paddingTop: 40 }} id="main">
          <h1 style={{ fontSize: 24 }}>Venue not found</h1>
          <p className="subtle">This venue may have been removed or the link is incorrect.</p>
          <Link to={paths.player.explore}>← Back to Explore</Link>
        </main>
      </>
    );
  }

  const isOffline = venue != null && venue.status != null && !['LIVE', 'PUBLISHED'].includes(venue.status.toUpperCase());

  return (
    <>
      <PageTitle title={name} />
      <main className="wrap" style={{ paddingTop: 20 }} id="main">
        {isOffline && (
          <Alert tone="warn" icon="⚠️" title="Turf is currently unavailable" style={{ marginBottom: 16 }}>
            This turf is currently offline or suspended. New bookings are temporarily disabled.
          </Alert>
        )}
        {detail.error && detail.error.status !== 404 ? (
          <p className="subtle" role="status" style={{ marginBottom: 10 }}>
            Live venue data unavailable — nothing below is confirmed.{' '}
            <button type="button" onClick={detail.reload} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 700 }}>
              Retry
            </button>
          </p>
        ) : null}
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {isOwner ? (
            <>
              <Link to={paths.owner.venueSetup}>Venue Setup</Link>
              <span className="sep">/</span>
              <span>{name}</span>
            </>
          ) : (
            <>
              <Link to={paths.player.explore}>Explore</Link>
              <span className="sep">/</span>
              <Link to={paths.player.explore}>{venue?.area ?? '—'}</Link>
              <span className="sep">/</span>
              <span>{name}</span>
            </>
          )}
        </nav>

        {/* ── Photo Gallery Carousel ── */}
        <VenueGalleryCarousel photos={photoList} venueName={name} verified={venue?.verified} />

        {/* ── Venue title & actions ── */}
        <div className="between" style={{ marginTop: 28, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <h1 style={{ fontSize: 30, margin: 0 }}>{name}</h1>
              {venue == null || venue.verified ? <Verified /> : null}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
                color: 'var(--text-3)',
                fontSize: 13.5,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" strokeWidth="2.2" {...svgProps}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {metaLine}
              </span>
              {reviewCount > 0 ? (
                <>
                  <span className="rating">{rating}</span>
                  <span>({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</span>
                </>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="rating" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600 }}>New</span>
                  <span>(No reviews yet)</span>
                </span>
              )}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <IconButton
              label={isSaved ? 'Remove from saved' : 'Save venue'}
              onClick={onToggleSave}
              style={isSaved ? { color: 'var(--danger)' } : undefined}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </IconButton>
            <IconButton
              label="Share venue"
              onClick={async () => {
                const result = await shareOrCopy({
                  title: name,
                  text: `Book ${name} on TurfChai`,
                  url: window.location.href,
                });
                showToast(
                  result === 'shared'
                    ? 'Shared ✓'
                    : result === 'copied'
                      ? 'Link copied — share with your team'
                      : 'Could not copy the link — copy it from the address bar',
                );
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </IconButton>
          </div>
        </div>

        {/* ── Detail grid ── */}
        <div className="detail-grid" style={{ marginTop: 28 }}>
          <div>
            {/* Live availability */}
            <section className="vsection" id="slots">
              <div className="between" style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 20, margin: 0 }}>Live availability</h2>
                {slotsApi.error ? <Badge tone="amber" dot={false}>Unavailable</Badge> : null}
              </div>

              <DateStrip
                dates={dates}
                selectedId={dateId}
                onSelect={(date) => {
                  setDateId(date.id);
                  setSlotId(null);
                }}
                label="Pick a date"
              />

              <div className="between" style={{ marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                  {pitchLine}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  10-min buffer between slots
                </span>
              </div>

              {slotsApi.loading ? (
                <p className="subtle" role="status" style={{ margin: '8px 0' }}>
                  Loading available slots…
                </p>
              ) : slots.length === 0 ? (
                <p className="subtle" role="status" style={{ margin: '8px 0' }}>
                  {slotsApi.error
                    ? 'Could not load slots for this date — try another day.'
                    : 'No slots scheduled for this date yet — try another day.'}
                </p>
              ) : (
                <SlotGrid
                  slots={slots}
                  selectedId={slotId}
                  onSelect={(slot) => { setSlotId(slot.id); setSlotWarn(false); }}
                  label="Available time slots"
                />
              )}

              <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                {offPeakRule
                  ? `Off-peak price applies ${formatTime(offPeakRule.windowStart)}\u2013${formatTime(offPeakRule.windowEnd)}. Arrive 10 min early.`
                  : 'Arrive 10 min early.'}
              </p>
            </section>

            {/* Surface & amenities */}
            <section className="vsection">
              <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>Surface &amp; amenities</h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', margin: 0 }}>
                Everything included in your booking
              </p>

              <div className="spec-grid">
                {specs.map((spec) => (
                  <div key={spec.label} className="spec-cell">
                    <div className="spec-label">{spec.label}</div>
                    <div className="spec-value">{spec.value}</div>
                    {spec.sub ? <div className="spec-sub">{spec.sub}</div> : null}
                  </div>
                ))}
              </div>

              {amenities.length > 0 ? (
                <div className="amen-grid">
                  {amenities.map((amenity) => (
                    <div key={amenity.key} className="amen-item">
                      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{amenity.emoji}</span>
                      <span style={{ fontWeight: 500, fontSize: 14.5 }}>{amenity.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 18 }}>
                  {detail.loading ? 'Loading amenities…' : 'This venue hasn’t listed any amenities yet.'}
                </p>
              )}
            </section>

            {/* Rules & cancellation (collapsible) */}
            <section className="vsection">
              <button
                className="collapse-btn"
                type="button"
                id="rules-toggle"
                aria-expanded={rules.isOpen}
                aria-controls="rules-body"
                onClick={rules.toggle}
              >
                <h2 style={{ fontSize: 20, margin: 0 }}>Rules &amp; cancellation</h2>
                <svg className="chevron" width="20" height="20" viewBox="0 0 24 24" strokeWidth="2.5" {...svgProps}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              <div
                className={rules.isOpen ? 'collapse-body open' : 'collapse-body'}
                id="rules-body"
                role="region"
                aria-labelledby="rules-toggle"
              >
                <ul className="rules-list">
                  {venueRulesList.map((rule) => {
                    const trimmed = rule.trim();
                    const hasLeadingEmoji = /^\p{Emoji}/u.test(trimmed);
                    const emoji = hasLeadingEmoji ? null : detectRuleEmoji(trimmed);
                    return (
                      <li key={rule} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5 }}>
                        {emoji ? (
                          <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{emoji}</span>
                        ) : null}
                        <span>{trimmed}</span>
                      </li>
                    );
                  })}
                  {venueRulesList.length === 0 ? (
                    <li className="subtle">This venue has not published any house rules.</li>
                  ) : null}
                </ul>

                <div className="policy-tiers">
                  {policyTiers.map((tier) => (
                    <div key={tier.label} className="policy-tier">
                      {tier.icon}
                      <div>
                        <div className="pt-label">{tier.label}</div>
                        <div className="pt-sub">{tier.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* ── Sticky booking panel ── */}
          <aside className="booking-panel">
            <div className="between" style={{ marginBottom: 4, alignItems: 'flex-start' }}>
              <div>
                {activeSlotPrice ? (
                  <div>
                    <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                      {activeSlotPrice}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 4 }}>
                      / {activeSlotDuration} min
                    </span>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)' }}>
                      No slot selected
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      Select a time slot to see price
                    </div>
                  </div>
                )}
              </div>
              <Badge tone="green">Instant</Badge>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 12,
                fontSize: 12.5,
                color: 'var(--text-3)',
              }}
            >
              {reviewCount > 0 ? (
                <>
                  <span className="rating" style={{ fontSize: 12.5 }}>
                    {rating}
                  </span>
                  <span>· {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
                </>
              ) : (
                <>
                  <span className="rating" style={{ fontSize: 12.5, background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600 }}>
                    New
                  </span>
                  <span>· No reviews yet</span>
                </>
              )}
            </div>

            <hr />

            <div style={{ marginBottom: 12 }}>
              <div className="brow">
                <span className="brow-label">Date</span>
                <span className="brow-value">{selectedDateLabel}</span>
              </div>
              <div className="brow">
                <span className="brow-label">Slot</span>
                <b
                  className="brow-value"
                  style={selectedSlot ? undefined : { color: 'var(--text-3)', fontWeight: 500 }}
                >
                  {selectedSlot ? selectedSlot.time : 'Select a slot'}
                </b>
              </div>
              <div className="brow">
                <span className="brow-label">Pitch</span>
                <span className="brow-value">
                  {selectedSlot?.pitchName
                    ? [selectedSlot.pitchName, pitch ? formatLabel(pitch.format) : null].filter(Boolean).join(' · ')
                    : pitch
                    ? [pitch.name, formatLabel(pitch.format)].filter(Boolean).join(' · ')
                    : '—'}
                </span>
              </div>
              <div className="brow">
                <span className="brow-label">Arrive</span>
                <span className="brow-value">10 min early</span>
              </div>
            </div>

            <Button
              variant={isOffline ? 'tertiary' : 'primary'}
              block
              onClick={isOffline ? () => showToast('Turf is currently offline / unavailable.') : handleBookClick}
              loading={!isOffline && bookChecking}
              style={{ minHeight: 44, fontSize: 14, opacity: isOffline ? 0.6 : 1 }}
            >
              {isOffline
                ? 'Turf Currently Offline'
                : !signedIn
                  ? 'Sign in to book this slot'
                  : 'Book this slot'}
            </Button>
            {slotWarn && (
              <p
                role="alert"
                style={{
                  fontSize: 12.5,
                  color: 'var(--danger)',
                  fontWeight: 600,
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: 1.5,
                }}
              >
                ⚠️ Please select a time slot before booking.
              </p>
            )}
            <p
              style={{
                fontSize: 11.5,
                color: 'var(--text-3)',
                textAlign: 'center',
                marginTop: slotWarn ? 4 : 8,
                lineHeight: 1.5,
              }}
            >
              Locked 5 min while you pay · {formatCancelSummary(venue?.cancelPolicy)}
            </p>
          </aside>
        </div>

        {/* Location */}
        <section className="vsection">
          <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>Location</h2>
          <p style={{ fontSize: 14, color: 'var(--text-3)', margin: 0 }}>
            {locationAddress}
          </p>

          {mapMarker.length > 0 ? (
            <div className="map-ph" style={{ padding: 0 }}>
              <Suspense fallback={<div className="map-ph" aria-hidden="true" style={{ margin: 0 }} />}>
                <VenueMap markers={mapMarker} zoom={15} style={{ borderRadius: 16 }} />
              </Suspense>
            </div>
          ) : (
            <div className="map-ph" role="img" aria-label={`Map showing ${name}`}>
              <div className="map-ph-pin">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--brand)" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span>{metaLine}</span>
              </div>
            </div>
          )}

          <div className="row" style={{ marginTop: 14 }}>
            <Button size="sm" onClick={openDirections}>
              <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2.5" {...svgProps}>
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              Get directions
            </Button>
          </div>
        </section>

        {/* Reviews */}
        <section className="vsection" id="reviews">
          <div className="between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 20, margin: 0 }}>Reviews</h2>
              {reviewCount > 0 ? (
                <>
                  <span className="rating" style={{ fontSize: 16 }}>
                    {rating}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>({reviewCount})</span>
                </>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>(No reviews yet)</span>
              )}
            </div>
            {reviewCount > 0 ? (
              <Segmented
                items={reviewFilters}
                value={reviewFilter}
                onChange={setReviewFilter}
                label="Review filter"
              />
            ) : null}
          </div>

          {reviewCount === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--surface-2)', marginTop: 12 }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-3)' }}>
                No player reviews submitted yet for {name}. Be the first to leave a review after your booking! ⚽
              </p>
            </div>
          ) : reviewsApi.loading ? (
            <div className="panel" style={{ marginTop: 12 }}>
              <p className="subtle" role="status" style={{ margin: 0 }}>
                Loading reviews…
              </p>
            </div>
          ) : reviewsApi.error ? (
            <div className="panel" style={{ marginTop: 12 }}>
              <p className="subtle" style={{ margin: 0 }}>
                {toUserMessage(reviewsApi.error, 'Could not load reviews.')}{' '}
                <button type="button" className="btn btn-sm btn-tertiary" onClick={reviewsApi.reload}>
                  Try again
                </button>
              </p>
            </div>
          ) : reviewItems.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--surface-2)', marginTop: 12 }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-3)' }}>
                No published reviews to show yet.
              </p>
            </div>
          ) : (
            <>
              <div className="reviews-grid">
                {reviewItems.map((review) => (
                  <div className="review-item" key={review.id}>
                    <div className="between" style={{ marginBottom: 12 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar size="sm" name={review.authorName} initials={review.authorInitials} />
                        <div>
                          <b style={{ fontSize: 14, display: 'block' }}>{review.authorName}</b>
                          <Badge tone="blue" dot={false} style={{ fontSize: 11, padding: '1.5px 8px' }}>
                            Verified booking
                          </Badge>
                        </div>
                      </div>
                      <Stars value={review.overallRating ?? 0} />
                    </div>
                    {review.comment ? (
                      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 8px' }}>{review.comment}</p>
                    ) : null}
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Verified player review'}
                    </span>
                    {review.ownerResponse ? (
                      <div
                        style={{
                          marginTop: 10,
                          paddingLeft: 10,
                          borderLeft: '3px solid var(--brand)',
                        }}
                      >
                        <b style={{ fontSize: 11, color: 'var(--brand-600)' }}>RESPONSE FROM THE VENUE</b>
                        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '2px 0 0' }}>
                          {review.ownerResponse}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {reviewsApi.data?.hasMore ? (
                <Button
                  size="sm"
                  style={{ marginTop: 12 }}
                  disabled={reviewsApi.loading}
                  onClick={() => setReviewPageSize((size) => size + 10)}
                >
                  Show more reviews
                </Button>
              ) : null}
            </>
          )}
        </section>

        {/* Similar venues */}
        {!isOwner && similarVenues.length > 0 ? (
          <section style={{ paddingTop: 32, paddingBottom: 40 }}>
            <h2 style={{ fontSize: 20, margin: '0 0 20px' }}>Similar venues nearby</h2>
            <div className="grid3">
              {similarVenues.map((venue) => (
                <Link
                  key={venue.id}
                  className="venue-card"
                  to={paths.player.venue(venue.id)}
                  style={{ textDecoration: 'none', color: 'var(--text)' }}
                >
                  <Photo variant={venue.photoVariant} height={110} />
                  <div className="body">
                    <div className="name small">{venue.name}</div>
                    <div className="between subtle small">
                      <span>{venue.distance}</span>
                      <b className="num" style={{ color: 'var(--text)' }}>
                        {venue.price}
                      </b>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {/* ── Mobile sticky bar ── */}
      <div className="mobilebar" id="mobileBar">
        <div className="mobilebar-inner">
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              {activeSlotPrice ? (
                <>
                  <span style={{ fontSize: 21, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                    {activeSlotPrice}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>/ {activeSlotDuration} min</span>
                </>
              ) : (
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>
                  No slot selected
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
              {selectedDateLabel} · <span>{selectedSlot ? selectedSlot.time : 'select a slot'}</span>
            </div>
          </div>
          <Button variant="primary" onClick={handleBookClick} loading={bookChecking}>
            {!signedIn ? 'Sign in to book' : 'Book slot'}
          </Button>
        </div>
      </div>
    </>
  );
}
