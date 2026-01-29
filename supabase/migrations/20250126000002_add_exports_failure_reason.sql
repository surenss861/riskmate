-- Add failure_reason to exports (nullable, additive; iOS can show it when present)
-- Does not break web; existing error_message remains for backward compatibility.
ALTER TABLE exports
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

COMMENT ON COLUMN exports.failure_reason IS 'Human-readable failure reason for UI (e.g. iOS export failed sheet). Optional.';
