-- CreateTable
CREATE TABLE "responsibility_timeline" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "competence" TEXT,
    "event" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "ip" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responsibility_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "responsibility_timeline_tenantId_companyId_competence_idx" ON "responsibility_timeline"("tenantId", "companyId", "competence");

-- CreateIndex
CREATE INDEX "responsibility_timeline_tenantId_createdAt_idx" ON "responsibility_timeline"("tenantId", "createdAt");

