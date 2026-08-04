-- GUARDIÃO FISCAL — migration inicial (Fase 1)
-- Gerada a partir de prisma/schema.prisma. Verificável com:
--   pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma

-- Enums
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "RegimeTributario" AS ENUM ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI', 'IMUNE_ISENTA', 'OUTRO');
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- plans
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxCompanies" INTEGER NOT NULL,
    "maxUsers" INTEGER NOT NULL,
    "storageMb" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- tenants
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "customDomain" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "planId" TEXT,
    "address" JSONB,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- subscriptions
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- roles
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- permissions
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- role_permissions
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId", "permissionId")
);

-- user_roles
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId", "roleId")
);

-- companies
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "inscricaoEstadual" TEXT,
    "inscricaoMunicipal" TEXT,
    "cnaePrincipal" TEXT,
    "regimeTributario" "RegimeTributario",
    "uf" VARCHAR(2),
    "municipio" TEXT,
    "dataAbertura" TIMESTAMP(3),
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "observacoes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- audit_logs (append-only)
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Índices únicos
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "tenants_cnpj_key" ON "tenants"("cnpj");
CREATE UNIQUE INDEX "tenants_customDomain_key" ON "tenants"("customDomain");
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");
CREATE UNIQUE INDEX "permissions_slug_key" ON "permissions"("slug");
CREATE UNIQUE INDEX "companies_tenantId_cnpj_key" ON "companies"("tenantId", "cnpj");

-- Índices de consulta
CREATE INDEX "tenants_status_idx" ON "tenants"("status");
CREATE INDEX "subscriptions_tenantId_idx" ON "subscriptions"("tenantId");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens"("family");
CREATE INDEX "companies_tenantId_status_idx" ON "companies"("tenantId", "status");
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- Chaves estrangeiras
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
