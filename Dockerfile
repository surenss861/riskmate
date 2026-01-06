# Dockerfile for PDF generation testing and QA
# This ensures consistent Node version and dependencies for PDF tests

FROM node:20-alpine

WORKDIR /app

# Install system dependencies for PDF generation (if needed for fonts/chromium later)
RUN apk add --no-cache \
    fontconfig \
    ttf-dejavu \
    ttf-liberation

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm if not present
RUN npm install -g pnpm@latest

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Default command: run PDF tests
CMD ["pnpm", "test", "__tests__/pdf-executive-brief.test.ts"]
