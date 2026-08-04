import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isValidCnpj, normalizeCnpj } from '@guardiao/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/tenant-context';
import { CreateCompanyDto, CreateContactDto, SetResponsibleDto, UpdateCompanyDto } from './dto/companies.dto';

export interface CompanyFilters {
  search?: string;
  status?: string;
  regime?: string;
  uf?: string;
  tag?: string;
  page: number;
  perPage: number;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: CompanyFilters) {
    const where: Prisma.CompanyWhereInput = { deletedAt: null };
    if (filters.status) where.status = filters.status as never;
    if (filters.regime) where.regimeTributario = filters.regime as never;
    if (filters.uf) where.uf = filters.uf.toUpperCase();
    if (filters.tag) where.tags = { has: filters.tag };
    if (filters.search) {
      const digits = filters.search.replace(/\D/g, '');
      where.OR = [
        { razaoSocial: { contains: filters.search, mode: 'insensitive' } },
        { nomeFantasia: { contains: filters.search, mode: 'insensitive' } },
        ...(digits.length >= 4 ? [{ cnpj: { contains: digits } }] : []),
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.scoped.company.findMany({
        where,
        include: {
          responsibles: { include: { user: { select: { id: true, name: true } } } },
          _count: { select: { tasks: { where: { deletedAt: null, status: { notIn: ['CONCLUIDA', 'CANCELADA'] } } } } },
        },
        orderBy: { razaoSocial: 'asc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      this.prisma.scoped.company.count({ where }),
    ]);
    return { items, total, page: filters.page, perPage: filters.perPage };
  }

  async get(id: string) {
    const company = await this.prisma.scoped.company.findFirst({
      where: { id, deletedAt: null },
      include: {
        contacts: { orderBy: { createdAt: 'asc' } },
        responsibles: { include: { user: { select: { id: true, name: true, email: true } } } },
        obligations: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async create(dto: CreateCompanyDto) {
    if (!isValidCnpj(dto.cnpj)) {
      throw new BadRequestException('CNPJ inválido (dígitos verificadores não conferem)');
    }
    const cnpj = normalizeCnpj(dto.cnpj);

    const tenantId = TenantContext.get()?.tenantId;
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId ?? '' },
      include: { plan: true },
    });
    const activeCompanies = await this.prisma.scoped.company.count({ where: { deletedAt: null } });
    if (tenant.plan && activeCompanies >= tenant.plan.maxCompanies) {
      throw new BadRequestException(
        `Limite de ${tenant.plan.maxCompanies} empresas do plano ${tenant.plan.name} atingido`,
      );
    }

    const exists = await this.prisma.scoped.company.findFirst({ where: { cnpj } });
    if (exists) throw new ConflictException('Já existe uma empresa com este CNPJ no escritório');

    const company = await this.prisma.scoped.company.create({
      data: {
        ...dto,
        cnpj,
        uf: dto.uf?.toUpperCase(),
        dataAbertura: dto.dataAbertura ? new Date(dto.dataAbertura) : undefined,
      },
    });
    await this.audit.log({
      action: 'companies.create',
      entity: 'Company',
      entityId: company.id,
      after: { razaoSocial: company.razaoSocial, cnpj: company.cnpj },
    });
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const current = await this.prisma.scoped.company.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Empresa não encontrada');

    let cnpj: string | undefined;
    if (dto.cnpj !== undefined) {
      if (!isValidCnpj(dto.cnpj)) throw new BadRequestException('CNPJ inválido');
      cnpj = normalizeCnpj(dto.cnpj);
      if (cnpj !== current.cnpj) {
        const dup = await this.prisma.scoped.company.findFirst({ where: { cnpj, id: { not: id } } });
        if (dup) throw new ConflictException('Já existe uma empresa com este CNPJ no escritório');
      }
    }

    const updated = await this.prisma.scoped.company.update({
      where: { id },
      data: {
        ...dto,
        cnpj,
        uf: dto.uf?.toUpperCase(),
        dataAbertura: dto.dataAbertura ? new Date(dto.dataAbertura) : undefined,
      },
    });
    await this.audit.log({
      action: 'companies.update',
      entity: 'Company',
      entityId: id,
      before: { razaoSocial: current.razaoSocial, status: current.status, riskLevel: current.riskLevel },
      after: dto,
    });
    return updated;
  }

  async remove(id: string) {
    const current = await this.prisma.scoped.company.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Empresa não encontrada');
    await this.prisma.scoped.company.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    // Obrigações da empresa deixam de gerar tarefas
    await this.prisma.scoped.obligation.updateMany({ where: { companyId: id }, data: { active: false } });
    await this.audit.log({ action: 'companies.delete', entity: 'Company', entityId: id });
    return { deleted: true };
  }

  // --- Contatos ---

  async addContact(companyId: string, dto: CreateContactDto) {
    await this.ensureCompany(companyId);
    const contact = await this.prisma.scoped.companyContact.create({ data: { ...dto, companyId } });
    await this.audit.log({ action: 'companies.contacts.add', entity: 'CompanyContact', entityId: contact.id, after: dto });
    return contact;
  }

  async removeContact(companyId: string, contactId: string) {
    const contact = await this.prisma.scoped.companyContact.findFirst({ where: { id: contactId, companyId } });
    if (!contact) throw new NotFoundException('Contato não encontrado');
    await this.prisma.scoped.companyContact.delete({ where: { id: contactId } });
    await this.audit.log({ action: 'companies.contacts.remove', entity: 'CompanyContact', entityId: contactId });
    return { deleted: true };
  }

  // --- Responsáveis por área ---

  async setResponsible(companyId: string, dto: SetResponsibleDto) {
    await this.ensureCompany(companyId);
    const user = await this.prisma.scoped.user.findFirst({ where: { id: dto.userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuário não encontrado no escritório');

    const existing = await this.prisma.scoped.companyResponsible.findFirst({
      where: { companyId, area: dto.area },
    });
    const responsible = existing
      ? await this.prisma.scoped.companyResponsible.update({
          where: { id: existing.id },
          data: { userId: dto.userId },
        })
      : await this.prisma.scoped.companyResponsible.create({
          data: { companyId, area: dto.area, userId: dto.userId },
        });
    await this.audit.log({
      action: 'companies.responsibles.set',
      entity: 'CompanyResponsible',
      entityId: responsible.id,
      before: existing ? { userId: existing.userId } : undefined,
      after: { area: dto.area, userId: dto.userId },
    });
    return responsible;
  }

  async removeResponsible(companyId: string, area: string) {
    const existing = await this.prisma.scoped.companyResponsible.findFirst({
      where: { companyId, area: area as never },
    });
    if (!existing) throw new NotFoundException('Responsável não encontrado para esta área');
    await this.prisma.scoped.companyResponsible.delete({ where: { id: existing.id } });
    await this.audit.log({ action: 'companies.responsibles.remove', entity: 'CompanyResponsible', entityId: existing.id });
    return { deleted: true };
  }

  private async ensureCompany(id: string) {
    const company = await this.prisma.scoped.company.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }
}
