# Multi-stage build: deps + runtime
FROM node:20-alpine AS base

# Install system dependencies required by native modules (canvas, sharp, etc.)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    libjpeg-turbo \
    libpng \
    cairo \
    pango \
    giflib

WORKDIR /app

# Copy dependency manifests first for better caching
COPY package.json package-lock.json ./

# Install ALL dependencies (including dev for build/runtime needs)
RUN npm install

# Copy source code
COPY . .

# Create uploads directory and set permissions
RUN mkdir -p uploads gallery && chmod -R 755 uploads gallery

# Remove dev dependencies to slim image
RUN npm prune --production

# Expose the application port
EXPOSE 5008

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5008/api/v1/system/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application
CMD ["npm", "start"]
