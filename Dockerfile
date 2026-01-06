# Dockerfile for PDF generation testing and QA
# Matches Vercel's build environment (Amazon Linux 2023) for consistent results
# This ensures PDF generation is deterministic and catches regressions before deploy

FROM public.ecr.aws/amazonlinux/amazonlinux:2023

WORKDIR /app

# Install system dependencies (needed for NodeSource installer + fonts)
RUN dnf install -y \
    curl ca-certificates tar gzip \
    fontconfig \
    dejavu-sans-fonts \
    dejavu-serif-fonts \
    liberation-fonts \
 && fc-cache -f \
 && dnf clean all

# Install Node.js 20 explicitly via NodeSource (matches Vercel's build environment)
# Don't trust default repos - they may not have Node 20
RUN curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - \
 && dnf install -y nodejs \
 && corepack enable \
 && corepack prepare pnpm@10.27.0 --activate

# Copy only manifests first for better layer caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build the application (so Next route code is compiled)
RUN pnpm run build

# Default command: run PDF tests
CMD ["pnpm", "test", "__tests__/pdf-executive-brief.test.ts"]
