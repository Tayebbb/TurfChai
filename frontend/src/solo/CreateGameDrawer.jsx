import { useMemo, useState } from 'react';
import { Button } from '@/components/buttons/Button';
import { Field, Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { createOpenGame, SKILL_LABELS } from '@/api/openGames';
import { searchVenues } from '@/api/venues';
import { getVenue } from '@/api/venues';
import { useApi } from '@/hooks/useApi';
import { toUserMessage } from '@/utils/errorMessage';

/** Today in the browser's timezone, as the ISO day the API expects. */
function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

const BLANK = {
  title: '',
  venueId: '',
  pitchId: '',
  gameDate: todayIso(),
  startTime: '20:00',
  endTime: '21:30',
  skillLevel: 'ALL_LEVELS',
  capacity: '10',
  pricePerPlayer: '',
};

/**
 * Posts a new open game.
 *
 * Mirrors CreateOpenGameRequest: title, venue, date, start/end, capacity and
 * price per player are required by the server, so they are required here too
 * rather than being sent blank and bounced with a 400.
 */
export function CreateGameDrawer({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  const venuesApi = useApi(() => (isOpen ? searchVenues({ size: 50 }) : Promise.resolve(null)), [isOpen]);
  const venues = useMemo(() => {
    const data = venuesApi.data;
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return items;
  }, [venuesApi.data]);

  const selectedVenue = venues.find((v) => String(v.id) === String(form.venueId));
  // Pitches only come with the venue detail payload, so they load on demand.
  const pitchesApi = useApi(
    () => (selectedVenue?.slug ? getVenue(selectedVenue.slug) : Promise.resolve(null)),
    [selectedVenue?.slug],
  );
  const pitches = Array.isArray(pitchesApi.data?.pitches) ? pitchesApi.data.pitches : [];

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = 'Give your game a title';
    if (!form.venueId) next.venueId = 'Pick the venue you booked';
    if (!form.gameDate) next.gameDate = 'Pick a date';
    else if (form.gameDate < todayIso()) next.gameDate = 'Pick today or a future date';
    if (!form.startTime) next.startTime = 'Set a kick-off time';
    if (!form.endTime) next.endTime = 'Set an end time';
    else if (form.startTime && form.endTime <= form.startTime) {
      next.endTime = 'End time must be after kick-off';
    }
    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 50) {
      next.capacity = 'Between 2 and 50 players';
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
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setSubmitError(null);
    let created;
    try {
      created = await createOpenGame({
        title: form.title.trim(),
        venueId: Number(form.venueId),
        pitchId: form.pitchId ? Number(form.pitchId) : undefined,
        gameDate: form.gameDate,
        startTime: `${form.startTime}:00`,
        endTime: `${form.endTime}:00`,
        skillLevel: form.skillLevel,
        capacity: Number(form.capacity),
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
      <form className="stack-sm" style={{ padding: '0 16px 16px' }} onSubmit={submit} noValidate>
        <p className="subtle small" style={{ marginTop: 8 }}>
          Already booked a pitch and short of players? Post the game and others can claim the
          empty spots.
        </p>

        <Field label="Game title" htmlFor="cg-title" error={errors.title}>
          <Input
            id="cg-title"
            value={form.title}
            placeholder="Friday night 7-a-side"
            onChange={(event) => set('title', event.target.value)}
          />
        </Field>

        <Field label="Venue" htmlFor="cg-venue" error={errors.venueId}>
          <Select
            id="cg-venue"
            value={form.venueId}
            onChange={(event) => {
              set('venueId', event.target.value);
              set('pitchId', '');
            }}
          >
            <option value="">
              {venuesApi.loading ? 'Loading venues…' : 'Select a venue'}
            </option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
                {venue.area ? ` · ${venue.area}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        {form.venueId ? (
          <Field label="Pitch (optional)" htmlFor="cg-pitch">
            <Select id="cg-pitch" value={form.pitchId} onChange={(event) => set('pitchId', event.target.value)}>
              <option value="">
                {pitchesApi.loading ? 'Loading pitches…' : 'Any pitch'}
              </option>
              {pitches.map((pitch) => (
                <option key={pitch.id} value={pitch.id}>
                  {pitch.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Date" htmlFor="cg-date" error={errors.gameDate}>
          <Input
            id="cg-date"
            type="date"
            min={todayIso()}
            value={form.gameDate}
            onChange={(event) => set('gameDate', event.target.value)}
          />
        </Field>

        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Kick-off" htmlFor="cg-start" error={errors.startTime}>
            <Input
              id="cg-start"
              type="time"
              value={form.startTime}
              onChange={(event) => set('startTime', event.target.value)}
            />
          </Field>
          <Field label="Ends" htmlFor="cg-end" error={errors.endTime}>
            <Input
              id="cg-end"
              type="time"
              value={form.endTime}
              onChange={(event) => set('endTime', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid2" style={{ gap: 10 }}>
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
          <Field label="Price per player (৳)" htmlFor="cg-price" error={errors.pricePerPlayer}>
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
        </div>

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

        {submitError ? (
          <div className="alert warn" role="status">
            <span className="ico">⚠️</span>
            <div>{submitError}</div>
          </div>
        ) : null}

        <div className="row" style={{ gap: 10, marginTop: 6 }}>
          <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy} style={{ flex: 1 }}>
            {busy ? 'Posting…' : 'Post game'}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
