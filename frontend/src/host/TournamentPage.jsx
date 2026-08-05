import { useState } from 'react';
import { PageTitle } from '@/components/common/PageTitle';
import { BackButton } from '@/components/buttons/BackButton';
import { KpiCard } from '@/components/cards/KpiCard';
import { ramadanCup, tournamentFixtures } from '@/data/tournaments';
import { useApi } from '@/hooks/useApi';
import {
  DEMO_TOURNAMENT_CODE,
  getTournament,
  bdt,
  formatTime,
  formatDate,
} from '@/api/tournaments';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const KPIS = [
  { id: 'days', label: 'Days to kickoff', value: '12', delta: 'On track', trend: 'up' },
  { id: 'fees', label: 'Entry fees collected', value: '40%', delta: '৳17,120 / ৳42,800' },
  { id: 'teams', label: 'Teams registered', value: '13 / 16', delta: '▲ 4 this week', trend: 'up' },
  { id: 'slots', label: 'Slots reserved', value: '14', delta: '3 pitches · 8 AM–6 PM' },
];

const TEAM_CHIPS = [
  { id: 'strikers', label: 'Dhanmondi Strikers', on: true },
  { id: 'kings', label: 'Mirpur Kings', on: true },
  { id: 'uttara', label: 'Uttara FC', on: true },
  { id: 'banani', label: 'Banani Blues', on: true },
  { id: 'more', label: '+9 more', on: true },
  { id: 'spots', label: '3 spots left', on: false },
];

const CANCELLATION_TERMS = [
  { id: 'until-16', state: null, title: 'Until 16 Aug', body: 'Full refund of deposit' },
  { id: '17-20', state: 'pending', title: '17 – 20 Aug', body: '50% refund' },
  { id: 'after-20', state: 'pending', title: 'After 20 Aug', body: 'No refund · reschedule credit only' },
];

const PRIVACY_HINTS = {
  invite:
    'Hidden from search — teams can only join through your invite link. 13 teams joined this way.',
  open: 'Listed publicly — any team on TurfChai can find this tournament and request to join.',
};

const INVITE_LINK = 'turfchai.app/t/ramadan-cup-0091';

