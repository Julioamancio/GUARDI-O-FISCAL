import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiFetch, UnauthorizedError } from '@/lib/api';
import type { Me } from '../layout';

interface TaskSummary {
  byStatus: Record<string, number>;
  overdue: number;
  dueNext7Days: number;
}

const open = (s: TaskSummary) =>
  (s.byStatus.NAO_INICIADA ?? 0) +
  (s.byStatus.AGUARDANDO_DOCUMENTOS ?? 0) +
  (s.byStatus.EM_ANDAMENTO ?? 0) +
  (s.byStatus.EM_CONFERENCIA ?? 0) +
  (s.byStatus.AGUARDANDO_APROVACAO ?? 0);

export default async function DashboardPage() {
  let me: Me;
  try {
    me = await apiFetch<Me>('/auth/me');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/login');
    throw error;
  }

  if (me.roles.includes('client')) {
    redirect('/portal'); // cliente do escritório vai direto ao portal
  }

  if (me.tenantId === null) {
    const tenants = await apiFetch<{ total: number }>('/admin/tenants?perPage=1');
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-brand-700">Administração da Plataforma</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card label="Escritórios cadastrados" value={String(tenants.total)} tone="default" />
        </div>
        <p className="mt-6 text-sm text-gray-500">
          Gestão de escritórios e planos disponível via API (<code>/docs</code>). Painel visual do
          superadmin entra na Fase 4.
        </p>
      </div>
    );
  }

  const [summary, companies] = await Promise.all([
    apiFetch<TaskSummary>('/tasks/summary'),
    apiFetch<{ total: number }>('/companies?perPage=1'),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-brand-700">Visão geral</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Empresas ativas" value={String(companies.total)} href="/empresas" tone="default" />
        <Card label="Tarefas em aberto" value={String(open(summary))} href="/tarefas" tone="info" />
        <Card
          label="Vencem nos próximos 7 dias"
          value={String(summary.dueNext7Days)}
          href="/tarefas?dueSoon=1"
          tone="warn"
        />
        <Card
          label="Tarefas vencidas"
          value={String(summary.overdue)}
          href="/tarefas?status=VENCIDA"
          tone={summary.overdue > 0 ? 'danger' : 'ok'}
        />
      </div>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-800">Tarefas por status</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.byStatus).length === 0 && (
            <p className="text-sm text-gray-500">
              Nenhuma tarefa ainda — cadastre empresas e atribua obrigações do catálogo para o
              motor de recorrência gerar o calendário automaticamente.
            </p>
          )}
          {Object.entries(summary.byStatus).map(([status, count]) => (
            <Link
              key={status}
              href={`/tarefas?status=${status}`}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700 hover:border-brand-500"
            >
              {status.replaceAll('_', ' ').toLowerCase()}: <strong>{count}</strong>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  tone: 'default' | 'info' | 'warn' | 'danger' | 'ok';
}) {
  const tones = {
    default: 'text-gray-900',
    info: 'text-status-emAndamento',
    warn: 'text-status-atencao',
    danger: 'text-status-critico',
    ok: 'text-status-regular',
  } as const;
  const body = (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-500">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
