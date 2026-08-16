import { useState } from 'react';
import { PageTitle } from '@/components/common/PageTitle';
import { BackButton } from '@/components/buttons/BackButton';
import { KpiCard } from '@/components/cards/KpiCard';
import { useApi } from '@/hooks/useApi';
import { useHostTournamentCode } from './useHostTournamentCode';
import {
  getTournament,
  payBalance,
  updateTournamentSettings,
  regenerateInviteCode,
  generateFixtures,
  registerTeam,
  bdt,
  formatTime,
  formatDate,
} from '@/api/tournaments';
import { useToast } from '@/hooks/useToast';
import { toUserMessage } from '@/utils/errorMessage';
import { canCall, callNumber } from '@/utils/deviceActions';
import { paths } from '@/routes/paths';

// Shown before the tournament arrives, or if it cannot be loaded. Every value
// is a dash: this card used to display another tournament's figures — 12 days
// to kickoff, 13/16 teams, ৳17,120 collected — as if they were this one's.
const EMPTY_KPIS = [
  { id: 'days', label: 'Days to kickoff', value: '—' },
  { id: 'fees', label: 'Entry fees collected', value: '—' },
  { id: 'teams', label: 'Teams registered', value: '—' },
  { id: 'slots', label: 'Slots reserved', value: '—' },
];

const PRIVACY_HINTS = {
  invite: 'Hidden from search — teams can only join through your invite link.',
  open: 'Listed publicly — any team on TurfChai can find this tournament and request to join.',
};

