# Realtime Push Signals Implementation

**Date**: January 2025  
**Status**: ✅ Backend + iOS implementation complete

---

## 🎯 What This Does

Replaces polling with **push signals** - the app never has to "ask" the server repeatedly. Instead:
- Backend emits lightweight events on mutations
- Clients subscribe to events via Supabase Realtime
- On event → refresh only what changed (jobs list, job detail, audit feed)
- Debounce/coalesce prevents battery drain

---

## 📊 Architecture

```
Backend Mutation → emitRealtimeEvent() → Supabase realtime_events table
                                                      ↓
                                    Supabase Realtime (WebSocket)
                                                      ↓
                                    iOS/Web Client Subscription
                                                      ↓
                                    Debounce/Coalesce Logic
                                                      ↓
                                    Store.refreshOnEvent()
                                                      ↓
                                    UI Updates (only what changed)
```

---

## 🗄️ Database Schema

**File**: `supabase/migrations/20250126000000_add_realtime_events_table.sql`

**Table**: `realtime_events`
- `id` (UUID)
- `organization_id` (UUID, FK to organizations)
- `event_type` (TEXT) - e.g., "job.created", "evidence.uploaded"
- `entity_type` (TEXT) - e.g., "job", "evidence", "audit"
- `entity_id` (TEXT) - ID of affected entity
- `payload` (JSONB) - Small JSON with context
- `created_at` (TIMESTAMPTZ)
- `created_by` (UUID, FK to auth.users)

**RLS Policies**:
- Users can only read events for their organization
- Only service role can insert (backend-only)
- Events auto-delete after 24 hours (lightweight)

**Realtime**: Enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE realtime_events;`

---

## 🔧 Backend Implementation

### Event Emission Helper

**File**: `apps/backend/src/utils/realtimeEvents.ts`

**Functions**:
- `emitRealtimeEvent()` - Generic event emitter
- `emitJobEvent()` - Job-specific events
- `emitEvidenceEvent()` - Evidence-specific events
- `emitAuditEvent()` - Audit events

**Usage**:
```typescript
// After job creation
await emitJobEvent(organization_id, "job.created", job.id, userId);

// After evidence upload
await emitEvidenceEvent(organization_id, "evidence.uploaded", documentId, jobId, userId);
```

### Event Emission Points

**File**: `apps/backend/src/routes/jobs.ts`

**Events Emitted**:
- `job.created` - After job creation (line ~1003)
- `job.updated` - After job update (line ~1185)
- `job.archived` - After job archive (line ~1610)
- `job.flagged` - After job flag/unflag (line ~1753)
- `evidence.uploaded` - After document upload (line ~1478)

**Pattern**:
```typescript
// 1. Do the mutation
const { data: job } = await supabase.from("jobs").insert(...)

// 2. Log audit
await recordAuditLog({ ... })

// 3. Emit realtime event (non-blocking)
await emitJobEvent(organization_id, "job.created", job.id, userId)
```

---

## 📱 iOS Implementation

### RealtimeEventService

**File**: `mobile/Riskmate/Riskmate/Services/RealtimeEventService.swift`

**Features**:
- Subscribes to Supabase Realtime on `realtime_events` table
- Filters by `organization_id` (only gets events for current org)
- Debounce (500ms) - batches rapid events
- Coalesce - if 10 events for same job arrive, refresh once
- App lifecycle handling - resubscribe on foreground, catch-up refresh

**Subscription**:
```swift
// In SessionManager after login/org load
await RealtimeEventService.shared.subscribe(organizationId: orgId)

