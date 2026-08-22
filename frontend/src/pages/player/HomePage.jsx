import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { GameCard } from '@/components/cards/GameCard';
import { VenueCard } from '@/components/cards/VenueCard';
import { SearchCompact } from '@/components/forms/SearchBar';
import { Badge } from '@/components/ui/Badge';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { Photo } from '@/components/ui/Photo';
import { Skeleton } from '@/components/ui/Skeleton';
import { Skill } from '@/components/ui/Tags';
import { getUser } from '@/api/client';
import {
  formatBookingDate,
  formatTimeRange,
  listBookings,
  nextUpcomingBooking,
} from '@/api/bookings';
import { listLfgAlerts } from '@/api/lfgAlerts';
import { formatGameDay, kickoffMs, searchOpenGames, skillLabel } from '@/api/openGames';
import { getSavedVenues } from '@/api/players';
import { browseTournaments, registrationState } from '@/api/playerTournaments';
import { getMyHostedTournaments, formatDate } from '@/api/tournaments';
import { searchVenues, toNearbyCard } from '@/api/venues';
import { useApi } from '@/hooks/useApi';
import { useQueryParam } from '@/hooks/useQueryParam';
import { useSession } from '@/hooks/useSession';
import { paths } from '@/routes/paths';
import { formatBdt, formatNumber } from '@/utils/format';
import './HomePage.css';


/**
 * Home chips deep-link into Explore. Every query below is a filter the venue
 * search endpoint actually supports and ExplorePage reads back off the URL.
 */
const PLAYER_CHIPS = [
  { label: '⚽ Football', query: 'sport=football' },
  { label: '🏏 Cricket', query: 'sport=cricket' },
  { label: '🏸 Badminton', query: 'sport=badminton' },
  { label: 'Open at 7 PM', query: 'openAt=19%3A00' },
  { label: 'Floodlit', query: 'amenity=floodlights' },
];

/** The open-games feed takes no deep-link filters, so these are plain destinations. */
const SOLO_LINKS = [
  { label: 'Browse open games', to: paths.solo.openGames },
  { label: 'My availability alerts', to: paths.solo.alerts },
];

const LINK_BUTTON = {
  background: 'none',
  border: 'none',
  color: 'var(--brand-600)',
  cursor: 'pointer',
  padding: 0,
  font: 'inherit',
  fontWeight: 700,
};

const PHOTO_TILE = { width: 56, height: 56, fontSize: 22, flex: 'none' };

const prettyFormat = (format) => (format ? format.toLowerCase().replaceAll('_', '-') : '');

/** Inline "couldn't load" line whose retry re-runs the request. */
function RetryNote({ children, onRetry }) {
  return (
    <p className="subtle" role="status" style={{ marginTop: 8 }}>
      {children}{' '}
      <button type="button" style={LINK_BUTTON} onClick={onRetry}>
        Retry
      </button>
    </p>
  );
}

/** OpenGameResponse → the shape `GameCard` renders. */
function toGameCardModel(game) {
  const spots = Math.max(0, Number(game.spotsLeft ?? 0));
  return {
    id: game.id,
    title: [game.title, game.venueName].filter(Boolean).join(' · '),
    status: `${spots} spot${spots === 1 ? '' : 's'} left`,
    statusTone: spots === 1 ? 'red' : spots <= 3 ? 'amber' : 'green',
    skill: skillLabel(game.skillLevel),
    when: `${formatGameDay(game.gameDate)} ${formatTimeRange(game.startTime, game.endTime)}`.trim(),
    price: Number(game.pricePerPlayer ?? 0),
    urgent: spots === 1,
  };
}

export default function HomePage() {
  const [mode] = useQueryParam('mode', 'player');
  // `/player` is a public browsing surface, so the profile call must wait for
  // a real session — otherwise a signed-out visitor greets as somebody else.
  const { user: player, signedIn } = useSession();
  const fullName = player?.fullName;
  const firstName = fullName?.split(/\s+/)[0];

  return (
    <>
      <PageTitle title="Dashboard" />
      <main className="wrap" style={{ paddingTop: 24 }} id="main">
        {/* Greeting + workspace switcher */}
        <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>
              {firstName ? `Salam, ${firstName}` : signedIn ? 'Salam' : 'Find your next game'}
            </h1>
            <span className="subtle">
              {signedIn ? (
                player?.area || 'Browse venues and open games'
              ) : (
                <>
                  Browse venues and open games · <Link to={paths.auth}>Sign in</Link> to book
                </>
              )}
            </span>
          </div>
          {player?.reliabilityScore != null ? (
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Badge tone="green">
                {player.reliabilityScore}% reliability
                {player.gamesAttended ? ` · ${formatNumber(player.gamesAttended)} games` : ''}
              </Badge>
            </div>
          ) : null}
        </div>

        {mode === 'solo' ? <SoloMode /> : mode === 'host' ? <HostMode /> : <PlayerMode />}
      </main>
    </>
  );
}

