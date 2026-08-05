import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const OFFPEAK_STATS = [
  { id: 'bookings', value: '42', label: 'bookings' },
  { id: 'revenue', value: '৳64,700', label: 'revenue' },
  { id: 'lift', value: '+31%', label: 'occupancy lift' },
];

const TYPE_CHIPS = ['Off-peak discount', 'Repeat-customer reward', 'Limited-time deal', 'Venue loyalty'];
const DAY_CHIPS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PITCH_CHIPS = ['All pitches', 'Pitch 1', 'Pitch 2', 'Pitch 3'];

export default function PromotionsPage() {
  const { showToast } = useToast();
  const drawer = useDisclosure(false);

  const typeChips = useFilterChips(['Off-peak discount']);
  const dayChips = useFilterChips(['Mon', 'Tue', 'Wed', 'Thu']);
  const pitchChips = useFilterChips(['All pitches']);

  const [name, setName] = useState('Weekday Off-Peak −30%');
  const [discountUnit, setDiscountUnit] = useState('%');
  const [discountAmount, setDiscountAmount] = useState('30');
  const [cap, setCap] = useState('');
  const [fromTime, setFromTime] = useState('12:00 PM');
  const [toTime, setToTime] = useState('5:00 PM');

  return (
    <>
      <PageTitle title="Promotions" />

      <div className="main-header">
        <div>
          <h1>Promotions</h1>
          <span className="subtle small">Fill empty slots and reward loyal teams</span>
        </div>
        <Button variant="primary" onClick={drawer.open}>
          + New promotion
        </Button>
      </div>

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card" style={{ borderLeft: '3px solid var(--brand)' }}>
            <div className="between">
              <h3 style={{ margin: 0 }}>Weekday Off-Peak −30%</h3>
              <Badge tone="green">Active</Badge>
            </div>
            <p className="subtle small" style={{ margin: '4px 0 10px' }}>
              Mon–Thu · 12:00–5:00 PM · all pitches · ৳2,200 → <b className="num">৳1,540</b>
            </p>
            <div className="grid3" style={{ gap: 8 }}>
              {OFFPEAK_STATS.map((stat) => (
                <div className="panel center" key={stat.id}>
                  <b className="num">{stat.value}</b>
                  <div className="tiny subtle">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <Button size="sm" onClick={drawer.open}>
                Edit
              </Button>
              <Button size="sm" variant="tertiary" onClick={() => showToast('Promotion paused ⏸️')}>
                Pause
              </Button>
            </div>
          </div>

          <div className="card" style={{ borderLeft: '3px solid var(--brand)' }}>
            <div className="between">
              <h3 style={{ margin: 0 }}>Every 10th booking −20%</h3>
              <Badge tone="green">Active · venue loyalty</Badge>
            </div>
            <p className="subtle small" style={{ margin: '4px 0 10px' }}>
              Automatic repeat-customer reward · applies at checkout for enrolled regulars
            </p>
            <div className="row-wrap">
              <Badge tone="blue" dot={false}>
                23 members enrolled
              </Badge>
              <Badge tone="green" dot={false}>
                7 rewards redeemed
              </Badge>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <Button size="sm" onClick={drawer.open}>
                Edit
              </Button>
              <Button size="sm" variant="tertiary" to={paths.owner.customers}>
                View members
              </Button>
            </div>
          </div>

          <div className="card" style={{ borderLeft: '3px solid var(--warn)' }}>
            <div className="between">
              <h3 style={{ margin: 0 }}>Eid Week Special −৳500</h3>
              <Badge tone="amber">Scheduled</Badge>
            </div>
            <p className="subtle small" style={{ margin: '4px 0 10px' }}>
              Fixed ৳500 off evening slots · 15–22 Aug · limited to first 40 bookings
            </p>
            <div className="row">
              <Button size="sm" onClick={drawer.open}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghostDanger"
                onClick={() => showToast('Campaign deleted — undo? (30s)')}
              >
                Delete
              </Button>
            </div>
          </div>

          <div className="card" style={{ opacity: 0.7 }}>
            <div className="between">
              <h3 style={{ margin: 0 }}>Ramadan Midnight −25%</h3>
              <Badge tone="gray">Ended 30 Apr</Badge>
            </div>
            <p className="subtle small" style={{ margin: '4px 0 0' }}>
              96 bookings · ৳1,58,300 revenue ·{' '}
              <Button size="sm" variant="tertiary" onClick={() => showToast('Duplicated as a new draft ✓')}>
                Duplicate
              </Button>
            </p>
          </div>
        </div>

        <div className="glass glass-card">
          <h3>💡 Suggested for you</h3>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            <div className="panel">
              <b className="small">Tue–Wed 2–4 PM is 71% empty</b>
              <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
                A 25–35% off-peak discount typically fills 60% of these slots.
              </p>
              <Button size="sm" variant="primary" onClick={drawer.open}>
                Create off-peak promo
              </Button>
            </div>
            <div className="panel">
              <b className="small">3 regulars near loyalty milestone</b>
              <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
                Rafiul K. (9/10), Karim Traders (15 visits), Tanvir A. (8 visits).
              </p>
              <Button size="sm" to={paths.owner.customers}>
                Review customers
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* New promotion drawer */}
      <Overlay isOpen={drawer.isOpen} onClose={drawer.close} title="New promotion" mode="drawer">
        <div className="field" style={{ marginTop: 8 }}>
          <label>Type</label>
          <div className="row-wrap">
            {TYPE_CHIPS.map((chip) => (
              <Chip key={chip} active={typeChips.isActive(chip)} onToggle={() => typeChips.toggle(chip)}>
                {chip}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="Name" htmlFor="npName">
          <Input id="npName" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Discount" htmlFor="npDisc">
            <div className="row">
              <Select
                id="npDisc"
                style={{ maxWidth: 100 }}
                value={discountUnit}
                onChange={(event) => setDiscountUnit(event.target.value)}
              >
                <option>%</option>
                <option>৳ fixed</option>
              </Select>
              <Input
                className="num"
                aria-label="Discount amount"
                value={discountAmount}
                onChange={(event) => setDiscountAmount(event.target.value)}
              />
            </div>
          </Field>
          <Field label="Usage cap (optional)" htmlFor="npCap">
            <Input
              className="num"
              id="npCap"
              placeholder="e.g. 40 bookings"
              value={cap}
              onChange={(event) => setCap(event.target.value)}
            />
          </Field>
        </div>
        <div className="field">
          <label>Days &amp; window</label>
          <div className="row-wrap">
            {DAY_CHIPS.map((day) => (
              <Chip key={day} active={dayChips.isActive(day)} onToggle={() => dayChips.toggle(day)}>
                {day}
              </Chip>
            ))}
          </div>
          <div className="grid2" style={{ gap: 10, marginTop: 8 }}>
            <Select aria-label="From time" value={fromTime} onChange={(event) => setFromTime(event.target.value)}>
              <option>12:00 PM</option>
            </Select>
            <Select aria-label="To time" value={toTime} onChange={(event) => setToTime(event.target.value)}>
              <option>5:00 PM</option>
            </Select>
          </div>
        </div>
        <div className="field">
          <label>Pitches</label>
          <div className="row-wrap">
            {PITCH_CHIPS.map((pitch) => (
              <Chip key={pitch} active={pitchChips.isActive(pitch)} onToggle={() => pitchChips.toggle(pitch)}>
                {pitch}
              </Chip>
            ))}
          </div>
        </div>
        <div className="panel between">
          <span className="small muted">Preview price (peak ৳2,200)</span>
          <b className="num">
            ৳1,540 <span className="tiny subtle">−30%</span>
          </b>
        </div>
        <Button
          variant="primary"
          size="lg"
          block
          style={{ marginTop: 12 }}
          onClick={() => {
            drawer.close();
            showToast('Promotion live — discounted slots now shown to players ✓');
          }}
        >
          Launch promotion
        </Button>
      </Overlay>
    </>
  );
}
