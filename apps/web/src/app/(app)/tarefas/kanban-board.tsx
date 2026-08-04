import Link from 'next/link';
import { StatusSelect } from './status-select';

interface TaskCard {
  id: string;
  title: string;
  competence: string;
  dueDate: string;
  status: string;
  priority: string;
  company: { id: string; razaoSocial: string };
  responsible: { id: string; name: string } | null;
}

const COLUMNS: Array<{ status: string; label: string; accent: string }> = [
  { status: 'NAO_INICIADA', label: 'Não iniciadas', accent: 'border-t-gray-400' },
  { status: 'AGUARDANDO_DOCUMENTOS', label: 'Aguardando docs', accent: 'border-t-amber-400' },
  { status: 'EM_ANDAMENTO', label: 'Em andamento', accent: 'border-t-blue-500' },
  { status: 'EM_CONFERENCIA', label: 'Em conferência', accent: 'border-t-indigo-500' },
  { status: 'AGUARDANDO_APROVACAO', label: 'Aguard. aprovação', accent: 'border-t-purple-500' },
  { status: 'VENCIDA', label: 'Vencidas', accent: 'border-t-red-500' },
  { status: 'CONCLUIDA', label: 'Concluídas', accent: 'border-t-green-500' },
];

const fmtDue = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

/** Kanban por status — a mudança de coluna é feita pelo seletor de cada cartão. */
export function KanbanBoard({ tasks }: { tasks: TaskCard[] }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-3">
        {COLUMNS.map((column) => {
          const items = tasks.filter((t) => t.status === column.status);
          return (
            <div
              key={column.status}
              className={`w-64 shrink-0 rounded-xl border border-gray-200 border-t-4 bg-gray-50 ${column.accent}`}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <h3 className="text-xs font-semibold uppercase text-gray-600">{column.label}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-600">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2 px-2 pb-2">
                {items.map((task) => {
                  const late =
                    task.dueDate.slice(0, 10) < today &&
                    task.status !== 'CONCLUIDA' &&
                    task.status !== 'CANCELADA';
                  return (
                    <div key={task.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                      <Link
                        href={`/tarefas/${task.id}`}
                        className="block text-sm font-medium leading-snug text-gray-800 hover:text-brand-700"
                      >
                        {task.title}
                      </Link>
                      <p className="mt-1 truncate text-xs text-gray-500">{task.company.razaoSocial}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                            late ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {fmtDue(task.dueDate)}
                        </span>
                        <StatusSelect taskId={task.id} status={task.status} />
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="px-1 pb-2 text-center text-xs text-gray-400">vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
