FROM node:20-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files needed for pnpm install (from repo root)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy backend package
COPY apps/backend ./apps/backend

# Install dependencies (monorepo-aware, uses workspace)
RUN pnpm install --frozen-lockfile

# Build backend (TypeScript → dist/)
RUN pnpm -C apps/backend build

# Expose port (Railway will inject PORT env var)
EXPOSE 3000

# Start the backend
CMD ["pnpm", "-C", "apps/backend", "start"]

