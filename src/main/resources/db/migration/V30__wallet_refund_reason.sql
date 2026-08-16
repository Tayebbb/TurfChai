-- ============================================================================
-- V30: Wallet refunds
--
-- Cancelling a booking that was paid partly with wallet credit refunded the
-- whole amount as cash and never returned the wallet portion — the platform
-- paid out real money it had never received, and the player still lost their
-- credit. Refunds now credit the wallet back, which needs its own reason so the
-- ledger distinguishes a refund from a manual adjustment.
-- ============================================================================

ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS ck_wallet_reason;
ALTER TABLE wallet_transactions ADD CONSTRAINT ck_wallet_reason
    CHECK (reason IN ('REWARD_CREDIT', 'CHECKOUT_APPLY', 'ADJUSTMENT', 'CASHOUT', 'REFUND'));
