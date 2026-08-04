'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clientApi } from '@/lib/client-api';

/** Adiciona uma obrigação do catálogo à empresa. */
export function AddObligationForm({
  companyId,
  templates,
}: {
  companyId: string;
  templates: Array<{ id: string; name: string; sphere: string; notes: string | null }>;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = templates.find((t) => t.id === templateId);

  async function add() {
    if (!templateId) return;
    setBusy(true);
    setError(null);
    try {
      await clientApi('/obligations', {
        method: 'POST',
        body: JSON.stringify({ companyIds: [companyId], templateId }),
      });
      setTemplateId('');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="min-w-64 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Adicionar obrigação do catálogo...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.sphere.toLowerCase()})
            </option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={!templateId || busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Adicionando...' : 'Adicionar'}
        </button>
      </div>
      {selected?.notes && <p className="mt-2 text-xs text-gray-500">ℹ️ {selected.notes}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

/** Dispara a geração imediata de tarefas recorrentes do escritório. */
export function GenerateTasksButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setResult(null);
    try {
      const r = await clientApi<{ created: number; overdueMarked: number }>(
        '/obligations/generate-tasks',
        { method: 'POST' },
      );
      setResult(`${r.created} tarefa(s) gerada(s)`);
      router.refresh();
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-gray-500">{result}</span>}
      <button
        onClick={generate}
        disabled={busy}
        className="rounded-lg border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
        title="O worker também gera automaticamente todo dia às 06:00"
      >
        {busy ? 'Gerando...' : '⚡ Gerar tarefas agora'}
      </button>
    </div>
  );
}

/** Liga/desliga a geração de tarefas de uma obrigação. */
export function ObligationToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await clientApi(`/obligations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !active }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      role="switch"
      aria-checked={active}
      className={`relative h-5 w-9 rounded-full transition ${active ? 'bg-brand-600' : 'bg-gray-300'} disabled:opacity-50`}
      title={active ? 'Ativa — clique para desativar' : 'Inativa — clique para ativar'}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${active ? 'left-4' : 'left-0.5'}`}
      />
    </button>
  );
}
