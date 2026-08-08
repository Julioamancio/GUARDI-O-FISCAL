'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useState } from 'react';
import { clientApi } from '@/lib/client-api';

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

const ALL_ROLES = [
  { value: 'accountant', label: 'Contador' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'tenant_admin', label: 'Administrador' },
  { value: 'client', label: 'Cliente (portal)' },
];

/**
 * Confirmação em duas etapas: toda ação sensível (excluir, mudar papel,
 * ativar/desativar) abre este diálogo antes de executar de verdade.
 */
function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className={`text-lg font-bold ${danger ? 'text-red-700' : 'text-gray-900'}`}>{title}</h3>
        <div className="mt-2 text-sm text-gray-600">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {busy ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewUserForm({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Contador só cadastra clientes do portal; os demais papéis são do admin
  const roles = isAdmin ? ALL_ROLES : ALL_ROLES.filter((r) => r.value === 'client');

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
          Entregue a ele o e-mail <strong>{created}</strong> e a senha definida — é só isso que ele
          precisa para entrar. Oriente a trocá-la no primeiro acesso (nome no topo → Trocar senha).
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
          <select name="role" required defaultValue={roles[0]?.value} className={input}>
            {roles.map((role) => (
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

export function RoleSelect({ userId, userName, current }: { userId: string; userName: string; current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  async function confirmChange() {
    if (!pending) return;
    setBusy(true);
    try {
      await clientApi(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ role: pending }) });
      setPending(null);
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const label = (slug: string | null) => ALL_ROLES.find((r) => r.value === slug)?.label ?? slug;

  return (
    <>
      <select
        value={current}
        onChange={(e) => e.target.value !== current && setPending(e.target.value)}
        disabled={busy}
        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs disabled:opacity-50"
      >
        {ALL_ROLES.map((role) => (
          <option key={role.value} value={role.value}>
            {role.label}
          </option>
        ))}
      </select>
      {pending && (
        <ConfirmDialog
          title="Mudar papel?"
          confirmLabel="Sim, mudar papel"
          busy={busy}
          onConfirm={confirmChange}
          onCancel={() => setPending(null)}
        >
          <p>
            Mudar o papel de <strong>{userName}</strong> de <strong>{label(current)}</strong> para{' '}
            <strong>{label(pending)}</strong>? Isso altera imediatamente o que essa pessoa pode ver
            e fazer no sistema.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

export function ActiveToggle({ userId, userName, active }: { userId: string; userName: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await clientApi(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !active }),
      });
      setConfirming(false);
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        disabled={busy}
        className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
          active
            ? 'bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-700'
            : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700'
        }`}
        title={active ? 'Desativar acesso' : 'Reativar acesso'}
      >
        {active ? 'Ativo' : 'Inativo'}
      </button>
      {confirming && (
        <ConfirmDialog
          title={active ? 'Desativar acesso?' : 'Reativar acesso?'}
          confirmLabel={active ? 'Sim, desativar' : 'Sim, reativar'}
          danger={active}
          busy={busy}
          onConfirm={toggle}
          onCancel={() => setConfirming(false)}
        >
          {active ? (
            <p>
              <strong>{userName}</strong> perderá o acesso imediatamente e as sessões abertas serão
              derrubadas. Nada é apagado — dá para reativar depois.
            </p>
          ) : (
            <p>
              <strong>{userName}</strong> voltará a conseguir entrar no sistema com o mesmo e-mail e
              senha de antes.
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

export function EditUserButton({ userId, userName, userEmail }: { userId: string; userName: string; userEmail: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(userEmail);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await clientApi(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, email }),
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setName(userName);
          setEmail(userEmail);
          setError(null);
          setOpen(true);
        }}
        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-brand-500 hover:text-brand-700"
        title="Editar nome e e-mail"
      >
        ✏️ Editar
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Editar usuário</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">E-mail (login)</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className={input} />
                <p className="mt-1 text-xs text-gray-400">
                  Atenção: mudar o e-mail muda o login que a pessoa usa para entrar.
                </p>
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function DeleteUserButton({ userId, userName, userEmail }: { userId: string; userName: string; userEmail: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await clientApi(`/users/${userId}`, { method: 'DELETE' });
      setConfirming(false);
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:border-red-500 hover:bg-red-50"
        title="Excluir usuário"
      >
        🗑️ Excluir
      </button>
      {confirming && (
        <ConfirmDialog
          title="Excluir usuário?"
          confirmLabel="Sim, excluir definitivamente"
          danger
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        >
          <p>
            Você está prestes a excluir <strong>{userName}</strong> ({userEmail}). A pessoa perde o
            acesso na hora e some das listas. Os registros do histórico (linha do tempo, auditoria)
            são preservados.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
