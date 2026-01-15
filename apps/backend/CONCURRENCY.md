# Export Worker Concurrency

## Problem

When multiple backend instances run (e.g., Railway auto-scaling), each instance starts its own export worker. Without proper coordination, multiple workers can claim and process the same export job, leading to:
- Duplicate exports
- Wasted compute
- Ledger inconsistencies

## Solution

We use **DB-atomic claiming** to ensure only one worker can claim a job at a time.

### Implementation

1. **RPC Function (Recommended)**: `claim_export_job()`
   - Uses `FOR UPDATE SKIP LOCKED` for atomic row-level locking
   - Only one transaction can claim a specific row
   - Other transactions skip locked rows and move to the next available job

2. **Fallback (Manual Claiming)**: 
   - If RPC function doesn't exist, worker uses optimistic locking
   - Updates state from `queued` to `preparing` only if still `queued`
   - Race condition: multiple workers may try to claim the same job, but only one succeeds

### How It Works

```sql
-- Worker 1 and Worker 2 both call this:
SELECT * FROM exports 
WHERE state = 'queued' 
ORDER BY created_at ASC 
LIMIT 1 
FOR UPDATE SKIP LOCKED;

-- Worker 1 gets the row, Worker 2 gets nothing (skips locked row)
-- Worker 1 updates state to 'preparing'
-- Worker 2 moves to next job
```

### Testing

To verify concurrency safety:

1. **Single Instance**: Worker processes jobs sequentially
2. **Multiple Instances**: Each instance claims different jobs (no duplicates)
3. **Stress Test**: Run 10+ concurrent export requests, verify no duplicates

### Monitoring

Watch for:
- Export jobs stuck in `preparing` state (worker crashed)
- Duplicate exports (concurrency bug)
- High `queued` count (workers not keeping up)

### Future Improvements

- Add `claimed_by` and `claimed_at` columns to track which worker claimed a job
- Add timeout: if job in `preparing` for > 5 minutes, reset to `queued`
- Add worker heartbeat to detect crashed workers
