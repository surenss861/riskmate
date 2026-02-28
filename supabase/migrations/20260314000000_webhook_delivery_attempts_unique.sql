-- Prevent duplicate attempt rows when stale-claim recovery causes the same delivery to be retried.
ALTER TABLE webhook_delivery_attempts
  ADD CONSTRAINT uq_delivery_attempt UNIQUE (delivery_id, attempt_number);
