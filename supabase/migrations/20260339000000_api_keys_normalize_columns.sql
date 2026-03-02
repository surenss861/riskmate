-- Normalize api_keys regardless of prior table shape (legacy from 20251128 or 20260305).
-- Ensures all required columns exist, backfills key_hash/key_prefix from legacy key, enforces unique key_hash.
-- Idempotent and safe for both legacy and already-updated databases.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Required columns used by API key management and auth (ADD IF NOT EXISTS)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_hash TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Lifecycle/scoping columns (if not already added by 20260309000000_api_keys_epic_schema)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Backfill key_hash and key_prefix from legacy plaintext key when column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    UPDATE api_keys
    SET
      key_hash = encode(digest(key, 'sha256'), 'hex'),
      key_prefix = left(key, 15)
    WHERE key IS NOT NULL
      AND (key_hash IS NULL OR key_hash = '');
  END IF;
END $$;

-- Ensure name is non-empty for legacy rows that had no name
UPDATE api_keys SET name = 'Legacy key' WHERE name IS NULL OR name = '';

-- Normalize legacy shape: allow new writes without plaintext key.
-- If legacy column "key" exists (NOT NULL UNIQUE), make it nullable then drop it so inserts
-- using only key_hash/key_prefix succeed. Idempotent for already-normalized DBs (no key column).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    ALTER TABLE api_keys ALTER COLUMN key DROP NOT NULL;
    ALTER TABLE api_keys DROP COLUMN key;
  END IF;
END $$;

-- Enforce unique index on key_hash for lookup (allows multiple NULLs for orphan rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
