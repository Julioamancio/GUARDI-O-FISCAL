'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { clientApi } from '@/lib/client-api';

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

/** Checklist interativo: marcar/desmarcar, adicionar e remover itens. */
export function ChecklistManager({
  taskId,
  checklist,
}: {
  taskId: string;
  checklist: Array<{ item: string; done: boolean }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState('');

  async function save(next: Array<{ item: string; done: boolean }>) {
    setBusy(true);
    try {
      await clientApi(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ checklist: next }) });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ul className="space-y-1.5">
        {checklist.map((entry, index) => (
          <li key={index} className="group flex items-center gap-2">
            <input
              type="checkbox"
              checked={entry.done}
              disabled={busy}
              onChange={() =>
                save(checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c)))
              }
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className={`flex-1 text-sm ${entry.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {entry.item}
            </span>
            <button
              onClick={() => save(checklist.filter((_, i) => i !== index))}
              disabled={busy}
              className="text-xs text-gray-300 hover:text-red-600 group-hover:text-gray-400"
              title="Remover item"
            >
              ✕
            </button>
          </li>
        ))}
        {checklist.length === 0 && <p className="text-sm text-gray-500">Sem itens — adicione abaixo.</p>}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newItem.trim()) return;
          save([...checklist, { item: newItem.trim(), done: false }]);
          setNewItem('');
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Novo item do checklist..."
          maxLength={200}
          className={input}
        />
        <button
          type="submit"
          disabled={busy || !newItem.trim()}
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          +
        </button>
      </form>
    </div>
  );
}

export function CommentForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await clientApi(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: body.trim() }),
      });
      setBody('');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Registrar um comentário (fica no histórico da tarefa)..."
        className={input}
      />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy || !body.trim()}
        className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Enviando...' : 'Comentar'}
      </button>
    </form>
  );
}

/** Prazo, prioridade e responsável — salvam ao mudar. */
export function TaskMetaEditor({
  taskId,
  dueDate,
  priority,
  responsibleId,
  staff,
}: {
  taskId: string;
  dueDate: string;
  priority: string;
  responsibleId: string;
  staff: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(data: Record<string, string>) {
    setBusy(true);
    try {
      await clientApi(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Vencimento</label>
        <input
          type="date"
          defaultValue={dueDate}
          disabled={busy}
          onChange={(e) => e.target.value && patch({ dueDate: e.target.value })}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Prioridade</label>
        <select
          defaultValue={priority}
          disabled={busy}
          onChange={(e) => patch({ priority: e.target.value })}
          className={input}
        >
          <option value="BAIXA">Baixa</option>
          <option value="MEDIA">Média</option>
          <option value="ALTA">Alta</option>
          <option value="CRITICA">Crítica</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Responsável</label>
        <select
          defaultValue={responsibleId}
          disabled={busy || staff.length === 0}
          onChange={(e) => e.target.value && patch({ responsibleId: e.target.value })}
          className={input}
        >
          <option value="">— sem responsável —</option>
          {staff.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
