import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { BackButton } from '@/components/buttons/BackButton';
import { pitchColumns, pitchSchedule } from '@/data/tournaments';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './MultiPitchPage.css';

const HELD_STRIPES =
  'repeating-linear-gradient(45deg,var(--warn),var(--warn) 3px,transparent 3px,transparent 6px)';

export default function MultiPitchPage() {
  const { showToast } = useToast();

  return (
    <>
      <PageTitle title="Multi-pitch booking" />

      <div className="wrap" style={{ paddingTop: 20, maxWidth: 1100, paddingBottom: 110 }}>
        <BackButton to={paths.player.explore}>Explore venues</BackButton>

        <div className="between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, marginBottom: 2 }}>Mirpur Sports City · Sat 23 Aug</h1>
            <span className="subtle small">Select slots across pitches — or grab the full-day bundle</span>
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() =>
              showToast('Full day selected: all 4 pitches, 8 AM–10 PM — ৳52,000 (bundle saves ৳9,200) ✓')
            }
          >
            ⚡ Select full day · ৳52,000
          </button>
        </div>

        <div className="cal card" style={{ padding: 0, overflowX: 'auto', marginBottom: 14 }}>
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
        </div>

        <div className="alert warn" style={{ marginBottom: 14 }}>
          <span className="ico">⚠️</span>
          <div>
            <b>Conflict detected &amp; resolved</b>Pitch C 10 AM is taken by a league booking and Pitch B 2 PM is
            held by another checkout — both were excluded from your selection automatically.
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
              ৳42,800
            </b>
            <span className="subtle small"> · 14 slots across 3 pitches · 8 AM–6 PM</span>
            <div className="tiny subtle">
              Live total updates as you select · full-day bundle would save ৳9,200
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
