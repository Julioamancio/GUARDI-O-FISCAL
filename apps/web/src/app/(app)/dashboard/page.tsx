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
    const [overview, tenants] = await Promise.all([
      apiFetch<{
        tenants: Record<string, number>;
        totalUsers: number;
        totalCompanies: number;
        totalTasks: number;
        storageTop: Array<{ tenant: string; slug: string | null; bytes: number }>;
        storageTotalBytes: number;
      }>('/admin/overview'),
      apiFetch<{
        items: Array<{
          id: string;
          slug: string;
          razaoSocial: string;
          status: string;
          plan: { name: string } | null;
          _count: { users: number; companies: number };
        }>;
        total: number;
      }>('/admin/tenants?perPage=20'),
    ]);
    const fmtBytes = (b: number) =>
      b > 1024 * 1024 * 1024 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.ceil(b / 1024 / 1024)} MB`;
    const totalTenants = Object.values(overview.tenants).reduce((a, b) => a + b, 0);

    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-brand-700">Administração da Plataforma</h1>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card label="Escritórios" value={String(totalTenants)} tone="default" />
          <Card label="Usuários" value={String(overview.totalUsers)} tone="info" />
          <Card label="Empresas atendidas" value={String(overview.totalCompanies)} tone="default" />
          <Card label="Tarefas" value={String(overview.totalTasks)} tone="default" />
          <Card label="Armazenamento" value={fmtBytes(overview.storageTotalBytes)} tone="warn" />
        </div>

        <section className="mt-8 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">Escritório</th>
                <th className="px-4 py-3">Subdomínio</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Usuários</th>
                <th className="px-4 py-3 text-right">Empresas</th>
              </tr>
            </thead>
            <tbody>
              {tenants.items.map((tenant) => (
                <tr key={tenant.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-800">{tenant.razaoSocial}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{tenant.slug}</td>
                  <td className="px-4 py-3">{tenant.plan?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        tenant.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-700'
                          : tenant.status === 'TRIAL'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {tenant.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{tenant._count.users}</td>
                  <td className="px-4 py-3 text-right">{tenant._count.companies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <p className="mt-3 text-xs text-gray-400">
          Exibindo {tenants.items.length} de {tenants.total} escritórios · gestão completa (criar,
          suspender, planos) via API <code>/docs</code>
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
