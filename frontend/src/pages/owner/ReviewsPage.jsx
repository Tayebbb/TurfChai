import { useState, useMemo } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, Textarea } from '@/components/forms/Field';
import { PageTitle } from '@/components/common/PageTitle';
import { useToast } from '@/hooks/useToast';
import { useApi } from '@/hooks/useApi';
import { getOwnerReviews, publishReviewResponse } from '@/api/ownerReviews';
import { toUserMessage } from '@/utils/errorMessage';
import { paths } from '@/routes/paths';

export default function ReviewsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const initialVenue = searchParams.get('venue') || location.state?.venueSlug || 'all';
  const [selectedVenue, setSelectedVenue] = useState(initialVenue);
  const [activeFilter, setActiveFilter] = useState('All');
  const [replies, setReplies] = useState({});
  const [publishingId, setPublishingId] = useState(null);

  const { data: res, loading, error, reload } = useApi(
    () => getOwnerReviews(selectedVenue !== 'all' ? { venue: selectedVenue } : {}),
    [selectedVenue],
  );

  const reviewsData = (res && typeof res === 'object' && !Array.isArray(res)) ? (res.data || res) : {};
  const reviews = useMemo(() => Array.isArray(reviewsData.items) ? reviewsData.items : [], [reviewsData.items]);
  const ratingBreakdown = Array.isArray(reviewsData.ratingBreakdown) ? reviewsData.ratingBreakdown : [];
  const categoryAverages = Array.isArray(reviewsData.categoryAverages) ? reviewsData.categoryAverages : [];
  const averageRating = reviewsData.averageRating ?? '—';
  const totalReviews = reviewsData.totalReviews || 0;
  const ownerVenues = Array.isArray(reviewsData.venues) ? reviewsData.venues : [];

  const handleVenueChange = (venueSlug) => {
    setSelectedVenue(venueSlug);
    if (venueSlug === 'all') {
      searchParams.delete('venue');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ venue: venueSlug }, { replace: true });
    }
  };

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

  const publishResponse = async (reviewId) => {
    const text = (replies[reviewId] || '').trim();
    if (!text || publishingId) return;
    setPublishingId(reviewId);
    try {
      await publishReviewResponse(reviewId, text);
    } catch (error) {
      showToast(toUserMessage(error, 'Could not publish your response.'));
      return;
    } finally {
      setPublishingId(null);
    }
    setReplies((current) => ({ ...current, [reviewId]: '' }));
    reload();
    showToast('Response published — shown under the review ✓');
  };

  return (
    <>
      <PageTitle title="Reviews" />

      <div className="main-header" style={{ marginBottom: 14 }}>
        <div>
          <h1>Reviews</h1>
          <span className="subtle small">All reviews come from verified bookings only</span>
        </div>
      </div>

      {ownerVenues.length > 1 && (
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Venue:
          </span>
          <Chip
            active={selectedVenue === 'all'}
            onToggle={() => handleVenueChange('all')}
          >
            All Venues ({ownerVenues.reduce((acc, v) => acc + (v.reviewCount || 0), 0)})
          </Chip>
          {ownerVenues.map((v) => (
            <Chip
              key={v.id}
              active={selectedVenue === v.slug || selectedVenue === String(v.id)}
              onToggle={() => handleVenueChange(v.slug)}
            >
              🏟️ {v.name} ({v.reviewCount || 0})
            </Chip>
          ))}
        </div>
      )}

      <div className="row-wrap" style={{ marginBottom: 16, gap: 8 }}>
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

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="stack">
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {review.venueSlug && (
                    <Link
                      to={paths.player.venue(review.venueSlug)}
                      state={{ returnTo: paths.owner.reviews }}
                      style={{
                        fontSize: 12,
                        color: 'var(--brand)',
                        textDecoration: 'none',
                        fontWeight: 600,
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'var(--brand-soft)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 36,
                      }}
                      title="View venue player page"
                    >
                      👀 Preview
                    </Link>
                  )}
                  <span className="rating">{review.rating} ★</span>
                </div>
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
                      value={replies[review.id] || ''}
                      onChange={(event) =>
                        setReplies((current) => ({ ...current, [review.id]: event.target.value }))
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!(replies[review.id] || '').trim() || publishingId === review.id}
                    onClick={() => publishResponse(review.id)}
                  >
                    {publishingId === review.id ? 'Publishing…' : 'Publish response'}
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
            </div>
          ))}
          {!loading && error ? (
            // A failed fetch must not read as "no reviews".
            <div className="card center" style={{ padding: '48px 24px' }}>
              <b>Could not load reviews</b>
              <p className="subtle small" style={{ margin: '6px 0 12px' }}>
                {toUserMessage(error, 'Please try again.')}
              </p>
              <Button size="sm" variant="secondary" onClick={reload}>
                Try again
              </Button>
            </div>
          ) : null}
          {!loading && !error && visibleReviews.length === 0 && (
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
            {/* Unsourced statistic removed: an invented "22% more repeat
                bookings" with no data behind it reads as fabricated proof. */}
            Replying shows future players you take feedback seriously — players
            see your response directly under the review.
          </Alert>
        </div>
      </div>
    </>
  );
}