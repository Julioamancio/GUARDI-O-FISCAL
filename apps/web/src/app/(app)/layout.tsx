import { redirect } from 'next/navigation';
import { apiFetch, UnauthorizedError } from '@/lib/api';
import { Nav } from './nav';
import { Footer } from '../footer';

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
    <div className="flex min-h-screen flex-col">
      <Nav
        userName={me.name}
        tenantName={me.tenant?.razaoSocial ?? 'Administração da Plataforma'}
        isSuperadmin={me.tenantId === null}
        isClient={me.roles.includes('client')}
        canManageUsers={me.permissions.includes('users.manage')}
      />
      <main className="w-full flex-1 px-8 py-6">{children}</main>
      <Footer />
    </div>
  );
}
