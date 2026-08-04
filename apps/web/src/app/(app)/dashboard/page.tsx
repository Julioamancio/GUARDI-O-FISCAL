import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiFetch, UnauthorizedError } from '@/lib/api';
import type { Me } from '../layout';
import { NewTenantForm } from './new-tenant-form';
import { TenantStatusButton } from './tenant-status-button';
import { ChartCard, Donut, HBars, StackedColumns, VIZ } from './charts';

interface TaskSummary {
  byStatus: Record<string, number>;
  overdue: number;
  dueNext7Days: number;
  byDepartment: Record<string, number>;
  evolution: Array<{ competence: string; concluida: number; vencida: number; aberta: number }>;
  upcoming: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: string;
    priority: string;
    company: { id: string; razaoSocial: string };
  }>;
}

interface ClosingSummary {
  summary: Record<string, number>;
  rows: unknown[];
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
    const [overview, tenants, plans] = await Promise.all([
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
      apiFetch<Array<{ slug: string; name: string; maxCompanies: number }>>('/admin/plans'),
    ]);
    const fmtBytes = (b: number) =>
      b > 1024 * 1024 * 1024 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.ceil(b / 1024 / 1024)} MB`;
    const totalTenants = Object.values(overview.tenants).reduce((a, b) => a + b, 0);

    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-brand-700">Administração da Plataforma</h1>
        <NewTenantForm plans={plans} />
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
                <th className="px-4 py-3 text-right">Ações</th>
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
                  <td className="px-4 py-3 text-right">
                    <TenantStatusButton tenantId={tenant.id} status={tenant.status} name={tenant.razaoSocial} />
                  </td>
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

  const currentCompetence = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [summary, companies, closing, requests] = await Promise.all([
    apiFetch<TaskSummary>('/tasks/summary'),
    apiFetch<{ total: number }>('/companies?perPage=1'),
    apiFetch<ClosingSummary>(`/closing?competence=${currentCompetence}`),
    apiFetch<Array<{ status: string }>>('/document-requests'),
  ]);
  const openRequests = requests.filter((r) => r.status === 'ABERTA' || r.status === 'PARCIAL').length;

  const STATUS_META: Array<[string, string, string]> = [
    ['VENCIDA', 'Vencidas', VIZ.critical],
    ['AGUARDANDO_DOCUMENTOS', 'Aguardando documentos', VIZ.warning],
    ['EM_ANDAMENTO', 'Em andamento', VIZ.s1],
    ['EM_CONFERENCIA', 'Em conferência', VIZ.s1],
    ['AGUARDANDO_APROVACAO', 'Aguardando aprovação', VIZ.s1],
    ['NAO_INICIADA', 'Não iniciadas', VIZ.neutral],
    ['BLOQUEADA', 'Bloqueadas', VIZ.serious],
    ['CONCLUIDA', 'Concluídas', VIZ.good],
  ];

  const DEP_META: Array<[string, string, string]> = [
    ['FISCAL', 'Fiscal', VIZ.s1],
    ['CONTABIL', 'Contábil', VIZ.s2],
    ['PESSOAL', 'Pessoal', VIZ.s3],
    ['FINANCEIRO', 'Financeiro', VIZ.s4],
    ['SOCIETARIO', 'Societário', VIZ.s5],
    ['OUTRO', 'Outros', VIZ.neutral],
  ];

  const fmtDue = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y.slice(2)}`;
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-brand-700">Visão geral</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Empresas ativas" value={String(companies.total)} href="/empresas" tone="default" />
        <Card label="Tarefas em aberto" value={String(open(summary))} href="/tarefas" tone="info" />
        <Card
          label="Vencem em 7 dias"
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Saúde do fechamento"
          subtitle={`competência ${currentCompetence.split('-').reverse().join('/')} — clique para abrir o painel`}
          action={
            <Link href="/fechamento" className="text-xs font-semibold text-brand-700 hover:underline">
              ver painel →
            </Link>
          }
        >
          <Donut
            centerValue={String(companies.total)}
            centerLabel="empresas"
            segments={[
              { label: 'Crítico', value: closing.summary.VERMELHO ?? 0, color: VIZ.critical, href: '/fechamento' },
              { label: 'Atenção', value: closing.summary.AMARELO ?? 0, color: VIZ.warning, href: '/fechamento' },
              { label: 'Em andamento', value: closing.summary.AZUL ?? 0, color: VIZ.s1, href: '/fechamento' },
              { label: 'Concluído', value: closing.summary.VERDE ?? 0, color: VIZ.good, href: '/fechamento' },
              { label: 'Não iniciado', value: closing.summary.CINZA ?? 0, color: VIZ.neutral, href: '/fechamento' },
            ]}
          />
        </ChartCard>

        <ChartCard title="Tarefas por status" subtitle="clique numa barra para filtrar a lista">
          {Object.keys(summary.byStatus).length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhuma tarefa ainda — cadastre empresas, adicione obrigações do catálogo e o motor
              de recorrência monta o calendário sozinho.
            </p>
          ) : (
            <HBars
              items={STATUS_META.filter(([key]) => (summary.byStatus[key] ?? 0) > 0).map(
                ([key, label, color]) => ({
                  label,
                  value: summary.byStatus[key] ?? 0,
                  color,
                  href: `/tarefas?status=${key}`,
                }),
              )}
            />
          )}
        </ChartCard>

        <ChartCard title="Evolução por competência" subtitle="últimos 6 meses — clique para ver o mês">
          <StackedColumns
            groups={summary.evolution.map((month) => ({
              label: month.competence.split('-').reverse().join('/'),
              href: `/tarefas?competence=${month.competence}`,
              parts: [
                { label: 'Concluídas', value: month.concluida, color: VIZ.good },
                { label: 'Em aberto', value: month.aberta, color: VIZ.s1 },
                { label: 'Vencidas', value: month.vencida, color: VIZ.critical },
              ],
            }))}
          />
        </ChartCard>

        <ChartCard title="Trabalho em aberto por departamento" subtitle="tarefas não concluídas">
          {Object.keys(summary.byDepartment).length === 0 ? (
            <p className="text-sm text-gray-500">Nada em aberto — tudo em dia. ✓</p>
          ) : (
            <HBars
              items={DEP_META.filter(([key]) => (summary.byDepartment[key] ?? 0) > 0).map(
                ([key, label, color]) => ({
                  label,
                  value: summary.byDepartment[key] ?? 0,
                  color,
                  href: `/tarefas?department=${key}`,
                }),
              )}
            />
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          title="Próximos vencimentos"
          subtitle="o que precisa da sua atenção primeiro"
          action={
            <Link href="/tarefas" className="text-xs font-semibold text-brand-700 hover:underline">
              todas →
            </Link>
          }
        >
          {summary.upcoming.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma tarefa em aberto. ✓</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {summary.upcoming.map((task) => {
                const late = task.dueDate.slice(0, 10) < today || task.status === 'VENCIDA';
                return (
                  <li key={task.id}>
                    <Link
                      href={`/tarefas?companyId=${task.company.id}`}
                      className="flex items-center justify-between gap-3 py-2 hover:bg-brand-50/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-800">
                          {task.title}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {task.company.razaoSocial}
                        </span>
                      </span>
                      <span
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold tabular-nums"
                        style={{
                          color: late ? '#fff' : '#0b0b0b',
                          backgroundColor: late ? VIZ.critical : '#f0efec',
                        }}
                      >
                        {fmtDue(task.dueDate)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Documentos de clientes" subtitle="solicitações em andamento">
          <Link href="/solicitacoes" className="group flex items-center gap-4">
            <span
              className="text-4xl font-bold tabular-nums"
              style={{ color: openRequests > 0 ? VIZ.warning : VIZ.good }}
            >
              {openRequests}
            </span>
            <span className="text-sm text-gray-600 group-hover:text-brand-700">
              solicitação(ões) aguardando documentos do cliente — as cobranças automáticas estão
              cuidando dos lembretes
            </span>
          </Link>
        </ChartCard>

        <ChartCard title="Ações rápidas" subtitle="atalhos do dia a dia">
          <div className="flex flex-col gap-2 text-sm">
            <Link href="/empresas" className="rounded-lg border border-gray-200 px-3 py-2 hover:border-brand-500 hover:text-brand-700">
              + Cadastrar empresa
            </Link>
            <Link href="/solicitacoes" className="rounded-lg border border-gray-200 px-3 py-2 hover:border-brand-500 hover:text-brand-700">
              + Solicitar documentos
            </Link>
            <Link href="/fechamento" className="rounded-lg border border-gray-200 px-3 py-2 hover:border-brand-500 hover:text-brand-700">
              Conferir o fechamento do mês
            </Link>
          </div>
        </ChartCard>
      </div>
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
