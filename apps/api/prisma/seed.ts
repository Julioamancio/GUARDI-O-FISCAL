/**
 * Seed inicial — idempotente (pode rodar mais de uma vez sem duplicar).
 * Cria: permissões, papéis do sistema, planos, superadmin e tenant de demonstração.
 * Credenciais do superadmin vêm de SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { nationalHolidays } from '@guardiao/shared';

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

  // Feriados nacionais (globais, tenantId NULL) — base do cálculo de dias úteis
  for (const year of [2025, 2026, 2027, 2028]) {
    for (const holiday of nationalHolidays(year)) {
      const date = new Date(`${holiday.date}T00:00:00.000Z`);
      const exists = await prisma.holiday.findFirst({
        where: { tenantId: null, date, scope: 'NACIONAL' },
      });
      if (!exists) {
        await prisma.holiday.create({
          data: { tenantId: null, date, name: holiday.name, scope: 'NACIONAL' },
        });
      }
    }
  }
  console.log('Feriados nacionais 2025–2028 verificados.');

  // Catálogo global de templates de obrigações.
  // ATENÇÃO: vencimentos estaduais/municipais variam — os templates marcam isso
  // em `notes` e a regra é ajustável por obrigação. Validar com contador (req. 37.10).
  const TEMPLATES: Array<{
    slug: string;
    name: string;
    department: 'FISCAL' | 'CONTABIL' | 'PESSOAL';
    sphere: 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL' | 'TRABALHISTA' | 'PREVIDENCIARIA';
    periodicity: 'MENSAL' | 'ANUAL';
    anchorMonth?: number;
    dueRule: Prisma.InputJsonValue;
    regimes: Array<'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' | 'MEI'>;
    defaultPriority: 'MEDIA' | 'ALTA' | 'CRITICA';
    notes?: string;
  }> = [
    {
      slug: 'das-simples-nacional',
      name: 'DAS — Simples Nacional',
      department: 'FISCAL', sphere: 'FEDERAL', periodicity: 'MENSAL',
      dueRule: { day: 20, monthOffset: 1, adjustment: 'POSTPONE' },
      regimes: ['SIMPLES_NACIONAL', 'MEI'], defaultPriority: 'ALTA',
      notes: 'Dia 20 do mês seguinte; prorroga para o dia útil seguinte (Res. CGSN 140/2018).',
    },
    {
      slug: 'fgts-mensal',
      name: 'FGTS — recolhimento mensal',
      department: 'PESSOAL', sphere: 'TRABALHISTA', periodicity: 'MENSAL',
      dueRule: { day: 20, monthOffset: 1, adjustment: 'ANTICIPATE' },
      regimes: ['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL'], defaultPriority: 'ALTA',
      notes: 'Até o dia 20 do mês seguinte; antecipa quando não for dia útil (Lei 14.438/2022).',
    },
    {
      slug: 'dctfweb-mensal',
      name: 'DCTFWeb — declaração mensal',
      department: 'FISCAL', sphere: 'FEDERAL', periodicity: 'MENSAL',
      dueRule: { day: 25, monthOffset: 1, adjustment: 'ANTICIPATE' },
      regimes: ['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL'], defaultPriority: 'ALTA',
      notes: 'Até o dia 25 do mês seguinte; antecipa em dia não útil.',
    },
    {
      slug: 'irrf-darf-mensal',
      name: 'IRRF — DARF mensal',
      department: 'FISCAL', sphere: 'FEDERAL', periodicity: 'MENSAL',
      dueRule: { day: 20, monthOffset: 1, adjustment: 'ANTICIPATE' },
      regimes: ['LUCRO_PRESUMIDO', 'LUCRO_REAL', 'SIMPLES_NACIONAL'], defaultPriority: 'MEDIA',
      notes: 'Regra geral: até o dia 20 do mês seguinte ao fato gerador; antecipa.',
    },
    {
      slug: 'efd-contribuicoes',
      name: 'EFD-Contribuições',
      department: 'FISCAL', sphere: 'FEDERAL', periodicity: 'MENSAL',
      dueRule: { businessDay: 10, monthOffset: 2, adjustment: 'NONE' },
      regimes: ['LUCRO_PRESUMIDO', 'LUCRO_REAL'], defaultPriority: 'MEDIA',
      notes: '10º dia útil do 2º mês subsequente à competência.',
    },
    {
      slug: 'esocial-folha',
      name: 'eSocial — fechamento da folha',
      department: 'PESSOAL', sphere: 'TRABALHISTA', periodicity: 'MENSAL',
      dueRule: { day: 15, monthOffset: 1, adjustment: 'ANTICIPATE' },
      regimes: ['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL'], defaultPriority: 'ALTA',
      notes: 'Eventos periódicos até o dia 15 do mês seguinte; antecipa.',
    },
    {
      slug: 'icms-apuracao',
      name: 'ICMS — apuração e recolhimento',
      department: 'FISCAL', sphere: 'ESTADUAL', periodicity: 'MENSAL',
      dueRule: { day: 20, monthOffset: 1, adjustment: 'ANTICIPATE' },
      regimes: ['LUCRO_PRESUMIDO', 'LUCRO_REAL'], defaultPriority: 'ALTA',
      notes: 'ATENÇÃO: o vencimento varia por UF/CNAE — ajuste a regra ao criar a obrigação.',
    },
    {
      slug: 'iss-mensal',
      name: 'ISS — recolhimento mensal',
      department: 'FISCAL', sphere: 'MUNICIPAL', periodicity: 'MENSAL',
      dueRule: { day: 10, monthOffset: 1, adjustment: 'POSTPONE' },
      regimes: ['LUCRO_PRESUMIDO', 'LUCRO_REAL', 'SIMPLES_NACIONAL'], defaultPriority: 'MEDIA',
      notes: 'ATENÇÃO: o vencimento varia por município — ajuste a regra ao criar a obrigação.',
    },
    {
      slug: 'defis-anual',
      name: 'DEFIS — declaração anual do Simples',
      department: 'CONTABIL', sphere: 'FEDERAL', periodicity: 'ANUAL', anchorMonth: 12,
      dueRule: { day: 31, monthOffset: 3, adjustment: 'NONE' },
      regimes: ['SIMPLES_NACIONAL'], defaultPriority: 'ALTA',
      notes: 'Competência = dezembro do ano-base; entrega até 31/03 do ano seguinte.',
    },
    {
      slug: 'ecf-anual',
      name: 'ECF — Escrituração Contábil Fiscal',
      department: 'CONTABIL', sphere: 'FEDERAL', periodicity: 'ANUAL', anchorMonth: 12,
      dueRule: { day: 'LAST_BUSINESS_DAY', monthOffset: 7, adjustment: 'NONE' },
      regimes: ['LUCRO_PRESUMIDO', 'LUCRO_REAL'], defaultPriority: 'ALTA',
      notes: 'Até o último dia útil de julho do ano seguinte ao ano-base.',
    },
  ];

  for (const t of TEMPLATES) {
    await prisma.obligationTemplate.upsert({
      where: { slug: t.slug },
      update: { name: t.name, notes: t.notes, dueRule: t.dueRule },
      create: {
        slug: t.slug,
        name: t.name,
        tenantId: null,
        department: t.department,
        sphere: t.sphere,
        periodicity: t.periodicity,
        anchorMonth: t.anchorMonth ?? 1,
        dueRule: t.dueRule,
        regimes: t.regimes,
        defaultPriority: t.defaultPriority,
        notes: t.notes,
      },
    });
  }
  console.log(`Catálogo de templates de obrigações: ${TEMPLATES.length} verificados.`);

  console.log('Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
