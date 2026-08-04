import { redirect } from 'next/navigation';
import { apiFetch, UnauthorizedError } from '@/lib/api';
import { Nav } from './nav';

export interface Me {
  id: string;
  name: string;
  email: string;
  tenantId: string | null;
  roles: string[];
  permissions: string[];
  tenant: { slug: string; razaoSocial: string; logoUrl: string | null; primaryColor: string | null } | null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let me: Me;
  try {
    me = await apiFetch<Me>('/auth/me');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/login');
    throw error;
  }

  return (
    <div className="min-h-screen">
      <Nav
        userName={me.name}
        tenantName={me.tenant?.razaoSocial ?? 'Administração da Plataforma'}
        isSuperadmin={me.tenantId === null}
      />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
