/** Payload do access token (15 min). Fonte de verdade do tenant na requisição. */
export interface AccessTokenPayload {
  /** id do usuário */
  sub: string;
  /** id do tenant; null = superadmin da plataforma */
  tid: string | null;
  /** slugs dos papéis */
  roles: string[];
  /** slugs das permissões efetivas */
  perms: string[];
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  tenantId: string | null;
  roles: string[];
  permissions: string[];
  tenant: { id: string; slug: string; razaoSocial: string; logoUrl: string | null; primaryColor: string | null } | null;
}
