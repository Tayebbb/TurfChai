import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Card, GlassCard } from '@/components/cards/Card';
import { PageTitle } from '@/components/common/PageTitle';
import { Grid, Row } from '@/components/layout/Primitives';
import { Section, SectionHead } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Photo } from '@/components/ui/Photo';
import { Select } from '@/components/forms/Field';
import { searchVenues } from '@/api/venues';
import { useApi } from '@/hooks/useApi';
import { paths } from '@/routes/paths';
import './LandingPage.css';

// These mirror the Explore filters, which is where the hero search sends you.
const LOCATIONS = [
  { label: 'Any area', value: '' },
  { label: 'Dhanmondi', value: 'Dhanmondi' },
  { label: 'Mohammadpur', value: 'Mohammadpur' },
  { label: 'Mirpur', value: 'Mirpur' },
  { label: 'Uttara', value: 'Uttara' },
  { label: 'Banani', value: 'Banani' },
  { label: 'Gulshan', value: 'Gulshan' },
];

const START_TIMES = [
  { label: 'Any time', value: '' },
  { label: 'Morning · 8:00 AM', value: '08:00' },
  { label: 'Afternoon · 2:00 PM', value: '14:00' },
  { label: 'Evening · 7:00 PM', value: '19:00' },
  { label: 'Night · 9:00 PM', value: '21:00' },
];

const SPORTS = [
  { label: 'Any sport', value: '' },
  { label: 'Football', value: 'Football' },
  { label: 'Cricket', value: 'Cricket' },
  { label: 'Badminton', value: 'Badminton' },
  { label: 'Basketball', value: 'Basketball' },
];

