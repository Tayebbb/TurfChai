import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Overlay } from '@/components/modals/Overlay';
import { Switch } from '@/components/forms/Toggles';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const SPORTS = ['⚽ Football', '🏏 Cricket', '🏸 Badminton'];
const SKILLS = ['Beginner', 'Intermediate', 'Advanced'];
const AREAS = ['Dhanmondi + 3 km', 'Mohammadpur + 3 km', 'Mirpur + 5 km', 'Anywhere in Dhaka'];
const DATES = ['Any Friday', 'This weekend', 'Specific date…'];
const TIMES = ['8:00 PM – 11:00 PM', 'Evening (6–9 PM)', 'Morning'];

const WAITING_STEPS = [
  {
    id: 'active',
    state: null,
    title: 'Alert active',
    body: 'We scan new slots and open games in real time.',
  },
  {
    id: 'match',
    state: 'pending',
    title: 'Match found → instant notification',
    body: 'Push + SMS with a one-tap join link. First come, first served.',
  },
  {
    id: 'join',
    state: 'pending',
    title: <>You join &amp; pay your share</>,
    body: 'Same 3-tap join flow. Alert pauses automatically after you book.',
  },
];

export default function LfgAlertPage() {
  const { showToast } = useToast();
  const alertSet = useDisclosure(false);

  const [sport, setSport] = useState('⚽ Football');
  const [skill, setSkill] = useState('Intermediate');
  const [area, setArea] = useState(AREAS[0]);
  const [date, setDate] = useState(DATES[0]);
  const [time, setTime] = useState(TIMES[0]);
  const [alertEnabled, setAlertEnabled] = useState(true);

  return (
    <>
      <PageTitle title="LFG alerts" />

      <main className="wrap" id="main" style={{ paddingTop: 24, maxWidth: 860 }}>
        <h1 style={{ fontSize: 24, marginBottom: 2 }}>LFG availability alerts</h1>
        <p className="subtle" style={{ marginBottom: 20 }}>
          Looking for game? Tell us when and where — we&apos;ll ping you the moment a matching slot or open game
          appears.
        </p>

        <div className="grid2" style={{ alignItems: 'start' }}>
          {/* Create alert */}
          <div className="card">
            <h3>New alert</h3>
            <div className="field" style={{ marginTop: 8 }}>
              <label>Sport</label>
              <div className="row-wrap">
                {SPORTS.map((option) => (
                  <button
                    key={option}
                    className={sport === option ? 'chip on' : 'chip'}
                    type="button"
                    onClick={() => setSport(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="area">Area</label>
              <select
                className="select"
                id="area"
                value={area}
                onChange={(event) => setArea(event.target.value)}
              >
                {AREAS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="grid2" style={{ gap: 10 }}>
              <div className="field">
                <label htmlFor="d1">Date</label>
                <select
                  className="select"
                  id="d1"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                >
                  {DATES.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="t1">Time range</label>
                <select
                  className="select"
                  id="t1"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                >
                  {TIMES.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Skill level</label>
              <div className="row-wrap">
                {SKILLS.map((option) => (
                  <button
                    key={option}
                    className={skill === option ? 'chip on' : 'chip'}
                    type="button"
                    onClick={() => setSkill(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-block" type="button" onClick={alertSet.open}>
              🔔 Set availability alert
            </button>
          </div>

          {/* Active alerts */}
          <div className="stack">
            <div className="card">
              <div className="between">
                <h3 style={{ margin: 0 }}>Active alerts</h3>
                <span className="countpill">1</span>
              </div>
              <div className="panel" style={{ marginTop: 10 }}>
                <div className="between">
                  <div>
                    <b className="small">⚽ Football · Dhanmondi + 3 km</b>
                    <div className="tiny subtle">Fridays 8–11 PM · Intermediate · created 2 Aug</div>
                    <div className="row-wrap" style={{ marginTop: 6 }}>
                      <span className="badge green">Watching</span>
                      <span className="tiny subtle">Checked 4 min ago</span>
                    </div>
                  </div>
                  <div className="stack-sm">
                    <Switch
                      label="Alert enabled"
                      checked={alertEnabled}
                      onChange={(event) => setAlertEnabled(event.target.checked)}
                    />
                    <button
                      className="btn btn-sm btn-ghost-danger"
                      type="button"
                      onClick={() => showToast('Alert deleted — undo? (30s)')}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass glass-card">
              <h4>Waiting state · what happens next</h4>
              <ul className="tline" style={{ marginTop: 10 }}>
                {WAITING_STEPS.map((step) => (
                  <li key={step.id} className={step.state ?? undefined}>
                    <b className="small">{step.title}</b>
                    <p className="tiny muted" style={{ margin: 0 }}>
                      {step.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel">
              <b className="small">🎯 Last match found</b>
              <p className="tiny muted" style={{ margin: '2px 0 0' }}>
                Fri 1 Aug · &quot;5-a-side at Lalmatia Play Zone&quot; — you joined within 4 minutes.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Overlay
        isOpen={alertSet.isOpen}
        onClose={alertSet.close}
        title="Alert is live"
        hideHeader
        className="center"
      >
        <div className="check-anim" style={{ background: 'var(--info)' }} aria-hidden="true">
          🔔
        </div>
        <h3>Alert is live</h3>
        <p className="muted small">
          TurfChai is now watching for{' '}
          <b>
            {sport} · Dhanmondi · Fri 8–11 PM · {skill}
          </b>
          . We&apos;ll notify you the moment a matching slot or game opens.
        </p>
        <span className="badge green" style={{ margin: '8px 0 14px' }}>
          Watching · session ends in waiting state
        </span>
        <div className="stack-sm">
          <Link className="btn btn-primary btn-block" to={paths.solo.openGames}>
            Back to open games
          </Link>
          <button className="btn btn-tertiary btn-block" type="button" onClick={alertSet.close}>
            Stay here
          </button>
        </div>
      </Overlay>
    </>
  );
}
