# Multi-stage build for production optimization
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Install dependencies for build
RUN apt-get update && apt-get install -y openssl python3 make g++

# Copy package files
COPY package*.json ./
COPY src/prisma ./src/prisma/

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and build
RUN npm run install:prisma-manual
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Production stage
FROM node:20-slim AS production

WORKDIR /usr/src/app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/src/prisma ./src/prisma

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check removed - Cloud Run handles this

# Start command
CMD ["node", "dist/src/main"]
