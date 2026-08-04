# ==============================================================================
# Guardião Fiscal — Web (Next.js). Contexto de build: raiz do monorepo.
# ==============================================================================
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --filter @guardiao/web --filter @guardiao/shared --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @guardiao/shared build && pnpm --filter @guardiao/web build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
# Assets públicos (mascote, imagens): o standalone NÃO os inclui sozinho
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
