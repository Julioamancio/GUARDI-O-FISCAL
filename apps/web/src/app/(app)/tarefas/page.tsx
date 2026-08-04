import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { StatusSelect } from './status-select';
import { ExportButtons } from '../export-buttons';

interface TaskRow {
  id: string;
  title: string;
  competence: string;
  dueDate: string;
  status: string;
  priority: string;
  company: { id: string; razaoSocial: string };
  responsible: { id: string; name: string } | null;
  obligation: { name: string; sphere: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  NAO_INICIADA: 'Não iniciada',
  AGUARDANDO_DOCUMENTOS: 'Aguardando documentos',
  EM_ANDAMENTO: 'Em andamento',
  EM_CONFERENCIA: 'Em conferência',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  CONCLUIDA: 'Concluída',
  VENCIDA: 'Vencida',
  BLOQUEADA: 'Bloqueada',
  CANCELADA: 'Cancelada',
};

const PRIORITY_BADGE: Record<string, string> = {
  BAIXA: 'bg-gray-100 text-gray-600',
  MEDIA: 'bg-blue-50 text-blue-700',
  ALTA: 'bg-amber-50 text-amber-700',
  CRITICA: 'bg-red-50 text-red-700',
};

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    companyId?: string;
    competence?: string;
    dueSoon?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.competence) query.set('competence', params.competence);
  if (params.dueSoon) {
    const limit = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    query.set('dueBefore', limit.toISOString().slice(0, 10));
  }
  query.set('page', params.page ?? '1');
  query.set('perPage', '25');

  const data = await apiFetch<{ items: TaskRow[]; total: number; page: number; perPage: number }>(
    `/tasks?${query.toString()}`,
  );
  const totalPages = Math.max(1, Math.ceil(data.total / data.perPage));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-700">Tarefas</h1>
        <div className="flex items-center gap-4">
          <ExportButtons
            path={`/reports/tasks?x=1${params.competence ? `&competence=${params.competence}` : ''}${params.status ? `&status=${params.status}` : ''}${params.companyId ? `&companyId=${params.companyId}` : ''}`}
            filename={`tarefas${params.competence ? `-${params.competence}` : ''}`}
          />
          <span className="text-sm text-gray-500">{data.total} encontradas</span>
        </div>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-gray-500">
            Status
          </label>
          <select id="status" name="status" defaultValue={params.status ?? ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="competence" className="mb-1 block text-xs font-medium text-gray-500">
            Competência
          </label>
          <input
            id="competence"
            name="competence"
            defaultValue={params.competence ?? ''}
            placeholder="2026-08"
            pattern="\d{4}-\d{2}"
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        {params.companyId && <input type="hidden" name="companyId" value={params.companyId} />}
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Filtrar
        </button>
        {(params.status || params.competence || params.companyId || params.dueSoon) && (
          <Link href="/tarefas" className="px-2 py-2 text-sm text-gray-500 hover:text-brand-700">
            Limpar filtros
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Tarefa</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Competência</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Prioridade</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Nenhuma tarefa com estes filtros.
                </td>
              </tr>
            )}
            {data.items.map((task) => {
              const dueIso = task.dueDate.slice(0, 10);
              const isLate = task.status === 'VENCIDA' || (dueIso < today && task.status !== 'CONCLUIDA' && task.status !== 'CANCELADA');
              return (
                <tr key={task.id} className="border-b border-gray-100 last:border-0 hover:bg-brand-50/40">
                  <td className="px-4 py-3 font-medium text-gray-800">{task.title}</td>
                  <td className="px-4 py-3">
                    <Link href={`/empresas/${task.company.id}`} className="text-brand-700 hover:underline">
                      {task.company.razaoSocial}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{task.competence}</td>
                  <td className={`px-4 py-3 ${isLate ? 'font-semibold text-status-critico' : ''}`}>
                    {fmtDate(task.dueDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[task.priority]}`}>
                      {task.priority.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{task.responsible?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusSelect taskId={task.id} status={task.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/tarefas?${new URLSearchParams({ ...params, page: String(p) }).toString()}`}
              className={`rounded px-3 py-1 ${p === data.page ? 'bg-brand-600 text-white' : 'border border-gray-300 hover:bg-gray-100'}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
