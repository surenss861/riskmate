# Deploy Riskmate: GitHub → Vercel (Web) + Railway (Backend)

Use this **after** the Week 1–2 trust fixes (export failure intelligence, etc.) to deploy the current codebase.

---

## 1. GitHub

### Push your branch

```bash
# From repo root
git add -A
git status
git commit -m "Week 1-2: Export failure intelligence, performance indexes, deploy guide"
git push origin main
```

If you use a different branch (e.g. `release/vercel-railway`), push that and use it when connecting Vercel/Railway.

### Ensure repo is ready

- **Branch**: Vercel and Railway will build from `main` (or the branch you choose).
- **Secrets**: Do **not** commit `.env` or secrets. Use GitHub Actions secrets only if you add CI later.
- **Monorepo**: Web app is at **repo root** (Next.js). Backend is in **`apps/backend`**.

---

## 2. Vercel (Web)

### Create project

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. **Import** your GitHub repo (e.g. `your-org/riskmate`).
3. **Root Directory**: leave as **`.`** (repo root = Next.js app).
4. **Framework Preset**: Next.js (auto-detected).
5. **Build Command**: `pnpm build` (or `npm run build` if you use npm).
6. **Install Command**: `pnpm install`.
7. **Output Directory**: leave default (`.next`).

### Environment variables (Vercel)

In **Project → Settings → Environment Variables**, add (for **Production** and optionally **Preview**):

| Name | Value | Notes |
|------|--------|--------|
| `NEXT_PUBLIC_API_URL` | `https://<your-railway-backend>.up.railway.app` | Backend URL (from Railway step below) |
| `NEXT_PUBLIC_BACKEND_URL` | Same as above | Legacy; some code still reads this |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon key>` | Supabase anon key (public) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` or `pk_test_...` | Stripe publishable key |
| `NEXT_PUBLIC_POSTHOG_KEY` | (optional) | PostHog project key |
| `NEXT_PUBLIC_POSTHOG_HOST` | (optional) | e.g. `https://app.posthog.com` |

Do **not** set `BACKEND_URL` to localhost in production. Point both URL vars to your **Railway backend URL**.

### Deploy

- Click **Deploy**. Vercel builds from `main` and deploys.
- **Domains**: Add custom domain (e.g. `riskmate.dev`, `www.riskmate.dev`) under **Settings → Domains** and follow DNS instructions.

### Verify

- Open `https://<your-vercel-app>.vercel.app` (or your custom domain).
- Log in; open Operations → Jobs; confirm API calls go to Railway (check Network tab: request URL = `NEXT_PUBLIC_API_URL`).

---

## 3. Railway (Backend)

### Create project

