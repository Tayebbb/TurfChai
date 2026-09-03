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
  Switch,
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
  Icon,
} from '@/components/common/Icon';

import { paths } from '@/routes/paths';

import { generateSlots as apiGenerateSlots } from '@/api/ownerSlots';
import { getMyTurfRequests } from '@/api/turfRequests';

function FilterPillDropdown({
  label: _label,
  value,
  onChange,
  options,
  icon,
  getOptionEmoji,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOpt = options.find((o) => o.value === value) || options[0];
  const selectedLabel = selectedOpt?.label || value;
  const currentEmoji = getOptionEmoji ? getOptionEmoji(value) : null;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: isOpen ? 'var(--brand-soft)' : 'var(--surface-2)',
          border: isOpen ? '1px solid var(--brand)' : '1px solid var(--border)',
          borderRadius: 9999,
          padding: '5px 12px 5px 10px',
          cursor: 'pointer',
          color: isOpen ? 'var(--brand-600)' : 'var(--text)',
          fontSize: 12.5,
          fontWeight: 700,
          transition: 'all var(--dur) var(--ease)',
          boxShadow: isOpen ? '0 0 0 2px var(--brand-soft)' : 'none',
          userSelect: 'none',
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {currentEmoji ? (
          <span style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            {currentEmoji}
          </span>
        ) : (
          icon && <Icon name={icon} size={13} style={{ color: 'var(--text-3)' }} />
        )}
        <span>{selectedLabel}</span>
        <Icon
          name="chevronDown"
          size={12}
          style={{
            color: 'var(--text-3)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/* Liquid-Glass Dropdown Menu with Pop Animation */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 220,
            zIndex: 100,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.24), 0 4px 12px rgba(0, 0, 0, 0.10)',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            animation: 'pop .18s var(--ease-out)',
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            const emoji = getOptionEmoji ? getOptionEmoji(opt.value) : null;

            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: isSelected ? 'var(--brand-soft)' : 'transparent',
                  color: isSelected ? 'var(--brand-600)' : 'var(--text)',
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: 12.5,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'var(--surface-2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {emoji && <span>{emoji}</span>}
                  <span>{opt.label}</span>
                </span>
                {isSelected && <Icon name="check" size={13} style={{ color: 'var(--brand)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  updateVenueStatus,
  uploadVenuePhotoApi,
  addPitch,
  updatePitch,
  deactivatePitch,
  upsertPricingRule,
  getSavedSelectedVenueId,
  saveSelectedVenueId,
  resolveActiveVenue,
} from '@/api/ownerVenues';
import { toUserMessage } from '@/utils/errorMessage';

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

// The stored values are a fixed vocabulary (ck_venues_deposit / ck_venues_cancel)
// and the refund engine switches on exactly these. The screen used to send its
// own display labels, which the column rejected.
const DEPOSIT_OPTIONS = [
  { value: 'FULL_ONLY', label: 'Full payment only' },
  { value: 'THIRTY_PERCENT', label: '30% deposit allowed' },
  { value: 'FIFTY_PERCENT', label: '50% deposit' },
];

const CANCEL_OPTIONS = [
  { value: 'FREE_24H_50_6H', label: 'Free cancel until 24h before · 50% within 24h · no refund within 6h' },
  { value: 'FLEXIBLE_6H', label: 'Flexible — free cancel until 6h before' },
  { value: 'STRICT_NO_REFUND', label: 'Strict — no refund' },
];

/**
 * The amenity vocabulary. Ids are the keys the backend stores in `amenities_csv`
 * and the player venue page maps back to labels, so they are not free to rename.
 * Nothing is on by default: what is enabled comes from the saved venue.
 */
const INITIAL_AMENITIES = [
  { id: 'floodlights', label: '💡 Floodlights', on: false },
  { id: 'parking', label: '🅿️ Parking', on: false },
  { id: 'changing', label: '👕 Changing room', on: false },
  { id: 'washroom', label: '🚿 Washroom & Shower', on: false },
  { id: 'water', label: '🚰 Drinking water', on: false },
  { id: 'kit', label: '⚽ Bibs & balls', on: false },
  { id: 'cafeteria', label: '☕ Cafeteria & Snacks', on: false },
  { id: 'firstaid', label: '🩹 First aid kit', on: false },
  { id: 'seating', label: '🪑 Dugout & Seating', on: false },
  { id: 'wifi', label: '📶 Free Wi-Fi', on: false },
  { id: 'cctv', label: '📹 24/7 CCTV Security', on: false },
  { id: 'prayer', label: '🕌 Prayer Space', on: false },
  { id: 'generator', label: '⚡ Generator Backup', on: false },
  { id: 'lockers', label: '🔒 Secure Lockers', on: false },
];

/** Popular suggested amenities for 1-click quick adding */
const POPULAR_AMENITY_PRESETS = [
  { label: '🕌 Prayer Space', id: 'prayer' },
  { label: '📹 24/7 CCTV', id: 'cctv' },
  { label: '🔒 Secure Lockers', id: 'lockers' },
  { label: '⚡ Generator Backup', id: 'generator' },
  { label: '❄️ AC Dugout / Lounge', id: 'ac_lounge' },
  { label: '🔊 Sound System', id: 'sound' },
  { label: '🔢 Scoreboard & Timer', id: 'scoreboard' },
  { label: '🏋️ Warm-up Area', id: 'warmup' },
  { label: '🔌 EV Charger', id: 'ev_charger' },
];

/** Rules are stored as free text, so these are suggestions rather than keys. */
const INITIAL_RULES = [
  { id: 'shoes', label: '👟 Turf / Astro shoes only (no metal studs)', on: false },
  { id: 'smoking', label: '🚭 No smoking or vaping inside venue', on: false },
  { id: 'arrival', label: '⏱️ Arrive 10 min before slot time', on: false },
  { id: 'trash', label: '🗑️ Keep venue clean - disposal in bins', on: false },
  { id: 'food', label: '🍕 No outside heavy food on pitch', on: false },
  { id: 'id_check', label: '🪪 ID / Booking confirmation at gate', on: false },
];

/** Popular suggested ground rules for 1-click quick adding */
const POPULAR_RULE_PRESETS = [
  '👟 Turf / Astro shoes only (no metal studs)',
  '⏱️ Arrive 10 min before slot time',
  '🚭 No smoking or vaping inside venue',
  '🗑️ Keep venue clean - disposal in bins',
  '🍕 No outside food on pitch',
  '🪪 ID / Booking confirmation at gate',
  '⏳ Overtime without booking incurs 2x rate',
  '🤝 Respect referee & opposing players',
];

/** Emoji auto-detection for user-typed custom amenities */
function detectAmenityEmoji(text) {
  if (!text) return '✨';
  const t = String(text).toLowerCase();
  if (t.includes('pray') || t.includes('namaz') || t.includes('mosque')) return '🕌';
  if (t.includes('cctv') || t.includes('camera') || t.includes('security') || t.includes('guard')) return '📹';
  if (t.includes('locker') || t.includes('storage') || t.includes('vault')) return '🔒';
  if (t.includes('shower') || t.includes('bath')) return '🚿';
  if (t.includes('washroom') || t.includes('toilet') || t.includes('restroom')) return '🚽';
  if (t.includes('light') || t.includes('led') || t.includes('flood')) return '💡';
  if (t.includes('park') || t.includes('car') || t.includes('bike')) return '🅿️';
  if (t.includes('ac') || t.includes('air') || t.includes('cool') || t.includes('lounge')) return '❄️';
  if (t.includes('cafe') || t.includes('coffee') || t.includes('tea') || t.includes('snack') || t.includes('food') || t.includes('canteen')) return '☕';
  if (t.includes('water') || t.includes('drink')) return '🚰';
  if (t.includes('sound') || t.includes('music') || t.includes('speaker') || t.includes('audio')) return '🔊';
  if (t.includes('ball') || t.includes('bib') || t.includes('kit') || t.includes('jersey')) return '⚽';
  if (t.includes('medic') || t.includes('first') || t.includes('aid') || t.includes('doctor')) return '🩹';
  if (t.includes('seat') || t.includes('dugout') || t.includes('bench') || t.includes('gallery')) return '🪑';
  if (t.includes('wifi') || t.includes('internet') || t.includes('net')) return '📶';
  if (t.includes('gen') || t.includes('power') || t.includes('electric') || t.includes('backup')) return '⚡';
  if (t.includes('score') || t.includes('board') || t.includes('timer')) return '🔢';
  if (t.includes('gym') || t.includes('fitness') || t.includes('warm')) return '🏋️';
  if (t.includes('ev') || t.includes('charge')) return '🔌';
  if (t.includes('shoe') || t.includes('boot') || t.includes('turf')) return '👟';
  return '✨';
}

/** Emoji auto-detection for user-typed custom rules */
function detectRuleEmoji(text) {
  if (!text) return '📌';
  const t = String(text).toLowerCase();
  if (t.includes('shoe') || t.includes('stud') || t.includes('cleat') || t.includes('spike') || t.includes('boot')) return '👟';
  if (t.includes('smok') || t.includes('vape') || t.includes('cigar')) return '🚭';
  if (t.includes('time') || t.includes('arrive') || t.includes('early') || t.includes('punctual')) return '⏱️';
  if (t.includes('clean') || t.includes('trash') || t.includes('bin') || t.includes('waste')) return '🗑️';
  if (t.includes('food') || t.includes('eat') || t.includes('gum') || t.includes('drink')) return '🍕';
  if (t.includes('id') || t.includes('nid') || t.includes('card')) return '🪪';
  if (t.includes('overtime') || t.includes('late') || t.includes('penalty')) return '⏳';
  if (t.includes('alcohol') || t.includes('liquor')) return '🚫';
  if (t.includes('respect') || t.includes('fair') || t.includes('foul') || t.includes('fight')) return '🤝';
  return '📌';
}

/** `"floodlights, parking"` -> `['floodlights','parking']`. */
function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Marks the catalogue against what the venue has saved, and appends anything
 * saved that the catalogue does not know about so a save cannot silently drop
 * amenities or rules entered elsewhere.
 */
function hydrateSelection(catalogue, saved, matchOn, detectEmoji) {
  const savedValues = parseCsv(saved);
  const known = catalogue.map((item) => ({
    ...item,
    on: savedValues.includes(matchOn(item)),
  }));
  const extras = savedValues
    .filter((value) => !catalogue.some((item) => matchOn(item) === value))
    .map((value) => {
      const emoji = detectEmoji ? detectEmoji(value) : '✨';
      const cleanLabel = value.replace(/^[^\w\s]+/, '').trim();
      const hasEmoji = /\p{Emoji}/u.test(value);
      return {
        id: value,
        label: hasEmoji ? value : `${emoji} ${cleanLabel || value}`,
        on: true,
        custom: true,
      };
    });
  return [...known, ...extras];
}

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
  const [loadError, setLoadError] = useState(null);

  const [pitches, setPitches] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [pitchDraft, setPitchDraft] = useState({
    name: '',
    desc: '',
    sports: ['Football'],
  });

  const [deposit, setDeposit] = useState('THIRTY_PERCENT');
  const [policy, setPolicy] = useState('FREE_24H_50_6H');
  const [mlPricing, setMlPricing] = useState(true);
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
  const [hoursDraft, setHoursDraft] = useState({ openTime: '06:00', closeTime: '23:00' });
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [customInputText, setCustomInputText] = useState('');
  const [addMode, setAddMode] = useState('amenity'); // 'amenity' | 'rule'
  const [savingAmenities, setSavingAmenities] = useState(false);
  const refreshVenueDetails = useCallback((vId) => {
    if (!vId || vId === 'null' || vId === 'undefined') return;
    setLoading(true);
    setLoadError(null);
    getOwnerVenue(vId)
      .then((res) => {
        if (res) {
          setLoadError(null);
          setVenueData(res);
          setDeposit(res.depositPolicy || 'THIRTY_PERCENT');
          setPolicy(res.cancelPolicy || 'FREE_24H_50_6H');
          setMlPricing(res.mlPricingEnabled ?? true);
          setAmenities(hydrateSelection(INITIAL_AMENITIES, res.amenities, (item) => item.id, detectAmenityEmoji));
          setRules(hydrateSelection(INITIAL_RULES, res.rules, (item) => item.label, detectRuleEmoji));
          if (res.openTime || res.closeTime) {
            setHoursDraft({
              openTime: res.openTime ? String(res.openTime).slice(0, 5) : '06:00',
              closeTime: res.closeTime ? String(res.closeTime).slice(0, 5) : '23:00',
            });
          }

          let photosList = [];
          if (Array.isArray(res.photos)) {
            photosList = res.photos;
          } else if (typeof res.photos === 'string' && res.photos.trim()) {
            try {
              const parsed = JSON.parse(res.photos);
              photosList = Array.isArray(parsed) ? parsed : res.photos.split(',');
            } catch {
              photosList = res.photos.split(',');
            }
          }
          setPhotos(photosList.filter(Boolean).map((url, idx) => ({
            id: String(idx),
            url: typeof url === 'string' ? url.trim() : (url?.url || String(url)),
            name: `Photo ${idx + 1}`,
          })));

          if (Array.isArray(res.pitches)) {
            setPitches(res.pitches.map((p) => {
              const sportsList = Array.isArray(p.sportSlugs)
                ? p.sportSlugs
                : typeof p.sportSlugs === 'string' && p.sportSlugs.trim()
                ? p.sportSlugs.trim().split(/[\s,]+/)
                : [];
              return {
                id: p.id,
                name: p.name,
                desc: [p.surfaceType, p.dimensions].filter(Boolean).join(' · ') || 'No surface or size recorded',
                sports: sportsList.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
              };
            }));
          } else {
            setPitches([]);
          }

          if (Array.isArray(res.pricingRules) && res.pricingRules.length > 0) {
            setSportPricing(res.pricingRules.map((rule) => ({
              id: rule.sportSlug || 'football',
              title: `${rule.sportSlug ? rule.sportSlug.charAt(0).toUpperCase() + rule.sportSlug.slice(1) : 'Football'}`,
              tone: rule.sportSlug === 'cricket' ? 'amber' : rule.sportSlug === 'futsal' ? 'green' : 'blue',
              duration: String(rule.slotDurationMin || 60),
              buffer: String(rule.bufferMin != null ? rule.bufferMin : 10),
              basePrice: Number(rule.rate || 2000),
            })));
          }
        }
      })
      .catch((error) => {
        // Failing silently left the owner editing default values that had never
        // been loaded, so a later save could overwrite real settings with them.
        setLoadError(toUserMessage(error, 'Could not load this venue. Reload to try again.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleVenueChange = useCallback((val) => {
    const numId = Number(val) || val;
    setSelectedVenueId(numId);
    saveSelectedVenueId(numId);
    refreshVenueDetails(numId);
  }, [refreshVenueDetails]);

  function toggleAmenity(id) {
    setAmenities((prev) =>
      prev.map((item) => (item.id === id ? { ...item, on: !item.on } : item)),
    );
  }

  function handleAddCustomAmenity(textToAdd) {
    const raw = (typeof textToAdd === 'string' ? textToAdd : customInputText).trim();
    if (!raw) return;
    const cleanText = raw.replace(/^[^\w\s]+/, '').trim();
    const emoji = detectAmenityEmoji(cleanText);
    const label = /\p{Emoji}/u.test(raw) ? raw : `${emoji} ${cleanText || raw}`;
    const slug = cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `custom_${Date.now()}`;
    
    // Check if already in list
    const existing = amenities.find((a) => a.id === slug || a.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      setAmenities((prev) => prev.map((a) => (a.id === existing.id ? { ...a, on: true } : a)));
      setCustomInputText('');
      showToast(`Activated "${existing.label}" ✓`);
      return;
    }

    const newAmenity = {
      id: slug,
      label,
      on: true,
      custom: true,
    };
    setAmenities((prev) => [...prev, newAmenity]);
    setCustomInputText('');
    showToast(`Added "${label}" ✓`);
  }

  function handleRemoveAmenity(id) {
    setAmenities((prev) => prev.filter((a) => a.id !== id));
  }

  function toggleRule(id) {
    setRules((prev) =>
      prev.map((item) => (item.id === id ? { ...item, on: !item.on } : item)),
    );
  }

  function handleAddCustomRule(textToAdd) {
    const raw = (typeof textToAdd === 'string' ? textToAdd : customInputText).trim();
    if (!raw) return;
    const cleanText = raw.replace(/^[^\w\s]+/, '').trim();
    const emoji = detectRuleEmoji(cleanText);
    const label = /\p{Emoji}/u.test(raw) ? raw : `${emoji} ${cleanText || raw}`;

    const existing = rules.find((r) => r.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      setRules((prev) => prev.map((r) => (r.id === existing.id ? { ...r, on: true } : r)));
      setCustomInputText('');
      showToast(`Activated rule "${label}" ✓`);
      return;
    }

    const newRule = {
      id: `rule-${Date.now()}`,
      label,
      on: true,
      custom: true,
    };
    setRules((prev) => [...prev, newRule]);
    setCustomInputText('');
    showToast(`Added rule "${label}" ✓`);
  }

  function handleAddNewItem() {
    const raw = customInputText.trim();
    if (!raw) return;
    if (addMode === 'amenity') {
      handleAddCustomAmenity(raw);
    } else {
      handleAddCustomRule(raw);
    }
  }

  function handleRemoveRule(id) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  /** Writes the selected amenity keys and rule text to the venue. */
  async function saveAmenitiesAndRules() {
    const vId = selectedVenueId || venueData?.id;
    if (!vId) {
      showToast('Select a venue first');
      return;
    }
    setSavingAmenities(true);
    try {
      await updateVenue(vId, {
        amenities: amenities.filter((a) => a.on).map((a) => a.id).join(','),
        rules: rules.filter((r) => r.on).map((r) => r.label).join(','),
      });
      showToast('Amenities & ground rules saved ✓');
      refreshVenueDetails(vId);
    } catch (error) {
      showToast(toUserMessage(error, 'Could not save amenities and rules.'));
    } finally {
      setSavingAmenities(false);
    }
  }

  const [generateDraft, setGenerateDraft] = useState({
    pitchId: '',
    startDate: '',
    endDate: '',
    startTime: '06:00',
    endTime: '23:00',
    slotDurationMinutes: 60,
    bufferMinutes: 10,
    basePrice: 2000
  });

  const [previewFile, setPreviewFile] = useState(null);
  const editFileInputRef = useRef(null);
  const [editingPhotoId, setEditingPhotoId] = useState(null);
  const [deactivatingPitchId, setDeactivatingPitchId] = useState(null);
  const [generatingSlots, setGeneratingSlots] = useState(false);

  async function handleSaveHours() {
    const vId = selectedVenueId || venueData?.id;
    if (!vId) {
      showToast('Select a venue first');
      return;
    }
    setSavingHours(true);
    try {
      await updateVenue(vId, {
        openTime: hoursDraft.openTime,
        closeTime: hoursDraft.closeTime,
      });
      showToast('Operating hours updated ✓');
      setIsEditingHours(false);
      refreshVenueDetails(vId);
    } catch (error) {
      showToast(toUserMessage(error, 'Failed to update operating hours'));
    } finally {
      setSavingHours(false);
    }
  }

  async function handleGenerateSlots() {
    // No busy state before: a double-click fired the batch generator twice,
    // duplicating the whole slot calendar.
    if (generatingSlots) return;
    if (!generateDraft.pitchId) {
      showToast('Select a pitch first');
      return;
    }
    setGeneratingSlots(true);
    try {
      const created = await apiGenerateSlots(generateDraft);
      const count = Array.isArray(created) ? created.length : null;
      showToast(count == null ? 'Slots generated ✓' : `${count} slot${count === 1 ? '' : 's'} generated ✓`);
      generateSlotsModal.close();
    } catch (error) {
      showToast(toUserMessage(error, 'Failed to generate slots'));
    } finally {
      setGeneratingSlots(false);
    }
  }

  const getActiveVenueId = useCallback(async () => {
    if (selectedVenueId) return selectedVenueId;
    if (venues.length > 0 && venues[0].id) {
      const activeId = resolveActiveVenue(venues);
      setSelectedVenueId(activeId);
      return activeId;
    }
    try {
      const res = await listMyVenues();
      const venueList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      if (venueList.length > 0 && venueList[0].id) {
        setVenues(venueList);
        const vId = resolveActiveVenue(venueList);
        setSelectedVenueId(vId);
        refreshVenueDetails(vId);
        return vId;
      }
      // ponytail: no silent venue auto-creation. Uploading a photo or editing a
      // section used to materialize a fake "My Venue" at hardcoded coordinates
      // with zero disclosure. Owners now create their venue explicitly.
      // Ceiling: an onboarding wizard that collects name/area before creation.
      setVenues([]);
      setSelectedVenueId(null);
    } catch (err) {
      console.error('Failed to resolve active venue', err);
    }
    return null;
  }, [selectedVenueId, venues, refreshVenueDetails]);

  /**
   * Retiring a pitch is a soft deactivate on the server: the row and its history
   * stay, it simply stops being offered. The wording says so rather than
   * promising a delete that does not happen.
   */
  async function handleDeactivatePitch(pitch) {
    if (deactivatingPitchId) return;
    const vId = await getActiveVenueId();
    if (!vId) return;
    const ok = window.confirm(
      `Retire “${pitch.name}”?\n\nIt stops being offered for new bookings. Existing bookings and history are kept.`,
    );
    if (!ok) return;
    setDeactivatingPitchId(pitch.id);
    try {
      await deactivatePitch(vId, pitch.id);
    } catch (error) {
      showToast(toUserMessage(error, 'Could not retire this pitch.'));
      return;
    } finally {
      setDeactivatingPitchId(null);
    }
    showToast(`${pitch.name} retired — no longer bookable ✓`);
    refreshVenueDetails(vId);
  }

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
          const activeId = resolveActiveVenue(venueList);
          setSelectedVenueId(activeId);
          refreshVenueDetails(activeId);
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
                  area: req.area || null,
                  openTime: null,
                  closeTime: null,
                };
                setVenues([fallbackVenue]);
                if (fallbackVenue.id) {
                  setSelectedVenueId(fallbackVenue.id);
                  refreshVenueDetails(fallbackVenue.id);
                } else {
                  setLoading(false);
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
              } else if (!unmounted) {
                setLoading(false);
              }
            })
            .catch(() => {
              if (!unmounted) setLoading(false);
            });
        }
      })
      .catch((err) => {
        if (!unmounted) {
          setLoadError(toUserMessage(err, 'Could not load your venues.'));
          setLoading(false);
        }
      });
    return () => {
      unmounted = true;
    };
  }, [refreshVenueDetails]);

  // Sync when another page/tab switches active venue
  useEffect(() => {
    const handleSync = (e) => {
      const newId = e?.detail ?? getSavedSelectedVenueId();
      if (newId && String(newId) !== String(selectedVenueId)) {
        const numId = Number(newId) || newId;
        setSelectedVenueId(numId);
        refreshVenueDetails(numId);
      }
    };
    window.addEventListener('turfchai:venue-change', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('turfchai:venue-change', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [selectedVenueId, refreshVenueDetails]);

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
    const desc = pitchDraft.desc.trim();

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
        const createdPitch = await addPitch(vId, {
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
        const rawSlugs = createdPitch?.sportSlugs;
        const sportsList = Array.isArray(rawSlugs)
          ? rawSlugs
          : typeof rawSlugs === 'string' && rawSlugs.trim()
          ? rawSlugs.trim().split(/[\s,]+/)
          : [];
        const newPitchObj = {
          id: createdPitch?.id || Date.now(),
          name: createdPitch?.name || name,
          desc: [createdPitch?.surfaceType, createdPitch?.dimensions].filter(Boolean).join(' · ') || desc,
          sports: sportsList.length > 0
            ? sportsList.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
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
    if (!vId) {
      showToast('No venue to save against yet.');
      return;
    }
    try {
      await updateVenue(vId, {
        depositPolicy: deposit,
        cancelPolicy: policy,
        mlPricingEnabled: mlPricing,
      });
    } catch (error) {
      // This used to swallow the failure and toast success anyway, so an
      // owner believed a cancellation policy was saved that never was.
      showToast(toUserMessage(error, 'Could not save the deposit & cancellation section.'));
      return;
    }
    showToast(mlPricing ? 'Deposit, cancellation & ML dynamic pricing saved (upcoming slots updated) ✓' : 'Deposit & cancellation settings saved ✓');
    refreshVenueDetails(vId);
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
          windowType: 'FULL_DAY',
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
    { id: 'open', label: 'OPEN', value: venueData?.openTime || '—' },
    { id: 'close', label: 'CLOSE', value: venueData?.closeTime || '—' },
    { id: 'buffer', label: 'BUFFER', value: '10 min' },
  ];

  // Real per-section completion — the badges below used to be hardcoded
  // green "Done"/"Configured" even with zero photos/pricing/hours.
  const photosDone = photos.length > 0;
  const pricingDone = sportPricing.some((sport) => Number(sport.basePrice) > 0);
  const hoursDone = Boolean(venueData?.openTime && venueData?.closeTime);

  // The bar used to read 83% for every unpublished venue and 100% once
  // published, regardless of what the owner had actually filled in.
  const setupSections = (() => {
    const checks = [
      Boolean(venueData?.name && venueData?.area),
      photos.length > 0,
      pitches.length > 0,
      sportPricing.some((sport) => Number(sport.basePrice) > 0),
      Boolean(venueData?.openTime && venueData?.closeTime),
      // Read from the saved venue, not the on-screen toggles. This used to count
      // hardcoded defaults, so it passed for every venue before anything was set.
      parseCsv(venueData?.amenities).length > 0 || parseCsv(venueData?.rules).length > 0,
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
  })();

  return (
    <>
      <PageTitle title="Venue setup" />

      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
            Loading venue details...
          </div>
        ) : loadError ? (
          <Alert tone="danger" icon="⚠️" title="Venue details could not be loaded">
            {loadError} Editing now would save default values over your real settings.
          </Alert>
        ) : !selectedVenueId ? (
          /* No venue yet: sections used to auto-create a placeholder "My
             Venue" on first interaction — explicit creation instead. */
          <div className="card center" style={{ padding: '48px 24px' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Create your venue to start</h2>
            <p className="subtle small" style={{ margin: '0 0 20px' }}>
              Add your first venue, then set up pitches, pricing, photos and hours here.
            </p>
            <Button variant="primary" to={paths.owner.onboarding}>
              Start venue onboarding
            </Button>
          </div>
        ) : (
          <>
            {venueData?.status === 'PUBLISHED' || venueData?.status === 'LIVE' ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: '8px 14px',
                  borderRadius: 'var(--r-md)',
                  background: 'rgba(16, 185, 129, 0.07)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ fontSize: 12 }}>🟢</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>
                    {venueData?.name || 'Venue'} is LIVE
                  </span>
                  <span className="subtle small" style={{ display: 'inline-block' }}>
                    · Accepting player bookings in real time
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={handleGoLive}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-2)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      minHeight: 36,
                      transition: 'all 0.15s ease',
                      font: 'inherit',
                    }}
                    title="Pause live bookings and set venue offline"
                  >
                    <span>⏸️</span>
                    <span>Set Offline</span>
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    to={venueData?.slug ? paths.player.venue(venueData.slug) : undefined}
                    state={{ returnTo: paths.owner.venueSetup }}
                    disabled={!venueData?.slug}
                    title={venueData?.slug ? undefined : 'Save venue first to preview'}
                    style={{
                      padding: '3px 9px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      borderRadius: 'var(--r-sm)',
                    }}
                  >
                    👀 Player View
                  </Button>
                </div>
              </div>
            ) : venueData?.verified || venueData?.status === 'APPROVED' || venueData?.status === 'PENDING_LISTING' ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: '8px 14px',
                  borderRadius: 'var(--r-md)',
                  background: 'rgba(59, 130, 246, 0.07)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ fontSize: 12 }}>✓</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>
                    {venueData?.name || 'Venue'} is Approved
                  </span>
                  <span className="subtle small">
                    · Ready to go live for player bookings
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleGoLive}
                    style={{
                      padding: '3px 10px',
                      fontSize: 11.5,
                      fontWeight: 700,
                      borderRadius: 'var(--r-sm)',
                    }}
                  >
                    🚀 Go Live
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    to={venueData?.slug ? paths.player.venue(venueData.slug) : undefined}
                    state={{ returnTo: paths.owner.venueSetup }}
                    disabled={!venueData?.slug}
                    title={venueData?.slug ? undefined : 'Save venue first to preview'}
                    style={{
                      padding: '3px 9px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      borderRadius: 'var(--r-sm)',
                    }}
                  >
                    👀 Player View
                  </Button>
                </div>
              </div>
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
                    <FilterPillDropdown
                      label="Turf"
                      value={selectedVenueId}
                      onChange={handleVenueChange}
                      options={venues.map((v) => ({
                        value: v.id,
                        label: `${v.name}${v.area ? ` · ${v.area}` : ''}`,
                      }))}
                      getOptionEmoji={() => '🏟️'}
                    />
                  )}
                  <Badge tone={venueData?.status === 'PUBLISHED' || venueData?.status === 'LIVE' ? 'green' : (venueData?.status === 'APPROVED' || venueData?.status === 'PENDING_LISTING' || venueData?.verified) ? 'blue' : venueData?.status === 'REJECTED' ? 'red' : 'amber'}>
                    {venueData?.status === 'LIVE' || venueData?.status === 'PUBLISHED' ? '🟢 LIVE · Bookable by Players' : (venueData?.status === 'APPROVED' || venueData?.status === 'PENDING_LISTING' || venueData?.verified) ? '✓ Verified · Ready to Go Live' : venueData?.status === 'REJECTED' ? '✕ Rejected' : '⏳ Pending — not visible to players'}
                  </Badge>

                  <span className="subtle small">
                    {setupSections.done} of {setupSections.total} sections complete
                  </span>
                </div>
              </div>

              <div className="row">
                <div className="progress" style={{ width: 160 }}>
                  <i style={{ width: `${setupSections.percent}%` }} />
                </div>
                <b className="num small">{setupSections.percent}%</b>
              </div>
            </div>

            <div className="grid2" style={{ alignItems: 'start' }}>
              <div className="stack">
                <section className="card">
                  <div className="between">
                    <h3 style={{ margin: 0 }}>📷 Photos</h3>
                    <Badge tone={photosDone ? 'green' : 'gray'} dot={false}>
                      {photosDone ? `${photos.length} uploaded` : 'Not set'}
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
                          <div style={{ position: 'absolute', top: -8, right: -8, display: 'flex', gap: 2, background: 'rgba(0,0,0,0.7)', padding: 2, borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                            <button
                              type="button"
                              title="Replace photo"
                              aria-label="Replace photo"
                              onClick={(e) => { e.stopPropagation(); setEditingPhotoId(p.id || p.url); editFileInputRef.current?.click(); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, padding: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, minHeight: 32 }}
                            >✏️</button>
                            <button
                              type="button"
                              title="Delete photo"
                              aria-label="Delete photo"
                              onClick={(e) => { e.stopPropagation(); handleDeletePhoto(p.id || p.url); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff5555', fontSize: 11, padding: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, minHeight: 32 }}
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

                          <div className="row" style={{ gap: 6 }}>
                            <Button size="sm" variant="tertiary" onClick={() => openEditPitch(pitch)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghostDanger"
                              disabled={deactivatingPitchId === pitch.id}
                              onClick={() => handleDeactivatePitch(pitch)}
                            >
                              {deactivatingPitchId === pitch.id ? 'Retiring…' : 'Retire'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '16px 0', color: 'var(--text-3)', fontSize: 14 }}>
                      No pitches added yet. Add a pitch to get started.
                    </div>
                  )}

                  <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
                    <Button size="sm" onClick={openAddPitch}>
                      + Add pitch
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pitches.length === 0}
                      title={pitches.length === 0 ? 'Add a pitch first' : 'Create bookable slots for a date range'}
                      onClick={generateSlotsModal.open}
                    >
                      🗓️ Generate slots
                    </Button>
                  </div>
                </section>

                <section className="card">
                  <div className="between">
                    <h3 style={{ margin: 0 }}>💰 Pricing &amp; Slot Durations by Sport</h3>
                    <Badge tone={pricingDone ? 'green' : 'gray'} dot={false}>
                      {pricingDone ? 'Configured' : 'Not set'}
                    </Badge>
                  </div>

                  <p className="subtle small" style={{ margin: '6px 0 10px' }}>
                    Set one base price per sport. TurfChai prices each slot around it automatically.
                  </p>

                  <div className="grid2" style={{ gap: 10, marginBottom: 12 }}>
                    {sportPricing.map((sport) => (
                      <button
                        type="button"
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
                          textAlign: 'left',
                          font: 'inherit',
                          color: 'inherit',
                          width: '100%',
                        }}
                        title={`Edit ${sport.title} time duration, buffer & base price`}
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
                      </button>
                    ))}
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
                    <div className="row" style={{ gap: 6 }}>
                      {!isEditingHours ? (
                        <Button size="sm" variant="tertiary" onClick={() => setIsEditingHours(true)}>
                          ✏️ Edit hours
                        </Button>
                      ) : null}
                      <Badge tone={hoursDone ? 'green' : 'gray'} dot={false}>
                        {hoursDone ? 'Done' : 'Not set'}
                      </Badge>
                    </div>
                  </div>

                  {!isEditingHours ? (
                    <div className="grid3" style={{ marginTop: 10, gap: 10 }}>
                      {hoursList.map((item) => (
                        <div className="panel" key={item.id}>
                          <span className="tiny subtle">{item.label}</span>
                          <br />
                          <b className="num">{item.value}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: 12 }}>
                      <div className="grid2" style={{ gap: 10 }}>
                        <Field label="Open Time (24h)" htmlFor="hoursOpen">
                          <CustomTimePicker
                            id="hoursOpen"
                            value={hoursDraft.openTime}
                            onChange={(e) => setHoursDraft((c) => ({ ...c, openTime: e.target.value }))}
                          />
                        </Field>
                        <Field label="Close Time (24h)" htmlFor="hoursClose">
                          <CustomTimePicker
                            id="hoursClose"
                            value={hoursDraft.closeTime}
                            onChange={(e) => setHoursDraft((c) => ({ ...c, closeTime: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <div className="row" style={{ marginTop: 12, gap: 8 }}>
                        <Button size="sm" variant="primary" loading={savingHours} disabled={savingHours} onClick={handleSaveHours}>
                          Save hours ✓
                        </Button>
                        <Button size="sm" variant="tertiary" onClick={() => setIsEditingHours(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <div className="stack">
                <section className="card">
                  <div className="between">
                    <h3 style={{ margin: 0 }}>🧾 Deposit &amp; cancellation</h3>
                    {/* Defaults are a real server-side choice, so this section
                        is genuinely configured once loaded. */}
                    <Badge tone="green" dot={false}>
                      Configured
                    </Badge>
                  </div>

                  <div className="field" style={{ marginTop: 10 }}>
                    <label>Booking deposit</label>
                    <div className="row-wrap">
                      {DEPOSIT_OPTIONS.map((option) => (
                        <Chip
                          key={option.value}
                          active={deposit === option.value}
                          onToggle={() => setDeposit(option.value)}
                        >
                          {option.label}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <Field label="Cancellation policy" htmlFor="cxl">
                    <Select id="cxl" value={policy} onChange={(event) => setPolicy(event.target.value)}>
                      {CANCEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <hr style={{ border: 0, borderTop: '1px solid var(--border-soft)', margin: '16px 0 14px' }} />

                  <div className="between" style={{ alignItems: 'flex-start', gap: 14, background: 'var(--surface-1)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-soft)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <b className="small" style={{ fontSize: 13.5 }}>🤖 ML Dynamic Pricing Model</b>
                        <Badge tone={mlPricing ? 'green' : 'gray'} dot={false}>
                          {mlPricing ? 'ON' : 'OFF'}
                        </Badge>
                      </div>
                      <p className="tiny subtle" style={{ margin: 0, lineHeight: 1.4 }}>
                        When enabled, AI dynamically calculates pricing for all <b>upcoming slots</b> using peak windows, weather, and live occupancy. Past and completed slots stay untouched.
                      </p>
                    </div>
                    <Switch
                      label="Toggle ML Dynamic Pricing for upcoming slots"
                      checked={mlPricing}
                      onChange={(e) => setMlPricing(e.target.checked)}
                    />
                  </div>

                  <Button size="sm" variant="primary" style={{ marginTop: 14 }} onClick={saveDepositSection}>
                    Save section
                  </Button>
                </section>

                <section className="card">
                  <div className="between">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>📋</span>
                      <h3 style={{ margin: 0, fontSize: 16 }}>Amenities &amp; Rules</h3>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Badge tone="green" dot={false} style={{ fontSize: 11 }}>
                        {amenities.filter((a) => a.on).length} Facilities
                      </Badge>
                      <Badge tone="blue" dot={false} style={{ fontSize: 11 }}>
                        {rules.filter((r) => r.on).length} Rules
                      </Badge>
                    </div>
                  </div>

                  <p className="subtle small" style={{ margin: '4px 0 12px' }}>
                    Toggle facilities and ground rules displayed to players.
                  </p>

                  {/* Facilities Chips */}
                  <div style={{ marginBottom: 14 }}>
                    <div className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                      Turf Facilities
                    </div>
                    <div className="row-wrap" style={{ gap: 6 }}>
                      {amenities.map((amenity) => {
                        const isActive = amenity.on;
                        return (
                          <button
                            type="button"
                            key={amenity.id}
                            aria-pressed={isActive}
                            onClick={() => toggleAmenity(amenity.id)}
                            style={{
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 10px',
                              minHeight: 34,
                              borderRadius: 9999,
                              background: isActive ? 'var(--brand-soft)' : 'var(--surface-2)',
                              border: isActive ? '1px solid var(--brand)' : '1px solid var(--border)',
                              color: isActive ? 'var(--brand-600)' : 'var(--text)',
                              fontSize: 12,
                              fontWeight: isActive ? 700 : 500,
                              userSelect: 'none',
                              transition: 'all 0.15s ease',
                              font: 'inherit',
                            }}
                          >
                            <span>{amenity.label}</span>
                            {isActive ? <span style={{ fontSize: 11, fontWeight: 800 }}>✓</span> : null}
                            {amenity.custom ? (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveAmenity(amenity.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveAmenity(amenity.id);
                                  }
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-3)',
                                  cursor: 'pointer',
                                  padding: '4px 2px',
                                  fontSize: 10,
                                  lineHeight: 1,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                                title="Remove"
                                aria-label={`Remove ${amenity.label}`}
                              >
                                ✕
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rules Chips */}
                  <div style={{ marginBottom: 14 }}>
                    <div className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                      Ground Rules
                    </div>
                    <div className="stack-sm" style={{ gap: 5 }}>
                      {rules.map((rule) => {
                        const isActive = rule.on;
                        return (
                          <button
                            type="button"
                            key={rule.id}
                            aria-pressed={isActive}
                            onClick={() => toggleRule(rule.id)}
                            style={{
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 'var(--r-sm)',
                              background: isActive ? 'var(--brand-soft)' : 'var(--surface-1)',
                              border: isActive ? '1px solid var(--brand-soft)' : '1px solid var(--border-soft)',
                              color: isActive ? 'var(--text-1)' : 'var(--text-3)',
                              fontSize: 12.5,
                              userSelect: 'none',
                              transition: 'all 0.15s ease',
                              font: 'inherit',
                              textAlign: 'left',
                            }}
                          >
                            {/* Strike implied deleted; Off label carries state. */}
                            <span>{rule.label}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'var(--brand-600)' : 'var(--text-3)' }}>
                                {isActive ? '✓ Active' : 'Off'}
                              </span>
                              {rule.custom ? (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveRule(rule.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleRemoveRule(rule.id);
                                    }
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-3)',
                                    cursor: 'pointer',
                                    padding: '4px 2px',
                                    fontSize: 11,
                                    lineHeight: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                  }}
                                  title="Delete"
                                  aria-label={`Delete rule ${rule.label}`}
                                >
                                  ✕
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <hr style={{ border: 0, borderTop: '1px solid var(--border-soft)', margin: '12px 0' }} />

                  {/* 1 Unified Add Bar with Toggle Switcher */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="between">
                      <span className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                        Add New Item
                      </span>
                      {/* Toggle Button for Mode */}
                      <div
                        style={{
                          display: 'inline-flex',
                          background: 'var(--surface-2)',
                          borderRadius: 9999,
                          padding: 2,
                          border: '1px solid var(--border-soft)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setAddMode('amenity')}
                          style={{
                            border: 'none',
                            background: addMode === 'amenity' ? 'var(--brand)' : 'transparent',
                            color: addMode === 'amenity' ? '#ffffff' : 'var(--text-2)',
                            borderRadius: 9999,
                            padding: '3px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          🌟 Facility
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddMode('rule')}
                          style={{
                            border: 'none',
                            background: addMode === 'rule' ? 'var(--brand)' : 'transparent',
                            color: addMode === 'rule' ? '#ffffff' : 'var(--text-2)',
                            borderRadius: 9999,
                            padding: '3px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          📜 House Rule
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input
                        placeholder={
                          addMode === 'amenity'
                            ? 'Type facility name (e.g. Prayer Room, Lockers)...'
                            : 'Type house rule (e.g. Astro shoes only)...'
                        }
                        value={customInputText}
                        onChange={(e) => setCustomInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNewItem()}
                        style={{ fontSize: 13 }}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleAddNewItem}
                        style={{ flexShrink: 0, fontWeight: 700 }}
                      >
                        + Add {addMode === 'amenity' ? 'Facility' : 'Rule'}
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    block
                    style={{ marginTop: 14 }}
                    loading={savingAmenities}
                    disabled={savingAmenities}
                    onClick={saveAmenitiesAndRules}
                  >
                    Save amenities &amp; rules ✓
                  </Button>
                </section>
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
          Your venue is now visible in Explore and your slots are bookable. Keep an eye on the
          bookings page — new reservations appear there.
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
              <option key={p.id} value={p.id}>{p.name}{p.sports?.length ? ` (${p.sports.join(', ')})` : ''}</option>
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
          <Field label="Buffer (mins)" htmlFor="genBuffer">
            <Input id="genBuffer" type="number" min="0" value={generateDraft.bufferMinutes} onChange={e => setGenerateDraft(c => ({...c, bufferMinutes: e.target.value}))} />
          </Field>
        </div>

        <Field label="Base Price (৳)" htmlFor="genPrice">
          <Input id="genPrice" type="number" min="0" value={generateDraft.basePrice} onChange={e => setGenerateDraft(c => ({...c, basePrice: e.target.value}))} />
        </Field>

        <div className="stack-sm" style={{ marginTop: 16 }}>
          <Button
            variant="primary"
            block
            onClick={handleGenerateSlots}
            loading={generatingSlots}
            disabled={generatingSlots}
          >
            {generatingSlots ? 'Generating…' : 'Generate Slots'}
          </Button>
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
