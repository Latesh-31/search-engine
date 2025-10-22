# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /usr/src/app
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS build
ENV NODE_ENV=development
COPY package*.json ./
COPY tsconfig*.json ./
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY src ./src
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
RUN npm prune --omit=dev
EXPOSE 3000
CMD ["node", "dist/index.js"]
