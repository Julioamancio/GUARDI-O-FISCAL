/**
 * Fluxo completo da Fase 2: empresa -> obrigação (template do catálogo) ->
 * geração de tarefas recorrentes -> execução -> isolamento entre tenants.
 * Pré-requisito: banco migrado + seed (templates e feriados).
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Fase 2 — núcleo operacional (e2e)', () => {
  let app: NestExpressApplication;
  let adminC: string; // token admin tenant C
  let adminD: string; // token admin tenant D (isolamento)
  let companyId: string;
  let taskId: string;

  const run = Date.now().toString(36);
  const slugC = `f2c-${run}`;
  const slugD = `f2d-${run}`;
  const PASSWORD = 'SenhaForte123!';
  const CNPJ_VALIDO = '11.222.333/0001-81';

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const superLogin = await request(server()).post('/auth/login').send({
      email: process.env.SEED_SUPERADMIN_EMAIL,
      password: process.env.SEED_SUPERADMIN_PASSWORD,
    });
    expect(superLogin.status).toBe(200);
    const superToken = superLogin.body.tokens.accessToken;

    for (const slug of [slugC, slugD]) {
      const res = await request(server())
        .post('/admin/tenants')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          razaoSocial: `Escritório ${slug}`,
          slug,
          email: `${slug}@teste.com`,
          planSlug: 'escritorio-pequeno',
          admin: { name: `Admin ${slug}`, email: `admin@${slug}.com`, password: PASSWORD },
        });
      expect(res.status).toBe(201);
    }
    const loginC = await request(server())
      .post('/auth/login')
      .send({ email: `admin@${slugC}.com`, password: PASSWORD, tenantSlug: slugC });
    adminC = loginC.body.tokens.accessToken;
    const loginD = await request(server())
      .post('/auth/login')
      .send({ email: `admin@${slugD}.com`, password: PASSWORD, tenantSlug: slugD });
    adminD = loginD.body.tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejeita CNPJ com dígitos verificadores inválidos', async () => {
    const res = await request(server())
      .post('/companies')
      .set('Authorization', `Bearer ${adminC}`)
      .send({ razaoSocial: 'Empresa Inválida', cnpj: '11.111.111/1111-11' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('CNPJ inválido');
  });

  it('cadastra empresa com CNPJ válido (normalizado, sem máscara)', async () => {
    const res = await request(server())
      .post('/companies')
      .set('Authorization', `Bearer ${adminC}`)
      .send({
        razaoSocial: 'Padaria Modelo LTDA',
        cnpj: CNPJ_VALIDO,
        regimeTributario: 'SIMPLES_NACIONAL',
        uf: 'sp',
        municipio: 'São Paulo',
        tags: ['padaria'],
      });
    expect(res.status).toBe(201);
    expect(res.body.cnpj).toBe('11222333000181');
    expect(res.body.uf).toBe('SP');
    companyId = res.body.id;
  });

  it('recusa CNPJ duplicado no mesmo escritório', async () => {
    const res = await request(server())
      .post('/companies')
      .set('Authorization', `Bearer ${adminC}`)
      .send({ razaoSocial: 'Duplicada', cnpj: CNPJ_VALIDO });
    expect(res.status).toBe(409);
  });

  it('catálogo de templates do seed está disponível', async () => {
    const res = await request(server())
      .get('/obligation-templates')
      .set('Authorization', `Bearer ${adminC}`);
    expect(res.status).toBe(200);
    const slugs = res.body.map((t: { slug: string }) => t.slug);
    expect(slugs).toEqual(expect.arrayContaining(['das-simples-nacional', 'fgts-mensal', 'efd-contribuicoes']));
  });

  it('feriados nacionais do seed são visíveis', async () => {
    const res = await request(server())
      .get('/holidays?year=2026')
      .set('Authorization', `Bearer ${adminC}`);
    expect(res.status).toBe(200);
    const names = res.body.map((h: { name: string }) => h.name);
    expect(names).toEqual(expect.arrayContaining(['Sexta-feira Santa', 'Corpus Christi']));
  });

  it('cria obrigação a partir do template DAS e gera tarefas recorrentes', async () => {
    const templates = await request(server())
      .get('/obligation-templates')
      .set('Authorization', `Bearer ${adminC}`);
    const das = templates.body.find((t: { slug: string }) => t.slug === 'das-simples-nacional');
    expect(das).toBeDefined();

    const created = await request(server())
      .post('/obligations')
      .set('Authorization', `Bearer ${adminC}`)
      .send({ companyIds: [companyId], templateId: das.id });
    expect(created.status).toBe(201);
    expect(created.body.created).toBe(1);

    const generated = await request(server())
      .post('/obligations/generate-tasks')
      .set('Authorization', `Bearer ${adminC}`);
    expect(generated.status).toBe(201);
    expect(generated.body.created).toBeGreaterThanOrEqual(1);

    // Idempotência: segunda geração não duplica
    const again = await request(server())
      .post('/obligations/generate-tasks')
      .set('Authorization', `Bearer ${adminC}`);
    expect(again.body.created).toBe(0);
  });

  it('lista as tarefas geradas com dados da empresa e da obrigação', async () => {
    const res = await request(server())
      .get(`/tasks?companyId=${companyId}`)
      .set('Authorization', `Bearer ${adminC}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    const task = res.body.items[0];
    expect(task.title).toContain('DAS');
    expect(task.company.razaoSocial).toBe('Padaria Modelo LTDA');
    expect(task.competence).toMatch(/^\d{4}-\d{2}$/);
    taskId = task.id;
  });

  it('executa a tarefa: em andamento -> concluída (com timestamps)', async () => {
    const started = await request(server())
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminC}`)
      .send({ status: 'EM_ANDAMENTO' });
    expect(started.status).toBe(200);
    expect(started.body.startedAt).toBeTruthy();

    const done = await request(server())
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminC}`)
      .send({ status: 'CONCLUIDA' });
    expect(done.status).toBe(200);
    expect(done.body.completedAt).toBeTruthy();
  });

  it('não aceita marcar VENCIDA manualmente (status do sistema)', async () => {
    const res = await request(server())
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminC}`)
      .send({ status: 'VENCIDA' });
    expect(res.status).toBe(400);
  });

  it('comenta na tarefa e o resumo reflete os contadores', async () => {
    const comment = await request(server())
      .post(`/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${adminC}`)
      .send({ body: 'Guia emitida e paga.' });
    expect(comment.status).toBe(201);

    const summary = await request(server())
      .get('/tasks/summary')
      .set('Authorization', `Bearer ${adminC}`);
    expect(summary.status).toBe(200);
    expect(summary.body.byStatus.CONCLUIDA).toBeGreaterThanOrEqual(1);
  });

  it('ISOLAMENTO: tenant D não enxerga empresa nem tarefa de C', async () => {
    const company = await request(server())
      .get(`/companies/${companyId}`)
      .set('Authorization', `Bearer ${adminD}`);
    expect(company.status).toBe(404);

    const task = await request(server())
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminD}`);
    expect(task.status).toBe(404);

    const list = await request(server()).get('/companies').set('Authorization', `Bearer ${adminD}`);
    expect(list.body.total).toBe(0);
  });
});
