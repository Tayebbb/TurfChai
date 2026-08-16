import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { BackButton } from '@/components/buttons/BackButton';
import { Button } from '@/components/buttons/Button';
import { Badge } from '@/components/ui/Badge';
import { Overlay } from '@/components/modals/Overlay';
import {
  getTournamentDetail,
  getMyTournaments,
  registrationState,
  withdrawFromTournament,
} from '@/api/playerTournaments';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { getToken } from '@/api/client';
import { paths } from '@/routes/paths';
import { DashCard, DashEmpty, DashError, DashSkeleton } from './dashboard/DashboardKit';
import './TournamentDetailPage.css';

const bdt = (value) =>
  value == null ? null : `৳${Math.round(Number(value)).toLocaleString('en-IN')}`;

const formatTime = (time) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
};

const formatDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

export default function TournamentDetailPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirmWithdraw = useDisclosure(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const detail = useApi(() => getTournamentDetail(code), [code]);
  // The bracket itself is public; "am I registered?" is not.
  const signedIn = Boolean(getToken());
  const mine = useApi(
    () => (signedIn ? getMyTournaments() : Promise.resolve([])),
    [code, signedIn],
  );

  const tournament = detail.data;
  const myCard = mine.data?.find((card) => card.code === code) ?? null;
  const state = registrationState(
    myCard ?? {
      status: tournament?.status,
      spotsLeft: tournament ? tournament.teamCapacity - tournament.teams.length : 0,
    },
  );

  const withdraw = async () => {
    setWithdrawing(true);
    try {
      await withdrawFromTournament(code);
      showToast('Registration withdrawn');
      confirmWithdraw.close();
      mine.reload();
      detail.reload();
    } catch (error) {
      showToast(error.message ?? 'Could not withdraw — try again');
    } finally {
      setWithdrawing(false);
    }
  };

  if (detail.loading) {
    return (
      <main className="wrap" style={{ paddingTop: 24 }} id="main">
        <PageTitle title="Tournament" />
        <DashSkeleton rows={4} height={90} />
      </main>
    );
  }

  if (detail.error) {
    return (
      <main className="wrap" style={{ paddingTop: 24 }} id="main">
        <PageTitle title="Tournament" />
        <DashCard>
          {detail.error.status === 404 ? (
            <DashEmpty
              icon="🏆"
              title="Tournament not found"
              actions={
                <Button size="sm" to={paths.player.dashboard.tournaments}>
                  Browse tournaments
                </Button>
              }
            >
              This tournament may have been removed, or the link is incorrect.
            </DashEmpty>
          ) : (
            <DashError onRetry={detail.reload} message={detail.error.message} />
          )}
        </DashCard>
      </main>
    );
  }

  const spotsLeft = tournament.teamCapacity - tournament.teams.length;
  const paidTeams = tournament.teams.filter((team) => team.entryFeeStatus === 'PAID').length;

  return (
    <>
      <PageTitle title={tournament.name} />
      <main className="wrap" style={{ paddingTop: 20, paddingBottom: 48 }} id="main">
        <BackButton to={paths.player.dashboard.tournaments}>Tournaments</BackButton>

        <header className="tdx-hero">
          <div className="tdx-hero-art" aria-hidden="true">
            🏆
          </div>
          <div className="tdx-hero-body">
            <div className="row-wrap" style={{ gap: 6, marginBottom: 8 }}>
              <Badge tone={state.tone}>{state.label}</Badge>
              <Badge tone="gray" dot={false}>
                {tournament.format.toLowerCase().replaceAll('_', '-')}
              </Badge>
              {tournament.privacy === 'INVITE_ONLY' ? (
                <Badge tone="gray" dot={false}>
                  Invite-only
                </Badge>
              ) : null}
            </div>
            <h1>{tournament.name}</h1>
            <p className="tdx-meta">
              {formatDate(tournament.date)} · {formatTime(tournament.windowStart)} –{' '}
              {formatTime(tournament.windowEnd)}
            </p>
            <p className="tdx-meta">
              <Link to={paths.player.venue(tournament.venueSlug)}>{tournament.venueName}</Link> ·{' '}
              <span className="num">{tournament.code}</span>
            </p>
          </div>

          <div className="tdx-cta">
            {myCard ? (
              <>
                <div className="tdx-reg">
                  <span>Registration</span>
                  <b className="num">{myCard.myRegistrationCode}</b>
                </div>
                {myCard.myPaymentStatus === 'PAID' ? (
                  <Badge tone="green">Entry fee paid</Badge>
                ) : (
                  <p className="tdx-note">
                    Entry fee {bdt(tournament.entryFeePerTeam)} is due — settle it with the
                    organiser until online payments go live.
                  </p>
                )}
                {myCard.myPaymentStatus !== 'PAID' ? (
                  <Button variant="tertiary" size="sm" onClick={confirmWithdraw.open}>
                    Withdraw registration
                  </Button>
                ) : null}
              </>
            ) : state.actionable ? (
              <Button
                variant="primary"
                onClick={() => navigate(paths.player.tournamentRegister(code))}
              >
                Register a team
              </Button>
            ) : (
              <Button variant="secondary" disabled>
                {state.label}
              </Button>
            )}
          </div>
        </header>

        <div className="tdx-grid">
          <div className="stack" style={{ gap: 18 }}>
            <DashCard title="At a glance">
              <div className="dash-stats">
                <div className="dash-stat">
                  <b>{bdt(tournament.entryFeePerTeam)}</b>
                  <span>Entry fee per team</span>
                </div>
                <div className="dash-stat">
                  <b>{bdt(tournament.prizePool)}</b>
                  <span>Prize pool</span>
                </div>
                <div className="dash-stat">
                  <b>
                    {tournament.teams.length}/{tournament.teamCapacity}
                  </b>
                  <span>Teams registered</span>
                </div>
                <div className="dash-stat">
                  <b>{spotsLeft}</b>
                  <span>Spots left</span>
                </div>
              </div>
            </DashCard>

            <DashCard title={`Registered teams (${tournament.teams.length})`}>
              {tournament.teams.length === 0 ? (
                <DashEmpty icon="👥" title="No teams yet">
                  Be the first to register — the bracket is drawn once teams have paid.
                </DashEmpty>
              ) : (
                <div className="dash-rows">
                  {tournament.teams.map((team) => (
                    <div key={team.id} className="dash-row">
                      <div className="dash-row-main">
                        <b>{team.name}</b>
                        <span>{team.captainName ? `Captain ${team.captainName}` : 'Captain TBC'}</span>
                      </div>
                      <Badge tone={team.entryFeeStatus === 'PAID' ? 'green' : 'amber'}>
                        {team.entryFeeStatus === 'PAID' ? 'Paid' : 'Fee due'}
                      </Badge>
                    </div>
                  ))}
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
                    {paidTeams} of {tournament.teams.length} teams have settled their entry fee.
                  </p>
                </div>
              )}
            </DashCard>

            <DashCard title="Fixtures">
              {tournament.fixtures.length === 0 ? (
                <DashEmpty icon="📋" title="Bracket not drawn yet">
                  The organiser generates fixtures once enough teams have paid their entry fee.
                </DashEmpty>
              ) : (
                <div className="table-wrap">
                  <table className="table" style={{ minWidth: 420 }}>
                    <thead>
                      <tr>
                        <th>Round</th>
                        <th>Time</th>
                        <th>Pitch</th>
                        <th>Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournament.fixtures.map((fixture) => (
                        <tr key={fixture.id}>
                          <td>{fixture.roundLabel}</td>
                          <td className="num">
                            {fixture.startTime ? formatTime(fixture.startTime) : '—'}
                          </td>
                          <td>{fixture.pitchName ?? '—'}</td>
                          <td>
                            {fixture.status === 'BYE'
                              ? `${fixture.teamA} — bye`
                              : `${fixture.teamA} vs ${fixture.teamB}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DashCard>
          </div>

          <aside className="stack" style={{ gap: 18 }}>
            <DashCard title="Schedule">
              <div className="dash-rows">
                <div className="dash-row">
                  <div className="dash-row-main">
                    <b>{formatDate(tournament.date)}</b>
                    <span>
                      {formatTime(tournament.windowStart)} – {formatTime(tournament.windowEnd)}
                    </span>
                  </div>
                </div>
                {tournament.balanceDueDate ? (
                  <div className="dash-row">
                    <div className="dash-row-main">
                      <b>Balance due</b>
                      <span>{formatDate(tournament.balanceDueDate)}</span>
                    </div>
                  </div>
                ) : null}
                {tournament.reservations.length ? (
                  <div className="dash-row">
                    <div className="dash-row-main">
                      <b>{tournament.reservations.length} pitch slots reserved</b>
                      <span>
                        {new Set(tournament.reservations.map((r) => r.pitchName)).size} pitches at{' '}
                        {tournament.venueName}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </DashCard>

            <DashCard title="Venue">
              <div className="dash-rows">
                <Link className="dash-row" to={paths.player.venue(tournament.venueSlug)}>
                  <div className="dash-row-main">
                    <b>{tournament.venueName}</b>
                    <span>View venue details, map and directions</span>
                  </div>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </DashCard>
          </aside>
        </div>
      </main>

      <Overlay
        isOpen={confirmWithdraw.isOpen}
        onClose={confirmWithdraw.close}
        title="Withdraw registration?"
      >
        <p className="small muted">
          Your team will be removed from {tournament.name} and the spot released to other players.
          You can register again while spots remain.
        </p>
        <div className="stack-sm" style={{ marginTop: 14 }}>
          <Button variant="danger" block disabled={withdrawing} onClick={withdraw}>
            {withdrawing ? 'Withdrawing…' : 'Yes, withdraw'}
          </Button>
          <Button variant="tertiary" block onClick={confirmWithdraw.close}>
            Keep my registration
          </Button>
        </div>
      </Overlay>
    </>
  );
}
