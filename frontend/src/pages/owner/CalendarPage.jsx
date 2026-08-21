import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { Field, Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { ManualBookingModal } from '@/components/modals/ManualBookingModal';
import { PageTitle } from '@/components/common/PageTitle';
import { Icon } from '@/components/common/Icon';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import {
  listMyVenues,
  getOwnerCalendar,
  blockOwnerSlot,
  unblockOwnerSlot,
  getSavedSelectedVenueId,
  saveSelectedVenueId,
  resolveActiveVenue,
} from '@/api/ownerVenues';
import { cancelOwnerBooking } from '@/api/ownerBookings';
import { updateSlot } from '@/api/ownerSlots';
import { getPricingQuote } from '@/api/pricing';
import { checkInBooking } from '@/api/bookings';
import { canCall, callNumber } from '@/utils/deviceActions';
import { toUserMessage } from '@/utils/errorMessage';

function toIsoDateTime(dateStr, timeStr) {
  if (!timeStr) return `${dateStr}T16:00:00`;
  const clean = timeStr.trim();
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = match12[2];
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    const hh = String(hours).padStart(2, '0');
    return `${dateStr}T${hh}:${mins}:00`;
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const hh = String(match24[1]).padStart(2, '0');
    const mm = match24[2];
    return `${dateStr}T${hh}:${mm}:00`;
  }
  return `${dateStr}T16:00:00`;
}

function getSportEmoji(sport) {
  if (!sport) return '⚽';
  const s = String(sport).toLowerCase();
  if (s.includes('cricket')) return '🏏';
  if (s.includes('badminton')) return '🏸';
  if (s.includes('tennis')) return '🎾';
  if (s.includes('basketball')) return '🏀';
  if (s.includes('volleyball')) return '🏐';
  if (s.includes('padel')) return '🎾';
  if (s.includes('futsal') || s.includes('football') || s.includes('soccer')) return '⚽';
  return '🏆';
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7; // Monday = 0, Sunday = 6
}

function CalendarPopover({ isOpen, onClose, selectedDate, onSelectDate, containerRef }) {
  const [viewYear, setViewYear] = useState(() => selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDate.getMonth());
  const popoverRef = useRef(null);

  useEffect(() => {
    queueMicrotask(() => {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    });
  }, [selectedDate, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      const container = containerRef?.current || popoverRef.current;
      if (container && !container.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose, containerRef]);

  if (!isOpen) return null;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  function prevMonth(e) {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth(e) {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayIndex = getFirstDayOfMonth(viewYear, viewMonth);
  const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);

  const today = new Date();
  const isSelectedSame = (d, m, y) =>
    selectedDate.getDate() === d &&
    selectedDate.getMonth() === m &&
    selectedDate.getFullYear() === y;

  const isTodayDate = (d, m, y) =>
    today.getDate() === d &&
    today.getMonth() === m &&
    today.getFullYear() === y;

  const cells = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: dayNum, month: prevM, year: prevY, isOtherMonth: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: viewMonth, year: viewYear, isOtherMonth: false });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: d, month: nextM, year: nextY, isOtherMonth: true });
  }

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        zIndex: 100,
        width: 310,
        maxWidth: '92vw',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--r-xl)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.24), 0 4px 14px rgba(0, 0, 0, 0.12)',
        padding: 16,
        animation: 'pop .2s var(--ease-out)',
      }}
    >
      {/* Popover Header */}
      <div className="between" style={{ marginBottom: 12, alignItems: 'center' }}>
        <button
          type="button"
          className="icon-btn"
          onClick={prevMonth}
          style={{ width: 30, height: 30 }}
          aria-label="Previous Month"
        >
          <Icon name="chevronLeft" size={14} />
        </button>
        <span style={{ fontWeight: 800, fontSize: 14.5 }}>
          {monthNames[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={nextMonth}
          style={{ width: 30, height: 30 }}
          aria-label="Next Month"
        >
          <Icon name="chevronRight" size={14} />
        </button>
      </div>

      {/* Weekday headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          textAlign: 'center',
          gap: 2,
          marginBottom: 6,
        }}
      >
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
          <div key={day} className="tiny subtle" style={{ fontWeight: 700, padding: '2px 0' }}>
            {day}
          </div>
        ))}
      </div>

      {/* Day Cells Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 3,
        }}
      >
        {cells.map((c, idx) => {
          const isSelected = isSelectedSame(c.day, c.month, c.year);
          const isToday = isTodayDate(c.day, c.month, c.year);

          return (
            <button
              key={`${c.year}-${c.month}-${c.day}-${idx}`}
              type="button"
              onClick={() => {
                onSelectDate(new Date(c.year, c.month, c.day));
                onClose();
              }}
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                border: isToday && !isSelected ? '1.5px solid var(--brand)' : '1px solid transparent',
                background: isSelected ? 'var(--brand)' : 'transparent',
                color: isSelected
                  ? '#ffffff'
                  : c.isOtherMonth
                    ? 'var(--text-3)'
                    : 'var(--text)',
                fontWeight: isSelected || isToday ? 800 : 600,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 2px 8px rgba(14,122,74,0.35)' : 'none',
              }}
            >
              {c.day}
            </button>
          );
        })}
      </div>

      {/* Popover Footer */}
      <div className="between" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', alignItems: 'center' }}>
        <Button
          size="sm"
          variant="tertiary"
          onClick={() => {
            onSelectDate(new Date());
            onClose();
          }}
          style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700 }}
        >
          Jump to Today
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onClose}
          style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700 }}
        >
          Close
        </Button>
      </div>
    </div>
  );
}

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
            right: 0,
            minWidth: 175,
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

