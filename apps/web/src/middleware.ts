import { NextRequest, NextResponse } from 'next/server';

const secure = process.env.NODE_ENV === 'production';
const baseCookie = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };

/**
 * Proteção de rotas + renovação transparente de sessão:
 * se o access token (15 min) expirou mas há refresh token válido, renova aqui
 * mesmo e a navegação continua sem o usuário perceber. A API sempre revalida.
 */
export async function middleware(request: NextRequest) {
  const access = request.cookies.get('gf_access')?.value;
  const refresh = request.cookies.get('gf_refresh')?.value;
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  if (access && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (access || isLoginPage) {
    return NextResponse.next();
  }

  // Sem access: tenta renovar com o refresh antes de mandar para o login
  if (refresh) {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    try {
      const renewed = await fetch(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
        cache: 'no-store',
      });
      if (renewed.ok) {
        const tokens = await renewed.json();
        // A página desta mesma navegação precisa enxergar o novo access token
        const headers = new Headers(request.headers);
        headers.set('cookie', `gf_access=${tokens.accessToken}; gf_refresh=${tokens.refreshToken}`);
        const response = NextResponse.next({ request: { headers } });
        response.cookies.set('gf_access', tokens.accessToken, { ...baseCookie, maxAge: tokens.expiresIn });
        response.cookies.set('gf_refresh', tokens.refreshToken, { ...baseCookie, maxAge: 7 * 24 * 60 * 60 });
        return response;
      }
    } catch {
      // API indisponível: cai para o login
    }
  }

  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete('gf_access');
  response.cookies.delete('gf_refresh');
  return response;
}

export const config = {
  // Protege páginas; /api/session e /api/proxy cuidam da própria autenticação
  matcher: ['/((?!api/session|api/proxy|_next/static|_next/image|favicon.ico).*)'],
};
