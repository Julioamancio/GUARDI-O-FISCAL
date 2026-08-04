#!/usr/bin/env bash
# ==============================================================================
# GUARDIÃO FISCAL — instalação em VPS Ubuntu 22.04/24.04
# Uso (como root ou com sudo):
#   bash scripts/install-vps.sh seudominio.com.br
# O script é idempotente: pode ser re-executado com segurança.
# ==============================================================================
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Uso: bash scripts/install-vps.sh <dominio>  (ex.: guardiaofiscal.com.br)"
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "==> [1/7] Instalando Docker e utilitários..."
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg ufw fail2ban
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
docker --version

echo "==> [2/7] Configurando firewall (UFW) e fail2ban..."
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null 2>&1 || true

echo "==> [3/7] Preparando .env..."
if [[ ! -f .env ]]; then
  cp .env.example .env
  # Gera segredos fortes automaticamente
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
  sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(openssl rand -hex 24)|" .env
  sed -i "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=$(openssl rand -hex 24)|" .env
  sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" .env
  sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" .env
  sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -hex 32)|" .env
  sed -i "s|^SEED_SUPERADMIN_PASSWORD=.*|SEED_SUPERADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '=+/\n')Aa1|" .env
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" .env
  sed -i "s|^APP_DOMAIN=.*|APP_DOMAIN=${DOMAIN}|" .env
  sed -i "s|^APP_URL=.*|APP_URL=https://${DOMAIN}|" .env
  sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://${DOMAIN}/api|" .env
  echo "    .env criado com segredos gerados automaticamente."
  echo "    >>> A senha do superadmin está em SEED_SUPERADMIN_PASSWORD no .env — anote e troque no primeiro login. <<<"
else
  echo "    .env já existe — mantido."
fi

echo "==> [4/7] Ajustando domínio no Nginx..."
sed -i "s|guardiaofiscal\.com\.br|${DOMAIN}|g" docker/nginx/conf.d/app.conf

echo "==> [5/7] Emitindo certificado TLS (Let's Encrypt)..."
mkdir -p backups
if ! docker volume inspect guardiao_certbot_conf >/dev/null 2>&1 || \
   ! docker run --rm -v guardiao_certbot_conf:/etc/letsencrypt alpine \
     test -d "/etc/letsencrypt/live/${DOMAIN}" >/dev/null 2>&1; then
  # Sobe um nginx temporário só para o desafio ACME
  docker run --rm -d --name gf-acme -p 80:80 \
    -v guardiao_certbot_www:/usr/share/nginx/html nginx:1.27-alpine
  docker run --rm \
    -v guardiao_certbot_conf:/etc/letsencrypt \
    -v guardiao_certbot_www:/var/www/certbot \
    certbot/certbot certonly --webroot -w /var/www/certbot \
    -d "${DOMAIN}" --register-unsafely-without-email --agree-tos --non-interactive || {
      docker stop gf-acme >/dev/null 2>&1 || true
      echo "AVISO: emissão do certificado falhou (DNS ainda não aponta para esta VPS?)."
      echo "       Configure o DNS e rode novamente. Para subdomínios wildcard use DNS-01 (ver docs/04-implantacao-vps.md)."
      exit 1
    }
  docker stop gf-acme >/dev/null 2>&1 || true
fi

echo "==> [6/7] Build e subida dos serviços..."
docker compose -f docker-compose.prod.yml up -d --build

echo "==> [7/7] Aguardando API ficar saudável e aplicando seed..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T api wget -qO- http://127.0.0.1:3001/health >/dev/null 2>&1; then
    break
  fi
  sleep 5
done
docker compose -f docker-compose.prod.yml exec -T api npx ts-node prisma/seed.ts || \
  echo "AVISO: seed falhou — rode manualmente: docker compose -f docker-compose.prod.yml exec api npx ts-node prisma/seed.ts"

echo ""
echo "======================================================================"
echo " Instalação concluída."
echo "  Painel:     https://${DOMAIN}"
echo "  API:        https://${DOMAIN}/api/health"
echo "  Superadmin: e-mail e senha em SEED_SUPERADMIN_* no arquivo .env"
echo "  Backup:     agende scripts/backup.sh no cron (ver docs/04-implantacao-vps.md)"
echo "======================================================================"
