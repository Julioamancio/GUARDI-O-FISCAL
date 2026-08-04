import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    tenant: { findUnique: jest.fn() },
    user: { findFirst: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const auditMock = { log: jest.fn() };

  const baseUser = async () => ({
    id: 'user-1',
    tenantId: 'tenant-1',
    name: 'Contador Teste',
    email: 'contador@teste.com',
    passwordHash: await argon2.hash('SenhaForte123'),
    isActive: true,
    deletedAt: null,
    tenant: {
      id: 'tenant-1',
      slug: 'teste',
      razaoSocial: 'Teste LTDA',
      logoUrl: null,
      primaryColor: null,
      status: 'ACTIVE',
      deletedAt: null,
    },
    roles: [
      {
        role: {
          slug: 'accountant',
          permissions: [{ permission: { slug: 'tasks.read' } }, { permission: { slug: 'tasks.write' } }],
        },
      },
    ],
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres!!';

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        JwtService,
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('rejeita senha incorreta com mensagem genérica e registra auditoria', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', status: 'ACTIVE', deletedAt: null });
      prismaMock.user.findFirst.mockResolvedValue(await baseUser());

      await expect(
        service.login({ email: 'contador@teste.com', password: 'errada', tenantSlug: 'teste' }, {}),
      ).rejects.toThrow(UnauthorizedException);
      expect(auditMock.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_failed' }));
    });

    it('rejeita usuário inexistente com a MESMA mensagem (anti-enumeração)', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', status: 'ACTIVE', deletedAt: null });
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nao@existe.com', password: 'qualquer', tenantSlug: 'teste' }, {}),
      ).rejects.toThrow('Credenciais inválidas');
    });

    it('rejeita login em tenant suspenso', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', status: 'SUSPENDED', deletedAt: null });

      await expect(
        service.login({ email: 'contador@teste.com', password: 'SenhaForte123', tenantSlug: 'teste' }, {}),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    });

    it('login válido emite access token com tid e permissões, e refresh token', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', status: 'ACTIVE', deletedAt: null });
      prismaMock.user.findFirst.mockResolvedValue(await baseUser());
      prismaMock.user.update.mockResolvedValue({});
      prismaMock.refreshToken.create.mockResolvedValue({});

      const result = await service.login(
        { email: 'contador@teste.com', password: 'SenhaForte123', tenantSlug: 'teste' },
        { ip: '10.0.0.1' },
      );

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.user.tenantId).toBe('tenant-1');
      expect(result.user.permissions).toContain('tasks.read');

      const payload = JSON.parse(
        Buffer.from(result.tokens.accessToken.split('.')[1], 'base64url').toString(),
      );
      expect(payload.tid).toBe('tenant-1');
      expect(payload.perms).toEqual(expect.arrayContaining(['tasks.read', 'tasks.write']));

      // O refresh token nunca é persistido em claro
      const created = prismaMock.refreshToken.create.mock.calls[0][0].data;
      expect(created.tokenHash).not.toBe(result.tokens.refreshToken);
      expect(created.tokenHash).toHaveLength(64); // sha256 hex
    });
  });

  describe('refresh', () => {
    it('reuso de refresh token revogado derruba a família inteira', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        family: 'familia-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
        user: { tenantId: 'tenant-1', isActive: true, deletedAt: null, roles: [] },
      });

      await expect(service.refresh('token-reusado', {})).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family: 'familia-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.refresh_reuse_detected' }),
      );
    });

    it('refresh expirado é rejeitado', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        family: 'familia-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { tenantId: 'tenant-1', isActive: true, deletedAt: null, roles: [] },
      });

      await expect(service.refresh('token-expirado', {})).rejects.toThrow(UnauthorizedException);
    });

    it('refresh válido rotaciona: revoga o antigo e cria novo na mesma família', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        family: 'familia-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { tenantId: 'tenant-1', isActive: true, deletedAt: null, roles: [] },
      });
      prismaMock.refreshToken.update.mockResolvedValue({});
      prismaMock.refreshToken.create.mockResolvedValue({});

      const tokens = await service.refresh('token-valido', {});

      expect(tokens.accessToken).toBeDefined();
      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ family: 'familia-1' }),
      });
    });
  });
});
