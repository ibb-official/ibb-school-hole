# Multi-stage Dockerfile for Next.js Standalone (ibb-school-hole)
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

FROM base AS runner
RUN apk add --no-cache libc6-compat libstdc++
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV FORUM_DB_PATH="/app/data/forum.db"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/data

# Remove package managers from final runtime image to minimize attack surface
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg \
           /usr/local/bin/corepack

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN chmod -R 755 ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
