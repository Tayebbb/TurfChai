import { useState } from 'react';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Overlay } from '@/components/modals/Overlay';
import { Section, SectionTitle } from '@/components/layout/Section';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/useToast';
import { getMyPoints, getRewardActivity, getRewardProducts, redeemReward } from '@/api/rewards';
import './RewardsPage.css';

// Static tier ladder mirroring the seeded `loyalty_tiers` rows (see
// ai-knowledge/loyalty-rewards.md). Live data only supplies the caller's
// current/next tier, so the fixed thresholds/perks for the other rungs are
// kept here; which card is "current" vs "locked" is computed from /my-points.
const TIER_LADDER = [
  { name: 'SILVER', label: 'Silver', glyph: '🥈', points: '0 pts · Starter', perk: '0% off bookings' },
  { name: 'GOLD', label: 'Gold', glyph: '🥇', points: '1,000 pts', perk: '10% off bookings' },
  { name: 'PLATINUM', label: 'Platinum', glyph: '💎', points: '2,000 pts', perk: 'Priority booking · 15% off' },
];
const TIER_ORDER = { SILVER: 0, GOLD: 1, PLATINUM: 2 };

const EARN_WAYS = [
  { id: 'book', glyph: '⚽', label: 'Book a turf', points: '+50' },
  { id: 'play', glyph: '🏟️', label: 'Attend & play your match', points: '+30' },
  { id: 'review', glyph: '⭐', label: 'Leave a review after a match', points: '+20' },
  { id: 'profile', glyph: '👤', label: 'Complete your profile', note: 'one-time', points: '+10' },
  { id: 'solo', glyph: '🎯', label: 'Join an open game as a solo', points: '+15' },
  { id: 'offpeak', glyph: '🌙', label: 'Book an off-peak slot', note: 'bonus', points: '+10' },
];

const REWARD_KIND_GLYPH = {
  WALLET_CREDIT: '🎁',
  FREE_SLOT: '⏰',
  DISCOUNT_NEXT: '🏷️',
  PRIORITY_PASS: '⚡',
};

const REASON_META = {
  BOOKING: { glyph: '⚽', label: 'Booked a turf' },
  ATTENDED_MATCH: { glyph: '🏆', label: 'Attended & played a match' },
  REVIEW: { glyph: '⭐', label: 'Left a review' },
  PROFILE_COMPLETION: { glyph: '👤', label: 'Completed your profile' },
  JOINED_OPEN_GAME: { glyph: '🎯', label: 'Joined an open game' },
  OFF_PEAK_BONUS: { glyph: '🌙', label: 'Off-peak booking bonus' },
  MONTHLY_BONUS: { glyph: '🎉', label: 'Monthly activity bonus' },
  REDEMPTION: { glyph: '🧧', label: 'Redeemed a reward' },
  ADJUSTMENT: { glyph: '⚙️', label: 'Balance adjustment' },
  EXPIRY: { glyph: '⌛', label: 'Points expired' },
};

