/**
 * Validação de ambiente no boot: a API se recusa a subir com configuração
 * incompleta ou insegura, em vez de falhar silenciosamente em runtime.
 */
const REQUIRED = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key] || String(config[key]).trim() === '');
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`);
  }

  const accessSecret = String(config.JWT_ACCESS_SECRET);
  const refreshSecret = String(config.JWT_REFRESH_SECRET);
  if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET e JWT_REFRESH_SECRET devem ter no mínimo 32 caracteres (use: openssl rand -base64 48)');
  }
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET e JWT_REFRESH_SECRET não podem ser iguais');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(String(config.ENCRYPTION_KEY))) {
    throw new Error('ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (use: openssl rand -hex 32)');
  }
  if (config.NODE_ENV === 'production' && String(config.SEED_SUPERADMIN_PASSWORD ?? '') === 'TroqueEstaSenha!123') {
    throw new Error('Troque SEED_SUPERADMIN_PASSWORD antes de rodar em produção');
  }
  return config;
}
