import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto por requisição (AsyncLocalStorage).
 * Preenchido pelo JwtAuthGuard após validar o token; lido pelo filtro
 * automático de tenant do Prisma e pelo serviço de auditoria.
 */
export interface RequestContext {
  userId: string | null;
  /** null = superadmin da plataforma (fora de qualquer tenant) */
  tenantId: string | null;
  roles: string[];
  permissions: string[];
  ip?: string;
  userAgent?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

export const TenantContext = {
  /** Inicia o contexto para a cadeia assíncrona atual (chamado pelo guard). */
  enter(ctx: RequestContext): void {
    als.enterWith(ctx);
  },

  get(): RequestContext | undefined {
    return als.getStore();
  },

  /** Executa fn dentro de um contexto explícito (útil em jobs e testes). */
  run<T>(ctx: RequestContext, fn: () => T): T {
    return als.run(ctx, fn);
  },
};
