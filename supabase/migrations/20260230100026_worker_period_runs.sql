-- Persist last-run per worker per period so workers can run once per period after restarts.
-- Used by: weekly digest (once per week).

CREATE TABLE IF NOT EXISTS worker_period_runs (
  worker_key  text NOT NULL,
  period_key  text NOT NULL,
  ran_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_key, period_key)
);

COMMENT ON TABLE worker_period_runs IS 'Tracks last run per worker per period (e.g. weekly_digest + ISO week) so digest runs once per week even after restarts.';
