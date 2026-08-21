import { useState, useEffect, useCallback } from 'react';
import { Overlay } from '@/components/modals/Overlay';
import { Field, Input, Select } from '@/components/forms/Field';
import { Button } from '@/components/buttons/Button';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/hooks/useToast';
import { toUserMessage } from '@/utils/errorMessage';
import { listMyVenues, getOwnerCalendar, createManualBooking } from '@/api/ownerVenues';

function formatDateIso(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function ManualBookingModal({
  isOpen,
  onClose,
  onSuccess,
  initialVenueId = null,
  initialPitchId = null,
  initialSlotId = null,
  initialDate = null,
}) {
  const { showToast } = useToast();

  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(initialVenueId || '');
  const [date, setDate] = useState(() => initialDate || formatDateIso(new Date()));
  const [pitches, setPitches] = useState([]);
  const [selectedPitchId, setSelectedPitchId] = useState(initialPitchId ? String(initialPitchId) : '');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(initialSlotId ? String(initialSlotId) : '');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [source, setSource] = useState('Phone');
  const [paymentStatus, setPaymentStatus] = useState('Paid in full (cash)');
  const [notes, setNotes] = useState('');

  const [calendarData, setCalendarData] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Sync initial props when opened
  useEffect(() => {
    if (isOpen) {
      if (initialVenueId) setSelectedVenueId(initialVenueId);
      if (initialDate) setDate(initialDate);
      if (initialPitchId) setSelectedPitchId(String(initialPitchId));
      if (initialSlotId) setSelectedSlotId(String(initialSlotId));
    }
  }, [isOpen, initialVenueId, initialDate, initialPitchId, initialSlotId]);

  // Load venues on open
  useEffect(() => {
    if (!isOpen) return;

    listMyVenues()
      .then((res) => {
        const venueList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setVenues(venueList);
        if (venueList.length > 0) {
          setSelectedVenueId((prev) => prev || initialVenueId || venueList[0].id);
        }
      })
      .catch((err) => {
        setError(toUserMessage(err, 'Could not load your venues'));
      });
  }, [isOpen, initialVenueId]);

  // Load calendar when venue or date changes
  useEffect(() => {
    if (!isOpen || !selectedVenueId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

    let unmounted = false;
    setLoadingSlots(true);
    setError(null);

    getOwnerCalendar(selectedVenueId, date)
      .then((data) => {
        if (!unmounted) {
          setCalendarData(data);
        }
      })
      .catch((err) => {
        if (!unmounted) {
          setError(toUserMessage(err, 'Could not load slots for this date.'));
          setCalendarData(null);
        }
      })
      .finally(() => {
        if (!unmounted) {
          setLoadingSlots(false);
        }
      });

    return () => {
      unmounted = true;
    };
  }, [isOpen, selectedVenueId, date]);

  // Derive pitches and available slots from calendarData & selectedPitchId
  useEffect(() => {
    if (!calendarData) {
      setPitches([]);
      setAvailableSlots([]);
      setSelectedSlotId('');
      return;
    }

    const pitchList = Array.isArray(calendarData?.pitches) ? calendarData.pitches : [];
    setPitches(pitchList);

    const currentPitchId = selectedPitchId && pitchList.some((p) => String(p.id) === String(selectedPitchId))
      ? selectedPitchId
      : (pitchList[0]?.id ? String(pitchList[0].id) : '');

    if (currentPitchId !== selectedPitchId) {
      setSelectedPitchId(currentPitchId);
    }

    const rows = Array.isArray(calendarData?.rows) ? calendarData.rows : [];
    const slots = [];
    rows.forEach((row) => {
      (row.cells || []).forEach((cell) => {
        if (
          cell?.slotId &&
          cell.status === 'AVAILABLE' &&
          (!currentPitchId || String(cell.pitchId) === String(currentPitchId))
        ) {
          slots.push({
            slotId: cell.slotId,
            time: row.time,
            price: cell.price,
            pitchId: cell.pitchId,
          });
        }
      });
    });

    setAvailableSlots(slots);
    setSelectedSlotId((prev) => {
      if (prev && slots.some((s) => String(s.slotId) === String(prev))) return prev;
      return slots[0]?.slotId ? String(slots[0].slotId) : '';
    });
  }, [calendarData, selectedPitchId]);

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setSource('Phone');
    setPaymentStatus('Paid in full (cash)');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedVenueId) {
      setError('Please select a venue.');
      return;
    }
    if (!selectedSlotId) {
      setError('Please select an available slot.');
      return;
    }
    const name = customerName.trim() || 'Manual Booking';

    setSubmitting(true);
    setError(null);

    try {
      await createManualBooking(selectedVenueId, {
        slotId: Number(selectedSlotId),
        pitchId: selectedPitchId ? Number(selectedPitchId) : undefined,
        customerName: name,
        customerPhone: customerPhone.trim(),
        source,
        paymentStatus,
        notes: notes.trim(),
      });

      showToast(`Manual booking confirmed for ${name} ✓`);
      resetForm();
      onSuccess?.();
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to record manual booking.';
      setError(msg);
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay isOpen={isOpen} onClose={handleClose} title="Manual booking" mode="drawer">
      <p className="subtle small" style={{ margin: '4px 0 12px' }}>
        Phone or walk-in — this slot is reserved immediately and removed from online availability.
      </p>

      {error ? (
        <Alert tone="danger" icon="⚠️" style={{ marginBottom: 12 }}>
          {error}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit}>
        {venues.length > 1 && (
          <Field label="Venue" htmlFor="mbVenue">
            <Select
              id="mbVenue"
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              disabled={submitting}
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Date" htmlFor="mbDate">
            <Input
              id="mbDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={submitting}
            />
          </Field>

          <Field label="Pitch" htmlFor="mbPitch">
            <Select
              id="mbPitch"
              value={selectedPitchId}
              onChange={(e) => setSelectedPitchId(e.target.value)}
              disabled={submitting || pitches.length === 0}
            >
              {pitches.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Slot Time" htmlFor="mbSlot">
          {loadingSlots ? (
            <div className="tiny subtle" style={{ padding: '8px 0' }}>Loading available slots…</div>
          ) : (
            <Select
              id="mbSlot"
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
              disabled={submitting || availableSlots.length === 0}
            >
              {availableSlots.length === 0 ? (
                <option value="">No available slots on this date</option>
              ) : (
                availableSlots.map((s) => (
                  <option key={s.slotId} value={s.slotId}>
                    {s.time} {s.price != null ? `(৳${Number(s.price).toLocaleString('en-BD')})` : ''}
                  </option>
                ))
              )}
            </Select>
          )}
          {availableSlots.length === 0 && !loadingSlots ? (
            <span className="tiny subtle" style={{ color: 'var(--warn)' }}>
              All slots for this pitch on {date || 'this date'} are booked or blocked.
            </span>
          ) : null}
        </Field>

        <Field label="Customer name" htmlFor="mbName">
          <Input
            id="mbName"
            placeholder="e.g. Salam Bhai"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            disabled={submitting}
            required
          />
        </Field>

        <Field label="Phone number" htmlFor="mbPhone">
          <Input
            className="num"
            id="mbPhone"
            placeholder="e.g. 017XXXXXXXX"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            disabled={submitting}
          />
        </Field>

        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Source" htmlFor="mbSrc">
            <Select
              id="mbSrc"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={submitting}
            >
              <option value="Phone">Phone</option>
              <option value="Walk-in">Walk-in</option>
            </Select>
          </Field>

          <Field label="Payment status" htmlFor="mbPay">
            <Select
              id="mbPay"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              disabled={submitting}
            >
              <option value="Paid in full (cash)">Paid in full (cash)</option>
              <option value="Deposit taken · rest at venue">Deposit taken · rest at venue</option>
              <option value="Unpaid — collect on arrival">Unpaid — collect on arrival</option>
            </Select>
          </Field>
        </div>

        <Field label="Notes (optional)" htmlFor="mbNote">
          <Input
            id="mbNote"
            placeholder="e.g. regular customer, wants bibs"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            maxLength={250}
          />
        </Field>

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            disabled={submitting || !selectedSlotId || availableSlots.length === 0}
          >
            {submitting ? 'Confirming…' : 'Confirm booking'}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
