/**
 * Worker do Radar Contábil.
 * Filas:
 *  - recurrence: diário 06:00 BRT — gera tarefas recorrentes e marca vencidas;
 *  - reminders:  diário 07:00 BRT — cobranças automáticas de documentos;
 *  - notifications: envio de e-mail (nodemailer). Sem SMTP configurado, o job
 *    registra o motivo na Notification em vez de fingir entrega.
 * Jobs pesados NUNCA rodam na API — sempre aqui.
 */
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { QUEUES, NotificationJob } from '@guardiao/shared';
import { runDailyRecurrence } from './recurrence';
import { runDailyReminders } from './reminders';

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // exigido pelo BullMQ
});

const prisma = new PrismaClient();
const log = (msg: string) => console.log(`[worker] ${new Date().toISOString()} ${msg}`);

// --- E-mail (SMTP) ----------------------------------------------------------

const smtpConfigured = Boolean(process.env.SMTP_HOST);
const mailTransport = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  : null;

const notificationsWorker = new Worker<NotificationJob>(
  QUEUES.NOTIFICATIONS,
  async (job: Job<NotificationJob>) => {
    const { notificationId, to, subject, text, html } = job.data;
    if (!mailTransport) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { emailError: 'SMTP não configurado — defina SMTP_HOST no .env' },
      }).catch(() => undefined);
      return { delivered: false, reason: 'SMTP não configurado' };
    }
    try {
      await mailTransport.sendMail({
        from: process.env.SMTP_FROM ?? 'Radar Contábil <nao-responda@localhost>',
        to,
        subject,
        text,
        html,
      });
      await prisma.notification.update({
        where: { id: notificationId },
        data: { emailSentAt: new Date(), emailError: null },
      });
      return { delivered: true };
    } catch (error) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { emailError: (error as Error).message.slice(0, 500) },
      }).catch(() => undefined);
      throw error; // BullMQ re-tenta com backoff
    }
  },
  { connection, concurrency: 5, limiter: { max: 30, duration: 1000 } },
);

// --- Recorrência de tarefas -------------------------------------------------

const recurrenceQueue = new Queue(QUEUES.RECURRENCE, { connection });
const recurrenceWorker = new Worker(
  QUEUES.RECURRENCE,
  async () => {
    const result = await runDailyRecurrence(prisma);
    log(`recorrência: ${result.tenants} tenants, ${result.created} criadas, ${result.overdueMarked} vencidas`);
    return result;
  },
  { connection, concurrency: 1 },
);

// --- Lembretes de documentos ------------------------------------------------

const remindersQueue = new Queue(QUEUES.REMINDERS, { connection });
const emailQueue = new Queue<NotificationJob>(QUEUES.NOTIFICATIONS, { connection });
const remindersWorker = new Worker(
  QUEUES.REMINDERS,
  async () => {
    const result = await runDailyReminders(prisma, emailQueue);
    log(`lembretes: ${result.requests} solicitações avaliadas, ${result.remindersSent} cobranças enviadas`);
    return result;
  },
  { connection, concurrency: 1 },
);

async function schedule() {
  await recurrenceQueue.upsertJobScheduler(
    'daily-recurrence',
    { pattern: '0 6 * * *', tz: 'America/Sao_Paulo' },
    { name: 'daily' },
  );
  await remindersQueue.upsertJobScheduler(
    'daily-reminders',
    { pattern: '0 7 * * *', tz: 'America/Sao_Paulo' },
    { name: 'daily' },
  );
  log('agendado: recorrência 06:00 e lembretes 07:00 (America/Sao_Paulo)');
  if (process.env.RUN_RECURRENCE_ON_BOOT === '1') {
    await recurrenceQueue.add('boot', {});
    await remindersQueue.add('boot', {});
    log('execução imediata enfileirada (RUN_RECURRENCE_ON_BOOT=1)');
  }
}

for (const worker of [recurrenceWorker, remindersWorker, notificationsWorker]) {
  worker.on('completed', (job) => log(`[${worker.name}] job ${job.id} concluído`));
  worker.on('failed', (job, err) => log(`[${worker.name}] job ${job?.id} falhou: ${err.message}`));
}

void schedule();
log(
  `worker iniciado — filas: ${QUEUES.RECURRENCE}, ${QUEUES.REMINDERS}, ${QUEUES.NOTIFICATIONS}` +
    (smtpConfigured ? ' (SMTP ativo)' : ' (SMTP não configurado: e-mails ficam registrados sem envio)'),
);

async function shutdown(signal: string) {
  log(`${signal} recebido, encerrando com graça...`);
  await Promise.all([
    recurrenceWorker.close(),
    remindersWorker.close(),
    notificationsWorker.close(),
    recurrenceQueue.close(),
    remindersQueue.close(),
    emailQueue.close(),
  ]);
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
