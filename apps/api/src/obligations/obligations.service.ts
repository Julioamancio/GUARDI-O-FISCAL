import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/tenant-context';
import { CreateHolidayDto, CreateObligationDto, UpdateObligationDto } from './dto/obligations.dto';

@Injectable()
export class ObligationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Catálogo: templates globais + do próprio tenant. */
  listTemplates() {
    const tenantId = TenantContext.get()?.tenantId ?? null;
    return this.prisma.obligationTemplate.findMany({
      where: { isActive: true, OR: [{ tenantId: null }, { tenantId }] },
      orderBy: [{ sphere: 'asc' }, { name: 'asc' }],
    });
  }

  async list(companyId?: string, activeOnly = true) {
    return this.prisma.scoped.obligation.findMany({
      where: {
        deletedAt: null,
        ...(activeOnly ? { active: true } : {}),
        ...(companyId ? { companyId } : {}),
      },
      include: {
        company: { select: { id: true, razaoSocial: true, cnpj: true } },
        responsible: { select: { id: true, name: true } },
        template: { select: { slug: true, notes: true } },
      },
      orderBy: [{ company: { razaoSocial: 'asc' } }, { name: 'asc' }],
    });
  }

  /**
   * Cria a obrigação para uma ou mais empresas, a partir de template do
   * catálogo (herdando regra/checklist quando não sobrescritos) ou do zero.
   */
  async create(dto: CreateObligationDto) {
    const tenantId = TenantContext.get()?.tenantId ?? null;

    let template = null;
    if (dto.templateId) {
      template = await this.prisma.obligationTemplate.findFirst({
        where: { id: dto.templateId, isActive: true, OR: [{ tenantId: null }, { tenantId }] },
      });
      if (!template) throw new NotFoundException('Template não encontrado no catálogo');
    }

    const name = dto.name ?? template?.name;
    const department = dto.department ?? template?.department;
    const sphere = dto.sphere ?? template?.sphere;
    const periodicity = dto.periodicity ?? template?.periodicity;
    const dueRule = (dto.dueRule ?? template?.dueRule) as Prisma.InputJsonValue | undefined;
    if (!name || !department || !sphere || !periodicity || !dueRule) {
      throw new BadRequestException(
        'Sem template, informe name, department, sphere, periodicity e dueRule',
      );
    }

    if (dto.responsibleId) {
      const user = await this.prisma.scoped.user.findFirst({
        where: { id: dto.responsibleId, deletedAt: null },
      });
      if (!user) throw new NotFoundException('Responsável não encontrado no escritório');
    }

    const companies = await this.prisma.scoped.company.findMany({
      where: { id: { in: dto.companyIds }, deletedAt: null },
      select: { id: true },
    });
    if (companies.length !== dto.companyIds.length) {
      throw new NotFoundException('Uma ou mais empresas não foram encontradas');
    }

    const created = [];
    for (const company of companies) {
      const duplicate = await this.prisma.scoped.obligation.findFirst({
        where: { companyId: company.id, name, deletedAt: null },
      });
      if (duplicate) continue; // não duplica a mesma obrigação na mesma empresa

      created.push(
        await this.prisma.scoped.obligation.create({
          data: {
            tenantId: TenantContext.get()?.tenantId as string,
            companyId: company.id,
            templateId: template?.id,
            name,
            department,
            sphere,
            periodicity,
            anchorMonth: dto.anchorMonth ?? template?.anchorMonth ?? 1,
            dueRule,
            priority: dto.priority ?? template?.defaultPriority ?? 'MEDIA',
            checklist: (template?.checklist ?? []) as Prisma.InputJsonValue,
            responsibleId: dto.responsibleId,
          },
        }),
      );
    }

    await this.audit.log({
      action: 'obligations.create',
      entity: 'Obligation',
      after: { name, companies: dto.companyIds.length, created: created.length, template: template?.slug },
    });
    return { created: created.length, skippedAsDuplicate: companies.length - created.length, items: created };
  }

  async update(id: string, dto: UpdateObligationDto) {
    const current = await this.prisma.scoped.obligation.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Obrigação não encontrada');

    if (dto.responsibleId) {
      const user = await this.prisma.scoped.user.findFirst({
        where: { id: dto.responsibleId, deletedAt: null },
      });
      if (!user) throw new NotFoundException('Responsável não encontrado no escritório');
    }

    const updated = await this.prisma.scoped.obligation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.dueRule !== undefined ? { dueRule: dto.dueRule as unknown as Prisma.InputJsonValue } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.responsibleId !== undefined ? { responsibleId: dto.responsibleId } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    await this.audit.log({
      action: 'obligations.update',
      entity: 'Obligation',
      entityId: id,
      before: { name: current.name, active: current.active, dueRule: current.dueRule },
      after: dto,
    });
    return updated;
  }

  async remove(id: string) {
    const current = await this.prisma.scoped.obligation.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Obrigação não encontrada');
    await this.prisma.scoped.obligation.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    await this.audit.log({ action: 'obligations.delete', entity: 'Obligation', entityId: id });
    return { deleted: true };
  }

  // --- Feriados ---

  async listHolidays(year?: number) {
    const tenantId = TenantContext.get()?.tenantId ?? null;
    const range = year
      ? { gte: new Date(`${year}-01-01T00:00:00.000Z`), lte: new Date(`${year}-12-31T00:00:00.000Z`) }
      : undefined;
    return this.prisma.holiday.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }], ...(range ? { date: range } : {}) },
      orderBy: { date: 'asc' },
    });
  }

  /** Feriados estaduais/municipais do escritório (os nacionais são da plataforma). */
  async createHoliday(dto: CreateHolidayDto) {
    const tenantId = TenantContext.get()?.tenantId;
    if (!tenantId) throw new BadRequestException('Feriados personalizados pertencem a um escritório');
    if (dto.scope === 'ESTADUAL' && !dto.uf) throw new BadRequestException('Feriado estadual exige uf');
    if (dto.scope === 'MUNICIPAL' && !dto.municipio) {
      throw new BadRequestException('Feriado municipal exige municipio');
    }
    const holiday = await this.prisma.holiday.create({
      data: {
        tenantId,
        date: new Date(`${dto.date}T00:00:00.000Z`),
        name: dto.name,
        scope: dto.scope,
        uf: dto.uf?.toUpperCase(),
        municipio: dto.municipio,
      },
    });
    await this.audit.log({ action: 'holidays.create', entity: 'Holiday', entityId: holiday.id, after: dto });
    return holiday;
  }

  async removeHoliday(id: string) {
    const tenantId = TenantContext.get()?.tenantId;
    const holiday = await this.prisma.holiday.findFirst({ where: { id, tenantId: tenantId ?? '—' } });
    if (!holiday) throw new NotFoundException('Feriado não encontrado (nacionais não podem ser removidos)');
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit.log({ action: 'holidays.delete', entity: 'Holiday', entityId: id });
    return { deleted: true };
  }
}
