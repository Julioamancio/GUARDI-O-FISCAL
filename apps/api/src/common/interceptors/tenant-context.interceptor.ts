import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, Subscription } from 'rxjs';
import { TenantContext, RequestContext } from '../tenant-context';
import type { AccessTokenPayload } from '../../auth/auth.types';

/**
 * Inicializa o TenantContext para TODA a execução do handler.
 *
 * Precisa ser um interceptor (e não o guard): `als.enterWith()` chamado dentro
 * de um guard async não se propaga para a continuação da requisição — o store
 * se perdia e toda operação de escritório falhava com 403. O interceptor
 * envolve o handler com `als.run()`, que propaga o contexto para toda a cadeia
 * assíncrona (services, Prisma scoped, auditoria).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AccessTokenPayload | undefined;

    const store: RequestContext = {
      userId: user?.sub ?? null,
      tenantId: user?.tid ?? null,
      roles: user?.roles ?? [],
      permissions: user?.perms ?? [],
      ip: request.ip,
      userAgent: request.headers?.['user-agent'],
    };

    return new Observable((subscriber) => {
      let subscription: Subscription | undefined;
      TenantContext.run(store, () => {
        subscription = next.handle().subscribe(subscriber);
      });
      return () => subscription?.unsubscribe();
    });
  }
}
