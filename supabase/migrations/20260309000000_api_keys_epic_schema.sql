-- Align api_keys with epic schema contract: lifecycle/scoping columns and key_hash uniqueness.
-- Required for Public API & API Key Management ticket; backfill-safe for existing rows.

-- Lifecycle and scope columns
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Unique index on key_hash for lookup and deduplication (epic: idx_api_keys_hash)
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Existing rows keep default scopes '{}', null expires_at/created_by/revoked_at (no backfill required).
