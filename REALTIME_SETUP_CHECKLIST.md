# Realtime Push Signals - Setup Checklist

**Quick reference for enabling push signals in production**

---

## ✅ Database Setup

- [ ] Run migration: `supabase db push`
- [ ] Verify `realtime_events` table exists
- [ ] Verify RLS policies are active
- [ ] Verify Realtime is enabled: `ALTER PUBLICATION supabase_realtime ADD TABLE realtime_events;`
- [ ] Test: Insert event manually → verify it appears

---

## ✅ Backend Setup

- [ ] Verify `emitRealtimeEvent()` helper exists
- [ ] Verify events emitted on:
  - [ ] Job creation (`job.created`)
  - [ ] Job update (`job.updated`)
  - [ ] Job archive (`job.archived`)
  - [ ] Job flag (`job.flagged`)
  - [ ] Evidence upload (`evidence.uploaded`)
- [ ] Test: Create job → check `realtime_events` table for new row

---

## ✅ iOS Setup

- [ ] Verify `RealtimeEventService` exists
- [ ] Verify subscription in `SessionManager`:
  - [ ] After login
  - [ ] After session restore
  - [ ] Unsubscribe on logout
- [ ] Test: Login → check logs for `[RealtimeEventService] ✅ Subscribed`
- [ ] Test: Create job from web → iOS should receive event

---

## ✅ Web Setup (Future)

- [ ] Subscribe to Realtime in Next.js
- [ ] Invalidate SWR cache on events
- [ ] Same debounce/coalesce pattern

---

## 🧪 Testing

### Manual Test
1. Two devices logged in to same org
2. Device A: Create job
3. Device B: Should see job appear within 1 second

### Verify Events
```sql
SELECT * FROM realtime_events 
WHERE organization_id = 'your-org-id' 
ORDER BY created_at DESC 
LIMIT 10;
```

### iOS Logs
```
[RealtimeEventService] ✅ Subscribed to events for org: abc123
[RealtimeEventService] 📨 Received event: job.created, entity: job, id: xyz789
[JobsStore] 🔔 Event received: job.created, refreshing...
```

---

**Once all checked, push signals are live.** ✅
