# Dockerfile for PDF generation testing and QA
# Matches Vercel's build environment (Amazon Linux 2023) for consistent results
# This ensures PDF generation is deterministic and catches regressions before deploy

FROM public.ecr.aws/amazonlinux/amazonlinux:2023

WORKDIR /app

# Install Node.js 20 (matching Vercel's build environment)
RUN dnf install -y nodejs npm && \
    npm install -g pnpm@latest

# Install system dependencies for PDF generation
# Fonts and fontconfig ensure consistent PDF rendering
RUN dnf install -y \
    fontconfig \
    dejavu-sans-fonts \
    dejavu-serif-fonts \
    liberation-fonts \
    && fc-cache -f

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Default command: run PDF tests
CMD ["pnpm", "test", "__tests__/pdf-executive-brief.test.ts"]
