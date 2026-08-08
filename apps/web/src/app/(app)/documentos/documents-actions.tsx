'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { BIBLIOTECA } from '@guardiao/shared';

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

/** Upload direto pelo escritório (fora de solicitação). */
export function UploadDocForm({ companies }: { companies: Array<{ id: string; razaoSocial: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formEl = event.currentTarget;
    const file = (formEl.elements.namedItem('file') as HTMLInputElement).files?.[0];
    if (!file) {
      setError('Escolha um arquivo');
      return;
    }
    setSaving(true);
    const form = new FormData(formEl);
    try {
      const response = await fetch('/api/proxy/documents/upload', { method: 'POST', body: form });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(Array.isArray(data.message) ? data.message.join('; ') : (data.message ?? 'Falha no envio'));
      }
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
        className="mb-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        📤 Enviar documento
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-gray-800">Enviar documento</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Nome do documento</label>
          <input name="name" maxLength={200} placeholder="(usa o nome do arquivo)" className={input} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Competência</label>
            <input name="competence" pattern="\d{4}-\d{2}" placeholder="2026-08" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Tipo de documento *</label>
            <select name="category" required defaultValue="" className={input}>
              <option value="" disabled>
                Selecione o tipo...
              </option>
              {BIBLIOTECA.map((cat) =>
                cat.children ? (
                  <optgroup key={cat.slug} label={`${cat.icon ?? ''} ${cat.label}`.trim()}>
                    {cat.children.map((child) => (
                      <option key={child.slug} value={child.slug}>
                        {child.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={cat.slug} value={cat.slug}>
                    {`${cat.icon ?? ''} ${cat.label}`.trim()}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Arquivo *</label>
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.xml,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.zip,.txt,.ofx"
            className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
          />
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
          {saving ? 'Enviando...' : 'Enviar'}
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
