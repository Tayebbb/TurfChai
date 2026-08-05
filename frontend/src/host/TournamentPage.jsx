import { useState } from 'react';
import { PageTitle } from '@/components/common/PageTitle';
import { BackButton } from '@/components/buttons/BackButton';
import { KpiCard } from '@/components/cards/KpiCard';
import { ramadanCup, tournamentFixtures } from '@/data/tournaments';
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
  const [privacy, setPrivacy] = useState('invite');
  const [notes, setNotes] = useState(
    'Referees arrive 7:30 AM. PA system check 7:45. Trophy table near Pitch D.',
  );

  const changePrivacy = (next) => {
    setPrivacy(next);
    showToast(next === 'invite' ? '🔒 Tournament is now invite-only' : '🌐 Tournament is now open to everyone');
  };

  const copyInvite = () => {
    navigator.clipboard?.writeText(INVITE_LINK);
    showToast('🔗 Invite link copied — share it with team captains');
  };

  return (
    <>
      <PageTitle title="Ramadan Cup 2027" />

      <div className="wrap" style={{ paddingTop: 20, maxWidth: 1100, paddingBottom: 60 }}>
        <BackButton to={paths.host.hub}>Host hub</BackButton>

        <div className="between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, marginBottom: 2 }}>🏆 {ramadanCup.name}</h1>
            <span className="subtle small">
              {ramadanCup.venue} · {ramadanCup.date} · {ramadanCup.window} · 3 pitches · knockout ·{' '}
              <span className="num">{ramadanCup.id}</span>
            </span>
            <div className="row-wrap" style={{ marginTop: 6 }}>
              <span className="badge green">Venue confirmed · deposit paid</span>
              <span className="badge amber">13/16 teams</span>
              <span className="badge gray nodot">🔒 Invite-only</span>
            </div>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => showToast('Balance paid ৳25,680 via bKash ✓ — reservation fully paid')}
          >
            Pay balance · {ramadanCup.balance}
          </button>
        </div>

        <div className="grid4" style={{ marginBottom: 14 }}>
          {KPIS.map((kpi) => (
            <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} delta={kpi.delta} trend={kpi.trend} />
          ))}
        </div>

        <div className="grid2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <div className="card">
              <div className="between">
                <h3 style={{ margin: 0 }}>Venue payment</h3>
                <span className="badge amber">Balance due 20 Aug</span>
              </div>
              <div className="progress" style={{ margin: '10px 0' }}>
                <i style={{ width: '40%' }} />
              </div>
              <div className="between small">
                <span className="muted">Deposit paid · bKash TXN {ramadanCup.depositTxn}</span>
                <b className="num">{ramadanCup.deposit} ✓</b>
              </div>
              <div className="between small" style={{ marginTop: 4 }}>
                <span className="muted">Balance · due {ramadanCup.balanceDue}</span>
                <b className="num">{ramadanCup.balance}</b>
              </div>
              <p className="tiny subtle" style={{ margin: '8px 0 0' }}>
                Team entry fees auto-remind Thu 9 AM · 3 teams still due.
              </p>
            </div>

            <div className="card">
              <h3>Match schedule · Sat 23 Aug</h3>
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
                    {tournamentFixtures.map((fixture) => (
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
                <h3 style={{ margin: 0 }}>Teams · 13 of 16</h3>
                <span className="badge gray nodot">Joined via invite link</span>
              </div>
              <div className="row-wrap" style={{ marginTop: 10 }}>
                {TEAM_CHIPS.map((team) => (
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
                      value={INVITE_LINK}
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
