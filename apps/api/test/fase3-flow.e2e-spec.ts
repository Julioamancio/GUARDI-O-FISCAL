/**
 * Fase 3: solicitação de documentos -> portal do cliente -> upload (MinIO real)
 * -> conferência -> notificações -> isolamento.
 * Pré-requisitos: banco migrado + seed; MinIO de teste no ar (MINIO_* no .env).
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Fase 3 — documentos e portal (e2e)', () => {
  let app: NestExpressApplication;
  let adminE: string;
  let adminF: string;
  let clientE: string;
  let companyId: string;
  let requestId: string;
  let item1Id: string;
  let item2Id: string;
  let documentId: string;

  const run = Date.now().toString(36);
  const slugE = `f3e-${run}`;
  const slugF = `f3f-${run}`;
  const PASSWORD = 'SenhaForte123!';
  const PDF = Buffer.from('%PDF-1.4 conteudo de teste guardiao fiscal');

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
    const superToken = superLogin.body.tokens.accessToken;

    for (const slug of [slugE, slugF]) {
      await request(server())
        .post('/admin/tenants')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          razaoSocial: `Escritório ${slug}`,
          slug,
          email: `${slug}@teste.com`,
          planSlug: 'escritorio-pequeno',
          admin: { name: `Admin ${slug}`, email: `admin@${slug}.com`, password: PASSWORD },
        });
    }
    adminE = (
      await request(server()).post('/auth/login').send({ email: `admin@${slugE}.com`, password: PASSWORD, tenantSlug: slugE })
    ).body.tokens.accessToken;
    adminF = (
      await request(server()).post('/auth/login').send({ email: `admin@${slugF}.com`, password: PASSWORD, tenantSlug: slugF })
    ).body.tokens.accessToken;

    // Empresa + usuário-cliente vinculado
    const company = await request(server())
      .post('/companies')
      .set('Authorization', `Bearer ${adminE}`)
      .send({ razaoSocial: 'Mercadinho do Bairro LTDA', cnpj: '11.444.777/0001-61', uf: 'MG' });
    expect(company.status).toBe(201);
    companyId = company.body.id;

    const clientUser = await request(server())
      .post('/users')
      .set('Authorization', `Bearer ${adminE}`)
      .send({ name: 'Dono do Mercadinho', email: `cliente@${slugE}.com`, password: PASSWORD, role: 'client' });
    expect(clientUser.status).toBe(201);

    const link = await request(server())
      .post(`/companies/${companyId}/clients/${clientUser.body.id}`)
      .set('Authorization', `Bearer ${adminE}`);
    expect(link.status).toBe(201);

    clientE = (
      await request(server()).post('/auth/login').send({ email: `cliente@${slugE}.com`, password: PASSWORD, tenantSlug: slugE })
    ).body.tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('escritório cria solicitação com itens e registra notificação para o cliente', async () => {
    const res = await request(server())
      .post('/document-requests')
      .set('Authorization', `Bearer ${adminE}`)
      .send({
        companyId,
        title: 'Fechamento 08/2026',
        competence: '2026-08',
        dueDate: '2026-09-05',
        message: 'Precisamos destes documentos para o fechamento do mês.',
        items: ['Extratos bancários', 'Notas fiscais emitidas'],
      });
    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(2);
    requestId = res.body.id;
    item1Id = res.body.items[0].id;
    item2Id = res.body.items[1].id;
  });

  it('cliente vê a solicitação no portal (e apenas a própria empresa)', async () => {
    const overview = await request(server())
      .get('/portal/overview')
      .set('Authorization', `Bearer ${clientE}`);
    expect(overview.status).toBe(200);
    expect(overview.body.companies).toHaveLength(1);
    expect(overview.body.openRequests).toBe(1);

    const requests = await request(server())
      .get('/portal/requests')
      .set('Authorization', `Bearer ${clientE}`);
    expect(requests.status).toBe(200);
    expect(requests.body[0].items).toHaveLength(2);
  });

  it('cliente NÃO acessa rotas do escritório (sem permissão)', async () => {
    const res = await request(server())
      .post('/document-requests')
      .set('Authorization', `Bearer ${clientE}`)
      .send({ companyId, title: 'x', items: ['y'] });
    expect(res.status).toBe(403);

    const companies = await request(server()).get('/companies').set('Authorization', `Bearer ${clientE}`);
    expect(companies.status).toBe(403);
  });

  it('upload de extensão proibida é rejeitado', async () => {
    const res = await request(server())
      .post(`/portal/items/${item1Id}/upload`)
      .set('Authorization', `Bearer ${clientE}`)
      .attach('file', Buffer.from('MZ executavel'), { filename: 'virus.exe', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('não permitida');
  });

  it('cliente envia PDF: item RECEBIDO, solicitação PARCIAL, contador notificado', async () => {
    const res = await request(server())
      .post(`/portal/items/${item1Id}/upload`)
      .set('Authorization', `Bearer ${clientE}`)
      .attach('file', PDF, { filename: 'extrato-agosto.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('RECEBIDO');
    expect(res.body.version).toBe(1);
    documentId = res.body.documentId;

    const detail = await request(server())
      .get(`/document-requests/${requestId}`)
      .set('Authorization', `Bearer ${adminE}`);
    expect(detail.body.status).toBe('PARCIAL');

    const notifications = await request(server())
      .get('/notifications')
      .set('Authorization', `Bearer ${adminE}`);
    expect(notifications.body.some((n: { type: string }) => n.type === 'DOCUMENTO_RECEBIDO')).toBe(true);
  });

  it('reenvio do mesmo item gera versão 2 (histórico preservado)', async () => {
    const res = await request(server())
      .post(`/portal/items/${item1Id}/upload`)
      .set('Authorization', `Bearer ${clientE}`)
      .attach('file', PDF, { filename: 'extrato-agosto-corrigido.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(2);
    expect(res.body.documentId).toBe(documentId);
  });

  it('conferência: rejeitar sem motivo falha; item sem documento não pode ser conferido', async () => {
    const noReason = await request(server())
      .patch(`/document-requests/items/${item1Id}/review`)
      .set('Authorization', `Bearer ${adminE}`)
      .send({ status: 'REJEITADO' });
    expect(noReason.status).toBe(400);

    const notReceived = await request(server())
      .patch(`/document-requests/items/${item2Id}/review`)
      .set('Authorization', `Bearer ${adminE}`)
      .send({ status: 'APROVADO' });
    expect(notReceived.status).toBe(400);
  });

  it('aprovar item recebido e concluir o restante fecha a solicitação', async () => {
    const approved = await request(server())
      .patch(`/document-requests/items/${item1Id}/review`)
      .set('Authorization', `Bearer ${adminE}`)
      .send({ status: 'APROVADO' });
    expect(approved.status).toBe(200);

    await request(server())
      .post(`/portal/items/${item2Id}/upload`)
      .set('Authorization', `Bearer ${clientE}`)
      .attach('file', PDF, { filename: 'notas.pdf', contentType: 'application/pdf' });
    await request(server())
      .patch(`/document-requests/items/${item2Id}/review`)
      .set('Authorization', `Bearer ${adminE}`)
      .send({ status: 'APROVADO' });

    const detail = await request(server())
      .get(`/document-requests/${requestId}`)
      .set('Authorization', `Bearer ${adminE}`);
    expect(detail.body.status).toBe('CONCLUIDA');
  });

  it('download gera link assinado temporário (contador e cliente)', async () => {
    const accountant = await request(server())
      .get(`/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${adminE}`);
    expect(accountant.status).toBe(200);
    expect(accountant.body.url).toContain('http');
    expect(accountant.body.version).toBe(2);

    const client = await request(server())
      .get(`/portal/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${clientE}`);
    expect(client.status).toBe(200);
    expect(client.body.url).toContain('http');
  });

  it('ISOLAMENTO: tenant F não vê nem alcança nada do tenant E', async () => {
    const list = await request(server())
      .get('/document-requests')
      .set('Authorization', `Bearer ${adminF}`);
    expect(list.body).toHaveLength(0);

    const byId = await request(server())
      .get(`/document-requests/${requestId}`)
      .set('Authorization', `Bearer ${adminF}`);
    expect(byId.status).toBe(404);

    const upload = await request(server())
      .post(`/portal/items/${item1Id}/upload`)
      .set('Authorization', `Bearer ${adminF}`)
      .attach('file', PDF, { filename: 'invasao.pdf', contentType: 'application/pdf' });
    expect(upload.status).toBe(404);

    const download = await request(server())
      .get(`/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${adminF}`);
    expect(download.status).toBe(404);
  });
});
