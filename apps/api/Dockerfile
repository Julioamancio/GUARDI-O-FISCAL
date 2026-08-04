# ==============================================================================
# Guardião Fiscal — API (NestJS). Contexto de build: raiz do monorepo.
# ==============================================================================
FROM node:20-alpine AS base
RUN corepack enable && apk add --no-cache openssl
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json ./
COPY pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --filter @guardiao/api --filter @guardiao/shared --no-frozen-lockfile
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @guardiao/shared build \
 && pnpm --filter @guardiao/api prisma:generate \
 && pnpm --filter @guardiao/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 3001
# Aplica migrations pendentes e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
