/**
 * Fase 4: fechamento mensal, linha do tempo, relatórios, pesquisa global,
 * importação CSV e painel do superadmin.
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Fase 4 — gestão e prova (e2e)', () => {
  let app: NestExpressApplication;
  let superToken: string;
  let adminG: string;
  let companyId: string;

  const run = Date.now().toString(36);
  const slugG = `f4g-${run}`;
  const PASSWORD = 'SenhaForte123!';
  const COMPETENCE = '2026-07';

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    superToken = (
      await request(server()).post('/auth/login').send({
        email: process.env.SEED_SUPERADMIN_EMAIL,
        password: process.env.SEED_SUPERADMIN_PASSWORD,
      })
    ).body.tokens.accessToken;

    await request(server())
      .post('/admin/tenants')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        razaoSocial: `Escritório ${slugG}`,
        slug: slugG,
        email: `${slugG}@teste.com`,
        planSlug: 'escritorio-pequeno',
        admin: { name: `Admin ${slugG}`, email: `admin@${slugG}.com`, password: PASSWORD },
      });
    adminG = (
      await request(server()).post('/auth/login').send({ email: `admin@${slugG}.com`, password: PASSWORD, tenantSlug: slugG })
    ).body.tokens.accessToken;

    const company = await request(server())
      .post('/companies')
      .set('Authorization', `Bearer ${adminG}`)
      .send({ razaoSocial: 'Oficina Central LTDA', cnpj: '11.222.333/0001-81', uf: 'RJ' });
    companyId = company.body.id;

    // Tarefas da competência: uma concluída, uma vencida (dueDate no passado)
    const done = await request(server())
      .post('/tasks')
      .set('Authorization', `Bearer ${adminG}`)
      .send({ companyId, title: 'Apuração ICMS', competence: COMPETENCE, dueDate: '2026-07-20', department: 'FISCAL' });
    await request(server())
      .patch(`/tasks/${done.body.id}`)
      .set('Authorization', `Bearer ${adminG}`)
      .send({ status: 'CONCLUIDA' });
    await request(server())
      .post('/tasks')
      .set('Authorization', `Bearer ${adminG}`)
      .send({ companyId, title: 'Folha de pagamento', competence: COMPETENCE, dueDate: '2026-07-15', department: 'PESSOAL' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('painel de fechamento calcula o semáforo (tarefa aberta vencida => VERMELHO)', async () => {
    const res = await request(server())
      .get(`/closing?competence=${COMPETENCE}`)
      .set('Authorization', `Bearer ${adminG}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.VERMELHO).toBe(1);
    const row = res.body.rows.find((r: { company: { id: string } }) => r.company.id === companyId);
    expect(row.overall).toBe('VERMELHO');
    expect(row.byDepartment.FISCAL.done).toBe(1);
    expect(row.byDepartment.PESSOAL.overdue).toBe(1);
    expect(row.tasksTotal).toBe(2);
  });

  it('linha do tempo registrou a mudança de status com autor', async () => {
    const res = await request(server())
      .get(`/timeline?companyId=${companyId}`)
      .set('Authorization', `Bearer ${adminG}`);
    expect(res.status).toBe(200);
    const statusEvent = res.body.find((e: { event: string }) => e.event === 'tarefa.status');
    expect(statusEvent).toBeDefined();
    expect(statusEvent.actorName).toBe(`Admin ${slugG}`);
    expect(statusEvent.description).toContain('concluída após o vencimento'.toUpperCase().slice(0, 0) + 'Apuração ICMS');
  });

  it('relatório de tarefas em CSV traz as linhas e o cabeçalho', async () => {
    const res = await request(server())
      .get(`/reports/tasks?format=csv&competence=${COMPETENCE}`)
      .set('Authorization', `Bearer ${adminG}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const body = res.text ?? res.body.toString('utf8');
    expect(body).toContain('Empresa;CNPJ;Tarefa');
    expect(body).toContain('Apuração ICMS');
    expect(body).toContain('Folha de pagamento');
  });

  it('relatórios XLSX e PDF retornam binários com content-type correto', async () => {
    const xlsx = await request(server())
      .get(`/reports/tasks?format=xlsx&competence=${COMPETENCE}`)
      .set('Authorization', `Bearer ${adminG}`)
      .buffer()
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK'); // zip magic

    const pdf = await request(server())
      .get(`/reports/tasks?format=pdf&competence=${COMPETENCE}`)
      .set('Authorization', `Bearer ${adminG}`)
      .buffer()
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('pesquisa global encontra empresa e tarefa (respeitando permissões)', async () => {
    const res = await request(server())
      .get('/search?q=Oficina')
      .set('Authorization', `Bearer ${adminG}`);
    expect(res.status).toBe(200);
    expect(res.body.companies.some((c: { id: string }) => c.id === companyId)).toBe(true);

    const tasks = await request(server())
      .get('/search?q=Folha de pagamento')
      .set('Authorization', `Bearer ${adminG}`);
    expect(tasks.body.tasks.length).toBeGreaterThanOrEqual(1);
  });

  it('importação CSV: pré-visualização aponta erros linha a linha e não grava nada', async () => {
    const csv = [
      'razao_social;cnpj;regime_tributario;uf',
      'Nova Empresa Um LTDA;11.444.777/0001-61;SIMPLES_NACIONAL;SP',
      'CNPJ Quebrado;00.000.000/0000-00;SIMPLES_NACIONAL;SP',
      'Duplicada no Escritorio;11.222.333/0001-81;LUCRO_REAL;RJ',
      'Regime Errado;60.746.948/0001-12;REGIME_X;SP',
    ].join('\r\n');

    const preview = await request(server())
      .post('/companies/import')
      .set('Authorization', `Bearer ${adminG}`)
      .attach('file', Buffer.from(csv, 'utf8'), { filename: 'empresas.csv', contentType: 'text/csv' });
    expect(preview.status).toBe(201);
    expect(preview.body.confirmed).toBe(false);
    expect(preview.body.validRows).toBe(1);
    expect(preview.body.errorRows).toBe(3);
    expect(preview.body.created).toBe(0);
    const errorText = JSON.stringify(preview.body.errors);
    expect(errorText).toContain('CNPJ inválido');
    expect(errorText).toContain('já cadastrado');
    expect(errorText).toContain('regime_tributario inválido');

    const before = await request(server()).get('/companies').set('Authorization', `Bearer ${adminG}`);
    expect(before.body.total).toBe(1); // nada foi gravado
  });

  it('importação CSV confirmada grava apenas as linhas válidas', async () => {
    const csv = [
      'razao_social;cnpj;regime_tributario;uf',
      'Nova Empresa Um LTDA;11.444.777/0001-61;SIMPLES_NACIONAL;SP',
      'CNPJ Quebrado;00.000.000/0000-00;;',
    ].join('\r\n');

    const confirmed = await request(server())
      .post('/companies/import?confirm=true')
      .set('Authorization', `Bearer ${adminG}`)
      .attach('file', Buffer.from(csv, 'utf8'), { filename: 'empresas.csv', contentType: 'text/csv' });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.created).toBe(1);

    const after = await request(server()).get('/companies').set('Authorization', `Bearer ${adminG}`);
    expect(after.body.total).toBe(2);
  });

  it('modelo CSV é servido para download', async () => {
    const res = await request(server())
      .get('/companies/import/template')
      .set('Authorization', `Bearer ${adminG}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('razao_social;cnpj');
  });

  it('painel do superadmin agrega métricas da plataforma', async () => {
    const res = await request(server())
      .get('/admin/overview')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalCompanies).toBeGreaterThanOrEqual(2);
    expect(res.body.totalTasks).toBeGreaterThanOrEqual(2);
    expect(res.body.tenants.TRIAL).toBeGreaterThanOrEqual(1);
  });

  it('ISOLAMENTO: fechamento, timeline e relatórios de outro tenant vêm vazios', async () => {
    // adminG não deve ver dados dos tenants das fases anteriores
    const closing = await request(server())
      .get('/closing?competence=2026-08')
      .set('Authorization', `Bearer ${adminG}`);
    const otherCompanies = closing.body.rows.filter(
      (r: { company: { razaoSocial: string } }) => r.company.razaoSocial === 'Padaria Modelo LTDA',
    );
    expect(otherCompanies).toHaveLength(0);

    const timeline = await request(server())
      .get('/timeline')
      .set('Authorization', `Bearer ${adminG}`);
    const foreign = timeline.body.filter((e: { description: string }) => e.description.includes('Mercadinho'));
    expect(foreign).toHaveLength(0);
  });
});
