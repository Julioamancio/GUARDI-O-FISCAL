'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { clientApi } from '@/lib/client-api';

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** Criação de escritório pelo superadmin (tela do fluxo POST /admin/tenants). */
export function NewTenantForm({ plans }: { plans: Array<{ slug: string; name: string; maxCompanies: number }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ slug: string; adminEmail: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const adminEmail = String(form.get('adminEmail'));
    try {
      await clientApi('/admin/tenants', {
        method: 'POST',
        body: JSON.stringify({
          razaoSocial: form.get('razaoSocial'),
          slug,
          email: form.get('email'),
          planSlug: form.get('planSlug'),
          admin: {
            name: form.get('adminName'),
            email: adminEmail,
            password: form.get('adminPassword'),
          },
        }),
      });
      setCreated({ slug, adminEmail });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <p className="font-semibold">✓ Escritório criado!</p>
        <p className="mt-1">
          O administrador entra na tela de login com escritório <strong>{created.slug}</strong>,
          e-mail <strong>{created.adminEmail}</strong> e a senha definida (14 dias de teste ativados).
        </p>
        <button onClick={() => setCreated(null)} className="mt-2 text-xs underline">
          fechar
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        + Criar escritório
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="mb-1 font-semibold text-gray-800">Novo escritório (tenant)</h2>
      <p className="mb-4 text-xs text-gray-500">
        Cria o escritório com 14 dias de teste e o administrador inicial, que poderá cadastrar a
        própria equipe, empresas e clientes.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Razão social *</label>
          <input
            name="razaoSocial"
            required
            maxLength={200}
            className={input}
            onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Identificador (login/subdomínio) *
          </label>
          <input
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
            minLength={3}
            className={`${input} font-mono`}
            placeholder="ex.: contabil-silva"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">E-mail do escritório *</label>
          <input name="email" type="email" required className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Plano *</label>
          <select name="planSlug" required className={input} defaultValue="escritorio-pequeno">
            {plans.map((plan) => (
              <option key={plan.slug} value={plan.slug}>
                {plan.name} (até {plan.maxCompanies} empresas)
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase text-gray-500">Administrador inicial</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Nome *</label>
          <input name="adminName" required maxLength={120} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">E-mail *</label>
          <input name="adminEmail" type="email" required className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Senha *</label>
          <input
            name="adminPassword"
            type="password"
            required
            minLength={10}
            className={input}
            placeholder="10+ caracteres, Aa1"
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
          {saving ? 'Criando...' : 'Criar escritório'}
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
