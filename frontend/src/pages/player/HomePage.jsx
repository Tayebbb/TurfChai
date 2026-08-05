import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { GameCard } from '@/components/cards/GameCard';
import { VenueCard } from '@/components/cards/VenueCard';
import { SearchCompact } from '@/components/forms/SearchBar';
import { Input } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { Segmented } from '@/components/navigation/Tabs';
import { ViewAsMenu } from '@/components/navigation/ViewAsMenu';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { Photo } from '@/components/ui/Photo';
import { Skill } from '@/components/ui/Tags';
import { nearbyVenues } from '@/data/venues';
import { currentPlayer } from '@/data/users';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useQueryParam } from '@/hooks/useQueryParam';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { formatNumber } from '@/utils/format';
import './HomePage.css';

const MODES = [
  { id: 'player', label: 'Player', description: 'Book turfs & manage matches' },
  { id: 'solo', label: 'Solo Player', description: 'Join open games near you' },
  { id: 'host', label: 'Tournament Host', description: 'Run your own tournament' },
];

const PLAYER_CHIPS = ['Today', 'Tomorrow', 'Weekend', '⚽ Football', '🏏 Cricket', 'Off-peak deals'];
const SOLO_CHIPS = ['Tonight', '⚽ Football', '🏏 Cricket', 'Beginner friendly', 'Under ৳300'];

const FEATURED_GAMES = [
  {
    id: 'friday-night-football',
    title: 'Friday Night Football · Kick Off Arena',
    status: 'Needs 1 · tonight',
    statusTone: 'red',
    skill: 'Intermediate',
    when: '9:00–10:30 PM',
    distanceKm: 1.2,
    price: 280,
  },
  {
    id: 'casual-6-a-side',
    title: 'Casual 6-a-side · GreenTurf',
    status: '3 spots',
    statusTone: 'green',
    skill: 'Beginner',
    when: 'Tomorrow 7:00 PM',
    distanceKm: 2.8,
    price: 200,
  },
];

const SOLO_GAMES = [
  ...FEATURED_GAMES,
  {
    id: 'weekend-cricket-net',
    title: 'Weekend Cricket Net · Mirpur Sports City',
    status: '2 spots · Sat',
    statusTone: 'amber',
    skill: 'Advanced',
    when: 'Sat 4:00 PM',
    distanceKm: 5.1,
    price: 350,
  },
  {
    id: 'badminton-doubles',
    title: 'Badminton Doubles · ShuttleZone',
    status: '4 spots',
    statusTone: 'green',
    skill: 'All levels',
    when: 'Sun 10:00 AM',
    distanceKm: 1.9,
    price: 150,
  },
];

const RECENTLY_VIEWED = [
  { id: 'kick-off-arena', name: 'Kick Off Arena' },
  { id: 'baridhara-sports-hub', name: 'Baridhara Sports Hub' },
  { id: 'shuttlezone-lalmatia', name: 'ShuttleZone Lalmatia' },
];

const JOINABLE_TOURNAMENTS = [
  {
    id: 'dhaka-corporate-league',
    privacy: '🌐 Open to everyone',
    privacyTone: 'green',
    format: '5-a-side',
    name: 'Dhaka Corporate League',
    meta: 'Sat 30 Aug · Kick Off Arena · 6/12 teams · free entry',
    cta: 'Join now',
    ctaVariant: 'primary',
    toast: '✅ Join request sent — the host will confirm your team',
  },
  {
    id: 'mirpur-weekend-sevens',
    privacy: '🌐 Open to everyone',
    privacyTone: 'green',
    format: '7-a-side',
    name: 'Mirpur Weekend Sevens',
    meta: 'Sun 31 Aug · Mirpur Sports City · 9/16 teams · ৳4,500/team',
    cta: 'Join · ৳4,500',
    ctaVariant: 'primary',
    toast: '✅ Spot held for 30 min — pay the entry fee to confirm',
  },
  {
    id: 'gulshan-premier-cup',
    privacy: '🔒 Invite only',
    privacyTone: 'gray',
    format: '6-a-side',
    name: 'Gulshan Premier Cup',
    meta: 'Fri 5 Sep · Baridhara Sports Hub · details visible to invitees',
    cta: 'Requires invite',
    ctaVariant: 'secondary',
    toast: '🔒 This tournament is private — ask the host for an invite link',
    dimmed: true,
  },
];

const TOURNAMENT_FORMATS = [
  { id: '5', label: '5-a-side' },
  { id: '6', label: '6-a-side' },
  { id: '7', label: '7-a-side' },
  { id: 'knockout', label: 'Knockout' },
];

const PRIVACY_HINTS = {
  open: 'Anyone on TurfChai can find this tournament and request to join.',
  invite: 'Hidden from search. Teams join only through your private invite link.',
};

