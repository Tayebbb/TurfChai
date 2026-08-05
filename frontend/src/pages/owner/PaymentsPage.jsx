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
import { paths } from '@/routes/paths';

/* ═══ API-Ready mock data: sport × timeframe ═══ */
const TF_LABELS = {
  daily: ['2 Aug', '3 Aug', '4 Aug', '5 Aug', '6 Aug', '7 Aug', '8 Aug'],
  weekly: ['W22', 'W23', 'W24', 'W25', 'W26', 'W27', 'W28', 'W29', 'W30', 'W31', 'W32', 'W33', 'W34', 'W35'],
  monthly: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
  yearly: ['2022', '2023', '2024', '2025', '2026'],
};

const CHART_DATA = {
  football: {
    daily: [6200, 8400, 4100, 10200, 9800, 7600, 8900],
    weekly: [42000, 49800, 45600, 54200, 51800, 47400, 56700, 60300, 53500, 50600, 58300, 61800, 55000, 59400],
    monthly: [156000, 171000, 163000, 189000, 170000, 157000, 195000, 207000, 187000, 216000, 229000, 245000],
    yearly: [980000, 1240000, 1650000, 2060000, 2368000],
  },
  cricket: {
    daily: [3800, 4200, 3100, 5000, 4800, 3900, 4500],
    weekly: [22000, 25600, 23800, 28400, 26900, 24800, 29400, 31200, 27800, 26200, 30100, 32000, 28500, 30800],
    monthly: [78000, 85600, 81400, 94200, 84600, 78200, 97000, 103000, 93300, 107800, 114000, 121800],
    yearly: [520000, 658000, 876000, 1094000, 1218000],
  },
  badminton: {
    daily: [2400, 3200, 2000, 3400, 3200, 2700, 2965],
    weekly: [14500, 16900, 15700, 18600, 17700, 16500, 19500, 20900, 18500, 17500, 20300, 21400, 19000, 20600],
    monthly: [51000, 55400, 53600, 61800, 55400, 51800, 64000, 68000, 61700, 71200, 75000, 80000],
    yearly: [350000, 442000, 594000, 736000, 882000],
  },
  futsal: {
    daily: [1800, 2100, 1400, 2600, 2400, 1900, 2200],
    weekly: [11200, 13400, 12200, 14800, 14100, 12900, 15300, 16500, 14600, 13800, 15900, 16800, 14900, 16200],
    monthly: [38000, 41200, 39800, 46000, 41200, 38600, 47600, 50600, 45900, 53000, 55800, 59500],
    yearly: [260000, 328000, 441000, 547000, 595000],
  },
  volleyball: {
    daily: [1200, 1500, 900, 1800, 1700, 1300, 1600],
    weekly: [8400, 9900, 9100, 10800, 10300, 9400, 11200, 11900, 10600, 10000, 11500, 12200, 10800, 11700],
    monthly: [28500, 31200, 29700, 34400, 30900, 28600, 35500, 37700, 34200, 39500, 41800, 44600],
    yearly: [195000, 246000, 327000, 409000, 468000],
  },
};

const TIMEFRAMES = [
  { id: 'daily', label: 'Daily (7 Days)' },
  { id: 'weekly', label: 'Weekly (14 Weeks)' },
  { id: 'monthly', label: 'Monthly (12 Months)' },
  { id: 'yearly', label: 'Yearly (5 Years)' },
];

const KPIS = [
  { label: 'Gross today', value: '৳19,750', delta: '14 transactions' },
  { label: 'Platform fees', value: '−৳1,185', delta: '6% on online only' },
  { label: 'Refunds', value: '−৳2,200', delta: '1 cancellation', trend: 'down' },
  { label: 'Net to you', value: '৳16,365', delta: 'Settles Mon 11 Aug', trend: 'up', valueColor: 'var(--brand-600)' },
];

const METHOD_FILTERS = ['Today', 'bKash', 'Nagad', 'Cash', 'Card', 'Refunds', 'Unmatched'];

const DANGER = { color: 'var(--danger)' };