export default function TournamentPage() {
  const { showToast } = useToast();
  const tournament = useApi(() => getTournament(DEMO_TOURNAMENT_CODE), []);
  const live = tournament.data;

  // Derived view-model: live API data when available, prototype copy while
  // loading or if the backend is unreachable.
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
        name: ramadanCup.name,
        venue: ramadanCup.venue,
        date: ramadanCup.date,
        window: ramadanCup.window,
        code: ramadanCup.id,
        teamsLabel: '13/16 teams',
        balance: ramadanCup.balance,
        deposit: ramadanCup.deposit,
        balanceDue: ramadanCup.balanceDue,
      };

  const paidTeams = live ? live.teams.filter((team) => team.entryFeeStatus === 'paid').length : 0;
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
    : KPIS;

  const scheduleRows = live
    ? live.fixtures.map((fixture) => ({
        id: String(fixture.id),
        time: fixture.status === 'bye' ? '—' : formatTime(fixture.startTime),
        pitch: fixture.pitchName ? fixture.pitchName.replace('Pitch ', '') : '—',
        fixture:
          fixture.status === 'bye'
            ? `${fixture.roundLabel} · ${fixture.teamA} — bye`
            : `${fixture.roundLabel} · ${fixture.teamA} vs ${fixture.teamB}`,
      }))
    : tournamentFixtures;

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
    : TEAM_CHIPS;

  const inviteLink = live ? `turfchai.app/${live.inviteCode}` : INVITE_LINK;

  const [privacy, setPrivacy] = useState('invite');
  const [notes, setNotes] = useState(
    'Referees arrive 7:30 AM. PA system check 7:45. Trophy table near Pitch D.',
  );

  const changePrivacy = (next) => {
    setPrivacy(next);
    showToast(next === 'invite' ? '🔒 Tournament is now invite-only' : '🌐 Tournament is now open to everyone');
  };

  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteLink);
    showToast('🔗 Invite link copied — share it with team captains');
  };

  return (
    <>
      <PageTitle title={header.name} />

      <div className="wrap" style={{ paddingTop: 20, maxWidth: 1100, paddingBottom: 60 }}>
        <BackButton to={paths.host.hub}>Host hub</BackButton>

        {tournament.error ? (
          <div className="alert warn" style={{ marginBottom: 12 }}>
            <span className="ico">⚠️</span>
            <div className="tiny">
              Couldn’t load live tournament data — showing sample content.{' '}
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
              {header.venue} · {header.date} · {header.window} · knockout ·{' '}
              <span className="num">{header.code}</span>
            </span>
            <div className="row-wrap" style={{ marginTop: 6 }}>
              <span className="badge green">Venue confirmed · deposit paid</span>
              <span className="badge amber">{header.teamsLabel}</span>
              <span className="badge gray nodot">🔒 Invite-only</span>
            </div>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => showToast(`Balance paid ${header.balance} via bKash ✓ — reservation fully paid`)}
          >
            Pay balance · {header.balance}
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
                <i style={{ width: '40%' }} />
              </div>
              <div className="between small">
                <span className="muted">Deposit paid · bKash TXN {ramadanCup.depositTxn}</span>
                <b className="num">{header.deposit} ✓</b>
              </div>
              <div className="between small" style={{ marginTop: 4 }}>
                <span className="muted">Balance · due {header.balanceDue}</span>
                <b className="num">{header.balance}</b>
              </div>
              <p className="tiny subtle" style={{ margin: '8px 0 0' }}>
                Team entry fees auto-remind Thu 9 AM · 3 teams still due.
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
                onClick={() => showToast('Schedule editor — drag fixtures between pitches & times')}
              >
                Edit schedule
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
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                aria-label="Event-day notes"
              />
              <button
                className="btn btn-sm btn-secondary"
                type="button"
                style={{ marginTop: 8 }}
                onClick={() => showToast('Notes saved ✓')}
              >
                Save notes
              </button>
            </div>
          </div>

          <div className="stack">
            <div className="card">
              <div className="between">
                <h3 style={{ margin: 0 }}>Registration &amp; privacy</h3>
                <span className="badge gray nodot">🔒 Invite-only</span>
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
              </p>
              {privacy === 'invite' ? (
                <div className="panel" style={{ marginTop: 10 }}>
                  <b className="small">Invite link</b>
                  <div className="row" style={{ marginTop: 6 }}>
                    <input
                      className="input"
                      readOnly
                      value={inviteLink}
                      aria-label="Invite link"
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-secondary" type="button" onClick={copyInvite}>
                      Copy
                    </button>
                  </div>
                  <button
                    className="btn btn-sm btn-tertiary"
                    type="button"
                    style={{ marginTop: 8 }}
                    onClick={() => showToast('🔄 Old link disabled — new invite link generated')}
                  >
                    Regenerate link
                  </button>
                </div>
              ) : null}
            </div>

            <div className="card">
              <b style={{ fontFamily: 'var(--font-display)' }}>Venue contact</b>
              <div className="panel between" style={{ marginTop: 10 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="avatar b">JU</span>
                  <div>
                    <b className="small">Jashim Uddin</b>
                    <div className="tiny subtle">Owner · Mirpur Sports City</div>
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    onClick={() => showToast('Calling +880 1713 442 210 📞')}
                  >
                    Call
                  </button>
                  <button
                    className="btn btn-sm btn-tertiary"
                    type="button"
                    onClick={() => showToast('Chat opened 💬')}
                  >
                    Chat
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Cancellation terms</h3>
              <ul className="tline" style={{ marginTop: 8 }}>
                {CANCELLATION_TERMS.map((term) => (
                  <li key={term.id} className={term.state ?? undefined}>
                    <b className="small">{term.title}</b>
                    <p className="tiny muted" style={{ margin: 0 }}>
                      {term.body}
                    </p>
                  </li>
                ))}
              </ul>
              <button
                className="btn btn-sm btn-ghost-danger"
                type="button"
                style={{ marginTop: 8 }}
                onClick={() => showToast('Cancellation flow — refund preview shown before you confirm')}
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
