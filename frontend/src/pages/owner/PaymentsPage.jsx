import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { ChartCanvas } from '@/components/charts/ChartCanvas';
import { Chip } from '@/components/ui/Chip';
import { KpiCard } from '@/components/cards/KpiCard';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { SPORTS } from '@/data/owner';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useApi } from '@/hooks/useApi';
import { fetchOwnerPayments, closeOwnerShift, getInvoiceUrl, getCsvExportUrl } from '@/api/ownerPayments';
import { paths } from '@/routes/paths';

const TIMEFRAMES = [
  { id: 'daily', label: 'Daily (7 Days)' },
  { id: 'weekly', label: 'Weekly (14 Weeks)' },
  { id: 'monthly', label: 'Monthly (12 Months)' },
  { id: 'yearly', label: 'Yearly (5 Years)' },
];

const METHOD_FILTERS = ['Today', 'bKash', 'Nagad', 'Cash', 'Card', 'Refunds', 'Unmatched'];

const DANGER = { color: 'var(--danger)' };

const SPORT_FILTERS = [
  { id: 'all', label: 'All Sports' },
  { id: 'Football', label: '⚽ Football' },
  { id: 'Cricket', label: '🏏 Cricket' },
  { id: 'Futsal', label: '🥅 Futsal' },
  { id: 'Badminton', label: '🏸 Badminton' },
];


const CURRENCY = (value) => `৳${value.toLocaleString('en-IN')}`;
const AXIS_TICK = (v) =>
  `৳${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`;
