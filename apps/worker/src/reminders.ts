/**
 * Cobrança automática de documentos (requisito 12).
 * Estágios: D-5, D-3, D-0 e diário após o vencimento (máx. 10 cobranças).
 * Anti-spam POR CONSTRUÇÃO: UNIQUE (requestId, stage) no banco — o mesmo
 * lembrete jamais é enviado duas vezes, mesmo com o job rodando em dobro.
 * Pausável por solicitação (remindersEnabled).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { NotificationJob, toIso } from '@guardiao/shared';

const MAX_OVERDUE_REMINDERS = 10;

function diffDays(fromIso: string, toIsoDate: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIsoDate.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export async function runDailyReminders(
  prisma: PrismaClient,
  emailQueue: Queue<NotificationJob>,
): Promise<{ requests: number; remindersSent: number }> {
  const now = new Date();
  const todayIso = toIso(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());

  const requests = await prisma.documentRequest.findMany({
    where: {
      deletedAt: null,
      remindersEnabled: true,
      status: { in: ['ABERTA', 'PARCIAL'] },
      dueDate: { not: null },
    },
    include: {
      company: {
        include: { clientAccesses: { include: { user: true } } },
      },
      items: true,
      createdBy: { select: { id: true, email: true } },
    },
  });

  let remindersSent = 0;

  for (const request of requests) {
    const dueIso = request.dueDate!.toISOString().slice(0, 10);
    const daysUntilDue = diffDays(todayIso, dueIso); // positivo = ainda no prazo

    let stage: string | null = null;
    if (daysUntilDue === 5) stage = 'D5';
    else if (daysUntilDue === 3) stage = 'D3';
    else if (daysUntilDue === 0) stage = 'D0';
    else if (daysUntilDue < 0) stage = `ATRASO_${todayIso}`;
    if (!stage) continue;

    if (stage.startsWith('ATRASO_')) {
      const overdueCount = await prisma.documentReminder.count({
        where: { requestId: request.id, stage: { startsWith: 'ATRASO_' } },
      });
      if (overdueCount >= MAX_OVERDUE_REMINDERS) continue; // limite anti-spam (req. 12)
    }

    // Registro do estágio — se já existir (unique), outro processo já enviou
    try {
      await prisma.documentReminder.create({
        data: { tenantId: request.tenantId, requestId: request.id, stage },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
      throw error;
    }

    const pendingItems = request.items.filter((i) => i.status === 'PENDENTE' || i.status === 'REJEITADO');
    if (pendingItems.length === 0) continue;

    const dueBr = dueIso.split('-').reverse().join('/');
    const isLate = daysUntilDue < 0;
    const title = isLate
      ? `Documentos em atraso — ${request.title}`
      : `Lembrete: documentos até ${dueBr} — ${request.title}`;
    const body =
      `${request.company.razaoSocial}: ${isLate ? `o prazo (${dueBr}) venceu e ainda faltam` : `faltam`} ` +
      `${pendingItems.length} documento(s): ${pendingItems.map((i) => i.name).join('; ')}.` +
      `\n\nEnvie pelo portal para regularizar.`;

    const sendTo = async (userId: string | null, email: string | null) => {
      if (!email) return;
      const notification = await prisma.notification.create({
        data: {
          tenantId: request.tenantId,
          userId,
          type: 'LEMBRETE_DOCUMENTO',
          title,
          body,
          emailTo: email,
          meta: { requestId: request.id, stage },
        },
      });
      await emailQueue.add(
        'send',
        { notificationId: notification.id, to: email, subject: title, text: body },
        { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
      );
    };

    const activeClients = request.company.clientAccesses.filter((a) => a.user.isActive);
    if (activeClients.length > 0) {
      for (const access of activeClients) await sendTo(access.user.id, access.user.email);
    } else {
      await sendTo(null, request.company.email);
    }
    // Em atraso, o responsável interno também é avisado (req. 12)
    if (isLate && request.createdBy) {
      await sendTo(request.createdBy.id, request.createdBy.email);
    }

    await prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        action: 'document_requests.reminder_sent',
        entity: 'DocumentRequest',
        entityId: request.id,
        after: { stage, pendingItems: pendingItems.length, recipients: Math.max(activeClients.length, 1) },
      },
    });
    await prisma.responsibilityTimeline.create({
      data: {
        tenantId: request.tenantId,
        companyId: request.companyId,
        competence: request.competence,
        event: 'documento.lembrete',
        description: `Cobrança automática (${isLate ? 'em atraso' : `estágio ${stage}`}) de ${pendingItems.length} documento(s) pendente(s) da solicitação "${request.title}"`,
        entity: 'DocumentRequest',
        entityId: request.id,
        actorName: 'Sistema',
        meta: { stage },
      },
    });
    remindersSent++;
  }

  return { requests: requests.length, remindersSent };
}
