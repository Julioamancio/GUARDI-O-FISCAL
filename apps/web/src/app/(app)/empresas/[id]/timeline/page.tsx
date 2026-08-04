import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ExportButtons } from '../../../export-buttons';

interface TimelineEvent {
  id: string;
  event: string;
  description: string;
  actorName: string | null;
  competence: string | null;
  ip: string | null;
  createdAt: string;
}

const EVENT_ICON: Record<string, string> = {
  'documento.solicitado': '📨',
  'documento.lembrete': '🔔',
  'documento.recebido': '📥',
  'documento.aprovado': '✅',
  'documento.rejeitado': '❌',
  'tarefa.status': '🔄',
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ competence?: string }>;
}) {
  const { id } = await params;
  const { competence } = await searchParams;

  let company: { razaoSocial: string };
  let events: TimelineEvent[];
  try {
    [company, events] = await Promise.all([
      apiFetch<{ razaoSocial: string }>(`/companies/${id}`),
      apiFetch<TimelineEvent[]>(
        `/timeline?companyId=${id}${competence ? `&competence=${competence}` : ''}&limit=200`,
      ),
    ]);
  } catch {
    notFound();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/empresas/${id}`} className="text-xs text-gray-500 hover:text-brand-700">
            ← {company.razaoSocial}
          </Link>
          <h1 className="text-2xl font-bold text-brand-700">Linha do Tempo de Responsabilidade</h1>
          <p className="mt-1 text-sm text-gray-600">
            Registro imutável de quem fez o quê, quando — prova documental do escritório.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ExportButtons
            path={`/reports/timeline/${id}${competence ? `?competence=${competence}` : ''}`}
            filename={`linha-do-tempo${competence ? `-${competence}` : ''}`}
          />
          <form method="get" className="flex items-center gap-2">
            <input
              name="competence"
              defaultValue={competence ?? ''}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
              Filtrar
            </button>
          </form>
        </div>
      </div>

      {events.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Nenhum evento registrado{competence ? ` na competência ${competence}` : ''} — os eventos
          surgem conforme documentos são solicitados/recebidos e tarefas mudam de status.
        </p>
      )}

      <ol className="relative ml-3 space-y-4 border-l border-gray-200 pl-6">
        {events.map((event) => (
          <li key={event.id} className="relative">
            <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm">
              {EVENT_ICON[event.event] ?? '•'}
            </span>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-800">{event.description}</p>
              <p className="mt-1 text-xs text-gray-500">
                {fmt(event.createdAt)}
                {event.actorName && ` · por ${event.actorName}`}
                {event.competence && ` · competência ${event.competence}`}
                {event.ip && ` · IP ${event.ip}`}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
