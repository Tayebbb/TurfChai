import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { similarVenues } from '@/data/venues';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './VenuePage.css';

const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const DATES = [
  { id: '4', weekday: 'Mon', day: '4' },
  { id: '5', weekday: 'Tue', day: '5' },
  { id: '6', weekday: 'Wed', day: '6' },
  { id: '7', weekday: 'Thu', day: '7' },
  { id: '8', weekday: 'Fri', day: '8' },
  { id: '9', weekday: 'Sat', day: '9' },
  { id: '10', weekday: 'Sun', day: '10' },
];

const SLOTS = [
  { id: 'slot-1600', time: '4:00 PM', price: 'Booked', status: 'booked' },
  { id: 'slot-1740', time: '5:40 PM', price: 'Booked', status: 'booked' },
  { id: 'slot-1930', time: '7:30 PM', price: 'ends 9:00 · ৳2,500', status: 'available' },
  { id: 'slot-2110', time: '9:10 PM', price: 'Held', status: 'held' },
  { id: 'slot-2250', time: '10:50 PM', price: 'ends 12:20 · ৳2,000', status: 'available' },
];

const GALLERY = [
  { id: 'hero', variant: undefined },
  { id: 'alt1', variant: 'alt1' },
  { id: 'alt2', variant: 'alt2' },
  { id: 'alt3', variant: 'alt3' },
];

const SPECS = [
  { label: 'Surface', value: 'FIFA-grade Artificial Grass', sub: 'Relaid Jan 2026 · shock pad' },
  { label: 'Lighting', value: '200-lux LED Floodlights', sub: 'Full night coverage' },
  { label: 'Format', value: '7-a-side', sub: 'Max 16 players' },
  { label: 'Booking', value: 'Instant Confirmation', sub: 'No approval needed' },
];

const amenSvg = { ...svgProps, width: 24, height: 24, viewBox: '0 0 24 24', strokeWidth: '1.8' };

