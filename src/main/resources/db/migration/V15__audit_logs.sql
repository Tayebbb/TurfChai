-- ============================================================================
-- V15: Audit logs table for administrative action tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_name  VARCHAR(100) NOT NULL,
    admin_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    action_tone VARCHAR(30) DEFAULT 'blue',
    target      VARCHAR(100),
    details     VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
