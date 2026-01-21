# Realtime Push Signals - Quick Start Guide

**Get push signals working in 5 minutes**

---

## ✅ Already Done

- ✅ Database schema (`realtime_events` table)
- ✅ Backend event emission (on job/evidence mutations)
- ✅ iOS subscription (`RealtimeEventService`)
- ✅ Web subscription helpers (`lib/realtime/eventSubscription.ts`, `hooks/useRealtimeEvents.ts`)

---

## 🚀 Enable on Web

**Add to `app/operations/page.tsx`** (or dashboard layout):

```typescript
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

export default function OperationsPage() {
  // ... existing code ...
  
  // Enable realtime events
  useRealtimeEvents();
  
  // ... rest of component ...
}
```

**That's it!** Now when:
- Job created on iOS → Web jobs list updates instantly
- Evidence uploaded on Web → iOS job detail updates instantly
- Job archived on Web → iOS jobs list updates instantly

---

## 🧪 Test It

1. **Two tabs open**:
   - Tab 1: Web dashboard (`/operations`)
   - Tab 2: iOS app (jobs list)

2. **Create job on Web**:
   - Tab 1: Create new job
   - Tab 2: Job should appear in list within 1 second (no refresh)

3. **Upload evidence on iOS**:
   - Tab 2: Upload evidence to a job
   - Tab 1: Job evidence count should update (if viewing that job)

---

## 🔧 Verify It's Working

**Check iOS logs**:
```
[RealtimeEventService] ✅ Subscribed to events for org: abc123
[RealtimeEventService] 📨 Received event: job.created, entity: job, id: xyz789
[JobsStore] 🔔 Event received: job.created, refreshing...
```

**Check Web console**:
```
[RealtimeEvents] ✅ Subscribed to events for org: abc123
[RealtimeEvents] 📨 Received event: job.created job xyz789
[useRealtimeEvents] 🔔 Event: job.created job xyz789
```

**Check database**:
```sql
SELECT * FROM realtime_events 
WHERE organization_id = 'your-org-id' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## ⚠️ If It's Not Working

### iOS Not Receiving Events
1. Check subscription: Look for `[RealtimeEventService] ✅ Subscribed` in logs
2. Check org ID: Ensure correct `organizationId` in subscription
3. Check RLS: Verify user can read events for their org

### Web Not Receiving Events
1. Check subscription: Look for `[RealtimeEvents] ✅ Subscribed` in console
2. Check org ID: Verify `organizationId` is fetched correctly
3. Check SWR: Verify cache keys match (`/api/jobs`, etc.)

### Events Not Being Emitted
1. Check backend logs: Look for `[RealtimeEvents] ✅ Emitted`
2. Check database: Query `realtime_events` table
3. Check RLS: Backend must use service role

---

## 📚 Full Documentation

See `REALTIME_PRODUCTION_HARDENING.md` for:
- Production safety features
- Edge case handling
- Battery optimization
- Performance metrics

---

**Push signals are production-ready. Just add the hook to your pages.** 🚀
