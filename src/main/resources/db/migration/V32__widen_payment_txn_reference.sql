-- ============================================================================
-- V32: Widen payments.txn_reference
--
-- References used to be "PAY-" plus 8 hex characters: 32 bits of entropy, with
-- an existence check before insert that two concurrent checkouts could both
-- pass. A full UUID removes both problems but needs 40 characters, and real
-- gateway references are longer still.
-- ============================================================================

ALTER TABLE payments
    ALTER COLUMN txn_reference TYPE VARCHAR(64);
