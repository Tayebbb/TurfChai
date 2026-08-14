import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Overlay } from '@/components/modals/Overlay';
import { Switch } from '@/components/forms/Toggles';
import { getUser } from '@/api/client';
import {
  createLfgAlert,
  deleteLfgAlert,
  getLfgAlertMatches,
  listLfgAlerts,
  updateLfgAlertStatus,
} from '@/api/lfgAlerts';
import { formatGameDay, formatTime, formatTimeRange, skillLabel } from '@/api/openGames';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { formatBdt } from '@/utils/format';

const SPORTS = [
  { value: 'Football', label: '⚽ Football' },
  { value: 'Cricket', label: '🏏 Cricket' },
  { value: 'Badminton', label: '🏸 Badminton' },
];

const SKILLS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
  { value: 'ALL_LEVELS', label: 'Any level' },
];

const AREAS = ['Dhanmondi', 'Mohammadpur', 'Mirpur', 'Banani', 'Uttara', 'Baridhara'];

const DAY_OPTIONS = [
  { value: 'Any day', label: 'Any day' },
  { value: 'Fri', label: 'Fridays' },
  { value: 'Sat,Sun', label: 'Weekends' },
  { value: 'Mon,Tue,Wed,Thu', label: 'Weekdays' },
];

/** `preferredFrom|preferredTo`, the two LocalTime fields the alert stores. */
const TIME_WINDOWS = [
  { value: '20:00:00|23:00:00', label: '8:00 PM – 11:00 PM' },
  { value: '18:00:00|21:00:00', label: 'Evening (6–9 PM)' },
  { value: '06:00:00|10:00:00', label: 'Morning (6–10 AM)' },
];

const STATUS_BADGE = {
  ACTIVE: { className: 'badge green', label: 'Watching' },
  PAUSED: { className: 'badge amber', label: 'Paused' },
  EXPIRED: { className: 'badge gray', label: 'Expired' },
};

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

