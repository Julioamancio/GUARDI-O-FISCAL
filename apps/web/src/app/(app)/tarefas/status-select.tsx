'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clientApi } from '@/lib/client-api';

const OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'NAO_INICIADA', label: 'Não iniciada' },
  { value: 'AGUARDANDO_DOCUMENTOS', label: 'Aguardando documentos' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'EM_CONFERENCIA', label: 'Em conferência' },
  { value: 'AGUARDANDO_APROVACAO', label: 'Aguardando aprovação' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'BLOQUEADA', label: 'Bloqueada' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

const COLOR: Record<string, string> = {
  NAO_INICIADA: 'border-gray-300 text-gray-600',
  AGUARDANDO_DOCUMENTOS: 'border-amber-300 text-amber-700',
  EM_ANDAMENTO: 'border-blue-300 text-blue-700',
  EM_CONFERENCIA: 'border-indigo-300 text-indigo-700',
  AGUARDANDO_APROVACAO: 'border-purple-300 text-purple-700',
  CONCLUIDA: 'border-green-300 text-green-700',
  VENCIDA: 'border-red-400 text-red-700',
  BLOQUEADA: 'border-gray-400 text-gray-700',
  CANCELADA: 'border-gray-300 text-gray-400',
};

/**
 * Troca de status direto na listagem. VENCIDA é status do sistema: aparece
 * quando é o atual, mas não é opção manual — ao resolver, o usuário move
 * para concluída (o atraso fica provado por completedAt > dueDate).
 */
export function StatusSelect({ taskId, status }: { taskId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    if (next === status) return;
    setBusy(true);
    setError(null);
    try {
      await clientApi(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        value={status}
        onChange={(e) => change(e.target.value)}
        disabled={busy}
        className={`rounded-lg border bg-white px-2 py-1 text-xs font-medium ${COLOR[status] ?? 'border-gray-300'} disabled:opacity-50`}
      >
        {status === 'VENCIDA' && <option value="VENCIDA">Vencida</option>}
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 max-w-40 text-xs text-red-600">{error}</p>}
    </div>
  );
}
