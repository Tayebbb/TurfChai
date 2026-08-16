import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { BackButton } from '@/components/buttons/BackButton';
import { Overlay } from '@/components/modals/Overlay';
import { useApi } from '@/hooks/useApi';
import { useHostTournamentCode } from './useHostTournamentCode';
import {
  getTournament,
  payDeposit,
  quoteReservation,
  bdt,
  formatTime,
  formatDate,
} from '@/api/tournaments';
import { useSession } from '@/hooks/useSession';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { Chip } from '@/components/ui/Chip';
import { paths } from '@/routes/paths';

const FORMATS = ['Knockout · 16 teams', 'Group + knockout', 'League'];
const TEAM_COUNTS = ['8', '16', '24'];
const PAYMENT_METHODS = ['bKash', 'Nagad', 'Card', 'Bank transfer'];

/** Methods that settle against the payer's own mobile-wallet number. */
const WALLET_METHODS = new Set(['bKash', 'Nagad']);

const REPEAT_OPTIONS = [1, 2, 4, 6, 8, 12];

const repeatLabel = (weeks) =>
  weeks === 1 ? 'One-off · single day' : `Weekly · ${weeks} weeks`;

const POLICY_POINTS = (summary) => [
  <>
    <b>Deposit:</b> 40% now ({summary.deposit}) secures all {summary.slotCount} slots · balance due 3
    days before event
  </>,
  <>
    <b>Free cancellation</b> up to 7 days before · 50% refund up to 72h · none after
  </>,
  <>
    <b>Rain policy:</b> covered pitches unaffected; open pitches reschedule free within 30 days
  </>,
  <>Venue provides: floodlights, changing rooms, parking for 40, first-aid kit</>,
];

