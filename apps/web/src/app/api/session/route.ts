import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api';

const ACCESS_COOKIE = 'gf_access';
const REFRESH_COOKIE = 'gf_refresh';

// COOKIE_SECURE=false permite demo por HTTP em porta alta (sem TLS).
// Em produção real (HTTPS), deixe indefinido: o padrão exige Secure.
const secure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production';
const baseCookie = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };

/**
 * POST /api/session — faz login na API e guarda os tokens em cookies httpOnly.
 * O JavaScript do navegador nunca vê os tokens (mitiga roubo via XSS).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ message: 'Informe e-mail e senha' }, { status: 400 });
  }

  const apiResponse = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      ...(body.tenantSlug ? { tenantSlug: body.tenantSlug } : {}),
    }),
    cache: 'no-store',
  });

  const data = await apiResponse.json().catch(() => ({}));
  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: data.message ?? 'Falha no login' },
      { status: apiResponse.status },
    );
  }

  const response = NextResponse.json({ user: data.user });
  response.cookies.set(ACCESS_COOKIE, data.tokens.accessToken, {
    ...baseCookie,
    maxAge: data.tokens.expiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, data.tokens.refreshToken, {
    ...baseCookie,
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}

/** PUT /api/session — renova o access token usando o refresh cookie (rotação). */
export async function PUT(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ message: 'Sessão expirada' }, { status: 401 });
  }

  const apiResponse = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  const data = await apiResponse.json().catch(() => ({}));
  if (!apiResponse.ok) {
    const response = NextResponse.json({ message: 'Sessão expirada' }, { status: 401 });
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, data.accessToken, { ...baseCookie, maxAge: data.expiresIn });
  response.cookies.set(REFRESH_COOKIE, data.refreshToken, { ...baseCookie, maxAge: 7 * 24 * 60 * 60 });
  return response;
}

/** DELETE /api/session — logout: revoga a sessão na API e limpa os cookies. */
export async function DELETE(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${apiBaseUrl()}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}
