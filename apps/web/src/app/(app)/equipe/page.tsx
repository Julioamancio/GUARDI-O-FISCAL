import { apiFetch } from '@/lib/api';
import { NewUserForm, RoleSelect, ActiveToggle } from './team-actions';

interface TeamUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ role: { slug: string; name: string } }>;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'nunca entrou';

export default async function EquipePage() {
  const data = await apiFetch<{ items: TeamUser[]; total: number }>('/users?perPage=100');

  const team = data.items.filter((u) => !u.roles.some((r) => r.role.slug === 'client'));
  const clients = data.items.filter((u) => u.roles.some((r) => r.role.slug === 'client'));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Equipe e acessos</h1>
        <span className="text-sm text-gray-500">{data.total} usuário(s)</span>
      </div>

      <NewUserForm />

      <Section title="Equipe do escritório" users={team} empty="Nenhum funcionário além de você." />
      <Section
        title="Clientes com acesso ao portal"
        users={clients}
        empty="Nenhum cliente ainda — crie com o papel “Cliente (portal)” e depois vincule às empresas dele na tela da empresa."
      />

      <p className="mt-4 text-xs text-gray-400">
        💡 O cliente só enxerga as empresas às quais foi vinculado — faça o vínculo no detalhe de
        cada empresa, na seção “Acesso ao portal”.
      </p>
    </div>
  );
}

function Section({ title, users, empty }: { title: string; users: TeamUser[]; empty: string }) {
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
            <th className="px-4 py-2.5 text-right">Acesso</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                {empty}
              </td>
            </tr>
          )}
          {users.map((user) => (
            <tr key={user.id} className="border-b border-gray-50 last:border-0">
              <td className="px-4 py-3 font-medium text-gray-800">{user.name}</td>
              <td className="px-4 py-3 text-gray-600">{user.email}</td>
              <td className="px-4 py-3">
                <RoleSelect userId={user.id} current={user.roles[0]?.role.slug ?? 'accountant'} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{fmt(user.lastLoginAt)}</td>
              <td className="px-4 py-3 text-right">
                <ActiveToggle userId={user.id} active={user.isActive} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
