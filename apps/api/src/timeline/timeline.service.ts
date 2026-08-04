import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant-context';

export interface TimelineEntry {
  companyId?: string | null;
  competence?: string | null;
  event: string; // documento.solicitado | documento.recebido | documento.aprovado | ...
  description: string;
  entity: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
  /** Para eventos de sistema (worker) fora de requisição. */
  tenantId?: string;
  actorName?: string;
}

/**
 * Linha do Tempo de Responsabilidade (requisito 16) — APPEND-ONLY.
 * Não existe update nem delete; o nome do autor é denormalizado para que o
 * registro continue provando a autoria mesmo se o usuário sair do escritório.
 * Falha aqui nunca derruba a operação de negócio (mas é sempre logada).
 */
@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: TimelineEntry): Promise<void> {
    const ctx = TenantContext.get();
    const tenantId = entry.tenantId ?? ctx?.tenantId;
    if (!tenantId) return; // eventos fora de tenant não pertencem à linha do tempo

    try {
      let actorName = entry.actorName ?? null;
      if (!actorName && ctx?.userId) {
        const actor = await this.prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { name: true },
        });
        actorName = actor?.name ?? null;
      }
      await this.prisma.responsibilityTimeline.create({
        data: {
          tenantId,
          companyId: entry.companyId,
          competence: entry.competence,
          event: entry.event,
          description: entry.description,
          entity: entry.entity,
          entityId: entry.entityId,
          actorId: ctx?.userId ?? null,
          actorName: actorName ?? (ctx?.userId ? null : 'Sistema'),
          ip: ctx?.ip,
          meta: entry.meta,
        },
      });
    } catch (error) {
      this.logger.error(`Falha ao gravar linha do tempo (${entry.event})`, error as Error);
    }
  }

  list(companyId?: string, competence?: string, limit = 100) {
    return this.prisma.scoped.responsibilityTimeline.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(competence ? { competence } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, limit),
    });
  }
}
