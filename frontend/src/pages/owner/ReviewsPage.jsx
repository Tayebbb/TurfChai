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
import { useApi } from '@/hooks/useApi';
import { paths } from '@/routes/paths';
import { getOwnerReviews } from '@/api/ownerReviews';

const FILTERS = ['All (214)', 'Needs response (2)', '🧒 Parent reviews (18)', 'Low rating'];



export default function ReviewsPage() {
  const { showToast } = useToast();
  const chips = useFilterChips(['All (214)']);
  const [reply, setReply] = useState('');

  const { data: res, loading } = useApi(getOwnerReviews, []);
  const reviewsData = res?.data || res || {};
  const reviews = reviewsData.items || [];
  const ratingBreakdown = reviewsData.ratingBreakdown || [];
  const categoryAverages = reviewsData.categoryAverages || [];
  const averageRating = reviewsData.averageRating || '0.0';
  const totalReviews = reviewsData.totalReviews || 0;

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

          {reviews.map((review) => (
            <div className="card" key={review.id} style={{ borderLeft: `3px solid ${review.tone || 'var(--warn)'}` }}>
              <div className="between">
                <div className="row" style={{ gap: 8 }}>
                  <Avatar size="sm" initials={review.initials} tone={review.avatarTone} />
                  <div>
                    <b className="small">{review.author}</b>{' '}
                    {review.badges?.map((badge) => (
                      <Badge key={badge.text} tone={badge.tone} dot={false}>
                        {badge.text}
                      </Badge>
                    ))}
                    <div className="tiny subtle">{review.subtitle}</div>
                  </div>
                </div>
                <span className="rating">{review.rating}</span>
              </div>
              <p className="small" style={{ margin: '10px 0' }}>
                &quot;{review.text}&quot;
              </p>
              
              {review.needsResponse ? (
                <>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label htmlFor={`r-${review.id}`}>Your response</label>
                    <Textarea
                      id={`r-${review.id}`}
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
                </>
              ) : review.response ? (
                <div className="panel small" style={{ borderLeft: '3px solid var(--brand)' }}>
                  <b className="tiny" style={{ color: 'var(--brand-600)' }}>
                    YOUR RESPONSE
                  </b>
                  <p className="tiny muted" style={{ margin: '2px 0 0' }}>
                    &quot;{review.response}&quot;
                  </p>
                </div>
              ) : null}

              {review.actions && (
                <div className="row" style={{ marginTop: 10 }}>
                  {review.actions.map(action => (
                    <Button 
                      key={action.label}
                      size="sm" 
                      variant={action.variant} 
                      onClick={() => showToast(action.toast)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!loading && reviews.length === 0 && (
            <div className="card center subtle" style={{ padding: '48px 24px' }}>
              No reviews available yet.
            </div>
          )}
          {loading && (
            <div className="card center subtle" style={{ padding: '48px 24px' }}>
              Loading reviews...
            </div>
          )}
        </div>

        <div className="stack">
          <div className="glass glass-card">
            <div className="row" style={{ gap: 14 }}>
              <div className="center">
                <b className="num" style={{ fontSize: 40, fontFamily: 'var(--font-display)' }}>
                  {averageRating}
                </b>
                <div className="rating" aria-label={`${averageRating} stars`} />
                <div className="tiny subtle">{totalReviews} verified reviews</div>
              </div>
              <div style={{ flex: 1 }} className="stack-sm">
                {ratingBreakdown.map((row, idx) => (
                  <div className="row" style={{ gap: 8 }} key={row.star ?? row.stars ?? idx}>
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
              {ratingBreakdown.length === 0 && (
                <div className="tiny subtle center">No ratings yet</div>
              )}
            </div>
          </div>
          <div className="card">
            <h4>Category averages</h4>
            <div className="stack-sm" style={{ marginTop: 8 }}>
              {categoryAverages.map((item) => (
                <div className="between small" key={item.id}>
                  <span className="muted">{item.label}</span>
                  <b className="num">{item.value}</b>
                </div>
              ))}
              {categoryAverages.length === 0 && (
                <div className="tiny subtle center">No category data</div>
              )}
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