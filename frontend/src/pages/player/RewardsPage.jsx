import { useState } from 'react';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Overlay } from '@/components/modals/Overlay';
import { Section, SectionTitle } from '@/components/layout/Section';
import { useDisclosure } from '@/hooks/useDisclosure';
import './RewardsPage.css';

const TIERS = [
  {
    id: 'silver',
    name: 'Silver',
    glyph: '🥈',
    points: '0 pts · Starter',
    perk: '0% off bookings',
  },
  {
    id: 'gold',
    name: 'Gold',
    glyph: '🥇',
    points: '1,000 pts',
    perk: '10% off bookings',
    state: 'current',
    badge: { tone: 'green', label: 'Current tier' },
  },
  {
    id: 'platinum',
    name: 'Platinum',
    glyph: '💎',
    points: '2,000 pts',
    perk: 'Priority booking · 15% off',
    state: 'locked',
    badge: { tone: 'gray', label: 'Locked' },
  },
];

const EARN_WAYS = [
  { id: 'book', glyph: '⚽', label: 'Book a turf', points: '+50' },
  { id: 'play', glyph: '🏟️', label: 'Attend & play your match', points: '+30' },
  { id: 'review', glyph: '⭐', label: 'Leave a review after a match', points: '+20' },
  { id: 'profile', glyph: '👤', label: 'Complete your profile', note: 'one-time', points: '+10' },
  { id: 'solo', glyph: '🎯', label: 'Join an open game as a solo', points: '+15' },
  { id: 'offpeak', glyph: '🌙', label: 'Book an off-peak slot', note: 'bonus', points: '+10' },
];

const REWARDS = [
  {
    id: 'discount-50',
    glyph: '🎁',
    name: '৳50 Booking Discount',
    cost: '500',
    note: 'Valid on any turf',
    value: 50,
  },
  {
    id: 'discount-150',
    glyph: '💰',
    name: '৳150 Booking Discount',
    cost: '1,000',
    note: 'Bigger savings on any slot',
    value: 150,
  },
  {
    id: 'free-slot',
    glyph: '⏰',
    name: 'Free 1-Hour Slot',
    cost: '2,000',
    note: 'Any turf · any time',
    lock: '🔒 760 pts to go',
  },
  {
    id: 'ten-percent',
    glyph: '🏷️',
    name: '10% Off Your Next Booking',
    cost: '2,500',
    note: 'Applies at checkout',
    lock: '🔒 1,260 pts to go',
  },
  {
    id: 'priority',
    glyph: '⚡',
    name: 'Priority Booking Pass',
    cost: '3,000',
    note: 'Skip queues in peak hours',
    lock: '🔒 1,760 pts to go',
  },
];

const ACTIVITY = [
  {
    id: 'booked',
    glyph: '⚽',
    title: 'Booked Kick Off Arena · Pitch 2',
    when: 'Fri 2 Aug · evening slot',
    value: '+60',
  },
  {
    id: 'redeemed',
    glyph: '🧧',
    title: 'Redeemed ৳50 Booking Discount',
    when: 'Thu 1 Aug · added to wallet',
    value: '−500',
    minus: true,
  },
  { id: 'review', glyph: '⭐', title: 'Left a review at GreenTurf', when: 'Thu 1 Aug', value: '+20' },
  {
    id: 'played',
    glyph: '🏆',
    title: 'Played Friday Night Football · Kick Off Arena',
    when: 'Wed 31 Jul · completed match',
    value: '+150',
  },
  {
    id: 'bonus',
    glyph: '🎉',
    title: '5th booking this month',
    when: 'Sat 25 Jul · monthly bonus',
    value: '+75',
  },
];

