import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { BackButton } from '@/components/buttons/BackButton';
import { Overlay } from '@/components/modals/Overlay';
import { useApi } from '@/hooks/useApi';
import {
  DEMO_TOURNAMENT_CODE,
  getTournament,
  bdt,
  formatTime,
  formatDate,
} from '@/api/tournaments';
import { getMyProfile } from '@/api/players';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const FORMATS = ['Knockout · 16 teams', 'Group + knockout', 'League'];
const TEAM_COUNTS = ['8', '16', '24'];
const PAYMENT_METHODS = ['bKash', 'Nagad', 'Card', 'Bank transfer'];

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
  const [params] = useSearchParams();
  const code = params.get('code') ?? DEMO_TOURNAMENT_CODE;
  const tournament = useApi(() => getTournament(code), [code]);
  const live = tournament.data;

  const summary = live
    ? {
        venue: live.venueName,
        when: `${formatDate(live.date)} · ${formatTime(live.windowStart)} – ${formatTime(live.windowEnd)}`,
        slots: `${live.costs.slotCount} slots · ${new Set(live.reservations.map((r) => r.pitchName)).size} pitches`,
        slotCount: live.costs.slotCount,
        slotTotal: bdt(live.costs.slotTotal),
        discount: Number(live.costs.discount) > 0 ? `−${bdt(live.costs.discount)}` : '৳0',
        total: bdt(live.costs.total),
        deposit: bdt(live.costs.deposit),
        balance: bdt(live.costs.balance),
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

  const me = useApi(() => getMyProfile(), []);
  const [organizerOverride, setOrganizerOverride] = useState(null);
  const organizer =
    organizerOverride ??
    [me.data?.fullName, me.data?.phone].filter(Boolean).join(' · ') ??
    '';
  const setOrganizer = setOrganizerOverride;

  const [listPublicly, setListPublicly] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [method, setMethod] = useState('bKash');
  const [bkashNumber, setBkashNumber] = useState('');

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
                  <button
                    key={option}
                    className={method === option ? 'chip on' : 'chip'}
                    type="button"
                    onClick={() => setMethod(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <label htmlFor="bkNum">bKash number</label>
                <input
                  className="input num"
                  id="bkNum"
                  value={bkashNumber}
                  onChange={(event) => setBkashNumber(event.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-lg btn-block" type="button" onClick={reserved.open}>
                Pay {summary.deposit} deposit &amp; reserve
              </button>
              <p className="tiny subtle center" style={{ marginTop: 8 }}>
                🔒 Held for you while you pay · balance {summary.balance} due {summary.balanceDue}
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
          Deposit {summary.deposit} due via {method}. Reservation{' '}
          <b className="num">{live?.code ?? code}</b> holds {summary.slotCount} slots at{' '}
          {summary.venue} — payment capture arrives with the payments service.
        </p>
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
            onClick={() => {
              reserved.close();
              showToast('Receipt emailed & SMS sent 📩');
            }}
          >
            Send receipt
          </button>
        </div>
      </Overlay>
    </>
  );
}
