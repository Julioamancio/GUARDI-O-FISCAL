/**
 * Seed inicial — idempotente (pode rodar mais de uma vez sem duplicar).
 * Cria: permissões, papéis do sistema, planos, superadmin e tenant de demonstração.
 * Credenciais do superadmin vêm de SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const PERMISSIONS: Array<[string, string]> = [
  ['tenants.manage', 'Administrar escritórios (superadmin)'],
  ['plans.manage', 'Administrar planos (superadmin)'],
  ['users.manage', 'Gerenciar usuários do escritório'],
  ['companies.read', 'Visualizar empresas'],
  ['companies.write', 'Cadastrar e editar empresas'],
  ['tasks.read', 'Visualizar tarefas'],
  ['tasks.write', 'Executar e concluir tarefas'],
  ['tasks.approve', 'Aprovar ou reprovar fechamentos'],
  ['documents.read', 'Visualizar documentos'],
  ['documents.write', 'Enviar e gerenciar documentos'],
  ['documents.request', 'Solicitar documentos a clientes'],
  ['reports.read', 'Visualizar e exportar relatórios'],
  ['audit.read', 'Consultar logs de auditoria'],
  ['settings.manage', 'Configurar o escritório (marca, integrações, permissões)'],
];

const ROLES: Array<{ slug: string; name: string; permissions: string[] | 'ALL' }> = [
  { slug: 'superadmin', name: 'Superadministrador da Plataforma', permissions: 'ALL' },
  {
    slug: 'tenant_admin',
    name: 'Administrador do Escritório',
    permissions: [
      'users.manage', 'companies.read', 'companies.write', 'tasks.read', 'tasks.write',
      'tasks.approve', 'documents.read', 'documents.write', 'documents.request',
      'reports.read', 'audit.read', 'settings.manage',
    ],
  },
  {
    slug: 'accountant',
    name: 'Contador / Analista',
    permissions: [
      'companies.read', 'tasks.read', 'tasks.write', 'documents.read',
      'documents.write', 'documents.request', 'reports.read',
    ],
  },
  { slug: 'client', name: 'Cliente do Escritório', permissions: ['documents.read', 'documents.write'] },
  {
    slug: 'auditor',
    name: 'Auditor / Supervisor',
    permissions: ['companies.read', 'tasks.read', 'tasks.approve', 'documents.read', 'reports.read', 'audit.read'],
  },
];

const PLANS = [
  { slug: 'contador-individual', name: 'Contador Individual', maxCompanies: 30, maxUsers: 3, storageMb: 10_240, priceCents: 9700 },
  { slug: 'escritorio-pequeno', name: 'Escritório Pequeno', maxCompanies: 100, maxUsers: 10, storageMb: 51_200, priceCents: 24700 },
  { slug: 'escritorio-profissional', name: 'Escritório Profissional', maxCompanies: 300, maxUsers: 30, storageMb: 204_800, priceCents: 49700 },
  { slug: 'enterprise', name: 'Enterprise', maxCompanies: 10_000, maxUsers: 500, storageMb: 1_048_576, priceCents: 0 },
];

async function main() {
  // Permissões
  for (const [slug, description] of PERMISSIONS) {
    await prisma.permission.upsert({ where: { slug }, update: { description }, create: { slug, description } });
  }

  // Papéis + vínculo com permissões
  const allPerms = await prisma.permission.findMany();
  for (const role of ROLES) {
    const created = await prisma.role.upsert({
      where: { slug: role.slug },
      update: { name: role.name },
      create: { slug: role.slug, name: role.name, isSystem: true },
    });
    const slugs = role.permissions === 'ALL' ? allPerms.map((p) => p.slug) : role.permissions;
    for (const permSlug of slugs) {
      const perm = allPerms.find((p) => p.slug === permSlug);
      if (!perm) throw new Error(`Permissão não encontrada no seed: ${permSlug}`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: created.id, permissionId: perm.id } },
        update: {},
        create: { roleId: created.id, permissionId: perm.id },
      });
    }
  }

  // Planos
  for (const plan of PLANS) {
    await prisma.plan.upsert({ where: { slug: plan.slug }, update: {}, create: plan });
  }

  // Superadmin
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Defina SEED_SUPERADMIN_EMAIL e SEED_SUPERADMIN_PASSWORD no .env');
  }
  const superadminRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'superadmin' } });
  const existing = await prisma.user.findFirst({ where: { tenantId: null, email } });
  if (!existing) {
    const user = await prisma.user.create({
      data: { tenantId: null, name: 'Superadministrador', email, passwordHash: await argon2.hash(password) },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: superadminRole.id } });
    console.log(`Superadmin criado: ${email}`);
  } else {
    console.log('Superadmin já existe — mantido.');
  }

  console.log('Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
