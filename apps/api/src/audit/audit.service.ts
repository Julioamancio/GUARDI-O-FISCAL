import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant-context';

export interface AuditEntry {
  action: string; // ex.: auth.login, admin.tenants.create, users.update
  entity: string; // ex.: Tenant, User, Company
  entityId?: string;
  before?: unknown;
  after?: unknown;
  /** Sobrescreve o contexto quando a ação ocorre fora de requisição (jobs, login). */
  userId?: string | null;
  tenantId?: string | null;
  ip?: string;
  userAgent?: string;
}

/**
 * Trilha de auditoria append-only. Falha de auditoria nunca derruba a
 * operação de negócio, mas é sempre logada para investigação.
 * REGRA: jamais gravar senha, hash, token ou certificado em before/after.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    const ctx = TenantContext.get();
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          tenantId: entry.tenantId !== undefined ? entry.tenantId : (ctx?.tenantId ?? null),
          userId: entry.userId !== undefined ? entry.userId : (ctx?.userId ?? null),
          ip: entry.ip ?? ctx?.ip,
          userAgent: entry.userAgent ?? ctx?.userAgent,
          before: this.sanitize(entry.before),
          after: this.sanitize(entry.after),
        },
      });
    } catch (error) {
      this.logger.error(`Falha ao gravar audit log (${entry.action})`, error as Error);
    }
  }

  /** Remove campos sensíveis de qualquer payload auditado. */
  private sanitize(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    const SENSITIVE = /password|senha|secret|token|hash|certificado|certificate/i;
    const clean = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(clean);
      if (v && typeof v === 'object') {
        return Object.fromEntries(
          Object.entries(v as Record<string, unknown>).map(([k, val]) =>
            SENSITIVE.test(k) ? [k, '[REDACTED]'] : [k, clean(val)],
          ),
        );
      }
      return v;
    };
    return clean(value) as Prisma.InputJsonValue;
  }
}
