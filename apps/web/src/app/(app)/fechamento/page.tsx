import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface ClosingRow {
  company: { id: string; razaoSocial: string; regimeTributario: string | null; riskLevel: string };
  byDepartment: Record<string, { total: number; done: number; overdue: number; color: string }>;
  documents: { openRequests: number; overdueRequests: number };
  tasksTotal: number;
  tasksDone: number;
  overall: string;
}

interface ClosingPanel {
  competence: string;
  summary: Record<string, number>;
  rows: ClosingRow[];
}

const COLOR_DOT: Record<string, string> = {
  VERMELHO: 'bg-status-critico',
  AMARELO: 'bg-status-atencao',
  AZUL: 'bg-status-emAndamento',
  VERDE: 'bg-status-regular',
  CINZA: 'bg-status-naoIniciado',
};

const COLOR_LABEL: Record<string, string> = {
  VERMELHO: 'Crítico',
  AMARELO: 'Atenção',
  AZUL: 'Em andamento',
  VERDE: 'Concluído',
  CINZA: 'Não iniciado',
};

const DEPARTMENTS = ['FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO', 'SOCIETARIO', 'OUTRO'];
const DEP_SHORT: Record<string, string> = {
  FISCAL: 'Fiscal',
  CONTABIL: 'Contábil',
  PESSOAL: 'Pessoal',
  FINANCEIRO: 'Financeiro',
  SOCIETARIO: 'Societário',
  OUTRO: 'Outros',
};

function currentCompetence(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ competence?: string }>;
}) {
  const params = await searchParams;
  const competence = /^\d{4}-\d{2}$/.test(params.competence ?? '') ? params.competence! : currentCompetence();
  const panel = await apiFetch<ClosingPanel>(`/closing?competence=${competence}`);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-700">Fechamento mensal</h1>
        <form method="get" className="flex items-center gap-2">
          <input
            name="competence"
            defaultValue={competence}
            pattern="\d{4}-\d{2}"
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Ver
          </button>
        </form>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {(['VERMELHO', 'AMARELO', 'AZUL', 'VERDE', 'CINZA'] as const).map((color) => (
          <div key={color} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <span className={`h-3 w-3 rounded-full ${COLOR_DOT[color]}`} />
            <span className="text-sm text-gray-700">
              {COLOR_LABEL[color]}: <strong>{panel.summary[color] ?? 0}</strong>
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Empresa</th>
              {DEPARTMENTS.map((dep) => (
                <th key={dep} className="px-2 py-3 text-center">
                  {DEP_SHORT[dep]}
                </th>
              ))}
              <th className="px-4 py-3 text-center">Documentos</th>
              <th className="px-4 py-3 text-right">Progresso</th>
            </tr>
          </thead>
          <tbody>
            {panel.rows.map((row) => (
              <tr key={row.company.id} className="border-b border-gray-100 last:border-0 hover:bg-brand-50/40">
                <td className="px-4 py-3">
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full ${COLOR_DOT[row.overall]}`}
                    title={COLOR_LABEL[row.overall]}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/empresas/${row.company.id}`} className="font-medium text-brand-700 hover:underline">
                    {row.company.razaoSocial}
                  </Link>
                </td>
                {DEPARTMENTS.map((dep) => {
                  const info = row.byDepartment[dep];
                  return (
                    <td key={dep} className="px-2 py-3 text-center">
                      {info ? (
                        <Link
                          href={`/tarefas?companyId=${row.company.id}&competence=${competence}&department=${dep}`}
                          title={`${info.done}/${info.total} concluídas${info.overdue ? ` · ${info.overdue} vencida(s)` : ''}`}
                        >
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${COLOR_DOT[info.color]}`} />
                          <span className="ml-1 text-xs text-gray-500">
                            {info.done}/{info.total}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center text-xs">
                  {row.documents.overdueRequests > 0 ? (
                    <span className="font-semibold text-status-critico">{row.documents.overdueRequests} em atraso</span>
                  ) : row.documents.openRequests > 0 ? (
                    <span className="text-status-atencao">{row.documents.openRequests} aguardando</span>
                  ) : (
                    <span className="text-gray-400">ok</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-600">
                  {row.tasksDone}/{row.tasksTotal} tarefas
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Verde: tudo concluído · Amarelo: vence em até 7 dias ou documentos aguardando · Vermelho:
        tarefas vencidas ou documentos em atraso · Azul: em andamento · Cinza: não iniciado
      </p>
    </div>
  );
}
