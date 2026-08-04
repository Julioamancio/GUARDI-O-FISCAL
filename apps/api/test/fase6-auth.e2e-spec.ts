/**
 * Fase 6: troca de senha — exige senha atual, revoga todas as sessões,
 * e a nova senha passa a valer imediatamente.
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Fase 6 — troca de senha (e2e)', () => {
  let app: NestExpressApplication;
  let accessToken: string;
  let refreshToken: string;

  const run = Date.now().toString(36);
  const slug = `f6h-${run}`;
  const OLD_PASSWORD = 'SenhaAntiga123!';
  const NEW_PASSWORD = 'SenhaNovinha456!';

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const superToken = (
      await request(server()).post('/auth/login').send({
        email: process.env.SEED_SUPERADMIN_EMAIL,
        password: process.env.SEED_SUPERADMIN_PASSWORD,
      })
    ).body.tokens.accessToken;

    await request(server())
      .post('/admin/tenants')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        razaoSocial: `Escritório ${slug}`,
        slug,
        email: `${slug}@teste.com`,
        planSlug: 'contador-individual',
        admin: { name: 'Admin Troca', email: `admin@${slug}.com`, password: OLD_PASSWORD },
      });

    const login = await request(server())
      .post('/auth/login')
      .send({ email: `admin@${slug}.com`, password: OLD_PASSWORD, tenantSlug: slug });
    accessToken = login.body.tokens.accessToken;
    refreshToken = login.body.tokens.refreshToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('recusa troca com senha atual errada (e audita a tentativa)', async () => {
    const res = await request(server())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'completamente-errada1A', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('recusa nova senha fraca (política de senha)', async () => {
    const res = await request(server())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: OLD_PASSWORD, newPassword: 'fraca' });
    expect(res.status).toBe(400);
  });

  it('troca a senha com sucesso (204) e revoga o refresh antigo', async () => {
    const res = await request(server())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(204);

    const refresh = await request(server()).post('/auth/refresh').send({ refreshToken });
    expect(refresh.status).toBe(401); // sessão antiga morta
  });

  it('senha antiga não entra mais; a nova entra', async () => {
    const oldLogin = await request(server())
      .post('/auth/login')
      .send({ email: `admin@${slug}.com`, password: OLD_PASSWORD, tenantSlug: slug });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(server())
      .post('/auth/login')
      .send({ email: `admin@${slug}.com`, password: NEW_PASSWORD, tenantSlug: slug });
    expect(newLogin.status).toBe(200);
  });
});