// Automatically:
// - Subscribes on login
// - Resubscribes on foreground
// - Unsubscribes on logout
```

**Event Handling**:
```swift
// On event received:
// 1. Add to pending events (with debounce key)
// 2. Start debounce timer (500ms)
// 3. After timer: process all pending events
// 4. Coalesce by entity (same job = one refresh)
// 5. Call JobsStore.refreshOnEvent()
```

### Integration Points

**SessionManager**:
- Subscribes after login
- Subscribes after session restore
- Unsubscribes on logout

**JobsStore**:
- `refreshOnEvent()` method ready
- Light refresh: fetches page 1, merges with existing
- Only refreshes if event is job-related

---

## 🔄 Event Flow Example

### Scenario: User A creates a job, User B sees it instantly

1. **User A** (iOS): Creates job
   - `POST /api/jobs` → Backend creates job
   - Backend: `emitJobEvent(orgId, "job.created", jobId, userId)`
   - Event inserted into `realtime_events` table

2. **Supabase Realtime**: Broadcasts event
   - WebSocket message to all subscribers for that `organization_id`

3. **User B** (iOS): Receives event
   - `RealtimeEventService` receives event
   - Debounce timer starts (500ms)
   - After 500ms: `JobsStore.refreshOnEvent("job.created", jobId)`
   - JobsStore: Light refresh (page 1), merges with existing
   - UI updates: New job appears in list

4. **User B** (Web): Same flow
   - WebSocket receives event
   - SWR cache invalidated for `/api/jobs`
   - UI re-fetches and updates

---

## 🛡️ Debounce & Coalesce Pattern

### Problem
If 10 events arrive in 1 second (e.g., rapid job updates), we don't want 10 refreshes.

### Solution

**Debounce** (500ms):
- Events collected in `pendingEvents` map
- Timer starts on first event
- Timer resets on each new event
- After 500ms of silence: process all pending events

**Coalesce** (by entity):
- Group events by `entityType:entityId`
- If 10 events for same job: refresh once
- If events for different jobs: refresh each

**Code**:
```swift
// Debounce key: "eventType:entityId"
let coalesceKey = "\(eventType):\(entityId ?? "none")"
pendingEvents[coalesceKey] = Date()

// After debounce: coalesce by entity
let entityKey = "\(entityType):\(entityId ?? "all")"
if !entityRefreshes.contains(entityKey) {
    entityRefreshes.insert(entityKey)
    await refreshStore(...)
}
```

---

## 🔋 Battery Optimization

### App Lifecycle Handling

**Background**:
- Keep subscription alive (Supabase handles reconnection)
- Pause processing (don't refresh UI when backgrounded)

**Foreground**:
- Resubscribe if needed
- Catch-up refresh: `JobsStore.fetch(forceRefresh: true)`
- Ensures UI is up-to-date after being away

**Code**:
```swift
@objc private func appWillEnterForeground() {
    Task {
        if let orgId = organizationId {
            await subscribe(organizationId: orgId)
            await JobsStore.shared.fetch(forceRefresh: true) // Catch-up
        }
    }
}
```

---

## ✅ Event Types Supported

### Job Events
- `job.created` - New job created
- `job.updated` - Job updated (status, risk score, etc.)
- `job.archived` - Job archived
- `job.flagged` - Job flagged for review

### Evidence Events
- `evidence.uploaded` - Evidence document uploaded
- `evidence.synced` - Evidence synced (from offline queue)
- `evidence.verified` - Evidence verified by manager

### Audit Events
- `audit.appended` - New audit log entry

### Future Events
- `mitigation.completed` - Mitigation item completed
- `export.ready` - Export/proof pack ready
- `proof_pack.generated` - Proof pack generated

---

## 🧪 Testing

### Manual Test (Device)

1. **Two devices** logged in to same org
2. **Device A**: Create job
3. **Device B**: Should see job appear in list within 1 second (no pull-to-refresh needed)

### Verify Events

**Supabase Dashboard**:
```sql
SELECT * FROM realtime_events 
WHERE organization_id = 'your-org-id' 
ORDER BY created_at DESC 
LIMIT 10;
```

**iOS Logs**:
```
[RealtimeEventService] 📨 Received event: job.created, entity: job, id: abc123
[RealtimeEventService] 🔔 Event: job.created, entity: job, id: abc123
[JobsStore] 🔔 Event received: job.created, refreshing...
```

---

## 🚀 Next Steps

### Phase 1: Web Integration (Same Pattern)
- Subscribe to Realtime in Next.js
- Invalidate SWR cache on events
- Same debounce/coalesce logic

### Phase 2: More Event Types
- `mitigation.completed` → Refresh job detail
- `export.ready` → Show notification
- `proof_pack.generated` → Update exports tab

### Phase 3: APNs (Important Only)
- Proof pack ready → Push notification
- Job flagged → Push notification
- Compliance violation → Push notification

---

## 📋 Migration Steps

1. **Run Migration**:
   ```bash
   supabase db push
   # Or: Apply migration 20250126000000_add_realtime_events_table.sql
   ```

2. **Verify Realtime Enabled**:
   - Supabase Dashboard → Database → Realtime
   - Confirm `realtime_events` table is enabled

3. **Test Event Emission**:
   - Create a job via API
   - Check `realtime_events` table for new row

4. **Test iOS Subscription**:
   - Login on iOS
   - Check logs: `[RealtimeEventService] ✅ Subscribed`
   - Create job from web
   - iOS should receive event and refresh

---

**Push signals are now live. App never has to "ask" the server repeatedly.** 🚀
