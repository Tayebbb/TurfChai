import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { BackButton } from '@/components/buttons/BackButton';
import { Overlay } from '@/components/modals/Overlay';
import { ramadanCup } from '@/data/tournaments';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const FORMATS = ['Knockout · 16 teams', 'Group + knockout', 'League'];
const TEAM_COUNTS = ['8', '16', '24'];
const PAYMENT_METHODS = ['bKash', 'Nagad', 'Card', 'Bank transfer'];

const POLICY_POINTS = [
  <>
    <b>Deposit:</b> 40% now (৳17,120) secures all 14 slots · balance due 3 days before event
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

  const [name, setName] = useState(ramadanCup.name);
  const [format, setFormat] = useState(FORMATS[0]);
  const [teams, setTeams] = useState('16');
  const [organizer, setOrganizer] = useState('Shakil Ahmed Liton · +880 1552 887 990');
  const [listPublicly, setListPublicly] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [method, setMethod] = useState('bKash');
  const [bkashNumber, setBkashNumber] = useState('+880 1552 887 990');

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
                {POLICY_POINTS.map((point, index) => (
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
                Pay ৳17,120 deposit &amp; reserve
              </button>
              <p className="tiny subtle center" style={{ marginTop: 8 }}>
                🔒 Held for you while you pay · balance ৳25,680 due Wed 20 Aug
              </p>
            </section>
          </div>

          <aside className="glass glass-card" style={{ position: 'sticky', top: 84 }}>
            <b style={{ fontFamily: 'var(--font-display)' }}>Reservation summary</b>
            <div className="panel" style={{ margin: '10px 0' }}>
              <b className="small">
                Mirpur Sports City <span className="verified">✓</span>
              </b>
              <div className="tiny subtle">Mirpur 10 · Sat 23 Aug 2026 · 8:00 AM – 6:00 PM</div>
              <div className="tiny subtle" style={{ marginTop: 4 }}>
                14 slots · Pitches A, B, D (+ C partial)
              </div>
            </div>
            <div className="pricerow">
              <span>14 pitch-slots</span>
              <span className="num">৳44,600</span>
            </div>
            <div className="pricerow neg">
              <span>Multi-pitch discount</span>
              <span className="num">−৳1,800</span>
            </div>
            <div className="pricerow total">
              <span>Total</span>
              <span className="num">৳42,800</span>
            </div>
            <div className="pricerow">
              <span>Deposit due now (40%)</span>
              <span className="num">
                <b>৳17,120</b>
              </span>
            </div>
            <div className="pricerow">
              <span>Balance · by 20 Aug</span>
              <span className="num">৳25,680</span>
            </div>
            <div className="alert info" style={{ marginTop: 10 }}>
              <span className="ico">💡</span>
              <div className="tiny">
                One reservation covers everything — the venue blocks all 14 slots the moment your deposit clears.
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Overlay
        isOpen={reserved.isOpen}
        onClose={reserved.close}
        title="Ramadan Cup is booked!"
        hideHeader
        className="center"
      >
        <div className="check-anim" aria-hidden="true">
          🏆
        </div>
        <h3>Ramadan Cup is booked!</h3>
        <p className="muted small">
          Deposit ৳17,120 received via bKash (TXN 7R2M88). Reservation{' '}
          <b className="num">{ramadanCup.id}</b> confirmed — venue contact and schedule tools are on your
          dashboard.
        </p>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          <Link className="btn btn-primary btn-block" to={paths.host.hub}>
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
