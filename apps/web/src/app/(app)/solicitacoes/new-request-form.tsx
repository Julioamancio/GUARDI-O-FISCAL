'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { clientApi } from '@/lib/client-api';

const COMMON_DOCS = [
  'Extratos bancários',
  'Notas fiscais emitidas',
  'Notas fiscais recebidas',
  'Arquivos XML',
  'Notas de serviços',
  'Comprovantes de pagamento',
  'Folha de pagamento',
  'Movimentações financeiras',
];

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export function NewRequestForm({ companies }: { companies: Array<{ id: string; razaoSocial: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleDoc(doc: string) {
    setSelectedDocs((current) =>
      current.includes(doc) ? current.filter((d) => d !== doc) : [...current, doc],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const custom = String(form.get('customItems') ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const items = [...selectedDocs, ...custom];
    if (items.length === 0) {
      setError('Selecione ou digite ao menos um documento');
      return;
    }
    setSaving(true);
    try {
      await clientApi('/document-requests', {
        method: 'POST',
        body: JSON.stringify({
          companyId: form.get('companyId'),
          title: form.get('title'),
          competence: String(form.get('competence') ?? '').trim() || undefined,
          dueDate: String(form.get('dueDate') ?? '').trim() || undefined,
          message: String(form.get('message') ?? '').trim() || undefined,
          items,
        }),
      });
      setOpen(false);
      setSelectedDocs([]);
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
        className="mb-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        + Nova solicitação
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-gray-800">Nova solicitação de documentos</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Empresa *</label>
          <select name="companyId" required className={input} defaultValue="">
            <option value="" disabled>
              Selecionar empresa...
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razaoSocial}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Título *</label>
          <input name="title" required maxLength={160} placeholder="Fechamento 08/2026" className={input} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Competência</label>
            <input name="competence" placeholder="2026-08" pattern="\d{4}-\d{2}" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Prazo</label>
            <input name="dueDate" type="date" className={input} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Mensagem ao cliente</label>
          <input name="message" maxLength={2000} className={input} />
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-medium text-gray-500">Documentos solicitados *</legend>
        <div className="flex flex-wrap gap-2">
          {COMMON_DOCS.map((doc) => (
            <button
              key={doc}
              type="button"
              onClick={() => toggleDoc(doc)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                selectedDocs.includes(doc)
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:border-brand-500'
              }`}
            >
              {doc}
            </button>
          ))}
        </div>
        <textarea
          name="customItems"
          rows={2}
          placeholder="Outros documentos (um por linha)"
          className={`${input} mt-2`}
        />
      </fieldset>

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
          {saving ? 'Enviando...' : 'Solicitar e notificar cliente'}
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
