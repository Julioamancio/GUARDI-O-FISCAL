/**
 * TESTE CRÍTICO (requisito 39): um escritório JAMAIS acessa dados de outro.
 *
 * Pré-requisitos: banco de teste migrado e com seed aplicado
 *   DATABASE_URL apontando para o banco de teste
 *   pnpm prisma:deploy && pnpm prisma:seed
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Isolamento entre tenants (e2e)', () => {
  let app: NestExpressApplication;
  let superToken: string;
  let adminAToken: string;
  let adminBToken: string;
  let userIdB: string;

  const run = Date.now().toString(36);
  const slugA = `iso-a-${run}`;
  const slugB = `iso-b-${run}`;
  const PASSWORD = 'SenhaForte123!';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    // Login do superadmin (credenciais do seed)
    const superLogin = await request(app.getHttpServer()).post('/auth/login').send({
      email: process.env.SEED_SUPERADMIN_EMAIL,
      password: process.env.SEED_SUPERADMIN_PASSWORD,
    });
    expect(superLogin.status).toBe(200);
    superToken = superLogin.body.tokens.accessToken;

    // Cria dois escritórios
    for (const [slug, name] of [
      [slugA, 'Escritório A Isolamento'],
      [slugB, 'Escritório B Isolamento'],
    ] as const) {
      const res = await request(app.getHttpServer())
        .post('/admin/tenants')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          razaoSocial: name,
          slug,
          email: `${slug}@teste.com`,
          planSlug: 'escritorio-pequeno',
          admin: { name: `Admin ${slug}`, email: `admin@${slug}.com`, password: PASSWORD },
        });
      expect(res.status).toBe(201);
    }

    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `admin@${slugA}.com`, password: PASSWORD, tenantSlug: slugA });
    expect(loginA.status).toBe(200);
    adminAToken = loginA.body.tokens.accessToken;

    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `admin@${slugB}.com`, password: PASSWORD, tenantSlug: slugB });
    expect(loginB.status).toBe(200);
    adminBToken = loginB.body.tokens.accessToken;

    // B cria um usuário próprio — alvo das tentativas de acesso indevido de A
    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ name: 'Funcionário B', email: `func@${slugB}.com`, password: PASSWORD, role: 'accountant' });
    expect(created.status).toBe(201);
    userIdB = created.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista de usuários de A não contém usuários de B', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(res.status).toBe(200);
    const emails = res.body.items.map((u: { email: string }) => u.email);
    expect(emails).toContain(`admin@${slugA}.com`);
    expect(emails).not.toContain(`admin@${slugB}.com`);
    expect(emails).not.toContain(`func@${slugB}.com`);
  });

  it('A não consegue LER/ALTERAR usuário de B por id (404, sem vazar existência)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${userIdB}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'hackeado' });
    expect(res.status).toBe(404);
  });

  it('A não consegue EXCLUIR usuário de B', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/users/${userIdB}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(res.status).toBe(404);
  });

  it('admin de escritório NÃO acessa rotas de superadmin', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/tenants')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(res.status).toBe(403);
  });

  it('login de admin de A com slug de B falha (mensagem genérica)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `admin@${slugA}.com`, password: PASSWORD, tenantSlug: slugB });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciais inválidas');
  });

  it('requisição sem token é rejeitada', async () => {
    const res = await request(app.getHttpServer()).get('/users');
    expect(res.status).toBe(401);
  });
});