1. Go to [railway.app](https://railway.app) → **New Project**.
2. **Deploy from GitHub repo**: select the same repo (`your-org/riskmate`).
3. **Root Directory**: set to **`apps/backend`** (so Railway runs the Express app).
4. **Build Command**: `pnpm install && pnpm build`.
5. **Start Command**: `pnpm start` or `pnpm start:railway` (see `apps/backend/package.json` scripts).
6. **Watch Paths**: leave default or set to `apps/backend/**` so only backend changes trigger redeploys.

### Environment variables (Railway)

In **Project → Variables** (or **Service → Variables**), add:

| Name | Value | Notes |
|------|--------|--------|
| `NODE_ENV` | `production` | |
| `PORT` | `8080` or leave default | Railway often injects PORT |
| `SUPABASE_URL` | `https://<project>.supabase.co` | Same as web |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service role key>` | Server-only; never expose to client |
| `SUPABASE_ANON_KEY` | (optional) | If backend needs it |
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` | |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | For Stripe webhooks; use webhook URL from Railway |
| `ALLOWED_ORIGINS` | `https://riskmate.dev,https://www.riskmate.dev` | Comma-separated; add your Vercel URL if different |
| `DEV_AUTH_SECRET` | *(leave unset in production)* | Unset so `/v1/dev/*` is disabled |
| `APNS_KEY_PATH` | `/path/to/AuthKey_XXXXXXXX.p8` | Path to Apple .p8 key file for APNs (optional; needed for iOS push) |
| `APNS_KEY_ID` | Key ID from Apple Developer | Key ID for the .p8 key |
| `APNS_TEAM_ID` | Apple Developer Team ID | Your team ID |
| `APNS_BUNDLE_ID` | `com.riskmate.Riskmate` | App bundle ID for push topic |
| `APNS_PRODUCTION` | `false` or `true` | Use `true` for production APNs, `false` for sandbox |

Do **not** set `DEV_AUTH_SECRET` in production. For iOS push notifications, provide the APNs variables above; the backend reads the `.p8` file from `APNS_KEY_PATH` and uses it for token-based APNs authentication.

### Domain and webhook

1. **Settings → Networking → Generate Domain**: Railway gives you a URL like `https://<service>.up.railway.app`.
2. Copy this URL into Vercel’s `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_BACKEND_URL` (see step 2).
3. **Stripe webhook**: In Stripe Dashboard → Webhooks → Add endpoint:
   - URL: `https://<your-railway-domain>.up.railway.app/api/stripe/webhook`
   - Events: e.g. `checkout.session.completed`, `customer.subscription.*`, etc.
   - Copy the **Signing secret** into Railway’s `STRIPE_WEBHOOK_SECRET`.

### Deploy and verify

- Push to `main` (or your connected branch); Railway builds and deploys.
- **Health check**:  
  `curl https://<your-railway-domain>.up.railway.app/health`  
  Expect `{"status":"ok",...}`.
- **Version**:  
  `curl https://<your-railway-domain>.up.railway.app/__version`  
  Confirm service and commit info.

---

## 4. Supabase (DB + migrations)

Migrations are in `supabase/migrations/`. Apply them to your Supabase project **before** or right after first deploy.

### Option A: Supabase Dashboard

1. **SQL Editor** → New query.
2. Run each migration file in order (by filename timestamp), or use the CLI (option B).

### Option B: Supabase CLI

```bash
# Link project (one-time)
npx supabase link --project-ref <your-project-ref>

# Push migrations
npx supabase db push
```

Ensure **`20250126000002_add_exports_failure_reason.sql`** and **`20250201000000_performance_indexes.sql`** are applied so export failure reasons and performance indexes are active.

---

## 5. Post-deploy checklist

- [ ] **Web (Vercel)**: Homepage loads; login works; API requests go to Railway URL (Network tab).
- [ ] **Backend (Railway)**: `/health` and `/__version` return 200; logs show no crash.
- [ ] **Export**: Create a job, add evidence, trigger Proof Pack; if it fails, confirm export row has a clear `failure_reason` (e.g. “Missing X evidence items…”).
- [ ] **Stripe**: Test checkout or portal; confirm webhook is received (Stripe Dashboard → Webhooks → Logs).
- [ ] **iOS**: Point `Config.plist` `BACKEND_URL` to the same Railway URL; run app and confirm jobs/export work.

---

## 6. Rollback (if needed)

- **Vercel**: Deployments → select previous deployment → **Promote to Production**.
- **Railway**: Deployments → select previous deployment → **Redeploy**.
- **DB**: Migrations are additive (new column, new indexes); no rollback script here. Revert app/backend first; fix data manually if required.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Push code to GitHub (`main` or your release branch). |
| 2 | Vercel: Import repo, root `.`, set env (e.g. `NEXT_PUBLIC_API_URL` = Railway URL), deploy. |
| 3 | Railway: Deploy from same repo, root `apps/backend`, set env (Supabase, Stripe, `ALLOWED_ORIGINS`), generate domain, set Stripe webhook URL. |
| 4 | Point Vercel env to Railway URL; apply Supabase migrations (failure_reason + performance indexes). |
| 5 | Verify health, login, export failure reason, and Stripe webhook. |

After this, you can continue with the rest of the roadmap (offline MVP, caching pass, Procore, multi-site).
