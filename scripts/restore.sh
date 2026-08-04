#!/usr/bin/env bash
# ==============================================================================
# GUARDIÃO FISCAL — restauração de backup
# Uso:
#   bash scripts/restore.sh backups/db_20260804_030000.dump.gz [backups/minio_...tar.gz]
# ATENÇÃO: substitui os dados atuais. O script pede confirmação explícita.
# Teste a restauração periodicamente (requisito 29) — de preferência em uma
# VPS/ambiente de homologação, não direto em produção.
# ==============================================================================
set -euo pipefail

DB_BACKUP="${1:-}"
MINIO_BACKUP="${2:-}"
if [[ -z "$DB_BACKUP" ]]; then
  echo "Uso: bash scripts/restore.sh <db_backup.dump.gz[.enc]> [minio_backup.tar.gz[.enc]]"
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
set -a; source .env; set +a
COMPOSE="docker compose -f docker-compose.prod.yml"

read -r -p "Isso SUBSTITUI os dados atuais do banco '${POSTGRES_DB}'. Digite RESTAURAR para confirmar: " CONFIRM
[[ "$CONFIRM" == "RESTAURAR" ]] || { echo "Cancelado."; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

decrypt_if_needed() {
  local file="$1"
  if [[ "$file" == *.enc ]]; then
    [[ -n "${BACKUP_PASSPHRASE:-}" ]] || { echo "ERRO: backup criptografado; defina BACKUP_PASSPHRASE"; exit 1; }
    local out="$WORK/$(basename "${file%.enc}")"
    openssl enc -d -aes-256-cbc -pbkdf2 -in "$file" -out "$out" -pass env:BACKUP_PASSPHRASE
    echo "$out"
  else
    echo "$file"
  fi
}

echo "==> Restaurando banco..."
DB_FILE="$(decrypt_if_needed "$DB_BACKUP")"
gunzip -kc "$DB_FILE" > "$WORK/db.dump"
$COMPOSE stop api worker
cat "$WORK/db.dump" | $COMPOSE exec -T postgres pg_restore \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner
echo "    banco restaurado."

if [[ -n "$MINIO_BACKUP" ]]; then
  echo "==> Restaurando arquivos do MinIO..."
  MINIO_FILE="$(decrypt_if_needed "$MINIO_BACKUP")"
  $COMPOSE stop minio
  docker run --rm --volumes-from "$($COMPOSE ps -aq minio | head -1)" \
    -v "$(cd "$(dirname "$MINIO_FILE")" && pwd)":/backup alpine \
    sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$MINIO_FILE") -C /"
  $COMPOSE start minio
  echo "    arquivos restaurados."
fi

$COMPOSE start api worker
echo "==> Restauração concluída. Verifique: curl -fsS https://\$APP_DOMAIN/api/health"