const LEDGER = [
  {
    id: 'tc-48291',
    time: '6:12 PM',
    booking: 'TC-48291',
    customer: 'Rafiul Karim',
    method: 'bKash · ',
    txn: '8H2K19',
    gross: '৳2,550',
    fee: '−৳153',
    net: '৳2,397',
    status: { tone: 'green', text: 'Reconciled ✓' },
    shift: 'Evening · Online',
  },
  {
    id: 'og-7734',
    time: '5:47 PM',
    booking: 'OG-7734',
    customer: 'Open game (10 shares)',
    method: 'bKash / Nagad mix',
    gross: '৳2,800',
    fee: '−৳168',
    net: '৳2,632',
    status: { tone: 'green', text: 'Reconciled ✓' },
    shift: 'Evening · Online',
  },
  {
    id: 'tc-48277',
    time: '4:02 PM',
    booking: 'TC-48277',
    customer: 'Tanvir Ahmed',
    method: 'Card · Visa •••4412',
    gross: '৳2,500',
    fee: '−৳150',
    net: '৳2,350',
    status: { tone: 'green', text: 'Reconciled ✓' },
    shift: 'Evening · Online',
  },
  {
    id: 'tc-48288',
    time: '3:05 PM',
    booking: 'TC-48288',
    customer: 'Walk-in customer',
    method: 'Cash',
    gross: '৳1,700',
    fee: '—',
    net: '৳1,700',
    status: { tone: 'green', text: 'Logged by Sumon' },
    shift: 'Afternoon · Walk-in',
  },
  {
    id: 'tc-48285',
    time: '1:22 PM',
    booking: 'TC-48285',
    customer: 'Karim Traders XI',
    method: 'Nagad · ',
    txn: 'N7761',
    gross: '৳765',
    fee: '−৳46',
    net: '৳719',
    status: { tone: 'amber', text: 'Deposit · ৳1,785 due' },
    shift: 'Afternoon · Phone',
  },
  {
    id: 'tc-48102',
    time: '11:40 AM',
    booking: 'TC-48102',
    customer: 'Sadia Rahman',
    method: 'bKash refund · ',
    txn: 'R-2210',
    gross: '−৳2,200',
    grossStyle: DANGER,
    fee: '+৳132',
    net: '−৳2,068',
    netStyle: DANGER,
    status: { tone: 'blue', text: 'Refund sent' },
    shift: 'Morning · Online',
  },
  {
    id: 'unmatched',
    time: '10:15 AM',
    booking: '—',
    customer: 'Unknown sender',
    method: 'bKash · ',
    txn: '5T9Q02',
    gross: '৳1,700',
    fee: '—',
    net: '৳1,700',
    status: { tone: 'amber', text: 'Unmatched' },
    rowStyle: { background: 'var(--warn-soft)' },
    shiftAction: { label: 'Match…', toast: 'Matched to TC-48293 deposit ✓' },
  },
];


const METHOD_SPLIT = [
  { id: 'bkash', label: 'bKash', value: '54% · ৳2,41,300', width: '54%' },
  { id: 'cash', label: 'Cash', value: '21% · ৳93,800', width: '21%', color: 'var(--info)' },
  { id: 'nagad', label: 'Nagad', value: '15% · ৳67,000', width: '15%', color: 'var(--warn)' },
  { id: 'card', label: 'Card', value: '10% · ৳44,700', width: '10%', color: '#8B5CF6' },
];


const SPORT_FILTERS = [
  { id: 'all', label: 'All Sports' },
  { id: 'Football', label: '⚽ Football' },
  { id: 'Cricket', label: '🏏 Cricket' },
  { id: 'Futsal', label: '🥅 Futsal' },
  { id: 'Badminton', label: '🏸 Badminton' },
];


