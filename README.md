# 🛡️ Guardião Fiscal

> **Nenhuma obrigação esquecida. Nenhum documento perdido. Nenhum erro fiscal silencioso.**

Plataforma SaaS **multi-tenant** de controle, auditoria e prevenção fiscal para
escritórios de contabilidade, contadores autônomos, consultorias tributárias e
BPOs. Não substitui o sistema contábil — é a **camada de governança** que
responde diariamente: o que está faltando, o que está vencendo, quem é o
responsável e o que já foi comprovado.

Repositório: `https://github.com/Julioamancio/GUARDI-O-FISCAL`

---

## 📌 Estado atual do projeto (leia isto primeiro)

**Última atualização: 04/08/2026 — Fase 1 (Fundação) implementada, aguardando validação em ambiente com Node/Docker.**

| Fase | Conteúdo | Status |
|---|---|---|
| Planejamento | [docs/01-planejamento.md](docs/01-planejamento.md) — arquitetura, entidades, riscos, roadmap | ✅ concluído |
| **Fase 1 — Fundação** | Monorepo, Docker, Postgres/Redis/MinIO, API NestJS (auth + multi-tenant + RBAC + auditoria), Web Next.js (login/dashboard), worker BullMQ, scripts VPS/backup | ✅ código pronto · ⚠️ **pendente: rodar `pnpm install` + testes em máquina com Node 20 (esta máquina de dev não tem Node) e commitar o `pnpm-lock.yaml`** |
| Fase 2 — Núcleo operacional | Empresas (completo), departamentos, obrigações + regras de vencimento + feriados, motor de recorrência, tarefas | ⬜ próximo |
| Fase 3 — Documentos e portal | Solicitações, lembretes, portal do cliente, upload MinIO, central de documentos, e-mail | ⬜ |
| Fase 4 — Gestão e prova | Dashboard real, fechamento mensal, linha do tempo de responsabilidade, relatórios, pesquisa global, importação | ⬜ |
| Fase 5 — Hardening MVP | e2e completos, backup/restore validados, instalação VPS ponta a ponta (requisito 36) | ⬜ |
| Pós-MVP | WhatsApp, validador XML, certificados/procurações, billing, white-label, Integra Contador, IA | ⬜ |

### Pendências imediatas (retomar por aqui)

1. Em máquina com Node 20 + pnpm: `pnpm install` → commitar `pnpm-lock.yaml`.
2. `docker compose up -d` + migrate + seed + `pnpm --filter @guardiao/api test` e `test:e2e` (isolamento de tenants) — corrigir o que os testes apontarem.
3. Validar o build Docker dos três apps (`docker compose -f docker-compose.prod.yml build`).
4. Iniciar Fase 2 pelo módulo de **empresas** (schema já tem o núcleo de `companies`).

---

## 🗺️ Mapa do repositório

```
guardiao-fiscal/
├── docs/
│   ├── 01-planejamento.md        ← ARQUITETURA E DECISÕES (fonte de verdade)
│   ├── 02-execucao-dev.md        ← como rodar em desenvolvimento
│   └── 04-implantacao-vps.md     ← como implantar/operar na VPS
├── apps/
│   ├── api/                      ← NestJS (porta 3001, Swagger em /docs)
│   │   ├── prisma/               ← schema, migrations, seed (papéis/planos/superadmin)
│   │   └── src/
│   │       ├── auth/             ← login, refresh rotativo c/ detecção de reuso, logout, me
│   │       ├── admin/            ← superadmin: criar/listar/suspender escritórios, planos
│   │       ├── users/            ← usuários do escritório (limite por plano, papéis)
│   │       ├── audit/            ← trilha append-only (sanitiza dados sensíveis)
│   │       ├── prisma/           ← PrismaService + cliente `scoped` (ISOLAMENTO DE TENANT)
│   │       ├── common/           ← TenantContext (ALS), guards JWT/permissões, decorators
│   │       ├── config/           ← validação de ambiente no boot
│   │       └── health/           ← /health p/ Docker e monitoramento
│   ├── web/                      ← Next.js (porta 3000)
│   │   └── src/app/
│   │       ├── login/            ← login tenant/superadmin
│   │       ├── dashboard/        ← placeholder Fase 1 (indicadores reais nas fases 2–4)
│   │       └── api/session/      ← cookies httpOnly (tokens nunca expostos ao JS)
│   ├── worker/                   ← BullMQ (fila notifications; recorrência entra na Fase 2)
├── packages/shared/              ← papéis, permissões, filas, tipos compartilhados
├── docker/nginx/                 ← proxy, TLS, rate limit, subdomínios wildcard
├── scripts/                      ← install-vps.sh · backup.sh · restore.sh
├── docker-compose.yml            ← DEV: só infra (Postgres, Redis, MinIO)
└── docker-compose.prod.yml       ← PROD: tudo + nginx + certbot
```

