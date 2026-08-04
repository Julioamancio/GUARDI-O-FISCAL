# 🤖 Radar Contábil

[![CI](https://github.com/Julioamancio/GUARDI-O-FISCAL/actions/workflows/ci.yml/badge.svg)](https://github.com/Julioamancio/GUARDI-O-FISCAL/actions/workflows/ci.yml)

> **Nenhuma obrigação esquecida. Nenhum documento perdido. Nenhum erro fiscal silencioso.**

Plataforma SaaS **multi-tenant** de controle, auditoria e prevenção fiscal para
escritórios de contabilidade, contadores autônomos, consultorias tributárias e
BPOs. Não substitui o sistema contábil — é a **camada de governança** que
responde diariamente: o que está faltando, o que está vencendo, quem é o
responsável e o que já foi comprovado.

Repositório: `https://github.com/Julioamancio/GUARDI-O-FISCAL`

---

## 📌 Estado atual do projeto (leia isto primeiro)

**Última atualização: 04/08/2026 — FASE 5 CONCLUÍDA: MVP COMPLETO. Imagens Docker de produção buildadas e testadas em execução; backup+restauração provados (contagens idênticas em 8 tabelas + MinIO); CI no GitHub Actions; checklist do requisito 36 em [docs/05-criterios-mvp.md](docs/05-criterios-mvp.md) (16/17 ✅; item 15 parcial — ensaio ponta a ponta pede VPS dedicada).**

| Fase | Conteúdo | Status |
|---|---|---|
| Planejamento | [docs/01-planejamento.md](docs/01-planejamento.md) — arquitetura, entidades, riscos, roadmap | ✅ concluído |
| **Fase 1 — Fundação** | Monorepo, Docker, Postgres/Redis/MinIO, API NestJS (auth + multi-tenant + RBAC + auditoria), Web Next.js (login/dashboard), worker BullMQ, scripts VPS/backup | ✅ concluída e testada na VPS em 04/08/2026 |
| Fase 2 — Núcleo operacional | Empresas (contatos, responsáveis por área, CNPJ validado, limite por plano), obrigações (catálogo com 10 templates BR + regras de vencimento), feriados 2025–2028 + estaduais/municipais, motor de datas fiscais, recorrência idempotente (API + worker 06:00 BRT), tarefas (status, checklist, comentários, resumo) **+ telas web**: dashboard com contadores reais, empresas (lista/cadastro/detalhe com catálogo de obrigações e gerador de tarefas), tarefas (filtros + status inline), sessão com renovação transparente no middleware e proxy autenticado | ✅ concluída e testada na VPS 04/08 |
| Fase 3 — Documentos e portal | Solicitações com itens e conferência (aprovar/rejeitar com motivo), upload seguro p/ MinIO (extensão+MIME+25MB, bucket privado, links assinados 5 min, versões imutáveis), portal do cliente (papel client vê SÓ empresas vinculadas), cobranças automáticas D-5/D-3/D-0 + diária pós-vencimento (máx. 10, anti-spam por UNIQUE no banco, pausável), notificações in-app + e-mail SMTP no worker. Telas: /solicitacoes e /portal | ✅ concluída e testada na VPS 04/08 |
| Fase 4 — Gestão e prova | Painel de fechamento mensal (semáforo do req. 8 por empresa/departamento), **linha do tempo de responsabilidade** append-only (autor denormalizado, IP, eventos de documentos/tarefas/cobranças) exportável, relatórios CSV/XLSX/PDF (tarefas, pendências de documentos, timeline), pesquisa global com permissões por categoria, importação CSV com pré-visualização e erros linha a linha, painel do superadmin (métricas + armazenamento por tenant) | ✅ concluída e testada na VPS 04/08 |
| Fase 5 — Hardening MVP | Imagens Docker de produção corrigidas (bug do prisma generate no worker) e validadas em execução; backup/restore testados com verificação de integridade; CI GitHub Actions (unit + e2e com Postgres/Redis/MinIO + build das 3 imagens); checklist do req. 36 | ✅ concluída 04/08 — ver [docs/05-criterios-mvp.md](docs/05-criterios-mvp.md) |
| Pós-MVP | WhatsApp, validador XML, certificados/procurações, billing, white-label, Integra Contador, IA | ⬜ |

### 🟢 Instância de demonstração NO AR

**`http://guardiao.187-77-36-21.nip.io`** (porta 80 — funciona atrás de proxies corporativos/escolares)
— o nginx do host repassa esse nome para a stack `guardiao-shared` na 8100 (arquivo próprio em
`/etc/nginx/sites-available/guardiao-demo`, sem tocar nos demais sites).
Endereço alternativo direto: `http://187.77.36.21:8100` (bloqueado por alguns proxies).
Credenciais do superadmin em `/root/guardiao-fiscal/.env.shared`.
Demo por HTTP (`COOKIE_SECURE=false`) — para clientes reais, migrar ao modo produção com domínio+TLS.

### 🎯 FASE 6 — COMPLETUDE DO PRODUTO (auditoria de 04/08/2026; retomar por aqui)

Lacunas encontradas comparando requisitos × código × telas. Em ordem de prioridade:

**Bloqueia o escritório de operar sozinho (APIs prontas, faltam as TELAS):**
1. Tela **Equipe/Usuários** (criar contador/auditor/cliente, ativar/desativar, papel) — API `/users` completa
2. **Vincular cliente ao portal** no detalhe da empresa — API `POST /companies/:id/clients/:userId` pronta
3. **Editar empresa** + gerenciar contatos e responsáveis por área na tela — APIs prontas (detalhe hoje é só leitura)
4. **Troca de senha** — ⚠️ nem o ENDPOINT existe (ChangePasswordDto está órfão no código); recuperação de senha depende de SMTP

**Completa a experiência diária:**
5. **Detalhe da tarefa** (checklist interativo + comentários — APIs prontas, UI só muda status)
6. Criar **tarefa manual** pela tela; **Central de documentos** (listar/baixar por empresa/competência — API pronta); upload direto pelo contador
7. **Sino de notificações** no topo — API `/notifications` pronta
8. Superadmin: **suspender/reativar** escritório na tela — API pronta
9. Visualizações **kanban/calendário** de tarefas (req. 10)

**Produção real (infra):** SMTP · domínio+TLS · ClamAV · VPS dedicada (`install-vps.sh` ponta a ponta) · cron de backup da instância demo

**Requisitos do escopo original ainda não construídos (pós-MVP contratado, req. 35):** 2FA · WhatsApp Cloud API · validador de XML · certificados/procurações · billing/assinaturas · white-label completo · Integra Contador · LGPD (telas de consentimento/exportação) · relatórios agendados por e-mail · IA

### Pendências para o PRIMEIRO DEPLOY REAL (fora do escopo de código)

1. **VPS limpa dedicada** + domínio + DNS wildcard → `bash scripts/install-vps.sh <dominio>` (fecha o item 15 do checklist).
2. **SMTP** no `.env` (sem isso, e-mails ficam registrados com o motivo, sem envio real).
3. ClamAV nos uploads; validação contábil das regras de ICMS/ISS (req. 37.10).

### Backlog pós-MVP (requisito 35, segunda lista)

WhatsApp Cloud API · validador avançado de XML · certificados/procurações · billing de assinaturas · white-label completo · Integra Contador · IA assistiva · complementos de UI (kanban/calendário, detalhe da tarefa, sino de notificações, ações do superadmin na tela — APIs prontas).

### Ambiente de teste na VPS (187.77.36.21 — compartilhada com outros projetos!)

- Clone em `/root/guardiao-fiscal`, `.env` de teste já configurado.
- Contêineres de teste: `gf-test-pg` (Postgres em `127.0.0.1:5433`) e `gf-test-redis`
  (`127.0.0.1:6380`) — portas internas escolhidas para **não conflitar** com os
  serviços existentes (3000, 3001, 5432, 80, 443 etc. estão OCUPADOS por outros projetos).
- Para testar API ao vivo usar porta **3101** e SEMPRE encerrar depois
  (`pkill -f dist/src/main.js`).
- Comandos remotos: aspas aninhadas quebram — enviar script via `scp` e rodar `bash script.sh`.

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
