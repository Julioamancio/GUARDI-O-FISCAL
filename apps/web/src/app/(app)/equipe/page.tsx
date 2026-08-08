import { apiFetch } from '@/lib/api';
import {
  NewUserForm,
  RoleSelect,
  ActiveToggle,
  EditUserButton,
  DeleteUserButton,
} from './team-actions';

interface TeamUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ role: { slug: string; name: string } }>;
}

interface Me {
  id: string;
  roles: string[];
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'nunca entrou';

export default async function EquipePage() {
  const [data, me] = await Promise.all([
    apiFetch<{ items: TeamUser[]; total: number }>('/users?perPage=100'),
    apiFetch<Me>('/auth/me'),
  ]);
  const isAdmin = me.roles.includes('tenant_admin') || me.roles.includes('superadmin');

  const team = data.items.filter((u) => !u.roles.some((r) => r.role.slug === 'client'));
  const clients = data.items.filter((u) => u.roles.some((r) => r.role.slug === 'client'));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Equipe e acessos</h1>
        <span className="text-sm text-gray-500">{data.total} usuário(s)</span>
      </div>

      <NewUserForm isAdmin={isAdmin} />

      <Section
        title="Equipe do escritório"
        users={team}
        empty="Nenhum funcionário além de você."
        canManage={isAdmin}
        meId={me.id}
      />
      <Section
        title="Clientes com acesso ao portal"
        users={clients}
        empty="Nenhum cliente ainda — importe a planilha de empresas (o acesso é criado sozinho) ou crie com o papel “Cliente (portal)”."
        canManage
        meId={me.id}
      />

      <p className="mt-4 text-xs text-gray-400">
        💡 O cliente só enxerga as empresas às quais foi vinculado. Na importação por planilha o
        vínculo é automático; para os demais, faça no detalhe de cada empresa, seção “Acesso ao
        portal”.
      </p>
    </div>
  );
}

function Section({
  title,
  users,
  empty,
  canManage,
  meId,
}: {
  title: string;
  users: TeamUser[];
  empty: string;
  canManage: boolean;
  meId: string;
}) {
  return (
    <section className="mb-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <h2 className="border-b border-gray-100 px-4 py-3 font-semibold text-gray-800">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <th className="px-4 py-2.5">Nome</th>
            <th className="px-4 py-2.5">E-mail</th>
            <th className="px-4 py-2.5">Papel</th>
            <th className="px-4 py-2.5">Último acesso</th>
            <th className="px-4 py-2.5">Acesso</th>
            <th className="px-4 py-2.5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                {empty}
              </td>
            </tr>
          )}
          {users.map((user) => (
            <tr key={user.id} className="border-b border-gray-50 last:border-0">
              <td className="px-4 py-3 font-medium text-gray-800">{user.name}</td>
              <td className="px-4 py-3 text-gray-600">{user.email}</td>
              <td className="px-4 py-3">
                {canManage ? (
                  <RoleSelect
                    userId={user.id}
                    userName={user.name}
                    current={user.roles[0]?.role.slug ?? 'accountant'}
                  />
                ) : (
                  <span className="text-xs text-gray-600">{user.roles[0]?.role.name ?? '—'}</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{fmt(user.lastLoginAt)}</td>
              <td className="px-4 py-3">
                {canManage && user.id !== meId ? (
                  <ActiveToggle userId={user.id} userName={user.name} active={user.isActive} />
                ) : (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      user.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {user.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {canManage && (
                  <span className="inline-flex gap-1.5">
                    <EditUserButton userId={user.id} userName={user.name} userEmail={user.email} />
                    {user.id !== meId && (
                      <DeleteUserButton userId={user.id} userName={user.name} userEmail={user.email} />
                    )}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
