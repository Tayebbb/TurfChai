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

      <Alert tone="info" icon="🔒" title="Conflict-proof" style={{ marginTop: 14 }}>
        Online slots lock during checkout (striped = held), and manual entries instantly block online booking for
        that slot — double-booking is impossible.
      </Alert>

      {/* Manual booking drawer */}
      <Overlay isOpen={manual.isOpen} onClose={manual.close} title="Manual booking" mode="drawer">
        <p className="subtle small">Phone or walk-in — this slot is removed from online sale immediately.</p>
        <div className="grid2" style={{ gap: 10, marginTop: 8 }}>
          <Field label="Pitch & Sport" htmlFor="mbPitch">
            <Select id="mbPitch" value={form.pitch} onChange={(event) => setField('pitch', event.target.value)}>
              <option>Pitch 1 · Football (90m slot)</option>
              <option>Pitch 1 · Cricket (120m slot)</option>
              <option>Pitch 3 · Futsal (60m slot)</option>
              <option>Pitch 3 · Badminton (40m slot)</option>
            </Select>
          </Field>
          <Field label="Slot Time" htmlFor="mbSlot">
            <Select id="mbSlot" value={form.slot} onChange={(event) => setField('slot', event.target.value)}>
              <option>Tonight 9:00–10:00 PM (60 min)</option>
              <option>Tonight 10:00–11:00 PM (60 min)</option>
            </Select>
          </Field>
        </div>
        <Field label="Customer name" htmlFor="mbName">
          <Input
            id="mbName"
            placeholder="e.g. Salam Bhai"
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
          />
        </Field>
        <Field label="Phone" htmlFor="mbPhone">
          <Input
            className="num"
            id="mbPhone"
            value={form.phone}
            onChange={(event) => setField('phone', event.target.value)}
          />
        </Field>
        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Source" htmlFor="mbSrc">
            <Select id="mbSrc" value={form.source} onChange={(event) => setField('source', event.target.value)}>
              <option>Phone</option>
              <option>Walk-in</option>
            </Select>
          </Field>
          <Field label="Payment status" htmlFor="mbPay">
            <Select id="mbPay" value={form.payment} onChange={(event) => setField('payment', event.target.value)}>
              <option>Paid in full (cash)</option>
              <option>Deposit ৳510 · rest at venue</option>
              <option>Unpaid — collect on arrival</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes (optional)" htmlFor="mbNote">
          <Input
            id="mbNote"
            placeholder="e.g. regular customer, wants bibs"
            value={form.note}
            onChange={(event) => setField('note', event.target.value)}
          />
        </Field>
        <div className="pricerow total">
          <span>Slot price</span>
          <span className="num">৳1,500</span>
        </div>
        <Button variant="primary" size="lg" block style={{ marginTop: 12 }} onClick={confirmManualBooking}>
          Confirm booking
        </Button>
      </Overlay>

      {/* Event detail drawer */}
      <Overlay isOpen={detail.isOpen} onClose={detail.close} title="Booking · 7:30 PM · Pitch 2" mode="drawer">
        <div className="row-wrap" style={{ margin: '6px 0 12px' }}>
          <Badge tone="green">Online · paid in full</Badge>
          <Badge tone="blue" dot={false}>
            Split pay 10/10
          </Badge>
        </div>
        <div className="stack-sm">
          <div className="between small">
            <span className="muted">Reference</span>
            <b className="num">TC-48291</b>
          </div>
          <div className="between small">
            <span className="muted">Customer</span>
            <b>Rafiul Karim · +880 1712 ••• 890</b>
          </div>
          <div className="between small">
            <span className="muted">Amount</span>
            <b className="num">৳2,550 · bKash · TXN 8H2K19</b>
          </div>
          <div className="between small">
            <span className="muted">Shift</span>
            <b>Evening · auto-reconciled ✓</b>
          </div>
          <div className="between small">
            <span className="muted">Handover</span>
            <b className="num">7:20 PM gate check-in</b>
          </div>
        </div>
        <div className="grid2" style={{ gap: 8, marginTop: 14 }}>
          <Button
            onClick={() => {
              detail.close();
              showToast('Checked in ✓');
            }}
          >
            ✅ Check in
          </Button>
          <Button onClick={() => showToast('Calling customer 📞')}>📞 Call</Button>
          <Button onClick={() => showToast('Reschedule offer sent')}>🔁 Reschedule</Button>
          <Button variant="ghostDanger" onClick={() => showToast('Cancellation flow — refund per policy')}>
            Cancel booking
          </Button>
        </div>
      </Overlay>
    </>
  );
}
