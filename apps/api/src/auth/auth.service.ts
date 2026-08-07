import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/auth.dto';
import type { AccessTokenPayload, AuthenticatedUser, AuthTokens } from './auth.types';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutos

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Login por e-mail + senha dentro de um tenant (slug) ou como superadmin
   * (sem slug). Mensagens de erro são idênticas em todos os caminhos para
   * não permitir enumeração de contas.
   */
  async login(dto: LoginDto, meta: RequestMeta): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const invalid = new UnauthorizedException('Credenciais inválidas');

    const include = {
      tenant: true,
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    };

    let user;
    if (dto.tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
      if (!tenant || tenant.deletedAt || tenant.status === 'CANCELED' || tenant.status === 'SUSPENDED') {
        throw invalid;
      }
      user = await this.prisma.user.findFirst({
        where: { email: dto.email.toLowerCase(), tenantId: tenant.id, deletedAt: null },
        include,
      });
    } else {
      // Sem escritório informado: resolve pelo e-mail. Se o mesmo e-mail existir
      // em mais de um escritório, o slug volta a ser obrigatório para desambiguar.
      const candidates = await this.prisma.user.findMany({
        where: { email: dto.email.toLowerCase(), deletedAt: null },
        include,
        take: 2,
      });
      if (candidates.length > 1) {
        throw new UnauthorizedException(
          'Este e-mail está em mais de um escritório; informe também o escritório.',
        );
      }
      user = candidates[0];
      if (
        user?.tenant &&
        (user.tenant.deletedAt || user.tenant.status === 'CANCELED' || user.tenant.status === 'SUSPENDED')
      ) {
        throw invalid;
      }
    }
    if (!user || !user.isActive) throw invalid;
    const tenantId = user.tenantId;

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      await this.audit.log({
        action: 'auth.login_failed',
        entity: 'User',
        entityId: user.id,
        userId: null,
        tenantId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw invalid;
    }

    const roles = user.roles.map((ur) => ur.role.slug);
    const permissions = [
      ...new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.slug))),
    ];

    const tokens = await this.issueTokens(user.id, tenantId, roles, permissions, randomUUID(), meta);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      userId: user.id,
      tenantId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId,
        roles,
        permissions,
        tenant: user.tenant
          ? {
              id: user.tenant.id,
              slug: user.tenant.slug,
              razaoSocial: user.tenant.razaoSocial,
              logoUrl: user.tenant.logoUrl,
              primaryColor: user.tenant.primaryColor,
            }
          : null,
      },
      tokens,
    };
  }

  /**
   * Rotação de refresh token. Reuso de um token já rotacionado/revogado é
   * tratado como roubo: toda a família de sessões é revogada.
   */
  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const invalid = new UnauthorizedException('Sessão expirada, faça login novamente');
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          },
        },
      },
    });
    if (!stored) throw invalid;

    if (stored.revokedAt) {
      // Reuso detectado — derruba a família inteira.
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        action: 'auth.refresh_reuse_detected',
        entity: 'User',
        entityId: stored.userId,
        userId: stored.userId,
        tenantId: stored.user.tenantId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw invalid;
    }

    if (stored.expiresAt < new Date() || !stored.user.isActive || stored.user.deletedAt) {
      throw invalid;
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const roles = stored.user.roles.map((ur) => ur.role.slug);
    const permissions = [
      ...new Set(stored.user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.slug))),
    ];
    return this.issueTokens(stored.userId, stored.user.tenantId, roles, permissions, stored.family, meta);
  }

  /** Logout: revoga o refresh token atual e toda a família (todas as abas do dispositivo). */
  async logout(refreshToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
    });
    if (!stored) return; // idempotente
    await this.prisma.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      action: 'auth.logout',
      entity: 'User',
      entityId: stored.userId,
      userId: stored.userId,
    });
  }

  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        tenant: true,
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    const roles = user.roles.map((ur) => ur.role.slug);
    const permissions = [
      ...new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.slug))),
    ];
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId,
      roles,
      permissions,
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            slug: user.tenant.slug,
            razaoSocial: user.tenant.razaoSocial,
            logoUrl: user.tenant.logoUrl,
            primaryColor: user.tenant.primaryColor,
          }
        : null,
    };
  }

  /**
   * Troca de senha do próprio usuário. Exige a senha atual e revoga TODAS as
   * sessões (refresh tokens) — quem estiver com a senha antiga cai fora.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new UnauthorizedException('Sessão inválida');

    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) {
      await this.audit.log({
        action: 'auth.password_change_failed',
        entity: 'User',
        entityId: userId,
        userId,
        tenantId: user.tenantId,
      });
      throw new UnauthorizedException('Senha atual incorreta');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(newPassword) },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      action: 'auth.password_changed',
      entity: 'User',
      entityId: userId,
      userId,
      tenantId: user.tenantId,
    });
  }

  private async issueTokens(
    userId: string,
    tenantId: string | null,
    roles: string[],
    permissions: string[],
    family: string,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const payload: AccessTokenPayload = { sub: userId, tid: tenantId, roles, perms: permissions };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      // TTL vem do .env em formato "15m"/"1h"; o tipo do jsonwebtoken v9 exige o cast
      expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as JwtSignOptions['expiresIn'],
    });

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        family,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
