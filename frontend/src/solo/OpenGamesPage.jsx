import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { fullGame, openGames } from '@/data/games';
import { useCountdown } from '@/hooks/useCountdown';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './OpenGamesPage.css';

const URGENCY_SECONDS = 2 * 3600 + 14 * 60;

/** Chips shown pre-selected on first paint — the prototype applies none of them until clicked. */
const INITIAL_CHIPS = { sport: 'football', time: 'tonight' };

const FILTER_GROUPS = [
  {
    id: 'sport',
    title: 'Sport',
    options: [
      { value: 'football', label: '⚽ Football' },
      { value: 'cricket', label: '🏏 Cricket' },
    ],
  },
  {
    id: 'time',
    title: 'Time',
    options: [
      { value: 'tonight', label: '🌙 Tonight' },
      { value: 'tomorrow', label: '📅 Tomorrow' },
    ],
  },
  {
    id: 'skill',
    title: 'Skill Level',
    options: [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'advanced', label: 'Advanced' },
    ],
  },
  {
    id: 'other',
    title: 'Other',
    last: true,
    options: [
      { group: 'join', value: 'instant', label: '⚡ Instant join' },
      { group: 'price', value: '300', label: 'Under ৳300' },
    ],
  },
];

const SORT_OPTIONS = [
  { value: 'default', label: 'Sort: Urgency' },
  { value: 'price-asc', label: 'Price: Low → High' },
  { value: 'price-desc', label: 'Price: High → Low' },
  { value: 'distance', label: 'Nearest first' },
  { value: 'time', label: 'Soonest first' },
];

const HERO_STATS = [
  { id: 'games', value: '12', line1: 'Games', line2: 'Today' },
  { id: 'spots', value: '37', line1: 'Spots', line2: 'Open' },
  { id: 'urgent', value: '4', line1: 'Urgent', line2: 'Slots' },
];

function formatUrgency(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `⏱ ${hours}h ${String(minutes).padStart(2, '0')}m left`
    : `⏱ ${minutes}m ${String(seconds).padStart(2, '0')}s left`;
}

