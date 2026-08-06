import {
  useState,
} from 'react';

import {
  Alert,
} from '@/components/ui/Alert';

import {
  Badge,
} from '@/components/ui/Badge';

import {
  Button,
} from '@/components/buttons/Button';

import {
  Checkline,
} from '@/components/forms/Toggles';

import {
  Chip,
} from '@/components/ui/Chip';

import {
  Field,
  Input,
  Select,
} from '@/components/forms/Field';

import {
  IconButton,
} from '@/components/buttons/IconButton';

import {
  Overlay,
} from '@/components/modals/Overlay';

import {
  PageTitle,
} from '@/components/common/PageTitle';

import {
  Photo,
} from '@/components/ui/Photo';

import {
  SPORT_BADGES,
} from '@/data/owner';

import {
  useDisclosure,
} from '@/hooks/useDisclosure';

import {
  useToast,
} from '@/hooks/useToast';

import {
  paths,
} from '@/routes/paths';

const PHOTO_TILE = {
  width: 72,
  height: 72,
};

const PHOTOS = [
  {
    id: 'main',
    variant: undefined,
    glyph: '🏟️',
  },
  {
    id: 'night',
    variant: 'alt1',
    glyph: '🌙',
  },
  {
    id: 'goal',
    variant: 'alt2',
    glyph: '🥅',
  },
  {
    id: 'run',
    variant: 'alt3',
    glyph: '🏃',
  },
];

const INITIAL_PITCHES = [
  {
    id: 1,
    name: 'Pitch 1 · 7-a-side',
    desc: 'Artificial grass · floodlit · 30×50 m',
    sports: ['Football', 'Cricket'],
  },
  {
    id: 2,
    name: 'Pitch 2 · 7-a-side',
    desc: 'Artificial grass · floodlit · 30×50 m',
    sports: ['Football'],
  },
  {
    id: 3,
    name: 'Pitch 3 · 5-a-side futsal',
    desc: 'Indoor · rubber court',
    sports: ['Futsal', 'Badminton'],
  },
];

/** One base price per sport — peak/off-peak comes from the pricing model, not the owner. */
const INITIAL_SPORT_PRICING = [
  {
    id: 'football',
    title: '⚽ Football',
    tone: 'blue',
    duration: '90',
    buffer: '10',
    basePrice: 2200,
  },
  {
    id: 'futsal',
    title: '🥅 Futsal',
    tone: 'green',
    duration: '60',
    buffer: '10',
    basePrice: 1500,
  },
  {
    id: 'cricket',
    title: '🏏 Cricket',
    tone: 'amber',
    duration: '120',
    buffer: '15',
    basePrice: 3000,
  },
  {
    id: 'badminton',
    title: '🏸 Badminton',
    tone: '',
    style: {
      background: 'var(--info-soft)',
      color: 'var(--info)',
    },
    duration: '40',
    buffer: '5',
    basePrice: 1000,
  },
];

const bdt = (value) => `৳${Number(value).toLocaleString('en-US')}`;

const HOURS = [
  {
    id: 'open',
    label: 'OPEN',
    value: '6:00 AM',
  },
  {
    id: 'close',
    label: 'CLOSE',
    value: '11:00 PM',
  },
  {
    id: 'buffer',
    label: 'BUFFER',
    value: '10 min',
  },
];

const DEPOSIT_OPTIONS = ['Full payment only', '30% deposit allowed', '50% deposit'];

const AMENITIES = [
  {
    id: 'floodlights',
    label: 'Floodlights',
    on: true,
  },
  {
    id: 'parking',
    label: 'Parking',
    on: true,
  },
  {
    id: 'changing',
    label: 'Changing room',
    on: true,
  },
  {
    id: 'washroom',
    label: 'Washroom',
    on: true,
  },
  {
    id: 'water',
    label: 'Drinking water',
    on: true,
  },
  {
    id: 'kit',
    label: 'Bibs & balls',
    on: true,
  },
  {
    id: 'cafeteria',
    label: 'Cafeteria',
    on: false,
  },
];

const ASSIGNABLE_SPORTS = ['Football', 'Cricket', 'Futsal', 'Badminton', 'Volleyball'];

