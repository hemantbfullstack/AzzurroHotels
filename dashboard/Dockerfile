# Build from repo root:
#   docker build -f dashboard/Dockerfile -t azzurro-dashboard .
# Run:
#   docker run --rm -p 3000:3000 azzurro-dashboard

FROM node:22-bookworm-slim AS deps
WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/dashboard/node_modules ./dashboard/node_modules
COPY output/reviews.json ./output/reviews.json
COPY dashboard ./dashboard
WORKDIR /app/dashboard
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV REVIEWS_PATH=/app/data/reviews.json

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/dashboard/.next/standalone ./
# postbuild already placed dataset + static assets into standalone

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