## 🚀 Início rápido

**Desenvolvimento** → [docs/02-execucao-dev.md](docs/02-execucao-dev.md)
**Produção (VPS)** → [docs/04-implantacao-vps.md](docs/04-implantacao-vps.md) — resumo: aponte o DNS e rode `bash scripts/install-vps.sh seudominio.com.br`.

## 🔐 Decisões de segurança já implementadas (não regredir)

- **Isolamento de tenant em 3 camadas**: claim `tid` no JWT → `TenantContext`
  (AsyncLocalStorage) → **cliente Prisma `scoped`** que injeta `tenantId` em toda
  query e falha fechado sem contexto. Novos modelos de negócio DEVEM entrar em
  `TENANT_MODELS` ([prisma.service.ts](apps/api/src/prisma/prisma.service.ts)).
- Senhas com **Argon2id**; refresh token **rotativo** com hash SHA-256 no banco e
  **revogação da família inteira ao detectar reuso**.
- Tokens no navegador só em **cookies httpOnly** (rota `/api/session` da web).
- Mensagens de login **idênticas** em todo caminho de falha (anti-enumeração).
- Validação global de DTOs com `whitelist + forbidNonWhitelisted` (anti mass-assignment).
- Auditoria append-only com redação automática de campos sensíveis
  (`password|senha|secret|token|hash|certificado`). **Nunca** logar segredos.
- Boot da API **falha** se os segredos do `.env` forem fracos ou padrão.
- Teste e2e que **prova** que o escritório A não acessa dados do B
  ([tenant-isolation.e2e-spec.ts](apps/api/test/tenant-isolation.e2e-spec.ts)) — deve rodar em todo CI futuro.

## 📏 Regras de trabalho neste repositório

1. **Commit + push a cada etapa concluída** (pedido do dono do projeto).
2. Toda mudança de banco via **migration** (nunca editar migration já aplicada).
3. Requisitos completos e regras de qualidade: seção 38 do prompt original do
   produto; arquitetura e roadmap: [docs/01-planejamento.md](docs/01-planejamento.md).
4. Não criar telas sem funcionalidade nem "integrações" simuladas — o worker,
   por exemplo, registra explicitamente `delivered: false` até o SMTP existir (Fase 3).
5. Superadmin usa o cliente Prisma base; qualquer operação de escritório usa
   `prisma.scoped`. Em dúvida, use `scoped`.

## 👥 Papéis e credenciais

| Papel | Como surge | Acesso |
|---|---|---|
| `superadmin` | seed (`SEED_SUPERADMIN_*` no `.env`) | plataforma inteira, rotas `/admin/*` |
| `tenant_admin` | criado junto com o escritório (`POST /admin/tenants`) | tudo do escritório |
| `accountant` | `POST /users` | empresas/tarefas/documentos atribuídos |
| `client` | `POST /users` | portal do cliente (Fase 3) |
| `auditor` | `POST /users` | leitura + aprovação, sem exclusões |
