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
  get(): RequestContext | undefined {
    return als.getStore();
  },

  /**
   * Executa fn dentro de um contexto explícito. É o ÚNICO jeito de abrir
   * contexto: `enterWith` dentro de guard/função async não se propaga para a
   * continuação da requisição (bug corrigido no TenantContextInterceptor).
   */
  run<T>(ctx: RequestContext, fn: () => T): T {
    return als.run(ctx, fn);
  },
};
