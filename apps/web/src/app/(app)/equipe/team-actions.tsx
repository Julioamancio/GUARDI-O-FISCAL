'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { clientApi } from '@/lib/client-api';

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

const ROLES = [
  { value: 'accountant', label: 'Contador' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'tenant_admin', label: 'Administrador' },
  { value: 'client', label: 'Cliente (portal)' },
];

export function NewUserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    try {
      await clientApi('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          email,
          password: form.get('password'),
          role: form.get('role'),
        }),
      });
      setCreated(email);
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
        <p className="font-semibold">✓ Usuário criado!</p>
        <p className="mt-1">
          Entregue a ele: escritório (o mesmo código que você usa), e-mail <strong>{created}</strong>{' '}
          e a senha definida. Oriente a trocá-la no primeiro acesso (nome no topo → Trocar senha).
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
        + Novo usuário
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-gray-800">Novo usuário</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Nome *</label>
          <input name="name" required maxLength={120} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">E-mail *</label>
          <input name="email" type="email" required className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Senha inicial *</label>
          <input
            name="password"
            type="password"
            required
            minLength={10}
            placeholder="10+ caracteres, Aa1"
            className={input}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Papel *</label>
          <select name="role" required defaultValue="accountant" className={input}>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
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
          {saving ? 'Criando...' : 'Criar usuário'}
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

export function RoleSelect({ userId, current }: { userId: string; current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(role: string) {
    if (role === current) return;
    setBusy(true);
    try {
      await clientApi(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      disabled={busy}
      className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs disabled:opacity-50"
    >
      {ROLES.map((role) => (
        <option key={role.value} value={role.value}>
          {role.label}
        </option>
      ))}
    </select>
  );
}

export function ActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await clientApi(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !active }),
      });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
        active
          ? 'bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-700'
          : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700'
      }`}
      title={active ? 'Clique para desativar (derruba as sessões)' : 'Clique para reativar'}
    >
      {busy ? '...' : active ? 'Ativo' : 'Inativo'}
    </button>
  );
}
