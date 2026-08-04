/**
 * Worker do Guardião Fiscal.
 * Filas ativas:
 *  - recurrence: job diário (06:00 America/Sao_Paulo) que gera tarefas
 *    recorrentes de todos os tenants e marca vencidas;
 *  - notifications: estrutura pronta; envio real de e-mail entra na Fase 3.
 * Jobs pesados NUNCA rodam na API — sempre aqui.
 */
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { QUEUES, NotificationJob } from '@guardiao/shared';
import { runDailyRecurrence } from './recurrence';

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // exigido pelo BullMQ
});

const prisma = new PrismaClient();
const log = (msg: string) => console.log(`[worker] ${new Date().toISOString()} ${msg}`);

// --- Recorrência diária -----------------------------------------------------

const recurrenceQueue = new Queue(QUEUES.RECURRENCE, { connection });

const recurrenceWorker = new Worker(
  QUEUES.RECURRENCE,
  async () => {
    const result = await runDailyRecurrence(prisma);
    log(
      `recorrência: ${result.tenants} tenants, ${result.created} tarefas criadas, ${result.overdueMarked} marcadas vencidas`,
    );
    return result;
  },
  { connection, concurrency: 1 },
);

async function scheduleRecurrence() {
  await recurrenceQueue.upsertJobScheduler(
    'daily-recurrence',
    { pattern: '0 6 * * *', tz: 'America/Sao_Paulo' },
    { name: 'daily' },
  );
  log('job diário de recorrência agendado (06:00 America/Sao_Paulo)');
  if (process.env.RUN_RECURRENCE_ON_BOOT === '1') {
    await recurrenceQueue.add('boot', {});
    log('execução imediata de recorrência enfileirada (RUN_RECURRENCE_ON_BOOT=1)');
  }
}

// --- Notificações (envio real na Fase 3) ------------------------------------

const notificationsWorker = new Worker<NotificationJob>(
  QUEUES.NOTIFICATIONS,
  async (job: Job<NotificationJob>) => {
    log(`notificação recebida: template=${job.data.template} canal=${job.data.channel} tenant=${job.data.tenantId}`);
    if (!job.data.to || !job.data.template) {
      throw new Error('Job de notificação inválido: "to" e "template" são obrigatórios');
    }
    return { queuedAt: new Date().toISOString(), delivered: false, reason: 'SMTP não configurado (Fase 3)' };
  },
  { connection, concurrency: 5, limiter: { max: 50, duration: 1000 } },
);

for (const worker of [recurrenceWorker, notificationsWorker]) {
  worker.on('completed', (job) => log(`[${worker.name}] job ${job.id} concluído`));
  worker.on('failed', (job, err) => log(`[${worker.name}] job ${job?.id} falhou: ${err.message}`));
}

void scheduleRecurrence();
log(`worker iniciado — filas: ${QUEUES.RECURRENCE}, ${QUEUES.NOTIFICATIONS}`);

async function shutdown(signal: string) {
  log(`${signal} recebido, encerrando com graça...`);
  await Promise.all([recurrenceWorker.close(), notificationsWorker.close(), recurrenceQueue.close()]);
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
