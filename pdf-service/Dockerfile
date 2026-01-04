FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Set timezone to Eastern (America/New_York handles DST correctly)
ENV TZ=America/New_York

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Install Playwright browsers (ensure Chromium is available)
RUN npx playwright install chromium

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]