const SPORT_REPORT = [
  {
    sport: 'Football',
    title: '⚽ Football',
    occ: { tone: 'blue', text: '88% Occ.' },
    booked: '42 slots · ৳92,400',
    missed: '5 slots · −৳11,000',
    bar: { width: '88%' },
    cta: 'View 5 missed slots →',
    missedCount: '5 slots',
    missedLoss: '৳11,000',
    items: [
      'Tue 2:00–3:30 PM (Off-peak unbooked)',
      'Wed 10:00–11:30 AM (Rainy morning)',
      'Thu 4:00–5:30 PM (Late cancellation)',
      'Fri 1:00–2:30 PM (Jumma time window)',
      'Sun 2:00–3:30 PM (Off-peak unbooked)',
    ],
  },
  {
    sport: 'Cricket',
    title: '🏏 Cricket',
    occ: { tone: 'amber', text: '94% Occ.' },
    booked: '16 slots · ৳48,000',
    missed: '1 slot · −৳3,000',
    bar: { width: '94%', background: 'var(--warn)' },
    cta: 'View 1 missed slot →',
    missedCount: '1 slot',
    missedLoss: '৳3,000',
    items: ['Monday 10:00 AM–12:00 PM (Off-peak weekday)'],
  },
  {
    sport: 'Futsal',
    title: '🥅 Futsal',
    occ: { tone: 'green', text: '76% Occ.' },
    booked: '35 slots · ৳52,500',
    missed: '8 slots · −৳12,000',
    bar: { width: '76%', background: 'var(--success)' },
    cta: 'View 8 missed slots →',
    missedCount: '8 slots',
    missedLoss: '৳12,000',
    items: [
      'Mon 2:00 PM (Unfilled)',
      'Mon 3:00 PM (Unfilled)',
      'Tue 1:00 PM (Off-peak)',
      'Tue 2:00 PM (Off-peak)',
      'Wed 11:00 AM (Unfilled)',
      'Wed 12:00 PM (Unfilled)',
      'Thu 2:00 PM (Off-peak)',
      'Sun 1:00 PM (Unfilled)',
    ],
  },
  {
    sport: 'Badminton',
    title: '🏸 Badminton',
    occ: { tone: '', style: { background: 'var(--info-soft)', color: 'var(--info)' }, text: '82% Occ.' },
    booked: '24 slots · ৳24,000',
    missed: '4 slots · −৳4,000',
    bar: { width: '82%', background: 'var(--info)' },
    cta: 'View 4 missed slots →',
    missedCount: '4 slots',
    missedLoss: '৳4,000',
    items: [
      'Tue 11:00 AM (Unbooked)',
      'Wed 10:00 AM (Unbooked)',
      'Thu 11:20 AM (No-show)',
      'Sat 1:00 PM (Off-peak)',
    ],
  },
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

  const [timeframe, setTimeframe] = useState('daily');
  const [selectedSports, setSelectedSports] = useState(() => SPORTS.map((sport) => sport.key));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sportFilter, setSportFilter] = useState('all');
  const [missed, setMissed] = useState(null);

  const pickerRef = useRef(null);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  useClickOutside(pickerRef, closePicker, pickerOpen);
  useEscapeKey(closePicker, pickerOpen);


  const dark = theme === 'dark';

  const chartData = useMemo(
    () => ({
      labels: TF_LABELS[timeframe],
      datasets: selectedSports.map((key) => {
        const sport = SPORTS.find((item) => item.key === key);
        return {
          label: sport.label,
          data: CHART_DATA[key][timeframe],
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
    [timeframe, selectedSports, dark],
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
    sportFilter === 'all' ? SPORT_REPORT : SPORT_REPORT.filter((card) => card.sport === sportFilter);

  return (
    <>
      <PageTitle title="Payments" />

      <div className="main-header">
        <div>
          <h1>Payments &amp; reconciliation</h1>
          <span className="subtle small">Friday 8 Aug · every taka accounted for</span>
        </div>
        <div className="row">
          <Button onClick={() => showToast('Exported payments-2026-08-08.csv 📄')}>⬇ Export CSV</Button>
          <Button variant="primary" onClick={() => showToast('Evening shift closing — see Staff & Shifts')}>
            💵 Close shift
          </Button>
        </div>
      </div>



      {/* ═══════ Net Income Over Time Chart ═══════ */}
      <div className="card income-chart-card" style={{ marginBottom: 16, padding: '20px 24px 16px' }}>
        <div className="income-chart-header">
          <div className="income-chart-title-row">
            <h3 style={{ margin: 0, fontSize: 18 }}>Net Income Over Time</h3>
            <div className={`sport-picker${pickerOpen ? ' open' : ''}`} ref={pickerRef}>
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
              >
                {selectedSports.length === 0 ? (
                  <span className="sport-picker-placeholder">Select sports…</span>
                ) : (
                  [...selectedSports].reverse().map((key) => {
                    const sport = SPORTS.find((item) => item.key === key);
                    return (
                      <span
                        className="sport-tag"
                        key={key}
                        style={{ background: sport.tagBg, color: sport.color }}
                      >
                        <span className="sport-tag-dot" style={{ background: sport.color }} />
                        {sport.name}
                        <span
                          className="sport-tag-x"
                          role="button"
                          tabIndex={0}
                          aria-label={`Remove ${sport.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSport(key);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              toggleSport(key);
                            }
                          }}
                        >
                          ×
                        </span>
                      </span>
                    );
                  })
                )}
              </div>
              <div className="sport-picker-dropdown" role="listbox">
                <label>
                  <input
                    type="checkbox"
                    value="__all__"
                    checked={allSelected}
                    ref={(node) => {
                      if (node) node.indeterminate = selectedSports.length > 0 && !allSelected;
                    }}
                    onChange={(event) => toggleAllSports(event.target.checked)}
                  />{' '}
                  Select All
                </label>
                <div className="sp-divider" />
                {SPORTS.map((sport) => (
                  <label key={sport.key}>
                    <input
                      type="checkbox"
                      value={sport.key}
                      checked={selectedSports.includes(sport.key)}
                      onChange={() => toggleSport(sport.key)}
                    />
                    <span className="sp-color-dot" style={{ background: sport.color }} />
                    {sport.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="income-chart-filters" role="group" aria-label="Time range">
            {TIMEFRAMES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`income-tf-btn${timeframe === item.id ? ' active' : ''}`}
                onClick={() => setTimeframe(item.id)}
              >
                {item.label}
              </button>
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
        {KPIS.map((kpi) => (
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
            {LEDGER.map((row) => (
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
            {METHOD_SPLIT.map((method) => (
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
          </div>
          <div className="panel between" style={{ marginTop: 12 }}>
            <div>
              <b className="small">Next settlement</b>
              <div className="tiny subtle">Online net → City Bank •••2214</div>
            </div>
            <b className="num">৳48,220 · Mon 11 Aug</b>
          </div>
          <Button
            size="sm"
            style={{ marginTop: 10 }}
            onClick={() => showToast('Monthly report generated 📈')}
          >
            Generate monthly report
          </Button>
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