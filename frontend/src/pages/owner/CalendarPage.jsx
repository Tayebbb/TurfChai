import { Fragment, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { Field, Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';

const LEGEND = [
  { id: 'online', label: 'Online', swatch: 'var(--brand)' },
  { id: 'phone', label: 'Phone', swatch: 'var(--warn)' },
  { id: 'walkin', label: 'Walk-in', swatch: 'var(--info)' },
  { id: 'tournament', label: 'Tournament', swatch: '#8B5CF6' },
  { id: 'blocked', label: 'Blocked', swatch: 'var(--text-3)' },
  {
    id: 'held',
    label: 'Held',
    swatch: 'repeating-linear-gradient(45deg,var(--warn),var(--warn) 3px,transparent 3px,transparent 6px)',
  },
];

const SMALL_BADGE = { fontSize: 10, padding: '2px 6px' };

const INITIAL_ROWS = [
  {
    time: '4:00 PM',
    cells: [
      { kind: 'event', variant: 'online', label: 'Tanvir A. · paid ✓', openable: true },
      { kind: 'event', variant: 'walkin', label: 'Walk-in · cash ৳2,200', openable: true },
      { kind: 'add' },
    ],
  },
  {
    time: '5:45 PM',
    cells: [
      { kind: 'event', variant: 'phone', label: 'Dhanmondi Boys · deposit', openable: true },
      { kind: 'event', variant: 'online', label: 'Sabbir M. · paid ✓', openable: true },
      { kind: 'event', variant: 'blocked', label: 'Maintenance' },
    ],
  },
  {
    time: '7:30 PM',
    cells: [
      { kind: 'event', variant: 'phone', label: 'Karim Traders XI · ৳1,785 due', openable: true },
      { kind: 'event', variant: 'online', label: 'Rafiul K. · TC-48291 ✓', openable: true },
      { kind: 'event', variant: 'held', label: 'Held · checkout 3:12' },
    ],
  },
  {
    time: '9:00 PM',
    cells: [
      { kind: 'event', variant: 'tournament', label: 'Ramadan Cup · semifinal', openable: true },
      { kind: 'event', variant: 'online', label: 'Open game · Rifat H. 10/10', openable: true },
      { kind: 'add' },
    ],
  },
  {
    time: '10:30 PM',
    cells: [{ kind: 'add' }, { kind: 'add' }, { kind: 'add' }],
  },
];

const BLANK_FORM = {
  pitch: 'Pitch 3 · Futsal (60m slot)',
  slot: 'Tonight 9:00–10:00 PM (60 min)',
  name: 'Hasan Uddin',
  phone: '+880 1912 556 677',
  source: 'Phone',
  payment: 'Deposit ৳510 · rest at venue',
  note: '',
};

export default function CalendarPage() {
  const { showToast } = useToast();
  const manual = useDisclosure(false);
  const detail = useDisclosure(false);

  const [rows, setRows] = useState(INITIAL_ROWS);
  const [form, setForm] = useState(BLANK_FORM);
  /** Which empty cell the drawer will fill, as `[rowIndex, cellIndex]`. */
  const [targetCell, setTargetCell] = useState(null);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openForCell(rowIndex, cellIndex) {
    setTargetCell([rowIndex, cellIndex]);
    manual.open();
  }

  function confirmManualBooking() {
    const name = form.name.trim() || 'Manual Booking';
    const variant = form.source === 'Walk-in' ? 'walkin' : 'phone';

    if (targetCell) {
      const [rowIndex, cellIndex] = targetCell;
      setRows((current) =>
        current.map((row, r) =>
          r !== rowIndex
            ? row
            : {
                ...row,
                cells: row.cells.map((cell, c) =>
                  c !== cellIndex
                    ? cell
                    : {
                        kind: 'event',
                        variant,
                        label: `${name} · ${form.source.toLowerCase()}`,
                        openable: true,
                      },
                ),
              },
        ),
      );
    }

    showToast(`Manual booking confirmed for ${name} (${form.pitch}) ✓`);
    manual.close();
  }

  return (
    <>
      <PageTitle title="Calendar" />

      <div className="main-header">
        <div>
          <h1>Calendar</h1>
          <span className="subtle small">Every booking — online, phone &amp; walk-in — in one place</span>
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="View">
            <button type="button" className="on">
              Day
            </button>
            <button type="button" onClick={() => showToast('Week view (concept)')}>
              Week
            </button>
          </div>
          <Button onClick={() => showToast('Slot blocked for maintenance ⛔')}>⛔ Block slot</Button>
          <Button
            variant="primary"
            onClick={() => {
              setTargetCell(null);
              manual.open();
            }}
          >
            + Manual booking
          </Button>
        </div>
      </div>

      <div className="between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="row">
          <IconButton label="Previous day" onClick={() => showToast('Thu 7 Aug')}>
            ‹
          </IconButton>
          <b>Friday 8 Aug 2026 · Today</b>
          <IconButton label="Next day" onClick={() => showToast('Sat 9 Aug')}>
            ›
          </IconButton>
        </div>
        <div className="legend">
          {LEGEND.map((item) => (
            <span key={item.id}>
              <i className="sw" style={{ background: item.swatch }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="cal card" style={{ padding: 0, overflowX: 'auto' }}>
        <div className="cal-grid" style={{ minWidth: 720 }}>
          <div className="cal-head">Time</div>
          <div className="cal-head">
            Pitch 1 · 7-a-side
            <br />
            <Badge tone="blue" dot={false} style={SMALL_BADGE}>
              ⚽ Football
            </Badge>{' '}
            <Badge tone="amber" dot={false} style={SMALL_BADGE}>
              🏏 Cricket
            </Badge>
          </div>
          <div className="cal-head">
            Pitch 2 · 7-a-side
            <br />
            <Badge tone="blue" dot={false} style={SMALL_BADGE}>
              ⚽ Football
            </Badge>
          </div>
          <div className="cal-head">
            Pitch 3 · Futsal
            <br />
            <Badge tone="green" dot={false} style={SMALL_BADGE}>
              🥅 Futsal
            </Badge>{' '}
            <Badge
              dot={false}
              style={{ background: 'var(--info-soft)', color: 'var(--info)', ...SMALL_BADGE }}
            >
              🏸 Badminton
            </Badge>
          </div>

          {rows.map((row, rowIndex) => (
            <Fragment key={row.time}>
              <div className="cal-time num">{row.time}</div>
              {row.cells.map((cell, cellIndex) => (
                <div className="cal-cell" key={`${row.time}-${cellIndex}`}>
                  {cell.kind === 'add' ? (
                    <button type="button" className="addcell" onClick={() => openForCell(rowIndex, cellIndex)}>
                      +
                    </button>
                  ) : (
                    <div
                      className={`cal-ev ${cell.variant}`}
                      role={cell.openable ? 'button' : undefined}
                      tabIndex={cell.openable ? 0 : undefined}
                      onClick={cell.openable ? detail.open : undefined}
                      onKeyDown={
                        cell.openable
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                detail.open();
                              }
                            }
                          : undefined
                      }
                    >
                      {cell.label}
                    </div>
                  )}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>