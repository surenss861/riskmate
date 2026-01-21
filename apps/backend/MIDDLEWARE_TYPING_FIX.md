# Middleware Typing Fix

## Summary

Fixed middleware typing to remove `as unknown as RequestHandler` casts throughout the codebase. Middleware is now properly typed as `RequestHandler` which makes the code cleaner, safer, and easier to maintain.

## Changes Made

### 1. Fixed `authenticate` Middleware (`middleware/auth.ts`)

- **Before**: `authenticate` had a custom signature `(req: AuthenticatedRequest, res: Response, next: NextFunction)`
- **After**: 
  - Renamed internal implementation to `authenticateInternal` with typed request
  - Created `authenticate: RequestHandler` wrapper that casts the request appropriately
  - This allows `authenticate` to be used directly as middleware without casts

```typescript
// Before
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => { ... }

// After
async function authenticateInternal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> { ... }

export const authenticate: RequestHandler = (req, res, next) => {
  return authenticateInternal(req as AuthenticatedRequest, res, next);
};
```

### 2. Fixed `requireWriteAccess` Middleware (`middleware/requireWriteAccess.ts`)

- **Before**: Function signature `function requireWriteAccess(req, res, next)`
- **After**: Typed as `RequestHandler` directly

```typescript
// Before
export function requireWriteAccess(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) { ... }

// After
export const requireWriteAccess: RequestHandler = (req, res, next) => {
  ...
  next(); // Fixed: removed explicit return
};
```

### 3. Removed All Casts in Routes

- Removed all `as unknown as express.RequestHandler` casts from `routes/jobs.ts`
- Middleware can now be used directly: `authenticate`, `requireWriteAccess`, `enforceJobLimit`

```typescript
// Before
jobsRouter.post("/", authenticate as unknown as express.RequestHandler, requireWriteAccess as unknown as express.RequestHandler, ...)

// After
jobsRouter.post("/", authenticate, requireWriteAccess, ...)
```

## Benefits

1. **Type Safety**: Middleware is properly typed, catching errors at compile time
2. **Cleaner Code**: No more unsafe casts scattered throughout route files
3. **Better DX**: TypeScript can now properly infer types and provide better autocomplete
4. **Maintainability**: Future developers won't need to understand why casts are needed

## Proof-Pack Endpoint Verification

Verified that `POST /api/jobs/:id/proof-pack` is truly read-only:
- ✅ Only writes to `audit_logs` table (acceptable for read-only operations)
- ✅ Does NOT write to `jobs` table
- ✅ Does NOT write to `reports` table
- ✅ Only generates and returns PDF (pure output operation)
- ✅ Correctly excluded from `requireWriteAccess` middleware

The endpoint is safe for auditors and executives to use.

## Next Steps

1. ✅ Middleware typing fixed
2. ✅ Proof-pack verified as read-only
3. ⏳ Add integration tests (see `__tests__/routes/read-only-enforcement.test.ts`)
