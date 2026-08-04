/**
 * Job diário de recorrência: para TODOS os tenants ativos, gera as tarefas
 * das obrigações (lógica compartilhada planTasks) e marca vencidas.
 * A API tem um disparo manual equivalente por tenant (POST /obligations/generate-tasks);
 * corrida entre os dois é inofensiva — UNIQUE (obligationId, competence) no banco.
 */
import { PrismaClient } from '@prisma/client';
import { DueRule, planTasks, taskKey, toIso } from '@guardiao/shared';

const OPEN_STATUSES = [
  'NAO_INICIADA',
  'AGUARDANDO_DOCUMENTOS',
  'EM_ANDAMENTO',
  'EM_CONFERENCIA',
  'AGUARDANDO_APROVACAO',
] as const;

export async function runDailyRecurrence(prisma: PrismaClient): Promise<{
  tenants: number;
  created: number;
  overdueMarked: number;
}> {
  const today = new Date();
  const todayIso = toIso(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate());
  const todayDate = new Date(`${todayIso}T00:00:00.000Z`);

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, status: { in: ['ACTIVE', 'TRIAL'] } },
    select: { id: true },
  });

  let created = 0;
  let overdueMarked = 0;

  for (const tenant of tenants) {
    const obligations = await prisma.obligation.findMany({
      where: {
        tenantId: tenant.id,
        active: true,
        deletedAt: null,
        company: { deletedAt: null, status: 'ACTIVE' },
      },
      include: { company: { select: { uf: true, municipio: true } } },
    });
    if (obligations.length > 0) {
      const holidays = await prisma.holiday.findMany({
        where: { OR: [{ tenantId: null }, { tenantId: tenant.id }] },
      });
      const existing = await prisma.task.findMany({
        where: { tenantId: tenant.id, obligationId: { in: obligations.map((o) => o.id) } },
        select: { obligationId: true, competence: true },
      });
      const existingKeys = new Set(
        existing.map((t) => taskKey(t.obligationId as string, t.competence)),
      );

      for (const obligation of obligations) {
        const applicable = new Set(
          holidays
            .filter(
              (h) =>
                h.scope === 'NACIONAL' ||
                (h.scope === 'ESTADUAL' && h.uf && h.uf === obligation.company.uf) ||
                (h.scope === 'MUNICIPAL' &&
                  h.municipio &&
                  h.municipio.toLowerCase() === obligation.company.municipio?.toLowerCase()),
            )
            .map((h) => h.date.toISOString().slice(0, 10)),
        );

        const planned = planTasks(
          [
            {
              id: obligation.id,
              tenantId: obligation.tenantId,
              companyId: obligation.companyId,
              name: obligation.name,
              department: obligation.department,
              priority: obligation.priority,
              checklist: obligation.checklist,
              periodicity: obligation.periodicity,
              anchorMonth: obligation.anchorMonth,
              dueRule: obligation.dueRule as unknown as DueRule,
              responsibleId: obligation.responsibleId,
            },
          ],
          existingKeys,
          applicable,
          todayIso,
        );

        if (planned.length > 0) {
          const result = await prisma.task.createMany({
            data: planned.map((p) => ({
              tenantId: p.tenantId,
              companyId: p.companyId,
              obligationId: p.obligationId,
              title: p.title,
              department: p.department as never,
              competence: p.competence,
              dueDate: new Date(`${p.dueDate}T00:00:00.000Z`),
              priority: p.priority as never,
              checklist: p.checklist as object[],
              responsibleId: p.responsibleId,
            })),
            skipDuplicates: true,
          });
          created += result.count;
          planned.forEach((p) => existingKeys.add(taskKey(p.obligationId, p.competence)));
        }
      }
    }

    const overdue = await prisma.task.updateMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: { in: OPEN_STATUSES as never },
        dueDate: { lt: todayDate },
      },
      data: { status: 'VENCIDA' },
    });
    overdueMarked += overdue.count;

    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: null,
        action: 'tasks.recurrence.daily',
        entity: 'Task',
        after: { created, overdueMarked: overdue.count, source: 'worker' },
      },
    });
  }

  return { tenants: tenants.length, created, overdueMarked };
}
