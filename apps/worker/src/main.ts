/**
 * Worker do Guardião Fiscal.
 * Fase 1: estrutura + fila de notificações registrada (envio real entra na Fase 3,
 * junto com SMTP). Fase 2 adiciona a fila de recorrência de tarefas.
 * Jobs pesados NUNCA rodam na API — sempre aqui.
 */
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUES, NotificationJob } from '@guardiao/shared';

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // exigido pelo BullMQ
});

const log = (msg: string) => console.log(`[worker] ${new Date().toISOString()} ${msg}`);

const notificationsWorker = new Worker<NotificationJob>(
  QUEUES.NOTIFICATIONS,
  async (job: Job<NotificationJob>) => {
    // Fase 3 liga o provedor SMTP real. Por enquanto o job é validado e registrado,
    // sem fingir entrega: o status permanece rastreável na fila.
    log(`notificação recebida: template=${job.data.template} canal=${job.data.channel} tenant=${job.data.tenantId}`);
    if (!job.data.to || !job.data.template) {
      throw new Error('Job de notificação inválido: "to" e "template" são obrigatórios');
    }
    return { queuedAt: new Date().toISOString(), delivered: false, reason: 'SMTP não configurado (Fase 3)' };
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 50, duration: 1000 }, // proteção contra rajadas
  },
);

notificationsWorker.on('completed', (job) => log(`job ${job.id} concluído`));
notificationsWorker.on('failed', (job, err) => log(`job ${job?.id} falhou: ${err.message}`));

log(`worker iniciado — filas: ${QUEUES.NOTIFICATIONS}`);

async function shutdown(signal: string) {
  log(`${signal} recebido, encerrando com graça...`);
  await notificationsWorker.close();
  await connection.quit();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
