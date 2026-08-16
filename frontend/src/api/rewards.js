import { api } from './client';

/**
 * Player Loyalty & Rewards Program endpoints. All routes live under
 * /api/v1/rewards/** and require a bearer token, which the shared client
 * attaches automatically. Every response is wrapped in the backend's
 * ApiResponse<T> envelope, so these helpers unwrap `.data` for callers.
 */

/** GET /api/v1/rewards/products — active reward catalog with unlock state. */
export async function getRewardProducts() {
  const res = await api('/rewards/products');
  return res.data;
}

/** GET /api/v1/rewards/tiers — the loyalty ladder, lowest tier first. */
export async function getRewardTiers() {
  const res = await api('/rewards/tiers');
  return res.data;
}

/** POST /api/v1/rewards/redeem — spends points on a catalog item. */
export async function redeemReward(rewardId) {
  const res = await api('/rewards/redeem', { method: 'POST', body: { rewardId } });
  return res.data;
}

/** GET /api/v1/rewards/my-points — current balance, wallet balance, and tier progress. */
export async function getMyPoints() {
  const res = await api('/rewards/my-points');
  return res.data;
}

/** GET /api/v1/rewards/activity — recent points ledger entries, most recent first. */
export async function getRewardActivity(limit = 30) {
  const res = await api(`/rewards/activity?limit=${encodeURIComponent(limit)}`);
  return res.data;
}

/** GET /api/v1/rewards/wallet — wallet balance plus the ledger entries behind it. */
export async function getWalletHistory(limit = 30) {
  const res = await api(`/rewards/wallet?limit=${encodeURIComponent(limit)}`);
  return res.data;
}
