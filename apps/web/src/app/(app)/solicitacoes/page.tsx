import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { NewRequestForm } from './new-request-form';

interface RequestRow {
  id: string;
  title: string;
  competence: string | null;
  dueDate: string | null;
  status: string;
  company: { id: string; razaoSocial: string };
  items: Array<{ id: string; status: string }>;
  createdBy: { name: string } | null;
}

const STATUS_BADGE: Record<string, string> = {
  ABERTA: 'bg-amber-50 text-amber-700',
  PARCIAL: 'bg-blue-50 text-blue-700',
  CONCLUIDA: 'bg-green-50 text-green-700',
  CANCELADA: 'bg-gray-100 text-gray-500',
};

const fmtDate = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';

export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; companyId?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.companyId) query.set('companyId', params.companyId);

  const [requests, companies] = await Promise.all([
    apiFetch<RequestRow[]>(`/document-requests?${query.toString()}`),
    apiFetch<{ items: Array<{ id: string; razaoSocial: string }> }>('/companies?perPage=100'),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Solicitações de documentos</h1>
        <span className="text-sm text-gray-500">{requests.length} exibidas</span>
      </div>

      <NewRequestForm companies={companies.items} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-gray-500">
            Status
          </label>
          <select id="status" name="status" defaultValue={params.status ?? ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todas</option>
            <option value="ABERTA">Abertas</option>
            <option value="PARCIAL">Parciais</option>
            <option value="CONCLUIDA">Concluídas</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Solicitação</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Competência</th>
              <th className="px-4 py-3">Prazo</th>
              <th className="px-4 py-3">Itens</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Nenhuma solicitação. Crie a primeira no botão acima — o cliente é notificado
                  automaticamente e os lembretes de cobrança são enviados pelo sistema.
                </td>
              </tr>
            )}
            {requests.map((request) => {
              const received = request.items.filter((i) => i.status !== 'PENDENTE' && i.status !== 'REJEITADO').length;
              return (
                <tr key={request.id} className="border-b border-gray-100 last:border-0 hover:bg-brand-50/40">
                  <td className="px-4 py-3">
                    <Link href={`/solicitacoes/${request.id}`} className="font-medium text-brand-700 hover:underline">
                      {request.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{request.company.razaoSocial}</td>
                  <td className="px-4 py-3 font-mono text-xs">{request.competence ?? '—'}</td>
                  <td className="px-4 py-3">{fmtDate(request.dueDate)}</td>
                  <td className="px-4 py-3">
                    {received}/{request.items.length} recebidos
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[request.status]}`}>
                      {request.status.toLowerCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
