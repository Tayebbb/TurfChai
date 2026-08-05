import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { Overlay } from '@/components/modals/Overlay';
import { fridayNightRoster } from '@/data/games';
import { useCountdown } from '@/hooks/useCountdown';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './GameDetailPage.css';

const LOCK_SECONDS = 240;
const PAYMENT_METHODS = ['bKash', 'Nagad', 'Card'];

const MATCH_FACTS = [
  { id: 'format', label: 'FORMAT', value: '7-a-side · 90 min' },
  { id: 'skill', label: 'SKILL', value: 'Intermediate' },
  { id: 'venue', label: 'VENUE', value: 'Kick Off Arena ✓' },
];

const MATCH_FIT = [
  'Skill: Intermediate — same as yours',
  '1.2 km from Dhanmondi · you played here 25 Jul',
  'Tonight 9 PM fits your usual evening window',
];

const RULES = [
  'Turf shoes only · no metal studs',
  'If you cancel more than 6h before kickoff: full share refunded',
  'Within 6h: refunded only if a replacement joins',
  'No-show without notice lowers your reliability score',
];

export default function GameDetailPage() {
  const { showToast } = useToast();
  const payShare = useDisclosure(false);
  const { label: lockLabel } = useCountdown(LOCK_SECONDS);
  const [method, setMethod] = useState('bKash');

  return (
    <>
      <PageTitle title="Friday Night Football" />

      <main className="wrap" id="main" style={{ paddingTop: 20, maxWidth: 1000 }}>
        <Breadcrumbs
          items={[
            { label: 'Open games', to: paths.solo.openGames },
            { label: 'Friday Night Football' },
          ]}
        />

        <div className="between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div>
            <div className="row-wrap" style={{ marginBottom: 6 }}>
              <span className="badge red">Needs 1 player · urgent</span>
              <span className="badge green nodot">Instant join</span>
              <span className="skill">Intermediate</span>
            </div>
            <h1 style={{ fontSize: 24, marginBottom: 2 }}>Friday Night Football</h1>
            <span className="subtle">
              Kick Off Arena · Pitch 2 · Dhanmondi 27 ·{' '}
              <b className="num" style={{ color: 'var(--text)' }}>
                Tonight 9:00–10:30 PM
              </b>
            </span>
          </div>
        </div>

        <div className="gd-grid">
          <div className="stack">
            <section className="card">
              <h3>Match info</h3>
              <div className="grid3" style={{ marginTop: 8, gap: 10 }}>
                {MATCH_FACTS.map((fact) => (
                  <div className="panel" key={fact.id}>
                    <span className="tiny subtle">{fact.label}</span>
                    <br />
                    <b>{fact.value}</b>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ margin: '12px 0 0' }}>
                Friendly but competitive weekly game. Bibs provided. We rotate keepers every 15 minutes. Arrive by{' '}
                <b>8:50 PM</b> for handover — the turf owner manages pitch entry.
              </p>
            </section>

            <section className="card">
              <div className="between">
                <h3 style={{ margin: 0 }}>Host</h3>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => showToast('Chat with host opened 💬')}
                >
                  Message
                </button>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <span className="avatar lg c">RH</span>
                <div>
                  <b>Rifat Hossain</b>
                  <div className="subtle small">Hosting since 2024 · 68 games hosted</div>
                  <div className="row-wrap" style={{ marginTop: 4 }}>
                    <span className="rating">4.9</span>
                    <span className="badge blue nodot">97% reliability</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="card">
              <h3>Roster · 9 of 10</h3>
              <div className="row-wrap" style={{ marginTop: 10 }}>
                {fridayNightRoster.map((player) => (
                  <span key={player.id} className={player.tone ? `avatar ${player.tone}` : 'avatar'}>
                    {player.initials}
                  </span>
                ))}
                <span
                  className="avatar"
                  style={{ background: 'var(--warn-soft)', color: 'var(--warn)', borderStyle: 'dashed' }}
                >
                  ?
                </span>
              </div>
              <p className="subtle small" style={{ margin: '8px 0 0' }}>
                The open spot is a <b>midfielder or winger</b> — but any position welcome.
              </p>
            </section>

            <section className="card">
              <h3>Rules &amp; cancellation</h3>
              <ul className="small muted" style={{ margin: '6px 0 10px', paddingLeft: 18, lineHeight: 1.9 }}>
                {RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <button
                className="btn btn-sm btn-ghost-danger"
                type="button"
                onClick={() => showToast('Report sent to TurfChai safety team 🛡️')}
              >
                Report this game
              </button>
            </section>
          </div>

          {/* Join panel */}
          <aside className="glass glass-card" style={{ position: 'sticky', top: 84 }}>
            <div className="between">
              <span>
                <b className="num" style={{ fontSize: 22 }}>
                  ৳280
                </b>{' '}
                <span className="subtle">your share</span>
              </span>
              <span className="badge red">1 spot left</span>
            </div>
            <div className="panel" style={{ margin: '12px 0' }}>
              <div className="between small">
                <span className="muted">Match fit</span>
                <b style={{ color: 'var(--brand-600)' }}>Great match ✓</b>
              </div>
              <ul className="tiny muted" style={{ margin: '6px 0 0', paddingLeft: 16, lineHeight: 1.8 }}>
                {MATCH_FIT.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <button className="btn btn-primary btn-lg btn-block" type="button" onClick={payShare.open}>
              Join match
            </button>
            <p className="tiny subtle center" style={{ marginTop: 8 }}>
              Instant join · your spot is locked while you pay
            </p>
          </aside>
        </div>
      </main>

      {/* Pay share sheet */}
      <Overlay
        isOpen={payShare.isOpen}
        onClose={payShare.close}
        title="Pay your share"
        mode="sheet"
        hideHeader
        showGrabber
      >
        <div className="between">
          <h3>Pay your share</h3>
          <div className="lock-timer">🔒 <span>{lockLabel}</span></div>
        </div>
        <p className="subtle small">Spot locked for you. Friday Night Football · tonight 9:00 PM.</p>
        <div className="pricerow" style={{ marginTop: 8 }}>
          <span>Your share (1 of 10)</span>
          <span className="num">৳255</span>
        </div>
        <div className="pricerow">
          <span>Service fee</span>
          <span className="num">৳25</span>
        </div>
        <div className="pricerow total">
          <span>Due now</span>
          <span className="num">৳280</span>
        </div>
        <div className="grid3" style={{ gap: 8, margin: '14px 0' }}>
          {PAYMENT_METHODS.map((option) => (
            <button
              key={option}
              className="btn btn-secondary"
              type="button"
              onClick={() => setMethod(option)}
              style={
                method === option
                  ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)' }
                  : undefined
              }
            >
              {method === option ? `${option} ✓` : option}
            </button>
          ))}
        </div>
        <Link className="btn btn-primary btn-lg btn-block" to={paths.solo.ticket}>
          Pay ৳280 with {method}
        </Link>
        <p className="tiny subtle center" style={{ marginTop: 8 }}>
          If payment fails, the lock releases and the spot reopens — you&apos;re never charged for a failed attempt.
        </p>
        <button className="btn btn-tertiary btn-block" type="button" onClick={payShare.close}>
          Cancel
        </button>
      </Overlay>
    </>
  );
}
