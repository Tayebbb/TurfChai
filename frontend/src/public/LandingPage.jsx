import { Link } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Card, GlassCard } from '@/components/cards/Card';
import { PageTitle } from '@/components/common/PageTitle';
import { Grid, Row } from '@/components/layout/Primitives';
import { Section, SectionHead } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Photo } from '@/components/ui/Photo';
import { paths } from '@/routes/paths';

const SEARCH_CELLS = [
  { id: 'location', label: '📍 Location', value: 'Dhanmondi' },
  { id: 'date', label: '📅 Date', value: 'Today, Aug 4' },
  { id: 'time', label: '🕖 Time', value: '7:00 PM' },
  { id: 'sport', label: '⚽ Sport', value: 'Futsal' },
];

const STATS = [
  { id: 'venues', value: '47+', label: 'Verified Venues' },
  { id: 'players', value: '12k+', label: 'Happy Players' },
  { id: 'bookings', value: '98k+', label: 'Bookings Done' },
  { id: 'rating', value: '4.8★', label: 'Average Rating' },
];

const NEARBY_VENUES = [
  {
    id: 'kick-off-arena',
    name: 'Kick Off Arena',
    photoVariant: undefined,
    glyph: '⚽',
    verified: true,
    meta: 'Dhanmondi 27 · 1.2 km',
    rating: '4.8',
    reviews: '214',
    price: '৳2,500',
    unit: '90 min',
    nextSlot: '7:00 PM',
  },
  {
    id: 'greenturf-mohammadpur',
    name: 'GreenTurf Mohammadpur',
    photoVariant: 'alt1',
    glyph: '⚽',
    verified: true,
    meta: 'Mohammadpur · 2.8 km',
    rating: '4.6',
    reviews: '128',
    price: '৳1,800',
    unit: '60 min',
    nextSlot: '8:30 PM',
  },
  {
    id: 'baridhara-sports-hub',
    name: 'Baridhara Sports Hub',
    photoVariant: 'court',
    glyph: '🏏',
    offer: '20% off-peak',
    meta: 'Baridhara · 6.4 km',
    rating: '4.9',
    reviews: '86',
    price: '৳3,200',
    unit: '90 min',
    nextSlot: '10:00 PM',
  },
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

          <div className="hero-search" role="search" aria-label="Find a turf">
            <div className="hs-grid">
              {SEARCH_CELLS.map((cell) => (
                <div className="hs-cell" key={cell.id}>
                  <span>{cell.label}</span>
                  <b>{cell.value}</b>
                </div>
              ))}
            </div>
            <Button variant="primary" size="lg" block to={paths.player.explore}>
              🔍 Find Available Turfs →
            </Button>
          </div>

          <div className="hero-links">
            <Link to={paths.solo.openGames}>▷ Join an Open Game</Link>
            <span className="subtle">·</span>
            <Link to={paths.owner.onboarding}>List Your Venue</Link>
          </div>

          <div className="statrow">
            {STATS.map((stat) => (
              <div className="stat" key={stat.id}>
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEARBY VENUES */}
      <Section className="wrap">
        <SectionHead title="Venues Near You" subtitle="Live availability · Dhanmondi area" />
        <Grid cols={3}>
          {NEARBY_VENUES.map((venue) => (
            <Link
              className="venue-card"
              key={venue.id}
              to={paths.player.venue(venue.id)}
              style={{ textDecoration: 'none', color: 'var(--text)' }}
            >
              <Photo variant={venue.photoVariant} glyph={venue.glyph} />
              <div className="body">
                <div className="name">
                  {venue.name}{' '}
                  {venue.verified ? (
                    <span className="verified">✓ Verified</span>
                  ) : (
                    <Badge tone="amber" dot={false}>
                      {venue.offer}
                    </Badge>
                  )}
                </div>
                <div className="row-wrap subtle">
                  {venue.meta} <span className="rating">{venue.rating}</span> ({venue.reviews})
                </div>
                <div className="between">
                  <span className="price">
                    <b>{venue.price}</b>
                    <span className="subtle">/{venue.unit}</span>
                  </span>
                  <span className="slot-pill">Next: {venue.nextSlot}</span>
                </div>
              </div>
            </Link>
          ))}
        </Grid>
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
            Join thousands of players booking verified venues across Dhaka — or put your turf on the
            map.
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