export default function HomePage() {
  const [mode, setMode] = useQueryParam('mode', 'player');

  return (
    <>
      <PageTitle title="Dashboard" />
      <main className="wrap" style={{ paddingTop: 24 }} id="main">
        {/* Greeting + workspace switcher */}
        <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>Salam, {currentPlayer.shortName}</h1>
            <span className="subtle">{currentPlayer.area}</span>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Badge tone="green">
              {currentPlayer.tier} member · {formatNumber(currentPlayer.points)} pts
            </Badge>
            <ViewAsMenu options={MODES} value={mode} onChange={setMode} />
          </div>
        </div>

        {mode === 'solo' ? <SoloMode /> : mode === 'host' ? <HostMode /> : <PlayerMode />}
      </main>
    </>
  );
}

/* ======== PLAYER MODE ======== */
function PlayerMode() {
  return (
    <div className="tabpanel on">
      <SearchCompact
        to={paths.player.explore}
        placeholder="Turf, sport, or area…"
        highlight="tonight?"
        label="Search venues"
      />
      <ChipRow style={{ marginTop: 12 }}>
        {PLAYER_CHIPS.map((label, index) => (
          <Chip key={label} to={paths.player.explore} active={index === 0}>
            {label}
          </Chip>
        ))}
      </ChipRow>

      {/* Upcoming booking */}
      <section className="section">
        <div className="section-title">
          <h2>Your next match</h2>
          <Link to={paths.player.bookings}>All bookings →</Link>
        </div>
        <div className="glass glass-card">
          <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <Link
              className="row"
              to={paths.player.bookingDetail('TC-48291')}
              style={{ textDecoration: 'none', color: 'var(--text)' }}
            >
              <Photo style={{ width: 56, height: 56, fontSize: 22, flex: 'none' }} glyph="⚽" />
              <div>
                <b>Kick Off Arena · Pitch 2</b>
                <div className="subtle">Fri 8 Aug · 7:30–9:00 PM · Dhanmondi 27</div>
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  <Badge tone="green">Confirmed</Badge>
                  <Badge tone="amber">6/10 paid</Badge>
                </div>
              </div>
            </Link>
            <div className="row">
              <Button size="sm" to={paths.player.splitPayment}>
                Remind team
              </Button>
              <Button size="sm" variant="primary" to={paths.player.matchday}>
                View ticket
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Nearby available now */}
      <section className="section">
        <div className="section-title">
          <h2>Available near you tonight</h2>
          <Link to={paths.player.explore}>See all →</Link>
        </div>
        <div className="hscroll">
          {nearbyVenues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} compact />
          ))}
        </div>
      </section>

      {/* Open games needing players */}
      <section className="section">
        <div className="section-title">
          <h2>Games that need players</h2>
          <Link to={paths.solo.openGames}>Open games →</Link>
        </div>
        <div className="grid2">
          {FEATURED_GAMES.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>

      {/* Off-peak */}
      <section className="section">
        <div className="glass glass-card" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <Badge tone="amber">Off-peak deal</Badge>
          <h3 style={{ marginTop: 8 }}>20% off before 5 PM</h3>
          <p className="subtle">
            Weekday afternoon slots at Baridhara Sports Hub and 12 more venues. Auto-applied at
            checkout.
          </p>
        </div>
      </section>

      {/* Recently viewed */}
      <section className="section">
        <div className="section-title">
          <h2>Recently viewed</h2>
        </div>
        <div className="row-wrap">
          {RECENTLY_VIEWED.map((venue) => (
            <Chip key={venue.id} to={paths.player.venue(venue.id)}>
              {venue.name}
            </Chip>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ======== SOLO PLAYER MODE ======== */
function SoloMode() {
  return (
    <div className="tabpanel on">
      <SearchCompact
        to={paths.solo.openGames}
        placeholder="Find an open game…"
        highlight="football tonight?"
        label="Search open games"
      />
      <ChipRow style={{ marginTop: 12 }}>
        {SOLO_CHIPS.map((label, index) => (
          <Chip key={label} to={paths.solo.openGames} active={index === 0}>
            {label}
          </Chip>
        ))}
      </ChipRow>

      <section className="section">
        <div className="section-title">
          <h2>Your joined game</h2>
          <Link to={paths.solo.ticket}>View ticket →</Link>
        </div>
        <div className="glass glass-card">
          <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <Link
              className="row"
              to={paths.solo.ticket}
              style={{ textDecoration: 'none', color: 'var(--text)' }}
            >
              <Photo variant="alt1" style={{ width: 56, height: 56, fontSize: 22, flex: 'none' }} glyph="⚽" />
              <div>
                <b>Friday Night Football · Kick Off Arena</b>
                <div className="subtle">Tonight · 9:00–10:30 PM · your share ৳280 · paid</div>
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  <Badge tone="green">You&apos;re in</Badge>
                  <Badge tone="blue" dot={false}>
                    9/10 filled
                  </Badge>
                </div>
              </div>
            </Link>
            <Button size="sm" variant="primary" to={paths.solo.ticket}>
              Show QR at gate
            </Button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Open games near you</h2>
          <Link to={paths.solo.openGames}>See all 18 →</Link>
        </div>
        <div className="grid2">
          {SOLO_GAMES.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="grid2">
          <div className="glass glass-card">
            <Badge tone="blue" dot={false}>
              LFG alerts
            </Badge>
            <h3 style={{ marginTop: 8 }}>Never miss a spot</h3>
            <p className="subtle">
              You have 1 active alert: Football · Dhanmondi · Fri–Sat evenings. We&apos;ll ping you
              the second a spot opens.
            </p>
            <Button size="sm" to={paths.solo.alerts}>
              Manage alerts
            </Button>
          </div>
          <div className="card">
            <Badge tone="green">Your solo record</Badge>
            <h3 style={{ marginTop: 8 }}>12 games · 98% show-up</h3>
            <p className="subtle">
              Hosts see your reliability score when you request to join. Keep it above 90% for
              instant-join games.
            </p>
            <Button size="sm" to={paths.solo.openGames}>
              Find your next game
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ======== TOURNAMENT HOST MODE ======== */
function HostMode() {
  const { showToast } = useToast();
  const createModal = useDisclosure(false);
  const [inviteCode, setInviteCode] = useState('');

  return (
    <div className="tabpanel on">
      <div className="between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <p className="subtle" style={{ margin: 0 }}>
          Run your own tournament or join one happening near you.
        </p>
        <Button variant="primary" onClick={createModal.open}>
          ＋ Create a tournament
        </Button>
      </div>

      <section className="section">
        <div className="section-title">
          <h2>Your tournament</h2>
        </div>

        <Link
          className="glass glass-card"
          to={paths.host.tournament}
          style={{ display: 'block', textDecoration: 'none', color: 'var(--text)' }}
        >
          <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div className="row">
              <Photo variant="alt2" style={{ width: 56, height: 56, fontSize: 22, flex: 'none' }} glyph="🏆" />
              <div>
                <b>Ramadan Cup 2027 · Mirpur Sports City</b>
                <div className="subtle">Sat 23 Aug · in 12 days · 3 pitches · knockout</div>
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  <Badge tone="green">Venue confirmed</Badge>
                  <Badge tone="amber">13/16 teams · balance due 20 Aug</Badge>
                </div>
              </div>
            </div>
            <span className="btn btn-sm btn-secondary">Enter tournament →</span>
          </div>
        </Link>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Join a tournament</h2>
          <span className="subtle small">Open ones are one tap · invite-only needs a link</span>
        </div>
        <div className="grid3">
          {JOINABLE_TOURNAMENTS.map((tournament) => (
            <div key={tournament.id} className="card" style={tournament.dimmed ? { opacity: 0.92 } : undefined}>
              <div className="between">
                <Badge tone={tournament.privacyTone} dot={false}>
                  {tournament.privacy}
                </Badge>
                <Skill>{tournament.format}</Skill>
              </div>
              <h4 style={{ margin: '8px 0 2px' }}>{tournament.name}</h4>
              <p className="subtle small" style={{ margin: 0 }}>
                {tournament.meta}
              </p>
              <Button
                size="sm"
                variant={tournament.ctaVariant}
                style={{ marginTop: 10 }}
                onClick={() => showToast(tournament.toast)}
              >
                {tournament.cta}
              </Button>
            </div>
          ))}
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <b className="small">Have an invite link or code?</b>
              <div className="tiny subtle">Paste it here to join a private tournament directly.</div>
            </div>
            <div className="row" style={{ flex: 1, minWidth: 240, maxWidth: 440 }}>
              <Input
                id="inviteCode"
                placeholder="turfchai.app/t/… or code"
                aria-label="Invite link or code"
                style={{ flex: 1 }}
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
              />
              <Button
                onClick={() =>
                  showToast(
                    inviteCode.trim()
                      ? "✅ Invite accepted — you've joined Gulshan Premier Cup"
                      : 'Paste an invite link or code first',
                  )
                }
              >
                Join
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Host tools</h2>
        </div>
        <div className="panel">
          <div className="row-wrap" style={{ gap: 8 }}>
            <Button size="sm" to={paths.player.explore}>
              🔍 Find a venue
            </Button>
            <Button size="sm" to={paths.host.multiPitch}>
              🗓️ Multi-pitch booking
            </Button>
            <Button size="sm" to={paths.host.reserve}>
              💳 Reserve &amp; pay
            </Button>
          </div>
          <p className="tiny subtle" style={{ margin: '8px 0 0' }}>
            Tournament-worthy venues carry a 🏆 Tournament-ready badge in Explore.
          </p>
        </div>
      </section>

      <CreateTournamentModal isOpen={createModal.isOpen} onClose={createModal.close} />
    </div>
  );
}

/** Two-state modal: the setup form, then the created-tournament receipt. */
function CreateTournamentModal({ isOpen, onClose }) {
  const { showToast } = useToast();
  const [created, setCreated] = useState(false);
  const [name, setName] = useState('Dhanmondi Champions Cup');
  const [date, setDate] = useState('Sat 13 Sep 2026');
  const [fee, setFee] = useState('৳3,500');
  const [format, setFormat] = useState('5');
  const [venue, setVenue] = useState('Kick Off Arena · Dhanmondi · 3 pitches');
  const [privacy, setPrivacy] = useState('open');
  const [doneName, setDoneName] = useState(name);
  const [doneMeta, setDoneMeta] = useState('');

  const inviteLink = 'turfchai.app/t/dcc-2026-x7k4';

  const create = () => {
    const safeName = name || 'Untitled tournament';
    setDoneName(safeName);
    setDoneMeta(
      privacy === 'invite'
        ? `${date} · private — share the invite link below with your teams.`
        : `${date} · listed publicly — teams can request to join right away.`,
    );
    setCreated(true);
    showToast(privacy === 'invite' ? '🔒 Private tournament created' : '🌐 Tournament published');
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(inviteLink);
    showToast('🔗 Invite link copied');
  };

  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      title={created ? '🎉 Tournament created' : 'Create a tournament'}
      maxWidth={480}
    >
      {created ? (
        <div>
          <Alert tone="ok" style={{ margin: '14px 0' }}>
            <b>{doneName}</b>
            <span>{doneMeta}</span>
          </Alert>
          {privacy === 'invite' ? (
            <div className="panel">
              <b className="small">Private invite link</b>
              <div className="row" style={{ marginTop: 6 }}>
                <Input
                  readOnly
                  value={inviteLink}
                  style={{ flex: 1, fontVariantNumeric: 'tabular-nums' }}
                />
                <Button onClick={copyLink}>Copy</Button>
              </div>
              <p className="tiny subtle" style={{ margin: '8px 0 0' }}>
                Only people with this link can see and join the tournament. You can switch it to open
                anytime.
              </p>
            </div>
          ) : null}
          <div className="stack-sm" style={{ marginTop: 14 }}>
            <Button variant="primary" block to={paths.host.hub} onClick={onClose}>
              Manage it in your host hub
            </Button>
            <Button block to={paths.host.multiPitch}>
              Reserve the pitches next →
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="subtle small" style={{ margin: '4px 0 14px' }}>
            Set it up now — you can edit everything later from the host dashboard.
          </p>
          <div className="field">
            <label htmlFor="ctName">Tournament name</label>
            <Input
              id="ctName"
              placeholder="e.g. Dhanmondi Champions Cup"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="input-row">
            <div className="field">
              <label htmlFor="ctDate">Date</label>
              <Input id="ctDate" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ctFee">Entry fee / team</label>
              <Input id="ctFee" value={fee} onChange={(event) => setFee(event.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Format</label>
            <Segmented items={TOURNAMENT_FORMATS} value={format} onChange={setFormat} label="Format" />
          </div>
          <div className="field">
            <label htmlFor="ctVenue">Venue</label>
            <select
              className="select"
              id="ctVenue"
              value={venue}
              onChange={(event) => setVenue(event.target.value)}
            >
              <option>Kick Off Arena · Dhanmondi · 3 pitches</option>
              <option>Mirpur Sports City · 4 pitches</option>
              <option>Baridhara Sports Hub · 2 pitches</option>
            </select>
            <span className="hint">
              Need options? <Link to={paths.player.explore}>Browse 🏆 Tournament-ready venues →</Link>
            </span>
          </div>
          <div className="field">
            <label>Who can join?</label>
            <div className="seg" id="ctPrivacy" style={{ display: 'flex' }} role="group" aria-label="Who can join?">
              <button
                className={privacy === 'open' ? 'on' : undefined}
                type="button"
                style={{ flex: 1 }}
                onClick={() => setPrivacy('open')}
              >
                🌐 Open to everyone
              </button>
              <button
                className={privacy === 'invite' ? 'on' : undefined}
                type="button"
                style={{ flex: 1 }}
                onClick={() => setPrivacy('invite')}
              >
                🔒 Invite-only link
              </button>
            </div>
            <span className="hint">{PRIVACY_HINTS[privacy]}</span>
          </div>
          <Button variant="primary" block style={{ marginTop: 6 }} onClick={create}>
            Create tournament
          </Button>
        </div>
      )}
    </Overlay>
  );
}
