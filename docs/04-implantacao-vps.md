# Implantação na VPS (Ubuntu 22.04/24.04)

## Modo VPS COMPARTILHADA (demonstração — em uso desde 04/08/2026)

Para rodar junto com outros sistemas sem tocar nas portas 80/443 deles:

```bash
cd /root/guardiao-fiscal
docker compose -f docker-compose.shared.yml --env-file .env.shared up -d --build
docker compose -f docker-compose.shared.yml --env-file .env.shared exec api npx ts-node prisma/seed.ts
```

- Acesso: `http://IP_DA_VPS:8100` (única porta exposta; banco/redis/minio/api só na rede interna).
- Segredos e senha do superadmin: `/root/guardiao-fiscal/.env.shared` (não versionado, chmod 600).
- `COOKIE_SECURE=false` porque a demo é HTTP em porta alta — **não usar assim com clientes reais**;
  a migração para o modo produção (abaixo, com domínio+TLS) reaproveita os mesmos volumes? Não:
  volumes são da stack `guardiao-shared`; exporte via `scripts/backup.sh` adaptado ou recomece limpo.
- Parar tudo sem afetar os vizinhos: `docker compose -f docker-compose.shared.yml --env-file .env.shared down`
  (acrescente `-v` apenas se quiser APAGAR os dados da demo).

## Modo PRODUÇÃO (VPS dedicada com domínio)

Recomendado: 4 vCPU, 8 GB RAM, 160 GB SSD. Mínimo para piloto: 2 vCPU, 4 GB.

## DNS (antes de instalar)

| Registro | Tipo | Valor |
|---|---|---|
| `seudominio.com.br` | A | IP da VPS |
| `*.seudominio.com.br` | A | IP da VPS (subdomínios dos escritórios) |

## Instalação

```bash
ssh root@IP_DA_VPS
git clone https://github.com/Julioamancio/GUARDI-O-FISCAL.git guardiao-fiscal
cd guardiao-fiscal
bash scripts/install-vps.sh seudominio.com.br
```

O script instala Docker, configura UFW (22/80/443) + fail2ban, gera `.env` com
segredos aleatórios, emite o certificado TLS, builda e sobe todos os serviços,
aplica migrations e roda o seed. A senha do superadmin fica em
`SEED_SUPERADMIN_PASSWORD` dentro do `.env` — anote e troque no primeiro acesso.

> **Certificado wildcard**: o desafio HTTP-01 do script cobre o domínio raiz.
> Para `*.seudominio.com.br` é preciso DNS-01 (token da API do seu provedor de
> DNS). Até lá, use o caminho do domínio raiz ou emita por subdomínio conforme
> escritórios forem criados. Isso está no backlog da Fase 4 (white-label).

## Backups

```bash
# teste manual
bash scripts/backup.sh
# agendamento diário às 03:00
crontab -e
0 3 * * * /root/guardiao-fiscal/scripts/backup.sh >> /var/log/guardiao-backup.log 2>&1
```

Opcionais no `.env`: `BACKUP_RETENTION_DAYS` (padrão 14), `BACKUP_PASSPHRASE`
(criptografa com AES-256), `BACKUP_RCLONE_REMOTE` (cópia externa).
**Teste a restauração** (`scripts/restore.sh`) pelo menos 1x por trimestre, em homologação.

## Atualização de versão

```bash
cd guardiao-fiscal
git pull
docker compose -f docker-compose.prod.yml up -d --build   # migrations rodam no boot da API
```

## Operação

```bash
docker compose -f docker-compose.prod.yml ps          # status + healthchecks
docker compose -f docker-compose.prod.yml logs -f api # logs (rotação automática, 5x20MB)
curl -fsS https://seudominio.com.br/api/health        # monitoramento externo
```

Recomendado: apontar um Uptime Kuma / UptimeRobot para `/api/health`.
