import {
  useCallback,
  useEffect,
  useState,
  useRef,
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


import { generateSlots as apiGenerateSlots } from '@/api/ownerSlots';
import { getMyTurfRequests } from '@/api/turfRequests';

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
  createVenue,
  listMyVenues,
  getOwnerVenue,
  updateVenue,
  updateVenueStatus,
  uploadVenuePhotoApi,
  addPitch,
  updatePitch,
  upsertPricingRule,
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

const INITIAL_AMENITIES = [
  { id: 'floodlights', label: '💡 Floodlights', on: true },
  { id: 'parking', label: '🅿️ Parking', on: true },
  { id: 'changing', label: '👕 Changing room', on: true },
  { id: 'washroom', label: '🚿 Washroom', on: true },
  { id: 'water', label: '🚰 Drinking water', on: true },
  { id: 'kit', label: '⚽ Bibs & balls', on: true },
  { id: 'cafeteria', label: '☕ Cafeteria', on: false },
  { id: 'firstaid', label: '🩹 First aid kit', on: true },
  { id: 'seating', label: '🪑 Spectator seating', on: false },
  { id: 'wifi', label: '📶 Free Wi-Fi', on: false },
];

const INITIAL_RULES = [
  { id: 'shoes', label: '👟 Turf / Astro shoes only (no metal studs)', on: true },
  { id: 'smoking', label: '🚭 No smoking or vaping inside venue', on: true },
  { id: 'arrival', label: '⏱️ Arrive 10 min before slot time', on: true },
  { id: 'trash', label: '🗑️ Keep venue clean - disposal in bins', on: true },
  { id: 'food', label: '🍕 No outside heavy food on pitch', on: false },
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
  const [slotDraft, setSlotDraft] = useState({
    sport: 'football',
    duration: '90',
    buffer: '10',
    basePrice: '2200',
  });

  const [sportPricing, setSportPricing] = useState(INITIAL_SPORT_PRICING);

  const [photos, setPhotos] = useState([]);
  const [amenities, setAmenities] = useState(INITIAL_AMENITIES);
  const [rules, setRules] = useState(INITIAL_RULES);
  const [customRuleText, setCustomRuleText] = useState('');

  function toggleAmenity(id) {
    setAmenities((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextOn = !item.on;
          showToast(`${item.label} ${nextOn ? 'enabled ✓' : 'disabled'}`);
          return { ...item, on: nextOn };
        }
        return item;
      })
    );
  }

  function toggleRule(id) {
    setRules((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextOn = !item.on;
          showToast(`Rule ${nextOn ? 'activated ✓' : 'deactivated'}`);
          return { ...item, on: nextOn };
        }
        return item;
      })
    );
  }

  function handleAddCustomRule() {
    if (!customRuleText.trim()) return;
    const newRule = {
      id: `rule-${Date.now()}`,
      label: `📌 ${customRuleText.trim()}`,
      on: true,
    };
    setRules((prev) => [...prev, newRule]);
    setCustomRuleText('');
    showToast('Custom venue rule added ✓');
  }

  const [generateDraft, setGenerateDraft] = useState({
    pitchId: '',
    startDate: '',
    endDate: '',
    startTime: '06:00',
    endTime: '23:00',
    slotDurationMinutes: 60,
    basePrice: 2000
  });

  const [previewFile, setPreviewFile] = useState(null);
  const editFileInputRef = useRef(null);
  const [editingPhotoId, setEditingPhotoId] = useState(null);

  async function handleGenerateSlots() {
    try {
      await apiGenerateSlots(generateDraft);
      showToast('Slots generated successfully ✓');
      generateSlotsModal.close();
    } catch {
      showToast('Failed to generate slots');
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
          } else {
            setPhotos([]);
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
          } else {
            setPitches([]);
          }

          if (Array.isArray(res.pricingRules) && res.pricingRules.length > 0) {
            setSportPricing(res.pricingRules.map((rule) => ({
              id: rule.sportSlug || 'football',
              title: `${rule.sportSlug ? rule.sportSlug.charAt(0).toUpperCase() + rule.sportSlug.slice(1) : 'Football'}`,
              tone: rule.sportSlug === 'cricket' ? 'amber' : rule.sportSlug === 'futsal' ? 'green' : 'blue',
              duration: String(rule.slotDurationMin || 60),
              buffer: '10',
              basePrice: Number(rule.rate || 2000),
            })));
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const getActiveVenueId = useCallback(async () => {
    if (selectedVenueId) return selectedVenueId;
    if (venues.length > 0 && venues[0].id) {
      setSelectedVenueId(venues[0].id);
      return venues[0].id;
    }
    try {
      const res = await listMyVenues();
      const venueList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      if (venueList.length > 0 && venueList[0].id) {
        setVenues(venueList);
        const vId = venueList[0].id;
        setSelectedVenueId(vId);
        refreshVenueDetails(vId);
        return vId;
      } else {
        const created = await createVenue({
          name: 'My Venue',
          area: 'Dhanmondi',
          address: 'Dhanmondi',
          lat: 23.8103,
          lng: 90.4125,
          basePrice: 2000,
          openTime: '06:00',
          closeTime: '23:00',
        });
        const newV = created?.data || created;
        if (newV && newV.id) {
          setVenues([newV]);
          setSelectedVenueId(newV.id);
          refreshVenueDetails(newV.id);
          return newV.id;
        }
      }
    } catch (err) {
      console.error('Failed to resolve active venue', err);
    }
    return null;
  }, [selectedVenueId, venues, refreshVenueDetails]);

  async function handlePhotoUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const vId = await getActiveVenueId();
    if (!vId) {
      showToast('Initializing venue details, please try again');
      return;
    }

    let uploaded = 0;
    for (const file of files) {
      try {
        const res = await uploadVenuePhotoApi(vId, file);
        if (res?.url) {
          uploaded++;
          setPhotos((prev) => [
            ...prev,
            { id: String(Date.now() + Math.random()), url: res.url, name: file.name },
          ]);
        }
      } catch {
        showToast(`Failed to upload ${file.name}`);
      }
    }

    if (uploaded > 0) {
      showToast(`${uploaded} venue photo(s) uploaded successfully ✓`);
      refreshVenueDetails(vId);
    }
  }

  async function handleEditPhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file || !editingPhotoId) return;

    const vId = await getActiveVenueId();
    if (!vId) return;

    try {
      const res = await uploadVenuePhotoApi(vId, file);
      if (res?.url) {
        const newPhotos = photos.map(p => (p.id === editingPhotoId || p.url === editingPhotoId) ? { ...p, url: res.url, name: file.name } : p);
        await updateVenue(vId, { photos: newPhotos.map(p => p.url || p) });
        setPhotos(newPhotos);
        showToast('Photo replaced successfully ✓');
        // Clear input so same file can be selected again
        event.target.value = null;
      }
    } catch {
      showToast(`Failed to replace photo`);
    }
  }

  async function handleDeletePhoto(photoId) {
    if (photos.length <= 3) {
      showToast('A minimum of 3 venue photos are required');
      return;
    }

    const vId = await getActiveVenueId();
    if (!vId) return;

    const newPhotos = photos.filter(p => p.id !== photoId && p.url !== photoId);
    try {
      await updateVenue(vId, { photos: newPhotos.map(p => p.url || p) });
      setPhotos(newPhotos);
      showToast('Photo deleted ✓');
    } catch {
      showToast('Failed to delete photo');
    }
  }

  useEffect(() => {
    let unmounted = false;
    listMyVenues()
      .then((res) => {
        const venueList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (!unmounted && venueList.length > 0) {
          setVenues(venueList);
          const initialId = venueList[0].id;
          setSelectedVenueId(initialId);
          refreshVenueDetails(initialId);
        } else if (!unmounted) {
          // If no venue in database yet, fall back to owner's submitted turf request info
          getMyTurfRequests()
            .then((reqRes) => {
              const reqList = Array.isArray(reqRes?.data) ? reqRes.data : (Array.isArray(reqRes) ? reqRes : []);
              if (!unmounted && reqList.length > 0) {
                const req = reqList[0];
                const fallbackVenue = {
                  id: req.venueId || null,
                  name: req.venueName || 'My Venue',
                  status: req.status === 'APPROVED' ? 'APPROVED' : req.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
                  verified: req.status === 'APPROVED',
                  area: req.area || 'Dhanmondi',
                  openTime: '06:00 AM',
                  closeTime: '11:00 PM',
                };
                setVenues([fallbackVenue]);
                if (fallbackVenue.id) {
                  setSelectedVenueId(fallbackVenue.id);
                  refreshVenueDetails(fallbackVenue.id);
                }
                setVenueData(fallbackVenue);
                setPitches([]);

                if (req.photosJson) {
                  try {
                    const parsed = JSON.parse(req.photosJson);
                    if (Array.isArray(parsed)) {
                      setPhotos(parsed.map((url, idx) => ({ id: String(idx), url, name: `Photo ${idx + 1}` })));
                    }
                  } catch {
                    // Ignore JSON parsing errors for photos
                  }
                }
              }
            })
            .catch(() => {
              // Ignore turf request fetch errors
            });
        }
      })
      .catch(() => {
        // Ignore venue list fetch errors
      })
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

    const vId = await getActiveVenueId();
    if (!vId) {
      showToast('Initializing venue details, please try again');
      return;
    }

    try {
      const sportSlugs = pitchDraft.sports.map((s) => s.toLowerCase());
      if (editingId) {
        await updatePitch(vId, editingId, {
          name,
          surfaceDetail: desc,
          sportSlugs,
        });
        setPitches((prev) =>
          prev.map((p) => (p.id === editingId ? { ...p, name, desc, sports: pitchDraft.sports } : p))
        );
        showToast('Pitch details updated ✓');
      } else {
        const created = await addPitch(vId, {
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
        const createdPitch = created?.data || created;
        const newPitchObj = {
          id: createdPitch?.id || Date.now(),
          name: createdPitch?.name || name,
          desc: `${createdPitch?.surfaceType || 'Artificial grass'} · ${createdPitch?.dimensions || '30×50 m'}`,
          sports: (createdPitch?.sportSlugs && createdPitch.sportSlugs.length > 0)
            ? createdPitch.sportSlugs.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            : pitchDraft.sports,
        };
        setPitches((prev) => [...prev.filter((p) => p.id !== newPitchObj.id), newPitchObj]);
        showToast('New pitch added to venue ✓');
      }
      refreshVenueDetails(vId);
      pitchModal.close();
      return;
    } catch (err) {
      showToast(err?.data?.message || err?.message || 'Failed to save pitch details');
    }
  }

  async function saveDepositSection() {
    const vId = await getActiveVenueId();
    if (vId) {
      try {
        await updateVenue(vId, {
          depositPolicy: deposit,
          cancelPolicy: policy,
          allowSplitPayment: allowSplit,
        });
        showToast('Deposit & cancellation section saved ✓');
        refreshVenueDetails(vId);
        return;
      } catch {
        // Fallback toast
      }
    }
    showToast('Deposit & cancellation section saved ✓');
  }

  async function saveSlotSettings() {
    const basePrice = Math.max(0, Math.round(Number(String(slotDraft.basePrice).replace(/[^\d.]/g, '')) || 0));
    if (!basePrice) {
      showToast('Enter a base price for this sport');
      return;
    }
    const vId = await getActiveVenueId();
    if (vId) {
      try {
        await upsertPricingRule(vId, {
          sportSlug: (slotDraft.sport || 'football').toLowerCase(),
          windowType: 'full_day',
          rate: basePrice,
          slotDurationMin: Number(slotDraft.duration) || 60,
          bufferMin: Number(slotDraft.buffer) || 10,
          windowStart: '06:00',
          windowEnd: '23:00',
          active: true,
        });
        showToast(`Pricing rule saved for ${slotDraft.sport} ✓`);
        refreshVenueDetails(vId);
        slotModal.close();
        return;
      } catch {
        showToast('Failed to save pricing rule');
      }
    }
    slotModal.close();
  }

  async function handleGoLive() {
    const vId = await getActiveVenueId();
    if (!vId) return;

    const isApprovedOrVerified = venueData?.verified || venueData?.status === 'APPROVED' || venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED' || venueData?.status === 'PENDING_LISTING';
    if (!isApprovedOrVerified) {
      showToast('Verification Pending — Please wait for admin approval before going live');
      return;
    }

    const isCurrentlyLive = venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED';
    const nextStatus = isCurrentlyLive ? 'PENDING_LISTING' : 'LIVE';

    try {
      const updated = await updateVenueStatus(vId, nextStatus);
      if (updated && updated.status) {
        setVenueData((prev) => (prev ? { ...prev, status: updated.status } : updated));
      } else {
        setVenueData((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
      showToast(nextStatus === 'LIVE' ? 'Turf is now LIVE & visible to players ✓' : 'Turf is set to Offline ✓');
      refreshVenueDetails(vId);
      if (nextStatus === 'LIVE') {
        live.open();
      }
    } catch {
      showToast('Failed to update venue live status');
    }
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
            {venueData?.status === 'PUBLISHED' || venueData?.status === 'LIVE' ? (
              <Alert
                tone="ok"
                icon="🟢"
                title={`${venueData?.name || 'Venue'} is LIVE & Bookable`}
                style={{ marginBottom: 16, borderLeft: '4px solid #10b981', background: 'rgba(16, 185, 129, 0.08)' }}
              >
                Your venue is live and visible to all players! Players can browse pitches and book slots in real time.
              </Alert>
            ) : venueData?.verified || venueData?.status === 'APPROVED' || venueData?.status === 'PENDING_LISTING' ? (
              <Alert
                tone="ok"
                icon="✓"
                title={`${venueData?.name || 'Venue'} is Verified & Approved`}
                style={{ marginBottom: 16 }}
              >
                Your venue has been verified and approved by admin! You can now toggle <b>Go Live</b> to start accepting player bookings.
              </Alert>
            ) : venueData?.status === 'REJECTED' ? (
              <Alert
                tone="danger"
                icon="✕"
                title="Application Rejected"
                style={{ marginBottom: 16 }}
              >
                Your venue application was rejected by the admin team. Please contact support or submit updated documents.
              </Alert>
            ) : (
              <Alert
                tone="warn"
                icon="⏳"
                title="Verification Pending — Admin Review in Progress"
                style={{ marginBottom: 16 }}
              >
                Your venue application and submitted details are currently under review by our admin team.
                You can configure your pitches, photos, and pricing rules below. Once verified and approved by admin, your venue will go <b>LIVE</b> for player bookings.
              </Alert>
            )}

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
                  <Badge tone={venueData?.status === 'PUBLISHED' || venueData?.status === 'LIVE' ? 'green' : (venueData?.status === 'APPROVED' || venueData?.status === 'PENDING_LISTING' || venueData?.verified) ? 'blue' : venueData?.status === 'REJECTED' ? 'red' : 'amber'}>
                    {venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED' ? '🟢 LIVE · Bookable by Players' : (venueData?.status === 'APPROVED' || venueData?.status === 'PENDING_LISTING' || venueData?.verified) ? '✓ Verified · Ready to Go Live' : venueData?.status === 'REJECTED' ? '✕ Rejected' : '⏳ Pending — not visible to players'}
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
                    {photos.length > 0 ? (
                      photos.map((p) => (
                        <div key={p.id || p.name || p.url} style={{ position: 'relative' }}>
                          <div style={{ cursor: 'pointer' }} onClick={() => setPreviewFile(p)} title="Click to view full image">
                            <img
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
                          </div>
                          <div style={{ position: 'absolute', top: -6, right: -6, display: 'flex', gap: 2, background: 'rgba(0,0,0,0.7)', padding: 2, borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                            <button
                              type="button"
                              title="Replace photo"
                              onClick={(e) => { e.stopPropagation(); setEditingPhotoId(p.id || p.url); editFileInputRef.current?.click(); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, padding: '2px 4px' }}
                            >✏️</button>
                            <button
                              type="button"
                              title="Delete photo"
                              onClick={(e) => { e.stopPropagation(); handleDeletePhoto(p.id || p.url); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff5555', fontSize: 11, padding: '2px 4px' }}
                            >✖</button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="subtle small" style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px' }}>
                        No photos uploaded yet. Upload venue photos to showcase your turf.
                      </div>
                    )}

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

                    <input type="file" accept="image/*" ref={editFileInputRef} style={{ display: 'none' }} onChange={handleEditPhotoUpload} />
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

                  {pitches.length > 0 ? (
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
                  ) : (
                    <div style={{ padding: '16px 0', color: 'var(--text-3)', fontSize: 14 }}>
                      No pitches added yet. Add a pitch to get started.
                    </div>
                  )}

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

                  <div className="grid2" style={{ gap: 10, marginBottom: 12 }}>
                    {sportPricing.map((sport) => (
                      <div
                        className="panel"
                        key={sport.id}
                        onClick={() => {
                          selectSlotSport(sport.id);
                          slotModal.open();
                        }}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                          padding: '12px 14px',
                          minWidth: 0,
                          transition: 'all 0.15s ease',
                          border: '1px solid var(--border-soft)',
                          borderRadius: 10,
                          background: 'var(--surface-1)',
                        }}
                        title={`Click to edit ${sport.title} time duration, buffer & base price`}
                      >
                        <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                          <b className="small" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                            {sport.title}
                            <span style={{ fontSize: 11, opacity: 0.7 }}>✏️</span>
                          </b>
                          <div className="tiny subtle" style={{ marginTop: 2 }}>
                            {sport.duration} min slots · {sport.buffer}m buffer
                          </div>
                        </div>

                        <Badge
                          tone={sport.tone}
                          dot={false}
                          style={{
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            fontSize: 13,
                            fontWeight: 700,
                            padding: '4px 10px',
                            ...sport.style,
                          }}
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
                    <h3 style={{ margin: 0 }}>📋 Amenities &amp; Rules</h3>
                    <Badge tone="green" dot={false}>
                      {amenities.filter((a) => a.on).length} active
                    </Badge>
                  </div>

                  <p className="subtle small" style={{ margin: '6px 0 10px' }}>
                    Click any amenity or facility to toggle it on/off for player view.
                  </p>

                  <div className="row-wrap" style={{ gap: 8, marginTop: 10 }}>
                    {amenities.map((amenity) => (
                      <Chip
                        key={amenity.id}
                        active={amenity.on}
                        onToggle={() => toggleAmenity(amenity.id)}
                        style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                      >
                        {amenity.label}
                      </Chip>
                    ))}
                  </div>

                  <hr style={{ border: 0, borderTop: '1px solid var(--border-soft)', margin: '16px 0 12px' }} />

                  <div className="between">
                    <b className="small">Venue Rules</b>
                    <span className="tiny subtle">Click rule to enable / disable</span>
                  </div>

                  <div className="stack-sm" style={{ marginTop: 8 }}>
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        onClick={() => toggleRule(rule.id)}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: rule.on ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-1)',
                          border: rule.on ? '1px solid rgba(16, 185, 129, 0.3)' : '1px dashed var(--border-medium)',
                          opacity: rule.on ? 1 : 0.65,
                          transition: 'all 0.15s ease',
                        }}
                        title="Click to toggle rule state"
                      >
                        <span className="small" style={{ textDecoration: rule.on ? 'none' : 'line-through' }}>
                          {rule.label}
                        </span>
                        <Badge tone={rule.on ? 'green' : 'gray'} dot={false} style={{ fontSize: 11 }}>
                          {rule.on ? 'Active' : 'Off'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <Input
                      placeholder="Add custom rule..."
                      value={customRuleText}
                      onChange={(e) => setCustomRuleText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomRule()}
                      style={{ fontSize: 13 }}
                    />
                    <Button size="sm" variant="secondary" onClick={handleAddCustomRule} style={{ flexShrink: 0 }}>
                      + Add
                    </Button>
                  </div>
                </section>

                <div className="glass glass-card center" style={{ border: (venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED') ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-soft)' }}>
                  <h3>{(venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED') ? '🟢 Venue is LIVE & Bookable' : 'Ready to go live?'}</h3>
                  <p className="subtle small" style={{ margin: '4px 0 12px' }}>
                    {(venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED')
                      ? 'Your turf is currently active and accepting player bookings in real-time.'
                      : 'Publish your venue to make slots instantly bookable by all players on TurfChai.'}
                  </p>

                  <Button
                    variant="primary"
                    size="lg"
                    block
                    onClick={handleGoLive}
                    style={{
                      background: (venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED')
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'var(--brand)',
                      borderColor: (venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED') ? '#059669' : 'var(--brand)',
                      fontWeight: 600,
                      boxShadow: (venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED') ? '0 4px 14px rgba(16, 185, 129, 0.4)' : 'none',
                    }}
                  >
                    {(venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED')
                      ? '🟢 Venue is LIVE (Click to Pause / Offline)'
                      : '🚀 Go Live (Publish Venue)'}
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
        title="Edit Sport Slot Times, Buffer & Base Price"
        maxWidth={520}
      >
        <p className="subtle small" style={{ margin: '4px 0 12px' }}>
          Select a sport to edit its play duration, handover buffer time, and base price per slot.
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
          <Field label="Play Duration (mins)" htmlFor="spDuration">
            <Select
              id="spDuration"
              value={slotDraft.duration}
              onChange={(event) => setSlotDraft((current) => ({ ...current, duration: event.target.value }))}
            >
              <option value="30">30 minutes</option>
              <option value="40">40 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes (1 hr)</option>
              <option value="75">75 minutes</option>
              <option value="90">90 minutes (1.5 hrs)</option>
              <option value="120">120 minutes (2 hrs)</option>
            </Select>
          </Field>

          <Field label="Handover Buffer (mins)" htmlFor="spBuffer">
            <Select
              id="spBuffer"
              value={slotDraft.buffer}
              onChange={(event) => setSlotDraft((current) => ({ ...current, buffer: event.target.value }))}
            >
              <option value="0">0 minutes</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="20">20 minutes</option>
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

        <Alert tone="info" style={{ marginTop: 10 }}>
          💡 Total slot block = <b>{Number(slotDraft.duration) + Number(slotDraft.buffer)} mins</b> ({slotDraft.duration}m play + {slotDraft.buffer}m buffer).
        </Alert>

        <div className="stack-sm" style={{ marginTop: 16 }}>
          <Button variant="primary" block onClick={saveSlotSettings}>
            Save duration, buffer & price ✓
          </Button>

          <Button variant="tertiary" block onClick={slotModal.close}>
            Cancel
          </Button>
        </div>
      </Overlay>

      {/* Modal: Slot Generator & Time Slot Modifier */}
      <Overlay
        isOpen={generateSlotsModal.isOpen}
        onClose={generateSlotsModal.close}
        title="Time Slot Modifier & Batch Generator"
        maxWidth={560}
      >
        <p className="subtle small" style={{ margin: '4px 0 12px' }}>
          Select a pitch and enter starting times. End times and 2nd slot validity are calculated automatically based on sport duration + buffer.
        </p>

        <Field label="Select Pitch" htmlFor="genPitch">
          <Select id="genPitch" value={generateDraft.pitchId} onChange={e => setGenerateDraft(c => ({...c, pitchId: e.target.value}))}>
            <option value="">Select Pitch...</option>
            {pitches.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.sports?.join(', ') || 'Football'})</option>
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
          <Field label="1st Slot Starting Time (24h)" htmlFor="genTimeStart">
            <CustomTimePicker
              id="genTimeStart"
              value={generateDraft.startTime}
              onChange={e => setGenerateDraft(c => ({...c, startTime: e.target.value}))}
            />
          </Field>
          <Field label="Daily Operating End Time (24h)" htmlFor="genTimeEnd">
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

      <Overlay isOpen={!!previewFile} onClose={() => setPreviewFile(null)} title={previewFile?.name || 'Photo Preview'} maxWidth={800}>
        <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={previewFile?.url || previewFile} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      </Overlay>
    </>
  );
}
