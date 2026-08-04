import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Semáforo do requisito 8. Precedência: vermelho > amarelo > azul > verde > cinza. */
export type ClosingColor = 'VERMELHO' | 'AMARELO' | 'AZUL' | 'VERDE' | 'CINZA';

const OPEN_STATUSES = new Set([
  'NAO_INICIADA',
  'AGUARDANDO_DOCUMENTOS',
  'EM_ANDAMENTO',
  'EM_CONFERENCIA',
  'AGUARDANDO_APROVACAO',
]);
const IN_PROGRESS = new Set(['EM_ANDAMENTO', 'EM_CONFERENCIA', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_DOCUMENTOS']);
const DEPARTMENTS = ['FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO', 'SOCIETARIO', 'OUTRO'] as const;

@Injectable()
export class ClosingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Painel de fechamento mensal: uma linha por empresa, semáforo por departamento e geral. */
  async panel(competence: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)) {
      throw new BadRequestException('Competência deve ser YYYY-MM');
    }
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const in7DaysIso = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);

    const [companies, tasks, requests] = await Promise.all([
      this.prisma.scoped.company.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true, razaoSocial: true, regimeTributario: true, riskLevel: true },
        orderBy: { razaoSocial: 'asc' },
      }),
      this.prisma.scoped.task.findMany({
        where: { competence, deletedAt: null },
        select: { companyId: true, department: true, status: true, dueDate: true },
      }),
      this.prisma.scoped.documentRequest.findMany({
        where: { competence, deletedAt: null, status: { not: 'CANCELADA' } },
        select: { companyId: true, status: true, dueDate: true },
      }),
    ]);

    const rows = companies.map((company) => {
      const companyTasks = tasks.filter((t) => t.companyId === company.id);
      const companyRequests = requests.filter((r) => r.companyId === company.id);

      const byDepartment: Record<string, { total: number; done: number; overdue: number; color: ClosingColor }> = {};
      for (const dep of DEPARTMENTS) {
        const depTasks = companyTasks.filter((t) => (t.department ?? 'OUTRO') === dep);
        if (depTasks.length === 0) continue;
        byDepartment[dep] = {
          total: depTasks.length,
          done: depTasks.filter((t) => t.status === 'CONCLUIDA').length,
          overdue: depTasks.filter(
            (t) => t.status === 'VENCIDA' || (OPEN_STATUSES.has(t.status) && t.dueDate.toISOString().slice(0, 10) < todayIso),
          ).length,
          color: this.colorFor(depTasks, [], todayIso, in7DaysIso),
        };
      }

      return {
        company,
        byDepartment,
        documents: {
          openRequests: companyRequests.filter((r) => r.status === 'ABERTA' || r.status === 'PARCIAL').length,
          overdueRequests: companyRequests.filter(
            (r) =>
              (r.status === 'ABERTA' || r.status === 'PARCIAL') &&
              r.dueDate &&
              r.dueDate.toISOString().slice(0, 10) < todayIso,
          ).length,
        },
        tasksTotal: companyTasks.length,
        tasksDone: companyTasks.filter((t) => t.status === 'CONCLUIDA').length,
        overall: this.colorFor(companyTasks, companyRequests, todayIso, in7DaysIso),
      };
    });

    const summary = { VERMELHO: 0, AMARELO: 0, AZUL: 0, VERDE: 0, CINZA: 0 } as Record<ClosingColor, number>;
    rows.forEach((r) => summary[r.overall]++);

    return { competence, summary, rows };
  }

  private colorFor(
    tasks: Array<{ status: string; dueDate: Date }>,
    requests: Array<{ status: string; dueDate: Date | null }>,
    todayIso: string,
    in7DaysIso: string,
  ): ClosingColor {
    const openRequests = requests.filter((r) => r.status === 'ABERTA' || r.status === 'PARCIAL');

    const hasOverdue =
      tasks.some(
        (t) => t.status === 'VENCIDA' || (OPEN_STATUSES.has(t.status) && t.dueDate.toISOString().slice(0, 10) < todayIso),
      ) || openRequests.some((r) => r.dueDate && r.dueDate.toISOString().slice(0, 10) < todayIso);
    if (hasOverdue) return 'VERMELHO';

    const hasDueSoon =
      tasks.some((t) => OPEN_STATUSES.has(t.status) && t.dueDate.toISOString().slice(0, 10) <= in7DaysIso) ||
      openRequests.length > 0;
    if (hasDueSoon) return 'AMARELO';

    if (tasks.some((t) => IN_PROGRESS.has(t.status))) return 'AZUL';

    const relevant = tasks.filter((t) => t.status !== 'CANCELADA');
    if (relevant.length > 0 && relevant.every((t) => t.status === 'CONCLUIDA')) return 'VERDE';

    return 'CINZA';
  }
}
