---
description: Deploy to GitHub, Vercel, and Railway. Run this at the end of every task.
---

# Deploy workflow (run at end of every task)

After completing any task, run deploy so that GitHub, Vercel, and Railway are updated.

## Steps (in order)

1. **Stage and commit**
   - `git add -A`
   - If there are changes: `git commit -m "<short description of what was done>"`

2. **Push to GitHub**
   - `git push origin main`
   - This triggers Vercel and Railway automatically if the repo is connected in their dashboards.

3. **Vercel production deploy** (explicit, from repo root)
   - `npx vercel --prod`

4. **Railway deploy** (backend, from apps/backend)
   - If Railway CLI is available: `cd apps/backend && railway up --detach` (or `npx railway up --detach`)
   - If not, the push in step 2 may already trigger Railway if the project is connected to GitHub.

## One-command option

From repo root:
```bash
./scripts/deploy.sh "Your commit message"
```
This runs: add, commit (if changes), push, vercel --prod, railway up.

## Important

- Always run deploy at the **end of every task** so the user gets updates on Vercel and Railway.
- If `git push` fails (e.g. auth), tell the user to run the steps manually or `./scripts/deploy.sh "message"`.
