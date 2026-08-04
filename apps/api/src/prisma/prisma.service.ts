import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';

/**
 * Modelos que SEMPRE pertencem a um tenant. Qualquer acesso a eles via
 * `prisma.scoped` é filtrado automaticamente pelo tenant do contexto —
 * um `where` esquecido em um service não vaza dados de outro escritório.
 *
 * Ao criar um novo modelo de negócio com tenantId, adicione-o aqui.
 */
const TENANT_MODELS = new Set<string>([
  'User',
  'Company',
  'Subscription',
  'CompanyContact',
  'CompanyResponsible',
  'Obligation',
  'Task',
  'TaskComment',
  'CompanyClientAccess',
  'DocumentRequest',
  'DocumentRequestItem',
  'Document',
  'DocumentVersion',
  'DocumentReminder',
  'ResponsibilityTimeline',
]);

type ScopedClient = ReturnType<PrismaService['createScopedClient']>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private scopedClient?: ScopedClient;

  /**
   * Referência ao client COM os delegates (.task, .user, ...).
   * `new PrismaClient()` retorna um Proxy; dentro de métodos da classe, `this`
   * é o alvo cru do Proxy e os delegates não resolvem (bug sutil pego em
   * runtime na VPS). No construtor, `this` É o objeto retornado pelo super() —
   * capturamos aqui para uso dentro da extensão scoped.
   */
  private readonly self: PrismaService;

  constructor() {
    super();
    this.self = this;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Cliente com isolamento de tenant automático. Use SEMPRE que a operação
   * for em nome de um usuário de escritório. O cliente base (this.user, etc.)
   * fica restrito a: autenticação, rotas de superadmin e jobs de sistema.
   */
  get scoped(): ScopedClient {
    this.scopedClient ??= this.createScopedClient();
    return this.scopedClient;
  }

  private createScopedClient() {
    const base = this.self;
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_MODELS.has(model)) {
              return query(args);
            }
            const ctx = TenantContext.get();
            if (!ctx?.tenantId) {
              // Nunca degradar para consulta sem filtro: falha fechada.
              throw new ForbiddenException(
                `Acesso a ${model} sem tenant no contexto da requisição`,
              );
            }
            const tenantId = ctx.tenantId;
            const a = (args ?? {}) as Record<string, unknown>;

            switch (operation) {
              case 'findMany':
              case 'findFirst':
              case 'findFirstOrThrow':
              case 'count':
              case 'aggregate':
              case 'groupBy':
              case 'updateMany':
              case 'deleteMany':
                a.where = { AND: [{ tenantId }, (a.where as object) ?? {}] };
                return query(a as never);

              case 'create':
                a.data = { ...(a.data as object), tenantId };
                return query(a as never);

              case 'createMany': {
                const data = a.data;
                a.data = Array.isArray(data)
                  ? data.map((d: object) => ({ ...d, tenantId }))
                  : { ...(data as object), tenantId };
                return query(a as never);
              }

              case 'findUnique':
              case 'findUniqueOrThrow': {
                // Busca por chave única não aceita filtro extra: verifica depois.
                const result = (await query(a as never)) as { tenantId?: string | null } | null;
                if (result && result.tenantId !== tenantId) {
                  if (operation === 'findUniqueOrThrow') {
                    throw new NotFoundException(`${model} não encontrado`);
                  }
                  return null;
                }
                return result;
              }

              case 'update':
              case 'delete': {
                // Pré-verificação: o registro precisa pertencer ao tenant.
                const delegate = (base as unknown as Record<string, { findUnique: (q: unknown) => Promise<{ tenantId?: string | null } | null> }>)[
                  model.charAt(0).toLowerCase() + model.slice(1)
                ];
                const existing = await delegate.findUnique({ where: a.where });
                if (!existing || existing.tenantId !== tenantId) {
                  throw new NotFoundException(`${model} não encontrado`);
                }
                return query(a as never);
              }

              case 'upsert':
                // Semântica ambígua com isolamento por unique key — proibido no cliente scoped.
                throw new ForbiddenException(
                  `upsert não é permitido via cliente scoped em ${model}; use find + create/update`,
                );

              default:
                return query(a as never);
            }
          },
        },
      },
    });
  }

  /** Health check simples do banco. */
  async ping(): Promise<boolean> {
    await this.$queryRaw(Prisma.sql`SELECT 1`);
    return true;
  }
}