function formatDateIso(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateDisplay(dateObj) {
  const isToday = formatDateIso(dateObj) === formatDateIso(new Date());
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const str = dateObj.toLocaleDateString('en-US', options);
  return isToday ? `${str} (Today)` : str;
}

function getWeekDays(baseDate) {
  const days = [];
  const start = new Date(baseDate);
  const dayOfWeek = start.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7; // Monday start
  start.setDate(start.getDate() - diffToMonday);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarPage() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const detailModal = useDisclosure(false);
  const manualModal = useDisclosure(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarPickerContainerRef = useRef(null);

  useEffect(() => {
    if (searchParams.get('action') === 'manual-booking') {
      showToast('Select any available slot to record a walk-in booking.');
    }
  }, [searchParams, showToast]);

  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [date, setDate] = useState(() => new Date());
  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [pitches, setPitches] = useState([]);
  const [selectedPitchFilter, setSelectedPitchFilter] = useState('ALL');
  const [selectedSportFilter, setSelectedSportFilter] = useState('ALL');
  const [rows, setRows] = useState([]);
  const [weekData, setWeekData] = useState({}); // { [dateIso]: { pitches: [], rows: [] } }
  const [loading, setLoading] = useState(true);
  const [calendarError, setCalendarError] = useState(null);

  // Selected slot state for detail drawer & actions
  const [selectedCell, setSelectedCell] = useState(null);
  const [targetCellForBooking, setTargetCellForBooking] = useState(null);
  const [slotActionBusy, setSlotActionBusy] = useState(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const dateStr = formatDateIso(date);
  const weekDays = useMemo(() => getWeekDays(date), [date]);

  // Load venues on mount
  useEffect(() => {
    let cancelled = false;
    listMyVenues()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setVenues(list);
        if (list.length > 0) {
          const activeId = resolveActiveVenue(list);
          setSelectedVenueId(activeId);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setCalendarError(toUserMessage(err, 'Failed to load your venues.'));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync active venue when changed from other pages or tabs
  useEffect(() => {
    const handleSync = (e) => {
      const newId = e?.detail ?? getSavedSelectedVenueId();
      if (newId && String(newId) !== String(selectedVenueId)) {
        const numId = Number(newId) || newId;
        setSelectedVenueId(numId);
      }
    };
    window.addEventListener('turfchai:venue-change', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('turfchai:venue-change', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [selectedVenueId]);

  // Fetch Calendar Data (Day or Week)
  const refreshCalendar = useCallback(async () => {
    if (!selectedVenueId) return;
    queueMicrotask(() => {
      setLoading(true);
      setCalendarError(null);
    });

    try {
      if (viewMode === 'day') {
        const cal = await getOwnerCalendar(selectedVenueId, dateStr);
        setPitches(Array.isArray(cal?.pitches) ? cal.pitches : []);
        setRows(Array.isArray(cal?.rows) ? cal.rows : []);
      } else {
        // Fetch 7 days for the week
        const promises = weekDays.map((d) => {
          const dIso = formatDateIso(d);
          return getOwnerCalendar(selectedVenueId, dIso)
            .then((res) => ({ dateIso: dIso, data: res }))
            .catch(() => ({ dateIso: dIso, data: { pitches: [], rows: [] } }));
        });
        const results = await Promise.all(promises);
        const nextWeekData = {};
        results.forEach(({ dateIso, data }) => {
          nextWeekData[dateIso] = data || { pitches: [], rows: [] };
        });
        setWeekData(nextWeekData);

        // Keep pitches synced from first non-empty day
        const firstDayWithPitches = results.find((r) => r.data?.pitches?.length > 0);
        if (firstDayWithPitches) {
          setPitches(firstDayWithPitches.data.pitches);
        }
      }
    } catch (err) {
      setCalendarError(toUserMessage(err, 'Failed to load calendar schedule.'));
    } finally {
      setLoading(false);
    }
  }, [selectedVenueId, dateStr, viewMode, weekDays]);

  useEffect(() => {
    let unmounted = false;
    queueMicrotask(() => {
      if (!unmounted) {
        refreshCalendar();
      }
    });
    return () => {
      unmounted = true;
    };
  }, [refreshCalendar]);

  // Distinct sports extracted from pitches
  const availableSports = useMemo(() => {
    const set = new Set();
    pitches.forEach((p) => {
      if (Array.isArray(p.sports)) {
        p.sports.forEach((s) => set.add(s));
      }
    });
    return Array.from(set);
  }, [pitches]);

  // Currently selected venue object
  const selectedVenue = useMemo(
    () => venues.find((v) => Number(v.id) === Number(selectedVenueId)),
    [venues, selectedVenueId],
  );
  const isMlPricingActive = Boolean(selectedVenue?.mlPricingEnabled);

  // Filtered pitch headers
  const filteredPitches = useMemo(() => {
    return pitches.filter((p) => {
      if (selectedPitchFilter !== 'ALL' && String(p.id) !== String(selectedPitchFilter)) {
        return false;
      }
      if (selectedSportFilter !== 'ALL') {
        const hasSport = Array.isArray(p.sports) && p.sports.some((s) => s.toLowerCase() === selectedSportFilter.toLowerCase());
        if (!hasSport) return false;
      }
      return true;
    });
  }, [pitches, selectedPitchFilter, selectedSportFilter]);

  // Calendar Day KPI Stats
  const dayStats = useMemo(() => {
    let total = 0;
    let available = 0;
    let booked = 0;
    let held = 0;
    let blocked = 0;
    let revenue = 0;

    rows.forEach((row) => {
      row.cells?.forEach((c) => {
        total++;
        if (c.status === 'BOOKED') {
          booked++;
          revenue += Number(c.price || 0);
        } else if (c.status === 'HELD') {
          held++;
        } else if (c.status === 'BLOCKED') {
          blocked++;
        } else {
          available++;
        }
      });
    });

    const occupancyRate = total > 0 ? Math.round((booked / total) * 100) : 0;

    return { total, available, booked, held, blocked, revenue, occupancyRate };
  }, [rows]);

  // Navigation handlers
  function handlePrev() {
    setDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'day') next.setDate(next.getDate() - 1);
      else next.setDate(next.getDate() - 7);
      return next;
    });
  }

  function handleNext() {
    setDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'day') next.setDate(next.getDate() + 1);
      else next.setDate(next.getDate() + 7);
      return next;
    });
  }

  function handleToday() {
    setDate(new Date());
  }

  function handleDateInputChange(e) {
    if (!e.target.value) return;
    const [year, month, day] = e.target.value.split('-').map(Number);
    setDate(new Date(year, month - 1, day));
  }

  // Open Slot Detail Drawer
  function handleSlotClick(cell, timeLabel) {
    const pitch = pitches.find((p) => String(p.id) === String(cell.pitchId));
    const startTime = cell.startTime || timeLabel || '16:00';
    const endTime = cell.endTime || '';
    const duration = cell.durationMinutes || 90;
    const sport = cell.sport || (pitch?.sports?.[0]) || 'Football';

    setSelectedCell({
      ...cell,
      timeLabel: startTime,
      startTime,
      endTime,
      durationMinutes: duration,
      sport,
      pitchName: pitch?.name || `Pitch ${cell.pitchId}`,
      pitchSize: pitch?.sizeLabel || 'Standard Pitch',
    });

    setPriceDraft(String(cell.price || 2000));
    setAiSuggestion(null);
    detailModal.open();

    // Fetch dynamic AI price quote for available slots ONLY if ML pricing is not globally active
    if (cell.status === 'AVAILABLE' && selectedVenueId && !isMlPricingActive) {
      setAiSuggestion('loading');
      const bookingDateTime = toIsoDateTime(dateStr, startTime);
      const now = new Date();
      const slotDate = new Date(dateStr);
      const diffDays = Math.max(0, Math.ceil((slotDate - now) / (1000 * 60 * 60 * 24)));
      const occRate = dayStats.total > 0 ? Number((dayStats.booked / dayStats.total).toFixed(2)) : 0.7;

      getPricingQuote({
        venueId: selectedVenueId,
        bookingDateTime,
        daysBeforeBooking: diffDays,
        occupancyRate: occRate,
        sportSlug: sport.toLowerCase(),
      })
        .then((quote) => {
          if (quote && (quote.suggestedPrice || quote.recommendedPrice || quote.finalPrice)) {
            setAiSuggestion({
              suggestedPrice: quote.suggestedPrice || quote.recommendedPrice || quote.finalPrice,
              multiplier: quote.multiplier || 1.0,
              baseRate: quote.baseRate || cell.price || 2000,
            });
          } else {
            setAiSuggestion('unavailable');
          }
        })
        .catch(() => setAiSuggestion('unavailable'));
    }
  }

  // Save Price action
  async function handleSavePrice() {
    if (!selectedCell?.slotId) {
      showToast('Cannot change price on an unseeded slot.');
      return;
    }
    const newPrice = Number(priceDraft);
    if (!newPrice || newPrice <= 0) {
      showToast('Please enter a valid price amount.');
      return;
    }

    setSavingPrice(true);
    try {
      await updateSlot(selectedCell.slotId, { price: newPrice });
      showToast(`Slot price updated to ৳${newPrice.toLocaleString()} ✓`);
      setSelectedCell((prev) => (prev ? { ...prev, price: newPrice } : prev));
      refreshCalendar();
    } catch (err) {
      showToast(toUserMessage(err, 'Failed to update slot price.'));
    } finally {
      setSavingPrice(false);
    }
  }

  // Block / Unblock slot
  async function handleToggleBlock() {
    if (!selectedVenueId || !selectedCell?.slotId) {
      showToast('Slot ID not found.');
      return;
    }
    const isBlocked = selectedCell.status === 'BLOCKED';
    setSlotActionBusy(isBlocked ? 'unblocking' : 'blocking');

    try {
      if (isBlocked) {
        await unblockOwnerSlot(selectedVenueId, selectedCell.slotId);
        showToast('Slot unblocked and available for bookings ✓');
      } else {
        await blockOwnerSlot(selectedVenueId, selectedCell.slotId, 'Maintenance');
        showToast('Slot blocked for maintenance ✓');
      }
      detailModal.close();
      refreshCalendar();
    } catch (err) {
      showToast(toUserMessage(err, `Failed to ${isBlocked ? 'unblock' : 'block'} slot.`));
    } finally {
      setSlotActionBusy(null);
    }
  }

  // Check in customer
  async function handleCheckIn() {
    if (!selectedCell?.bookingId) {
      showToast('Booking record not found.');
      return;
    }
    setSlotActionBusy('checkin');
    try {
      await checkInBooking(selectedCell.bookingId);
      showToast('Customer checked in successfully ✓');
      setSelectedCell((prev) => (prev ? { ...prev, checkedIn: true } : prev));
      refreshCalendar();
    } catch (err) {
      showToast(toUserMessage(err, 'Failed to check in booking.'));
    } finally {
      setSlotActionBusy(null);
    }
  }

  // Cancel booking
  async function handleCancelBooking() {
    if (!selectedCell?.bookingId) return;
    if (!window.confirm('Are you sure you want to cancel this booking? This will free the slot for other players.')) {
      return;
    }
    setSlotActionBusy('cancelling');
    try {
      await cancelOwnerBooking(selectedCell.bookingId, 'Cancelled by pitch owner');
      showToast('Booking cancelled and slot made available ✓');
      detailModal.close();
      refreshCalendar();
    } catch (err) {
      showToast(toUserMessage(err, 'Failed to cancel booking.'));
    } finally {
      setSlotActionBusy(null);
    }
  }

  // Open manual booking modal
  function handleOpenManualBooking() {
    if (!selectedCell) return;
    setTargetCellForBooking({
      pitchId: selectedCell.pitchId,
      date: dateStr,
      time: selectedCell.startTime,
      price: selectedCell.price,
      slotId: selectedCell.slotId,
    });
    detailModal.close();
    manualModal.open();
  }

  return (
    <div className="owner-page-wrap">
      <PageTitle title="Calendar & Slot Schedule | TurfChai Owner" />

      {/* Header & Controls Bar */}
      <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div className="breadcrumbs">
            <a href={paths.ownerDashboard}>Owner Portal</a>
            <span className="sep">/</span>
            <span>Calendar</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(22px, 3.5vw, 28px)', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="calendar" size={26} style={{ color: 'var(--brand)' }} />
            <span>Pitch Schedule &amp; Slots</span>
          </h1>
          <p className="subtle small" style={{ margin: '4px 0 0' }}>
            Live scheduling grid, walk-in bookings, dynamic pricing, and maintenance management.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {venues.length > 1 && (
            <FilterPillDropdown
              label="Turf"
              value={selectedVenueId}
              onChange={(val) => {
                const num = Number(val) || val;
                setSelectedVenueId(num);
                saveSelectedVenueId(num);
              }}
              options={venues.map((v) => ({
                value: v.id,
                label: `${v.name}${v.area ? ` · ${v.area}` : ''}`,
              }))}
              getOptionEmoji={() => '🏟️'}
            />
          )}

          {/* Fluid View Mode Pill Switcher (UI/UX Pro Max) */}
          <div className="view-pill-track">
            <div
              className="view-pill-indicator"
              style={{
                transform: viewMode === 'day' ? 'translateX(0%)' : 'translateX(100%)',
              }}
            />
            <button
              type="button"
              className="view-pill-btn"
              onClick={() => setViewMode('day')}
              style={{
                color: viewMode === 'day' ? '#ffffff' : 'var(--text-2)',
              }}
            >
              <Icon name="calendar" size={13} style={{ color: viewMode === 'day' ? '#ffffff' : 'var(--text-3)' }} />
              <span>Day View</span>
            </button>
            <button
              type="button"
              className="view-pill-btn"
              onClick={() => setViewMode('week')}
              style={{
                color: viewMode === 'week' ? '#ffffff' : 'var(--text-2)',
              }}
            >
              <Icon name="activity" size={13} style={{ color: viewMode === 'week' ? '#ffffff' : 'var(--text-3)' }} />
              <span>Week View</span>
            </button>
          </div>

          <Button
            variant="primary"
            onClick={() => {
              setTargetCellForBooking({
                pitchId: pitches[0]?.id || null,
                date: dateStr,
                time: '16:00',
                price: 2000,
              });
              manualModal.open();
            }}
            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="plus" size={16} />
            <span>New Booking</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Ribbon (Positioned Above Navigation Bar) */}
      {viewMode === 'day' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div className="stat-chip">
            <div className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="calendar" size={14} style={{ color: 'var(--text-3)' }} />
              <span>Total Slots</span>
            </div>
            <b style={{ fontSize: 20 }}>{dayStats.total}</b>
          </div>

          <div className="stat-chip">
            <div className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="legend-dot" style={{ background: 'var(--brand)' }} />
              <span>Available</span>
            </div>
            <b style={{ fontSize: 20, color: 'var(--brand-600)' }}>{dayStats.available}</b>
          </div>

          <div className="stat-chip">
            <div className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="users" size={14} style={{ color: 'var(--brand)' }} />
              <span>Booked</span>
            </div>
            <b style={{ fontSize: 20, color: 'var(--brand)' }}>{dayStats.booked}</b>
          </div>

          <div className="stat-chip">
            <div className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="activity" size={14} style={{ color: 'var(--info)' }} />
              <span>Occupancy</span>
            </div>
            <b style={{ fontSize: 20 }}>{dayStats.occupancyRate}%</b>
          </div>

          <div className="stat-chip">
            <div className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="money" size={14} style={{ color: 'var(--brand)' }} />
              <span>Day Revenue</span>
            </div>
            <b style={{ fontSize: 20 }}>৳{dayStats.revenue.toLocaleString()}</b>
          </div>
        </div>
      )}

      {/* Date Navigation & Filter Strip (Mobile-First with Stacking Context) */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          position: 'relative',
          zIndex: 35,
        }}
      >
        {/* Date Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <IconButton label="Previous" onClick={handlePrev}>
            <Icon name="chevronLeft" size={16} />
          </IconButton>
          <IconButton label="Next" onClick={handleNext}>
            <Icon name="chevronRight" size={16} />
          </IconButton>
          <Button variant="secondary" size="sm" onClick={handleToday} style={{ fontWeight: 700 }}>
            Today
          </Button>

          <div ref={calendarPickerContainerRef} style={{ position: 'relative', marginLeft: 6 }}>
            <button
              type="button"
              onClick={() => setIsCalendarOpen((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '6px 14px',
                borderRadius: 'var(--r-md)',
                background: isCalendarOpen ? 'var(--brand-soft)' : 'var(--surface-2)',
                border: isCalendarOpen ? '1px solid var(--brand)' : '1px solid var(--border)',
                transition: 'all var(--dur) var(--ease)',
                userSelect: 'none',
                color: 'var(--text)',
                boxShadow: isCalendarOpen ? '0 0 0 2px var(--brand-soft)' : 'none',
              }}
              title="Click to toggle custom calendar date picker"
              aria-expanded={isCalendarOpen}
            >
              <span style={{ fontWeight: 700, fontSize: 14, color: isCalendarOpen ? 'var(--brand-600)' : 'var(--text)' }}>
                {viewMode === 'day'
                  ? formatDateDisplay(date)
                  : `Week of ${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </span>
              <Icon name="calendar" size={16} style={{ color: 'var(--brand)', flexShrink: 0 }} />
            </button>

            {/* Hidden date input for test compatibility */}
            <input
              id="calendarDatePicker"
              type="date"
              value={dateStr}
              onChange={handleDateInputChange}
              style={{ display: 'none' }}
              aria-hidden="true"
            />

            {/* Custom Liquid-Glass Calendar Popover */}
            <CalendarPopover
              isOpen={isCalendarOpen}
              onClose={() => setIsCalendarOpen(false)}
              selectedDate={date}
              containerRef={calendarPickerContainerRef}
              onSelectDate={(newDate) => {
                setDate(newDate);
                setIsCalendarOpen(false);
              }}
            />
          </div>
        </div>

        {/* Filters with Pill Shape & Sports Emojis */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {pitches.length > 1 && (
            <>
              <FilterPillDropdown
                label="Pitch"
                value={selectedPitchFilter}
                onChange={setSelectedPitchFilter}
                icon="pin"
                options={[
                  { value: 'ALL', label: `All Pitches (${pitches.length})` },
                  ...pitches.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <select
                value={selectedPitchFilter}
                onChange={(e) => setSelectedPitchFilter(e.target.value)}
                style={{ display: 'none' }}
                aria-label="Filter by pitch"
              >
                <option value="ALL">All Pitches ({pitches.length})</option>
                {pitches.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </>
          )}

          {availableSports.length > 1 && (
            <>
              <FilterPillDropdown
                label="Sport"
                value={selectedSportFilter}
                onChange={setSelectedSportFilter}
                getOptionEmoji={(val) => (val === 'ALL' ? '🏆' : getSportEmoji(val))}
                options={[
                  { value: 'ALL', label: 'All Sports' },
                  ...availableSports.map((s) => ({ value: s, label: s })),
                ]}
              />
              <select
                value={selectedSportFilter}
                onChange={(e) => setSelectedSportFilter(e.target.value)}
                style={{ display: 'none' }}
                aria-label="Filter by sport"
              >
                <option value="ALL">All Sports</option>
                {availableSports.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Dynamic Animated View Container */}
      <div key={viewMode} className="cal-view-transition">

        {/* Calendar Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div className="legend">
            <span><i className="avail" /> Available</span>
            <span><i className="book" /> Booked</span>
            <span><i className="hold" /> Held / Checkout</span>
            <span><i className="block" /> Blocked / Maintenance</span>
          </div>
          <div className="subtle tiny" style={{ fontWeight: 600 }}>
            Click any slot to manage price, check in, or block
          </div>
        </div>

        {calendarError && (
          <Alert tone="danger" style={{ marginBottom: 16 }}>
            {calendarError}
          </Alert>
        )}

        {/* Day View Grid (Liquid-Glass with Sticky Headers & Time Column) */}
        {viewMode === 'day' && (
          <div className="cal">
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p className="subtle small">Loading pitch schedule &amp; slots...</p>
              </div>
            ) : filteredPitches.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <h3>No pitches found</h3>
                <p className="subtle small">Add pitches to this venue in Venue Setup to begin scheduling slots.</p>
              </div>
            ) : (
              <div
                className="cal-grid"
                style={{
                  gridTemplateColumns: `85px repeat(${filteredPitches.length}, minmax(180px, 1fr))`,
                }}
              >
                {/* Sticky Top-Left Empty Time Header */}
                <div className="cal-head sticky-time-head" style={{ textAlign: 'center', color: 'var(--text-3)' }}>
                  TIME
                </div>

                {/* Pitch Column Headers */}
                {filteredPitches.map((p) => {
                  const sport = p.sports?.[0] || 'Football';
                  return (
                    <div key={p.id} className="cal-head">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800 }}>{p.name}</span>
                        <span className="slot-pill sport">
                          <Icon name="ball" size={11} />
                          <span>{sport}</span>
                        </span>
                      </div>
                      <div className="tiny subtle" style={{ marginTop: 2, fontWeight: 500 }}>
                        {p.sizeLabel || 'Standard'}
                      </div>
                    </div>
                  );
                })}

                {/* Time Rows */}
                {rows.map((row) => (
                  <Fragment key={row.time}>
                    {/* Sticky Time Label Column */}
                    <div className="cal-time">
                      <span>{row.time}</span>
                    </div>

                    {/* Pitch Cells */}
                    {filteredPitches.map((pitch) => {
                      const cell = row.cells?.find((c) => String(c.pitchId) === String(pitch.id)) || {
                        slotId: null,
                        pitchId: pitch.id,
                        status: 'AVAILABLE',
                        price: 2000,
                        startTime: row.time,
                        durationMinutes: 90,
                        sport: pitch.sports?.[0] || 'Football',
                      };

                      const status = cell.status || 'AVAILABLE';
                      const duration = cell.durationMinutes || 90;

                      if (status === 'BOOKED') {
                        return (
                          <div key={pitch.id} className="cal-cell" onClick={() => handleSlotClick(cell, row.time)}>
                            <div className="slot-card booked">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <span className="slot-cust" title={cell.customerName || 'Booked'}>
                                  {cell.customerName || 'Player Booking'}
                                </span>
                                {cell.checkedIn ? (
                                  <span className="slot-pill check" title="Checked in">
                                    ✓ In
                                  </span>
                                ) : null}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 800 }}>
                                  ৳{Number(cell.price || 0).toLocaleString()}
                                </span>
                                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                  {cell.bookingCode && (
                                    <span className="slot-pill code">#{cell.bookingCode.slice(-4)}</span>
                                  )}
                                  <span className="slot-pill dur">{duration}m</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (status === 'HELD') {
                        return (
                          <div key={pitch.id} className="cal-cell" onClick={() => handleSlotClick(cell, row.time)}>
                            <div className="slot-card held">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Icon name="clock" size={12} />
                                  <span>Held</span>
                                </span>
                                <span className="slot-pill dur">{duration}m</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <span style={{ fontSize: 11.5, fontWeight: 700 }}>
                                  ৳{Number(cell.price || 0).toLocaleString()}
                                </span>
                                <span className="slot-pill sport">{cell.sport || 'Sport'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (status === 'BLOCKED') {
                        return (
                          <div key={pitch.id} className="cal-cell" onClick={() => handleSlotClick(cell, row.time)}>
                            <div className="slot-card blocked">
                              <div style={{ fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Icon name="ban" size={12} />
                                <span>Maintenance</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span className="tiny subtle">{cell.startTime || row.time}</span>
                                <span className="slot-pill dur">{duration}m</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Available Slot
                      return (
                        <div key={pitch.id} className="cal-cell" onClick={() => handleSlotClick(cell, row.time)}>
                          <div className="slot-card available">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <span className="slot-price">৳{Number(cell.price || 2000).toLocaleString()}</span>
                              <span className="slot-pill sport">
                                {cell.sport || pitch.sports?.[0] || 'Sport'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <span className="tiny subtle" style={{ fontWeight: 600 }}>
                                {cell.startTime || row.time}
                              </span>
                              <span className="slot-pill dur">{duration}m</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Week View Grid */}
        {viewMode === 'week' && (
          <div className="cal">
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p className="subtle small">Loading 7-day schedule...</p>
              </div>
            ) : (
              <div
                className="cal-grid"
                style={{
                  gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))',
                }}
              >
                {/* Week Day Column Headers */}
                {weekDays.map((d) => {
                  const dIso = formatDateIso(d);
                  const isToday = dIso === formatDateIso(new Date());
                  const dayRows = weekData[dIso]?.rows || [];
                  let dayBooked = 0;
                  let dayTotal = 0;
                  dayRows.forEach((r) => {
                    r.cells?.forEach((c) => {
                      dayTotal++;
                      if (c.status === 'BOOKED') dayBooked++;
                    });
                  });

                  return (
                    <div
                      key={dIso}
                      className="cal-head"
                      style={{
                        cursor: 'pointer',
                        background: isToday ? 'var(--brand-soft)' : 'var(--surface-2)',
                        borderTop: isToday ? '3px solid var(--brand)' : 'none',
                      }}
                      onClick={() => {
                        setDate(d);
                        setViewMode('day');
                      }}
                      title="Click to jump to Day View for this date"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? 'var(--brand-600)' : 'var(--text)' }}>
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className="tiny subtle" style={{ fontWeight: 700 }}>
                          {d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <span className="tiny subtle">{dayTotal > 0 ? `${dayBooked}/${dayTotal} booked` : 'No slots'}</span>
                        <span className="tiny" style={{ color: 'var(--brand-600)', fontWeight: 700 }}>Day →</span>
                      </div>
                    </div>
                  );
                })}

                {/* Week Day Slot Columns */}
                {weekDays.map((d) => {
                  const dIso = formatDateIso(d);
                  const dayRows = weekData[dIso]?.rows || [];

                  return (
                    <div key={dIso} style={{ borderRight: '1px solid var(--border)', padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {dayRows.length === 0 ? (
                        <div className="subtle tiny" style={{ padding: 16, textAlign: 'center' }}>
                          No slots scheduled
                        </div>
                      ) : (
                        dayRows.map((r) => {
                          const cell = r.cells?.[0];
                          if (!cell) return null;
                          const isBooked = cell.status === 'BOOKED';
                          const isHeld = cell.status === 'HELD';
                          const isBlocked = cell.status === 'BLOCKED';

                          return (
                            <div
                              key={r.time}
                              onClick={() => {
                                setDate(d);
                                handleSlotClick(cell, r.time);
                              }}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 10,
                                fontSize: 11.5,
                                cursor: 'pointer',
                                border: isBooked
                                  ? '1px solid var(--brand)'
                                  : isHeld
                                    ? '1px solid var(--warn)'
                                    : isBlocked
                                      ? '1px solid var(--border)'
                                      : '1px dashed var(--border-strong)',
                                background: isBooked
                                  ? 'linear-gradient(135deg, rgba(14,122,74,0.15), rgba(14,122,74,0.05))'
                                  : isHeld
                                    ? 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(217,119,6,0.05))'
                                    : isBlocked
                                      ? 'var(--surface-3)'
                                      : 'var(--surface)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
                                <span>{r.time}</span>
                                <span style={{ fontWeight: 800 }}>৳{Number(cell.price || 2000).toLocaleString()}</span>
                              </div>
                              <div className="tiny subtle" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{isBooked ? (cell.customerName || 'Booked') : isBlocked ? 'Blocked' : 'Available'}</span>
                                <span>{cell.sport || 'Sport'}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slot Details & Actions Side Drawer (mode="drawer") */}
      <Overlay
        isOpen={detailModal.isOpen}
        onClose={detailModal.close}
        title="Slot Details & Management"
        mode="drawer"
      >
        {selectedCell && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 16 }}>
            {/* Slot Hero Banner */}
            <div
              style={{
                padding: '16px 18px',
                borderRadius: 'var(--r-lg)',
                background:
                  selectedCell.status === 'BOOKED'
                    ? 'linear-gradient(135deg, rgba(14,122,74,0.18), rgba(14,122,74,0.08))'
                    : selectedCell.status === 'HELD'
                      ? 'linear-gradient(135deg, rgba(217,119,6,0.18), rgba(217,119,6,0.08))'
                      : selectedCell.status === 'BLOCKED'
                        ? 'var(--surface-3)'
                        : 'var(--surface-2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{selectedCell.startTime}</span>
                  {selectedCell.endTime && <span>→ {selectedCell.endTime}</span>}
                </div>
                <div className="subtle small" style={{ marginTop: 2, fontWeight: 600 }}>
                  {formatDateDisplay(date)} · {selectedCell.durationMinutes || 90} mins play
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="slot-pill sport" style={{ fontSize: 12, padding: '4px 8px' }}>
                  <Icon name="ball" size={12} />
                  <span>{selectedCell.sport || 'Football'}</span>
                </span>
                <Badge
                  tone={
                    selectedCell.status === 'BOOKED'
                      ? 'green'
                      : selectedCell.status === 'HELD'
                        ? 'amber'
                        : selectedCell.status === 'BLOCKED'
                          ? 'gray'
                          : 'blue'
                  }
                >
                  {selectedCell.status}
                </Badge>
              </div>
            </div>

            {/* Pitch Info Card */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="pin" size={13} />
                <span>Pitch Location</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{selectedCell.pitchName}</div>
              <div className="subtle small">{selectedCell.pitchSize}</div>
            </div>

            {/* Dynamic Pricing Status & Suggestion (for AVAILABLE slots) */}
            {selectedCell.status === 'AVAILABLE' && (
              isMlPricingActive ? (
                <div
                  className="card"
                  style={{
                    padding: '14px 16px',
                    background: 'linear-gradient(135deg, rgba(14,122,74,0.10), rgba(14,122,74,0.02))',
                    border: '1px solid rgba(14,122,74,0.25)',
                  }}
                >
                  <div className="between" style={{ marginBottom: 6 }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 12,
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: 'var(--brand-600)',
                      }}
                    >
                      <Icon name="sparkles" size={14} />
                      <span>ML Dynamic Pricing Active</span>
                    </span>
                    <Badge tone="green" style={{ fontSize: 10 }}>
                      Auto-Applied
                    </Badge>
                  </div>
                  <div className="subtle small" style={{ marginTop: 2, lineHeight: 1.4 }}>
                    Dynamic AI pricing is enabled for this venue. Slot rates are already automatically calculated based on peak hours, occupancy, and demand.
                  </div>
                </div>
              ) : (
                <div
                  className="card"
                  style={{
                    padding: '14px 16px',
                    background: 'linear-gradient(135deg, rgba(14,122,74,0.10), rgba(14,122,74,0.02))',
                    border: '1px solid rgba(14,122,74,0.25)',
                  }}
                >
                  <div className="between" style={{ marginBottom: 6 }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 12,
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: 'var(--brand-600)',
                      }}
                    >
                      <Icon name="sparkles" size={14} />
                      <span>Dynamic Price Suggestion</span>
                    </span>
                    {aiSuggestion && typeof aiSuggestion === 'object' && (
                      <Badge tone="green" style={{ fontSize: 10 }}>
                        Suggested Rate
                      </Badge>
                    )}
                  </div>

                  {aiSuggestion === 'loading' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 12, color: 'var(--text-3)' }}>
                      <div className="spinner sm" />
                      <span>Analyzing demand, day of week &amp; venue occupancy...</span>
                    </div>
                  ) : aiSuggestion && typeof aiSuggestion === 'object' ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand-600)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)' }}>
                          ৳{Math.round(aiSuggestion.suggestedPrice).toLocaleString()}
                        </div>
                        <div className="tiny subtle" style={{ fontWeight: 600 }}>
                          {aiSuggestion.multiplier > 1.02
                            ? `+${Math.round((aiSuggestion.multiplier - 1) * 100)}% Peak Demand Multiplier (${aiSuggestion.multiplier.toFixed(2)}x)`
                            : aiSuggestion.multiplier < 0.98
                              ? `-${Math.round((1 - aiSuggestion.multiplier) * 100)}% Off-peak Rate (${aiSuggestion.multiplier.toFixed(2)}x)`
                              : `Standard Base Rate (${aiSuggestion.multiplier.toFixed(2)}x)`}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPriceDraft(String(Math.round(aiSuggestion.suggestedPrice)))}
                        style={{
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          borderColor: 'var(--brand)',
                          color: 'var(--brand-600)',
                          background: 'var(--surface)',
                        }}
                      >
                        <Icon name="sparkles" size={13} />
                        <span>Apply Suggested Price</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="tiny subtle" style={{ marginTop: 2 }}>
                      Standard sport base rate active. Dynamic price recommendation offline or not configured.
                    </div>
                  )}
                </div>
              )
            )}

            {/* Pricing Management Card */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="money" size={13} />
                <span>Slot Pricing &amp; Rate</span>
              </div>

              {selectedCell.status === 'AVAILABLE' ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="slotPriceInput" className="tiny subtle" style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                      PRICE PER SLOT (৳)
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: 12, fontWeight: 800, color: 'var(--text-3)', fontSize: 14 }}>
                        ৳
                      </span>
                      <input
                        id="slotPriceInput"
                        type="number"
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value)}
                        min="0"
                        step="50"
                        style={{
                          width: '100%',
                          paddingLeft: 28,
                          paddingRight: 10,
                          height: 42,
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--r-md)',
                          color: 'var(--text)',
                          fontSize: 15,
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleSavePrice}
                    loading={savingPrice}
                    style={{
                      height: 42,
                      padding: '0 18px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 8px rgba(14,122,74,0.25)',
                    }}
                  >
                    <Icon name="check" size={15} />
                    <span>Save Price</span>
                  </Button>
                </div>
              ) : (
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)' }}>
                  ৳{Number(selectedCell.price || 0).toLocaleString()}
                </div>
              )}
            </div>

            {/* Booking & Customer Section (for BOOKED / HELD) */}
            {(selectedCell.status === 'BOOKED' || selectedCell.status === 'HELD') && (
              <div className="card" style={{ padding: '14px 16px' }}>
                <div className="tiny subtle" style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="user" size={13} />
                  <span>Player Booking Info</span>
                </div>

                <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{selectedCell.customerName || 'Direct Booking'}</span>
                    </div>
                    {selectedCell.customerPhone && (
                      <div className="subtle small" style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="phone" size={12} />
                        <span>{selectedCell.customerPhone}</span>
                      </div>
                    )}
                    {selectedCell.bookingCode && (
                      <div className="tiny subtle" style={{ marginTop: 4 }}>
                        Code: <b style={{ fontFamily: 'monospace' }}>{selectedCell.bookingCode}</b>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    {selectedCell.checkedIn ? (
                      <Badge tone="green">Checked In</Badge>
                    ) : (
                      <Badge tone="amber">Awaiting Check-in</Badge>
                    )}
                  </div>
                </div>

                {/* Direct Call action */}
                {selectedCell.customerPhone && canCall() && (
                  <div style={{ marginTop: 12 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      block
                      onClick={() => callNumber(selectedCell.customerPhone)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Icon name="phone" size={14} />
                      <span>Call Customer ({selectedCell.customerPhone})</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Actions Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
              {selectedCell.status === 'AVAILABLE' && (
                <>
                  <Button
                    variant="primary"
                    block
                    onClick={handleOpenManualBooking}
                    style={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Icon name="plus" size={16} />
                    <span>Record Walk-in Booking</span>
                  </Button>
                  <Button
                    variant="secondary"
                    block
                    onClick={handleToggleBlock}
                    loading={slotActionBusy === 'blocking'}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Icon name="ban" size={15} />
                    <span>Block Slot for Maintenance</span>
                  </Button>
                </>
              )}

              {selectedCell.status === 'BOOKED' && (
                <>
                  {!selectedCell.checkedIn && (
                    <Button
                      variant="primary"
                      block
                      onClick={handleCheckIn}
                      loading={slotActionBusy === 'checkin'}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Icon name="check" size={16} />
                      <span>Check In Customer</span>
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    block
                    onClick={handleCancelBooking}
                    loading={slotActionBusy === 'cancelling'}
                  >
                    Cancel Booking &amp; Free Slot
                  </Button>
                </>
              )}

              {selectedCell.status === 'BLOCKED' && (
                <Button
                  variant="primary"
                  block
                  onClick={handleToggleBlock}
                  loading={slotActionBusy === 'unblocking'}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Icon name="unlock" size={16} />
                  <span>Unblock Slot &amp; Make Available</span>
                </Button>
              )}

              <Button variant="tertiary" block onClick={detailModal.close}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Overlay>

      {/* Manual Booking Modal */}
      {selectedVenueId && (
        <ManualBookingModal
          isOpen={manualModal.isOpen}
          onClose={manualModal.close}
          venueId={selectedVenueId}
          initialSlot={targetCellForBooking}
          onBookingCreated={() => {
            showToast('Manual booking recorded successfully ✓');
            refreshCalendar();
          }}
        />
      )}
    </div>
  );
}