export default function ReservePage() {
  const { showToast } = useToast();
  const reserved = useDisclosure(false);
  const { code } = useHostTournamentCode();
  const tournament = useApi(() => (code ? getTournament(code) : Promise.resolve(null)), [code]);
  const live = tournament.data;

  // Recurrence drives the price, so the quote is re-fetched on every change.
  // It writes nothing server-side.
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [syncedCode, setSyncedCode] = useState(null);
  if (live && syncedCode !== live.code) {
    // Adopt the recurrence already booked, so a reloaded page does not quote a
    // single week against a reservation that spans several.
    setSyncedCode(live.code);
    setRepeatWeeks(live.repeatWeeks ?? 1);
  }

  const quote = useApi(
    () => (code ? quoteReservation(code, repeatWeeks) : Promise.resolve(null)),
    [code, repeatWeeks],
  );
  const depositPaid = live?.deposit?.status === 'PAID';
  // Once settled the booking is fact, not a quote.
  const costs = (depositPaid ? live?.costs : quote.data?.costs) ?? live?.costs ?? null;
  const weekOptions = REPEAT_OPTIONS.includes(repeatWeeks)
    ? REPEAT_OPTIONS
    : [...REPEAT_OPTIONS, repeatWeeks].sort((a, b) => a - b);

  const summary = live
    ? {
        venue: live.venueName,
        when: `${formatDate(live.date)} · ${formatTime(live.windowStart)} – ${formatTime(live.windowEnd)}`,
        slots: `${costs?.slotCount ?? 0} slots · ${new Set(live.reservations.map((r) => r.pitchName)).size} pitches`,
        slotCount: costs?.slotCount ?? 0,
        slotTotal: bdt(costs?.slotTotal ?? 0),
        discount: Number(costs?.discount) > 0 ? `−${bdt(costs.discount)}` : '৳0',
        total: bdt(costs?.total ?? 0),
        deposit: bdt(costs?.deposit ?? 0),
        balance: bdt(costs?.balance ?? 0),
        balanceDue: formatDate(live.balanceDueDate),
      }
    : {
        // Neutral placeholders while loading or when the API is unreachable.
        venue: '—',
        when: '—',
        slots: 'No slots reserved yet',
        slotCount: 0,
        slotTotal: '—',
        discount: '—',
        total: '—',
        deposit: '—',
        balance: '—',
        balanceDue: '—',
      };

  // Form mirrors the live tournament once it loads; edits stay local.
  const [nameOverride, setNameOverride] = useState(null);
  const name = nameOverride ?? live?.name ?? '';
  const setName = setNameOverride;
  const [formatOverride, setFormatOverride] = useState(null);
  const format =
    formatOverride ??
    (live?.format
      ? `${live.format.charAt(0)}${live.format.slice(1).toLowerCase().replaceAll('_', '-')}`
      : FORMATS[0]);
  const setFormat = setFormatOverride;
  const [teamsOverride, setTeamsOverride] = useState(null);
  const teams = teamsOverride ?? (live ? String(live.teamCapacity) : '16');
  const setTeams = setTeamsOverride;

  const me = useSession();
  const [organizerOverride, setOrganizerOverride] = useState(null);
  const organizer =
    organizerOverride ??
    [me.user?.fullName, me.user?.phone].filter(Boolean).join(' · ') ??
    '';
  const setOrganizer = setOrganizerOverride;

  const [listPublicly, setListPublicly] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [method, setMethod] = useState('bKash');
  const [bkashNumber, setBkashNumber] = useState('');
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const walletMethod = WALLET_METHODS.has(method);
  const hasSlots = summary.slotCount > 0;

  const onPayDeposit = async () => {
    if (!agreedToTerms) {
      showToast('Please accept the reservation terms first');
      return;
    }
    setPaying(true);
    try {
      const updated = await payDeposit(code, {
        repeatWeeks,
        method,
        payerReference: walletMethod ? bkashNumber.trim() || undefined : undefined,
      });
      setReceipt(updated.deposit ?? null);
      tournament.reload();
      quote.reload();
      reserved.open();
    } catch (error) {
      showToast(
        error.status === 409
          ? `⚠️ ${error.message}`
          : error.message || 'Could not take the deposit — please try again',
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <PageTitle title="Reserve for tournament" />

      <div className="wrap wrap-narrow" style={{ paddingTop: 20, paddingBottom: 40, maxWidth: 960 }}>
        <BackButton to={paths.host.multiPitch}>Pitch timeline</BackButton>
        <h1 style={{ fontSize: 22, marginBottom: 14 }}>Reserve for your tournament</h1>

        <div className="grid2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <section className="card">
              <h3>1 · Tournament details</h3>
              <div className="field" style={{ marginTop: 8 }}>
                <label htmlFor="tName">Tournament name</label>
                <input
                  className="input"
                  id="tName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="tFmt">Format</label>
                  <select
                    className="select"
                    id="tFmt"
                    value={format}
                    onChange={(event) => setFormat(event.target.value)}
                  >
                    {FORMATS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="tTeams">Teams</label>
                  <select
                    className="select"
                    id="tTeams"
                    value={teams}
                    onChange={(event) => setTeams(event.target.value)}
                  >
                    {TEAM_COUNTS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="tOrg">Organizer contact</label>
                <input
                  className="input"
                  id="tOrg"
                  value={organizer}
                  onChange={(event) => setOrganizer(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="tRepeat">Recurring weekly booking</label>
                <select
                  className="select"
                  id="tRepeat"
                  value={repeatWeeks}
                  disabled={depositPaid}
                  onChange={(event) => setRepeatWeeks(Number(event.target.value))}
                >
                  {weekOptions.map((option) => (
                    <option key={option} value={option}>
                      {repeatLabel(option)}
                    </option>
                  ))}
                </select>
                <span className="tiny subtle">
                  {depositPaid
                    ? `Booked · ${repeatLabel(repeatWeeks).toLowerCase()}.`
                    : quote.loading
                      ? 'Pricing…'
                      : quote.error
                        ? 'Live price unavailable — showing the single-day total.'
                        : repeatWeeks === 1
                          ? 'The same pitches and times can repeat every week.'
                          : `Repeats the same pitches and times through ${formatDate(quote.data?.lastDate)}.`}
                </span>
              </div>
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={listPublicly}
                  onChange={(event) => setListPublicly(event.target.checked)}
                />
                <span>List this tournament publicly so teams can find it on TurfChai</span>
              </label>
            </section>

            <section className="card">
              <h3>2 · Policy &amp; terms</h3>
              <ul className="small muted" style={{ margin: '8px 0 0', paddingLeft: 16, lineHeight: 1.9 }}>
                {POLICY_POINTS(summary).map((point, index) => (
                  // Static copy — index keys are stable here.
                  <li key={index}>{point}</li>
                ))}
              </ul>
              <label className="checkline" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                />
                <span>I agree to the reservation terms and venue rules</span>
              </label>
            </section>

            <section className="card">
              <h3>3 · Pay deposit</h3>
              <div className="row-wrap" style={{ marginTop: 8 }}>
                {PAYMENT_METHODS.map((option) => (
                  <Chip key={option} active={method === option} onToggle={() => setMethod(option)}>
                    {option}
                  </Chip>
                ))}
              </div>
              {walletMethod ? (
                <div className="field" style={{ marginTop: 10 }}>
                  <label htmlFor="bkNum">{method} number</label>
                  <input
                    className="input num"
                    id="bkNum"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={bkashNumber}
                    onChange={(event) => setBkashNumber(event.target.value)}
                  />
                </div>
              ) : null}
              <button
                className="btn btn-primary btn-lg btn-block"
                type="button"
                disabled={paying || depositPaid || !agreedToTerms || !hasSlots}
                onClick={onPayDeposit}
              >
                {depositPaid
                  ? 'Deposit paid ✓'
                  : paying
                    ? 'Taking payment…'
                    : `Pay ${summary.deposit} deposit & reserve`}
              </button>
              <p className="tiny subtle center" style={{ marginTop: 8 }}>
                {!hasSlots ? (
                  <>
                    Add pitch slots on the timeline before paying —{' '}
                    <Link to={paths.host.multiPitch}>pick your slots</Link>
                  </>
                ) : depositPaid ? (
                  <>
                    ✓ Deposit settled · balance {summary.balance} due {summary.balanceDue}
                  </>
                ) : (
                  <>
                    🔒 Held for you while you pay · balance {summary.balance} due {summary.balanceDue}
                  </>
                )}
              </p>
            </section>
          </div>

          <aside className="glass glass-card" style={{ position: 'sticky', top: 84 }}>
            <b style={{ fontFamily: 'var(--font-display)' }}>Reservation summary</b>
            <div className="panel" style={{ margin: '10px 0' }}>
              <b className="small">
                {summary.venue} <span className="verified">✓</span>
              </b>
              <div className="tiny subtle">{summary.when}</div>
              <div className="tiny subtle" style={{ marginTop: 4 }}>
                {summary.slots}
              </div>
            </div>
            <div className="pricerow">
              <span>{summary.slotCount} pitch-slots</span>
              <span className="num">{summary.slotTotal}</span>
            </div>
            {repeatWeeks > 1 ? (
              <div className="pricerow">
                <span>Weekly repeat</span>
                <span className="num">
                  {quote.data ? `${quote.data.slotsPerWeek} slots × ${repeatWeeks} weeks` : `${repeatWeeks} weeks`}
                </span>
              </div>
            ) : null}
            <div className="pricerow neg">
              <span>Multi-pitch discount</span>
              <span className="num">{summary.discount}</span>
            </div>
            <div className="pricerow total">
              <span>Total</span>
              <span className="num">{summary.total}</span>
            </div>
            <div className="pricerow">
              <span>Deposit due now (40%)</span>
              <span className="num">
                <b>{summary.deposit}</b>
              </span>
            </div>
            <div className="pricerow">
              <span>Balance · by {summary.balanceDue}</span>
              <span className="num">{summary.balance}</span>
            </div>
            <div className="alert info" style={{ marginTop: 10 }}>
              <span className="ico">💡</span>
              <div className="tiny">
                One reservation covers everything — the venue blocks all {summary.slotCount} slots the
                moment your deposit clears.
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Overlay
        isOpen={reserved.isOpen}
        onClose={reserved.close}
        title={`${name} is booked!`}
        hideHeader
        className="center"
      >
        <div className="check-anim" aria-hidden="true">
          🏆
        </div>
        <h3>{name} is booked!</h3>
        <p className="muted small">
          Deposit {receipt ? bdt(receipt.amount) : summary.deposit} received via{' '}
          {receipt?.method ?? method}. Reservation{' '}
          <b className="num">{live?.code ?? code}</b> holds {summary.slotCount} slots at{' '}
          {summary.venue}
          {repeatWeeks > 1 ? ` across ${repeatWeeks} weeks` : ''}.
        </p>
        {receipt?.reference ? (
          <p className="tiny subtle">
            Payment reference <b className="num">{receipt.reference}</b>
          </p>
        ) : null}
        <div className="stack-sm" style={{ marginTop: 12 }}>
          <Link
            className="btn btn-primary btn-block"
            to={live ? `${paths.host.tournament}?code=${live.code}` : paths.host.tournament}
          >
            Go to your tournament →
          </Link>
          <button
            className="btn btn-tertiary btn-block"
            type="button"
            disabled
            title="Emailed and texted receipts are not sent by the platform yet — the reservation is recorded on your tournament page."
          >
            Send receipt
          </button>
        </div>
      </Overlay>
    </>
  );
}
