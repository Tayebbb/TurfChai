import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { Overlay } from '@/components/modals/Overlay';
import { Chip } from '@/components/ui/Chip';
import {
  formatGameDay,
  formatTimeRange,
  isoDay,
  kickoffMs,
  searchOpenGames,
  skillLabel,
} from '@/api/openGames';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { CreateGameDrawer } from './CreateGameDrawer';
import { paths } from '@/routes/paths';
import { formatBdt } from '@/utils/format';
import './OpenGamesPage.css';

/**
 * Only the groups the data can honestly answer: date and skill are pushed to
 * the backend, price and availability are applied to the returned rows.
 * OpenGameResponse carries no sport or join-mode, so those chips are gone.
 */
const FILTER_GROUPS = [
  {
    id: 'day',
    title: 'Date',
    options: [
      { value: 'today', label: '🌙 Today' },
      { value: 'tomorrow', label: '📅 Tomorrow' },
    ],
  },
  {
    id: 'skill',
    title: 'Skill Level',
    options: [
      { value: 'BEGINNER', label: 'Beginner' },
      { value: 'INTERMEDIATE', label: 'Intermediate' },
      { value: 'ADVANCED', label: 'Advanced' },
    ],
  },
  {
    id: 'price',
    title: 'Price',
    options: [
      { value: '300', label: 'Under ৳300' },
      { value: '500', label: 'Under ৳500' },
    ],
  },
  {
    id: 'availability',
    title: 'Availability',
    options: [{ value: 'open', label: '⚡ Spots available' }],
  },
];

const SORT_OPTIONS = [
  { value: 'urgency', label: 'Sort: Urgency' },
  { value: 'price-asc', label: 'Price: Low → High' },
  { value: 'price-desc', label: 'Price: High → Low' },
  { value: 'time', label: 'Soonest first' },
];

const CLOSED_STATUSES = new Set(['FULL', 'COMPLETED', 'CANCELLED']);

const spotsOf = (game) => Math.max(0, Number(game?.spotsLeft ?? 0));

/** Which of the four feed buckets a game belongs to. */
function sectionFor(game) {
  if (CLOSED_STATUSES.has(game.status) || spotsOf(game) === 0) return 'full';
  if (spotsOf(game) === 1) return 'urgent';
  if (game.status === 'ALMOST_FULL') return 'almost-full';
  return 'open';
}

/** Full games sink to the bottom of an urgency sort instead of the top. */
const urgencyRank = (game) => (spotsOf(game) > 0 ? spotsOf(game) : Number.POSITIVE_INFINITY);

const SORTERS = {
  urgency: (a, b) => urgencyRank(a) - urgencyRank(b) || kickoffMs(a) - kickoffMs(b),
  'price-asc': (a, b) => Number(a.pricePerPlayer ?? 0) - Number(b.pricePerPlayer ?? 0),
  'price-desc': (a, b) => Number(b.pricePerPlayer ?? 0) - Number(a.pricePerPlayer ?? 0),
  time: (a, b) => kickoffMs(a) - kickoffMs(b),
};

/** Wraps the first case-insensitive hit in `<mark class="sh">`, like the prototype. */
function Highlight({ text, query }) {
  const value = text ?? '';
  if (!query) return value;
  const index = value.toLowerCase().indexOf(query);
  if (index === -1) return value;
  return (
    <>
      {value.slice(0, index)}
      <mark className="sh">{value.slice(index, index + query.length)}</mark>
      {value.slice(index + query.length)}
    </>
  );
}

/** Client-side pass for the filters the endpoint does not accept. */
function matchesClientFilters(game, filters) {
  if (filters.price && Number(game.pricePerPlayer ?? 0) > Number(filters.price)) return false;
  if (filters.availability === 'open' && spotsOf(game) === 0) return false;
  return true;
}

function statusBadgeFor(game, section) {
  const spots = spotsOf(game);
  if (section === 'full') return { tone: 'gray', text: 'Full · closed' };
  if (section === 'urgent') return { tone: 'red', text: 'Urgent · needs 1 player' };
  if (section === 'almost-full') return { tone: 'amber', text: `Almost full · ${spots} spots` };
  return { tone: 'green', text: `Open · ${spots} spot${spots === 1 ? '' : 's'} left` };
}

const AVATAR_TONES = [undefined, 'b', 'c'];

