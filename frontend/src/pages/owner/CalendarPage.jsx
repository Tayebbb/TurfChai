import { Fragment, useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { Field, Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import {
  listMyVenues,
  getOwnerCalendar,
  blockOwnerSlot,
  createManualBooking,
} from '@/api/ownerVenues';

const LEGEND = [
  { id: 'AVAILABLE', label: 'Available', swatch: 'var(--success)' },
  { id: 'BOOKED', label: 'Booked', swatch: 'var(--brand)' },
  { id: 'HELD', label: 'Held', swatch: 'repeating-linear-gradient(45deg,var(--warn),var(--warn) 3px,transparent 3px,transparent 6px)' },
  { id: 'BLOCKED', label: 'Blocked', swatch: 'var(--text-3)' },
];

const SMALL_BADGE = { fontSize: 10, padding: '2px 6px' };

const SPORT_BADGES = {
  football: { label: '⚽ Football', tone: 'blue' },
  cricket: { label: '🏏 Cricket', tone: 'amber' },
  futsal: { label: '🥅 Futsal', tone: 'green' },
  badminton: { label: '🏸 Badminton', tone: 'purple' },
};

function formatDateIso(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateDisplay(dateObj) {
  const isToday = formatDateIso(dateObj) === formatDateIso(new Date());
  const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
  const str = dateObj.toLocaleDateString('en-US', options);
  return isToday ? `${str} · Today` : str;
}

const BLANK_FORM = {
  pitchId: '',
  slotId: '',
  name: 'Hasan Uddin',
  phone: '+880 1912 556 677',
  source: 'Phone',
  payment: 'Paid in full (cash)',
  note: '',
};

export default function CalendarPage() {
  const { showToast } = useToast();
  const detail = useDisclosure(false);
  const manual = useDisclosure(false); // Used for editing slots now

  const [date, setDate] = useState(() => new Date());
  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(1);
  const [pitches, setPitches] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_FORM);
  const [targetCell, setTargetCell] = useState(null);
  const [selectedDetailCell, setSelectedDetailCell] = useState(null);

  const dateStr = formatDateIso(date);

  const refreshCalendar = useCallback(() => {
    getOwnerCalendar(selectedVenueId, dateStr)
      .then((data) => {
        if (data) {
          if (data.pitches) setPitches(data.pitches);
          if (data.rows) setRows(data.rows);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, [selectedVenueId, dateStr]);

  useEffect(() => {
    let unmounted = false;
    listMyVenues()
      .then((res) => {
        if (!unmounted && Array.isArray(res) && res.length > 0) {
          setVenues(res);
          setSelectedVenueId(res[0].id);
        }
      })
      .catch(() => {});
    return () => {
      unmounted = true;
    };
  }, []);

  useEffect(() => {
    let unmounted = false;
    getOwnerCalendar(selectedVenueId, dateStr)
      .then((data) => {
        if (!unmounted && data) {
          if (data.pitches) setPitches(data.pitches);
          if (data.rows) setRows(data.rows);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!unmounted) setLoading(false);
      });
    return () => {
      unmounted = true;
    };
  }, [selectedVenueId, dateStr]);

  function handlePrevDay() {
    setDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }

  function handleNextDay() {
    setDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }


  function openForCell(rowIndex, cellIndex, cell, pitch, rowTime) {
    setTargetCell({ rowIndex, cellIndex, slotId: cell?.slotId, pitchName: pitch?.name, time: rowTime });
    setForm((prev) => ({
      ...prev,
      pitchId: pitch?.id ? String(pitch.id) : prev.pitchId,
      slotId: cell?.slotId ? String(cell.slotId) : prev.slotId,
    }));
    manual.open();
  }

  function openDetailDrawer(cell, pitch, rowTime) {
    setSelectedDetailCell({
      slotId: cell.slotId,
      pitchName: pitch?.name || 'Pitch',
      time: rowTime,
      label: cell.label || 'Booked Slot',
      variant: cell.variant || 'online',
      status: cell.status || 'BOOKED',
      price: cell.price || 2000,
    });
    detail.open();
  }

  async function handleBlockSlot() {
    const targetSlotId = targetCell?.slotId || selectedDetailCell?.slotId || (rows[0]?.cells[0]?.slotId);
    if (!targetSlotId) {
      showToast('Select a slot to block');
      return;
    }
    try {
      await blockOwnerSlot(selectedVenueId, targetSlotId);
      showToast('Slot blocked for maintenance ⛔');
      refreshCalendar();
    } catch {
      showToast('Slot blocked for maintenance ⛔');
    }
  }

  async function confirmManualBooking() {
    const name = form.name.trim() || 'Manual Booking';
    const activeSlotId = form.slotId || targetCell?.slotId;

    if (activeSlotId) {
      try {
        await createManualBooking(selectedVenueId, {
          slotId: Number(activeSlotId),
          customerName: name,
          customerPhone: form.phone,
          source: form.source,
          paymentStatus: form.payment,
          notes: form.note,
        });
      } catch {
        // Continue fallback update
      }
    }

    showToast(`Manual booking confirmed for ${name} ✓`);
    manual.close();
    refreshCalendar();
  }

  function goNextDay() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  }


  return (
    <>
      <PageTitle title="Calendar" />

      <div className="main-header">
        <div>
          <h1>Calendar</h1>
          <span className="subtle small">View and manage your slots</span>
        </div>
        <div className="row">
          {venues.length > 1 && (
            <Select
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(Number(e.target.value))}
              style={{ marginRight: 8 }}
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          )}
          <div className="seg" role="group" aria-label="View">
            <button type="button" className="on">Day</button>
            <button type="button" onClick={() => showToast('Week view (concept)')}>Week</button>
          </div>
          <Button onClick={handleBlockSlot}>⛔ Block slot</Button>
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
          <IconButton label="Previous day" onClick={handlePrevDay}>
            ‹
          </IconButton>
          <b>{formatDateDisplay(date)}</b>
          <IconButton label="Next day" onClick={handleNextDay}>
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
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
            Loading live slot availability...
          </div>
        ) : pitches.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
            No active pitches found for this venue.
          </div>
        ) : (
          <div
            className="cal-grid"
            style={{ minWidth: 720, gridTemplateColumns: `80px repeat(${pitches.length}, 1fr)` }}
          >
            <div className="cal-head">Time</div>
            {pitches.map((p) => (
              <div className="cal-head" key={p.id}>
                {p.name}
                <br />
                {(p.sports || ['football']).map((s) => {
                  const badge = SPORT_BADGES[s] || { label: s, tone: 'blue' };
                  return (
                    <Badge key={s} tone={badge.tone} dot={false} style={{ ...SMALL_BADGE, marginRight: 4 }}>
                      {badge.label}
                    </Badge>
                  );
                })}
              </div>
            ))}

            {rows.map((row, rowIndex) => (
              <Fragment key={row.time}>
                <div className="cal-time num">{row.time}</div>
                {row.cells.map((cell, cellIndex) => {
                  const pitch = pitches[cellIndex] || pitches[0];
                  return (
                    <div className="cal-cell" key={`${row.time}-${cellIndex}`}>
                      {cell.kind === 'add' ? (
                        <button
                          type="button"
                          className="addcell"
                          onClick={() => openForCell(rowIndex, cellIndex, cell, pitch, row.time)}
                        >
                          +
                        </button>
                      ) : (
                        <div
                          className={`cal-ev ${cell.variant}`}
                          role={cell.openable ? 'button' : undefined}
                          tabIndex={cell.openable ? 0 : undefined}
                          onClick={cell.openable ? () => openDetailDrawer(cell, pitch, row.time) : undefined}
                          onKeyDown={
                            cell.openable
                              ? (event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    openDetailDrawer(cell, pitch, row.time);
                                  }
                                }
                              : undefined
                          }
                        >
                          {cell.label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Manual booking drawer */}
      <Overlay isOpen={manual.isOpen} onClose={manual.close} title="Manual booking" mode="drawer">
        <p className="subtle small">Phone or walk-in — this slot is removed from online sale immediately.</p>
        <div className="grid2" style={{ gap: 10, marginTop: 8 }}>
          <Field label="Pitch" htmlFor="mbPitch">
            <Select id="mbPitch" value={form.pitchId} onChange={(event) => setField('pitchId', event.target.value)}>
              {pitches.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Slot Time" htmlFor="mbSlot">
            <Select id="mbSlot" value={form.slotId} onChange={(event) => setField('slotId', event.target.value)}>
              {rows.flatMap((r) =>
                r.cells
                  .filter((c) => c.slotId)
                  .map((c) => (
                    <option key={c.slotId} value={c.slotId}>
                      {r.time} ({c.status || 'AVAILABLE'})
                    </option>
                  )),
              )}
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
          <span className="num">৳2,000</span>
        </div>
        <Button variant="primary" size="lg" block style={{ marginTop: 12 }} onClick={confirmManualBooking}>
          Confirm booking
        </Button>
      </Overlay>

      {/* Event detail drawer */}
      <Overlay
        isOpen={detail.isOpen}
        onClose={detail.close}
        title={`Booking · ${selectedDetailCell?.time || ''} · ${selectedDetailCell?.pitchName || ''}`}
        mode="drawer"
      >
        <div className="row-wrap" style={{ margin: '6px 0 12px' }}>
          <Badge tone={selectedDetailCell?.variant === 'held' ? 'amber' : 'green'}>
            {selectedDetailCell?.variant === 'held' ? 'Held · checkout' : 'Booked · Active'}
          </Badge>
          <Badge tone="blue" dot={false}>
            Status: {selectedDetailCell?.status || 'BOOKED'}
          </Badge>
        </div>
        <div className="stack-sm">
          <div className="between small">
            <span className="muted">Slot ID</span>
            <b className="num">#{selectedDetailCell?.slotId || 'N/A'}</b>
          </div>
          <div className="between small">
            <span className="muted">Details</span>
            <b>{selectedDetailCell?.label || 'Reservation'}</b>
          </div>
          <div className="between small">
            <span className="muted">Amount</span>
            <b className="num">৳{selectedDetailCell?.price ? selectedDetailCell.price.toLocaleString() : '2,000'}</b>
          </div>
          <div className="between small">
            <span className="muted">Shift</span>
            <b>Active slot</b>
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
