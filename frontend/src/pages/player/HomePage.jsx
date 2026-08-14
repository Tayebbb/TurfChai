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
import { Skeleton } from '@/components/ui/Skeleton';
import { Skill } from '@/components/ui/Tags';
import { searchVenues, toNearbyCard } from '@/api/venues';
import { getMyProfile } from '@/api/players';
import { getTournament, DEMO_TOURNAMENT_CODE, formatDate } from '@/api/tournaments';
import { useApi } from '@/hooks/useApi';
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

import { searchOpenGames, toHomeGameCard } from '@/api/games';

const RECENTLY_VIEWED = [
  { id: 'kick-off-arena', name: 'Kick Off Arena' },
  { id: 'baridhara-sports-hub', name: 'Baridhara Sports Hub' },
  { id: 'shuttlezone-lalmatia', name: 'ShuttleZone Lalmatia' },
];

import { browseTournaments, toJoinableTournamentCard } from '@/api/tournaments';

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
  const me = useApi(() => getMyProfile(), []);
  const player = me.data;
  const firstName = player?.fullName?.split(/\s+/)[0];

  return (
    <>
      <PageTitle title="Dashboard" />
      <main className="wrap" style={{ paddingTop: 24 }} id="main">
        {/* Greeting + workspace switcher */}
        <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>
              {firstName ? `Salam, ${firstName}` : 'Salam'}
            </h1>
            <span className="subtle">
              {player?.area ? `${player.area} · ` : ''}
              <Link to={paths.player.settings}>Edit profile</Link>
            </span>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {player?.reliabilityScore != null ? (
              <Badge tone="green">
                {player.reliabilityScore}% reliability
                {player.gamesAttended ? ` · ${formatNumber(player.gamesAttended)} games` : ''}
              </Badge>
            ) : null}
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
  // Live venue rail; falls back to sample data when the API is unreachable.
  const venuesApi = useApi(() => searchVenues({ size: 6, sort: 'rating' }), []);
  const nearbyVenues = venuesApi.data ? venuesApi.data.items.map(toNearbyCard) : [];

  const gamesApi = useApi(() => searchOpenGames(), []);

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
          {venuesApi.loading
            ? Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} height={190} width={220} radius={14} style={{ flexShrink: 0 }} />
              ))
            : nearbyVenues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} compact />
              ))}
        </div>
        {venuesApi.error ? (
          <p className="subtle" role="status" style={{ marginTop: 8 }}>
            Live venues unavailable — showing sample data.{' '}
            <button type="button" onClick={venuesApi.reload} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 700 }}>
              Retry
            </button>
          </p>
        ) : null}
      </section>

      {/* Open games needing players */}
      <section className="section">
        <div className="section-title">
          <h2>Games that need players</h2>
          <Link to={paths.solo.openGames}>Open games →</Link>
        </div>
        <div className="grid2">
          {gamesApi.loading ? (
            <>
              <Skeleton height={140} width="100%" radius={12} />
              <Skeleton height={140} width="100%" radius={12} />
            </>
          ) : gamesApi.data ? (
            gamesApi.data.slice(0, 2).map(toHomeGameCard).map((game) => (
              <GameCard key={game.id} game={game} />
            ))
          ) : (
            <p className="subtle">No featured games available</p>
          )}
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
  const me = useApi(() => getMyProfile(), []);
  const gamesApi = useApi(() => searchOpenGames(), []);

  const soloRecord =
    me.data?.reliabilityScore != null
      ? `${me.data.gamesAttended ?? 0} games \u00b7 ${me.data.reliabilityScore}% show-up`
      : null;

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
          {gamesApi.loading ? (
            <>
              <Skeleton height={140} width="100%" radius={12} />
              <Skeleton height={140} width="100%" radius={12} />
              <Skeleton height={140} width="100%" radius={12} />
              <Skeleton height={140} width="100%" radius={12} />
            </>
          ) : gamesApi.data ? (
            gamesApi.data.slice(0, 4).map(toHomeGameCard).map((game) => (
              <GameCard key={game.id} game={game} />
            ))
          ) : (
            <p className="subtle">No games available</p>
          )}
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
            <h3 style={{ marginTop: 8 }}>
              {soloRecord ?? 'Your reliability score'}
            </h3>
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
  const tournamentApi = useApi(() => getTournament(DEMO_TOURNAMENT_CODE), []);
  const tournament = tournamentApi.data;
  const browseApi = useApi(() => browseTournaments({ size: 3 }), []);

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
          to={tournament ? `${paths.host.tournament}?code=${tournament.code}` : paths.host.tournament}
          style={{ display: 'block', textDecoration: 'none', color: 'var(--text)' }}
        >
          <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div className="row">
              <Photo variant="alt2" style={{ width: 56, height: 56, fontSize: 22, flex: 'none' }} glyph="🏆" />
              <div>
                <b>
                  {tournament
                    ? `${tournament.name} · ${tournament.venueName}`
                    : 'Ramadan Cup 2027 · Mirpur Sports City'}
                </b>
                <div className="subtle">
                  {tournament
                    ? `${formatDate(tournament.date)} · ${
                        new Set(tournament.reservations.map((r) => r.pitchName)).size
                      } pitches · ${tournament.format.toLowerCase().replaceAll('_', '-')}`
                    : 'Sat 23 Aug · 3 pitches · knockout'}
                </div>
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  <Badge tone="green">
                    {tournament ? tournament.status.toLowerCase() : 'Venue confirmed'}
                  </Badge>
                  <Badge tone="amber">
                    {tournament
                      ? `${tournament.teams.length}/${tournament.teamCapacity} teams${
                          tournament.balanceDueDate
                            ? ` · balance due ${formatDate(tournament.balanceDueDate)}`
                            : ''
                        }`
                      : '13/16 teams'}
                  </Badge>
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
          {browseApi.loading ? (
            <>
              <Skeleton height={140} width="100%" radius={12} />
              <Skeleton height={140} width="100%" radius={12} />
              <Skeleton height={140} width="100%" radius={12} />
            </>
          ) : browseApi.data ? (
            browseApi.data.items.slice(0, 3).map(toJoinableTournamentCard).map((tournament) => (
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
            ))
          ) : (
            <p className="subtle">No joinable tournaments at the moment</p>
          )}
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
  const venuesApi = useApi(() => searchVenues({ size: 20, sort: 'rating' }), []);
  const venueOptions = venuesApi.data?.items ?? [];
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
              {venueOptions.length > 0 ? (
                venueOptions.map((option) => (
                  <option key={option.slug}>
                    {option.name} · {option.area}
                  </option>
                ))
              ) : (
                <option>Loading venues…</option>
              )}
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
