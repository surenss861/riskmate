-- Prevent duplicate attempt rows when stale-claim recovery causes the same delivery to be retried.
-- Cleanup is required before enforcing uniqueness: historical retries may have created duplicate
-- (delivery_id, attempt_number) rows; we keep one canonical row per pair (smallest id) and drop extras.

DELETE FROM webhook_delivery_attempts a
USING webhook_delivery_attempts b
WHERE a.delivery_id = b.delivery_id
  AND a.attempt_number = b.attempt_number
  AND a.id > b.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_delivery_attempt'
      AND conrelid = 'public.webhook_delivery_attempts'::regclass
  ) THEN
    ALTER TABLE webhook_delivery_attempts
      ADD CONSTRAINT uq_delivery_attempt UNIQUE (delivery_id, attempt_number);
  END IF;
END $$;
