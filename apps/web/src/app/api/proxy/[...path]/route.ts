import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api';

/**
 * Proxy autenticado do navegador para a API.
 * Os tokens vivem em cookies httpOnly — o JavaScript da página nunca os vê;
 * este handler injeta o Bearer e repassa a resposta. A autorização real
 * (permissões, tenant) é sempre da API.
 */
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const token = request.cookies.get('gf_access')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Sessão expirada' }, { status: 401 });
  }

  const url = `${apiBaseUrl()}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const hasBody = !['GET', 'HEAD'].includes(request.method);

  // Repassa o Content-Type original: JSON e multipart (upload de arquivos)
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  const apiResponse = await fetch(url, {
    method: request.method,
    headers,
    body: hasBody ? Buffer.from(await request.arrayBuffer()) : undefined,
    cache: 'no-store',
  });

  const text = await apiResponse.text();
  return new NextResponse(text.length > 0 ? text : null, {
    status: apiResponse.status,
    headers: { 'Content-Type': apiResponse.headers.get('Content-Type') ?? 'application/json' },
  });
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
