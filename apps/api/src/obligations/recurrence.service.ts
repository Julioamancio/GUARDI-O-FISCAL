import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DueRule, planTasks, taskKey, toIso } from '@guardiao/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/tenant-context';

/** Status que ainda contam como "em aberto" para efeito de vencimento. */
export const OPEN_TASK_STATUSES = [
  'NAO_INICIADA',
  'AGUARDANDO_DOCUMENTOS',
  'EM_ANDAMENTO',
  'EM_CONFERENCIA',
  'AGUARDANDO_APROVACAO',
] as const;

/**
 * Geração de tarefas recorrentes para O TENANT ATUAL (disparo manual pela API).
 * O worker roda a mesma lógica compartilhada (planTasks) diariamente para todos
 * os tenants — ver apps/worker/src/recurrence.ts.
 */
@Injectable()
export class RecurrenceService {
  private readonly logger = new Logger(RecurrenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async generateForCurrentTenant(): Promise<{ created: number; overdueMarked: number }> {
    const tenantId = TenantContext.get()?.tenantId;
    if (!tenantId) throw new ForbiddenException('Geração de tarefas exige contexto de escritório');

    const today = new Date();
    const todayIso = toIso(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate());

    const obligations = await this.prisma.scoped.obligation.findMany({
      where: { active: true, deletedAt: null, company: { deletedAt: null, status: 'ACTIVE' } },
      include: { company: { select: { uf: true, municipio: true } } },
    });

    const holidays = await this.prisma.holiday.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }] },
    });

    const existing = await this.prisma.scoped.task.findMany({
      where: { obligationId: { in: obligations.map((o) => o.id) } },
      select: { obligationId: true, competence: true },
    });
    const existingKeys = new Set(existing.map((t) => taskKey(t.obligationId as string, t.competence)));

    let created = 0;
    for (const obligation of obligations) {
      // Feriados aplicáveis à empresa: nacionais + estaduais da UF + municipais do município
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
        const result = await this.prisma.task.createMany({
          data: planned.map((p) => ({
            tenantId: p.tenantId,
            companyId: p.companyId,
            obligationId: p.obligationId,
            title: p.title,
            department: p.department as never,
            competence: p.competence,
            dueDate: new Date(`${p.dueDate}T00:00:00.000Z`),
            priority: p.priority as never,
            checklist: p.checklist as Prisma.InputJsonValue,
            responsibleId: p.responsibleId,
          })),
          skipDuplicates: true, // corrida com o worker é inofensiva: UNIQUE(obligationId, competence)
        });
        created += result.count;
        planned.forEach((p) => existingKeys.add(taskKey(p.obligationId, p.competence)));
      }
    }

    const overdue = await this.prisma.scoped.task.updateMany({
      where: {
        deletedAt: null,
        status: { in: OPEN_TASK_STATUSES as never },
        dueDate: { lt: new Date(`${todayIso}T00:00:00.000Z`) },
      },
      data: { status: 'VENCIDA' },
    });

    await this.audit.log({
      action: 'tasks.recurrence.generate',
      entity: 'Task',
      after: { created, overdueMarked: overdue.count },
    });
    this.logger.log(`Recorrência tenant=${tenantId}: ${created} criadas, ${overdue.count} vencidas`);
    return { created, overdueMarked: overdue.count };
  }
}
