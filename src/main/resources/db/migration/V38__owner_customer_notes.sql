-- V38: Owner Customer Notes
CREATE TABLE IF NOT EXISTS owner_customer_notes (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uk_owner_customer_notes UNIQUE (owner_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_owner_customer_notes_owner ON owner_customer_notes(owner_id);
