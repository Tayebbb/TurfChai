import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Button } from '@/components/buttons/Button';
import { Overlay } from '@/components/modals/Overlay';
import { getUser } from '@/api/client';
import {
  formatGameDay,
  formatTimeRange,
  getOpenGame,
  getOpenGameMembers,
  joinOpenGame,
  skillLabel,
} from '@/api/openGames';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { formatBdt } from '@/utils/format';
import './GameDetailPage.css';

const PAYMENT_METHODS = ['bKash', 'Nagad', 'Card'];

const RULES = [
  'Turf shoes only · no metal studs',
  'If you cancel more than 6h before kickoff: full share refunded',
  'Within 6h: refunded only if a replacement joins',
  'No-show without notice lowers your reliability score',
];

const CLOSED_STATUSES = new Set(['FULL', 'COMPLETED', 'CANCELLED']);

/** Minutes between two `"HH:mm:ss"` strings, or null when either is missing. */
function durationMinutes(start, end) {
  if (!start || !end) return null;
  const toMinutes = (value) => {
    const [h, m] = String(value).split(':').map(Number);
    return h * 60 + m;
  };
  const span = toMinutes(end) - toMinutes(start);
  return span > 0 ? span : null;
}

export default function GameDetailPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const payShare = useDisclosure(false);
  const [method, setMethod] = useState('bKash');
  const [joining, setJoining] = useState(false);

  const currentUser = getUser();

  const { data: game, loading, error, reload } = useApi(() => getOpenGame(gameId), [gameId]);
  const {
    data: memberData,
    loading: membersLoading,
    error: membersError,
    reload: reloadMembers,
  } = useApi(() => getOpenGameMembers(gameId), [gameId]);

  const members = Array.isArray(memberData) ? memberData : [];

  if (loading) {
    return (
      <>
        <PageTitle title="Open game" />
        <main className="wrap" id="main" style={{ paddingTop: 20, maxWidth: 1000 }}>
          <p className="subtle" role="status">
            Loading match…
          </p>
        </main>
      </>
    );
  }

  if (error || !game) {
    return (
      <>
        <PageTitle title="Open game" />
        <main className="wrap" id="main" style={{ paddingTop: 20, maxWidth: 1000 }}>
          <div className="card" style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>Could not load this match</h1>
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
  const isClosed = CLOSED_STATUSES.has(game.status) || spotsLeft === 0;
  const alreadyJoined =
    !!currentUser && members.some((member) => Number(member.userId) === Number(currentUser.id));
  const minutes = durationMinutes(game.startTime, game.endTime);
  const whenLabel = `${formatGameDay(game.gameDate)} ${formatTimeRange(game.startTime, game.endTime)}`.trim();
  const venueLine = [game.venueName, game.pitchName, game.area].filter(Boolean).join(' · ');

  const matchFacts = [
    { id: 'format', label: 'FORMAT', value: `${capacity} players${minutes ? ` · ${minutes} min` : ''}` },
    { id: 'skill', label: 'SKILL', value: skillLabel(game.skillLevel) },
    { id: 'venue', label: 'VENUE', value: game.venueName ?? '—' },
  ];

  const matchSummary = [
    `Skill level: ${skillLabel(game.skillLevel)}`,
    game.area ? `${game.venueName} · ${game.area}` : game.venueName,
    whenLabel,
    game.minimumReliability ? `Minimum reliability score: ${game.minimumReliability}%` : null,
  ].filter(Boolean);

  const statusBadge = isClosed
    ? { tone: 'gray', text: 'Full · closed' }
    : spotsLeft === 1
      ? { tone: 'red', text: 'Needs 1 player · urgent' }
      : { tone: 'green', text: `Open · ${spotsLeft} spots left` };

  const onConfirmJoin = async () => {
    if (!currentUser) return;
    setJoining(true);
    try {
      const result = await joinOpenGame(game.id, { userId: currentUser.id, paymentMethod: method });
      payShare.close();
      showToast(result?.message ?? 'You are in — spot confirmed');
      reload();
      reloadMembers();
      navigate(`${paths.solo.ticket}?gameId=${game.id}`, { state: { gameId: game.id } });
    } catch (joinError) {
      showToast(joinError.message || 'Could not join this match');
      reload();
      reloadMembers();
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <PageTitle title={game.title ?? 'Open game'} />

      <main className="wrap" id="main" style={{ paddingTop: 20, maxWidth: 1000 }}>
        <Breadcrumbs
          items={[{ label: 'Open games', to: paths.solo.openGames }, { label: game.title ?? 'Match' }]}
        />

        <div className="between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div>
            <div className="row-wrap" style={{ marginBottom: 6 }}>
              <span className={`badge ${statusBadge.tone}`}>{statusBadge.text}</span>
              {game.gameCode ? <span className="badge blue nodot">{game.gameCode}</span> : null}
              <span className="skill">{skillLabel(game.skillLevel)}</span>
            </div>
            <h1 style={{ fontSize: 24, marginBottom: 2 }}>{game.title}</h1>
            <span className="subtle">
              {venueLine} ·{' '}
              <b className="num" style={{ color: 'var(--text)' }}>
                {whenLabel}
              </b>
            </span>
          </div>
        </div>

        <div className="gd-grid">
          <div className="stack">
            <section className="card">
              <h3>Match info</h3>
              <div className="grid3" style={{ marginTop: 8, gap: 10 }}>
                {matchFacts.map((fact) => (
                  <div className="panel" key={fact.id}>
                    <span className="tiny subtle">{fact.label}</span>
                    <br />
                    <b>{fact.value}</b>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ margin: '12px 0 0' }}>
                {filledCount} of {capacity} players confirmed. The turf owner manages pitch entry — arrive a few
                minutes before kickoff for handover.
              </p>
            </section>

            <section className="card">
              <h3 style={{ margin: 0 }}>Host</h3>
              <div className="row" style={{ marginTop: 10 }}>
                <span className="avatar lg c">
                  {members.find((member) => Number(member.userId) === Number(game.organizerId))?.initials ?? '★'}
                </span>
                <div>
                  <b>{game.organizerName ?? 'TurfChai host'}</b>
                  <div className="subtle small">Organiser of this open game</div>
                  {game.minimumReliability ? (
                    <div className="row-wrap" style={{ marginTop: 4 }}>
                      <span className="badge blue nodot">
                        Requires {game.minimumReliability}% reliability
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="card">
              <h3>
                Roster · {filledCount} of {capacity}
              </h3>
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
                  Nobody has joined yet — be the first.
                </p>
              ) : (
                <>
                  <div className="row-wrap" style={{ marginTop: 10 }}>
                    {members.map((member) => (
                      <span key={member.id ?? member.userId} className="avatar" title={member.name}>
                        {member.initials ?? '??'}
                      </span>
                    ))}
                    {Array.from({ length: spotsLeft }, (_, index) => (
                      <span
                        key={`open-${index}`}
                        className="avatar"
                        style={{ background: 'var(--warn-soft)', color: 'var(--warn)', borderStyle: 'dashed' }}
                      >
                        ?
                      </span>
                    ))}
                  </div>
                  <p className="subtle small" style={{ margin: '8px 0 0' }}>
                    {spotsLeft > 0
                      ? `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} still open — any position welcome.`
                      : 'This match is full.'}
                  </p>
                </>
              )}
            </section>

            <section className="card">
              <h3>Rules &amp; cancellation</h3>
              <ul className="small muted" style={{ margin: '6px 0 10px', paddingLeft: 18, lineHeight: 1.9 }}>
                {RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>
          </div>

          {/* Join panel */}
          <aside className="glass glass-card" style={{ position: 'sticky', top: 84 }}>
            <div className="between">
              <span>
                <b className="num" style={{ fontSize: 22 }}>
                  {formatBdt(game.pricePerPlayer)}
                </b>{' '}
                <span className="subtle">your share</span>
              </span>
              <span className={`badge ${statusBadge.tone}`}>
                {isClosed ? 'Full' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
              </span>
            </div>
            <div className="panel" style={{ margin: '12px 0' }}>
              <div className="between small">
                <span className="muted">Match details</span>
                <b style={{ color: 'var(--brand-600)' }}>{skillLabel(game.skillLevel)}</b>
              </div>
              <ul className="tiny muted" style={{ margin: '6px 0 0', paddingLeft: 16, lineHeight: 1.8 }}>
                {matchSummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            {!currentUser ? (
              <>
                <Button variant="primary" size="lg" block to={`${paths.auth}?next=${paths.solo.game(game.id)}`}>
                  Sign in to join
                </Button>
                <p className="tiny subtle center" style={{ marginTop: 8 }}>
                  You need a TurfChai account to claim a spot.
                </p>
              </>
            ) : alreadyJoined ? (
              <>
                <Button variant="secondary" size="lg" block to={`${paths.solo.ticket}?gameId=${game.id}`}>
                  View your ticket
                </Button>
                <p className="tiny subtle center" style={{ marginTop: 8 }}>
                  You are already on this roster.
                </p>
              </>
            ) : isClosed ? (
              <>
                <button className="btn btn-primary btn-lg btn-block" type="button" disabled>
                  Match full
                </button>
                <p className="tiny subtle center" style={{ marginTop: 8 }}>
                  Every spot is taken.{' '}
                  <Link to={paths.solo.alerts}>Set an LFG alert</Link> to hear about similar games.
                </p>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-lg btn-block" type="button" onClick={payShare.open}>
                  Join match
                </button>
                <p className="tiny subtle center" style={{ marginTop: 8 }}>
                  Spots are first come, first served — confirm to claim yours.
                </p>
              </>
            )}
          </aside>
        </div>
      </main>

      {/* Pay share sheet */}
      <Overlay
        isOpen={payShare.isOpen}
        onClose={payShare.close}
        title="Pay your share"
        mode="sheet"
        hideHeader
        showGrabber
      >
        <div className="between">
          <h3>Pay your share</h3>
        </div>
        <p className="subtle small">
          {game.title} · {whenLabel} · {game.venueName}
        </p>
        <div className="pricerow" style={{ marginTop: 8 }}>
          <span>
            Your share (1 of {capacity})
          </span>
          <span className="num">{formatBdt(game.pricePerPlayer)}</span>
        </div>
        <div className="pricerow total">
          <span>Due now</span>
          <span className="num">{formatBdt(game.pricePerPlayer)}</span>
        </div>
        <div className="grid3" style={{ gap: 8, margin: '14px 0' }}>
          {PAYMENT_METHODS.map((option) => (
            <button
              key={option}
              className="btn btn-secondary"
              type="button"
              onClick={() => setMethod(option)}
              style={
                method === option
                  ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)' }
                  : undefined
              }
            >
              {method === option ? `${option} ✓` : option}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary btn-lg btn-block"
          type="button"
          onClick={onConfirmJoin}
          disabled={joining}
        >
          {joining ? 'Joining…' : `Pay ${formatBdt(game.pricePerPlayer)} with ${method}`}
        </button>
        <p className="tiny subtle center" style={{ marginTop: 8 }}>
          If the join fails the spot reopens — you&apos;re never charged for a failed attempt.
        </p>
        <button className="btn btn-tertiary btn-block" type="button" onClick={payShare.close}>
          Cancel
        </button>
      </Overlay>
    </>
  );
}
