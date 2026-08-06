import { Link, useOutletContext } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Badge } from '@/components/ui/Badge';
import { searchVenues } from '@/api/venues';
import { getSavedVenues } from '@/api/players';
import { getMyTournaments, registrationState } from '@/api/playerTournaments';
import { useApi } from '@/hooks/useApi';
import { paths } from '@/routes/paths';
import { DashCard, DashEmpty, DashError, DashHeader, DashSkeleton } from './DashboardKit';

const bdt = (value) =>
  value == null ? null : `৳${Math.round(Number(value)).toLocaleString('en-IN')}`;

const formatDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '';

export default function OverviewSection() {
  const { profile, completion, profileState } = useOutletContext();

  const saved = useApi(() => getSavedVenues(), []);
  const mine = useApi(() => getMyTournaments(), []);
  // Personalised by the player's home area when we know it.
  const recommended = useApi(
    () => searchVenues({ size: 4, sort: 'rating', area: profile?.area?.split(',')[0] ?? '' }),
    [profile?.area ?? ''],
  );

  const firstName = profile?.fullName?.split(/\s+/)[0];
  const savedCount = saved.data?.length ?? 0;
  const registeredCount = mine.data?.length ?? 0;
  const paidCount = mine.data?.filter((t) => t.myPaymentStatus === 'PAID').length ?? 0;

  return (
    <>
      <DashHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        subtitle={
          profile?.area
            ? `Your home area is ${profile.area}.`
            : 'Add your area so we can tailor recommendations.'
        }
        action={
          <Button size="sm" to={paths.player.explore}>
            Find a turf
          </Button>
        }
      />

      <div className="dash-stats">
        <div className="dash-stat">
          <b>{profileState.loading ? '—' : `${completion.percent}%`}</b>
          <span>Profile complete</span>
        </div>
        <div className="dash-stat">
          <b>{saved.loading ? '—' : savedCount}</b>
          <span>Saved venues</span>
        </div>
        <div className="dash-stat">
          <b>{mine.loading ? '—' : registeredCount}</b>
          <span>Tournaments joined</span>
        </div>
        <div className="dash-stat">
          <b>{profile?.reliabilityScore != null ? `${profile.reliabilityScore}%` : '—'}</b>
          <span>Reliability</span>
        </div>
      </div>

      {completion.percent < 100 && completion.missing.length ? (
        <DashCard title="Finish your profile">
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text-3)' }}>
            Still missing {completion.missing.slice(0, 3).join(', ')}
            {completion.missing.length > 3 ? ` and ${completion.missing.length - 3} more` : ''}.
            Players with complete profiles get better game invitations.
          </p>
          <Button size="sm" to={paths.player.dashboard.settings}>
            Complete profile
          </Button>
        </DashCard>
      ) : null}

      <DashCard
        title="Your tournaments"
        action={<Link to={paths.player.dashboard.tournaments}>View all</Link>}
      >
        {mine.loading ? (
          <DashSkeleton rows={2} />
        ) : mine.error ? (
          <DashError onRetry={mine.reload} />
        ) : registeredCount === 0 ? (
          <DashEmpty
            icon="🏆"
            title="No tournaments yet"
            actions={
              <Button size="sm" to={paths.player.dashboard.tournaments}>
                Browse tournaments
              </Button>
            }
          >
            Join a tournament to see your fixtures, payment status and registration code here.
          </DashEmpty>
        ) : (
          <div className="dash-rows">
            {mine.data.slice(0, 3).map((card) => {
              const state = registrationState(card);
              return (
                <Link
                  key={card.code}
                  className="dash-row"
                  to={paths.player.tournament(card.code)}
                >
                  <div className="dash-row-main">
                    <b>{card.name}</b>
                    <span>
                      {formatDate(card.date)} · {card.venueName}
                    </span>
                  </div>
                  <Badge tone={state.tone}>{state.label}</Badge>
                </Link>
              );
            })}
            {paidCount < registeredCount ? (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
                {registeredCount - paidCount} registration
                {registeredCount - paidCount > 1 ? 's' : ''} still awaiting entry-fee payment.
              </p>
            ) : null}
          </div>
        )}
      </DashCard>

      <DashCard
        title="Saved venues"
        action={<Link to={paths.player.dashboard.venues}>View all</Link>}
      >
        {saved.loading ? (
          <DashSkeleton rows={2} />
        ) : saved.error ? (
          <DashError onRetry={saved.reload} />
        ) : savedCount === 0 ? (
          <DashEmpty
            icon="❤"
            title="Nothing saved yet"
            actions={
              <Button size="sm" to={paths.player.explore}>
                Explore venues
              </Button>
            }
          >
            Tap the heart on any venue to keep it here for quick booking.
          </DashEmpty>
        ) : (
          <div className="dash-rows">
            {saved.data.slice(0, 3).map((venue) => (
              <Link key={venue.slug} className="dash-row" to={paths.player.venue(venue.slug)}>
                <div className="dash-row-main">
                  <b>{venue.name}</b>
                  <span>
                    {venue.area}
                    {venue.fromPrice ? ` · from ${bdt(venue.fromPrice)}` : ''}
                  </span>
                </div>
                <span className="rating">{venue.rating}</span>
              </Link>
            ))}
          </div>
        )}
      </DashCard>

      <DashCard
        title={profile?.area ? `Recommended around ${profile.area.split(',')[0]}` : 'Recommended turfs'}
        action={<Link to={paths.player.explore}>Explore</Link>}
      >
        {recommended.loading ? (
          <DashSkeleton rows={2} />
        ) : recommended.error ? (
          <DashError onRetry={recommended.reload} />
        ) : !recommended.data?.items?.length ? (
          <DashEmpty icon="🔍" title="No venues match your area yet">
            Try exploring nearby areas — new turfs are added regularly.
          </DashEmpty>
        ) : (
          <div className="dash-rows">
            {recommended.data.items.map((venue) => (
              <Link key={venue.slug} className="dash-row" to={paths.player.venue(venue.slug)}>
                <div className="dash-row-main">
                  <b>{venue.name}</b>
                  <span>
                    {venue.area}
                    {venue.fromPrice ? ` · from ${bdt(venue.fromPrice)}` : ''}
                  </span>
                </div>
                {venue.verified ? <Badge tone="green">Verified</Badge> : null}
              </Link>
            ))}
          </div>
        )}
      </DashCard>
    </>
  );
}
