-- CreateEnum
CREATE TYPE "Department" AS ENUM ('FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO', 'SOCIETARIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "Sphere" AS ENUM ('FEDERAL', 'ESTADUAL', 'MUNICIPAL', 'TRABALHISTA', 'PREVIDENCIARIA', 'OUTRA');

-- CreateEnum
CREATE TYPE "Periodicity" AS ENUM ('MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NAO_INICIADA', 'AGUARDANDO_DOCUMENTOS', 'EM_ANDAMENTO', 'EM_CONFERENCIA', 'AGUARDANDO_APROVACAO', 'CONCLUIDA', 'VENCIDA', 'BLOQUEADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "HolidayScope" AS ENUM ('NACIONAL', 'ESTADUAL', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "ResponsibleArea" AS ENUM ('INTERNO', 'FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "cnaesSecundarios" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "email" TEXT,
ADD COLUMN     "enquadramento" TEXT,
ADD COLUMN     "funcionariosCount" INTEGER,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "tipoJuridico" TEXT;

-- CreateTable
CREATE TABLE "company_contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_responsibles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "area" "ResponsibleArea" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_responsibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "HolidayScope" NOT NULL,
    "uf" VARCHAR(2),
    "municipio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department" "Department" NOT NULL,
    "sphere" "Sphere" NOT NULL,
    "periodicity" "Periodicity" NOT NULL,
    "anchorMonth" INTEGER NOT NULL DEFAULT 1,
    "dueRule" JSONB NOT NULL,
    "regimes" "RegimeTributario"[] DEFAULT ARRAY[]::"RegimeTributario"[],
    "defaultPriority" "TaskPriority" NOT NULL DEFAULT 'MEDIA',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obligation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "sphere" "Sphere" NOT NULL,
    "periodicity" "Periodicity" NOT NULL,
    "anchorMonth" INTEGER NOT NULL DEFAULT 1,
    "dueRule" JSONB NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIA',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "responsibleId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "obligationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "department" "Department",
    "competence" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NAO_INICIADA',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIA',
    "responsibleId" TEXT,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_contacts_tenantId_idx" ON "company_contacts"("tenantId");

-- CreateIndex
CREATE INDEX "company_contacts_companyId_idx" ON "company_contacts"("companyId");

-- CreateIndex
CREATE INDEX "company_responsibles_tenantId_idx" ON "company_responsibles"("tenantId");

-- CreateIndex
CREATE INDEX "company_responsibles_userId_idx" ON "company_responsibles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_responsibles_companyId_area_key" ON "company_responsibles"("companyId", "area");

-- CreateIndex
CREATE INDEX "holidays_date_idx" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "holidays_tenantId_idx" ON "holidays"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "obligation_templates_slug_key" ON "obligation_templates"("slug");

-- CreateIndex
CREATE INDEX "obligation_templates_tenantId_idx" ON "obligation_templates"("tenantId");

-- CreateIndex
CREATE INDEX "obligations_tenantId_companyId_idx" ON "obligations"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "obligations_tenantId_active_idx" ON "obligations"("tenantId", "active");

-- CreateIndex
CREATE INDEX "tasks_tenantId_status_idx" ON "tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tasks_tenantId_dueDate_idx" ON "tasks"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_tenantId_companyId_idx" ON "tasks"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_responsibleId_idx" ON "tasks"("tenantId", "responsibleId");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_obligationId_competence_key" ON "tasks"("obligationId", "competence");

-- CreateIndex
CREATE INDEX "task_comments_tenantId_idx" ON "task_comments"("tenantId");

-- CreateIndex
CREATE INDEX "task_comments_taskId_idx" ON "task_comments"("taskId");

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_responsibles" ADD CONSTRAINT "company_responsibles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_responsibles" ADD CONSTRAINT "company_responsibles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "obligation_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

