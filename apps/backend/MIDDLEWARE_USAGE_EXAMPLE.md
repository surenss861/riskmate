# Middleware Usage Example

## Route Pattern

All mutation endpoints follow this pattern:

```typescript
jobsRouter.patch("/:id", 
  authenticate as unknown as express.RequestHandler,
  requireWriteAccess as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      // At this point, we know:
      // 1. User is authenticated (authenticate middleware)
      // 2. User has write access (requireWriteAccess middleware)
      // 3. User is NOT auditor or executive
      
      const { organization_id, id: userId, role } = authReq.user;
      // ... rest of handler logic
    } catch (err: any) {
      // ... error handling
    }
  }
);
```

## Middleware Order

**Critical:** Middleware order matters:

1. `authenticate` - Validates JWT, loads user context
2. `requireWriteAccess` - Blocks read-only roles (auditor/executive)
3. Route-specific middleware (e.g., `enforceJobLimit`)
4. Handler function

## Error Response Format

When `requireWriteAccess` blocks a request, it returns:

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

With header:
```
X-Error-ID: err_xyz789
```

## Protected Endpoints

All these endpoints use `requireWriteAccess`:

- `POST /api/jobs` - Job creation
- `PATCH /api/jobs/:id` - Job update
- `PATCH /api/jobs/:id/mitigations/:mitigationId` - Mitigation update
- `POST /api/jobs/:id/documents` - Evidence upload
- `POST /api/jobs/:id/archive` - Archive job
- `PATCH /api/jobs/:id/flag` - Flag job
- `POST /api/jobs/:id/signoffs` - Create signoff
- `DELETE /api/jobs/:id` - Delete job

## Allowed Endpoints (Read-Only Output)

These endpoints intentionally **do NOT** use `requireWriteAccess`:

- `POST /api/jobs/:id/proof-pack` - Generates PDF (auditors allowed - read-only output)
