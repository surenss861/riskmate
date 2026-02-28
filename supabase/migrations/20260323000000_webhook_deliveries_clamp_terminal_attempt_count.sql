-- Clamp terminal webhook_deliveries.attempt_count to max 5 (MAX_ATTEMPTS).
-- Terminal rows had been updated with attempt_count = 6 after the 5th failed attempt;
-- attempt_count should reflect attempts actually executed, so cap at 5.
UPDATE webhook_deliveries
SET attempt_count = 5
WHERE terminal_outcome IS NOT NULL
  AND attempt_count > 5;
