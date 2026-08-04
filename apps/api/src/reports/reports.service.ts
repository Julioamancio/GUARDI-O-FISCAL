import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/tenant-context';
import { TabularReport } from './report-builder';

const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : '');

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async tenantName(): Promise<string> {
    const tenantId = TenantContext.get()?.tenantId;
    if (!tenantId) return 'Plataforma';
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return tenant?.nomeFantasia ?? tenant?.razaoSocial ?? 'Escritório';
  }

  /** Relatório de tarefas (obrigações concluídas/atrasadas/por status — req. 20). */
  async tasksReport(filters: { competence?: string; status?: string; companyId?: string }): Promise<TabularReport> {
    const where: Prisma.TaskWhereInput = { deletedAt: null };
    if (filters.competence) where.competence = filters.competence;
    if (filters.status) where.status = filters.status as TaskStatus;
    if (filters.companyId) where.companyId = filters.companyId;

    const tasks = await this.prisma.scoped.task.findMany({
      where,
      include: {
        company: { select: { razaoSocial: true, cnpj: true } },
        responsible: { select: { name: true } },
      },
      orderBy: [{ dueDate: 'asc' }],
      take: 2000,
    });

    await this.audit.log({ action: 'reports.tasks', entity: 'Task', after: { filters, rows: tasks.length } });
    return {
      title: 'Relatório de Tarefas',
      subtitle: `${await this.tenantName()} · ${[
        filters.competence && `competência ${filters.competence}`,
        filters.status && `status ${filters.status}`,
      ]
        .filter(Boolean)
        .join(' · ') || 'todas'} · ${tasks.length} tarefa(s)`,
      columns: ['Empresa', 'CNPJ', 'Tarefa', 'Competência', 'Vencimento', 'Status', 'Prioridade', 'Responsável', 'Concluída em', 'Atraso'],
      rows: tasks.map((t) => [
        t.company.razaoSocial,
        t.company.cnpj,
        t.title,
        t.competence,
        fmtDate(t.dueDate),
        t.status.replaceAll('_', ' '),
        t.priority,
        t.responsible?.name ?? '',
        fmtDate(t.completedAt),
        t.completedAt && t.completedAt > t.dueDate ? 'SIM' : '',
      ]),
    };
  }

  /** Documentos pendentes por cliente (o que falta e há quanto tempo — req. 20). */
  async documentPendenciesReport(): Promise<TabularReport> {
    const items = await this.prisma.scoped.documentRequestItem.findMany({
      where: {
        status: { in: ['PENDENTE', 'REJEITADO'] },
        request: { deletedAt: null, status: { in: ['ABERTA', 'PARCIAL'] } },
      },
      include: {
        request: { include: { company: { select: { razaoSocial: true, cnpj: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    });

    const today = Date.now();
    await this.audit.log({ action: 'reports.document_pendencies', entity: 'DocumentRequestItem', after: { rows: items.length } });
    return {
      title: 'Documentos Pendentes',
      subtitle: `${await this.tenantName()} · ${items.length} item(ns) aguardando envio ou correção`,
      columns: ['Empresa', 'CNPJ', 'Solicitação', 'Documento', 'Situação', 'Competência', 'Prazo', 'Dias em atraso', 'Solicitado em'],
      rows: items.map((item) => {
        const due = item.request.dueDate;
        const overdueDays = due && due.getTime() < today ? Math.floor((today - due.getTime()) / 86_400_000) : 0;
        return [
          item.request.company.razaoSocial,
          item.request.company.cnpj,
          item.request.title,
          item.name,
          item.status === 'REJEITADO' ? `REJEITADO: ${item.rejectionReason ?? ''}` : 'PENDENTE',
          item.request.competence ?? '',
          fmtDate(due),
          overdueDays > 0 ? overdueDays : '',
          fmtDate(item.createdAt),
        ];
      }),
    };
  }

  /** Linha do tempo de responsabilidade exportável (prova — req. 16). */
  async timelineReport(companyId: string, competence?: string): Promise<TabularReport> {
    const [company, entries] = await Promise.all([
      this.prisma.scoped.company.findFirst({ where: { id: companyId }, select: { razaoSocial: true, cnpj: true } }),
      this.prisma.scoped.responsibilityTimeline.findMany({
        where: { companyId, ...(competence ? { competence } : {}) },
        orderBy: { createdAt: 'asc' },
        take: 2000,
      }),
    ]);

    await this.audit.log({ action: 'reports.timeline', entity: 'Company', entityId: companyId, after: { competence, rows: entries.length } });
    return {
      title: 'Linha do Tempo de Responsabilidade',
      subtitle: `${await this.tenantName()} · ${company?.razaoSocial ?? ''} (${company?.cnpj ?? ''})${competence ? ` · competência ${competence}` : ''} · ${entries.length} evento(s)`,
      columns: ['Data/Hora', 'Evento', 'Descrição', 'Autor', 'IP', 'Competência'],
      rows: entries.map((e) => [
        e.createdAt.toISOString().replace('T', ' ').slice(0, 19),
        e.event,
        e.description,
        e.actorName ?? '',
        e.ip ?? '',
        e.competence ?? '',
      ]),
    };
  }
}
