import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/common/Icon';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { TableScroll } from '@/components/tables/TableScroll';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useApi } from '@/hooks/useApi';
import { fetchOwnerPayments } from '@/api/ownerPayments';
import { downloadCsv } from '@/utils/deviceActions';
import { paths } from '@/routes/paths';

const TIMEFRAMES = [
  { id: 'daily', label: 'Daily (7 Days)' },
  { id: 'weekly', label: 'Weekly (14 Weeks)' },
  { id: 'monthly', label: 'Monthly (12 Months)' },
  { id: 'yearly', label: 'Yearly (5 Years)' },
];

const METHOD_FILTERS = ['Today', 'bKash', 'Nagad', 'Cash', 'Card', 'Refunds', 'Unmatched'];

const DANGER = { color: 'var(--danger)' };

const CURRENCY = (value) => `৳${value.toLocaleString('en-IN')}`;
const AXIS_TICK = (v) =>
  `৳${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`;
const FONT = { family: 'Inter, system-ui, sans-serif', size: 12, weight: 500 };

function getSportEmoji(sport) {
  if (!sport) return '⚽';
  const s = String(sport).toLowerCase();
  if (s.includes('cricket')) return '🏏';
  if (s.includes('badminton')) return '🏸';
  if (s.includes('tennis')) return '🎾';
  if (s.includes('basketball')) return '🏀';
  if (s.includes('volleyball')) return '🏐';
  if (s.includes('padel')) return '🎾';
  if (s.includes('futsal') || s.includes('football') || s.includes('soccer')) return '⚽';
  return '🏆';
}

