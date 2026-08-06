import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Badge } from '@/components/ui/Badge';
import { Segmented } from '@/components/navigation/Tabs';
import {
  browseTournaments,
  getMyTournaments,
  registrationState,
} from '@/api/playerTournaments';
import { useApi } from '@/hooks/useApi';
import { paths } from '@/routes/paths';
import { DashCard, DashEmpty, DashError, DashHeader, DashSkeleton } from './DashboardKit';

const TABS = [
  { id: 'browse', label: 'Browse' },
  { id: 'mine', label: 'My tournaments' },
];

const bdt = (value) =>
  value == null ? null : `৳${Math.round(Number(value)).toLocaleString('en-IN')}`;

const formatDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

const prettyFormat = (format) => (format ? format.toLowerCase().replaceAll('_', '-') : '');

function TournamentRow({ card }) {
  const state = registrationState(card);
  return (
    <Link className="dash-row" to={paths.player.tournament(card.code)}>
      <div className="dash-row-main">
        <b>{card.name}</b>
        <span>
          {formatDate(card.date)} · {card.venueName} · {prettyFormat(card.format)}
          {Number(card.entryFeePerTeam) > 0 ? ` · ${bdt(card.entryFeePerTeam)} entry` : ' · free entry'}
        </span>
      </div>
      <Badge tone={state.tone}>{state.label}</Badge>
    </Link>
  );
}

export default function TournamentsSection() {
  const [tab, setTab] = useState('browse');
  const [page, setPage] = useState(0);
  const [openOnly, setOpenOnly] = useState(true);
  const [query, setQuery] = useState('');

  const browse = useApi(
    () => browseTournaments({ page, size: 10, openOnly, upcomingOnly: true }),
    [page, openOnly],
  );
  const mine = useApi(() => getMyTournaments(), []);

  const filtered = useMemo(() => {
    const items = browse.data?.items ?? [];
    const needle = query.trim().toLowerCase();
    return needle
      ? items.filter(
          (card) =>
            card.name.toLowerCase().includes(needle) ||
            card.venueName.toLowerCase().includes(needle),
        )
      : items;
  }, [browse.data, query]);

  const totalPages = browse.data?.totalPages ?? 1;

  return (
    <>
      <DashHeader
        title="Tournaments"
        subtitle="Browse open tournaments, track your registrations and entry-fee status."
      />

      <Segmented items={TABS} value={tab} onChange={setTab} label="Tournament view" />

      {tab === 'browse' ? (
        <DashCard>
          <div
            className="between"
            style={{ gap: 10, flexWrap: 'wrap', marginBottom: 14 }}
          >
            <input
              className="input"
              type="search"
              value={query}
              placeholder="Search by tournament or venue…"
              aria-label="Search tournaments"
              onChange={(event) => setQuery(event.target.value)}
              style={{ maxWidth: 280 }}
            />
            <label className="checkline" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(event) => {
                  setOpenOnly(event.target.checked);
                  setPage(0);
                }}
              />
              <span>Open registration only</span>
            </label>
          </div>

          {browse.loading ? (
            <DashSkeleton rows={3} />
          ) : browse.error ? (
            <DashError onRetry={browse.reload} />
          ) : filtered.length === 0 ? (
            <DashEmpty
              icon="🏆"
              title={query ? 'No tournaments match that search' : 'No open tournaments right now'}
              actions={
                query ? (
                  <Button size="sm" variant="secondary" onClick={() => setQuery('')}>
                    Clear search
                  </Button>
                ) : !openOnly ? null : (
                  <Button size="sm" variant="secondary" onClick={() => setOpenOnly(false)}>
                    Include invite-only
                  </Button>
                )
              }
            >
              {query
                ? 'Try a different tournament or venue name.'
                : 'Hosts publish tournaments regularly — check back soon or ask a host for an invite link.'}
            </DashEmpty>
          ) : (
            <>
              <div className="dash-rows">
                {filtered.map((card) => (
                  <TournamentRow key={card.code} card={card} />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'center' }}>
                  <Button
                    size="sm"
                    variant="tertiary"
                    disabled={page === 0}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    ← Previous
                  </Button>
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)', alignSelf: 'center' }}>
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="tertiary"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next →
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </DashCard>
      ) : (
        <DashCard>
          {mine.loading ? (
            <DashSkeleton rows={2} />
          ) : mine.error ? (
            <DashError onRetry={mine.reload} />
          ) : !mine.data?.length ? (
            <DashEmpty
              icon="🎟"
              title="You haven’t registered for a tournament yet"
              actions={
                <Button size="sm" onClick={() => setTab('browse')}>
                  Browse tournaments
                </Button>
              }
            >
              Once you register, your registration code, payment status and fixtures appear here.
            </DashEmpty>
          ) : (
            <div className="dash-rows">
              {mine.data.map((card) => (
                <TournamentRow key={card.code} card={card} />
              ))}
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                Entry-fee payment is handled by the organiser until the payments service goes live.
              </p>
            </div>
          )}
        </DashCard>
      )}
    </>
  );
}
