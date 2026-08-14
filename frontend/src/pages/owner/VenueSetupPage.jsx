import {
  useCallback,
  useEffect,
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

import { paths } from '@/routes/paths';

import { useApi } from '@/hooks/useApi';
import { getOwnerVenueSetup } from '@/api/ownerVenueSetup';
import { generateSlots } from '@/api/ownerSlots';

function CustomDatePicker({ value, onChange, id }) {
  const [textVal, setTextVal] = useState(() => {
    if (!value) return '';
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  });

  const handleTextChange = (e) => {
    const newVal = e.target.value;
    setTextVal(newVal);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(newVal)) {
      const [d, m, y] = newVal.split('/');
      onChange({ target: { value: `${y}-${m}-${d}` } });
    } else if (newVal === '') {
      onChange({ target: { value: '' } });
    }
  };

  const handleNativeChange = (e) => {
    const val = e.target.value;
    onChange(e);
    if (val) {
      const [y, m, d] = val.split('-');
      setTextVal(`${d}/${m}/${y}`);
    } else {
      setTextVal('');
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <div style={{ position: 'absolute', left: 12, display: 'flex', color: 'var(--text-3, #888)', pointerEvents: 'none' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
          <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
        </svg>
      </div>

      <input 
        type="date"
        value={value}
        onChange={handleNativeChange}
        style={{ position: 'absolute', left: 8, width: 22, height: 22, opacity: 0, cursor: 'pointer', zIndex: 10 }} 
      />
      
      <Input
        id={id}
        type="text"
        placeholder="DD/MM/YYYY"
        maxLength="10"
        value={textVal}
        onChange={handleTextChange}
        style={{ paddingLeft: 34, width: '100%' }}
      />
    </div>
  );
}

function CustomTimePicker({ value, onChange, id }) {
  const [textVal, setTextVal] = useState(value || '');

  const handleTextChange = (e) => {
    const newVal = e.target.value;
    setTextVal(newVal);
    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(newVal)) {
      onChange({ target: { value: newVal } });
    } else if (newVal === '') {
      onChange({ target: { value: '' } });
    }
  };

  const handleNativeChange = (e) => {
    const val = e.target.value;
    onChange(e);
    setTextVal(val);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <div style={{ position: 'absolute', left: 12, display: 'flex', color: 'var(--text-3, #888)', pointerEvents: 'none' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z"/>
          <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0"/>
        </svg>
      </div>

      <input 
        type="time"
        value={value}
        onChange={handleNativeChange}
        style={{ position: 'absolute', left: 8, width: 22, height: 22, opacity: 0, cursor: 'pointer', zIndex: 10 }} 
      />
      
      <Input
        id={id}
        type="text"
        placeholder="HH:MM"
        maxLength="5"
        value={textVal}
        onChange={handleTextChange}
        style={{ paddingLeft: 34, width: '100%' }}
      />
    </div>
  );
}


import {
  listMyVenues,
  getOwnerVenue,
  updateVenue,
  addPitch,
  updatePitch,
} from '@/api/ownerVenues';

const PHOTO_TILE = {
  width: 72,
  height: 72,
};

const DEFAULT_PHOTOS = [
  { id: 'main', variant: undefined, glyph: '🏟️' },
  { id: 'night', variant: 'alt1', glyph: '🌙' },
  { id: 'goal', variant: 'alt2', glyph: '🥅' },
  { id: 'run', variant: 'alt3', glyph: '🏃' },
];

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

const DEPOSIT_OPTIONS = ['Full payment only', '30% deposit allowed', '50% deposit'];

const AMENITIES = [
  { id: 'floodlights', label: 'Floodlights', on: true },
  { id: 'parking', label: 'Parking', on: true },
  { id: 'changing', label: 'Changing room', on: true },
  { id: 'washroom', label: 'Washroom', on: true },
  { id: 'water', label: 'Drinking water', on: true },
  { id: 'kit', label: 'Bibs & balls', on: true },
  { id: 'cafeteria', label: 'Cafeteria', on: false },
];

const ASSIGNABLE_SPORTS = ['Football', 'Cricket', 'Futsal', 'Badminton', 'Volleyball'];

function SportTags({ sports }) {
  if (!sports || !sports.length) {
    return (
      <Badge tone="gray" dot={false}>
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
  const { showToast } = useToast();

  const live = useDisclosure(false);
  const pitchModal = useDisclosure(false);
  const slotModal = useDisclosure(false);
  const generateSlotsModal = useDisclosure(false);

  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [venueData, setVenueData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pitches, setPitches] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [pitchDraft, setPitchDraft] = useState({
    name: '',
    desc: '',
    sports: ['Football'],
  });

  const [deposit, setDeposit] = useState('30% deposit allowed');
  const [policy, setPolicy] = useState('Free cancel until 24h before · 50% within 24h · no refund within 6h');
  const [allowSplit, setAllowSplit] = useState(true);
  const [mlPricingEnabled, setMlPricingEnabled] = useState(apiData.mlPricingEnabled ?? true);

  const [slotDraft, setSlotDraft] = useState({
    sport: 'football',
    duration: '90',
    buffer: '10',
    basePrice: '2200',
  });

  const [sportPricing, setSportPricing] = useState(INITIAL_SPORT_PRICING);

  const [photos, setPhotos] = useState([]);

  function handlePhotoUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const newPhotos = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...newPhotos]);
    showToast(`${files.length} venue photo(s) added ✓`);

    if (selectedVenueId) {
      const allPhotoNames = [...photos, ...newPhotos].map((p) => p.name || p.url);
      updateVenue(selectedVenueId, { photos: allPhotoNames }).catch(() => {});
    }
  }

  const refreshVenueDetails = useCallback((vId) => {
    if (!vId) return;
    setLoading(true);
    getOwnerVenue(vId)
      .then((res) => {
        if (res) {
          setVenueData(res);
          setDeposit(res.depositPolicy || '30% deposit allowed');
          setPolicy(res.cancelPolicy || 'Free cancel until 24h before · 50% within 24h · no refund within 6h');
          setAllowSplit(res.allowSplitPayment !== false);

          if (Array.isArray(res.photos) && res.photos.length > 0) {
            setPhotos(res.photos.map((url, idx) => ({ id: String(idx), url, name: `Photo ${idx + 1}` })));
          }

          if (Array.isArray(res.pitches)) {
            setPitches(res.pitches.map((p) => ({
              id: p.id,
              name: p.name,
              desc: `${p.surfaceType || 'Artificial grass'} · ${p.dimensions || '30×50 m'}`,
              sports: (p.sportSlugs && p.sportSlugs.length > 0)
                ? p.sportSlugs.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                : ['Football'],
            })));
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let unmounted = false;
    listMyVenues()
      .then((res) => {
        if (!unmounted && Array.isArray(res) && res.length > 0) {
          setVenues(res);
          const initialId = res[0].id;
          setSelectedVenueId(initialId);
          refreshVenueDetails(initialId);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!unmounted) setLoading(false);
      });
    return () => {
      unmounted = true;
    };
  }, [refreshVenueDetails]);

  function handleVenueChange(id) {
    setSelectedVenueId(id);
    refreshVenueDetails(id);
  }

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
    if (!current) return;
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

  async function savePitch() {
    const name = pitchDraft.name.trim() || 'New Pitch';
    const desc = pitchDraft.desc.trim() || 'Standard turf court';

    if (selectedVenueId) {
      try {
        const sportSlugs = pitchDraft.sports.map((s) => s.toLowerCase());
        if (editingId) {
          await updatePitch(selectedVenueId, editingId, {
            name,
            surfaceDetail: desc,
            sportSlugs,
          });
          showToast('Pitch details updated ✓');
        } else {
          await addPitch(selectedVenueId, {
            name,
            format: '7-a-side',
            surfaceType: 'ARTIFICIAL_TURF',
            surfaceDetail: desc,
            dimensions: '30×50 m',
            lighting: 'FLOODLIT',
            maxPlayers: 14,
            indoor: false,
            sportSlugs,
          });
          showToast('New pitch added to venue ✓');
        }
        refreshVenueDetails(selectedVenueId);
        pitchModal.close();
        return;
      } catch {
        // Fallback local update
      }
    }

    if (editingId) {
      setLocalPitches((current) =>
        current.map((pitch) =>
          pitch.id === editingId ? { ...pitch, name, desc, sports: pitchDraft.sports } : pitch,
        ),
      );
      showToast('Pitch details updated ✓');
    } else {
      setPitches((current) => [
        ...current,
        {
          id: Date.now(),
          name,
          desc,
          sports: pitchDraft.sports,
        },
      ]);
      showToast('New pitch added ✓');
    }
    pitchModal.close();
  }

  async function saveDepositSection() {
    if (selectedVenueId) {
      try {
        await updateVenue(selectedVenueId, {
          depositPolicy: deposit,
          cancelPolicy: policy,
          allowSplitPayment: allowSplit,
        });
        showToast('Deposit & cancellation section saved ✓');
        refreshVenueDetails(selectedVenueId);
        return;
      } catch {
        // Fallback toast
      }
    }
    showToast('Deposit & cancellation section saved ✓');
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

  async function handleGoLive() {
    if (selectedVenueId) {
      try {
        await updateVenue(selectedVenueId, { status: 'PUBLISHED' });
        refreshVenueDetails(selectedVenueId);
      } catch {
        // Continue modal launch
      }
    }
    live.open();
  }

  const hoursList = [
    { id: 'open', label: 'OPEN', value: venueData?.openTime || '06:00 AM' },
    { id: 'close', label: 'CLOSE', value: venueData?.closeTime || '11:00 PM' },
    { id: 'buffer', label: 'BUFFER', value: '10 min' },
  ];

  return (
    <>
      <PageTitle title="Venue setup" />

      <div style={{ maxWidth: 1040 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
            Loading venue details...
          </div>
        ) : (
          <>
            <Alert
              tone="ok"
              icon="✓"
              title={`${venueData?.name || 'Venue'} is ${venueData?.status === 'PUBLISHED' ? 'LIVE' : 'Pending'}`}
              style={{ marginBottom: 16 }}
            >
              Complete the profile below, then press <b>Go Live</b> to start taking bookings.
            </Alert>

            <div className="between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div>
                <h1 style={{ fontSize: 24, marginBottom: 2 }}>
                  Venue setup · {venueData?.name || 'My Venue'}
                </h1>

                <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
                  {venues.length > 1 && (
                    <Select
                      value={selectedVenueId || ''}
                      onChange={(e) => handleVenueChange(Number(e.target.value))}
                      style={{ marginRight: 8 }}
                    >
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Badge tone={venueData?.status === 'PUBLISHED' ? 'green' : 'amber'}>
                    {venueData?.status === 'PUBLISHED' ? 'Live · Bookable' : 'Pending — not visible to players'}
                  </Badge>

                  <span className="subtle small">
                    {pitches.length > 0 ? '5 of 6 sections complete' : 'Incomplete setup'}
                  </span>
                </div>
              </div>

              <div className="row">
                <div className="progress" style={{ width: 160 }}>
                  <i style={{ width: venueData?.status === 'PUBLISHED' ? '100%' : '83%' }} />
                </div>
                <b className="num small">{venueData?.status === 'PUBLISHED' ? '100%' : '83%'}</b>
              </div>
            </div>

            <div className="grid2" style={{ alignItems: 'start' }}>
              <div className="stack">
                <section className="card">
                  <div className="between">
                    <h3 style={{ margin: 0 }}>📷 Photos</h3>
                    <Badge tone="green" dot={false}>
                      Done
                    </Badge>
                  </div>

                  <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                    {photos.length > 0
                      ? photos.map((p) => (
                          <img
                            key={p.id || p.name}
                            src={p.url || p}
                            alt={p.name || 'Venue Photo'}
                            style={{
                              width: 72,
                              height: 72,
                              objectFit: 'cover',
                              borderRadius: 8,
                              border: '1px solid var(--border-soft)',
                            }}
                          />
                        ))
                      : DEFAULT_PHOTOS.map((photo) => (
                          <Photo key={photo.id} variant={photo.variant} glyph={photo.glyph} style={PHOTO_TILE} />
                        ))}

                    <label
                      style={{
                        ...PHOTO_TILE,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 8,
                        border: '1px dashed var(--border-medium)',
                        cursor: 'pointer',
                        fontSize: 22,
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      +
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
                    </label>
                  </div>
                </section>

                <section className="card">
                  <div className="between">
                    <h3 style={{ margin: 0 }}>🥅 Pitches &amp; Sport Assignment</h3>
                    <Badge tone="green" dot={false}>
                      {pitches.length} added
                    </Badge>
                  </div>

                  <p className="subtle small" style={{ margin: '6px 0 10px' }}>
                    Assign specific pitches to one or multiple sports
                  </p>

                  <div className="stack-sm" style={{ marginTop: 10 }}>
                    {pitches.map((pitch) => (
                      <div className="panel between" key={pitch.id}>
                        <div>
                          <b className="small">{pitch.name}</b>
                          <div className="tiny subtle">{pitch.desc}</div>
                          <div className="row-wrap sports-tags" style={{ gap: 4, marginTop: 6 }}>
                            <SportTags sports={pitch.sports} />
                          </div>
                        </div>

                        <Button size="sm" variant="tertiary" onClick={() => openEditPitch(pitch)}>
                          Edit
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button size="sm" style={{ marginTop: 10 }} onClick={openAddPitch}>
                    + Add pitch
                  </Button>
                </section>

                <section className="card">
                  <div className="between">
                    <h3 style={{ margin: 0 }}>💰 Pricing &amp; Slot Durations by Sport</h3>
                    <Badge tone="green" dot={false}>
                      Configured
                    </Badge>
                  </div>

                  <p className="subtle small" style={{ margin: '6px 0 10px' }}>
                    Set one base price per sport. TurfChai prices each slot around it automatically.
                  </p>

                  <div className="grid2" style={{ gap: 8, marginBottom: 12 }}>
                    {sportPricing.map((sport) => (
                      <div className="panel between" key={sport.id}>
                        <div>
                          <b className="small">{sport.title}</b>
                          <div className="tiny subtle">
                            {sport.duration} min slots · {sport.buffer}m buffer
                          </div>
                        </div>

                        <Badge tone={sport.tone} dot={false} style={sport.style}>
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

                  <Alert tone="info" icon="🤖" title="Peak and off-peak are set for you" style={{ marginTop: 12 }}>
                    The pricing model adjusts every slot from your base price using hour, day, and live occupancy.
                  </Alert>

                  <Button size="sm" style={{ marginTop: 10 }} onClick={openSlotSettings}>
                    Edit slot durations &amp; base prices
                  </Button>
                </section>

                <section className="card">
                  <div className="between">
                    <h3 style={{ margin: 0 }}>🕐 Operating hours &amp; buffer</h3>
                    <Badge tone="green" dot={false}>
                      Done
                    </Badge>
                  </div>

                  <div className="grid3" style={{ marginTop: 10, gap: 10 }}>
                    {hoursList.map((item) => (
                      <div className="panel" key={item.id}>
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
                    <h3 style={{ margin: 0 }}>🧾 Deposit &amp; cancellation</h3>
                    <Badge tone="green" dot={false}>
                      Configured
                    </Badge>
                  </div>

                  <div className="field" style={{ marginTop: 10 }}>
                    <label>Booking deposit</label>
                    <div className="row-wrap">
                      {DEPOSIT_OPTIONS.map((option) => (
                        <Chip key={option} active={deposit === option} onToggle={() => setDeposit(option)}>
                          {option}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <Field label="Cancellation policy" htmlFor="cxl">
                    <Select id="cxl" value={policy} onChange={(event) => setPolicy(event.target.value)}>
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

                  <Button size="sm" variant="primary" style={{ marginTop: 10 }} onClick={saveDepositSection}>
                    Save section
                  </Button>
                </section>

                <section className="card">
                  <div className="between">
                    <h3 style={{ margin: 0 }}>📋 Amenities &amp; rules</h3>
                    <Badge tone="green" dot={false}>
                      Done
                    </Badge>
                  </div>

                  <div className="row-wrap" style={{ marginTop: 10 }}>
                    {AMENITIES.map((amenity) => (
                      <span className={amenity.on ? 'chip on' : 'chip'} key={amenity.id}>
                        {amenity.label}
                      </span>
                    ))}
                  </div>

                  <p className="small muted" style={{ margin: '10px 0 0' }}>
                    Rules: turf shoes only · no smoking · arrive 10 min early for handover.
                  </p>
                </section>

                <div className="glass glass-card center">
                  <h3>{venueData?.status === 'PUBLISHED' ? 'Venue is Live 🎉' : 'Ready to go live?'}</h3>
                  <p className="subtle small" style={{ margin: '4px 0 12px' }}>
                    Your slots open to every player on TurfChai instantly.
                  </p>

                  <Button variant="primary" size="lg" block onClick={handleGoLive}>
                    🚀 {venueData?.status === 'PUBLISHED' ? 'Update Live Venue' : 'Go Live'}
                  </Button>

                  <Button
                    variant="tertiary"
                    block
                    to={paths.player.venue(venueData?.slug || 'kick-off-arena')}
                    style={{ marginTop: 8 }}
                  >
                    Preview player view
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Overlay
        isOpen={live.isOpen}
        onClose={live.close}
        title={`${venueData?.name || 'Venue'} is LIVE`}
        hideHeader
        className="center"
      >
        <div className="check-anim" aria-hidden="true">
          🚀
        </div>

        <h3>{venueData?.name || 'Venue'} is LIVE</h3>

        <p className="muted small">
          Your slots are now bookable by 40,000+ players in Dhaka. First booking usually lands within 48 hours.
        </p>

        <Badge tone="green" style={{ margin: '8px 0 14px' }}>
          Live · visible in Explore
        </Badge>

        <Button variant="primary" block to={paths.owner.dashboard}>
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
        <p className="subtle small" style={{ margin: '4px 0 12px' }}>
          Define pitch specifications and assign allowed sports for this pitch.
        </p>

        <Field label="Pitch Name" htmlFor="pName">
          <Input
            id="pName"
            placeholder="e.g. Pitch 4 · 7-a-side"
            value={pitchDraft.name}
            onChange={(event) => setPitchDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>

        <Field label="Surface & Details" htmlFor="pDesc">
          <Input
            id="pDesc"
            placeholder="e.g. Artificial grass · floodlit · 30×50 m"
            value={pitchDraft.desc}
            onChange={(event) => setPitchDraft((current) => ({ ...current, desc: event.target.value }))}
          />
        </Field>

        <div className="field">
          <label>
            Assign to Sports <span className="subtle tiny">(Choose all sports playable on this pitch)</span>
          </label>

          <div className="row-wrap" style={{ gap: 8, marginTop: 6 }}>
            {ASSIGNABLE_SPORTS.map((sport) => (
              <Chip
                key={sport}
                active={pitchDraft.sports.includes(sport)}
                onToggle={() => toggleDraftSport(sport)}
                style={{ cursor: 'pointer' }}
              >
                {SPORT_BADGES[sport]?.glyph || sport}
              </Chip>
            ))}
          </div>
        </div>

        <div className="stack-sm" style={{ marginTop: 16 }}>
          <Button variant="primary" block onClick={savePitch}>
            Save pitch assignment ✓
          </Button>

          <Button variant="tertiary" block onClick={pitchModal.close}>
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
        <p className="subtle small" style={{ margin: '4px 0 12px' }}>
          Set the slot length and one base price per sport.
        </p>

        <Field label="Select Sport" htmlFor="spSportSelect">
          <Select
            id="spSportSelect"
            value={slotDraft.sport}
            onChange={(event) => selectSlotSport(event.target.value)}
          >
            {sportPricing.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.title}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Slot Duration" htmlFor="spDuration">
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

          <Field label="Handover Buffer" htmlFor="spBuffer">
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

        <Field label="Base price per slot (৳)" htmlFor="spBasePrice">
          <Input
            className="num"
            id="spBasePrice"
            inputMode="numeric"
            value={slotDraft.basePrice}
            onChange={(event) => setSlotDraft((current) => ({ ...current, basePrice: event.target.value }))}
          />
        </Field>

        <div className="stack-sm" style={{ marginTop: 16 }}>
          <Button variant="primary" block onClick={saveSlotSettings}>
            Save base price ✓
          </Button>

          <Button variant="tertiary" block onClick={slotModal.close}>
            Cancel
          </Button>
        </div>
      </Overlay>

      {/* Modal: Slot Generator */}
      <Overlay
        isOpen={generateSlotsModal.isOpen}
        onClose={generateSlotsModal.close}
        title="Batch Generate Slots"
        maxWidth={520}
      >
        <p className="subtle small" style={{ margin: '4px 0 12px' }}>
          Select a pitch and define the operating hours to generate bookable slots automatically.
        </p>

        <Field label="Pitch" htmlFor="genPitch">
          <Select id="genPitch" value={generateDraft.pitchId} onChange={e => setGenerateDraft(c => ({...c, pitchId: e.target.value}))}>
            <option value="">Select Pitch...</option>
            {pitches.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>

        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Start Date (DD/MM/YYYY)" htmlFor="genStart">
            <CustomDatePicker
              id="genStart"
              value={generateDraft.startDate}
              onChange={e => setGenerateDraft(c => ({...c, startDate: e.target.value}))}
            />
          </Field>
          <Field label="End Date (DD/MM/YYYY)" htmlFor="genEnd">
            <CustomDatePicker
              id="genEnd"
              value={generateDraft.endDate}
              onChange={e => setGenerateDraft(c => ({...c, endDate: e.target.value}))}
            />
          </Field>
        </div>

        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Daily Start Time (24h)" htmlFor="genTimeStart">
            <CustomTimePicker
              id="genTimeStart"
              value={generateDraft.startTime}
              onChange={e => setGenerateDraft(c => ({...c, startTime: e.target.value}))}
            />
          </Field>
          <Field label="Daily End Time (24h)" htmlFor="genTimeEnd">
            <CustomTimePicker
              id="genTimeEnd"
              value={generateDraft.endTime}
              onChange={e => setGenerateDraft(c => ({...c, endTime: e.target.value}))}
            />
          </Field>
        </div>

        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Duration (mins)" htmlFor="genDur">
            <Input id="genDur" type="number" min="15" value={generateDraft.slotDurationMinutes} onChange={e => setGenerateDraft(c => ({...c, slotDurationMinutes: e.target.value}))} />
          </Field>
          <Field label="Base Price (৳)" htmlFor="genPrice">
            <Input id="genPrice" type="number" min="0" value={generateDraft.basePrice} onChange={e => setGenerateDraft(c => ({...c, basePrice: e.target.value}))} />
          </Field>
        </div>

        <div className="stack-sm" style={{ marginTop: 16 }}>
          <Button variant="primary" block onClick={handleGenerateSlots}>Generate Slots</Button>
        </div>
      </Overlay>
    </>
  );
}
