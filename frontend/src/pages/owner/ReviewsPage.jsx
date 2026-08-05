import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, Textarea } from '@/components/forms/Field';
import { PageTitle } from '@/components/common/PageTitle';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const FILTERS = ['All (214)', 'Needs response (2)', '🧒 Parent reviews (18)', 'Low rating'];

const RATING_BREAKDOWN = [
  { star: '5', width: '78%', count: '167' },
  { star: '4', width: '15%', count: '32' },
  { star: '3', width: '5%', count: '11' },
  { star: '2', width: '1%', count: '3' },
  { star: '1', width: '.5%', count: '1' },
];

const CATEGORY_AVERAGES = [
  { id: 'surface', label: 'Surface', value: '4.9' },
  { id: 'lighting', label: 'Lighting', value: '4.8' },
  { id: 'cleanliness', label: 'Cleanliness', value: '4.7' },
  { id: 'amenities', label: 'Amenities', value: '4.3' },
  { id: 'safety', label: 'Safety', value: '4.9' },
  { id: 'youth', label: '🧒 Youth-friendliness', value: '4.6' },
];

const DEFAULT_REPLY =
  "Thanks Rafi! We're expanding the changing room this month — hope to see the team again Friday. 🙌";

export default function ReviewsPage() {
  const { showToast } = useToast();
  const chips = useFilterChips(['All (214)']);
  const [reply, setReply] = useState(DEFAULT_REPLY);

  return (
    <>
      <PageTitle title="Reviews" />

      <div className="main-header">
        <div>
          <h1>Reviews</h1>
          <span className="subtle small">All reviews come from verified bookings only</span>
        </div>
        <Button to={paths.player.venue('kick-off-arena')}>View public page</Button>
      </div>

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="row-wrap">
            {FILTERS.map((filter) => (
              <Chip key={filter} active={chips.isActive(filter)} onToggle={() => chips.toggle(filter)}>
                {filter}
              </Chip>
            ))}
          </div>

          <div className="card" style={{ borderLeft: '3px solid var(--warn)' }}>
            <div className="between">
              <div className="row" style={{ gap: 8 }}>
                <Avatar size="sm" initials="RK" />
                <div>
                  <b className="small">Rafiul Karim</b>{' '}
                  <Badge tone="green" dot={false}>
                    Verified booking
                  </Badge>
                  <div className="tiny subtle">Tonight · Pitch 2</div>
                </div>
              </div>
              <span className="rating">5.0</span>
            </div>
            <p className="small" style={{ margin: '10px 0' }}>
              &quot;Grass is fresh and fast, floodlights excellent. Handover was exactly on time. Changing room a
              bit small for 10 people.&quot;
            </p>
            <div className="field" style={{ marginBottom: 8 }}>
              <label htmlFor="r1">Your response</label>
              <Textarea
                id="r1"
                placeholder="Thank the player, address feedback…"
                value={reply}
                onChange={(event) => setReply(event.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => showToast('Response published — shown under the review ✓')}
            >
              Publish response
            </Button>
          </div>

          <div className="card" style={{ borderLeft: '3px solid var(--warn)' }}>
            <div className="between">
              <div className="row" style={{ gap: 8 }}>
                <Avatar size="sm" initials="SR" tone="c" />
                <div>
                  <b className="small">Sadia Rahman</b>{' '}
                  <Badge tone="green" dot={false}>
                    Verified
                  </Badge>{' '}
                  <Badge tone="blue" dot={false}>
                    🧒 Parent review
                  </Badge>
                  <div className="tiny subtle">25 Jul · Pitch 3 futsal</div>
                </div>
              </div>
              <span className="rating">3.5</span>
            </div>
            <p className="small" style={{ margin: '10px 0' }}>
              &quot;Great indoor court for kids&apos; coaching, but the waiting area for parents needs more seating
              and the washroom queue was long.&quot;
            </p>
            <div className="row">
              <Button size="sm" variant="primary" onClick={() => showToast('Response editor opened')}>
                Respond
              </Button>
              <Button
                size="sm"
                variant="ghostDanger"
                onClick={() =>
                  showToast(
                    'Reported to TurfChai moderation — reviews are only removed if they violate guidelines',
                  )
                }
              >
                Report review
              </Button>
            </div>
          </div>

          <div className="card">
            <div className="between">
              <div className="row" style={{ gap: 8 }}>
                <Avatar size="sm" initials="TA" tone="b" />
                <div>
                  <b className="small">Tanvir Ahmed</b>{' '}
                  <Badge tone="green" dot={false}>
                    Verified
                  </Badge>
                  <div className="tiny subtle">2 Aug · Pitch 1</div>
                </div>
              </div>
              <span className="rating">4.5</span>
            </div>
            <p className="small" style={{ margin: '10px 0' }}>
              &quot;Best evening lights in Dhanmondi. Parking fills up by 8 PM though.&quot;
            </p>
            <div className="panel small" style={{ borderLeft: '3px solid var(--brand)' }}>
              <b className="tiny" style={{ color: 'var(--brand-600)' }}>
                YOUR RESPONSE · 3 Aug
              </b>
              <p className="tiny muted" style={{ margin: '2px 0 0' }}>
                &quot;Thanks Tanvir! Extra parking opens next month at the rear gate.&quot;
              </p>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="glass glass-card">
            <div className="row" style={{ gap: 14 }}>
              <div className="center">
                <b className="num" style={{ fontSize: 40, fontFamily: 'var(--font-display)' }}>
                  4.8
                </b>
                <div className="rating" aria-label="4.8 stars" />
                <div className="tiny subtle">214 verified reviews</div>
              </div>
              <div style={{ flex: 1 }} className="stack-sm">
                {RATING_BREAKDOWN.map((row) => (
                  <div className="row" style={{ gap: 8 }} key={row.star}>
                    <span className="tiny num" style={{ width: 12 }}>
                      {row.star}
                    </span>
                    <div className="progress" style={{ flex: 1 }}>
                      <i style={{ width: row.width }} />
                    </div>
                    <span className="tiny subtle num">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <h4>Category averages</h4>
            <div className="stack-sm" style={{ marginTop: 8 }}>
              {CATEGORY_AVERAGES.map((item) => (
                <div className="between small" key={item.id}>
                  <span className="muted">{item.label}</span>
                  <b className="num">{item.value}</b>
                </div>
              ))}
            </div>
          </div>
          <Alert tone="info" icon="💬" title="Responding pays off">
            Venues that reply to reviews within 48h see 22% more repeat bookings.
          </Alert>
        </div>
      </div>
    </>
  );
}