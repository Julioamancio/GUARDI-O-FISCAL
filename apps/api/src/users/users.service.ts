import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/tenant-context';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  roles: { select: { role: { select: { slug: true, name: true } } } },
} as const;

/**
 * Gestão de usuários DO ESCRITÓRIO. Todas as consultas usam prisma.scoped:
 * o tenant vem do contexto da requisição, nunca do payload do cliente.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(page = 1, perPage = 20) {
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.scoped.user.findMany({
        where,
        select: SAFE_USER_SELECT,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.scoped.user.count({ where }),
    ]);
    return { items, total, page, perPage };
  }

  async create(dto: CreateUserDto) {
    const tenantId = this.requireTenant();

    // Limite de usuários do plano
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      include: { plan: true },
    });
    const activeUsers = await this.prisma.scoped.user.count({ where: { deletedAt: null } });
    if (tenant.plan && activeUsers >= tenant.plan.maxUsers) {
      throw new BadRequestException(
        `Limite de ${tenant.plan.maxUsers} usuários do plano ${tenant.plan.name} atingido`,
      );
    }

    const email = dto.email.toLowerCase();
    const exists = await this.prisma.scoped.user.findFirst({ where: { email } });
    if (exists) throw new ConflictException('Já existe um usuário com este e-mail no escritório');

    const role = await this.prisma.role.findUniqueOrThrow({ where: { slug: dto.role } });
    const user = await this.prisma.scoped.user.create({
      data: {
        name: dto.name,
        email,
        passwordHash: await argon2.hash(dto.password),
        roles: { create: { roleId: role.id } },
      },
      select: SAFE_USER_SELECT,
    });

    await this.audit.log({
      action: 'users.create',
      entity: 'User',
      entityId: user.id,
      after: { name: dto.name, email, role: dto.role },
    });
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const current = await this.prisma.scoped.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, isActive: true },
    });
    if (!current) throw new NotFoundException('Usuário não encontrado');

    const ctx = TenantContext.get();
    if (ctx?.userId === id && dto.isActive === false) {
      throw new BadRequestException('Você não pode desativar a própria conta');
    }

    let roleUpdate = {};
    if (dto.role) {
      const role = await this.prisma.role.findUniqueOrThrow({ where: { slug: dto.role } });
      roleUpdate = { roles: { deleteMany: {}, create: { roleId: role.id } } };
    }

    const updated = await this.prisma.scoped.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...roleUpdate,
      },
      select: SAFE_USER_SELECT,
    });

    // Desativação derruba as sessões ativas do usuário
    if (dto.isActive === false) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      action: 'users.update',
      entity: 'User',
      entityId: id,
      before: current,
      after: { name: dto.name, isActive: dto.isActive, role: dto.role },
    });
    return updated;
  }

  async remove(id: string) {
    const ctx = TenantContext.get();
    if (ctx?.userId === id) {
      throw new BadRequestException('Você não pode excluir a própria conta');
    }
    const current = await this.prisma.scoped.user.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Usuário não encontrado');

    await this.prisma.scoped.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ action: 'users.delete', entity: 'User', entityId: id });
    return { deleted: true };
  }

  private requireTenant(): string {
    const tenantId = TenantContext.get()?.tenantId;
    if (!tenantId) throw new ForbiddenException('Operação exige contexto de escritório');
    return tenantId;
  }
}
