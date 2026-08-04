'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { clientApi } from '@/lib/client-api';

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export interface SimpleUser {
  id: string;
  name: string;
  email: string;
  roles: Array<{ role: { slug: string } }>;
}

const AREAS = [
  { value: 'FISCAL', label: 'Fiscal' },
  { value: 'CONTABIL', label: 'Contábil' },
  { value: 'PESSOAL', label: 'Dep. pessoal' },
  { value: 'FINANCEIRO', label: 'Financeiro' },
  { value: 'INTERNO', label: 'Interno' },
];

/** Edição dos dados da empresa (colapsável no topo do detalhe). */
export function EditCompanyForm({
  company,
}: {
  company: {
    id: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    email: string | null;
    phone: string | null;
    regimeTributario: string | null;
    uf: string | null;
    municipio: string | null;
    riskLevel: string;
    status: string;
    observacoes: string | null;
  };
}) {
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
      await clientApi(`/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          razaoSocial: value('razaoSocial'),
          nomeFantasia: value('nomeFantasia'),
          email: value('email'),
          phone: value('phone'),
          regimeTributario: value('regimeTributario'),
          uf: value('uf'),
          municipio: value('municipio'),
          riskLevel: value('riskLevel'),
          status: value('status'),
          observacoes: String(form.get('observacoes') ?? '').trim() || undefined,
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
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
      >
        ✏️ Editar dados
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-bold text-gray-900">Editar empresa</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">Razão social *</label>
            <input name="razaoSocial" defaultValue={company.razaoSocial} required className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Nome fantasia</label>
            <input name="nomeFantasia" defaultValue={company.nomeFantasia ?? ''} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Regime tributário</label>
            <select name="regimeTributario" defaultValue={company.regimeTributario ?? ''} className={input}>
              <option value="">Selecionar...</option>
              <option value="SIMPLES_NACIONAL">Simples Nacional</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              <option value="LUCRO_REAL">Lucro Real</option>
              <option value="MEI">MEI</option>
              <option value="IMUNE_ISENTA">Imune/Isenta</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">E-mail do cliente</label>
            <input name="email" type="email" defaultValue={company.email ?? ''} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Telefone</label>
            <input name="phone" defaultValue={company.phone ?? ''} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">UF</label>
              <input name="uf" maxLength={2} defaultValue={company.uf ?? ''} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Município</label>
              <input name="municipio" defaultValue={company.municipio ?? ''} className={input} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Risco</label>
              <select name="riskLevel" defaultValue={company.riskLevel} className={input}>
                <option value="LOW">Baixo</option>
                <option value="MEDIUM">Médio</option>
                <option value="HIGH">Alto</option>
                <option value="CRITICAL">Crítico</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Situação</label>
              <select name="status" defaultValue={company.status} className={input}>
                <option value="ACTIVE">Ativa</option>
                <option value="INACTIVE">Inativa</option>
                <option value="SUSPENDED">Suspensa</option>
              </select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500">Observações</label>
            <textarea name="observacoes" rows={3} defaultValue={company.observacoes ?? ''} className={input} />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
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
    </div>
  );
}

/** Contatos do cliente: adicionar e remover. */
export function ContactsManager({
  companyId,
  contacts,
}: {
  companyId: string;
  contacts: Array<{ id: string; name: string; email: string | null; phone: string | null; role: string | null }>;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await clientApi(`/companies/${companyId}/contacts`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          email: String(form.get('email') ?? '').trim() || undefined,
          phone: String(form.get('phone') ?? '').trim() || undefined,
          role: String(form.get('role') ?? '').trim() || undefined,
        }),
      });
      setAdding(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(contactId: string) {
    setBusy(true);
    try {
      await clientApi(`/companies/${companyId}/contacts/${contactId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {contacts.length === 0 && !adding && (
        <p className="text-sm text-gray-500">Nenhum contato cadastrado.</p>
      )}
      <ul className="space-y-2 text-sm">
        {contacts.map((contact) => (
          <li key={contact.id} className="flex items-start justify-between gap-2">
            <span>
              <span className="font-medium text-gray-800">{contact.name}</span>
              {contact.role && <span className="text-gray-500"> · {contact.role}</span>}
              <span className="block text-xs text-gray-500">
                {[contact.email, contact.phone].filter(Boolean).join(' · ')}
              </span>
            </span>
            <button
              onClick={() => remove(contact.id)}
              disabled={busy}
              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
              title="Remover contato"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <form onSubmit={add} className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
          <input name="name" required placeholder="Nome *" className={input} />
          <div className="grid grid-cols-2 gap-2">
            <input name="email" type="email" placeholder="E-mail" className={input} />
            <input name="phone" placeholder="Telefone" className={input} />
          </div>
          <input name="role" placeholder="Função (ex.: sócio, financeiro)" className={input} />
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Adicionar
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-500">
              cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 text-xs font-semibold text-brand-700 hover:underline"
        >
          + adicionar contato
        </button>
      )}
    </div>
  );
}

/** Responsáveis por área (um por área; substitui o anterior). */
export function ResponsiblesManager({
  companyId,
  responsibles,
  staff,
}: {
  companyId: string;
  responsibles: Array<{ id: string; area: string; user: { id: string; name: string } }>;
  staff: SimpleUser[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setResponsible(area: string, userId: string) {
    if (!userId) return;
    setBusy(true);
    try {
      await clientApi(`/companies/${companyId}/responsibles`, {
        method: 'POST',
        body: JSON.stringify({ area, userId }),
      });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(area: string) {
    setBusy(true);
    try {
      await clientApi(`/companies/${companyId}/responsibles/${area}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ul className="space-y-2 text-sm">
      {AREAS.map((area) => {
        const current = responsibles.find((r) => r.area === area.value);
        return (
          <li key={area.value} className="flex items-center justify-between gap-2">
            <span className="w-28 shrink-0 text-gray-500">{area.label}</span>
            <select
              value={current?.user.id ?? ''}
              onChange={(e) => setResponsible(area.value, e.target.value)}
              disabled={busy || staff.length === 0}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs disabled:opacity-50"
            >
              <option value="">— sem responsável —</option>
              {staff.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            {current && (
              <button
                onClick={() => remove(area.value)}
                disabled={busy}
                className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                title="Remover responsável"
              >
                ✕
              </button>
            )}
          </li>
        );
      })}
      {staff.length === 0 && (
        <p className="text-xs text-gray-400">Cadastre a equipe na aba Equipe para atribuir responsáveis.</p>
      )}
    </ul>
  );
}

/** Acesso do cliente ao portal: vincular/desvincular usuários com papel cliente. */
export function PortalAccessManager({
  companyId,
  accesses,
  clientUsers,
}: {
  companyId: string;
  accesses: Array<{ id: string; user: { id: string; name: string; email: string; isActive: boolean } }>;
  clientUsers: SimpleUser[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const linkedIds = new Set(accesses.map((a) => a.user.id));
  const available = clientUsers.filter((u) => !linkedIds.has(u.id));

  async function link(userId: string) {
    if (!userId) return;
    setBusy(true);
    try {
      await clientApi(`/companies/${companyId}/clients/${userId}`, { method: 'POST' });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function unlink(userId: string) {
    setBusy(true);
    try {
      await clientApi(`/companies/${companyId}/clients/${userId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {accesses.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum cliente com acesso ao portal desta empresa.</p>
      )}
      <ul className="space-y-2 text-sm">
        {accesses.map((access) => (
          <li key={access.id} className="flex items-center justify-between gap-2">
            <span>
              <span className="font-medium text-gray-800">{access.user.name}</span>
              <span className="block text-xs text-gray-500">{access.user.email}</span>
            </span>
            <button
              onClick={() => unlink(access.user.id)}
              disabled={busy}
              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
              title="Remover acesso"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {available.length > 0 ? (
        <select
          defaultValue=""
          onChange={(e) => link(e.target.value)}
          disabled={busy}
          className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:opacity-50"
        >
          <option value="" disabled>
            + vincular cliente ao portal...
          </option>
          {available.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.email})
            </option>
          ))}
        </select>
      ) : (
        clientUsers.length === 0 && (
          <p className="mt-2 text-xs text-gray-400">
            Crie o usuário do cliente na aba Equipe (papel "Cliente (portal)") e vincule aqui.
          </p>
        )
      )}
    </div>
  );
}
