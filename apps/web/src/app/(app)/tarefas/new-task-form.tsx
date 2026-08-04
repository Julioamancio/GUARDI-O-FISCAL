'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { clientApi } from '@/lib/client-api';

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

/** Tarefa manual (avulsa, fora da recorrência automática). */
export function NewTaskForm({ companies }: { companies: Array<{ id: string; razaoSocial: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const defaultCompetence = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const checklist = String(form.get('checklist') ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    try {
      await clientApi('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          companyId: form.get('companyId'),
          title: form.get('title'),
          description: String(form.get('description') ?? '').trim() || undefined,
          competence: form.get('competence'),
          dueDate: form.get('dueDate'),
          department: String(form.get('department') ?? '') || undefined,
          priority: form.get('priority'),
          checklist: checklist.length > 0 ? checklist : undefined,
        }),
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        + Nova tarefa
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 w-full rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-gray-800">Nova tarefa manual</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Empresa *</label>
          <select name="companyId" required defaultValue="" className={input}>
            <option value="" disabled>
              Selecionar...
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.razaoSocial}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">Título *</label>
          <input name="title" required maxLength={200} placeholder="ex.: Enviar declaração X" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Competência *</label>
          <input name="competence" required pattern="\d{4}-\d{2}" defaultValue={defaultCompetence} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Vencimento *</label>
          <input name="dueDate" type="date" required className={input} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Departamento</label>
            <select name="department" defaultValue="" className={input}>
              <option value="">—</option>
              <option value="FISCAL">Fiscal</option>
              <option value="CONTABIL">Contábil</option>
              <option value="PESSOAL">Pessoal</option>
              <option value="FINANCEIRO">Financeiro</option>
              <option value="SOCIETARIO">Societário</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Prioridade</label>
            <select name="priority" defaultValue="MEDIA" className={input}>
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica</option>
            </select>
          </div>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="mb-1 block text-xs font-medium text-gray-500">Descrição</label>
          <input name="description" maxLength={4000} className={input} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="mb-1 block text-xs font-medium text-gray-500">Checklist (um item por linha)</label>
          <textarea name="checklist" rows={2} className={input} />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Criando...' : 'Criar tarefa'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
