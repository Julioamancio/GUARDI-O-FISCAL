import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

const TRIAL_DAYS = 14;
const RESERVED_SLUGS = new Set(['www', 'api', 'admin', 'app', 'portal', 'docs', 'mail', 'status']);

/**
 * Operações de superadmin sobre a plataforma (fora de qualquer tenant).
 * Usa o cliente Prisma base (sem escopo) de propósito — protegido pela
 * permissão 'tenants.manage', concedida apenas ao papel superadmin.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createTenant(dto: CreateTenantDto) {
    if (RESERVED_SLUGS.has(dto.slug)) {
      throw new BadRequestException(`O slug "${dto.slug}" é reservado pela plataforma`);
    }

    const plan = await this.prisma.plan.findUnique({ where: { slug: dto.planSlug } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException(`Plano "${dto.planSlug}" não encontrado ou inativo`);
    }

    const slugTaken = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (slugTaken) {
      throw new ConflictException(`Já existe um escritório com o slug "${dto.slug}"`);
    }

    const cnpj = dto.cnpj?.replace(/\D/g, '');
    if (cnpj) {
      const cnpjTaken = await this.prisma.tenant.findUnique({ where: { cnpj } });
      if (cnpjTaken) throw new ConflictException('Já existe um escritório com este CNPJ');
    }

    const adminRole = await this.prisma.role.findUniqueOrThrow({ where: { slug: 'tenant_admin' } });
    const passwordHash = await argon2.hash(dto.admin.password);
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          slug: dto.slug,
          razaoSocial: dto.razaoSocial,
          nomeFantasia: dto.nomeFantasia,
          cnpj,
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          planId: plan.id,
          status: 'TRIAL',
        },
      });

      await tx.subscription.create({
        data: { tenantId: createdTenant.id, planId: plan.id, status: 'TRIALING', trialEndsAt },
      });

      const adminUser = await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          name: dto.admin.name,
          email: dto.admin.email.toLowerCase(),
          passwordHash,
        },
      });
      await tx.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });

      return createdTenant;
    });

    await this.audit.log({
      action: 'admin.tenants.create',
      entity: 'Tenant',
      entityId: tenant.id,
      after: { slug: tenant.slug, razaoSocial: tenant.razaoSocial, plan: plan.slug },
    });

    return { ...tenant, trialEndsAt };
  }

  async listTenants(page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where: { deletedAt: null },
        include: { plan: true, _count: { select: { users: true, companies: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.tenant.count({ where: { deletedAt: null } }),
    ]);
    return { items, total, page, perPage };
  }

  async setTenantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELED') {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant || tenant.deletedAt) throw new NotFoundException('Escritório não encontrado');

    const updated = await this.prisma.tenant.update({ where: { id }, data: { status } });
    await this.audit.log({
      action: 'admin.tenants.status',
      entity: 'Tenant',
      entityId: id,
      before: { status: tenant.status },
      after: { status },
    });
    return updated;
  }

  listPlans() {
    return this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: 'asc' } });
  }

  /** Métricas globais da plataforma (painel do superadmin — req. 4/19). */
  async overview() {
    const [tenantsByStatus, totalUsers, totalCompanies, totalTasks, storage] = await Promise.all([
      this.prisma.tenant.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      this.prisma.user.count({ where: { deletedAt: null, tenantId: { not: null } } }),
      this.prisma.company.count({ where: { deletedAt: null } }),
      this.prisma.task.count({ where: { deletedAt: null } }),
      this.prisma.documentVersion.groupBy({
        by: ['tenantId'],
        _sum: { size: true },
        orderBy: { _sum: { size: 'desc' } },
        take: 10,
      }),
    ]);

    const tenantNames = await this.prisma.tenant.findMany({
      where: { id: { in: storage.map((s) => s.tenantId) } },
      select: { id: true, slug: true, razaoSocial: true },
    });
    const nameById = new Map(tenantNames.map((t) => [t.id, t]));

    return {
      tenants: Object.fromEntries(tenantsByStatus.map((t) => [t.status, t._count._all])),
      totalUsers,
      totalCompanies,
      totalTasks,
      storageTop: storage.map((s) => ({
        tenant: nameById.get(s.tenantId)?.razaoSocial ?? s.tenantId,
        slug: nameById.get(s.tenantId)?.slug,
        bytes: s._sum.size ?? 0,
      })),
      storageTotalBytes: storage.reduce((acc, s) => acc + (s._sum.size ?? 0), 0),
    };
  }
}
