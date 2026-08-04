import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { AddObligationForm, GenerateTasksButton, ObligationToggle } from './company-actions';

interface CompanyDetail {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: string | null;
  uf: string | null;
  municipio: string | null;
  status: string;
  riskLevel: string;
  observacoes: string | null;
  tags: string[];
  contacts: Array<{ id: string; name: string; email: string | null; phone: string | null; role: string | null }>;
  responsibles: Array<{ id: string; area: string; user: { id: string; name: string } }>;
  obligations: Array<{
    id: string;
    name: string;
    sphere: string;
    periodicity: string;
    active: boolean;
    dueRule: { day?: number | string; businessDay?: number; monthOffset: number; adjustment: string };
  }>;
}

interface Template {
  id: string;
  slug: string;
  name: string;
  sphere: string;
  notes: string | null;
}

const fmtCnpj = (v: string) =>
  v.length === 14 ? `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}` : v;

const ruleText = (r: CompanyDetail['obligations'][number]['dueRule']) => {
  const base =
    r.businessDay !== undefined
      ? `${r.businessDay}º dia útil`
      : r.day === 'LAST_DAY'
        ? 'último dia'
        : r.day === 'LAST_BUSINESS_DAY'
          ? 'último dia útil'
          : `dia ${r.day}`;
  const offset = r.monthOffset === 0 ? 'do mês da competência' : r.monthOffset === 1 ? 'do mês seguinte' : `+${r.monthOffset} meses`;
  const adj = r.adjustment === 'ANTICIPATE' ? ' (antecipa)' : r.adjustment === 'POSTPONE' ? ' (prorroga)' : '';
  return `${base} ${offset}${adj}`;
};

export default async function EmpresaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let company: CompanyDetail;
  try {
    company = await apiFetch<CompanyDetail>(`/companies/${id}`);
  } catch {
    notFound();
  }
  const templates = await apiFetch<Template[]>('/obligation-templates');

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/empresas" className="text-xs text-gray-500 hover:text-brand-700">
            ← Empresas
          </Link>
          <h1 className="text-2xl font-bold text-brand-700">{company.razaoSocial}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {fmtCnpj(company.cnpj)}
            {company.regimeTributario && ` · ${company.regimeTributario.replaceAll('_', ' ').toLowerCase()}`}
            {company.uf && ` · ${company.municipio ?? ''}/${company.uf}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/empresas/${company.id}/timeline`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            🕑 Linha do tempo
          </Link>
          <Link
            href={`/tarefas?companyId=${company.id}`}
            className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Ver tarefas da empresa
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Obrigações ({company.obligations.length})</h2>
            <GenerateTasksButton />
          </div>

          <AddObligationForm companyId={company.id} templates={templates} />

          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="py-2">Obrigação</th>
                <th className="py-2">Esfera</th>
                <th className="py-2">Vencimento</th>
                <th className="py-2 text-right">Ativa</th>
              </tr>
            </thead>
            <tbody>
              {company.obligations.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500">
                    Nenhuma obrigação — adicione do catálogo acima para gerar o calendário automático.
                  </td>
                </tr>
              )}
              {company.obligations.map((obligation) => (
                <tr key={obligation.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2.5 font-medium text-gray-800">{obligation.name}</td>
                  <td className="py-2.5 text-gray-600">{obligation.sphere.toLowerCase()}</td>
                  <td className="py-2.5 text-gray-600">{ruleText(obligation.dueRule)}</td>
                  <td className="py-2.5 text-right">
                    <ObligationToggle id={obligation.id} active={obligation.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-800">Responsáveis</h2>
            {company.responsibles.length === 0 && (
              <p className="text-sm text-gray-500">Nenhum responsável definido.</p>
            )}
            <ul className="space-y-1.5 text-sm">
              {company.responsibles.map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span className="text-gray-500">{r.area.toLowerCase()}</span>
                  <span className="font-medium text-gray-800">{r.user.name}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-800">Contatos do cliente</h2>
            {company.contacts.length === 0 && <p className="text-sm text-gray-500">Nenhum contato cadastrado.</p>}
            <ul className="space-y-2 text-sm">
              {company.contacts.map((c) => (
                <li key={c.id}>
                  <p className="font-medium text-gray-800">
                    {c.name} {c.role && <span className="font-normal text-gray-500">· {c.role}</span>}
                  </p>
                  <p className="text-xs text-gray-500">{[c.email, c.phone].filter(Boolean).join(' · ')}</p>
                </li>
              ))}
            </ul>
          </section>

          {company.observacoes && (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-semibold text-gray-800">Observações</h2>
              <p className="whitespace-pre-wrap text-sm text-gray-600">{company.observacoes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
