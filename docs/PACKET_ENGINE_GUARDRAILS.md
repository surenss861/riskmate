# Packet Engine Production Guardrails

This document outlines the production guardrails implemented for the Packet Engine to prevent common security and reliability issues.

## ✅ Implemented Guardrails

### 1. PacketType Validation (Allowlist Check)

**Location**: `app/api/reports/generate/[id]/route.ts`

**Implementation**:
- Validates `packetType` against `PACKETS` allowlist using `isValidPacketType()`
- Returns `400 Bad Request` with detailed error message if invalid
- Prevents injection attacks and typos from reaching database/storage

**Code**:
```typescript
if (rawPacketType && !isValidPacketType(rawPacketType)) {
  return NextResponse.json({
    message: 'Invalid packet type',
    detail: `packetType must be one of: ${Object.keys(PACKETS).join(', ')}`,
    received: rawPacketType
  }, { status: 400 })
}
```

### 2. ID Semantics Verification

**✅ Generate Route (`/api/reports/generate/:id`)**
- `:id` parameter = `jobId` (correct)
- Creates new `report_run` record
- Returns `report_run_id` in response

**✅ Packet Print Route (`/reports/packet/print/:runId`)**
- `:runId` parameter = `report_run.id` (correct)
- Renders frozen snapshot from `report_runs` table
- Always renders the same content (auditable)

**Why this matters**: Print routes should use `runId` to ensure frozen, immutable exports. Using `jobId` would allow data to change between generation and rendering.

### 3. Token Security (runId/jobId Validation)

**Location**: `app/reports/[id]/packet/print/page.tsx`

**Implementation**:
- Token includes `reportRunId` for additional security
- Validates `token.reportRunId === url.runId` (prevents token reuse)
- Validates `token.jobId === reportRun.job_id` (prevents cross-job access)

**Code**:
```typescript
// Validate runId matches token
if (rawToken && tokenPayload?.reportRunId && tokenPayload.reportRunId !== runId) {
  return 403 // Token Mismatch
}

// Validate jobId matches reportRun
if (rawToken && tokenPayload?.jobId && tokenPayload.jobId !== reportRun.job_id) {
  return 403 // Token Mismatch
}
```

### 4. Database packet_type Validation

**Location**: `app/reports/[id]/packet/print/page.tsx`

**Implementation**:
- Validates `packet_type` from database before use
- Prevents rendering if database has invalid/compromised packet_type
- Returns `500` if database contains invalid packet_type

**Code**:
```typescript
const packetTypeFromDB = reportRun.packet_type as string
if (!packetTypeFromDB || !isValidPacketType(packetTypeFromDB)) {
  return 500 // Invalid Packet Type
}
```

### 5. Storage Path Integrity

**Location**: `app/api/reports/generate/[id]/route.ts`

**Implementation**:
- Storage path includes `packet_type`: `{orgId}/{jobId}/{packetType}/{runId}.pdf`
- Ensures organized storage and prevents collisions
- `report_runs.packet_type` is always populated (defaults to 'insurance' if not provided)

**Code**:
```typescript
const storagePath = packetType && isValidPacketType(packetType)
  ? `${organization_id}/${jobId}/${packetType}/${reportRun.id}.pdf`
  : `${organization_id}/${jobId}/${reportRun.id}/${pdfHash}.pdf`
```

### 6. Request ID for Observability

**Location**: `app/api/reports/generate/[id]/route.ts`

**Implementation**:
- Every request gets a unique `requestId` (UUID)
- Included in all log statements and error responses
- Enables tracing across async operations

## 🔒 Security Checks Summary

| Check | Location | Status |
|-------|----------|--------|
| PacketType allowlist | API route | ✅ 400 error |
| Token runId match | Print route | ✅ 403 error |
| Token jobId match | Print route | ✅ 403 error |
| DB packet_type validation | Print route | ✅ 500 error |
| Org membership | Both routes | ✅ 404/403 errors |
| Job ownership | Both routes | ✅ 404 errors |

## 📋 Post-Deploy Verification Checklist

### Smoke Tests (Manual)

1. **Test all 4 packet types**:
   - [ ] `insurance` packet exports successfully
   - [ ] `audit` packet exports successfully
   - [ ] `incident` packet exports successfully
   - [ ] `client_compliance` packet exports successfully

2. **Test edge cases**:
   - [ ] Job with no hazards (empty data)
   - [ ] Job with many hazards (large data)
   - [ ] Job with long names (overflow test)

3. **Test abuse scenarios**:
   - [ ] Invalid packetType → 400 error
   - [ ] Token for Job A used on Job B → 403 error
   - [ ] Cross-org jobId → 404 error
   - [ ] Stale token → 403 error

### Automated Tests (TODO)

1. **Unit test**: Invalid packetType → 400
2. **Integration test**: Packet rendering with fixture data
3. **CI smoke test**: Render fixture runId, assert `#pdf-ready` exists

## 🚀 Future Improvements (Optional)

1. **Snapshot Mode**: Store full JSON payload in `report_runs` for immutable rendering
2. **Unified Routes**: Merge legacy and packet routes into single route with default packetType
3. **Redaction Tests**: Verify client_compliance packet redacts internal data
4. **Permission Tests**: Verify audit packet requires proper permissions

## Notes

- All validation happens server-side (cannot be bypassed by client)
- Token includes both `jobId` and `reportRunId` for defense-in-depth
- Storage paths are organized by packet_type for easy management
- All errors include requestId for observability

