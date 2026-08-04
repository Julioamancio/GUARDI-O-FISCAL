import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { NotificationJob, QUEUES } from '@guardiao/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant-context';

export interface CreateNotificationInput {
  tenantId: string | null;
  userId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  meta?: Prisma.InputJsonValue;
  /** Se presente, enfileira envio de e-mail (o worker envia e grava o resultado). */
  emailTo?: string | null;
}

/**
 * Notificações in-app + fila de e-mail. Falha na fila NUNCA derruba a operação
 * de negócio: a notificação fica registrada com emailError e pode ser reenviada.
 */
@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly queue = new Queue<NotificationJob>(QUEUES.NOTIFICATIONS, {
    connection: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
    },
  });

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy(): Promise<void> {
    await this.queue.close().catch(() => undefined);
  }

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        meta: input.meta,
        emailTo: input.emailTo ?? null,
      },
    });

    if (input.emailTo) {
      try {
        await this.queue.add(
          'send',
          {
            notificationId: notification.id,
            to: input.emailTo,
            subject: input.title,
            text: input.body ?? input.title,
          },
          { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
        );
      } catch (error) {
        this.logger.error(`Falha ao enfileirar e-mail (${notification.id}): ${(error as Error).message}`);
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { emailError: 'Falha ao enfileirar: fila indisponível' },
        });
      }
    }
    return notification;
  }

  /** Notificações do usuário autenticado (não lidas primeiro). */
  async listMine(limit = 50) {
    const ctx = TenantContext.get();
    return this.prisma.notification.findMany({
      where: { userId: ctx?.userId ?? '—' },
      orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async markRead(id: string) {
    const ctx = TenantContext.get();
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: ctx?.userId ?? '—' },
    });
    if (!notification) throw new NotFoundException('Notificação não encontrada');
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}
