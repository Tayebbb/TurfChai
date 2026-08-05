import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Alert } from '@/components/ui/Alert';
import { Switch } from '@/components/forms/Toggles';
import { fridayNightRoster } from '@/data/games';
import { useToast } from '@/hooks/useToast';
import { currentPlayer } from '@/data/users';
import { paths } from '@/routes/paths';

const TICKET_FACTS = [
  { id: 'tonight', label: 'TONIGHT', value: <b className="num">9:00–10:30 PM</b> },
  { id: 'arrive', label: 'ARRIVE BY', value: <b className="num">8:50 PM</b> },
  { id: 'share', label: 'SHARE', value: <span className="badge green">Paid ৳280</span> },
];

export default function TicketPage() {
  const { showToast } = useToast();
  const [reminder, setReminder] = useState(true);

  return (
    <>
      <PageTitle title="Match ticket" />

      <main className="wrap-form" id="main" style={{ paddingTop: 32, paddingBottom: 80 }}>
        <div className="center" style={{ marginBottom: 18 }}>
          <div className="check-anim" aria-hidden="true">
            ✓
          </div>
          <span className="badge green">You&apos;re in! Payment reconciled · host alerted</span>
          <h1 style={{ fontSize: 22, marginTop: 10 }}>Match ticket sent 🎟️</h1>
          <p className="subtle small">
            ৳280 paid via bKash · TXN 9K3L27 · recorded in the venue&apos;s shift ledger automatically
          </p>
        </div>

        <div className="ticket">
          <div className="head">
            <div className="between">
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>Friday Night Football</b>
              <span className="badge nodot" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
                Open game
              </span>
            </div>
            <div className="muted small">Kick Off Arena · Pitch 2 · Dhanmondi 27</div>
          </div>
          <div className="center" style={{ padding: 18 }}>
            <div className="qr" role="img" aria-label="Match ticket QR code" />
            <b className="num" style={{ fontSize: 18, letterSpacing: '.08em', display: 'block', marginTop: 10 }}>
              OG-7734-RK
            </b>
          </div>
          <div className="perf" />
          <div style={{ padding: '16px 20px' }}>
            <div className="grid3" style={{ gap: 10 }}>
              {TICKET_FACTS.map((fact) => (
                <div key={fact.id}>
                  <span className="tiny subtle">{fact.label}</span>
                  <br />
                  {fact.value}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 14, gap: 10 }}>
          <button className="btn btn-primary" type="button" onClick={() => showToast('Opening directions 🗺️')}>
            🗺️ Directions
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => showToast('Chat with Rifat opened 💬')}
          >
            💬 Contact host
          </button>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="between">
            <h4 style={{ margin: 0 }}>Reminder</h4>
            <Switch
              label="Match reminder"
              checked={reminder}
              onChange={(event) => setReminder(event.target.checked)}
            />
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            We&apos;ll remind you at <b>7:30 PM</b> (90 min before kickoff) with directions and the roster.
          </p>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="between">
            <h4 style={{ margin: 0 }}>Roster · 10/10 · Full</h4>
            <span className="badge gray">Closed</span>
          </div>
          <div className="row-wrap" style={{ marginTop: 10 }}>
            {fridayNightRoster.map((player) => (
              <span key={player.id} className={player.tone ? `avatar ${player.tone}` : 'avatar'}>
                {player.initials}
              </span>
            ))}
            <span className="avatar" style={{ background: 'var(--brand)', color: '#fff' }}>
              {currentPlayer.initials}
            </span>
          </div>
          <p className="subtle tiny" style={{ margin: '8px 0 0' }}>
            Host Rifat manages teams on the night. Turf owner handles pitch entry &amp; handover.
          </p>
        </div>

        <Alert tone="ok" icon="🏅" title="After the match" style={{ marginTop: 14 }}>
          Rate the game and venue — loyalty points credit automatically once play completes.{' '}
          <Link to={paths.player.review}>See the review flow →</Link>
        </Alert>
      </main>
    </>
  );
}
