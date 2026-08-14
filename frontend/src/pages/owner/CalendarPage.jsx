import { Fragment, useState, useEffect, useMemo } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { Field, Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { useApi } from '@/hooks/useApi';
import { getOwnerSlots, updateSlot } from '@/api/ownerSlots';
import { getOwnerVenueSetup } from '@/api/ownerVenueSetup';

const LEGEND = [
  { id: 'AVAILABLE', label: 'Available', swatch: 'var(--success)' },
  { id: 'BOOKED', label: 'Booked', swatch: 'var(--brand)' },
  { id: 'HELD', label: 'Held', swatch: 'repeating-linear-gradient(45deg,var(--warn),var(--warn) 3px,transparent 3px,transparent 6px)' },
  { id: 'BLOCKED', label: 'Blocked', swatch: 'var(--text-3)' },
];

const SMALL_BADGE = { fontSize: 10, padding: '2px 6px' };

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export default function CalendarPage() {
  const { showToast } = useToast();
  const detail = useDisclosure(false);
  const manual = useDisclosure(false); // Used for editing slots now

  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = formatDate(selectedDate);
  const venueId = 1; // Assuming venueId 1 for now

  // Fetch setups to get pitches
  const { data: venueRes, loading: venueLoading } = useApi(getOwnerVenueSetup, []);
  const pitches = venueRes?.data?.pitches || venueRes?.pitches || [];

  // Fetch slots
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  const fetchSlots = async () => {
    setSlotsLoading(true);
    try {
      const data = await getOwnerSlots(venueId, dateStr, dateStr);
      setSlots(data);
    } catch (err) {
      showToast('Failed to fetch slots', 'error');
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [dateStr]);

  // Compute grid rows
  const gridRows = useMemo(() => {
    if (!pitches.length) return [];
    
    // Get unique start times
    const times = new Set();
    slots.forEach(s => times.add(s.startTime.substring(0, 5))); // e.g. "09:00"
    const sortedTimes = Array.from(times).sort();

    return sortedTimes.map(timeStr => {
      const cells = pitches.map(pitch => {
        const slot = slots.find(s => s.pitchId === pitch.id && s.startTime.substring(0,5) === timeStr);
        if (!slot) return { kind: 'add' };
        
        let variant = 'online';
        if (slot.status === 'BLOCKED') variant = 'blocked';
        if (slot.status === 'HELD') variant = 'held';
        if (slot.status === 'AVAILABLE') variant = 'walkin';

        return {
          kind: 'slot',
          slot,
          variant,
          label: slot.status === 'AVAILABLE' ? `৳${slot.price}` : slot.status,
          openable: true
        };
      });
      return { time: timeStr, cells };
    });
  }, [slots, pitches]);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const handleOpenEdit = (slot) => {
    setSelectedSlot(slot);
    setEditPrice(slot.price);
    setEditStatus(slot.status);
    manual.open();
  };

  const handleSaveEdit = async () => {
    try {
      await updateSlot(selectedSlot.id, {
        price: Number(editPrice),
        status: editStatus
      });
      showToast('Slot updated successfully');
      manual.close();
      fetchSlots();
    } catch (err) {
      showToast('Failed to update slot', 'error');
    }
  };

  function goPrevDay() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  }

  function goNextDay() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  }

  const loading = venueLoading || slotsLoading;

  return (
    <>
      <PageTitle title="Calendar" />

      <div className="main-header">
        <div>
          <h1>Calendar</h1>
          <span className="subtle small">View and manage your slots</span>
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="View">
            <button type="button" className="on">Day</button>
            <button type="button" onClick={() => showToast('Week view (concept)')}>Week</button>
          </div>
        </div>
      </div>

      <div className="between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="row">
          <IconButton label="Previous day" onClick={goPrevDay}>‹</IconButton>
          <b>{selectedDate.toDateString()}</b>
          <IconButton label="Next day" onClick={goNextDay}>›</IconButton>
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
        <div className="cal-grid" style={{ minWidth: 720, gridTemplateColumns: `80px repeat(${pitches.length}, 1fr)` }}>
          <div className="cal-head">Time</div>
          {pitches.map(pitch => (
            <div className="cal-head" key={pitch.id}>
              {pitch.name}
              <br/>
              {pitch.sports?.map(sport => (
                <Badge key={sport} tone="blue" dot={false} style={SMALL_BADGE}>{sport}</Badge>
              ))}
            </div>
          ))}

          {gridRows.map((row, rowIndex) => (
            <Fragment key={row.time}>
              <div className="cal-time num">{row.time}</div>
              {row.cells.map((cell, cellIndex) => (
                <div className="cal-cell" key={`${row.time}-${cellIndex}`}>
                  {cell.kind === 'add' ? (
                    <button type="button" className="addcell" onClick={() => showToast('Use Slot Generator to add slots!')}>+</button>
                  ) : (
                    <div
                      className={`cal-ev ${cell.variant}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenEdit(cell.slot)}
                    >
                      {cell.label}
                    </div>
                  )}
                </div>
              ))}
            </Fragment>
          ))}
          
          {!loading && gridRows.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-3)' }}>
              No slots generated for this date. Go to Venue Setup to generate slots.
            </div>
          )}
          {loading && (
            <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-3)' }}>
              Loading slots...
            </div>
          )}
        </div>
      </div>

      {/* Edit Slot Drawer */}
      <Overlay isOpen={manual.isOpen} onClose={manual.close} title="Edit Slot" mode="drawer">
        <p className="subtle small">Modify the price or block this slot.</p>
        
        {selectedSlot && (
          <>
            <div className="stack-sm" style={{ marginBottom: 16 }}>
              <div className="between small">
                <span className="muted">Pitch</span>
                <b>{selectedSlot.pitchName}</b>
              </div>
              <div className="between small">
                <span className="muted">Time</span>
                <b>{selectedSlot.startTime.substring(0,5)} - {selectedSlot.endTime.substring(0,5)}</b>
              </div>
            </div>

            <Field label="Slot Price (৳)" htmlFor="editPrice">
              <Input
                id="editPrice"
                type="number"
                value={editPrice}
                onChange={e => setEditPrice(e.target.value)}
              />
            </Field>

            <Field label="Status" htmlFor="editStatus">
              <Select
                id="editStatus"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="BLOCKED">BLOCKED</option>
                <option value="HELD" disabled>HELD (in checkout)</option>
                <option value="BOOKED" disabled>BOOKED</option>
              </Select>
            </Field>

            <Button variant="primary" size="lg" block style={{ marginTop: 24 }} onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </>
        )}
      </Overlay>
    </>
  );
}
