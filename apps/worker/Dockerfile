# ==============================================================================
# Guardião Fiscal — Worker (BullMQ). Contexto de build: raiz do monorepo.
# ==============================================================================
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json ./
COPY pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --filter @guardiao/worker --filter @guardiao/shared --no-frozen-lockfile
COPY packages/shared packages/shared
COPY apps/worker apps/worker
RUN pnpm --filter @guardiao/shared build && pnpm --filter @guardiao/worker build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
