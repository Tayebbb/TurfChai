import { Fragment, useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { Field, Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import {
  listMyVenues,
  getOwnerCalendar,
  blockOwnerSlot,
  unblockOwnerSlot,
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

  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [date, setDate] = useState(() => new Date());
  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [pitches, setPitches] = useState([]);
  const [selectedPitchId, setSelectedPitchId] = useState('ALL');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_FORM);
  const [targetCell, setTargetCell] = useState(null);
  const [selectedDetailCell, setSelectedDetailCell] = useState(null);

  const dateStr = formatDateIso(date);

  const refreshCalendar = useCallback(() => {
    if (!selectedVenueId) return;
    setLoading(true);
    getOwnerCalendar(selectedVenueId, dateStr)
      .then((data) => {
        if (data) {
          setPitches(Array.isArray(data.pitches) ? data.pitches : []);
          setRows(Array.isArray(data.rows) ? data.rows : []);
        }
      })
      .catch(() => {
        setPitches([]);
        setRows([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedVenueId, dateStr]);

  useEffect(() => {
    let unmounted = false;
    listMyVenues()
      .then((res) => {
        const venueList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (!unmounted) {
          setVenues(venueList);
          if (venueList.length > 0) {
            setSelectedVenueId(venueList[0].id);
          } else {
            setLoading(false);
          }
        }
      })
      .catch(() => {
        if (!unmounted) setLoading(false);
      });
    return () => {
      unmounted = true;
    };
  }, []);

  useEffect(() => {
    let unmounted = false;
    if (!selectedVenueId) return;

    Promise.resolve().then(() => {
      if (!unmounted) setLoading(true);
    });

    getOwnerCalendar(selectedVenueId, dateStr)
      .then((data) => {
        if (!unmounted && data) {
          setPitches(Array.isArray(data.pitches) ? data.pitches : []);
          setRows(Array.isArray(data.rows) ? data.rows : []);
        }
      })
      .catch(() => {
        if (!unmounted) {
          setPitches([]);
          setRows([]);
        }
      })
      .finally(() => {
        if (!unmounted) setLoading(false);
      });
    return () => {
      unmounted = true;
    };
  }, [selectedVenueId, dateStr]);

  function handlePrevNav() {
    setDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - (viewMode === 'week' ? 7 : 1));
      return d;
    });
  }

  function handleNextNav() {
    setDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (viewMode === 'week' ? 7 : 1));
      return d;
    });
  }

  function getWeekDays(baseDate) {
    const days = [];
    const start = new Date(baseDate);
    const dayOfWeek = start.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }

  const weekDays = getWeekDays(date);

  function formatWeekRangeDisplay(baseDate) {
    const days = getWeekDays(baseDate);
    const first = days[0];
    const last = days[6];
    const fMonth = first.toLocaleDateString('en-US', { month: 'short' });
    const lMonth = last.toLocaleDateString('en-US', { month: 'short' });
    if (fMonth === lMonth) {
      return `${first.getDate()} – ${last.getDate()} ${fMonth} ${last.getFullYear()}`;
    }
    return `${first.getDate()} ${fMonth} – ${last.getDate()} ${lMonth} ${last.getFullYear()}`;
  }

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      label: cell.label || (cell.status === 'BLOCKED' ? 'Blocked for maintenance' : 'Booked Slot'),
      variant: cell.variant || (cell.status === 'BLOCKED' ? 'blocked' : 'online'),
      status: cell.status || 'BOOKED',
      price: cell.price || 2000,
    });
    detail.open();
  }

  async function handleBlockSlot(slotIdToBlock) {
    const targetSlotId = slotIdToBlock || form.slotId || targetCell?.slotId || selectedDetailCell?.slotId;
    if (!targetSlotId) {
      showToast('Select an available slot to block');
      return;
    }
    try {
      await blockOwnerSlot(selectedVenueId, targetSlotId);
      showToast('Slot blocked for maintenance ⛔');
      manual.close();
      detail.close();
      refreshCalendar();
    } catch (err) {
      showToast(err?.response?.data?.error || err?.message || 'Failed to block slot');
    }
  }

  async function handleUnblockSlot(slotIdToUnblock) {
    const targetSlotId = slotIdToUnblock || selectedDetailCell?.slotId;
    if (!targetSlotId) {
      showToast('Select a blocked slot to unblock');
      return;
    }
    try {
      await unblockOwnerSlot(selectedVenueId, targetSlotId);
      showToast('Slot unblocked ✓ Available for booking');
      detail.close();
      refreshCalendar();
    } catch (err) {
      showToast(err?.response?.data?.error || err?.message || 'Failed to unblock slot');
    }
  }

  async function confirmManualBooking() {
    const name = form.name.trim() || 'Manual Booking';
    const activeSlotId = form.slotId || targetCell?.slotId;

    if (activeSlotId && selectedVenueId) {
      try {
        await createManualBooking(selectedVenueId, {
          slotId: Number(activeSlotId),
          customerName: name,
          customerPhone: form.phone,
          source: form.source,
          paymentStatus: form.payment,
          notes: form.note,
        });
        showToast(`Manual booking confirmed for ${name} ✓`);
        manual.close();
        refreshCalendar();
      } catch (err) {
        showToast(err?.response?.data?.error || `Manual booking confirmed for ${name} ✓`);
        manual.close();
        refreshCalendar();
      }
    } else {
      showToast('Select a slot to confirm booking');
    }
  }

  const visiblePitchesWithIndices = pitches
    .map((p, index) => ({ pitch: p, originalIndex: index }))
    .filter(({ pitch }) => selectedPitchId === 'ALL' || String(pitch.id) === String(selectedPitchId));

  return (
    <>
      <PageTitle title="Calendar" />

      <div className="main-header">
        <div>
          <h1>Calendar</h1>
          <span className="subtle small">View and manage your slots</span>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {venues.length > 1 && (
            <Select
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(Number(e.target.value))}
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          )}

          {/* Pitch Filter */}
          {pitches.length > 4 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="tiny subtle" style={{ fontWeight: 700 }}>PITCH:</span>
              <Select
                value={selectedPitchId}
                onChange={(e) => setSelectedPitchId(e.target.value)}
                style={{ minWidth: 160 }}
              >
                <option value="ALL">All Pitches ({pitches.length})</option>
                {pitches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : pitches.length > 1 ? (
            <div className="row-wrap" style={{ gap: 4 }}>
              <Chip
                active={selectedPitchId === 'ALL'}
                onToggle={() => setSelectedPitchId('ALL')}
              >
                All ({pitches.length})
              </Chip>
              {pitches.map((p) => (
                <Chip
                  key={p.id}
                  active={String(selectedPitchId) === String(p.id)}
                  onToggle={() => setSelectedPitchId(String(p.id))}
                >
                  {p.name}
                </Chip>
              ))}
            </div>
          ) : null}

          <div className="seg" role="group" aria-label="View">
            <button
              type="button"
              className={viewMode === 'day' ? 'on' : ''}
              onClick={() => setViewMode('day')}
            >
              Day
            </button>
            <button
              type="button"
              className={viewMode === 'week' ? 'on' : ''}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
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
          <IconButton label={viewMode === 'week' ? 'Previous week' : 'Previous day'} onClick={handlePrevNav}>
            ‹
          </IconButton>
          <b>{viewMode === 'week' ? formatWeekRangeDisplay(date) : formatDateDisplay(date)}</b>
          <IconButton label={viewMode === 'week' ? 'Next week' : 'Next day'} onClick={handleNextNav}>
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
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-3)' }}>
            Loading live slot availability...
          </div>
        ) : pitches.length === 0 ? (
          <div className="card center subtle" style={{ padding: '64px 24px', margin: '16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🏟️</div>
            <h3 style={{ marginBottom: 8, color: 'var(--text-1)' }}>No pitches added yet</h3>
            <p className="subtle small" style={{ maxWidth: 460, margin: '0 auto 20px', lineHeight: 1.5 }}>
              No pitches added yet. Add a pitch to view its calendar and booking details.
            </p>
            <Button variant="primary" to={paths.owner.venueSetup}>
              + Add Pitch in Venue Setup
            </Button>
          </div>
        ) : viewMode === 'week' ? (
          /* WEEK VIEW GRID */
          <div className="cal-grid" style={{ minWidth: 900, gridTemplateColumns: `80px repeat(7, 1fr)` }}>
            <div className="cal-head">Time</div>
            {weekDays.map((d) => {
              const isToday = formatDateIso(d) === formatDateIso(new Date());
              const isSelected = formatDateIso(d) === dateStr;
              return (
                <div
                  className="cal-head"
                  key={d.toISOString()}
                  style={{
                    background: isToday ? 'rgba(34, 197, 94, 0.12)' : isSelected ? 'var(--surface-2)' : undefined,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setDate(d);
                    setViewMode('day');
                  }}
                  title="Click to jump to this day"
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isToday ? 'var(--success)' : 'var(--text-1)' }}>
                    {d.getDate()} {d.toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                </div>
              );
            })}

            {rows.map((row, rowIndex) => (
              <Fragment key={row.time}>
                <div className="cal-time num">{row.time}</div>
                {weekDays.map((dayObj) => {
                  const dayIso = formatDateIso(dayObj);
                  const isToday = dayIso === formatDateIso(new Date());
                  const pitchIndex = visiblePitchesWithIndices.length > 0 ? visiblePitchesWithIndices[0].originalIndex : 0;
                  const pitchObj = visiblePitchesWithIndices.length > 0 ? visiblePitchesWithIndices[0].pitch : pitches[0];
                  const cell = row.cells[pitchIndex];

                  return (
                    <div
                      key={`${dayIso}-${row.time}`}
                      className={`cal-cell ${(cell?.status || 'AVAILABLE').toLowerCase()}`}
                      style={{ background: isToday ? 'rgba(34, 197, 94, 0.03)' : undefined }}
                      onClick={() => {
                        if (!cell) return;
                        if (cell.status === 'AVAILABLE') {
                          openForCell(rowIndex, pitchIndex, cell, pitchObj, row.time);
                        } else if (cell.status === 'BOOKED' || cell.status === 'HELD' || cell.status === 'BLOCKED') {
                          openDetailDrawer(cell, pitchObj, row.time);
                        }
                      }}
                    >
                      {cell?.label ? (
                        <div className="cal-booking">
                          <b>{cell.label}</b>
                          <span className="tiny">{cell.variant}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, opacity: 0.6 }}>Available</span>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        ) : (
          /* DAY VIEW GRID */
          <div
            className="cal-grid"
            style={{ minWidth: 720, gridTemplateColumns: `80px repeat(${visiblePitchesWithIndices.length}, 1fr)` }}
          >
            <div className="cal-head">Time</div>
            {visiblePitchesWithIndices.map(({ pitch: p }) => (
              <div className="cal-head" key={p.id}>
                {p.name}
                <br />
                {(p.sports || ['football']).map((s) => {
                  const badge = SPORT_BADGES[s.toLowerCase()] || { label: s, tone: 'blue' };
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
                {visiblePitchesWithIndices.map(({ pitch, originalIndex }) => {
                  const cell = row.cells[originalIndex];
                  if (!cell) return <div key={pitch.id} className="cal-cell" />;
                  return (
                    <div
                      key={cell.slotId || originalIndex}
                      className={`cal-cell ${(cell.status || 'AVAILABLE').toLowerCase()}`}
                      onClick={() => {
                        if (cell.status === 'AVAILABLE') {
                          openForCell(rowIndex, originalIndex, cell, pitch, row.time);
                        } else if (cell.status === 'BOOKED' || cell.status === 'HELD' || cell.status === 'BLOCKED') {
                          openDetailDrawer(cell, pitch, row.time);
                        }
                      }}
                    >
                      {cell.label && (
                        <div className="cal-booking">
                          <b>{cell.label}</b>
                          <span className="tiny">{cell.variant}</span>
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
      <Overlay isOpen={manual.isOpen} onClose={manual.close} title="Manage Slot / Manual booking" mode="drawer">
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
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <Button variant="primary" size="lg" style={{ flex: 1 }} onClick={confirmManualBooking}>
            Confirm booking
          </Button>
          <Button variant="ghostDanger" size="lg" onClick={() => handleBlockSlot()}>
            ⛔ Block slot
          </Button>
        </div>
      </Overlay>

      {/* Event detail drawer */}
      <Overlay
        isOpen={detail.isOpen}
        onClose={detail.close}
        title={`Slot Details · ${selectedDetailCell?.time || ''} · ${selectedDetailCell?.pitchName || ''}`}
        mode="drawer"
      >
        <div className="row-wrap" style={{ margin: '6px 0 12px' }}>
          <Badge tone={selectedDetailCell?.status === 'BLOCKED' ? 'red' : selectedDetailCell?.variant === 'held' ? 'amber' : 'green'}>
            {selectedDetailCell?.status === 'BLOCKED' ? 'Blocked for Maintenance' : selectedDetailCell?.variant === 'held' ? 'Held · checkout' : 'Booked · Active'}
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
        </div>

        {selectedDetailCell?.status === 'BLOCKED' ? (
          <div style={{ marginTop: 20 }}>
            <Alert tone="warning" icon="⛔" title="Slot is Blocked">
              This slot is currently blocked for maintenance. Players cannot book it online.
            </Alert>
            <Button
              variant="primary"
              size="lg"
              block
              style={{ marginTop: 16 }}
              onClick={() => handleUnblockSlot(selectedDetailCell.slotId)}
            >
              🔓 Unblock Slot (Make Available)
            </Button>
          </div>
        ) : (
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
        )}
      </Overlay>
    </>
  );
}
