import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenPayload } from '../../auth/auth.types';

/**
 * Guard global: valida o access token e anexa o payload em request.user.
 * O TenantContext é aberto depois, pelo TenantContextInterceptor — um guard
 * não consegue propagar AsyncLocalStorage para o handler.
 * Rotas com @Public() passam sem token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    if (isPublic) {
      return true;
    }

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }

    (request as Request & { user: AccessTokenPayload }).user = payload;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