export default function RewardsPage() {
  const redeemed = useDisclosure(false);
  const [wallet, setWallet] = useState(150);
  const [claimed, setClaimed] = useState([]);
  const [lastRedeemed, setLastRedeemed] = useState('৳50 discount');

  /** Credits the reward value to the wallet, locks its button and opens the receipt modal. */
  const redeem = (reward) => {
    setWallet((prev) => prev + reward.value);
    setClaimed((prev) => [...prev, reward.id]);
    setLastRedeemed(reward.name);
    redeemed.open();
  };

  const walletText = `৳${wallet}`;

  return (
    <>
      <PageTitle title="Rewards" />
      <main className="wrap" id="main" style={{ paddingTop: 28 }}>
        <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>Rewards</h1>
            <span className="subtle">Loyalty points · member tiers · play, earn, redeem</span>
          </div>
          <span className="badge amber">🥇 Gold member</span>
        </div>

        {/* Status header */}
        <Section style={{ marginTop: 0 }}>
          <div className="glass glass-card status-card">
            <div className="row">
              <span className="tier-ico gold">🥇</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>You&apos;re a Gold member</h2>
                <span className="subtle">Keep playing to climb to Platinum</span>
              </div>
            </div>
            <div className="status-balance">
              <span className="lbl">Current balance</span>
              <b>1,240</b> <small>pts</small>
              <div className="wallet-line">
                💳 <span className="num">{walletText}</span> in redeemed rewards
              </div>
            </div>
          </div>
        </Section>

        {/* Tier progress */}
        <Section style={{ marginTop: 28 }}>
          <div className="glass glass-card tp-card">
            <div className="tp-head">
              <div>
                <span className="badge amber nodot">Gold → Platinum</span>
                <h2>1,240 / 2,000 pts to Platinum</h2>
              </div>
              <span className="badge green nodot">62% there</span>
            </div>
            <div className="tp-track-wrap">
              <div
                className="tp-track"
                role="progressbar"
                aria-valuenow={62}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress to Platinum tier"
              >
                <i className="tp-fill" style={{ width: '62%' }} />
                <span className="tp-mark on" style={{ left: '0%' }} aria-hidden="true">
                  🥈
                </span>
                <span className="tp-mark on cur" style={{ left: '25%' }} aria-hidden="true">
                  🥇
                </span>
                <span className="tp-mark" style={{ left: '100%' }} aria-hidden="true">
                  💎
                </span>
              </div>
            </div>
            <div className="tp-labels">
              <div className="c1">
                <b>0 pts</b>Silver · earned
              </div>
              <div className="c2 here">
                <b>1,000 pts</b>Gold · you&apos;re here
              </div>
              <div className="c3">
                <b>2,000 pts</b>Platinum · next
              </div>
            </div>
            <p className="subtle center" style={{ margin: '20px auto 0', maxWidth: 520 }}>
              Reach Platinum to unlock priority booking + bigger discounts.
            </p>
          </div>
        </Section>

        {/* Tier overview */}
        <Section>
          <SectionTitle title="Member tiers">
            <span className="subtle small">Benefits grow as you climb</span>
          </SectionTitle>
          <div className="grid3" style={{ alignItems: 'start' }}>
            {TIERS.map((tier) => {
              const head = (
                <div className="tier-top">
                  <span className={`tier-ico ${tier.id}`}>{tier.glyph}</span>
                  <div>
                    <h3>{tier.name}</h3>
                    <span className="tier-pts">{tier.points}</span>
                  </div>
                </div>
              );
              return (
                <article
                  className={`glass glass-card tier-card${tier.state ? ` ${tier.state}` : ''}`}
                  key={tier.id}
                >
                  {tier.badge ? (
                    <div className="between">
                      {head}
                      <span className={`badge ${tier.badge.tone} nodot`}>{tier.badge.label}</span>
                    </div>
                  ) : (
                    head
                  )}
                  <ul className="tier-perks">
                    <li>{tier.perk}</li>
                  </ul>
                </article>
              );
            })}
          </div>
        </Section>

        {/* How to earn points */}
        <Section>
          <SectionTitle title="How to earn points">
            <span className="subtle small">Every booking and match counts</span>
          </SectionTitle>
          <div className="earn-grid">
            {EARN_WAYS.map((way) => (
              <div className="glass glass-card earn-card" key={way.id}>
                <span className="ec-ico">{way.glyph}</span>
                <div className="ec-text">
                  <b>{way.label}</b>
                  {way.note ? <span className="ec-note">{way.note}</span> : null}
                </div>
                <b className="ec-pts">{way.points}</b>
              </div>
            ))}
          </div>
        </Section>

        {/* Redeem your points */}
        <Section>
          <SectionTitle title="Redeem your points">
            <span className="subtle small">Redeemed rewards go straight to your wallet</span>
          </SectionTitle>
          <div className="redeem-grid">
            {REWARDS.map((reward) => {
              const isClaimed = claimed.includes(reward.id);
              return (
                <div className="glass glass-card redeem-card" key={reward.id}>
                  <div className="rc-top">
                    <span className="rc-ico">{reward.glyph}</span>
                    <h4>{reward.name}</h4>
                  </div>
                  <div className="rc-cost">
                    {reward.cost} <small>pts</small>
                  </div>
                  <span className="rc-note">{reward.note}</span>
                  {reward.lock ? (
                    <span className="redeem-lock">{reward.lock}</span>
                  ) : (
                    <Button
                      variant={isClaimed ? 'secondary' : 'primary'}
                      disabled={isClaimed}
                      onClick={() => redeem(reward)}
                    >
                      {isClaimed ? 'Redeemed ✓' : 'Redeem'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Recent points activity */}
        <Section>
          <SectionTitle title="Recent points activity">
            <span className="subtle small">Last 30 days</span>
          </SectionTitle>
          <div className="glass glass-card" style={{ padding: '4px 20px' }}>
            <div className="act-list">
              {ACTIVITY.map((entry) => (
                <div className="act-row" key={entry.id}>
                  <span className={entry.minus ? 'act-ico minus' : 'act-ico'}>{entry.glyph}</span>
                  <div>
                    <b>{entry.title}</b>
                    <div className="when">{entry.when}</div>
                  </div>
                  <b className={entry.minus ? 'act-val minus' : 'act-val'}>{entry.value}</b>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </main>

      {/* Redeem success modal */}
      <Overlay
        isOpen={redeemed.isOpen}
        onClose={redeemed.close}
        hideHeader
        maxWidth={420}
        title="Reward redeemed"
      >
        <div style={{ textAlign: 'center' }}>
          <div className="check-anim" aria-hidden="true">
            ✓
          </div>
          <h3 style={{ margin: 0 }}>Redeemed!</h3>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {lastRedeemed} added to your wallet
          </p>
          <div className="panel" style={{ margin: '16px 0 12px', textAlign: 'left' }}>
            <div className="between">
              <span className="small muted">New wallet balance</span>
              <b className="num" style={{ color: 'var(--brand-600)' }}>
                {walletText}
              </b>
            </div>
          </div>
          <p className="tiny subtle" style={{ margin: '0 0 16px' }}>
            It shows up as &quot;Apply Reward Discount&quot; at your next checkout — no code to copy.
          </p>
          <Button variant="primary" block onClick={redeemed.close}>
            Great
          </Button>
        </div>
      </Overlay>
    </>
  );
}