function GameCard({ game, query }) {
  const section = sectionFor(game);
  const spots = spotsOf(game);
  const capacity = Number(game.capacity ?? 0);
  const filledCount = Number(game.filledCount ?? 0);
  const status = statusBadgeFor(game, section);
  const shownMembers = (game.members ?? []).slice(0, 3);
  const overflow = Math.max(0, filledCount - shownMembers.length);

  const cardClass =
    section === 'urgent' ? 'game-card-urgent' : section === 'almost-full' ? 'gc gc-almost-full' : 'gc';
  const fillTone = spots <= 1 ? 'red' : section === 'almost-full' ? 'amber' : 'green';
  const fillWidth = capacity > 0 ? `${Math.min(100, Math.round((filledCount / capacity) * 100))}%` : '0%';

  const metaParts = [game.area, game.pitchName].filter(Boolean);
  const whenLabel = `${formatGameDay(game.gameDate)} ${formatTimeRange(game.startTime, game.endTime)}`.trim();

  return (
    <div className={cardClass}>
      {section === 'urgent' ? <div className="urgent-glow" /> : null}
      <div className="between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className={`badge ${status.tone}`}>{status.text}</span>
        <span className="row-wrap">
          <span className="skill">{skillLabel(game.skillLevel)}</span>
          {game.gameCode ? <span className="badge blue nodot">{game.gameCode}</span> : null}
        </span>
      </div>
      <div className="gc-title-row">
        <div className="sport-icon">⚽</div>
        <div className="gc-title-info">
          <h3 className="gc-title">
            <Highlight text={game.title} query={query} />
          </h3>
          <div className="gc-meta">
            <span className="gc-venue">
              <Highlight text={game.venueName} query={query} />
            </span>
            {metaParts.map((part) => (
              <Fragment key={part}>
                <span className="dot-sep">·</span>
                <span>{part}</span>
              </Fragment>
            ))}
            {whenLabel ? (
              <>
                <span className="dot-sep">·</span>
                <b style={{ color: 'var(--text)' }}>{whenLabel}</b>
              </>
            ) : null}
          </div>
        </div>
        <div className={section === 'almost-full' ? 'price-pill amber' : 'price-pill'}>
          <b>{formatBdt(game.pricePerPlayer)}</b>
          <span>your share</span>
        </div>
      </div>
      <div>
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="host-tag">
            <span className="stars-mini">★</span>
            <b>{game.organizerName ?? 'TurfChai host'}</b>
          </span>
          <span
            className="subtle small"
            style={
              spots === 1
                ? { fontWeight: 700, color: 'var(--danger)' }
                : section === 'almost-full'
                  ? { color: 'var(--warn)', fontWeight: 700 }
                  : undefined
            }
          >
            {filledCount}/{capacity} joined
            {spots > 0 ? ` · ${spots} spot${spots === 1 ? '' : 's'} left` : ''}
          </span>
        </div>
        <div className={`fill-bar ${fillTone}`}>
          <i style={{ width: fillWidth }} />
        </div>
      </div>
      <div className="gc-bottom">
        <div className="gc-players">
          <div className="avatar-group">
            {shownMembers.map((member, index) => (
              <span
                key={member.id ?? member.userId}
                className={AVATAR_TONES[index] ? `avatar sm ${AVATAR_TONES[index]}` : 'avatar sm'}
              >
                {member.initials ?? '??'}
              </span>
            ))}
            {overflow > 0 ? <span className="avatar sm d">+{overflow}</span> : null}
          </div>
          <span className="subtle small">
            {spots === 1 ? 'Waiting for 1 more' : `${spots} spots remaining`}
          </span>
        </div>
        <Link
          className={`btn btn-sm btn-${spots === 1 ? 'primary' : 'secondary'}`}
          to={paths.solo.game(game.id)}
        >
          {spots === 1 ? 'View & Join →' : 'View →'}
        </Link>
      </div>
    </div>
  );
}

