FROM node:22-alpine AS base

# Install archive extraction tools: bsdtar (rar/cbr), 7zip (7z)
RUN apk add --no-cache libarchive-tools 7zip

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV MANGA_DIR=/manga
ENV DATABASE_URL=/data/mangashelf.db

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /data && chown nextjs:nodejs /data
RUN mkdir -p /manga /manga/.covers /manga/.thumbnails && chown -R nextjs:nodejs /manga/.covers /manga/.thumbnails
RUN mkdir -p /tmp/mangashelf-extract && chown nextjs:nodejs /tmp/mangashelf-extract

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