function formatNumber(n) {
  return Number(n ?? 0).toLocaleString();
}

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RewardsPage() {
  const redeemed = useDisclosure(false);
  const { showToast } = useToast();
  const [redeemingId, setRedeemingId] = useState(null);
  const [lastRedemption, setLastRedemption] = useState(null);

  const points = useApi(() => getMyPoints(), []);
  const products = useApi(() => getRewardProducts(), []);
  const activity = useApi(() => getRewardActivity(30), []);

  const reloadAll = () => {
    points.reload();
    products.reload();
    activity.reload();
  };

  const redeem = async (product) => {
    setRedeemingId(product.id);
    try {
      const result = await redeemReward(product.id);
      setLastRedemption(result);
      redeemed.open();
      reloadAll();
    } catch (err) {
      showToast(err.message || 'Could not redeem this reward');
    } finally {
      setRedeemingId(null);
    }
  };

  const loading = points.loading || products.loading || activity.loading;
  const error = points.error || products.error || activity.error;

  if (loading) {
    return (
      <>
        <PageTitle title="Rewards" />
        <main className="wrap" id="main" style={{ paddingTop: 28 }}>
          <p className="subtle" role="status">
            Loading your rewards…
          </p>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageTitle title="Rewards" />
        <main className="wrap" id="main" style={{ paddingTop: 28 }}>
          <div className="card" style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>Could not load your rewards</h1>
            <p className="subtle">{error.message}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="secondary" onClick={reloadAll}>
                Try again
              </Button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const summary = points.data;
  const currentTierMeta = TIER_LADDER.find((t) => t.name === summary.currentTier?.name) ?? TIER_LADDER[0];
  const currentOrder = TIER_ORDER[currentTierMeta.name] ?? 0;
  const nextTier = summary.nextTier;
  const atTopTier = !nextTier;
  const progressPercent = atTopTier ? 100 : (summary.progressPercent ?? 0);
  const walletText = `৳${formatNumber(summary.walletBalance)}`;

  return (
    <>
      <PageTitle title="Rewards" />
      <main className="wrap" id="main" style={{ paddingTop: 28 }}>
        <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>Rewards</h1>
            <span className="subtle">Loyalty points · member tiers · play, earn, redeem</span>
          </div>
          <span className="badge amber">
            {currentTierMeta.glyph} {currentTierMeta.label} member
          </span>
        </div>

        {/* Status header */}
        <Section style={{ marginTop: 0 }}>
          <div className="glass glass-card status-card">
            <div className="row">
              <span className={`tier-ico ${currentTierMeta.name.toLowerCase()}`}>{currentTierMeta.glyph}</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>You&apos;re a {currentTierMeta.label} member</h2>
                <span className="subtle">
                  {atTopTier ? "You've reached the top tier" : `Keep playing to climb to ${nextTier.name.charAt(0)}${nextTier.name.slice(1).toLowerCase()}`}
                </span>
              </div>
            </div>
            <div className="status-balance">
              <span className="lbl">Current balance</span>
              <b>{formatNumber(summary.balance)}</b> <small>pts</small>
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
                <span className="badge amber nodot">
                  {atTopTier ? currentTierMeta.label : `${currentTierMeta.label} → ${nextTier.name.charAt(0)}${nextTier.name.slice(1).toLowerCase()}`}
                </span>
                <h2>
                  {atTopTier
                    ? `${formatNumber(summary.balance)} pts · top tier reached`
                    : `${formatNumber(summary.balance)} / ${formatNumber(nextTier.minPoints)} pts to ${nextTier.name.charAt(0)}${nextTier.name.slice(1).toLowerCase()}`}
                </h2>
              </div>
              <span className="badge green nodot">{progressPercent}% there</span>
            </div>
            <div className="tp-track-wrap">
              <div
                className="tp-track"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={atTopTier ? 'Top tier reached' : `Progress to ${nextTier.name} tier`}
              >
                <i className="tp-fill" style={{ width: `${progressPercent}%` }} />
                <span className="tp-mark on" style={{ left: '0%' }} aria-hidden="true">
                  {currentTierMeta.glyph}
                </span>
                {!atTopTier ? (
                  <span className="tp-mark" style={{ left: '100%' }} aria-hidden="true">
                    {TIER_LADDER.find((t) => t.name === nextTier.name)?.glyph}
                  </span>
                ) : null}
              </div>
            </div>
            <p className="subtle center" style={{ margin: '20px auto 0', maxWidth: 520 }}>
              {atTopTier
                ? 'You get every perk TurfChai offers — priority booking + the biggest discount.'
                : 'Reach the next tier to unlock priority booking + bigger discounts.'}
            </p>
          </div>
        </Section>

        {/* Tier overview */}
        <Section>
          <SectionTitle title="Member tiers">
            <span className="subtle small">Benefits grow as you climb</span>
          </SectionTitle>
          <div className="grid3" style={{ alignItems: 'start' }}>
            {TIER_LADDER.map((tier) => {
              const order = TIER_ORDER[tier.name];
              const isCurrent = order === currentOrder;
              const isLocked = order > currentOrder;
              const badge = isCurrent
                ? { tone: 'green', label: 'Current tier' }
                : isLocked
                  ? { tone: 'gray', label: 'Locked' }
                  : null;
              const head = (
                <div className="tier-top">
                  <span className={`tier-ico ${tier.name.toLowerCase()}`}>{tier.glyph}</span>
                  <div>
                    <h3>{tier.label}</h3>
                    <span className="tier-pts">{tier.points}</span>
                  </div>
                </div>
              );
              return (
                <article
                  className={`glass glass-card tier-card${isCurrent ? ' current' : isLocked ? ' locked' : ''}`}
                  key={tier.name}
                >
                  {badge ? (
                    <div className="between">
                      {head}
                      <span className={`badge ${badge.tone} nodot`}>{badge.label}</span>
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
            {products.data.map((product) => (
              <div className="glass glass-card redeem-card" key={product.id}>
                <div className="rc-top">
                  <span className="rc-ico">{REWARD_KIND_GLYPH[product.kind] ?? '🎁'}</span>
                  <h4>{product.name}</h4>
                </div>
                <div className="rc-cost">
                  {formatNumber(product.costPoints)} <small>pts</small>
                </div>
                <span className="rc-note">{product.description}</span>
                {product.locked ? (
                  <span className="redeem-lock">🔒 {formatNumber(product.pointsToUnlock)} pts to go</span>
                ) : (
                  <Button
                    variant="primary"
                    disabled={redeemingId === product.id}
                    onClick={() => redeem(product)}
                  >
                    {redeemingId === product.id ? 'Redeeming…' : 'Redeem'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Recent points activity */}
        <Section>
          <SectionTitle title="Recent points activity">
            <span className="subtle small">Last 30 entries</span>
          </SectionTitle>
          <div className="glass glass-card" style={{ padding: '4px 20px' }}>
            {activity.data.length === 0 ? (
              <p className="subtle" style={{ padding: '16px 0' }}>
                No activity yet — book a turf to start earning points.
              </p>
            ) : (
              <div className="act-list">
                {activity.data.map((entry) => {
                  const meta = REASON_META[entry.reason];
                  const isMinus = entry.delta < 0;
                  return (
                    <div className="act-row" key={entry.id}>
                      <span className={isMinus ? 'act-ico minus' : 'act-ico'}>{meta?.glyph ?? '✨'}</span>
                      <div>
                        <b>{entry.note || meta?.label || entry.reason}</b>
                        <div className="when">{formatWhen(entry.createdAt)}</div>
                      </div>
                      <b className={isMinus ? 'act-val minus' : 'act-val'}>
                        {isMinus ? '' : '+'}
                        {entry.delta}
                      </b>
                    </div>
                  );
                })}
              </div>
            )}
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
            {lastRedemption?.rewardName}
            {lastRedemption?.walletCreditAmount ? ' added to your wallet' : ' — added to your account'}
          </p>
          {lastRedemption?.walletCreditAmount ? (
            <div className="panel" style={{ margin: '16px 0 12px', textAlign: 'left' }}>
              <div className="between">
                <span className="small muted">New wallet balance</span>
                <b className="num" style={{ color: 'var(--brand-600)' }}>
                  ৳{formatNumber(lastRedemption.newWalletBalance)}
                </b>
              </div>
            </div>
          ) : (
            <div className="panel" style={{ margin: '16px 0 12px', textAlign: 'left' }}>
              <div className="between">
                <span className="small muted">Remaining points balance</span>
                <b className="num" style={{ color: 'var(--brand-600)' }}>
                  {formatNumber(lastRedemption?.newBalance)} pts
                </b>
              </div>
            </div>
          )}
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
