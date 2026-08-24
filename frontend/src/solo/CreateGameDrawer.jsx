import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Field, Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { createOpenGame, SKILL_LABELS } from '@/api/openGames';
import { listBookings, formatBookingDate, formatTimeRange, bookingEnd } from '@/api/bookings';
import { useApi } from '@/hooks/useApi';
import { useSession } from '@/hooks/useSession';
import { paths } from '@/routes/paths';
import { toUserMessage } from '@/utils/errorMessage';

const BLANK = {
  bookingId: '',
  title: '',
  skillLevel: 'ALL_LEVELS',
  capacity: '10',
  reservedSpots: '1',
  pricePerPlayer: '',
};

/**
 * Posts a new open game from an existing confirmed booking.
 * Enables keeping some spots for friends and posting the remaining spots as open game.
 */
export function CreateGameDrawer({ isOpen, onClose, onCreated, defaultBookingId }) {
  const navigate = useNavigate();
  const { signedIn } = useSession();
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  const bookingsApi = useApi(
    () => (isOpen && signedIn ? listBookings() : Promise.resolve([])),
    [isOpen, signedIn],
  );

  const eligibleBookings = useMemo(() => {
    const raw = bookingsApi.data;
    const list = Array.isArray(raw) ? raw : [];
    const now = new Date();
    return list.filter((b) => {
      const status = String(b.status ?? '').toUpperCase();
      if (status === 'CANCELLED') return false;
      const end = bookingEnd(b);
      return !end || end.getTime() > now.getTime();
    });
  }, [bookingsApi.data]);

  const handleBookingChange = (bookingId) => {
    const booking = eligibleBookings.find((b) => String(b.id) === String(bookingId));
    setForm((current) => {
      const capacity = Number(current.capacity) || 10;
      let suggestedPrice = current.pricePerPlayer;
      if (booking?.amount && (!current.pricePerPlayer || current.pricePerPlayer === '')) {
        suggestedPrice = String(Math.max(0, Math.round(Number(booking.amount) / capacity)));
      }
      return {
        ...current,
        bookingId,
        title: current.title || (booking ? `${booking.venueName} Match` : ''),
        pricePerPlayer: suggestedPrice,
      };
    });
    setErrors((current) => ({ ...current, bookingId: undefined }));
  };

  // Pre-select the booking we were opened for, and re-apply when the eligible
  // list finishes loading — adjusted during render instead of in an effect.
  const [lastSyncKey, setLastSyncKey] = useState(null);
  const syncKey = `${isOpen}|${defaultBookingId ?? ''}|${eligibleBookings.length}`;
  if (lastSyncKey !== syncKey) {
    setLastSyncKey(syncKey);
    if (defaultBookingId && isOpen) {
      handleBookingChange(defaultBookingId);
    }
  }

  const selectedBooking = useMemo(() => {
    return eligibleBookings.find((b) => String(b.id) === String(form.bookingId)) ?? null;
  }, [eligibleBookings, form.bookingId]);

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const capacityNum = Number(form.capacity) || 10;
  const reservedNum = Number(form.reservedSpots) || 1;
  const openSpotsCount = Math.max(1, capacityNum - reservedNum);

  const validate = () => {
    const next = {};
    if (!form.bookingId) next.bookingId = 'Pick the booked game you want to host';
    if (!form.title.trim()) next.title = 'Give your game a title';
    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 50) {
      next.capacity = 'Between 2 and 50 players';
    }
    const reserved = Number(form.reservedSpots);
    if (!Number.isInteger(reserved) || reserved < 1 || reserved >= capacity) {
      next.reservedSpots = `Must be between 1 and ${capacity - 1} spots`;
    }
    const price = Number(form.pricePerPlayer);
    if (form.pricePerPlayer === '' || Number.isNaN(price) || price < 0) {
      next.pricePerPlayer = 'Enter the price per player (0 if free)';
    }
    return next;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !selectedBooking) return;

    setBusy(true);
    setSubmitError(null);
    let created;
    try {
      created = await createOpenGame({
        bookingId: Number(selectedBooking.id),
        title: form.title.trim(),
        venueId: Number(selectedBooking.venueId),
        pitchId: selectedBooking.pitchId ? Number(selectedBooking.pitchId) : undefined,
        gameDate: selectedBooking.bookingDate,
        startTime: selectedBooking.startTime?.length === 5 ? `${selectedBooking.startTime}:00` : selectedBooking.startTime,
        endTime: selectedBooking.endTime?.length === 5 ? `${selectedBooking.endTime}:00` : selectedBooking.endTime,
        skillLevel: form.skillLevel,
        capacity: Number(form.capacity),
        reservedSpots: Number(form.reservedSpots),
        pricePerPlayer: Number(form.pricePerPlayer),
      });
    } catch (error) {
      setSubmitError(toUserMessage(error, 'Could not post your game.'));
      return;
    } finally {
      setBusy(false);
    }
    setForm(BLANK);
    setErrors({});
    onCreated?.(created);
  };

  return (
    <Overlay isOpen={isOpen} onClose={onClose} title="Post an open game" mode="drawer">
      {!signedIn ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p className="subtle" style={{ marginBottom: 16 }}>
            You need to sign in to post games for your booked turfs.
          </p>
          <Button variant="primary" to={paths.auth}>
            Sign In
          </Button>
        </div>
      ) : bookingsApi.loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <p className="subtle">Loading your bookings…</p>
        </div>
      ) : eligibleBookings.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎟️</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No eligible bookings found</h3>
          <p className="subtle small" style={{ maxWidth: 320, margin: '0 auto 20px', lineHeight: 1.5 }}>
            You can only post an open game for a pitch you have already booked. Book a slot first to invite other players to join!
          </p>
          <Button
            variant="primary"
            onClick={() => {
              onClose?.();
              navigate(paths.player.explore);
            }}
          >
            Explore &amp; Book Venues
          </Button>
        </div>
      ) : (
        <form className="stack-sm" style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={submit} noValidate>
          <p className="subtle small" style={{ margin: 0, lineHeight: 1.45 }}>
            Keep some spots for you and your friends, and post the remaining spots as an open game for other players to join.
          </p>

          <Field label="Select your booked turf" htmlFor="cg-booking" error={errors.bookingId}>
            <Select
              id="cg-booking"
              value={form.bookingId}
              onChange={(event) => handleBookingChange(event.target.value)}
            >
              <option value="">Choose a booked slot…</option>
              {eligibleBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.venueName} {b.pitchName ? `(${b.pitchName})` : ''} · {formatBookingDate(b)} {formatTimeRange(b.startTime, b.endTime)}
                </option>
              ))}
            </Select>
          </Field>

          {selectedBooking && (
            <div
              style={{
                background: 'var(--surface-2, rgba(255,255,255,0.05))',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                🏟️ {selectedBooking.venueName} {selectedBooking.venueArea ? `· ${selectedBooking.venueArea}` : ''}
              </div>
              <div className="subtle" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {selectedBooking.pitchName && <div>Pitch: {selectedBooking.pitchName}</div>}
                <div>Date: {formatBookingDate(selectedBooking)}</div>
                <div>Time: {formatTimeRange(selectedBooking.startTime, selectedBooking.endTime)}</div>
                {selectedBooking.amount != null && <div>Booking Cost: ৳{Number(selectedBooking.amount).toLocaleString()}</div>}
              </div>
            </div>
          )}

          <Field label="Game title" htmlFor="cg-title" error={errors.title}>
            <Input
              id="cg-title"
              value={form.title}
              placeholder="e.g. Friday night 7-a-side friendly"
              onChange={(event) => set('title', event.target.value)}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Players needed" htmlFor="cg-capacity" error={errors.capacity}>
              <Input
                id="cg-capacity"
                type="number"
                min="2"
                max="50"
                value={form.capacity}
                onChange={(event) => set('capacity', event.target.value)}
              />
            </Field>
            <Field label="Spots kept for friends" htmlFor="cg-reserved" error={errors.reservedSpots}>
              <Input
                id="cg-reserved"
                type="number"
                min="1"
                max={capacityNum - 1}
                value={form.reservedSpots}
                onChange={(event) => set('reservedSpots', event.target.value)}
              />
            </Field>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              fontSize: 13,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>📢 Open spots posted publicly:</span>
            <b style={{ color: 'var(--brand)', fontSize: 14 }}>{openSpotsCount} spots</b>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Price / player (৳)" htmlFor="cg-price" error={errors.pricePerPlayer}>
              <Input
                id="cg-price"
                type="number"
                min="0"
                step="10"
                placeholder="250"
                value={form.pricePerPlayer}
                onChange={(event) => set('pricePerPlayer', event.target.value)}
              />
            </Field>
            <Field label="Skill level" htmlFor="cg-skill">
              <Select
                id="cg-skill"
                value={form.skillLevel}
                onChange={(event) => set('skillLevel', event.target.value)}
              >
                {Object.entries(SKILL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {submitError ? (
            <div className="alert warn" role="status">
              <span className="ico">⚠️</span>
              <div>{submitError}</div>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy} style={{ flex: 1 }}>
              {busy ? 'Posting…' : 'Post game'}
            </Button>
          </div>
        </form>
      )}
    </Overlay>
  );
}
