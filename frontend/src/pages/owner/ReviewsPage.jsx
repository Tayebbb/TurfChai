import { useState, useMemo } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, Textarea } from '@/components/forms/Field';
import { PageTitle } from '@/components/common/PageTitle';
import { useToast } from '@/hooks/useToast';
import { useApi } from '@/hooks/useApi';
import { paths } from '@/routes/paths';
import { getOwnerReviews } from '@/api/ownerReviews';

export default function ReviewsPage() {
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState('All');
  const [reply, setReply] = useState('');

  const { data: res, loading } = useApi(getOwnerReviews, []);
  const reviewsData = res?.data || res || {};
  const reviews = useMemo(() => reviewsData.items || [], [reviewsData.items]);
  const ratingBreakdown = reviewsData.ratingBreakdown || [];
  const categoryAverages = reviewsData.categoryAverages || [];
  const averageRating = reviewsData.averageRating || '0.0';
  const totalReviews = reviewsData.totalReviews || 0;
  const venueSlug = reviewsData.venueSlug;

  const needsResponseCount = useMemo(() => reviews.filter((r) => r.needsResponse).length, [reviews]);
  const lowRatingCount = useMemo(() => reviews.filter((r) => (r.rating || r.overallRating || 0) <= 3).length, [reviews]);

  const filterOptions = useMemo(() => [
    { key: 'All', label: `All (${totalReviews})` },
    { key: 'Needs response', label: `Needs response (${needsResponseCount})` },
    { key: 'Low rating', label: `Low rating (${lowRatingCount})` },
  ], [totalReviews, needsResponseCount, lowRatingCount]);

  const visibleReviews = useMemo(() => {
    if (activeFilter === 'Needs response') {
      return reviews.filter((r) => r.needsResponse);
    }
    if (activeFilter === 'Low rating') {
      return reviews.filter((r) => (r.rating || r.overallRating || 0) <= 3);
    }
    return reviews;
  }, [reviews, activeFilter]);

  const publicVenueLink = venueSlug ? paths.player.venue(venueSlug) : paths.player.explore;

  return (
    <>
      <PageTitle title="Reviews" />

      <div className="main-header">
        <div>
          <h1>Reviews</h1>
          <span className="subtle small">All reviews come from verified bookings only</span>
        </div>
        <Button to={publicVenueLink}>View public page</Button>
      </div>

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="row-wrap">
            {filterOptions.map((f) => (
              <Chip
                key={f.key}
                active={activeFilter === f.key}
                onToggle={() => setActiveFilter(f.key)}
              >
                {f.label}
              </Chip>
            ))}
          </div>

          {visibleReviews.map((review) => (
            <div className="card" key={review.id} style={{ borderLeft: `3px solid ${review.tone || 'var(--warn)'}` }}>
              <div className="between">
                <div className="row" style={{ gap: 8 }}>
                  <Avatar size="sm" initials={review.initials || 'U'} tone={review.avatarTone || 'brand'} />
                  <div>
                    <b className="small">{review.author || review.customer || 'Player'}</b>{' '}
                    {review.badges?.map((badge) => (
                      <Badge key={badge.text} tone={badge.tone} dot={false}>
                        {badge.text}
                      </Badge>
                    ))}
                    <div className="tiny subtle">{review.subtitle || review.date}</div>
                  </div>
                </div>
                <span className="rating">{review.rating} ★</span>
              </div>
              <p className="small" style={{ margin: '10px 0' }}>
                &quot;{review.text || review.comment}&quot;
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
                  {review.actions.map((action) => (
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
          {!loading && visibleReviews.length === 0 && (
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
                      {row.star ?? row.stars}
                    </span>
                    <div className="progress" style={{ flex: 1 }}>
                      <i style={{ width: row.width ?? `${row.pct}%` }} />
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
              {categoryAverages.map((item, idx) => (
                <div className="between small" key={item.id || item.label || idx}>
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