FROM node:22-alpine AS base

# Install archive extraction tools: bsdtar (rar/cbr), 7zip (7z)
RUN apk add --no-cache libarchive-tools 7zip

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Fetch and extract bundled JMdict (English, common-only) from upstream releases.
# Upstream tags include a build timestamp (e.g. `3.6.2+20260504132921`); the
# asset filenames embed the same string. Pin both via JMDICT_TAG. The `+` is
# URL-encoded to %2B so curl forwards it verbatim.
FROM base AS dict
ARG JMDICT_TAG=3.6.2+20260504132921
RUN apk add --no-cache curl tar
WORKDIR /tmp/jmdict
RUN ENC_TAG="$(printf '%s' "${JMDICT_TAG}" | sed 's/+/%2B/g')" \
 && curl -L --fail \
      -o jmdict-eng-common.json.tgz \
      "https://github.com/scriptin/jmdict-simplified/releases/download/${ENC_TAG}/jmdict-eng-common-${ENC_TAG}.json.tgz" \
 && tar -xzf jmdict-eng-common.json.tgz \
 && mkdir -p /opt/dict \
 && mv jmdict-eng-common-*.json /opt/dict/jmdict-eng-common.json \
 && echo "${JMDICT_TAG}" > /opt/dict/VERSION \
 && rm -rf /tmp/jmdict

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ARG BUILD_COMMIT_SHA="unknown"
ARG BUILD_DATE=""
ENV NODE_ENV=production
ENV MANGA_DIR=/manga
ENV DATABASE_URL=/data/mangashelf.db
ENV BUILD_COMMIT_SHA=${BUILD_COMMIT_SHA}
ENV BUILD_DATE=${BUILD_DATE}
LABEL org.opencontainers.image.revision="${BUILD_COMMIT_SHA}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /data && chown nextjs:nodejs /data
RUN mkdir -p /manga /manga/.covers /manga/.thumbnails && chown -R nextjs:nodejs /manga/.covers /manga/.thumbnails
RUN mkdir -p /tmp/mangashelf-extract && chown nextjs:nodejs /tmp/mangashelf-extract
RUN mkdir -p /tmp/mangashelf-import && chown nextjs:nodejs /tmp/mangashelf-import

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle
COPY --from=dict --chown=nextjs:nodejs /opt/dict /opt/dict

ENV DICT_DIR=/opt/dict

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