/** Renders the coloured badge row for a pitch's assigned sports. */
function SportTags({ sports }) {
  if (!sports.length) {
    return (
      <Badge
        tone="gray"
        dot={false}
      >
        No sports assigned
      </Badge>
    );
  }

  return sports.map((sport) => {
    const meta = SPORT_BADGES[sport] ?? {
      glyph: sport,
      tone: '',
    };

    return (
      <Badge
        key={sport}
        tone={meta.tone === 'info' ? '' : meta.tone}
        dot={false}
        style={meta.tone === 'info' ? {
          background: 'var(--info-soft)',
          color: 'var(--info)',
        } : undefined}
      >
        {meta.glyph}
      </Badge>
    );
  });
}

export default function VenueSetupPage() {
  const {
    showToast,
  } = useToast();

  const live = useDisclosure(false);
  const pitchModal = useDisclosure(false);
  const slotModal = useDisclosure(false);

  const [pitches, setPitches] = useState(INITIAL_PITCHES);
  const [editingId, setEditingId] = useState(null);
  const [pitchDraft, setPitchDraft] = useState({
    name: '',
    desc: '',
    sports: ['Football'],
  });

  const [deposit, setDeposit] = useState('30% deposit allowed');
  const [policy, setPolicy] = useState(
    'Free cancel until 24h before · 50% within 24h · no refund within 6h',
  );
  const [allowSplit, setAllowSplit] = useState(true);

  const [slotDraft, setSlotDraft] = useState({
    sport: 'football',
    duration: '90',
    buffer: '10',
    basePrice: '2200',
  });

  const [sportPricing, setSportPricing] = useState(INITIAL_SPORT_PRICING);

  function openSlotSettings() {
    const current = sportPricing[0];
    setSlotDraft({
      sport: current.id,
      duration: current.duration,
      buffer: current.buffer,
      basePrice: String(current.basePrice),
    });
    slotModal.open();
  }

  function selectSlotSport(id) {
    const current = sportPricing.find((sport) => sport.id === id);
    setSlotDraft({
      sport: id,
      duration: current.duration,
      buffer: current.buffer,
      basePrice: String(current.basePrice),
    });
  }

  function openAddPitch() {
    setEditingId(null);

    setPitchDraft({
      name: '',
      desc: '',
      sports: ['Football'],
    });

    pitchModal.open();
  }

  function openEditPitch(pitch) {
    setEditingId(pitch.id);

    setPitchDraft({
      name: pitch.name,
      desc: pitch.desc,
      sports: pitch.sports,
    });

    pitchModal.open();
  }

  function toggleDraftSport(sport) {
    setPitchDraft((current) => ({
      ...current,
      sports: current.sports.includes(sport)
        ? current.sports.filter((item) => item !== sport)
        : [...current.sports, sport],
    }));
  }

  function savePitch() {
    const name = pitchDraft.name.trim() || 'New Pitch';
    const desc = pitchDraft.desc.trim() || 'Standard turf court';

    if (editingId) {
      setPitches((current) =>
        current.map((pitch) =>
          pitch.id === editingId ? { ...pitch, name, desc, sports: pitchDraft.sports } : pitch,
        ),
      );
      showToast('Pitch details updated ✓');
    } else {
      setPitches((current) => [...current, {
        id: Date.now(),
        name,
        desc,
        sports: pitchDraft.sports,
      }]);
      showToast('New pitch added with sport assignments ✓');
    }

    pitchModal.close();
  }

  function saveSlotSettings() {
    const basePrice = Math.max(0, Math.round(Number(String(slotDraft.basePrice).replace(/[^\d.]/g, '')) || 0));
    if (!basePrice) {
      showToast('Enter a base price for this sport');
      return;
    }
    setSportPricing((current) =>
      current.map((sport) =>
        sport.id === slotDraft.sport
          ? { ...sport, duration: slotDraft.duration, buffer: slotDraft.buffer, basePrice }
          : sport,
      ),
    );
    showToast(`Base price saved — TurfChai will price each slot around ${bdt(basePrice)} ✓`);
    slotModal.close();
  }

  return (
    <>
      <PageTitle
        title="Venue setup"
      />

      <div
        style={{
          maxWidth: 1040,
        }}
      >
        <Alert
          tone="ok"
          icon="✓"
          title="Approved! Kick Off Arena is a pending listing."
          style={{
            marginBottom: 16,
          }}
        >
          Complete the profile below, then press <b>Go Live</b> to start taking bookings.
        </Alert>

        <div
          className="between"
          style={{
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                marginBottom: 2,
              }}
            >
              Venue setup · Kick Off Arena
            </h1>

            <span className="row-wrap">
              <Badge tone="amber">Pending — not visible to players</Badge>

              <span
                className="subtle small"
              >
                5 of 6 sections complete
              </span>
            </span>
          </div>

          <div className="row">
            <div
              className="progress"
              style={{
                width: 160,
              }}
            >
              <i
                style={{
                  width: '83%',
                }}
              />
            </div>

            <b
              className="num small"
            >
              83%
            </b>
          </div>
        </div>

        <div
          className="grid2"
          style={{
            alignItems: 'start',
          }}
        >
          <div className="stack">
            <section className="card">
              <div className="between">
                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  📷 Photos
                </h3>

                <Badge
                  tone="green"
                  dot={false}
                >
                  Done
                </Badge>
              </div>

              <div
                className="row"
                style={{
                  marginTop: 10,
                }}
              >
                {PHOTOS.map((photo) => (
                  <Photo
                    key={photo.id}
                    variant={photo.variant}
                    glyph={photo.glyph}
                    style={PHOTO_TILE}
                  />
                ))}

                <IconButton
                  label="Add photo"
                  style={{
                    ...PHOTO_TILE,
                    fontSize: 22,
                  }}
                  onClick={() => showToast('Add photo 📷')}
                >
                  +
                </IconButton>
              </div>
            </section>

            <section className="card">
              <div className="between">
                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  🥅 Pitches &amp; Sport Assignment
                </h3>

                <Badge
                  tone="green"
                  dot={false}
                >
                  {pitches.length} added
                </Badge>
              </div>

              <p
                className="subtle small"
                style={{
                  margin: '6px 0 10px',
                }}
              >
                Assign specific pitches to one or multiple sports
              </p>

              <div
                className="stack-sm"
                style={{
                  marginTop: 10,
                }}
              >
                {pitches.map((pitch) => (
                  <div
                    className="panel between"
                    key={pitch.id}
                  >
                    <div>
                      <b className="small">{pitch.name}</b>

                      <div className="tiny subtle">{pitch.desc}</div>

                      <div
                        className="row-wrap sports-tags"
                        style={{
                          gap: 4,
                          marginTop: 6,
                        }}
                      >
                        <SportTags sports={pitch.sports} />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="tertiary"
                      onClick={() => openEditPitch(pitch)}
                    >
                      Edit
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                size="sm"
                style={{
                  marginTop: 10,
                }}
                onClick={openAddPitch}
              >
                + Add pitch
              </Button>
            </section>

            <section className="card">
              <div className="between">
                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  💰 Pricing &amp; Slot Durations by Sport
                </h3>

                <Badge
                  tone="green"
                  dot={false}
                >
                  Configured
                </Badge>
              </div>

              <p
                className="subtle small"
                style={{
                  margin: '6px 0 10px',
                }}
              >
                Set one base price per sport. TurfChai prices each slot around it automatically —
                peak evenings, weekends, holidays, weather and how full the pitch already is.
              </p>

              <div
                className="grid2"
                style={{
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {sportPricing.map((sport) => (
                  <div
                    className="panel between"
                    key={sport.id}
                  >
                    <div>
                      <b className="small">{sport.title}</b>

                      <div className="tiny subtle">
                        {sport.duration} min slots · {sport.buffer}m buffer
                      </div>
                    </div>

                    <Badge
                      tone={sport.tone}
                      dot={false}
                      style={sport.style}
                    >
                      {bdt(sport.basePrice)} base
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sport</th>

                      <th>Slot duration</th>

                      <th>Handover buffer</th>

                      <th className="num">Base price</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sportPricing.map((sport) => (
                      <tr key={sport.id}>
                        <td>{sport.title}</td>

                        <td>{sport.duration} min</td>

                        <td>{sport.buffer} min</td>

                        <td className="num">{bdt(sport.basePrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Alert
                tone="info"
                icon="🤖"
                title="Peak and off-peak are set for you"
                style={{
                  marginTop: 12,
                }}
              >
                The pricing model adjusts every slot from your base price using the hour, day,
                public holidays, how far ahead the booking is, live occupancy and the forecast for
                your turf&apos;s exact location.
              </Alert>

              <Button
                size="sm"
                style={{
                  marginTop: 10,
                }}
                onClick={openSlotSettings}
              >
                Edit slot durations &amp; base prices
              </Button>
            </section>

            <section className="card">
              <div className="between">
                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  🕐 Operating hours &amp; buffer
                </h3>

                <Badge
                  tone="green"
                  dot={false}
                >
                  Done
                </Badge>
              </div>

              <div
                className="grid3"
                style={{
                  marginTop: 10,
                  gap: 10,
                }}
              >
                {HOURS.map((item) => (
                  <div
                    className="panel"
                    key={item.id}
                  >
                    <span className="tiny subtle">{item.label}</span>

                    <br />

                    <b className="num">{item.value}</b>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="stack">
            <section className="card">
              <div className="between">
                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  🧾 Deposit &amp; cancellation
                </h3>

                <Badge
                  tone="red"
                  dot={false}
                >
                  Incomplete
                </Badge>
              </div>

              <div
                className="field"
                style={{
                  marginTop: 10,
                }}
              >
                <label>Booking deposit</label>

                <div className="row-wrap">
                  {DEPOSIT_OPTIONS.map((option) => (
                    <Chip
                      key={option}
                      active={deposit === option}
                      onToggle={() => setDeposit(option)}
                    >
                      {option}
                    </Chip>
                  ))}
                </div>
              </div>

              <Field
                label="Cancellation policy"
                htmlFor="cxl"
              >
                <Select
                  id="cxl"
                  value={policy}
                  onChange={(event) => setPolicy(event.target.value)}
                >
                  <option>Choose a policy…</option>

                  <option>Free cancel until 24h before · 50% within 24h · no refund within 6h</option>

                  <option>Flexible — free cancel until 6h before</option>

                  <option>Strict — deposits non-refundable</option>
                </Select>
              </Field>

              <Checkline
                label="Allow players to split payment with teammates"
                checked={allowSplit}
                onChange={(event) => setAllowSplit(event.target.checked)}
              />

              <Button
                size="sm"
                variant="primary"
                style={{
                  marginTop: 10,
                }}
                onClick={() => showToast('Section saved ✓')}
              >
                Save section
              </Button>
            </section>

            <section className="card">
              <div className="between">
                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  📋 Amenities &amp; rules
                </h3>

                <Badge
                  tone="green"
                  dot={false}
                >
                  Done
                </Badge>
              </div>

              <div
                className="row-wrap"
                style={{
                  marginTop: 10,
                }}
              >
                {AMENITIES.map((amenity) => (
                  <span
                    className={amenity.on ? 'chip on' : 'chip'}
                    key={amenity.id}
                  >
                    {amenity.label}
                  </span>
                ))}
              </div>

              <p
                className="small muted"
                style={{
                  margin: '10px 0 0',
                }}
              >
                Rules: turf shoes only · no smoking · arrive 10 min early for handover.
              </p>
            </section>

            <div
              className="glass glass-card center"
            >
              <h3>Ready to go live?</h3>

              <p
                className="subtle small"
                style={{
                  margin: '4px 0 12px',
                }}
              >
                Complete the deposit &amp; cancellation section, then your slots open to every player on TurfChai
                instantly.
              </p>

              <Button
                variant="primary"
                size="lg"
                block
                onClick={live.open}
              >
                🚀 Go Live
              </Button>

              <Button
                variant="tertiary"
                block
                to={paths.player.venue('kick-off-arena')}
                style={{
                  marginTop: 8,
                }}
              >
                Preview player view
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Overlay
        isOpen={live.isOpen}
        onClose={live.close}
        title="Kick Off Arena is LIVE"
        hideHeader
        className="center"
      >
        <div
          className="check-anim"
          aria-hidden="true"
        >
          🚀
        </div>

        <h3>Kick Off Arena is LIVE</h3>

        <p
          className="muted small"
        >
          Your slots are now bookable by 40,000+ players in Dhaka. First booking usually lands within 48 hours.
        </p>

        <Badge
          tone="green"
          style={{
            margin: '8px 0 14px',
          }}
        >
          Live · visible in Explore
        </Badge>

        <Button
          variant="primary"
          block
          to={paths.owner.dashboard}
        >
          Open owner dashboard →
        </Button>
      </Overlay>

      {/* Modal: Pitch Add/Edit & Sport Assignment */}
      <Overlay
        isOpen={pitchModal.isOpen}
        onClose={pitchModal.close}
        title={editingId ? 'Edit Pitch & Sport Assignment' : 'Add New Pitch & Assign Sports'}
        maxWidth={480}
      >
        <p
          className="subtle small"
          style={{
            margin: '4px 0 12px',
          }}
        >
          Define pitch specifications and assign allowed sports for this pitch.
        </p>

        <Field
          label="Pitch Name"
          htmlFor="pName"
        >
          <Input
            id="pName"
            placeholder="e.g. Pitch 4 · 7-a-side"
            value={pitchDraft.name}
            onChange={(event) => setPitchDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>

        <Field
          label="Surface & Details"
          htmlFor="pDesc"
        >
          <Input
            id="pDesc"
            placeholder="e.g. Artificial grass · floodlit · 30×50 m"
            value={pitchDraft.desc}
            onChange={(event) => setPitchDraft((current) => ({ ...current, desc: event.target.value }))}
          />
        </Field>

        <div
          className="field"
        >
          <label>
            Assign to Sports <span className="subtle tiny">(Choose all sports playable on this pitch)</span>
          </label>

          <div
            className="row-wrap"
            style={{
              gap: 8,
              marginTop: 6,
            }}
          >
            {ASSIGNABLE_SPORTS.map((sport) => (
              <Chip
                key={sport}
                active={pitchDraft.sports.includes(sport)}
                onToggle={() => toggleDraftSport(sport)}
                style={{
                  cursor: 'pointer',
                }}
              >
                {SPORT_BADGES[sport].glyph}
              </Chip>
            ))}
          </div>
        </div>

        <div
          className="stack-sm"
          style={{
            marginTop: 16,
          }}
        >
          <Button
            variant="primary"
            block
            onClick={savePitch}
          >
            Save pitch assignment ✓
          </Button>

          <Button
            variant="tertiary"
            block
            onClick={pitchModal.close}
          >
            Cancel
          </Button>
        </div>
      </Overlay>

      {/* Modal: Slot Durations & Pricing Manager */}
      <Overlay
        isOpen={slotModal.isOpen}
        onClose={slotModal.close}
        title="Slot times & base price by sport"
        maxWidth={520}
      >
        <p
          className="subtle small"
          style={{
            margin: '4px 0 12px',
          }}
        >
          Set the slot length and one base price per sport. You do not set peak and off-peak rates —
          the pricing model moves each slot around your base price on its own.
        </p>

        <Field
          label="Select Sport"
          htmlFor="spSportSelect"
        >
          <Select
            id="spSportSelect"
            value={slotDraft.sport}
            onChange={(event) => selectSlotSport(event.target.value)}
          >
            {sportPricing.map((sport) => (
              <option
                key={sport.id}
                value={sport.id}
              >
                {sport.title}
              </option>
            ))}
          </Select>
        </Field>

        <div
          className="grid2"
          style={{
            gap: 10,
          }}
        >
          <Field
            label="Slot Duration"
            htmlFor="spDuration"
          >
            <Select
              id="spDuration"
              value={slotDraft.duration}
              onChange={(event) => setSlotDraft((current) => ({ ...current, duration: event.target.value }))}
            >
              <option value="30">30 minutes</option>

              <option value="40">40 minutes</option>

              <option value="60">60 minutes (1 hr)</option>

              <option value="90">90 minutes (1.5 hrs)</option>

              <option value="120">120 minutes (2 hrs)</option>
            </Select>
          </Field>

          <Field
            label="Handover Buffer"
            htmlFor="spBuffer"
          >
            <Select
              id="spBuffer"
              value={slotDraft.buffer}
              onChange={(event) => setSlotDraft((current) => ({ ...current, buffer: event.target.value }))}
            >
              <option value="5">5 minutes</option>

              <option value="10">10 minutes</option>

              <option value="15">15 minutes</option>
            </Select>
          </Field>
        </div>

        <Field
          label="Base price per slot (৳)"
          htmlFor="spBasePrice"
        >
          <Input
            className="num"
            id="spBasePrice"
            inputMode="numeric"
            value={slotDraft.basePrice}
            onChange={(event) => setSlotDraft((current) => ({ ...current, basePrice: event.target.value }))}
          />
        </Field>

        <p
          className="tiny subtle"
          style={{
            margin: '-4px 0 0',
          }}
        >
          A quiet weekday morning may sell below this; a Friday evening in good weather may sell
          above it. You always keep your revenue share of whatever the slot sells for.
        </p>

        <div
          className="stack-sm"
          style={{
            marginTop: 16,
          }}
        >
          <Button
            variant="primary"
            block
            onClick={saveSlotSettings}
          >
            Save base price ✓
          </Button>

          <Button
            variant="tertiary"
            block
            onClick={slotModal.close}
          >
            Cancel
          </Button>
        </div>
      </Overlay>
    </>
  );
}
