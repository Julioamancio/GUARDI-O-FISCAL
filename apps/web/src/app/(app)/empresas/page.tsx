import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { NewCompanyForm } from './new-company-form';

interface CompanyRow {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: string | null;
  uf: string | null;
  status: string;
  riskLevel: string;
  _count: { tasks: number };
}

const fmtCnpj = (v: string) =>
  v.length === 14 ? `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}` : v;

const REGIME_LABEL: Record<string, string> = {
  SIMPLES_NACIONAL: 'Simples',
  LUCRO_PRESUMIDO: 'L. Presumido',
  LUCRO_REAL: 'L. Real',
  MEI: 'MEI',
  IMUNE_ISENTA: 'Imune/Isenta',
  OUTRO: 'Outro',
};

const RISK_DOT: Record<string, string> = {
  LOW: 'bg-status-regular',
  MEDIUM: 'bg-status-atencao',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-status-critico',
};

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  query.set('page', params.page ?? '1');
  query.set('perPage', '20');

  const data = await apiFetch<{ items: CompanyRow[]; total: number; page: number; perPage: number }>(
    `/companies?${query.toString()}`,
  );
  const totalPages = Math.max(1, Math.ceil(data.total / data.perPage));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Empresas</h1>
        <span className="text-sm text-gray-500">{data.total} cadastradas</span>
      </div>

      <NewCompanyForm />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="search" className="mb-1 block text-xs font-medium text-gray-500">
            Buscar (razão social, fantasia ou CNPJ)
          </label>
          <input
            id="search"
            name="search"
            defaultValue={params.search ?? ''}
            className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="ex.: padaria ou 11222333"
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-gray-500">
            Status
          </label>
          <select id="status" name="status" defaultValue={params.status ?? ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todas</option>
            <option value="ACTIVE">Ativas</option>
            <option value="INACTIVE">Inativas</option>
            <option value="SUSPENDED">Suspensas</option>
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
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Regime</th>
              <th className="px-4 py-3">UF</th>
              <th className="px-4 py-3">Risco</th>
              <th className="px-4 py-3 text-right">Tarefas em aberto</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Nenhuma empresa encontrada. Cadastre a primeira no botão acima.
                </td>
              </tr>
            )}
            {data.items.map((company) => (
              <tr key={company.id} className="border-b border-gray-100 last:border-0 hover:bg-brand-50/40">
                <td className="px-4 py-3">
                  <Link href={`/empresas/${company.id}`} className="font-medium text-brand-700 hover:underline">
                    {company.razaoSocial}
                  </Link>
                  {company.nomeFantasia && <p className="text-xs text-gray-500">{company.nomeFantasia}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{fmtCnpj(company.cnpj)}</td>
                <td className="px-4 py-3">{company.regimeTributario ? REGIME_LABEL[company.regimeTributario] : '—'}</td>
                <td className="px-4 py-3">{company.uf ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${RISK_DOT[company.riskLevel]}`} title={company.riskLevel} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/tarefas?companyId=${company.id}`} className="font-semibold text-gray-800 hover:text-brand-700">
                    {company._count.tasks}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/empresas?${new URLSearchParams({ ...params, page: String(p) }).toString()}`}
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
