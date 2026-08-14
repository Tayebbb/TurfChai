import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { QrCode } from '@/components/common/QrCode';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/buttons/Button';
import { getUser } from '@/api/client';
import {
  formatGameDay,
  formatTimeRange,
  getOpenGame,
  getOpenGameMembers,
  skillLabel,
} from '@/api/openGames';
import { getTicket } from '@/api/tickets';
import { useApi } from '@/hooks/useApi';
import { paths } from '@/routes/paths';
import { formatBdt } from '@/utils/format';

/** ISO instant -> `"Sat 14 Aug, 5:00 pm"`, or null when absent/unparseable. */
function formatStamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TicketPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const currentUser = getUser();

  // The join flow passes the id in router state; the query param keeps the
  // ticket linkable (and is what the QR code encodes).
  const gameId = location.state?.gameId ?? searchParams.get('gameId');

  const { data: game, loading, error, reload } = useApi(
    () => (gameId ? getOpenGame(gameId) : Promise.resolve(null)),
    [gameId],
  );
  const {
    data: memberData,
    loading: membersLoading,
    error: membersError,
    reload: reloadMembers,
  } = useApi(() => (gameId ? getOpenGameMembers(gameId) : Promise.resolve([])), [gameId]);

  // The gate pass is minted per player and only for someone on the roster, so
  // this call is expected to fail for a signed-out or non-member visitor. The
  // page still renders the match; it just has no QR to show.
  const { data: ticket, loading: ticketLoading } = useApi(
    () => (gameId && currentUser ? getTicket(gameId) : Promise.resolve(null)),
    [gameId, currentUser?.id],
  );

  const members = Array.isArray(memberData) ? memberData : [];

  if (!gameId) {
    return (
      <>
        <PageTitle title="Match ticket" />
        <main className="wrap-form" id="main" style={{ paddingTop: 32, paddingBottom: 80 }}>
          <div className="card center" style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>No ticket selected</h1>
            <p className="subtle small">Open a game you have joined to see its ticket.</p>
            <Button variant="primary" to={paths.solo.openGames} className="btn-block">
              Browse open games
            </Button>
          </div>
        </main>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageTitle title="Match ticket" />
        <main className="wrap-form" id="main" style={{ paddingTop: 32, paddingBottom: 80 }}>
          <p className="subtle" role="status">
            Loading your ticket…
          </p>
        </main>
      </>
    );
  }

  if (error || !game) {
    return (
      <>
        <PageTitle title="Match ticket" />
        <main className="wrap-form" id="main" style={{ paddingTop: 32, paddingBottom: 80 }}>
          <div className="card" style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>Could not load this ticket</h1>
            <p className="subtle">{error?.message ?? 'This open game is no longer available.'}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="secondary" to={paths.solo.openGames}>
                Open games
              </Button>
              <Button variant="primary" onClick={reload}>
                Try again
              </Button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const capacity = Number(game.capacity ?? 0);
  const filledCount = Number(game.filledCount ?? 0);
  const spotsLeft = Math.max(0, Number(game.spotsLeft ?? 0));
  const ticketCode = ticket?.ticketCode ?? game.gameCode ?? `OG-${game.id}`;
  const timeRange = formatTimeRange(game.startTime, game.endTime);
  const dayLabel = formatGameDay(game.gameDate);
  const venueLine = [game.venueName, game.pitchName, game.area].filter(Boolean).join(' · ');
  const onRoster =
    !!ticket || (!!currentUser && members.some((m) => Number(m.userId) === Number(currentUser.id)));
  const validFrom = formatStamp(ticket?.validFrom);
  const validUntil = formatStamp(ticket?.validUntil);

  const ticketFacts = [
    { id: 'day', label: dayLabel.toUpperCase() || 'KICKOFF', value: <b className="num">{timeRange}</b> },
    { id: 'skill', label: 'SKILL', value: <b>{skillLabel(game.skillLevel)}</b> },
    {
      id: 'share',
      label: 'SHARE',
      value: <span className="badge green">{formatBdt(game.pricePerPlayer)}</span>,
    },
  ];


  return (
    <>
      <PageTitle title={`Ticket · ${game.title ?? 'Match'}`} />

      <main className="wrap-form" id="main" style={{ paddingTop: 32, paddingBottom: 80 }}>
        <div className="center" style={{ marginBottom: 18 }}>
          <div className="check-anim" aria-hidden="true">
            ✓
          </div>
          {onRoster ? (
            <span className="badge green">You&apos;re in! Your spot is on the roster</span>
          ) : (
            <span className="badge amber">Match ticket · you are not on this roster yet</span>
          )}
          <h1 style={{ fontSize: 22, marginTop: 10 }}>Match ticket 🎟️</h1>
          <p className="subtle small">
            {formatBdt(game.pricePerPlayer)} per player · show this code at the gate
          </p>
        </div>

        <div className="ticket">
          <div className="head">
            <div className="between">
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{game.title}</b>
              <span className="badge nodot" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
                Open game
              </span>
            </div>
            <div className="muted small">{venueLine}</div>
          </div>
          <div className="center" style={{ padding: 18 }}>
            {ticketLoading ? (
              <p className="subtle small" role="status" style={{ margin: 0 }}>
                Preparing your gate pass…
              </p>
            ) : ticket?.checkInToken ? (
              <>
                <QrCode
                  value={ticket.checkInToken}
                  label={`Gate check-in code for ${ticketCode}`}
                />
                {ticket.checkedIn ? (
                  <span className="badge green" style={{ marginTop: 10 }}>
                    Checked in ✓
                  </span>
                ) : null}
              </>
            ) : (
              <div className="alert warn" style={{ textAlign: 'left' }}>
                <span className="ico">🎫</span>
                <div className="tiny">
                  {currentUser
                    ? 'Only players on this roster get a gate pass. Join the match to get yours.'
                    : 'Sign in with the account you joined on to load your gate pass.'}
                </div>
              </div>
            )}
            <b className="num" style={{ fontSize: 18, letterSpacing: '.08em', display: 'block', marginTop: 10 }}>
              {ticketCode}
            </b>
            {validFrom && validUntil ? (
              <span className="tiny subtle">
                Scannable {validFrom} – {validUntil}
              </span>
            ) : null}
          </div>
          <div className="perf" />
          <div style={{ padding: '16px 20px' }}>
            <div className="grid3" style={{ gap: 10 }}>
              {ticketFacts.map((fact) => (
                <div key={fact.id}>
                  <span className="tiny subtle">{fact.label}</span>
                  <br />
                  {fact.value}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 14, gap: 10 }}>
          <Link className="btn btn-primary" to={paths.solo.game(game.id)}>
            Match details
          </Link>
          <Link className="btn btn-secondary" to={paths.solo.openGames}>
            More open games
          </Link>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="between">
            <h4 style={{ margin: 0 }}>
              Roster · {filledCount}/{capacity}
              {spotsLeft === 0 ? ' · Full' : ''}
            </h4>
            <span className={spotsLeft === 0 ? 'badge gray' : 'badge green'}>
              {spotsLeft === 0 ? 'Closed' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
            </span>
          </div>
          {membersLoading ? (
            <p className="subtle small" role="status" style={{ margin: '10px 0 0' }}>
              Loading roster…
            </p>
          ) : membersError ? (
            <div style={{ marginTop: 10 }}>
              <p className="subtle small" style={{ margin: '0 0 8px' }}>
                {membersError.message}
              </p>
              <Button variant="secondary" size="sm" onClick={reloadMembers}>
                Retry
              </Button>
            </div>
          ) : members.length === 0 ? (
            <p className="subtle small" style={{ margin: '10px 0 0' }}>
              Nobody has joined yet.
            </p>
          ) : (
            <div className="row-wrap" style={{ marginTop: 10 }}>
              {members.map((member) => (
                <span
                  key={member.id ?? member.userId}
                  className={
                    currentUser && Number(member.userId) === Number(currentUser.id)
                      ? 'avatar brand'
                      : 'avatar'
                  }
                  title={member.name}
                >
                  {member.initials ?? '??'}
                </span>
              ))}
            </div>
          )}
          <p className="subtle tiny" style={{ margin: '8px 0 0' }}>
            {game.organizerName ? `${game.organizerName} hosts this game. ` : ''}
            The turf owner handles pitch entry &amp; handover.
          </p>
        </div>

        <Alert tone="ok" icon="🏅" title="After the match" style={{ marginTop: 14 }}>
          Rate the game and venue — loyalty points credit automatically once play completes.{' '}
          <Link to={paths.player.review}>See the review flow →</Link>
        </Alert>
      </main>
    </>
  );
}
