FROM node:20-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files needed for pnpm install (from repo root)
# Docker context is repo root, so paths are relative to that
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy lib directory (backend imports from lib/ledger/contracts)
COPY lib ./lib

# Copy backend package
COPY apps/backend ./apps/backend

# Install dependencies (monorepo-aware, uses workspace)
# --prod=false ensures TypeScript is available for build step
RUN pnpm install --frozen-lockfile --prod=false

# Build backend (TypeScript → dist/)
RUN pnpm -C apps/backend build

# Expose port (Railway will inject PORT env var)
EXPOSE 3000

# Start the backend
CMD ["pnpm", "-C", "apps/backend", "start"]

