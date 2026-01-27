# ==================================
# Stage 1: Dependencies (cached layer)
# ==================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only package files for better caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# ==================================
# Stage 2: Builder
# ==================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci && \
    npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ==================================
# Stage 3: Production (minimal)
# ==================================
FROM node:20-alpine AS production

# Install FFmpeg and security updates
RUN apk add --no-cache \
    ffmpeg \
    wget \
    && apk upgrade --no-cache

# Create non-root user for security
# Following docker-expert skill: never run as root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S deepcut -u 1001 -G nodejs

WORKDIR /app

# Copy production dependencies from deps stage with proper ownership
COPY --from=deps --chown=deepcut:nodejs /app/node_modules ./node_modules

# Copy built files from builder stage with proper ownership
COPY --from=builder --chown=deepcut:nodejs /app/dist ./dist
COPY --from=builder --chown=deepcut:nodejs /app/public ./public

# Copy drizzle config and schema for database migrations
COPY --from=builder --chown=deepcut:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=deepcut:nodejs /app/shared ./shared
COPY --from=builder --chown=deepcut:nodejs /app/package*.json ./

# Create directories for assets, data, and logs with proper permissions
RUN mkdir -p /app/assets /app/data /app/logs && \
    chown -R deepcut:nodejs /app

# Switch to non-root user
USER deepcut

# Environment variables
ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0

# Expose port
EXPOSE 5000

# Health check with improved params
# start-period increased to allow app initialization
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/setup/status || exit 1

# Start the application
CMD ["node", "dist/index.cjs"]
