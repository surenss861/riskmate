-- Device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite unique so the same token can exist per (user, org); avoids cross-org overwrite and unregister failures.
DROP INDEX IF EXISTS idx_device_tokens_token;
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_token_user_org ON device_tokens (token, user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id);

-- Row-level security: only allow access to own device tokens (user_id = auth.uid())
-- Server-side jobs use the service key, which bypasses RLS
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own device tokens" ON device_tokens;
CREATE POLICY "Users can view their own device tokens"
  ON device_tokens FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own device tokens" ON device_tokens;
CREATE POLICY "Users can create their own device tokens"
  ON device_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own device tokens" ON device_tokens;
CREATE POLICY "Users can update their own device tokens"
  ON device_tokens FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own device tokens" ON device_tokens;
CREATE POLICY "Users can delete their own device tokens"
  ON device_tokens FOR DELETE
  USING (user_id = auth.uid());
