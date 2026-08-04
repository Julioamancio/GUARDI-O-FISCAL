import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/tenant-context';
import { OPEN_TASK_STATUSES } from '../obligations/recurrence.service';
import { CreateCommentDto, CreateTaskDto, UpdateTaskDto } from './dto/tasks.dto';

export interface TaskFilters {
  companyId?: string;
  status?: string;
  competence?: string;
  responsibleId?: string;
  department?: string;
  overdue?: boolean;
  dueBefore?: string;
  page: number;
  perPage: number;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: TaskFilters) {
    const where: Prisma.TaskWhereInput = { deletedAt: null };
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.status) where.status = filters.status as TaskStatus;
    if (filters.competence) where.competence = filters.competence;
    if (filters.responsibleId) where.responsibleId = filters.responsibleId;
    if (filters.department) where.department = filters.department as never;
    if (filters.overdue) {
      where.status = { in: [...OPEN_TASK_STATUSES, 'VENCIDA'] as TaskStatus[] };
      where.dueDate = { lt: new Date() };
    }
    if (filters.dueBefore) {
      where.dueDate = { ...(where.dueDate as object), lte: new Date(`${filters.dueBefore}T23:59:59.000Z`) };
      where.status = where.status ?? ({ in: OPEN_TASK_STATUSES as never } as never);
    }

    const [items, total] = await Promise.all([
      this.prisma.scoped.task.findMany({
        where,
        include: {
          company: { select: { id: true, razaoSocial: true } },
          responsible: { select: { id: true, name: true } },
          obligation: { select: { id: true, name: true, sphere: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      this.prisma.scoped.task.count({ where }),
    ]);
    return { items, total, page: filters.page, perPage: filters.perPage };
  }

  /** Contadores para o dashboard/painel (uma ida ao banco por status). */
  async summary() {
    const [byStatus, overdueCount, next7days] = await Promise.all([
      this.prisma.scoped.task.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.scoped.task.count({
        where: { deletedAt: null, status: 'VENCIDA' },
      }),
      this.prisma.scoped.task.count({
        where: {
          deletedAt: null,
          status: { in: OPEN_TASK_STATUSES as never },
          dueDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      overdue: overdueCount,
      dueNext7Days: next7days,
    };
  }

  async get(id: string) {
    const task = await this.prisma.scoped.task.findFirst({
      where: { id, deletedAt: null },
      include: {
        company: { select: { id: true, razaoSocial: true, cnpj: true } },
        responsible: { select: { id: true, name: true } },
        obligation: { select: { id: true, name: true, sphere: true, dueRule: true } },
        comments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return task;
  }

  async create(dto: CreateTaskDto) {
    const company = await this.prisma.scoped.company.findFirst({
      where: { id: dto.companyId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    if (dto.responsibleId) await this.ensureUser(dto.responsibleId);

    const task = await this.prisma.scoped.task.create({
      data: {
        companyId: dto.companyId,
        title: dto.title,
        description: dto.description,
        department: dto.department,
        competence: dto.competence,
        dueDate: new Date(`${dto.dueDate}T00:00:00.000Z`),
        priority: dto.priority ?? 'MEDIA',
        responsibleId: dto.responsibleId,
        checklist: (dto.checklist ?? []).map((item) => ({ item, done: false })),
      },
    });
    await this.audit.log({
      action: 'tasks.create',
      entity: 'Task',
      entityId: task.id,
      after: { title: dto.title, competence: dto.competence, dueDate: dto.dueDate },
    });
    return task;
  }

  async update(id: string, dto: UpdateTaskDto) {
    const current = await this.prisma.scoped.task.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Tarefa não encontrada');
    if (current.status === 'CANCELADA' && dto.status !== 'NAO_INICIADA') {
      throw new BadRequestException('Tarefa cancelada só pode ser reaberta (status NAO_INICIADA)');
    }
    if (dto.responsibleId) await this.ensureUser(dto.responsibleId);

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueDate !== undefined) data.dueDate = new Date(`${dto.dueDate}T00:00:00.000Z`);
    if (dto.responsibleId !== undefined) data.responsible = { connect: { id: dto.responsibleId } };
    if (dto.checklist !== undefined) {
      data.checklist = dto.checklist.map((c) => ({ item: String(c.item), done: Boolean(c.done) }));
    }

    if (dto.status !== undefined && dto.status !== current.status) {
      data.status = dto.status;
      if (dto.status === 'CONCLUIDA') {
        data.completedAt = new Date();
      } else {
        data.completedAt = null;
      }
      if (dto.status === 'EM_ANDAMENTO' && !current.startedAt) {
        data.startedAt = new Date();
      }
    }

    const updated = await this.prisma.scoped.task.update({ where: { id }, data });

    await this.audit.log({
      action: dto.status && dto.status !== current.status ? 'tasks.status_change' : 'tasks.update',
      entity: 'Task',
      entityId: id,
      before: { status: current.status, dueDate: current.dueDate, responsibleId: current.responsibleId },
      after: dto,
    });
    return updated;
  }

  async remove(id: string) {
    const current = await this.prisma.scoped.task.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Tarefa não encontrada');
    await this.prisma.scoped.task.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ action: 'tasks.delete', entity: 'Task', entityId: id });
    return { deleted: true };
  }

  async addComment(taskId: string, dto: CreateCommentDto) {
    const task = await this.prisma.scoped.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    const userId = TenantContext.get()?.userId ?? null;
    const comment = await this.prisma.scoped.taskComment.create({
      data: { taskId, userId, body: dto.body },
      include: { user: { select: { id: true, name: true } } },
    });
    await this.audit.log({ action: 'tasks.comment', entity: 'TaskComment', entityId: comment.id });
    return comment;
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.scoped.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Responsável não encontrado no escritório');
  }
}
