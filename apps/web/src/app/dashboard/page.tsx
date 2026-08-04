import { redirect } from 'next/navigation';
import { apiFetch, UnauthorizedError } from '@/lib/api';
import { LogoutButton } from './logout-button';

interface Me {
  id: string;
  name: string;
  email: string;
  tenantId: string | null;
  roles: string[];
  permissions: string[];
  tenant: { slug: string; razaoSocial: string; logoUrl: string | null } | null;
}

export default async function DashboardPage() {
  let me: Me;
  try {
    me = await apiFetch<Me>('/auth/me');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/login');
    throw error;
  }

  const isSuperadmin = me.tenantId === null;

  // Os indicadores reais (tarefas, obrigações, documentos) entram nas Fases 2–4,
  // quando os módulos correspondentes existirem na API.
  const upcoming = [
    { label: 'Empresas ativas', phase: 'Fase 2' },
    { label: 'Tarefas pendentes', phase: 'Fase 2' },
    { label: 'Obrigações próximas do vencimento', phase: 'Fase 2' },
    { label: 'Documentos aguardados', phase: 'Fase 3' },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">
            {isSuperadmin ? 'Administração da Plataforma' : (me.tenant?.razaoSocial ?? 'Dashboard')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Olá, {me.name} · {me.roles.join(', ')}
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {upcoming.map((item) => (
          <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-300">—</p>
            <p className="mt-1 text-xs text-gray-400">disponível na {item.phase}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-xl border border-brand-100 bg-brand-50 p-5">
        <h2 className="font-semibold text-brand-900">Fase 1 concluída — fundação da plataforma</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-brand-700">
          <li>Autenticação segura com sessão renovável e revogável</li>
          <li>Isolamento total entre escritórios (multi-tenant)</li>
          <li>Papéis e permissões por usuário</li>
          <li>Trilha de auditoria de todas as ações</li>
        </ul>
      </section>
    </main>
  );
}