/** ISO timestamp → `"2 Aug"`, for the created / last-matched lines. */
function formatStamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** One saved alert: pause/resume switch, delete, and the games it matches now. */
function AlertRow({ alert, onChanged }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const matches = useApi(() => getLfgAlertMatches(alert.id), [alert.id]);

  const badge = STATUS_BADGE[alert.status] ?? STATUS_BADGE.ACTIVE;
  const timeWindow = formatTimeRange(alert.preferredFrom, alert.preferredTo);
  const created = formatStamp(alert.createdAt);
  const matched = formatStamp(alert.lastMatchedAt);
  const matchList = Array.isArray(matches.data) ? matches.data : [];

  const setEnabled = async (enabled) => {
    setBusy(true);
    try {
      await updateLfgAlertStatus(alert.id, enabled ? 'ACTIVE' : 'PAUSED');
      showToast(enabled ? 'Alert resumed — watching again' : 'Alert paused');
      onChanged();
    } catch (error) {
      showToast(error.message || 'Could not update this alert');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteLfgAlert(alert.id);
      showToast('Alert deleted');
      onChanged();
    } catch (error) {
      showToast(error.message || 'Could not delete this alert');
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ marginTop: 10 }}>
      <div className="between">
        <div>
          <b className="small">
            {alert.sportName ? `${alert.sportName} · ` : ''}
            {alert.area}
          </b>
          <div className="tiny subtle">
            {[alert.preferredDays, timeWindow, skillLabel(alert.skillLevel)].filter(Boolean).join(' · ')}
            {created ? ` · created ${created}` : ''}
          </div>
          <div className="row-wrap" style={{ marginTop: 6 }}>
            <span className={badge.className}>{badge.label}</span>
            <span className="tiny subtle">{matched ? `Last match ${matched}` : 'No match yet'}</span>
          </div>
        </div>
        <div className="stack-sm">
          <Switch
            label="Alert enabled"
            checked={alert.status === 'ACTIVE'}
            disabled={busy}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <button className="btn btn-sm btn-ghost-danger" type="button" disabled={busy} onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        {matches.loading ? (
          <p className="tiny subtle" role="status" style={{ margin: 0 }}>
            Checking for matches…
          </p>
        ) : matches.error ? (
          <p className="tiny subtle" style={{ margin: 0 }}>
            Could not check matches — {matches.error.message}{' '}
            <button className="btn btn-sm btn-tertiary" type="button" onClick={matches.reload}>
              Retry
            </button>
          </p>
        ) : matchList.length === 0 ? (
          <p className="tiny subtle" style={{ margin: 0 }}>
            No open games match this alert right now.
          </p>
        ) : (
          <ul className="tiny muted" style={{ margin: 0, paddingLeft: 16, lineHeight: 1.9 }}>
            {matchList.slice(0, 3).map((game) => (
              <li key={game.id}>
                <Link to={paths.solo.game(game.id)}>{game.title}</Link> · {game.venueName} ·{' '}
                {formatGameDay(game.gameDate)} {formatTimeRange(game.startTime, game.endTime)} ·{' '}
                {formatBdt(game.pricePerPlayer)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function LfgAlertPage() {
  const { showToast } = useToast();
  const alertSet = useDisclosure(false);
  const currentUser = getUser();
  const userId = currentUser?.id ?? null;

  const [sport, setSport] = useState(SPORTS[0].value);
  const [skill, setSkill] = useState('INTERMEDIATE');
  const [area, setArea] = useState(AREAS[0]);
  const [days, setDays] = useState(DAY_OPTIONS[0].value);
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOWS[0].value);
  const [saving, setSaving] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);

  const { data, loading, error, reload } = useApi(
    () => (userId ? listLfgAlerts() : Promise.resolve([])),
    [userId],
  );
  const alerts = Array.isArray(data) ? data : [];

  const [defaultFrom, defaultTo] = timeWindow.split('|');

  const onCreate = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const created = await createLfgAlert({
        sportName: sport,
        area,
        preferredDays: days,
        preferredFrom: defaultFrom,
        preferredTo: defaultTo,
        skillLevel: skill,
      });
      setLastCreated(created);
      reload();
      alertSet.open();
    } catch (createError) {
      showToast(createError.message || 'Could not create this alert');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTitle title="LFG alerts" />

      <main className="wrap" id="main" style={{ paddingTop: 24, maxWidth: 860 }}>
        <h1 style={{ fontSize: 24, marginBottom: 2 }}>LFG availability alerts</h1>
        <p className="subtle" style={{ marginBottom: 20 }}>
          Looking for game? Tell us when and where — we&apos;ll ping you the moment a matching slot or open game
          appears.
        </p>

        {!currentUser ? (
          <div className="card center" style={{ padding: 24 }}>
            <h3>Sign in to set an alert</h3>
            <p className="subtle small" style={{ margin: '6px 0 14px' }}>
              Alerts are tied to your account so we know where to send the notification.
            </p>
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button variant="primary" to={`${paths.auth}?next=${paths.solo.alerts}`}>
                Sign in
              </Button>
              <Button variant="secondary" to={paths.solo.openGames}>
                Browse open games
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid2" style={{ alignItems: 'start' }}>
            {/* Create alert */}
            <div className="card">
              <h3>New alert</h3>
              <div className="field" style={{ marginTop: 8 }}>
                <label>Sport</label>
                <div className="row-wrap">
                  {SPORTS.map((option) => (
                    <button
                      key={option.value}
                      className={sport === option.value ? 'chip on' : 'chip'}
                      type="button"
                      onClick={() => setSport(option.value)}
                    >
                      {option.label}
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
                  <label htmlFor="d1">Days</label>
                  <select
                    className="select"
                    id="d1"
                    value={days}
                    onChange={(event) => setDays(event.target.value)}
                  >
                    {DAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="t1">Time range</label>
                  <select
                    className="select"
                    id="t1"
                    value={timeWindow}
                    onChange={(event) => setTimeWindow(event.target.value)}
                  >
                    {TIME_WINDOWS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Skill level</label>
                <div className="row-wrap">
                  {SKILLS.map((option) => (
                    <button
                      key={option.value}
                      className={skill === option.value ? 'chip on' : 'chip'}
                      type="button"
                      onClick={() => setSkill(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary btn-block" type="button" disabled={saving} onClick={onCreate}>
                {saving ? 'Setting alert…' : '🔔 Set availability alert'}
              </button>
            </div>

            {/* Active alerts */}
            <div className="stack">
              <div className="card">
                <div className="between">
                  <h3 style={{ margin: 0 }}>Your alerts</h3>
                  <span className="countpill">{loading ? '…' : alerts.length}</span>
                </div>

                {loading ? (
                  <p className="subtle small" role="status" style={{ margin: '12px 0 0' }}>
                    Loading your alerts…
                  </p>
                ) : error ? (
                  <div style={{ marginTop: 12 }}>
                    <p className="subtle small" style={{ margin: '0 0 8px' }}>
                      {error.message}
                    </p>
                    <Button variant="secondary" size="sm" onClick={reload}>
                      Try again
                    </Button>
                  </div>
                ) : alerts.length === 0 ? (
                  <p className="subtle small" style={{ margin: '12px 0 0' }}>
                    No alerts yet — set one on the left and we&apos;ll start watching.
                  </p>
                ) : (
                  alerts.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} onChanged={reload} />
                  ))
                )}
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
            </div>
          </div>
        )}
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
            {[
              lastCreated?.sportName ?? sport,
              lastCreated?.area ?? area,
              lastCreated?.preferredDays ?? days,
              formatTimeRange(
                lastCreated?.preferredFrom ?? defaultFrom,
                lastCreated?.preferredTo ?? defaultTo,
              ),
              skillLabel(lastCreated?.skillLevel ?? skill),
            ]
              .filter(Boolean)
              .join(' · ')}
          </b>
          . We&apos;ll notify you the moment a matching slot or game opens.
        </p>
        <span className="badge green" style={{ margin: '8px 0 14px' }}>
          Watching from {formatTime(lastCreated?.preferredFrom ?? defaultFrom)}
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