/** Wraps the first case-insensitive hit in `<mark class="sh">`, like the prototype. */
function Highlight({ text, query }) {
  if (!query) return text;
  const index = text.toLowerCase().indexOf(query);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="sh">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

function matchesFilters(game, query, filters) {
  if (query) {
    const haystack = `${game.name} ${game.venue} ${game.sport} ${game.skill} ${game.search}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filters.sport && game.sport !== filters.sport) return false;
  if (filters.time && game.time !== filters.time) return false;
  if (filters.skill && game.skill !== filters.skill) return false;
  if (filters.join && game.join !== filters.join) return false;
  if (filters.price && Number(game.price ?? 9999) > Number(filters.price)) return false;
  return true;
}

function GameCard({ game, query, filled }) {
  const cardClass = game.variant === 'urgent' ? 'game-card-urgent' : game.variant === 'almost-full' ? 'gc gc-almost-full' : 'gc';

  return (
    <Link className={cardClass} to={paths.solo.game(game.id)}>
      {game.variant === 'urgent' ? <div className="urgent-glow" /> : null}
      <div className="between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className={`badge ${game.status.tone}`}>{game.status.text}</span>
        <span className="row-wrap">
          <span className="skill">{game.skillLabel}</span>
          <span className={`badge ${game.joinBadge.tone} nodot`}>{game.joinBadge.text}</span>
        </span>
      </div>
      <div className="gc-title-row">
        <div className="sport-icon">{game.sportIcon}</div>
        <div className="gc-title-info">
          <h3 className="gc-title">
            <Highlight text={game.name} query={query} />
          </h3>
          <div className="gc-meta">
            <span className="gc-venue">
              <Highlight text={game.venue} query={query} />
            </span>
            {game.metaParts.map((part) => (
              <Fragment key={part}>
                <span className="dot-sep">·</span>
                <span>{part}</span>
              </Fragment>
            ))}
            {game.metaStrong ? (
              <>
                <span className="dot-sep">·</span>
                <b style={{ color: 'var(--text)' }}>{game.metaStrong}</b>
              </>
            ) : null}
          </div>
        </div>
        <div className={game.priceTone ? `price-pill ${game.priceTone}` : 'price-pill'}>
          <b>৳{game.price}</b>
          <span>your share</span>
        </div>
      </div>
      <div>
        <div className="between" style={{ marginBottom: 5 }}>
          <span className="host-tag">
            <span className="stars-mini">{game.host.initials}</span>
            <b>{game.host.name}</b>
            <span style={game.host.ratingMuted ? { color: 'var(--text-3)' } : undefined}>{game.host.rating}</span>
          </span>
          <span
            className="subtle small"
            style={
              game.fillNoteTone === 'danger'
                ? { fontWeight: 700, color: 'var(--danger)' }
                : game.fillNoteTone === 'warn'
                  ? { color: 'var(--warn)', fontWeight: 700 }
                  : undefined
            }
          >
            {game.fillNote}
          </span>
        </div>
        <div className={`fill-bar ${game.fillTone}`}>
          <i style={{ width: filled ? game.fillWidth : '0%' }} />
        </div>
      </div>
      <div className="gc-bottom">
        <div className="gc-players">
          <div className="avatar-group">
            {game.avatars.map((avatar) => (
              <span key={avatar.id} className={avatar.tone ? `avatar sm ${avatar.tone}` : 'avatar sm'}>
                {avatar.initials}
              </span>
            ))}
          </div>
          <span className="subtle small">{game.playersNote}</span>
        </div>
        <span className={`btn btn-sm btn-${game.cta.variant}`}>{game.cta.label}</span>
      </div>
    </Link>
  );
}

export default function OpenGamesPage() {
  const { showToast } = useToast();
  const filterModal = useDisclosure(false);
  const { remaining } = useCountdown(URGENCY_SECONDS);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [chips, setChips] = useState(INITIAL_CHIPS);
  const [filters, setFilters] = useState({});
  const [filled, setFilled] = useState(false);

  // Mirrors the prototype's 0% → target fill-bar sweep on first paint.
  useEffect(() => {
    const id = setTimeout(() => setFilled(true), 200);
    return () => clearTimeout(id);
  }, []);

  const normalisedQuery = query.trim().toLowerCase();

  const visibleGames = useMemo(
    () => openGames.filter((game) => matchesFilters(game, normalisedQuery, filters)),
    [normalisedQuery, filters],
  );
  const fullVisible = matchesFilters(fullGame, normalisedQuery, filters);

  const visibleCount = visibleGames.length + (fullVisible ? 1 : 0);
  const activeFilterCount = Object.keys(filters).length;
  const hasQuery = normalisedQuery.length > 0 || activeFilterCount > 0;

  const bySection = (section) => visibleGames.filter((game) => game.section === section);

  /** Single-select per group: clicking the live chip clears it, any other chip replaces it. */
  const toggleChip = (group, value) => {
    const clearing = filters[group] === value;
    const apply = (previous) => {
      const next = { ...previous };
      if (clearing) delete next[group];
      else next[group] = value;
      return next;
    };
    setChips(apply);
    setFilters(apply);
  };

  const resetAll = () => {
    setChips({});
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

      <main className="wrap" id="main" style={{ paddingTop: 20, maxWidth: 960 }}>
        {/* ═══ HERO ═══ */}
        <section className="og-hero" style={{ marginBottom: 0 }}>
          <div className="og-hero-layout">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="og-eyebrow">
                <span className="live-dot">LIVE FEED</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Updated just now</span>
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
                <Link className="btn btn-primary" to={paths.solo.alerts}>
                  🔔 Set LFG Alert
                </Link>
                <Link className="btn btn-secondary" to={paths.player.explore}>
                  Explore Venues →
                </Link>
              </div>
            </div>
            <div className="og-stats">
              {HERO_STATS.map((stat) => (
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
              <div className={normalisedQuery ? 'og-search-box has-text' : 'og-search-box'}>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={filterModal.open}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 10,
                  height: 36,
                  padding: '0 14px',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 6 }}
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Filters
                <span
                  className="badge brand"
                  style={{
                    display: activeFilterCount > 0 ? 'inline-block' : 'none',
                    marginLeft: 8,
                    padding: '2px 6px',
                    fontSize: 11,
                    minWidth: 20,
                    textAlign: 'center',
                  }}
                >
                  {activeFilterCount}
                </span>
              </button>
              <span className="og-result-count" aria-live="polite">
                {visibleCount > 0 ? `${visibleCount} game${visibleCount === 1 ? '' : 's'}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ GAMES LIST ═══ */}
        <div className="stack" style={{ gap: 14 }}>
          {bySection('urgent').length > 0
            ? sectionHeader(
                'urgent',
                '🔴 Urgent',
                <span className="countdown">{formatUrgency(remaining)}</span>,
                false,
              )
            : null}
          {bySection('urgent').map((game) => (
            <GameCard key={game.id} game={game} query={normalisedQuery} filled={filled} />
          ))}

          {bySection('open').length > 0
            ? sectionHeader(
                'open',
                '🟢 Open',
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>3 games available</span>,
                true,
              )
            : null}
          {bySection('open').map((game) => (
            <GameCard key={game.id} game={game} query={normalisedQuery} filled={filled} />
          ))}

          {bySection('almost-full').length > 0
            ? sectionHeader(
                'almost-full',
                '🟡 Almost Full',
                <span style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 700 }}>Act fast!</span>,
                true,
              )
            : null}
          {bySection('almost-full').map((game) => (
            <GameCard key={game.id} game={game} query={normalisedQuery} filled={filled} />
          ))}

          {fullVisible
            ? sectionHeader(
                'full',
                '⛔ Full',
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                  Get notified if a spot opens
                </span>,
                true,
              )
            : null}
          {fullVisible ? (
            <div className="full-card">
              <div className="full-card-info">
                <h3>{fullGame.name}</h3>
                <p>
                  {fullGame.venue} · Tonight 11:00 PM ·{' '}
                  <span className="badge gray" style={{ display: 'inline-flex' }}>
                    Full · closed
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="skill">Intermediate</span>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => showToast("You'll be notified if a spot opens 🔔")}
                >
                  🔔 Notify me
                </button>
              </div>
            </div>
          ) : null}

          {visibleCount === 0 && hasQuery ? (
            <div className="og-empty">
              <div className="emoji">🔍</div>
              <h3>No games match your search</h3>
              <p>Try different keywords or clear your filters to see all available games.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" type="button" onClick={() => setQuery('')}>
                  Clear search
                </button>
                <Link className="btn btn-primary" to={paths.solo.alerts}>
                  ⚡ Set LFG Alert
                </Link>
              </div>
            </div>
          ) : null}

          <div className="og-empty">
            <div className="emoji">🎯</div>
            <h3>Nothing else fits your filters right now</h3>
            <p>
              Set an LFG availability alert — TurfChai will ping you the moment a matching game or slot appears.
            </p>
            <Link className="btn btn-primary btn-lg" to={paths.solo.alerts}>
              ⚡ Set LFG Availability Alert
            </Link>
          </div>
        </div>

        {/* ═══ FILTER MODAL ═══ */}
        <div
          className={filterModal.isOpen ? 'filter-modal-overlay open' : 'filter-modal-overlay'}
          onClick={(event) => {
            if (event.target === event.currentTarget) filterModal.close();
          }}
        >
          <div className="filter-modal-content glass">
            <div
              className="between"
              style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-strong)', marginBottom: 20 }}
            >
              <h3 style={{ margin: 0, fontSize: 18 }}>Filter Games</h3>
              <button
                className="icon-btn"
                type="button"
                aria-label="Close filters"
                onClick={filterModal.close}
                style={{ border: 'none', background: 'transparent' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', paddingRight: 4 }}>
              {FILTER_GROUPS.map((group) => (
                <div key={group.id}>
                  <div className="filter-group-title">{group.title}</div>
                  <div className="filter-chip-grid" style={group.last ? { marginBottom: 0 } : undefined}>
                    {group.options.map((option) => {
                      const groupId = option.group ?? group.id;
                      const on = chips[groupId] === option.value;
                      return (
                        <button
                          key={option.value}
                          className={on ? 'chip on' : 'chip'}
                          type="button"
                          onClick={() => toggleChip(groupId, option.value)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 24,
                paddingTop: 20,
                borderTop: '1px solid var(--border-strong)',
              }}
            >
              <button className="btn btn-secondary" type="button" style={{ flex: 1 }} onClick={resetAll}>
                Reset
              </button>
              <button className="btn btn-primary" type="button" style={{ flex: 2 }} onClick={filterModal.close}>
                Show Results
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
