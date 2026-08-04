import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { StatusSelect } from '../status-select';
import { ChecklistManager, CommentForm, TaskMetaEditor } from './task-detail-actions';

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  competence: string;
  dueDate: string;
  status: string;
  priority: string;
  checklist: Array<{ item: string; done: boolean }>;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  company: { id: string; razaoSocial: string; cnpj: string };
  responsible: { id: string; name: string } | null;
  obligation: { id: string; name: string; sphere: string } | null;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string } | null;
  }>;
}

const fmtDate = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let task: TaskDetail;
  try {
    task = await apiFetch<TaskDetail>(`/tasks/${id}`);
  } catch {
    notFound();
  }

  let staff: Array<{ id: string; name: string }> = [];
  try {
    const users = await apiFetch<{ items: Array<{ id: string; name: string; roles: Array<{ role: { slug: string } }> }> }>(
      '/users?perPage=100',
    );
    staff = users.items.filter((u) => !u.roles.some((r) => r.role.slug === 'client'));
  } catch {
    staff = [];
  }

  const done = task.checklist.filter((c) => c.done).length;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/tarefas" className="text-xs text-gray-500 hover:text-brand-700">
        ← Tarefas
      </Link>
      <div className="mb-6 mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
          <p className="mt-1 text-sm text-gray-600">
            <Link href={`/empresas/${task.company.id}`} className="text-brand-700 hover:underline">
              {task.company.razaoSocial}
            </Link>
            {' · '}competência {task.competence}
            {task.obligation && ` · ${task.obligation.name} (${task.obligation.sphere.toLowerCase()})`}
          </p>
        </div>
        <StatusSelect taskId={task.id} status={task.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          {task.description && (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-semibold text-gray-800">Descrição</h2>
              <p className="whitespace-pre-wrap text-sm text-gray-600">{task.description}</p>
            </section>
          )}

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-800">
              Checklist{' '}
              {task.checklist.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({done}/{task.checklist.length})
                </span>
              )}
            </h2>
            <ChecklistManager taskId={task.id} checklist={task.checklist} />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-800">
              Comentários <span className="text-sm font-normal text-gray-500">({task.comments.length})</span>
            </h2>
            <ul className="mb-4 space-y-3">
              {task.comments.map((comment) => (
                <li key={comment.id} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-800">{comment.body}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {comment.user?.name ?? 'Sistema'} · {fmtDateTime(comment.createdAt)}
                  </p>
                </li>
              ))}
              {task.comments.length === 0 && (
                <p className="text-sm text-gray-500">Nenhum comentário ainda.</p>
              )}
            </ul>
            <CommentForm taskId={task.id} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-800">Detalhes</h2>
            <TaskMetaEditor
              taskId={task.id}
              dueDate={task.dueDate.slice(0, 10)}
              priority={task.priority}
              responsibleId={task.responsible?.id ?? ''}
              staff={staff}
            />
            <dl className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <div className="flex justify-between">
                <dt>Criada em</dt>
                <dd>{fmtDate(task.createdAt)}</dd>
              </div>
              {task.startedAt && (
                <div className="flex justify-between">
                  <dt>Iniciada em</dt>
                  <dd>{fmtDate(task.startedAt)}</dd>
                </div>
              )}
              {task.completedAt && (
                <div className="flex justify-between">
                  <dt>Concluída em</dt>
                  <dd className={task.completedAt > task.dueDate ? 'font-semibold text-red-600' : ''}>
                    {fmtDate(task.completedAt)}
                    {task.completedAt > task.dueDate && ' (após o prazo)'}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
