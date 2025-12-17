-- Add account deactivation fields to users table
-- Enables safe account deletion with retention period

DO $$
BEGIN
  -- Add account_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'deactivated', 'pending_delete'));
  END IF;

  -- Add deactivated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'deactivated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN deactivated_at TIMESTAMPTZ;
  END IF;

  -- Add delete_requested_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'delete_requested_at'
  ) THEN
    ALTER TABLE users ADD COLUMN delete_requested_at TIMESTAMPTZ;
  END IF;

  -- Add password_changed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password_changed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index for finding accounts pending deletion
CREATE INDEX IF NOT EXISTS idx_users_pending_delete 
ON users(delete_requested_at) 
WHERE account_status = 'pending_delete';

-- Comment on columns
COMMENT ON COLUMN users.account_status IS 'Account status: active, deactivated, or pending_delete';
COMMENT ON COLUMN users.deactivated_at IS 'Timestamp when account was deactivated';
COMMENT ON COLUMN users.delete_requested_at IS 'Timestamp when account deletion was requested';
COMMENT ON COLUMN users.password_changed_at IS 'Timestamp when password was last changed';