function FilterPillDropdown({
  label,
  value,
  onChange,
  options,
  icon,
  getOptionEmoji,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOpt = options.find((o) => o.value === value) || options[0];
  const selectedLabel = selectedOpt?.label || value;
  const currentEmoji = getOptionEmoji ? getOptionEmoji(value) : null;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: isOpen ? 'var(--brand-soft)' : 'var(--surface-2)',
          border: isOpen ? '1px solid var(--brand)' : '1px solid var(--border)',
          borderRadius: 9999,
          padding: '5px 12px 5px 10px',
          cursor: 'pointer',
          color: isOpen ? 'var(--brand-600)' : 'var(--text)',
          fontSize: 12.5,
          fontWeight: 700,
          transition: 'all var(--dur) var(--ease)',
          boxShadow: isOpen ? '0 0 0 2px var(--brand-soft)' : 'none',
          userSelect: 'none',
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {currentEmoji ? (
          <span style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            {currentEmoji}
          </span>
        ) : (
          icon && <Icon name={icon} size={13} style={{ color: 'var(--text-3)' }} />
        )}
        <span>{selectedLabel}</span>
        <Icon
          name="chevronDown"
          size={12}
          style={{
            color: 'var(--text-3)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/* Liquid-Glass Dropdown Menu with Pop Animation */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 175,
            zIndex: 100,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.24), 0 4px 12px rgba(0, 0, 0, 0.10)',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            animation: 'pop .18s var(--ease-out)',
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            const emoji = getOptionEmoji ? getOptionEmoji(opt.value) : null;

            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: isSelected ? 'var(--brand-soft)' : 'transparent',
                  color: isSelected ? 'var(--brand-600)' : 'var(--text)',
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: 12.5,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'var(--surface-2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {emoji && <span>{emoji}</span>}
                  <span>{opt.label}</span>
                </span>
                {isSelected && <Icon name="check" size={13} style={{ color: 'var(--brand)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Vertical fade under each series line, resolved lazily so the chart area exists. */
function makeGradient(context, color) {
  const { ctx, chartArea } = context.chart;
  if (!chartArea) return `${color}00`;
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight);
  gradient.addColorStop(0, `${color}28`);
  gradient.addColorStop(1, `${color}00`);
  return gradient;
}

export default function PaymentsPage() {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const [methodFilter, setMethodFilter] = useState('Today');

  const [timeframe, setTimeframe] = useState('daily');
  const fetchPaymentsFn = useCallback(() => fetchOwnerPayments(timeframe), [timeframe]);
  const { data: apiSummary } = useApi(fetchPaymentsFn, [timeframe]);

  const [selectedSport, setSelectedSport] = useState('ALL');
  const [sportFilter, setSportFilter] = useState('all');
  const [missed, setMissed] = useState(null);

  // Dynamic configured sports list derived from backend API for this owner
  const configuredSports = useMemo(() => {
    if (Array.isArray(apiSummary?.configuredSports)) return apiSummary.configuredSports;
    if (Array.isArray(apiSummary?.sports)) return apiSummary.sports;
    return [];
  }, [apiSummary]);

  const chartDataApi = useMemo(() => (apiSummary?.chartData && typeof apiSummary.chartData === 'object') ? apiSummary.chartData : { labels: [], datasets: {} }, [apiSummary]);
  const sportReport = Array.isArray(apiSummary?.sportReport) ? apiSummary.sportReport : [];
  const methodSplit = Array.isArray(apiSummary?.methodSplit) ? apiSummary.methodSplit : [];
  const KPIS = useMemo(() => Array.isArray(apiSummary?.kpis) ? apiSummary.kpis : [], [apiSummary]);
  const LEDGER = useMemo(() => Array.isArray(apiSummary?.ledger) ? apiSummary.ledger : [], [apiSummary]);
  const reconciliation = (apiSummary?.reconciliation && typeof apiSummary.reconciliation === 'object') ? apiSummary.reconciliation : {};
  
  const dark = theme === 'dark';

  // Dynamic sport filter options matching CalendarPage
  const sportOptions = useMemo(() => [
    { value: 'ALL', label: 'All Sports' },
    ...configuredSports.map((s) => ({ value: s.name, label: s.name })),
  ], [configuredSports]);

  const sportFilters = useMemo(() => [
    { id: 'all', label: 'All Sports' },
    ...configuredSports.map((s) => ({ id: s.name, label: s.label || s.name })),
  ], [configuredSports]);

  const chartData = useMemo(() => {
    const allAvailable = configuredSports.length > 0
      ? configuredSports.map(s => s.name)
      : Object.keys(chartDataApi.datasets || {});

    const activeSports = selectedSport === 'ALL'
      ? allAvailable
      : [selectedSport];

    return {
      labels: chartDataApi.labels || [],
      datasets: activeSports.map((name) => {
        const sportObj = configuredSports.find((item) => item.name === name || item.key === name) || {
          name,
          label: name,
          color: '#10B981',
        };
        const data = chartDataApi.datasets?.[name] || chartDataApi.datasets?.[sportObj.key] || [];
        const color = sportObj.color || '#10B981';
        return {
          label: sportObj.label || sportObj.name,
          data,
          borderColor: color,
          backgroundColor: (context) => makeGradient(context, color),
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          pointBackgroundColor: color,
          pointBorderColor: dark ? '#10170F' : '#FFFFFF',
          pointBorderWidth: 2,
        };
      }),
    };
  }, [chartDataApi, selectedSport, configuredSports, dark]);

  const chartOptions = useMemo(() => {
    const gridLine = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
    const tickText = dark ? '#A6B8AA' : '#4C5F55';
    return {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: dark ? '#1C291E' : '#FFFFFF',
          borderColor: dark ? '#2C3C2F' : '#E4EAE6',
          borderWidth: 1,
          cornerRadius: 10,
          padding: { top: 10, right: 14, bottom: 10, left: 14 },
          titleFont: { family: 'Inter, system-ui, sans-serif', weight: 600, size: 13 },
          bodyFont: { family: 'Inter, system-ui, sans-serif', weight: 600, size: 13 },
          titleColor: dark ? '#F2F6F2' : '#122019',
          usePointStyle: true,
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => ` ${item.dataset.label}:  ${CURRENCY(item.parsed.y)}`,
            labelColor: (item) => ({
              borderColor: item.dataset.borderColor,
              backgroundColor: item.dataset.borderColor,
              borderWidth: 2,
              borderRadius: 4,
            }),
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridLine, drawBorder: false },
          ticks: { color: tickText, font: FONT },
          border: { display: false },
        },
        y: {
          grid: { color: gridLine, drawBorder: false },
          ticks: { color: tickText, font: FONT, callback: AXIS_TICK },
          border: { display: false },
          beginAtZero: true,
        },
      },
    };
  }, [dark]);

  const visibleSportCards =
    sportFilter === 'all' ? sportReport : sportReport.filter((card) => card.sport === sportFilter);

  const resolvedKpis = useMemo(() => {
    return KPIS.map((kpi) => ({
      label: kpi.label,
      value: kpi.value,
      delta: kpi.delta,
      trend: kpi.trend,
      valueColor: kpi.label === 'Net to you' ? 'var(--brand-600)' : undefined
    }));
  }, [KPIS]);

  const resolvedLedger = useMemo(() => {
    return LEDGER.map((row) => ({
      id: row.id,
      time: row.time,
      booking: row.booking,
      customer: row.customer,
      method: row.method,
      txn: row.txn,
      gross: row.gross,
      fee: row.fee,
      net: row.net,
      status: row.status || { tone: 'green', text: 'Settled' },
      shift: row.shift,
      grossStyle: row.isRefund ? DANGER : undefined,
      netStyle: row.isRefund ? DANGER : undefined,
    }));
  }, [LEDGER]);

  const filteredLedger = useMemo(() => {
    return resolvedLedger.filter((row) => {
      if (methodFilter === 'Today') {
        return true;
      }
      if (methodFilter === 'Refunds') {
        return row.grossStyle != null || (row.status?.text || '').toLowerCase().includes('refund');
      }
      if (methodFilter === 'Unmatched') {
        return (row.status?.text || '').toLowerCase().includes('unmatched') || (row.status?.tone === 'amber');
      }
      return (row.method || '').toLowerCase().includes(methodFilter.toLowerCase());
    });
  }, [resolvedLedger, methodFilter]);

  const handleExportCsv = () => {
    downloadCsv(
      `payments-ledger-${timeframe}.csv`,
      ['Time', 'Booking', 'Customer', 'Method', 'Txn', 'Gross', 'Fee', 'Net', 'Status', 'Shift'],
      filteredLedger.map((row) => [
        row.time ?? '',
        row.booking ?? '',
        row.customer ?? '',
        row.method ?? '',
        row.txn ?? '',
        row.gross ?? '',
        row.fee ?? '',
        row.net ?? '',
        row.status?.text ?? '',
        row.shift ?? '',
      ]),
    );
    showToast(`Exported ${filteredLedger.length} transaction${filteredLedger.length === 1 ? '' : 's'} \u2713`);
  };

  const handleExportSummary = () => {
    const rows = [
      ...resolvedKpis.map((kpi) => ['KPI', kpi.label, kpi.value]),
      ...methodSplit.map((method) => [
        'Payment method',
        method.label ?? method.method ?? '',
        method.value ?? method.amount ?? '',
      ]),
      ...sportReport.map((card) => ['Sport', card.label ?? card.sport ?? '', card.revenue ?? card.value ?? '']),
    ];
    downloadCsv(`payments-summary-${timeframe}.csv`, ['Section', 'Label', 'Value'], rows);
    showToast('Summary report downloaded \u2713');
  };

  return (
    <>
      <PageTitle title="Payments & Reports" />

      <div className="main-header">
        <div>
          <h1>Payments &amp; reconciliation</h1>
          <span className="subtle small">Real-time owner financials &amp; settlement statement</span>
        </div>
        <div className="row">
          <Button
            variant="primary"
            onClick={handleExportCsv}
            disabled={filteredLedger.length === 0}
            title={filteredLedger.length === 0 ? 'No transactions to export yet' : undefined}
          >
            ⬇ Export CSV
          </Button>
        </div>
      </div>

      {/* ═══════ Net Income Over Time Chart ═══════ */}
      <div className="card income-chart-card" style={{ marginBottom: 20, padding: '20px 24px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
              Net Income Over Time
            </h2>
            {configuredSports.length > 1 && (
              <FilterPillDropdown
                label="Sport"
                value={selectedSport}
                onChange={setSelectedSport}
                getOptionEmoji={(val) => (val === 'ALL' ? '🏆' : getSportEmoji(val))}
                options={sportOptions}
              />
            )}
          </div>

          <div className="row-wrap" style={{ gap: 6 }} role="group" aria-label="Time range">
            {TIMEFRAMES.map((item) => (
              <Chip
                key={item.id}
                active={timeframe === item.id}
                onToggle={() => setTimeframe(item.id)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        </div>

        <ChartCanvas
          type="line"
          data={chartData}
          options={chartOptions}
          height={280}
          label="Net income chart"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid4" style={{ marginBottom: 16 }}>
        {resolvedKpis.map((kpi) => (
          <div className="kpi" key={kpi.label}>
            <span className="label">{kpi.label}</span>
            <b className="value num" style={kpi.valueColor ? { color: kpi.valueColor } : undefined}>
              {kpi.value}
            </b>
            <span className={kpi.trend ? `delta ${kpi.trend}` : 'delta'}>{kpi.delta}</span>
          </div>
        ))}
      </div>

      <div className="row-wrap" style={{ marginBottom: 12 }}>
        {METHOD_FILTERS.map((filter) => (
          <Chip key={filter} active={methodFilter === filter} onToggle={() => setMethodFilter(filter)}>
            {filter}
          </Chip>
        ))}
      </div>

      {/* Ledger Table */}
      <TableScroll label="Payment ledger" className="card" style={{ padding: 0, marginBottom: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Booking</th>
              <th>Customer</th>
              <th>Method</th>
              <th className="num">Gross</th>
              <th className="num">Fee</th>
              <th className="num">Net</th>
              <th>Status</th>
              <th>Shift · Source</th>
            </tr>
          </thead>
          <tbody>
            {filteredLedger.map((row) => (
              <tr key={row.id}>
                <td className="num">{row.time}</td>
                <td className="num">{row.booking}</td>
                <td>{row.customer}</td>
                <td>
                  {row.method}
                  {row.txn ? <span className="num">{row.txn}</span> : null}
                </td>
                <td className="num" style={row.grossStyle}>
                  {row.gross}
                </td>
                <td className="num">{row.fee}</td>
                <td className="num" style={row.netStyle}>
                  {row.net}
                </td>
                <td>
                  <Badge tone={row.status.tone}>{row.status.text}</Badge>
                </td>
                <td>{row.shift}</td>
              </tr>
            ))}
            {filteredLedger.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '24px 0' }}>
                  No matching transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>

      {/* Reconciliation Summary & Monthly Report */}
      <div className="grid2" style={{ alignItems: 'start' }} id="reports">
        <section className="card">
          <h3>Reconciliation summary</h3>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            <div className="between small">
              <span className="muted">Online (bKash · Nagad · card)</span>
              <b className="num">{reconciliation.onlineMatched || '৳0 · auto-matched ✓'}</b>
            </div>
            <div className="between small">
              <span className="muted">Cash collected (staff-logged)</span>
              <b className="num">{reconciliation.cashCollected || '৳0'}</b>
            </div>
            <div className="between small">
              <span className="muted">Deposits outstanding</span>
              <b className="num" style={{ color: 'var(--warn)' }}>
                {reconciliation.depositsOutstanding || '৳0'}
              </b>
            </div>
            <div className="between small">
              <span className="muted">Unmatched incoming</span>
              <b className="num" style={{ color: 'var(--warn)' }}>
                {reconciliation.unmatchedIncoming || '৳0 (0)'}
              </b>
            </div>
          </div>
          <Alert tone="ok" icon="🧾" title="Cash drawer vs ledger" style={{ marginTop: 12 }}>
            {reconciliation.drawerStatus || '—'}
          </Alert>
        </section>

        <section className="card">
          <h3>Reports · method split</h3>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {methodSplit.map((method) => (
              <div key={method.id}>
                <div className="between small">
                  <span className="muted">{method.label}</span>
                  <b className="num">{method.value}</b>
                </div>
                <div className="progress">
                  <i style={{ width: method.width, background: method.color }} />
                </div>
              </div>
            ))}
            {methodSplit.length === 0 && (
              <span className="muted small">No payment methods recorded yet</span>
            )}
          </div>
          <div className="panel between" style={{ marginTop: 12 }}>
            <div>
              <b className="small">Available Payout</b>
              <div className="tiny subtle">Verified Net Earnings</div>
            </div>
            <b className="num">{resolvedKpis.find((k) => k.label === 'Net to you')?.value || '৳0'}</b>
          </div>
          <div className="row-wrap" style={{ marginTop: 10, gap: 8 }}>
            <Button
              size="sm"
              onClick={handleExportSummary}
              disabled={resolvedKpis.length === 0 && methodSplit.length === 0 && sportReport.length === 0}
              title={
                resolvedKpis.length === 0 && methodSplit.length === 0 && sportReport.length === 0
                  ? 'No figures to report yet'
                  : undefined
              }
            >
              Download summary report
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled
              title="Digital invoices are not generated by the platform yet."
            >
              📄 Download digital invoice
            </Button>
          </div>
        </section>
      </div>

      {/* Sport Performance Report */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>🏆 Sport Performance &amp; Missed Slots Report</h3>
            <p className="subtle small" style={{ margin: '2px 0 0' }}>
              Detailed breakdown of revenue, occupancy, and missed/unbooked slots for your configured sports
            </p>
          </div>
          <div className="row-wrap" style={{ gap: 6 }}>
            {sportFilters.map((filter) => (
              <Chip key={filter.id} active={sportFilter === filter.id} onToggle={() => setSportFilter(filter.id)}>
                {filter.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid4" style={{ marginTop: 14, gap: 10 }}>
          {visibleSportCards.map((card) => (
            <div className="panel stack-sm sport-card" key={card.sport} style={{ padding: 12 }}>
              <div className="between">
                <b className="small">{card.title}</b>
                <Badge tone={card.occ.tone} dot={false} style={card.occ.style}>
                  {card.occ.text}
                </Badge>
              </div>
              <div className="between small">
                <span className="muted">Booked slots</span>
                <b className="num">{card.booked}</b>
              </div>
              <div className="between small">
                <span className="muted">Missed / empty slots</span>
                <b className="num" style={DANGER}>
                  {card.missed}
                </b>
              </div>
              <div className="progress">
                <i style={{ width: card.bar.width, background: card.bar.background }} />
              </div>
              <Button
                size="sm"
                variant="tertiary"
                className="view-missed-btn"
                style={{ marginTop: 6, width: '100%' }}
                onClick={() => setMissed(card)}
              >
                {card.cta}
              </Button>
            </div>
          ))}
          {visibleSportCards.length === 0 && (
            <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '24px 0' }} className="subtle small">
              No sport performance data available for this owner.
            </div>
          )}
        </div>
      </section>

      {/* Modal: Missed Slots Detail Report */}
      <Overlay
        isOpen={Boolean(missed)}
        onClose={() => setMissed(null)}
        title={missed ? `Missed Slots Detail · ${missed.sport}` : 'Missed Slots Detail'}
        maxWidth={520}
      >
        <p className="subtle small" style={{ margin: '4px 0 12px' }}>
          Analysis of unbooked, canceled, or missed slots to optimize your pricing &amp; promotions.
        </p>

        <div className="grid2" style={{ gap: 10, marginBottom: 12 }}>
          <div className="panel">
            <span className="tiny subtle">MISSED SLOTS</span>
            <br />
            <b className="num" style={DANGER}>
              {missed?.missedCount}
            </b>
          </div>
          <div className="panel">
            <span className="tiny subtle">ESTIMATED REVENUE LOSS</span>
            <br />
            <b className="num" style={DANGER}>
              {missed?.missedLoss}
            </b>
          </div>
        </div>

        <h4 style={{ margin: '10px 0 6px' }}>Missed Slot Log &amp; Reasons</h4>
        <div className="stack-sm" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {missed?.items?.map((item) => (
            <div className="panel between" key={item}>
              <span className="small">{item}</span>
              <Badge tone="red" dot={false}>
                Missed
              </Badge>
            </div>
          ))}
        </div>

        <Alert tone="info" icon="💡" title="Optimization Tip" style={{ marginTop: 14 }}>
          Create an off-peak promo for these unbooked times to boost occupancy.
        </Alert>

        <div className="stack-sm" style={{ marginTop: 14 }}>
          <Button variant="primary" block to={paths.owner.promotions}>
            Create promo for this sport →
          </Button>
          <Button variant="tertiary" block onClick={() => setMissed(null)}>
            Close
          </Button>
        </div>
      </Overlay>
    </>
  );
}