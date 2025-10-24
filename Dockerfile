# syntax=docker/dockerfile:1.6

FROM node:20-slim AS base
WORKDIR /opt/app
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
ENV NODE_ENV=development
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS builder
ENV NODE_ENV=production
COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma
COPY src ./src
COPY --from=deps /opt/app/node_modules ./node_modules
RUN npm run build

FROM base AS production-deps
ENV NODE_ENV=production
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --include=optional

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /opt/app
COPY --chown=node:node package*.json ./
COPY --from=production-deps --chown=node:node /opt/app/node_modules ./node_modules
COPY --from=deps --chown=node:node /opt/app/node_modules/prisma ./node_modules/prisma
COPY --from=deps --chown=node:node /opt/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps --chown=node:node /opt/app/node_modules/.bin ./node_modules/.bin
COPY --from=builder --chown=node:node /opt/app/dist ./dist
COPY --from=builder --chown=node:node /opt/app/prisma ./prisma
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD curl -sf http://127.0.0.1:3000/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