const FONT = { family: 'Inter, system-ui, sans-serif', size: 12, weight: 500 };

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
  const methodChips = useFilterChips(['Today']);

  const { data: apiSummary } = useApi(fetchOwnerPayments, []);

  const [timeframe, setTimeframe] = useState('daily');
  const [selectedSports, setSelectedSports] = useState(() => SPORTS.map((sport) => sport.key));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sportFilter, setSportFilter] = useState('all');
  const [missed, setMissed] = useState(null);

  const pickerRef = useRef(null);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  useClickOutside(pickerRef, closePicker, pickerOpen);
  useEscapeKey(closePicker, pickerOpen);

  const handleExportCsv = () => {
    window.open(getCsvExportUrl(), '_blank');
    showToast('Exporting payments CSV... 📄');
  };

  const handleCloseShift = async () => {
    try {
      await closeOwnerShift();
      showToast('Evening shift closed successfully. Ledger balanced ✓');
    } catch {
      showToast('Evening shift closed — see Staff & Shifts');
    }
  };

  const chartDataApi = apiSummary?.chartData || { labels: [], datasets: {} };
  const sportReport = apiSummary?.sportReport || [];
  const methodSplit = apiSummary?.methodSplit || [];
  const KPIS = apiSummary?.kpis || [];
  const LEDGER = apiSummary?.ledger || [];
  
  const dark = theme === 'dark';

  const chartData = useMemo(
    () => ({
      labels: chartDataApi.labels || [],
      datasets: selectedSports.map((key) => {
        const sport = SPORTS.find((item) => item.key === key);
        const data = chartDataApi.datasets?.[key] || [];
        return {
          label: sport.label,
          data,
          borderColor: sport.color,
          backgroundColor: (context) => makeGradient(context, sport.color),
          borderWidth: 2.5,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: sport.color,
          pointBorderColor: dark ? '#10170F' : '#FFFFFF',
          pointBorderWidth: 2,
        };
      }),
    }),
    [chartDataApi, selectedSports, dark],
  );

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

  function toggleSport(key) {
    setSelectedSports((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function toggleAllSports(checked) {
    setSelectedSports(checked ? SPORTS.map((sport) => sport.key) : []);
  }

  const allSelected = selectedSports.length === SPORTS.length;
  const visibleSportCards =
    sportFilter === 'all' ? sportReport : sportReport.filter((card) => card.sport === sportFilter);

  const resolvedKpis = useMemo(() => {
    if (!apiSummary?.kpis) return KPIS;
    return [
      { label: 'Gross today', value: apiSummary.kpis.grossToday, delta: apiSummary.kpis.deltaInfo },
      { label: 'Platform fees', value: apiSummary.kpis.platformFees, delta: '6% on online only' },
      { label: 'Refunds', value: apiSummary.kpis.refunds, delta: '1 cancellation', trend: 'down' },
      { label: 'Net to you', value: apiSummary.kpis.netToYou, delta: apiSummary.kpis.nextSettlementDate, trend: 'up', valueColor: 'var(--brand-600)' },
    ];
  }, [apiSummary]);

  const resolvedLedger = useMemo(() => {
    if (!apiSummary?.ledger) return LEDGER;
    return apiSummary.ledger.map((row) => ({
      id: row.id,
      time: row.time,
      booking: row.booking,
      customer: row.customer,
      method: row.method,
      txn: row.txn,
      gross: row.gross,
      fee: row.fee,
      net: row.net,
      status: { tone: row.statusTone || 'green', text: row.statusText },
      shift: row.shift,
      grossStyle: row.isRefund ? DANGER : undefined,
      netStyle: row.isRefund ? DANGER : undefined,
    }));
  }, [apiSummary]);

  return (
    <>
      <PageTitle title="Payments" />

      <div className="main-header">
        <div>
          <h1>Payments &amp; reconciliation</h1>
          <span className="subtle small">Friday 8 Aug · every taka accounted for</span>
        </div>
        <div className="row">
          <Button onClick={handleExportCsv}>⬇ Export CSV</Button>
          <Button variant="primary" onClick={handleCloseShift}>
            💵 Close shift
          </Button>
        </div>
      </div>



      {/* ═══════ Net Income Over Time Chart ═══════ */}
      <div className="card income-chart-card" style={{ marginBottom: 16, padding: '20px 24px 16px' }}>
        <div className="income-chart-header">
          <div className="income-chart-title-row">
            <h3 style={{ margin: 0, fontSize: 18 }}>Net Income Over Time</h3>
            <div
              className={`sport-picker${pickerOpen ? ' open' : ''}`}
              ref={pickerRef}
              style={{ position: 'relative', display: 'inline-block' }}
            >
              <div
                className="sport-picker-trigger"
                role="button"
                tabIndex={0}
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
                aria-label="Select sports to compare"
                onClick={() => setPickerOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setPickerOpen((open) => !open);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 10,
                  background: dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                  border: dark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minHeight: 38,
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {selectedSports.length === 0 ? (
                    <span className="subtle small">Select sports…</span>
                  ) : (
                    [...selectedSports].reverse().map((key) => {
                      const sport = SPORTS.find((item) => item.key === key);
                      return (
                        <span
                          className="sport-tag"
                          key={key}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background: sport.tagBg,
                            color: 'var(--text-1)',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: sport.color,
                            }}
                          />
                          {sport.name}
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`Remove ${sport.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSport(key);
                            }}
                            style={{
                              marginLeft: 2,
                              cursor: 'pointer',
                              opacity: 0.7,
                              fontWeight: 700,
                            }}
                          >
                            ×
                          </span>
                        </span>
                      );
                    })
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>▾</span>
              </div>
              <div
                className="sport-picker-dropdown"
                role="listbox"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 99,
                  minWidth: 220,
                  padding: 8,
                  borderRadius: 14,
                  background: dark ? 'rgba(22, 34, 26, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: dark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.12)',
                  boxShadow: dark ? '0 12px 32px rgba(0,0,0,0.5)' : '0 12px 32px rgba(0,0,0,0.18)',
                  display: pickerOpen ? 'flex' : 'none',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
              >
                <div
                  onClick={() => toggleAllSports(!allSelected)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    background: allSelected ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    color: allSelected ? 'var(--brand-500, #10B981)' : 'var(--text-1)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: '2px solid',
                      borderColor: allSelected ? 'var(--brand-500)' : 'var(--text-3)',
                      background: allSelected ? 'var(--brand-500)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    {allSelected ? '✓' : ''}
                  </span>
                  Select All Sports
                </div>

                <div style={{ height: 1, background: 'var(--border-soft)', margin: '4px 0' }} />

                {SPORTS.map((sport) => {
                  const isSelected = selectedSports.includes(sport.key);
                  return (
                    <div
                      key={sport.key}
                      onClick={() => toggleSport(sport.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        background: isSelected ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent',
                        color: 'var(--text-1)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            border: '2px solid',
                            borderColor: isSelected ? sport.color : 'var(--text-3)',
                            background: isSelected ? sport.color : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          {isSelected ? '✓' : ''}
                        </span>
                        <span>{sport.label}</span>
                      </div>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: sport.color,
                          boxShadow: `0 0 6px ${sport.color}`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
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
          <Chip key={filter} active={methodChips.isActive(filter)} onToggle={() => methodChips.toggle(filter)}>
            {filter}
          </Chip>
        ))}
      </div>

      <div className="card table-wrap" style={{ padding: 0, marginBottom: 16 }}>
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
            {resolvedLedger.map((row) => (
              <tr key={row.id} style={row.rowStyle}>
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
                <td>
                  {row.shiftAction ? (
                    <Button size="sm" onClick={() => showToast(row.shiftAction.toast)}>
                      {row.shiftAction.label}
                    </Button>
                  ) : (
                    row.shift
                  )}
                </td>
              </tr>
            ))}
            {resolvedLedger.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '24px 0' }}>
                  No payments found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>



      <div className="grid2" style={{ alignItems: 'start' }} id="reports">
        <section className="card">
          <h3>Reconciliation summary</h3>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            <div className="between small">
              <span className="muted">Online (bKash · Nagad · card)</span>
              <b className="num">৳7,850 · auto-matched ✓</b>
            </div>
            <div className="between small">
              <span className="muted">Cash collected (staff-logged)</span>
              <b className="num">৳1,700</b>
            </div>
            <div className="between small">
              <span className="muted">Deposits outstanding</span>
              <b className="num" style={{ color: 'var(--warn)' }}>
                ৳4,300
              </b>
            </div>
            <div className="between small">
              <span className="muted">Unmatched incoming</span>
              <b className="num" style={{ color: 'var(--warn)' }}>
                ৳1,700 (1)
              </b>
            </div>
          </div>
          <Alert tone="ok" icon="🧾" title="Cash drawer vs ledger" style={{ marginTop: 12 }}>
            Afternoon shift closed by Sumon: expected ৳1,700, counted ৳1,700 — <b>balanced ✓</b>
          </Alert>
        </section>


        <section className="card">
          <h3>Reports · this month</h3>
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
              <span className="muted small">No data</span>
            )}
          </div>
          <div className="panel between" style={{ marginTop: 12 }}>
            <div>
              <b className="small">Next settlement</b>
              <div className="tiny subtle">Online net → City Bank •••2214</div>
            </div>
            <b className="num">৳48,220 · Mon 11 Aug</b>
          </div>
          <div className="row-wrap" style={{ marginTop: 10, gap: 8 }}>
            <Button
              size="sm"
              onClick={() => showToast('Monthly report generated 📈')}
            >
              Generate monthly report
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.open(getInvoiceUrl(), '_blank')}
            >
              📄 Download digital invoice
            </Button>
          </div>
        </section>
      </div>


      <section className="card" style={{ marginTop: 16 }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>🏆 Sport Performance &amp; Missed Slots Report</h3>
            <p className="subtle small" style={{ margin: '2px 0 0' }}>
              Detailed breakdown of revenue, occupancy, and missed/unbooked slots for each sport
            </p>
          </div>
          <div className="row-wrap" style={{ gap: 6 }}>
            {SPORT_FILTERS.map((filter) => (
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
          {missed?.items.map((item) => (
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