import { NextRequest, NextResponse } from 'next/server';

/**
 * Proteção de rotas no edge: sem cookie de sessão não se chega às páginas
 * privadas (a API revalida o token de qualquer forma — defesa em camadas).
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('gf_access') || request.cookies.has('gf_refresh');
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  if (!hasSession && !isLoginPage) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Protege tudo exceto assets estáticos e as rotas de sessão
  matcher: ['/((?!api/session|_next/static|_next/image|favicon.ico).*)'],
};
