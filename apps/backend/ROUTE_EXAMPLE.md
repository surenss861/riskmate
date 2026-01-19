# Route Example: requireWriteAccess Usage

## Example: PATCH /api/jobs/:id

```typescript
// PATCH /api/jobs/:id
// Updates a job and optionally recalculates risk score
jobsRouter.patch(
  "/:id",
  authenticate as unknown as express.RequestHandler,
  requireWriteAccess as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      // At this point, we know:
      // 1. User is authenticated (authenticate middleware passed)
      // 2. User has write access (requireWriteAccess middleware passed)
      // 3. User is NOT auditor or executive
      
      const jobId = authReq.params.id;
      const { organization_id, id: userId } = authReq.user;
      const updateData = authReq.body;
      
      // ... rest of handler logic (update job, recalculate risk, etc.)
      
    } catch (err: any) {
      // ... error handling
    }
  }
);
```

## Middleware Order (Critical)

1. `authenticate` - Validates JWT, attaches `req.user`
2. `requireWriteAccess` - Blocks auditor/executive, validates user context
3. Route handler - Business logic

## What happens when blocked

If an auditor/executive attempts this endpoint:

1. `requireWriteAccess` detects `role === 'auditor'` or `role === 'executive'`
2. Logs violation to audit trail
3. Returns `403` with consistent error format:
   ```json
   {
     "message": "Auditors have read-only access",
     "code": "AUTH_ROLE_READ_ONLY",
     "category": "auth",
     "severity": "info",
     "internal_message": "Write blocked for role=auditor at PATCH /api/jobs/123",
     "request_id": "req_abc123",
     "timestamp": "2025-01-20T10:30:00Z"
   }
   ```
4. Sets `X-Error-ID` header for debugging

## Why this pattern works

- **Fail-closed**: If auth is missing, returns 401 immediately
- **Consistent errors**: Uses `createErrorResponse` format used everywhere
- **Audit trail**: All violations logged for compliance
- **Request tracking**: Includes `request_id` for debugging
- **No silent failures**: All blocked requests return explicit 403