export default function OpenGamesPage() {
  const filterModal = useDisclosure(false);
  const createModal = useDisclosure(false);
  const { signedIn } = useSession();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState('urgency');
  const [filters, setFilters] = useState({});

  // Debounced so the search box does not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const gameDate =
    filters.day === 'today' ? isoDay(0) : filters.day === 'tomorrow' ? isoDay(1) : undefined;
  const skillLevel = filters.skill;

  const { data, loading, error, reload } = useApi(
    () => searchOpenGames({ query: debouncedQuery || undefined, gameDate, skillLevel }),
    [debouncedQuery, gameDate, skillLevel],
  );

  const games = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const normalisedQuery = debouncedQuery.toLowerCase();

  const visibleGames = useMemo(
    () =>
      games
        .filter((game) => matchesClientFilters(game, filters))
        .sort(SORTERS[sort] ?? SORTERS.urgency),
    [games, filters, sort],
  );

  const heroStats = useMemo(() => {
    const today = isoDay(0);
    return [
      {
        id: 'games',
        value: games.filter((game) => game.gameDate === today).length,
        line1: 'Games',
        line2: 'Today',
      },
      {
        id: 'spots',
        value: games.reduce((total, game) => total + spotsOf(game), 0),
        line1: 'Spots',
        line2: 'Open',
      },
      {
        id: 'urgent',
        value: games.filter((game) => spotsOf(game) === 1).length,
        line1: 'Urgent',
        line2: 'Slots',
      },
    ];
  }, [games]);

  const bySection = (section) => visibleGames.filter((game) => sectionFor(game) === section);
  const urgentGames = bySection('urgent');
  const openGamesList = bySection('open');
  const almostFullGames = bySection('almost-full');
  const fullGames = bySection('full');

  // The urgent header shows the soonest real kickoff instead of a fixed timer.
  const nextUrgent = urgentGames[0];

  const visibleCount = visibleGames.length;
  const activeFilterCount = Object.keys(filters).length;
  const hasQuery = normalisedQuery.length > 0 || activeFilterCount > 0;

  /** Single-select per group: clicking the live chip clears it, any other chip replaces it. */
  const toggleChip = (group, value) => {
    setFilters((previous) => {
      const next = { ...previous };
      if (previous[group] === value) delete next[group];
      else next[group] = value;
      return next;
    });
  };

  const resetAll = () => {
    setFilters({});
    setQuery('');
  };

  const sectionHeader = (id, title, trailing, spaced) => (
    <div className="game-section-header" style={spaced ? { marginTop: 6 } : undefined} key={`header-${id}`}>
      <h2>{title}</h2>
      <div className="section-line" />
      {trailing}
    </div>
  );

  return (
    <>
      <PageTitle title="Open Games" />

      <main className="wrap" id="main" style={{ paddingTop: 20, paddingBottom: 48, maxWidth: 960 }}>
        {/* ═══ HERO ═══ */}
        <section className="og-hero" style={{ marginBottom: 0 }}>
          <div className="og-hero-layout">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="og-eyebrow">
                <span className="live-dot">LIVE FEED</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                  {loading ? 'Refreshing…' : 'Updated just now'}
                </span>
              </div>
              <h1>
                Open games that fit
                <br />
                your energy
              </h1>
              <p className="sub">
                Discover nearby matches, jump into fast-moving slots, and find your next squad with zero friction.
              </p>
              <div className="og-hero-actions">
                <Button
                  variant="primary"
                  onClick={createModal.open}
                  disabled={!signedIn}
                  title={signedIn ? undefined : 'Sign in to post a game'}
                >
                  + Post a game
                </Button>
                <Link className="btn btn-secondary" to={paths.solo.alerts}>
                  🔔 Set LFG Alert
                </Link>
                <Link className="btn btn-secondary" to={paths.player.explore}>
                  Explore Venues →
                </Link>
              </div>
            </div>
            <div className="og-stats">
              {heroStats.map((stat) => (
                <div className="stat-card" key={stat.id}>
                  <strong>{stat.value}</strong>
                  <span>
                    {stat.line1}
                    <br />
                    {stat.line2}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ STICKY SEARCH + FILTER TOOLBAR ═══ */}
        <div className="og-toolbar" role="search" aria-label="Search and filter games">
          <div className="og-toolbar-inner">
            <div className="og-search-row">
              <div className={query ? 'og-search-box has-text' : 'og-search-box'}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  id="game-search"
                  placeholder="Search games, venues, hosts…"
                  autoComplete="off"
                  aria-label="Search open games"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button
                  className="search-clear"
                  aria-label="Clear search"
                  type="button"
                  onClick={() => setQuery('')}
                >
                  ✕
                </button>
              </div>

              <select
                className="og-sort-select"
                aria-label="Sort games"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="og-filter-row">
              <button className="filters-btn" type="button" aria-label="Open filters" onClick={filterModal.open}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                Filters
                {activeFilterCount > 0 ? <span className="filters-btn-count">{activeFilterCount}</span> : null}
              </button>
              <span className="og-result-count" aria-live="polite">
                {loading
                  ? 'Loading…'
                  : visibleCount > 0
                    ? `${visibleCount} game${visibleCount === 1 ? '' : 's'}`
                    : ''}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ GAMES LIST ═══ */}
        <div className="stack" style={{ gap: 14 }}>
          {loading ? (
            <p className="subtle" role="status" style={{ padding: '28px 0', textAlign: 'center' }}>
              Loading open games…
            </p>
          ) : null}

          {!loading && error ? (
            <div className="og-empty">
              <div className="emoji">⚠️</div>
              <h3>Could not load open games</h3>
              <p>{error.message}</p>
              <Button variant="primary" onClick={reload}>
                Try again
              </Button>
            </div>
          ) : null}

          {!loading && !error ? (
            <>
              {urgentGames.length > 0
                ? sectionHeader(
                    'urgent',
                    '🔴 Urgent',
                    nextUrgent ? (
                      <span className="countdown">
                        ⏱ {formatGameDay(nextUrgent.gameDate)}{' '}
                        {formatTimeRange(nextUrgent.startTime, nextUrgent.endTime)}
                      </span>
                    ) : null,
                    false,
                  )
                : null}
              {urgentGames.map((game) => (
                <GameCard key={game.id} game={game} query={normalisedQuery} />
              ))}

              {openGamesList.length > 0
                ? sectionHeader(
                    'open',
                    '🟢 Open',
                    <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                      {openGamesList.length} game{openGamesList.length === 1 ? '' : 's'} available
                    </span>,
                    true,
                  )
                : null}
              {openGamesList.map((game) => (
                <GameCard key={game.id} game={game} query={normalisedQuery} />
              ))}

              {almostFullGames.length > 0
                ? sectionHeader(
                    'almost-full',
                    '🟡 Almost Full',
                    <span style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 700 }}>Act fast!</span>,
                    true,
                  )
                : null}
              {almostFullGames.map((game) => (
                <GameCard key={game.id} game={game} query={normalisedQuery} />
              ))}

              {fullGames.length > 0
                ? sectionHeader(
                    'full',
                    '⛔ Full',
                    <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                      An LFG alert covers openings
                    </span>,
                    true,
                  )
                : null}
              {fullGames.map((game) => (
                <div className="full-card" key={game.id}>
                  <div className="full-card-info">
                    <h3>{game.title}</h3>
                    <p>
                      {game.venueName} · {formatGameDay(game.gameDate)}{' '}
                      {formatTimeRange(game.startTime, game.endTime)} ·{' '}
                      <span className="badge gray" style={{ display: 'inline-flex' }}>
                        Full · closed
                      </span>
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="skill">{skillLabel(game.skillLevel)}</span>
                    <Link className="btn btn-sm btn-secondary" to={paths.solo.game(game.id)}>
                      View →
                    </Link>
                  </div>
                </div>
              ))}

              {visibleCount === 0 && hasQuery ? (
                <div className="og-empty">
                  <div className="emoji">🔍</div>
                  <h3>No games match your search</h3>
                  <p>Try different keywords or clear your filters to see all available games.</p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" type="button" onClick={resetAll}>
                      Clear search &amp; filters
                    </button>
                    <Link className="btn btn-primary" to={paths.solo.alerts}>
                      ⚡ Set LFG Alert
                    </Link>
                  </div>
                </div>
              ) : null}

              {visibleCount === 0 && !hasQuery ? (
                <div className="og-empty">
                  <div className="emoji">🎯</div>
                  <h3>No open games right now</h3>
                  <p>
                    Set an LFG availability alert — TurfChai will ping you the moment a matching game or slot
                    appears.
                  </p>
                  <Link className="btn btn-primary btn-lg" to={paths.solo.alerts}>
                    ⚡ Set LFG Availability Alert
                  </Link>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <CreateGameDrawer
          isOpen={createModal.isOpen}
          onClose={createModal.close}
          onCreated={(game) => {
            createModal.close();
            reload();
            showToast(`“${game?.title ?? 'Your game'}” is live — players can join now ✓`);
          }}
        />

        {/* ═══ FILTER DRAWER ═══ */}
        <Overlay isOpen={filterModal.isOpen} onClose={filterModal.close} title="Filters" mode="drawer" hideHeader>
          <div className="between">
            <h3>Filters</h3>
            <IconButton label="Close filters" onClick={filterModal.close}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </IconButton>
          </div>

          {FILTER_GROUPS.map((group) => (
            <div className="field" key={group.id}>
              <label>{group.title}</label>
              <div className="row-wrap">
                {group.options.map((option) => (
                  <Chip
                    key={option.value}
                    active={filters[group.id] === option.value}
                    onToggle={() => toggleChip(group.id, option.value)}
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}

          <div className="row" style={{ marginTop: 16 }}>
            <Button variant="tertiary" onClick={resetAll}>
              Reset
            </Button>
            <Button variant="primary" block onClick={filterModal.close}>
              Show results
            </Button>
          </div>
        </Overlay>
      </main>
    </>
  );
}
