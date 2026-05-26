# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-bookworm AS deps

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

# ============================================
# Stage 2: Build
# ============================================
FROM node:20-bookworm AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# ============================================
# Stage 3: Production
# ============================================
FROM node:20-bookworm AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx

COPY <<EOF /app/start.sh
#!/bin/sh
set -e
echo "=== 1. Prisma schema sync ==="
./node_modules/.bin/prisma db push --accept-data-loss --skip-generate

echo "=== 2. Running data migrations ==="
./node_modules/.bin/tsx ./prisma/migrate-collected-amount.ts || {
  echo "Migration script exited with code $? (this is OK if already migrated)"
}

echo "=== 3. Starting application ==="
exec node server.js
EOF

RUN chmod +x /app/start.sh

RUN mkdir -p /app/.npm && chown -R nextjs:nodejs /app
ENV HOME=/app
ENV NPM_CONFIG_CACHE=/app/.npm
ENV PATH=/app/node_modules/.bin:$PATH

USER nextjs

EXPOSE 4001

ENV PORT=4001
ENV HOSTNAME="0.0.0.0"

CMD ["/app/start.sh"]