const AMENITIES = [
  {
    label: 'Free parking (12 spots)',
    icon: (
      <svg {...amenSvg}>
        <rect x="1" y="3" width="15" height="13" rx="2" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    label: 'Changing room & shower',
    icon: (
      <svg {...amenSvg}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
  },
  {
    label: 'Drinking water',
    icon: (
      <svg {...amenSvg}>
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    label: 'Bibs & balls provided',
    icon: (
      <svg {...amenSvg}>
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="12" y1="8" x2="12" y2="16" />
      </svg>
    ),
  },
  {
    label: 'Spectator seating',
    icon: (
      <svg {...amenSvg}>
        <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
  {
    label: 'Youth-friendly',
    icon: (
      <svg {...amenSvg}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

const RULES = [
  'Turf shoes or mouldies only — no metal studs',
  'Max 16 players per booking · no outside food on pitch',
  'Slots end strictly on time — plan accordingly',
];

const POLICY_TIERS = [
  {
    label: 'Cancel 24h+ before',
    sub: 'Full refund',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  {
    label: 'Cancel 6 – 24h before',
    sub: '50% refund',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: 'Cancel under 6h before',
    sub: 'No refund',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
];

const REVIEW_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'parents', label: 'Parents (18)' },
];

export default function VenuePage() {
  const { showToast } = useToast();
  const rules = useDisclosure(false);
  const [dateId, setDateId] = useState('4');
  const [slotId, setSlotId] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('all');

  const selectedSlot = SLOTS.find((slot) => slot.id === slotId);

  return (
    <>
      <PageTitle title="Kick Off Arena" />
      <main className="wrap" style={{ paddingTop: 20 }} id="main">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to={paths.player.explore}>Explore</Link>
          <span className="sep">/</span>
          <Link to={paths.player.explore}>Dhanmondi</Link>
          <span className="sep">/</span>
          <span>Kick Off Arena</span>
        </nav>

        {/* ── Gallery ── */}
        <div className="vgallery" aria-label="Venue photos">
          {GALLERY.map((photo) => (
            <Photo key={photo.id} variant={photo.variant} />
          ))}
          <Photo variant="court" className="photo-more">
            <div className="photo-more-overlay">+9 photos</div>
          </Photo>
        </div>

        {/* ── Venue title & actions ── */}
        <div className="between" style={{ marginTop: 28, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <h1 style={{ fontSize: 30, margin: 0 }}>Kick Off Arena</h1>
              <Verified />
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
                Road 27, Dhanmondi · 1.2 km
              </span>
              <span className="rating">4.8</span>
              <span>(214 reviews)</span>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <IconButton label="Save venue" onClick={() => showToast('Saved to favourites')}>
              <svg width="17" height="17" viewBox="0 0 24 24" strokeWidth="2" {...svgProps}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </IconButton>
            <IconButton
              label="Share venue"
              onClick={() => showToast('Link copied — share with your team')}
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
        <div className="detail-grid" style={{ marginTop: 36 }}>
          <div>
            {/* Live availability */}
            <section className="vsection" id="slots">
              <div className="between" style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 20, margin: 0 }}>Live availability</h2>
                <Badge tone="green">Real-time</Badge>
              </div>

              <DateStrip
                dates={DATES}
                selectedId={dateId}
                onSelect={(date) => setDateId(date.id)}
                label="Pick a date"
                className="datestrip"
                style={{ marginBottom: 22 }}
              />

              <div className="between" style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                  Pitch 2 · 7-a-side · 90-min slots
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  10-min buffer between slots
                </span>
              </div>

              <SlotGrid
                slots={SLOTS}
                selectedId={slotId}
                onSelect={(slot) => setSlotId(slot.id)}
                label="Available time slots"
              />

              <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                Off-peak price applies after 10:30 PM. Arrive 10 min early.
              </p>
            </section>

            {/* Surface & amenities */}
            <section className="vsection">
              <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>Surface &amp; amenities</h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', margin: 0 }}>
                Everything included in your booking
              </p>

              <div className="spec-grid">
                {SPECS.map((spec) => (
                  <div key={spec.label} className="spec-cell">
                    <div className="spec-label">{spec.label}</div>
                    <div className="spec-value">{spec.value}</div>
                    <div className="spec-sub">{spec.sub}</div>
                  </div>
                ))}
              </div>

              <div className="amen-grid">
                {AMENITIES.map((amenity) => (
                  <div key={amenity.label} className="amen-item">
                    {amenity.icon}
                    <span>{amenity.label}</span>
                  </div>
                ))}
              </div>
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
                  {RULES.map((rule) => (
                    <li key={rule}>
                      <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2.5" {...svgProps}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {rule}
                    </li>
                  ))}
                </ul>

                <div className="policy-tiers">
                  {POLICY_TIERS.map((tier) => (
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
            <div className="between" style={{ marginBottom: 2 }}>
              <div>
                <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                  ৳2,500
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 3 }}>/ 90 min</span>
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
              <span className="rating" style={{ fontSize: 12.5 }}>
                4.8
              </span>
              <span>· 214 reviews</span>
            </div>

            <hr />

            <div style={{ marginBottom: 12 }}>
              <div className="brow">
                <span className="brow-label">Date</span>
                <span className="brow-value">Mon 4 Aug</span>
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
                <span className="brow-value">Pitch 2 · 7-a-side</span>
              </div>
              <div className="brow">
                <span className="brow-label">Arrive</span>
                <span className="brow-value">10 min early</span>
              </div>
            </div>

            <Button
              variant="primary"
              block
              to={paths.player.checkout}
              style={{ minHeight: 44, fontSize: 14 }}
            >
              Book this slot
            </Button>
            <p
              style={{
                fontSize: 11.5,
                color: 'var(--text-3)',
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Locked 5 min while you pay · Free cancel until 24h before
            </p>
          </aside>
        </div>

        {/* Location */}
        <section className="vsection">
          <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>Location</h2>
          <p style={{ fontSize: 14, color: 'var(--text-3)', margin: 0 }}>
            House 12, Road 27, Dhanmondi, Dhaka
          </p>

          <div className="map-ph" role="img" aria-label="Map showing Kick Off Arena at Road 27 Dhanmondi">
            <div className="map-ph-pin">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--brand)" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span>Road 27, Dhanmondi</span>
            </div>
          </div>

          <div className="row" style={{ marginTop: 14, gap: 12 }}>
            <Button size="sm" onClick={() => showToast('Opening in Maps')}>
              <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2.5" {...svgProps}>
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              Get directions
            </Button>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>~12 min from Dhanmondi 32</span>
          </div>
        </section>

        {/* Reviews */}
        <section className="vsection" id="reviews">
          <div className="between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 20, margin: 0 }}>Reviews</h2>
              <span className="rating" style={{ fontSize: 16 }}>
                4.8
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>(214)</span>
            </div>
            <Segmented
              items={REVIEW_FILTERS}
              value={reviewFilter}
              onChange={setReviewFilter}
              label="Review filter"
            />
          </div>

          <div className="reviews-grid">
            <div className="review-item">
              <div className="between" style={{ marginBottom: 12 }}>
                <div className="row" style={{ gap: 10 }}>
                  <Avatar size="sm" name="Tanvir Ahmed" initials="TA" />
                  <div>
                    <b style={{ fontSize: 14, display: 'block' }}>Tanvir Ahmed</b>
                    <Badge tone="blue" dot={false} style={{ fontSize: 11, padding: '1.5px 8px' }}>
                      Verified booking
                    </Badge>
                  </div>
                </div>
                <Stars value={5} />
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 8px' }}>
                Best turf in Dhanmondi. Grass is genuinely new, floodlights are bright, handover was
                on time. Shower pressure could be better.
              </p>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                28 Jul 2026 · Surface 5 · Lighting 5 · Cleanliness 4
              </span>
            </div>

            <div className="review-item">
              <div className="between" style={{ marginBottom: 12 }}>
                <div className="row" style={{ gap: 10 }}>
                  <Avatar size="sm" tone="c" name="Shahana Nasrin" initials="SN" />
                  <div>
                    <b style={{ fontSize: 14, display: 'block' }}>Shahana Nasrin</b>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <Badge tone="blue" dot={false} style={{ fontSize: 11, padding: '1.5px 8px' }}>
                        Verified
                      </Badge>
                      <Badge tone="gray" dot={false} style={{ fontSize: 11, padding: '1.5px 8px' }}>
                        Parent
                      </Badge>
                    </div>
                  </div>
                </div>
                <Stars value={4} />
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 8px' }}>
                Brought my 11-year-old&apos;s team here. Staff were patient, seating for parents,
                pitch edges padded. Parking fills up by 5 PM.
              </p>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                21 Jul 2026 · Safety 5 · Youth-friendliness 5
              </span>
              <div className="panel" style={{ marginTop: 12, background: 'var(--surface)' }}>
                <b style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                  Kick Off Arena replied
                </b>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                  Thank you Shahana! Weekend mornings have the most parking — see you again.
                </p>
              </div>
            </div>
          </div>

          <Button size="sm" style={{ marginTop: 12 }} onClick={() => showToast('Loading all reviews…')}>
            Show all 214 reviews
          </Button>
        </section>

        {/* Similar venues */}
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
      </main>

      {/* ── Mobile sticky bar ── */}
      <div className="mobilebar" id="mobileBar">
        <div className="mobilebar-inner">
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 21, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                ৳2,500
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>/ 90 min</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
              Mon 4 Aug · <span>{selectedSlot ? selectedSlot.time : 'select a slot'}</span>
            </div>
          </div>
          <Button variant="primary" to={paths.player.checkout}>
            Book slot
          </Button>
        </div>
      </div>
    </>
  );
}
