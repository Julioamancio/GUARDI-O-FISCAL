# ==============================================================================
# Guardião Fiscal — Worker (BullMQ). Contexto de build: raiz do monorepo.
# ==============================================================================
FROM node:20-alpine AS base
RUN corepack enable && apk add --no-cache openssl
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --filter @guardiao/worker --filter @guardiao/shared --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/worker apps/worker
# O worker usa o Prisma Client gerado a partir do schema da API. O schema é
# copiado para DENTRO do worker: o prisma generate resolve o projeto pela pasta
# do schema, e apps/api não tem node_modules nesta imagem.
COPY apps/api/prisma/schema.prisma apps/worker/prisma/schema.prisma
RUN pnpm --filter @guardiao/shared build \
 && pnpm --filter @guardiao/worker exec prisma generate \
 && pnpm --filter @guardiao/worker build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