/* ======== PLAYER MODE ======== */
function PlayerMode() {
  const venuesApi = useApi(() => searchVenues({ size: 6, sort: 'rating' }), []);
  const nearbyVenues = useMemo(
    () => (venuesApi.data?.items ?? []).map(toNearbyCard),
    [venuesApi.data],
  );

  return (
    <div className="tabpanel on">
      <SearchCompact
        to={paths.player.explore}
        placeholder="Turf, sport, or area…"
        label="Search venues"
      />
      <ChipRow style={{ marginTop: 12 }}>
        {PLAYER_CHIPS.map((chip) => (
          <Chip key={chip.label} to={`${paths.player.explore}?${chip.query}`}>
            {chip.label}
          </Chip>
        ))}
      </ChipRow>

      <NextMatchSection />

      {/* Top-rated venues */}
      <section className="section">
        <div className="section-title">
          <h2>Top-rated venues</h2>
          <Link to={paths.player.explore}>See all →</Link>
        </div>
        {venuesApi.loading ? (
          <div className="hscroll">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} height={190} width={220} radius={14} style={{ flexShrink: 0 }} />
            ))}
          </div>
        ) : venuesApi.error ? (
          <RetryNote onRetry={venuesApi.reload}>Venues could not be loaded.</RetryNote>
        ) : nearbyVenues.length === 0 ? (
          <p className="subtle" style={{ margin: 0 }}>
            No venues are listed yet. <Link to={paths.player.explore}>Open Explore</Link> to search
            every area.
          </p>
        ) : (
          <div className="hscroll">
            {nearbyVenues.map((venue) => (
              <VenueCard key={venue.id} venue={venue} compact />
            ))}
          </div>
        )}
      </section>

      <OpenGamesSection title="Games that need players" />

      <SavedVenuesSection />
    </div>
  );
}

