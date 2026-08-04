'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { clientApi } from '@/lib/client-api';

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export function NewCompanyForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const value = (k: string) => {
      const v = String(form.get(k) ?? '').trim();
      return v === '' ? undefined : v;
    };
    try {
      await clientApi('/companies', {
        method: 'POST',
        body: JSON.stringify({
          razaoSocial: value('razaoSocial'),
          nomeFantasia: value('nomeFantasia'),
          cnpj: value('cnpj'),
          regimeTributario: value('regimeTributario'),
          uf: value('uf'),
          municipio: value('municipio'),
          email: value('email'),
          phone: value('phone'),
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
        className="mb-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        + Nova empresa
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-gray-800">Nova empresa</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">Razão social *</label>
          <input name="razaoSocial" required maxLength={200} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Nome fantasia</label>
          <input name="nomeFantasia" maxLength={200} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">CNPJ *</label>
          <input name="cnpj" required placeholder="00.000.000/0000-00" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Regime tributário</label>
          <select name="regimeTributario" className={input} defaultValue="">
            <option value="">Selecionar...</option>
            <option value="SIMPLES_NACIONAL">Simples Nacional</option>
            <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
            <option value="LUCRO_REAL">Lucro Real</option>
            <option value="MEI">MEI</option>
            <option value="IMUNE_ISENTA">Imune/Isenta</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">UF</label>
            <input name="uf" maxLength={2} placeholder="SP" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Município</label>
            <input name="municipio" maxLength={120} className={input} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">E-mail do cliente</label>
          <input name="email" type="email" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Telefone</label>
          <input name="phone" maxLength={20} className={input} />
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
          {saving ? 'Salvando...' : 'Cadastrar'}
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
