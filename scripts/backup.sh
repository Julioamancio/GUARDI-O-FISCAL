#!/usr/bin/env bash
# ==============================================================================
# GUARDIÃO FISCAL — backup diário (banco + arquivos MinIO)
# Agende no cron do host:
#   0 3 * * * /caminho/guardiao-fiscal/scripts/backup.sh >> /var/log/guardiao-backup.log 2>&1
# Retenção via BACKUP_RETENTION_DAYS (padrão 14). Criptografia opcional com
# BACKUP_PASSPHRASE (openssl aes-256). Cópia externa opcional com rclone
# (configure o remote e defina BACKUP_RCLONE_REMOTE, ex.: "meudrive:guardiao").
# ==============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
set -a; source .env; set +a

BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"
COMPOSE="docker compose -f docker-compose.prod.yml"
mkdir -p "$BACKUP_DIR"

echo "==> [$(date -Is)] Backup do PostgreSQL..."
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "$BACKUP_DIR/db_${STAMP}.dump"
gzip "$BACKUP_DIR/db_${STAMP}.dump"
DB_FILE="$BACKUP_DIR/db_${STAMP}.dump.gz"

echo "==> Backup dos buckets MinIO..."
$COMPOSE exec -T minio sh -c "
  mc alias set local http://localhost:9000 '$MINIO_ROOT_USER' '$MINIO_ROOT_PASSWORD' >/dev/null &&
  mc mirror --overwrite local/${MINIO_BUCKET_DOCUMENTS:-documentos} /data-backup-tmp 2>/dev/null || true
" || true
# Cópia dos dados do volume MinIO via tar (abordagem robusta, independe do mc)
docker run --rm --volumes-from "$($COMPOSE ps -q minio)" -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/minio_${STAMP}.tar.gz" /data
MINIO_FILE="$BACKUP_DIR/minio_${STAMP}.tar.gz"

if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "==> Criptografando backups..."
  for f in "$DB_FILE" "$MINIO_FILE"; do
    openssl enc -aes-256-cbc -pbkdf2 -salt -in "$f" -out "$f.enc" -pass env:BACKUP_PASSPHRASE
    rm -f "$f"
  done
  DB_FILE="$DB_FILE.enc"; MINIO_FILE="$MINIO_FILE.enc"
fi

echo "==> Verificando integridade..."
for f in "$DB_FILE" "$MINIO_FILE"; do
  [[ -s "$f" ]] || { echo "ERRO: backup vazio: $f"; exit 1; }
done

if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]] && command -v rclone >/dev/null 2>&1; then
  echo "==> Enviando cópia externa via rclone..."
  rclone copy "$DB_FILE" "$BACKUP_RCLONE_REMOTE/" --quiet
  rclone copy "$MINIO_FILE" "$BACKUP_RCLONE_REMOTE/" --quiet
fi

echo "==> Aplicando retenção (${RETENTION_DAYS} dias)..."
find "$BACKUP_DIR" -name "db_*" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "minio_*" -mtime +"$RETENTION_DAYS" -delete

echo "==> [$(date -Is)] Backup concluído: $DB_FILE | $MINIO_FILE"
