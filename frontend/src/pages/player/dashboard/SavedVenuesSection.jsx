import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Badge } from '@/components/ui/Badge';
import { getSavedVenues, removeSavedVenue } from '@/api/players';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { DashCard, DashEmpty, DashError, DashHeader, DashSkeleton } from './DashboardKit';

const SORTS = [
  { id: 'recent', label: 'Recently saved' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'price', label: 'Lowest price' },
  { id: 'name', label: 'Name' },
];

const bdt = (value) =>
  value == null ? null : `৳${Math.round(Number(value)).toLocaleString('en-IN')}`;

export default function SavedVenuesSection() {
  const { showToast } = useToast();
  const saved = useApi(() => getSavedVenues(), []);
  const [sort, setSort] = useState('recent');
  const [area, setArea] = useState('all');
  const [removing, setRemoving] = useState(null);

  const venues = useMemo(() => saved.data ?? [], [saved.data]);

  const areas = useMemo(
    () => ['all', ...new Set(venues.map((venue) => venue.area).filter(Boolean))],
    [venues],
  );

  const visible = useMemo(() => {
    const list = area === 'all' ? venues : venues.filter((venue) => venue.area === area);
    const sorted = [...list];
    if (sort === 'rating') sorted.sort((a, b) => Number(b.rating) - Number(a.rating));
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'price') {
      sorted.sort((a, b) => (Number(a.fromPrice) || Infinity) - (Number(b.fromPrice) || Infinity));
    }
    return sorted; // 'recent' keeps the API's newest-first order
  }, [venues, area, sort]);

  const remove = async (venue) => {
    setRemoving(venue.slug);
    try {
      await removeSavedVenue(venue.slug);
      showToast(`Removed ${venue.name} from saved`);
      saved.reload();
    } catch {
      showToast('Could not update saved venues — try again');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <DashHeader
        title="Saved venues"
        subtitle={
          venues.length
            ? `${venues.length} venue${venues.length > 1 ? 's' : ''} bookmarked for quick booking.`
            : 'Bookmark venues to reach them in one tap.'
        }
        action={
          <Button size="sm" to={paths.player.explore}>
            Explore venues
          </Button>
        }
      />

      <DashCard>
        {saved.loading ? (
          <DashSkeleton rows={3} />
        ) : saved.error ? (
          <DashError onRetry={saved.reload} />
        ) : venues.length === 0 ? (
          <DashEmpty
            icon="❤"
            title="No saved venues yet"
            actions={
              <Button size="sm" to={paths.player.explore}>
                Explore venues
              </Button>
            }
          >
            Save your favourite turfs to reach them instantly and keep an eye on their pricing.
          </DashEmpty>
        ) : (
          <>
            <div className="between" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <div className="row-wrap" style={{ gap: 6 }}>
                {SORTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={sort === option.id ? 'chip on' : 'chip'}
                    onClick={() => setSort(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {areas.length > 2 ? (
                <select
                  className="select"
                  value={area}
                  aria-label="Filter by area"
                  onChange={(event) => setArea(event.target.value)}
                  style={{ maxWidth: 190 }}
                >
                  {areas.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'All areas' : option}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {visible.length === 0 ? (
              <DashEmpty icon="🔍" title="Nothing in that area">
                Choose a different area to see your other saved venues.
              </DashEmpty>
            ) : (
              <div className="dash-rows">
                {visible.map((venue) => (
                  <div key={venue.slug} className="dash-row">
                    <div className="dash-row-main">
                      <b>{venue.name}</b>
                      <span>
                        {venue.address ?? venue.area}
                        {venue.fromPrice ? ` · from ${bdt(venue.fromPrice)}` : ''}
                        {venue.slotDurationMin ? ` / ${venue.slotDurationMin} min` : ''}
                      </span>
                    </div>
                    <span className="rating" style={{ fontSize: 12.5 }}>
                      {venue.rating}
                    </span>
                    {venue.verified ? <Badge tone="green">Verified</Badge> : null}
                    <div className="row" style={{ gap: 6 }}>
                      <Button size="sm" to={paths.player.venue(venue.slug)}>
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="tertiary"
                        disabled={removing === venue.slug}
                        onClick={() => remove(venue)}
                      >
                        {removing === venue.slug ? 'Removing…' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DashCard>
    </>
  );
}