const HOW_IT_WORKS = [
  {
    id: 'search',
    glyph: '🔍',
    title: 'Search live slots',
    body: 'Pick your area, time, and sport — see every open slot with the exact ৳ price.',
  },
  {
    id: 'book',
    glyph: '🔒',
    title: 'Book & pay securely',
    body: 'Your slot is locked while you pay with bKash, Nagad, or card — split it with your team.',
  },
  {
    id: 'play',
    glyph: '🎉',
    title: 'Play & earn rewards',
    body: 'Show your QR ticket at the gate. Points land in your wallet after every match.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [area, setArea] = useState('');
  const [openAt, setOpenAt] = useState('');
  const [sport, setSport] = useState('');

  // The cards and the venue count are whatever the catalogue actually holds.
  const venuesApi = useApi(() => searchVenues({ page: 0, size: 3, sort: 'rating' }), []);
  const venues = Array.isArray(venuesApi.data?.items) ? venuesApi.data.items : [];
  const totalVenues = venuesApi.data?.totalItems;

  const runSearch = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (area) params.set('area', area);
    if (openAt) params.set('openAt', openAt);
    if (sport) params.set('sport', sport);
    const query = params.toString();
    navigate(query ? `${paths.player.explore}?${query}` : paths.player.explore);
  };

  return (
    <>
      <PageTitle title="Book verified turfs in seconds" />

      {/* HERO */}
      <section className="hero centered">
        <div className="wrap">
          <Badge tone="green">Real-time availability across Dhaka</Badge>
          <h1 style={{ marginTop: 16 }}>
            Book Sports Venues in
            <br />
            <span className="accent">Dhaka, Instantly.</span>
          </h1>
          <p className="lede" style={{ maxWidth: 560 }}>
            Discover verified turfs, cricket grounds, and badminton courts. Book in seconds, split
            with your team, earn rewards — all in one place.
          </p>

          <form className="hero-search" role="search" aria-label="Find a turf" onSubmit={runSearch}>
            <div className="hs-grid">
              <div className="hs-cell">
                <label htmlFor="hero-area">📍 Location</label>
                <Select id="hero-area" value={area} onChange={(e) => setArea(e.target.value)}>
                  {LOCATIONS.map((o) => (
                    <option key={o.label} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="hs-cell">
                <label htmlFor="hero-time">🕖 Time</label>
                <Select id="hero-time" value={openAt} onChange={(e) => setOpenAt(e.target.value)}>
                  {START_TIMES.map((o) => (
                    <option key={o.label} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="hs-cell">
                <label htmlFor="hero-sport">⚽ Sport</label>
                <Select id="hero-sport" value={sport} onChange={(e) => setSport(e.target.value)}>
                  {SPORTS.map((o) => (
                    <option key={o.label} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <Button variant="primary" size="lg" block type="submit">
              🔍 Find Available Turfs →
            </Button>
          </form>

          <div className="hero-links">
            <Link to={paths.solo.openGames}>▷ Join an Open Game</Link>
            <span className="subtle">·</span>
            <Link to={paths.owner.onboarding}>List Your Venue</Link>
          </div>

          {/* Only the one number the catalogue can actually prove. */}
          {totalVenues > 0 ? (
            <div className="statrow">
              <div className="stat">
                <b>{totalVenues}</b>
                <span>Venues listed</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* TOP VENUES */}
      <Section className="wrap">
        <SectionHead title="Venues on TurfChai" subtitle="Live from the venue catalogue" />
        {venuesApi.loading ? (
          <p className="muted center">Loading venues…</p>
        ) : venues.length === 0 ? (
          <p className="muted center">
            No venues are listed yet. If you run a turf, you can be the first.
          </p>
        ) : (
          <Grid cols={3}>
            {venues.map((venue) => (
              <Link
                className="venue-card"
                key={venue.slug}
                to={paths.player.venue(venue.slug)}
                style={{ textDecoration: 'none', color: 'var(--text)' }}
              >
                <Photo photos={venue.photos} imgUrl={venue.photos?.[0] || venue.coverImageUrl} glyph="⚽" />
                <div className="body">
                  <div className="name">
                    {venue.name}{' '}
                    {venue.verified ? <span className="verified">✓ Verified</span> : null}
                    {venue.promotionLabel ? (
                      <Badge tone="amber" dot={false}>{venue.promotionLabel}</Badge>
                    ) : null}
                  </div>
                  <div className="row-wrap subtle">
                    {venue.area}
                    {venue.reviewCount > 0 ? (
                      <>
                        {' '}
                        <span className="rating">{Number(venue.rating).toFixed(1)}</span> (
                        {venue.reviewCount})
                      </>
                    ) : (
                      ' · No reviews yet'
                    )}
                  </div>
                  <div className="between">
                    <span className="price">
                      {venue.fromPrice ? (
                        <>
                          <b>৳{Number(venue.fromPrice).toLocaleString('en-BD')}</b>
                          {venue.slotDurationMin ? (
                            <span className="subtle">/{venue.slotDurationMin} min</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="subtle">See slot prices</span>
                      )}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </Grid>
        )}
        <div className="center" style={{ marginTop: 22 }}>
          <Button variant="secondary" to={paths.player.explore}>
            View All Venues →
          </Button>
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section className="wrap">
        <SectionHead title="How TurfChai Works" subtitle="From search to kickoff in three steps" />
        <Grid cols={3}>
          {HOW_IT_WORKS.map((step) => (
            <Card center key={step.id}>
              <span style={{ fontSize: 28 }}>{step.glyph}</span>
              <h3 style={{ marginTop: 10 }}>{step.title}</h3>
              <p className="muted small" style={{ margin: 0 }}>
                {step.body}
              </p>
            </Card>
          ))}
        </Grid>
      </Section>

      {/* CTA */}
      <Section className="wrap">
        <GlassCard className="cta-band">
          <h2>Ready to play?</h2>
          <p className="muted" style={{ maxWidth: 460, margin: '0 auto 20px' }}>
            Book a verified venue across Dhaka — or put your turf on the map.
          </p>
          <Row style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" to={paths.auth}>
              Get Started
            </Button>
            <Button variant="secondary" size="lg" to={paths.owner.onboarding}>
              List Your Venue
            </Button>
          </Row>
        </GlassCard>
      </Section>
    </>
  );
}