/** The caller's genuine next upcoming booking, or an honest empty/signed-out state. */
function NextMatchSection() {
  const { signedIn } = useSession();
  const bookingsApi = useApi(() => (signedIn ? listBookings() : Promise.resolve([])), [signedIn]);
  const booking = useMemo(
    () => nextUpcomingBooking(Array.isArray(bookingsApi.data) ? bookingsApi.data : []),
    [bookingsApi.data],
  );

  return (
    <section className="section">
      <div className="section-title">
        <h2>Your next match</h2>
        {signedIn ? <Link to={paths.player.bookings}>All bookings →</Link> : null}
      </div>
      <div className="glass glass-card">
        {!signedIn ? (
          <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <b>Sign in to see your next match</b>
              <div className="subtle">Your bookings, ticket and check-in QR live in your account.</div>
            </div>
            <Button size="sm" variant="primary" to={paths.auth}>
              Sign in
            </Button>
          </div>
        ) : bookingsApi.loading ? (
          <Skeleton height={64} radius={12} />
        ) : bookingsApi.error ? (
          <RetryNote onRetry={bookingsApi.reload}>Your bookings could not be loaded.</RetryNote>
        ) : !booking ? (
          <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <b>No upcoming match</b>
              <div className="subtle">Find a slot and your next booking shows up here.</div>
            </div>
            <Button size="sm" variant="primary" to={paths.player.explore}>
              Find a slot
            </Button>
          </div>
        ) : (
          <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <Link
              className="row"
              to={paths.player.bookingDetail(booking.id)}
              style={{ textDecoration: 'none', color: 'var(--text)' }}
            >
              <Photo style={PHOTO_TILE} glyph="⚽" />
              <div>
                <b>
                  {booking.venueName}
                  {booking.pitchName ? ` · ${booking.pitchName}` : ''}
                </b>
                <div className="subtle">
                  {formatBookingDate(booking)} ·{' '}
                  {formatTimeRange(booking.startTime, booking.endTime)}
                  {booking.venueArea ? ` · ${booking.venueArea}` : ''}
                </div>
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  <Badge tone="green">
                    {booking.status === 'CONFIRMED' ? 'Confirmed' : 'Upcoming'}
                  </Badge>
                  {booking.bookingCode ? (
                    <Badge tone="blue" dot={false}>
                      Ref {booking.bookingCode}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </Link>
            <Button size="sm" variant="primary" to={paths.player.matchdayFor(booking.id)}>
              View ticket
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Live open games, soonest kick-off first. Shared by player and solo modes. */
function OpenGamesSection({ title, limit = 4 }) {
  const gamesApi = useApi(() => searchOpenGames({}), []);
  const games = useMemo(() => {
    const items = Array.isArray(gamesApi.data) ? gamesApi.data : [];
    return items
      .filter((game) => Number(game.spotsLeft ?? 0) > 0)
      .sort((a, b) => kickoffMs(a) - kickoffMs(b))
      .slice(0, limit)
      .map(toGameCardModel);
  }, [gamesApi.data, limit]);

  return (
    <section className="section">
      <div className="section-title">
        <h2>{title}</h2>
        <Link to={paths.solo.openGames}>Open games →</Link>
      </div>
      {gamesApi.loading ? (
        <div className="grid2">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} height={118} radius={14} />
          ))}
        </div>
      ) : gamesApi.error ? (
        <RetryNote onRetry={gamesApi.reload}>Open games could not be loaded.</RetryNote>
      ) : games.length === 0 ? (
        <p className="subtle" style={{ margin: 0 }}>
          No games are looking for players right now.{' '}
          <Link to={paths.solo.alerts}>Set an availability alert</Link> and we&apos;ll ping you when
          one opens.
        </p>
      ) : (
        <div className="grid2">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Replaces the invented "Recently viewed" rail with the player's real bookmarks. */
function SavedVenuesSection() {
  const { signedIn } = useSession();
  const savedApi = useApi(() => (signedIn ? getSavedVenues() : Promise.resolve([])), [signedIn]);
  const saved = Array.isArray(savedApi.data) ? savedApi.data : [];

  if (!signedIn) return null;

  return (
    <section className="section">
      <div className="section-title">
        <h2>Your saved venues</h2>
        <Link to={paths.player.dashboard.venues}>Manage →</Link>
      </div>
      {savedApi.loading ? (
        <Skeleton height={32} width={260} radius={16} />
      ) : savedApi.error ? (
        <RetryNote onRetry={savedApi.reload}>Saved venues could not be loaded.</RetryNote>
      ) : saved.length === 0 ? (
        <p className="subtle" style={{ margin: 0 }}>
          Nothing saved yet — tap the heart on any venue in{' '}
          <Link to={paths.player.explore}>Explore</Link> to pin it here.
        </p>
      ) : (
        <div className="row-wrap">
          {saved.slice(0, 8).map((venue) => (
            <Chip key={venue.slug} to={paths.player.venue(venue.slug)}>
              {venue.name}
            </Chip>
          ))}
        </div>
      )}
    </section>
  );
}

/* ======== SOLO PLAYER MODE ======== */
function SoloMode() {
  const { user: me } = useSession();

  const soloRecord =
    me?.reliabilityScore != null
      ? `${me.gamesAttended ?? 0} games \u00b7 ${me.reliabilityScore}% show-up`
      : null;

  return (
    <div className="tabpanel on">
      <SearchCompact
        to={paths.solo.openGames}
        placeholder="Find an open game…"
        label="Search open games"
      />
      <ChipRow style={{ marginTop: 12 }}>
        {SOLO_LINKS.map((link) => (
          <Chip key={link.label} to={link.to}>
            {link.label}
          </Chip>
        ))}
      </ChipRow>

      <OpenGamesSection title="Open games near you" />

      <section className="section">
        <div className="grid2">
          <LfgAlertsCard />
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

/** Real LFG alert count for the signed-in player. */
function LfgAlertsCard() {
  const userId = getUser()?.id ?? null;
  const alertsApi = useApi(() => (userId ? listLfgAlerts() : Promise.resolve([])), [userId]);
  const active = (Array.isArray(alertsApi.data) ? alertsApi.data : []).filter(
    (alert) => alert.status === 'ACTIVE',
  );

  return (
    <div className="glass glass-card">
      <Badge tone="blue" dot={false}>
        LFG alerts
      </Badge>
      <h3 style={{ marginTop: 8 }}>Never miss a spot</h3>
      {!userId ? (
        <p className="subtle">Sign in to set an alert and get pinged when a spot opens.</p>
      ) : alertsApi.loading ? (
        <Skeleton height={18} width="80%" />
      ) : alertsApi.error ? (
        <RetryNote onRetry={alertsApi.reload}>Your alerts could not be loaded.</RetryNote>
      ) : (
        <p className="subtle">
          {active.length === 0
            ? 'You have no active alerts yet. Tell us your area and times and we’ll ping you the second a spot opens.'
            : `You have ${active.length} active alert${
                active.length === 1 ? '' : 's'
              }. We’ll ping you the second a matching spot opens.`}
        </p>
      )}
      <Button size="sm" to={paths.solo.alerts}>
        Manage alerts
      </Button>
    </div>
  );
}

/* ======== TOURNAMENT HOST MODE ======== */
function HostMode() {
  const tournamentApi = useApi(() => getMyHostedTournaments(), []);
  const tournament = tournamentApi.data?.[0] ?? null;

  return (
    <div className="tabpanel on">
      <p className="subtle" style={{ margin: '0 0 4px' }}>
        Reserve pitches for your own tournament, or register a team for one happening near you.
      </p>

      <section className="section">
        <div className="section-title">
          <h2>Your tournament</h2>
        </div>

        {tournamentApi.loading ? (
          <Skeleton height={96} radius={14} />
        ) : tournamentApi.error || !tournament ? (
          <div className="glass glass-card">
            <b>No tournament set up yet</b>
            <p className="subtle" style={{ margin: '4px 0 10px' }}>
              Tournaments are created by the TurfChai team today. Start by reserving the pitches you
              need and we&apos;ll attach them to your tournament.
            </p>
            <div className="row-wrap" style={{ gap: 8 }}>
              <Button size="sm" variant="primary" to={paths.host.multiPitch}>
                Reserve pitches
              </Button>
              {tournamentApi.error ? (
                <Button size="sm" onClick={tournamentApi.reload}>
                  Retry
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <Link
            className="glass glass-card"
            to={`${paths.host.tournament}?code=${tournament.code}`}
            style={{ display: 'block', textDecoration: 'none', color: 'var(--text)' }}
          >
            <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="row">
                <Photo variant="alt2" style={PHOTO_TILE} glyph="🏆" />
                <div>
                  <b>{`${tournament.name} · ${tournament.venueName}`}</b>
                  <div className="subtle">
                    {`${formatDate(tournament.date)} · ${
                      new Set(tournament.reservations.map((r) => r.pitchName)).size
                    } pitches · ${prettyFormat(tournament.format)}`}
                  </div>
                  <div className="row-wrap" style={{ marginTop: 4 }}>
                    <Badge tone="green">{tournament.status.toLowerCase()}</Badge>
                    <Badge tone="amber">
                      {`${tournament.teams.length}/${tournament.teamCapacity} teams${
                        tournament.balanceDueDate
                          ? ` · balance due ${formatDate(tournament.balanceDueDate)}`
                          : ''
                      }`}
                    </Badge>
                  </div>
                </div>
              </div>
              <span className="btn btn-sm btn-secondary">Enter tournament →</span>
            </div>
          </Link>
        )}
      </section>

      <JoinTournamentSection />

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
    </div>
  );
}

/** Real published tournaments that are open for registration. */
function JoinTournamentSection() {
  const browseApi = useApi(
    () => browseTournaments({ page: 0, size: 6, openOnly: true, upcomingOnly: true }),
    [],
  );
  const tournaments = browseApi.data?.items ?? [];

  return (
    <section className="section">
      <div className="section-title">
        <h2>Join a tournament</h2>
        <Link to={paths.player.dashboard.tournaments}>All tournaments →</Link>
      </div>
      {browseApi.loading ? (
        <div className="grid3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height={124} radius={14} />
          ))}
        </div>
      ) : browseApi.error ? (
        <RetryNote onRetry={browseApi.reload}>Tournaments could not be loaded.</RetryNote>
      ) : tournaments.length === 0 ? (
        <p className="subtle" style={{ margin: 0 }}>
          No tournaments are open for registration right now — check back soon.
        </p>
      ) : (
        <div className="grid3">
          {tournaments.map((card) => {
            const state = registrationState(card);
            return (
              <Link
                key={card.code}
                className="card"
                to={paths.player.tournament(card.code)}
                style={{ display: 'block', textDecoration: 'none', color: 'var(--text)' }}
              >
                <div className="between">
                  <Badge tone={state.tone} dot={false}>
                    {state.label}
                  </Badge>
                  <Skill>{prettyFormat(card.format)}</Skill>
                </div>
                <h4 style={{ margin: '8px 0 2px' }}>{card.name}</h4>
                <p className="subtle small" style={{ margin: 0 }}>
                  {formatDate(card.date)} · {card.venueName} · {card.registeredTeams}/
                  {card.teamCapacity} teams ·{' '}
                  {Number(card.entryFeePerTeam) > 0
                    ? `${formatBdt(card.entryFeePerTeam)} entry`
                    : 'free entry'}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
