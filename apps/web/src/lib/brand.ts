/**
 * Nome exibido da plataforma (marca branca por instalação).
 * Definido no build via NEXT_PUBLIC_BRAND_NAME (docker-compose passa como
 * build-arg lido do .env). Sem valor definido, usa a marca padrão.
 */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'Radar Contábil';