export default function TournamentPage() {
  const { showToast } = useToast();
  const { code, loading: resolvingCode } = useHostTournamentCode();
  const tournament = useApi(() => (code ? getTournament(code) : Promise.resolve(null)), [code]);
  const live = tournament.data;

  // Live API data, or dashes until it arrives.
  const header = live
    ? {
        name: live.name,
        venue: live.venueName,
        date: formatDate(live.date),
        window: `${formatTime(live.windowStart)}\u2013${formatTime(live.windowEnd)}`,
        code: live.code,
        teamsLabel: `${live.teams.length}/${live.teamCapacity} teams`,
        balance: bdt(live.costs.balance),
        deposit: bdt(live.costs.deposit),
        balanceDue: formatDate(live.balanceDueDate),
      }
    : {
        // Neutral placeholders while loading or when the API is unreachable;
        // the demo fixtures module is empty in deployed builds.
        name: 'Tournament',
        venue: '—',
        date: '—',
        window: '—',
        code: code,
        teamsLabel: '—',
        balance: '—',
        deposit: '—',
        balanceDue: '—',
      };

  const paidTeams = live ? live.teams.filter((team) => team.entryFeeStatus === 'PAID').length : 0;
  const feesCollected = live
    ? live.teams.reduce((sum, team) => sum + Number(team.entryFeePaid), 0)
    : 0;
  const feesExpected = live ? live.teamCapacity * Number(live.entryFeePerTeam) : 0;
  // Captured once per mount — "days to kickoff" doesn't need live ticking.
  const [now] = useState(() => Date.now());
  const daysToKickoff = live
    ? Math.max(0, Math.ceil((new Date(`${live.date}T00:00:00`) - now) / 86400000))
    : null;

  const kpis = live
    ? [
        { id: 'days', label: 'Days to kickoff', value: String(daysToKickoff), delta: 'On track', trend: 'up' },
        {
          id: 'fees',
          label: 'Entry fees collected',
          value: feesExpected ? `${Math.round((feesCollected / feesExpected) * 100)}%` : '—',
          delta: `${bdt(feesCollected)} / ${bdt(feesExpected)}`,
        },
        {
          id: 'teams',
          label: 'Teams registered',
          value: `${live.teams.length} / ${live.teamCapacity}`,
          delta: `${paidTeams} paid entry`,
          trend: 'up',
        },
        {
          id: 'slots',
          label: 'Slots reserved',
          value: String(live.costs.slotCount),
          delta: `${new Set(live.reservations.map((r) => r.pitchName)).size} pitches · ${header.window}`,
        },
      ]
    : EMPTY_KPIS;

  const scheduleRows = live
    ? live.fixtures.map((fixture) => ({
        id: String(fixture.id),
        time: fixture.status === 'BYE' ? '—' : formatTime(fixture.startTime),
        pitch: fixture.pitchName ? fixture.pitchName.replace('Pitch ', '') : '—',
        fixture:
          fixture.status === 'BYE'
            ? `${fixture.roundLabel} · ${fixture.teamA} — bye`
            : `${fixture.roundLabel} · ${fixture.teamA} vs ${fixture.teamB}`,
      }))
    : [];

  const teamChips = live
    ? [
        ...live.teams.slice(0, 5).map((team) => ({ id: String(team.id), label: team.name, on: true })),
        ...(live.teams.length > 5
          ? [{ id: 'more', label: `+${live.teams.length - 5} more`, on: true }]
          : []),
        ...(live.teamCapacity > live.teams.length
          ? [{ id: 'spots', label: `${live.teamCapacity - live.teams.length} spots left`, on: false }]
          : []),
      ]
    : [];

  // A real link or nothing: the fallback used to be another tournament's code,
  // which any host could have copied and handed to their teams.
  const inviteLink = live?.inviteCode ? `turfchai.app/${live.inviteCode}` : '';

  const livePrivacy = live?.privacy === 'INVITE_ONLY' ? 'invite' : live?.privacy ? 'open' : null;
  const [privacyOverride, setPrivacyOverride] = useState(null);
  const privacy = privacyOverride ?? livePrivacy ?? 'invite';
  const privacyLabel = privacy === 'invite' ? '\ud83d\udd12 Invite-only' : '\ud83c\udf10 Open';
  const statusLabel = live
    ? { DRAFT: 'Draft · not published', PUBLISHED: 'Published · taking teams', CONFIRMED: 'Venue confirmed · slots reserved' }[
        live.status
      ] ?? live.status
    : '—';
  const formatLabel = live?.format ? live.format.toLowerCase().replaceAll('_', '-') : '—';
  const depositPct = live && Number(live.costs.total) > 0
    ? Math.round((Number(live.costs.deposit) / Number(live.costs.total)) * 100)
    : 0;
  const teamsDue = live ? live.teams.filter((team) => team.entryFeeStatus !== 'PAID').length : null;

  const [notes, setNotes] = useState(null);
  const [busy, setBusy] = useState(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCaptain, setNewTeamCaptain] = useState('');
  const notesValue = notes ?? live?.hostNotes ?? '';
  const balancePaid = live?.balance?.status === 'PAID';
  const depositPaid = live?.deposit?.status === 'PAID';
  const venueContact = live?.venueContact ?? null;

  /** Runs one host action, keeping the button single-flight and never claiming a success that did not happen. */
  const runHostAction = async (key, action, successMessage, fallbackMessage) => {
    if (busy) return;
    setBusy(key);
    try {
      await action();
    } catch (error) {
      showToast(toUserMessage(error, fallbackMessage));
      return;
    } finally {
      setBusy(null);
    }
    tournament.reload();
    showToast(successMessage);
  };

  const changePrivacy = (next) => {
    if (!live) return;
    runHostAction(
      `privacy-${next}`,
      async () => {
        await updateTournamentSettings(code, { privacy: next === 'invite' ? 'invite_only' : 'open' });
        setPrivacyOverride(next);
      },
      next === 'invite'
        ? '🔒 Tournament is now invite-only'
        : '🌐 Tournament is now open to everyone',
      'Could not change the tournament privacy.',
    );
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard?.writeText(inviteLink);
    } catch {
      showToast('Could not copy — select the link and copy it manually.');
      return;
    }
    showToast('🔗 Invite link copied — share it with team captains');
  };

  // A host with no tournament yet has nothing to retry — that is an empty
  // state, not a failure.
  if (!resolvingCode && !code) {
    return (
      <>
        <PageTitle title="Tournament" />
        <div className="wrap" style={{ paddingTop: 20, maxWidth: 1100, paddingBottom: 60 }}>
          <BackButton to={paths.host.hub}>Host hub</BackButton>
          <div className="card" style={{ padding: 24, marginTop: 12 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>No tournament yet</h1>
            <p className="subtle" style={{ marginBottom: 14 }}>
              Reserve the pitches you need and your host workspace opens here.
            </p>
            <a className="btn btn-primary" href={paths.host.multiPitch}>
              Reserve pitches
            </a>
          </div>
        </div>
      </>
    );
  }

  // An authorization failure must not be papered over with sample content:
  // rendering a populated host workspace (invite links, venue contact, private
  // notes) after the server said "no" misrepresents what the caller can see.
  const deniedStatus = tournament.error?.status;
  if (deniedStatus === 401 || deniedStatus === 403 || deniedStatus === 404) {
    const notFound = deniedStatus === 404;
    return (
      <>
        <PageTitle title="Tournament" />
        <div className="wrap" style={{ paddingTop: 20, maxWidth: 1100, paddingBottom: 60 }}>
          <BackButton to={paths.host.hub}>Host hub</BackButton>
          <div className="card" style={{ padding: 24, marginTop: 12 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>
              {notFound ? 'Tournament not found' : 'You do not host this tournament'}
            </h1>
            <p className="subtle" style={{ marginBottom: 14 }}>
              {notFound
                ? `No tournament matches ${code}.`
                : 'Only the organiser who created a tournament can open its host workspace.'}
            </p>
            <button className="btn btn-secondary" type="button" onClick={tournament.reload}>
              Try again
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={header.name} />

      <div className="wrap" style={{ paddingTop: 20, maxWidth: 1100, paddingBottom: 60 }}>
        <BackButton to={paths.host.hub}>Host hub</BackButton>

        {tournament.error ? (
          <div className="alert warn" style={{ marginBottom: 12 }}>
            <span className="ico">⚠️</span>
            <div className="tiny">
              Couldn’t load live tournament data — the figures below are unavailable, not zero.{' '}
              <button className="btn btn-sm btn-tertiary" type="button" onClick={tournament.reload}>
                Retry
              </button>
            </div>
          </div>
        ) : null}

        <div className="between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, marginBottom: 2 }}>🏆 {header.name}</h1>
            <span className="subtle small">
              {header.venue} · {header.date} · {header.window} · {formatLabel} ·{' '}
              <span className="num">{header.code}</span>
            </span>
            <div className="row-wrap" style={{ marginTop: 6 }}>
              <span className="badge green">{statusLabel}</span>
              <span className="badge amber">{header.teamsLabel}</span>
              <span className="badge gray nodot">{privacyLabel}</span>
            </div>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!live || balancePaid || !depositPaid || busy !== null}
            title={
              !live
                ? 'Tournament is still loading'
                : !depositPaid
                  ? 'Pay the deposit first'
                  : balancePaid
                    ? 'The balance is already settled'
                    : undefined
            }
            onClick={() =>
              runHostAction(
                'balance',
                () => payBalance(code, { method: 'bKash' }),
                `Balance paid ${header.balance} ✓ — reservation fully paid`,
                'Could not take the balance payment.',
              )
            }
          >
            {balancePaid
              ? 'Balance paid ✓'
              : busy === 'balance'
                ? 'Paying…'
                : `Pay balance · ${header.balance}`}
          </button>
        </div>

        <div className="grid4" style={{ marginBottom: 14 }}>
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} delta={kpi.delta} trend={kpi.trend} />
          ))}
        </div>

        <div className="grid2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <div className="card">
              <div className="between">
                <h3 style={{ margin: 0 }}>Venue payment</h3>
                <span className="badge amber">Balance due {header.balanceDue}</span>
              </div>
              <div className="progress" style={{ margin: '10px 0' }}>
                <i style={{ width: `${depositPct}%` }} />
              </div>
              <div className="between small">
                <span className="muted">Deposit · recorded by the organiser</span>
                <b className="num">{header.deposit} ✓</b>
              </div>
              <div className="between small" style={{ marginTop: 4 }}>
                <span className="muted">Balance · due {header.balanceDue}</span>
                <b className="num">{header.balance}</b>
              </div>
              <p className="tiny subtle" style={{ margin: '8px 0 0' }}>
                {teamsDue == null
                  ? 'Team entry fees auto-remind Thu 9 AM.'
                  : teamsDue === 0
                    ? 'All registered teams have paid their entry fee ✓'
                    : `Team entry fees auto-remind Thu 9 AM · ${teamsDue} team${teamsDue > 1 ? 's' : ''} still due.`}
              </p>
            </div>

            <div className="card">
              <h3>Match schedule · {header.date}</h3>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="table" style={{ minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Pitch</th>
                      <th>Fixture</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((fixture) => (
                      <tr key={fixture.id}>
                        <td className="num">{fixture.time}</td>
                        <td>{fixture.pitch}</td>
                        <td>{fixture.fixture}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn btn-sm btn-secondary"
                type="button"
                style={{ marginTop: 8 }}
                disabled={!live || busy !== null}
                title={live ? 'Rebuilds the bracket from teams whose entry fee is paid' : 'Tournament is still loading'}
                onClick={() =>
                  runHostAction(
                    'fixtures',
                    () => generateFixtures(code),
                    'Fixtures generated ✓',
                    'Could not generate fixtures.',
                  )
                }
              >
                {busy === 'fixtures'
                  ? 'Generating…'
                  : scheduleRows.length > 0
                    ? 'Regenerate fixtures'
                    : 'Generate fixtures'}
              </button>
            </div>

            <div className="card">
              <div className="between">
                <h3 style={{ margin: 0 }}>Teams · {header.teamsLabel}</h3>
                <span className="badge gray nodot">Joined via invite link</span>
              </div>
              <div className="row-wrap" style={{ marginTop: 10 }}>
                {teamChips.map((team) => (
                  <span key={team.id} className={team.on ? 'chip on' : 'chip'}>
                    {team.label}
                  </span>
                ))}
              </div>

              <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="input"
                  style={{ flex: '1 1 160px' }}
                  aria-label="Team name"
                  placeholder="Team name"
                  value={newTeamName}
                  onChange={(event) => setNewTeamName(event.target.value)}
                />
                <input
                  className="input"
                  style={{ flex: '1 1 160px' }}
                  aria-label="Captain name"
                  placeholder="Captain (optional)"
                  value={newTeamCaptain}
                  onChange={(event) => setNewTeamCaptain(event.target.value)}
                />
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={!live || !newTeamName.trim() || busy !== null}
                  title={live ? undefined : 'Tournament is still loading'}
                  onClick={() =>
                    runHostAction(
                      'team',
                      async () => {
                        await registerTeam(code, newTeamName.trim(), newTeamCaptain.trim() || undefined);
                        setNewTeamName('');
                        setNewTeamCaptain('');
                      },
                      'Team added ✓',
                      'Could not add that team.',
                    )
                  }
                >
                  {busy === 'team' ? 'Adding…' : '+ Add team'}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="between">
                <h3 style={{ margin: 0 }}>Event-day notes</h3>
                <span className="badge gray nodot">Private to you</span>
              </div>
              <textarea
                className="input"
                rows="3"
                style={{ marginTop: 10, resize: 'vertical' }}
                value={notesValue}
                onChange={(event) => setNotes(event.target.value)}
                aria-label="Event-day notes"
              />
              <button
                className="btn btn-sm btn-secondary"
                type="button"
                style={{ marginTop: 8 }}
                disabled={!live || busy !== null || notesValue === (live?.hostNotes ?? '')}
                title={
                  !live
                    ? 'Tournament is still loading'
                    : notesValue === (live?.hostNotes ?? '')
                      ? 'No changes to save'
                      : undefined
                }
                onClick={() =>
                  runHostAction(
                    'notes',
                    async () => {
                      await updateTournamentSettings(code, { hostNotes: notesValue });
                      setNotes(null);
                    },
                    'Notes saved ✓',
                    'Could not save your notes.',
                  )
                }
              >
                {busy === 'notes' ? 'Saving…' : 'Save notes'}
              </button>
            </div>
          </div>

          <div className="stack">
            <div className="card">
              <div className="between">
                <h3 style={{ margin: 0 }}>Registration &amp; privacy</h3>
                <span className="badge gray nodot">{privacyLabel}</span>
              </div>
              <div className="seg" style={{ display: 'flex', marginTop: 12 }} role="tablist" aria-label="Registration privacy">
                <button
                  type="button"
                  role="tab"
                  aria-selected={privacy === 'open'}
                  className={privacy === 'open' ? 'on' : undefined}
                  style={{ flex: 1 }}
                  onClick={() => changePrivacy('open')}
                >
                  🌐 Open
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={privacy === 'invite'}
                  className={privacy === 'invite' ? 'on' : undefined}
                  style={{ flex: 1 }}
                  onClick={() => changePrivacy('invite')}
                >
                  🔒 Invite-only
                </button>
              </div>
              <p className="tiny subtle" style={{ margin: '8px 0 0' }}>
                {PRIVACY_HINTS[privacy]}
                {live ? ` ${live.teams.length} team${live.teams.length === 1 ? '' : 's'} joined so far.` : ''}
              </p>
              {privacy === 'invite' ? (
                <div className="panel" style={{ marginTop: 10 }}>
                  <b className="small">Invite link</b>
                  <div className="row" style={{ marginTop: 6 }}>
                    <input
                      className="input"
                      readOnly
                      value={inviteLink}
                      placeholder="No invite link yet"
                      aria-label="Invite link"
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={copyInvite}
                      disabled={!inviteLink}
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    className="btn btn-sm btn-tertiary"
                    type="button"
                    style={{ marginTop: 8 }}
                    disabled={!live || busy !== null}
                    title={live ? 'The current link stops working immediately' : 'Tournament is still loading'}
                    onClick={() =>
                      runHostAction(
                        'invite',
                        () => regenerateInviteCode(code),
                        '🔄 Old link disabled — new invite link generated',
                        'Could not regenerate the invite link.',
                      )
                    }
                  >
                    {busy === 'invite' ? 'Regenerating…' : 'Regenerate link'}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="card">
              <b style={{ fontFamily: 'var(--font-display)' }}>Venue contact</b>
              {venueContact ? (
                <div className="panel between" style={{ marginTop: 10 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="avatar b">{venueContact.initials}</span>
                    <div>
                      <b className="small">{venueContact.name}</b>
                      <div className="tiny subtle">Owner · {header.venue}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      type="button"
                      disabled={!canCall(venueContact.phone)}
                      title={canCall(venueContact.phone) ? `Call ${venueContact.phone}` : 'No phone number on file'}
                      onClick={() => callNumber(venueContact.phone)}
                    >
                      Call
                    </button>
                    <button
                      className="btn btn-sm btn-tertiary"
                      type="button"
                      disabled
                      title="In-app messaging is not available yet — use the phone number."
                    >
                      Chat
                    </button>
                  </div>
                </div>
              ) : (
                <p className="tiny subtle" style={{ marginTop: 10 }}>
                  {tournament.loading ? 'Loading…' : 'No contact on file for this venue yet.'}
                </p>
              )}
            </div>

            <div className="card">
              <h3>Cancellation terms</h3>
              <p className="tiny muted" style={{ margin: '8px 0 0' }}>
                TurfChai does not publish a refund schedule for tournament
                reservations. Talk to support before your balance due date
                {header.balanceDue !== '—' ? ` (${header.balanceDue})` : ''}.
              </p>
              <button
                className="btn btn-sm btn-ghost-danger"
                type="button"
                style={{ marginTop: 8 }}
                disabled
                title="Cancelling a tournament reservation is handled by support — self-service cancellation is not available yet."
              >
                Cancel reservation…
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
