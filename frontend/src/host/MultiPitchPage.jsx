import { Fragment } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { BackButton } from '@/components/buttons/BackButton';
import { pitchColumns, pitchSchedule } from '@/data/tournaments';
import { useApi } from '@/hooks/useApi';
import {
  DEMO_TOURNAMENT_CODE,
  getTournament,
  reserveSlots,
  bdt,
  formatTime,
  formatDate,
} from '@/api/tournaments';
import { getVenue } from '@/api/venues';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './MultiPitchPage.css';

const HELD_STRIPES =
  'repeating-linear-gradient(45deg,var(--warn),var(--warn) 3px,transparent 3px,transparent 6px)';

/** 2-hour grid windows derived from the tournament day window. */
function buildWindows(startTime, endTime) {
  const startHour = Number(startTime.split(':')[0]);
  const endHour = Number(endTime.split(':')[0]);
  const windows = [];
  for (let hour = startHour; hour + 2 <= endHour; hour += 2) {
    windows.push({
      start: `${String(hour).padStart(2, '0')}:00`,
      end: `${String(hour + 2).padStart(2, '0')}:00`,
    });
  }
  return windows;
}

const formatLabel = (format) => (format ? format.replaceAll('_', '-') : '');

export default function MultiPitchPage() {
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const code = params.get('code') ?? DEMO_TOURNAMENT_CODE;
  const tournament = useApi(() => getTournament(code), [code]);
  const live = tournament.data;
  const venueSlug = live?.venueSlug;
  const venue = useApi(
    () => (venueSlug ? getVenue(venueSlug) : Promise.resolve(null)),
    [venueSlug],
  );

  const ready = Boolean(live && venue.data);
  const pitches = ready ? venue.data.pitches : [];
  const windows = ready ? buildWindows(live.windowStart, live.windowEnd) : [];

  const reservedAt = (pitchId, start) =>
    live?.reservations.find(
      (r) => r.pitchId === pitchId && r.startTime.startsWith(start),
    );

  const addSlot = async (pitch, window) => {
    try {
      await reserveSlots(DEMO_TOURNAMENT_CODE, [
        { pitchId: pitch.id, startTime: window.start, endTime: window.end },
      ]);
      showToast(`Added ${pitch.name} ${formatTime(window.start)} — conflict check passed ✓`);
      tournament.reload();
    } catch (error) {
      showToast(
        error.status === 409
          ? `⚠️ ${error.message}`
          : 'Could not reserve that slot — please try again',
      );
    }
  };

  const addFullDay = async () => {
    const free = [];
    pitches.forEach((pitch) => {
      windows.forEach((window) => {
        if (!reservedAt(pitch.id, window.start)) {
          free.push({ pitchId: pitch.id, startTime: window.start, endTime: window.end });
        }
      });
    });
    if (free.length === 0) {
      showToast('Every slot in the window is already reserved ✓');
      return;
    }
    try {
      await reserveSlots(DEMO_TOURNAMENT_CODE, free);
      showToast(`⚡ Full day reserved — ${free.length} extra slots added ✓`);
      tournament.reload();
    } catch (error) {
      showToast(
        error.status === 409
          ? `⚠️ ${error.message} — a slot clashed with another booking, so nothing was added`
          : 'Could not reserve the full day — please try again',
      );
    }
  };

  const costs = live?.costs;

  return (
    <>
      <PageTitle title="Multi-pitch booking" />

      <div className="wrap" style={{ paddingTop: 20, maxWidth: 1100, paddingBottom: 110 }}>
        <BackButton to={paths.player.explore}>Explore venues</BackButton>

        {tournament.error ? (
          <div className="alert warn" style={{ marginBottom: 12 }}>
            <span className="ico">⚠️</span>
            <div className="tiny">
              Couldn’t load the live schedule — showing sample content.{' '}
              <button className="btn btn-sm btn-tertiary" type="button" onClick={tournament.reload}>
                Retry
              </button>
            </div>
          </div>
        ) : null}

        <div className="between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, marginBottom: 2 }}>
              {live ? `${live.venueName} · ${formatDate(live.date)}` : 'Mirpur Sports City · Sat 23 Aug'}
            </h1>
            <span className="subtle small">Select slots across pitches — or grab the full-day bundle</span>
          </div>
          <button className="btn btn-secondary" type="button" onClick={addFullDay} disabled={!ready}>
            ⚡ Select full day
          </button>
        </div>

        <div className="cal card" style={{ padding: 0, overflowX: 'auto', marginBottom: 14 }}>
          {ready ? (
            <div className="cal-grid p4" style={{ minWidth: 860 }}>
              <div className="cal-head" />
              {pitches.map((pitch) => (
                <div className="cal-head" key={pitch.id}>
                  {pitch.name} · {formatLabel(pitch.format)}
                </div>
              ))}

              {windows.map((window) => (
                <Fragment key={window.start}>
                  <div className="cal-time num">{formatTime(window.start)}</div>
                  {pitches.map((pitch) => {
                    const reservation = reservedAt(pitch.id, window.start);
                    return (
                      <div className="cal-cell" key={`${pitch.id}-${window.start}`}>
                        {reservation ? (
                          <button
                            className="selcell"
                            type="button"
                            onClick={() =>
                              showToast(
                                `${pitch.name} ${formatTime(window.start)} is reserved for this tournament · ${bdt(reservation.price)}`,
                              )
                            }
                          >
                            Selected ✓
                          </button>
                        ) : (
                          <button className="addcell" type="button" onClick={() => addSlot(pitch, window)}>
                            + Add slot
                          </button>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          ) : (
            <div className="cal-grid p4" style={{ minWidth: 860 }}>
              <div className="cal-head" />
              {pitchColumns.map((column) => (
                <div className="cal-head" key={column}>
                  {column}
                </div>
              ))}
              {pitchSchedule.map((row) => (
                <Fragment key={row.time}>
                  <div className="cal-time num">{row.time}</div>
                  {row.cells.map((cell) => (
                    <div className="cal-cell" key={cell.id}>
                      {cell.kind === 'ev' ? (
                        <div className={`cal-ev ${cell.tone}`}>{cell.label}</div>
                      ) : (
                        <button
                          className={cell.kind === 'sel' ? 'selcell' : 'addcell'}
                          type="button"
                          onClick={() => showToast(cell.toast)}
                        >
                          {cell.label}
                        </button>
                      )}
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="alert info" style={{ marginBottom: 14 }}>
          <span className="ico">🛡️</span>
          <div>
            <b>Conflict protection</b>Every slot you add is checked against existing reservations —
            clashing selections are rejected before anything is booked.
          </div>
        </div>

        <div className="legend">
          <span>
            <i style={{ background: 'var(--brand)' }} />
            Your selection
          </span>
          <span>
            <i style={{ background: 'var(--info)' }} />
            Existing booking
          </span>
          <span>
            <i style={{ background: HELD_STRIPES }} />
            Held by others
          </span>
        </div>
      </div>

      <div className="stickybar glass">
        <div className="stickybar-inner">
          <div>
            <b className="num" style={{ fontSize: 18 }}>
              {costs ? bdt(costs.total) : '৳42,800'}
            </b>
            <span className="subtle small">
              {costs
                ? ` · ${costs.slotCount} slots reserved`
                : ' · 14 slots across 3 pitches · 8 AM–6 PM'}
            </span>
            <div className="tiny subtle">
              {costs && Number(costs.discount) > 0
                ? `Multi-pitch bundle discount applied: −${bdt(costs.discount)}`
                : 'Live total updates as you select · bundle discount unlocks at 12 slots'}
            </div>
          </div>
          <Link className="btn btn-primary btn-lg" to={paths.host.reserve}>
            Continue to reserve →
          </Link>
        </div>
      </div>
    </>
  );
}
