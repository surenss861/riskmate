#!/usr/bin/env bash
# Deploy Riskmate: commit + push (triggers Vercel/Railway if connected), then explicit Vercel + Railway CLI.
# Run from repo root. Usage: ./scripts/deploy.sh [commit-message]

set -e
MSG="${1:-Deploy: latest changes}"

echo "==> Staging changes..."
git add -A
git status

if git diff --staged --quiet; then
  echo "==> No changes to commit."
else
  echo "==> Committing..."
  git commit -m "$MSG"
fi

echo "==> Pushing to origin main (triggers Vercel + Railway if repo connected)..."
git push origin main

echo "==> Vercel production deploy..."
npx vercel --prod

echo "==> Railway deploy (backend)..."
if command -v railway &>/dev/null; then
  (cd apps/backend && railway up --detach)
elif npx railway --version &>/dev/null 2>&1; then
  (cd apps/backend && npx railway up --detach)
else
  echo "    (Railway CLI not found; deploy may still run from GitHub connection.)"
fi

echo "==> Done."
