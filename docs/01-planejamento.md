# RADAR CONTÁBIL — Planejamento Técnico

> Versão 1.0 — 04/08/2026. Este documento é a base de decisão do projeto.
> Alterações de arquitetura devem ser registradas aqui com justificativa.

---

## 1. Resumo do produto

Plataforma SaaS multi-tenant de **controle, auditoria e prevenção** para escritórios de
contabilidade, contadores autônomos, consultorias tributárias e BPOs. Não substitui o
sistema contábil: atua como camada de governança que responde diariamente
"o que está faltando, o que está vencendo, quem é o responsável e o que já foi comprovado".

Pilares funcionais:

1. **Obrigações e tarefas recorrentes** — calendário fiscal com regras de vencimento e dias úteis.
2. **Documentos** — solicitação, cobrança automática, recebimento via portal do cliente, central organizada.
3. **Auditoria e prova** — linha do tempo de responsabilidade imutável + logs de auditoria.
4. **Validação fiscal** — validador de XML (NF-e, NFC-e, CT-e, MDF-e, NFS-e) e comparação de arquivos.
5. **Comunicação** — e-mail, WhatsApp (fase pós-MVP), notificações internas.

Promessa: *"Nenhuma obrigação esquecida. Nenhum documento perdido. Nenhum erro fiscal silencioso."*

---

## 2. Proposta de arquitetura

### Visão geral

```
                        ┌────────────────────────── VPS Ubuntu ──────────────────────────┐
 Internet ── HTTPS ──▶  │  Nginx (TLS, subdomínios *.guardiaofiscal.com.br, rate limit)  │
                        │     ├─▶ frontend  : Next.js 15 (SSR, portal + painel)          │
                        │     ├─▶ api       : NestJS 11 (REST, OpenAPI, RBAC, tenant)    │
                        │     └─▶ minio     : console/objetos via rotas assinadas        │
                        │  api ──▶ PostgreSQL 16 (dados, isolamento por tenant_id)       │
                        │  api ──▶ Redis 7 (cache, filas BullMQ, sessões/ratelimit)      │
                        │  worker: BullMQ (recorrência, e-mails, validação XML, backups) │
                        │  MinIO (S3): documentos, versões, backups criptografados       │
                        └────────────────────────────────────────────────────────────────┘
```

### Stack (conforme requisito 26, confirmada)

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Backend | NestJS 11 + TypeScript | Modular, DI, guards/interceptors ideais p/ RBAC e auditoria transversal |
| ORM | Prisma 6 + PostgreSQL 16 | Migrations versionadas, tipagem forte, extensão p/ filtro de tenant |
| Frontend | Next.js 15 (App Router) + Tailwind | SSR p/ portal rápido, middleware p/ auth, tema por tenant |
| Filas | Redis 7 + BullMQ 5 | Recorrência de tarefas, lembretes, validação assíncrona de XML |
| Arquivos | MinIO (API S3) | Na própria VPS, com caminho de migração p/ S3 externo sem mudar código |
| Infra | Docker Compose + Nginx + Let's Encrypt | Implantação reprodutível em VPS única, escala vertical primeiro |

Decisões-chave:

- **Monolito modular** (não microserviços): 1 VPS, equipe pequena, domínios fortemente
  acoplados (tarefa ↔ obrigação ↔ documento ↔ auditoria). Os módulos NestJS já isolam
  fronteiras; extração futura é possível pois worker e api compartilham apenas o banco e filas.
- **Worker separado da API**: jobs pesados (XML, PDF, e-mail em massa) nunca degradam a API.
- **API REST com OpenAPI** gerado automaticamente (Swagger) — contrato para o frontend e
  para integrações futuras.

## 3. Módulos do sistema

| # | Módulo | Fase |
|---|---|---|
| M01 | Autenticação e sessões (JWT + refresh rotativo, 2FA) | 1 |
| M02 | Multi-tenant (resolução por subdomínio, isolamento, branding) | 1 |
| M03 | Tenants/Escritórios (cadastro, planos, limites, status) | 1 |
| M04 | Usuários, papéis e permissões (RBAC granular) | 1 |
| M05 | Empresas atendidas (cadastro completo, responsáveis, etiquetas) | 2 |
| M06 | Obrigações (templates, regras de vencimento, dias úteis, feriados) | 2 |
| M07 | Tarefas (recorrência, checklist, status, kanban/lista/calendário) | 2 |
| M08 | Solicitação de documentos + cobranças automáticas | 3 |
| M09 | Portal do cliente (upload, acompanhamento) | 3 |
| M10 | Central de documentos (versões, links temporários) | 3 |
| M11 | Notificações (sistema + e-mail; WhatsApp pós-MVP) | 3 |
| M12 | Dashboard e painel de fechamento mensal | 4 |
| M13 | Linha do tempo de responsabilidade + logs de auditoria | 1 (base) / 4 |
| M14 | Relatórios e exportações (PDF/XLSX/CSV) | 4 |
| M15 | Validador fiscal XML + comparação de arquivos | pós-MVP |
| M16 | Certificados e procurações | pós-MVP |
| M17 | Integrações (camada abstrata, WhatsApp, Integra Contador) | pós-MVP |
| M18 | Billing/assinaturas (planos, trial, bloqueio) | pós-MVP |
| M19 | Superadmin (métricas globais, comunicados) | 4 |
| M20 | IA assistiva | futuro |

## 4. Fluxo dos usuários

1. **Superadmin** → cria plano → cria escritório (tenant) + admin inicial → acompanha métricas.
2. **Admin do escritório** → acessa `escritorio.dominio.com.br` → personaliza marca → cadastra
   funcionários e empresas → configura obrigações → define responsáveis.
3. **Contador/analista** → vê apenas empresas atribuídas → executa tarefas geradas
   automaticamente → solicita documentos → confere/valida → conclui.
4. **Cliente** → recebe e-mail/WhatsApp → entra no portal → envia arquivos → acompanha status.
5. **Auditor** → revisa fechamentos, aprova/reprova, consulta linha do tempo — sem poder de exclusão.

## 5. Modelo multi-tenant

- **Single database, shared schema, coluna `tenant_id`** em toda tabela de negócio.
- Resolução do tenant: subdomínio (`escritorio1.…`) → slug → tenant; fallback header
  `X-Tenant` (dev) e claim `tid` no JWT (fonte de verdade após login).
- **Defesa em profundidade (3 camadas):**
  1. JWT carrega `tid`; guard injeta em `TenantContext` (AsyncLocalStorage);
  2. Extensão do Prisma injeta `tenant_id` automaticamente em `where`/`data` de todos os
     modelos tenant-scoped — um esquecimento no service não vaza dados;
  3. Testes automatizados de isolamento (requisito 39) rodam no CI: tenant A jamais lê B.
- Superadmin: `tenant_id = NULL`, rotas próprias `/admin/*` com guard exclusivo.
- Por que não schema-per-tenant ou DB-per-tenant: centenas de escritórios pequenos em 1 VPS —
  migrations e backup ficariam O(n); shared schema + extensão dá isolamento com custo O(1).
  Enterprise futuro pode ter instância dedicada (mesmo compose, outra VPS).

## 6–7. Entidades do banco e relacionamentos

Entidades completas conforme requisito 25. Núcleo e relacionamentos principais:

```
plans 1─N tenants 1─N subscriptions
tenants 1─N users (users.tenant_id NULL = superadmin)
users N─N roles (user_roles) ; roles N─N permissions (role_permissions)
tenants 1─N companies 1─N company_contacts / company_responsibles
tenants 1─N departments
obligation_templates → obligations (por empresa) 1─N obligation_rules
obligations 1─N tasks (por competência) 1─N task_checklists / task_comments / task_files
tasks N─N tasks (task_dependencies)
companies 1─N document_requests 1─N document_request_items 1─N document_reminders
document_request_items 1─N documents 1─N document_versions ; documents N─1 document_categories
documents 1─N fiscal_documents 1─N fiscal_validations 1─N validation_errors
companies 1─N certificates / powers_of_attorney
tenants 1─N integrations 1─N integration_logs
users 1─N notifications ; tenants 1─N messages
* 1─N audit_logs / responsibility_timeline (append-only, sem FK de cascade delete)
holidays (nacional/estadual/municipal) — consultada pelo motor de recorrência
reports / exports / webhooks / billing_events / usage_metrics / support_tickets
```

Convenções: UUID v4 em todas as PKs; `created_at`/`updated_at` em tudo; `deleted_at`
(soft delete) onde exclusão lógica se aplica — **nunca** em `audit_logs` e
`responsibility_timeline` (append-only); índices em toda FK e em
`(tenant_id, <coluna de busca>)`; constraint `UNIQUE (tenant_id, cnpj)` em companies etc.

A Fase 1 implementa: `plans, tenants, subscriptions, users, refresh_tokens, roles,
permissions, role_permissions, user_roles, companies (núcleo), audit_logs`.
As demais entram nas fases seguintes, sempre via migration.

## 8. Estrutura de diretórios (monorepo pnpm)

```
guardiao-fiscal/
├── apps/
│   ├── api/          # NestJS (REST + OpenAPI)
│   │   ├── prisma/   # schema, migrations, seed
│   │   └── src/{auth,tenants,users,admin,common,prisma,audit,health}/
│   ├── web/          # Next.js (painel + portal do cliente)
│   └── worker/       # BullMQ (recorrência, e-mails, validação)
├── packages/
│   └── shared/       # tipos, enums, constantes compartilhadas
├── docker/nginx/     # proxy reverso, TLS, subdomínios
├── scripts/          # install-vps.sh, backup.sh, restore.sh
├── docs/             # planejamento, execução, segurança, implantação
├── docker-compose.yml        # desenvolvimento
└── docker-compose.prod.yml   # produção (VPS)
```

## 9. Estratégia de segurança

- **Senhas**: Argon2id (nunca texto puro). Política de senha forte no DTO.
- **Sessões**: access token JWT 15 min + refresh token rotativo 7 dias, armazenado com hash
  SHA-256 no banco, revogável por dispositivo; reuso de refresh revogado invalida a família.
- **2FA**: TOTP (fase 2 do módulo de auth), segredo criptografado.
- **Transporte**: HTTPS obrigatório (Nginx + Let's Encrypt), HSTS.
- **Aplicação**: Helmet, CORS restrito por tenant, rate-limit (@nestjs/throttler + Nginx),
  validação global de DTOs (whitelist + forbidNonWhitelisted → mata mass-assignment),
  Prisma parametrizado (SQL injection), uploads: extensão + MIME + tamanho + antivírus
  (ClamAV na fase 3) + armazenamento fora do webroot (MinIO, sem acesso público).
- **Segredos**: apenas variáveis de ambiente (`.env` fora do git, `.env.example` versionado);
  certificados digitais criptografados com AES-256-GCM e chave dedicada (`ENCRYPTION_KEY`).
- **Auditoria**: interceptor global grava audit_logs (usuário, tenant, IP, user-agent,
  antes/depois); logs nunca contêm senha/token/certificado.
- **LGPD**: classificação de sensibilidade nos campos, exportação e anonimização de dados
  do titular (fase 4), política de retenção configurável.

## 10. Estratégia de implantação na VPS

1. VPS Ubuntu 22.04/24.04 (mínimo recomendado: 4 vCPU, 8 GB RAM, 160 GB SSD).
2. `scripts/install-vps.sh`: instala Docker + Compose, configura UFW (22/80/443),
   fail2ban, clona o repositório, gera `.env` a partir do exemplo, sobe o compose de
   produção, roda `prisma migrate deploy` e o seed inicial.
3. Nginx em container: TLS (certbot webroot), wildcard/subdomínios por tenant, proxy
   para web (3000) e api (3001), limites de upload e rate.
4. Backups: `scripts/backup.sh` via cron — `pg_dump` diário + espelho dos buckets MinIO,
   compressão + criptografia (age/GPG), retenção configurável, cópia externa opcional
   (rclone). `scripts/restore.sh` documentado e testado periodicamente (requisito 29).
5. Logs centralizados via Docker json-file com rotação; monitoramento com healthchecks
   do compose + endpoint `/health` (uptime-kuma opcional).
6. Atualização: `git pull && docker compose build && docker compose up -d` + migrations
   automáticas no boot da API (`migrate deploy`).

## 11. Roadmap por fases

| Fase | Conteúdo | Duração estimada |
|---|---|---|
| **1 — Fundação** | Monorepo, Docker, PostgreSQL, Redis, MinIO, NestJS, Next.js, auth completa, multi-tenant, RBAC, tenants/usuários, audit log base, seed, docs | 2–3 semanas |
| **2 — Núcleo operacional** | Empresas (cadastro completo), departamentos, obrigações + regras de vencimento + feriados, motor de recorrência (worker), tarefas + visualizações | 3–4 semanas |
| **3 — Documentos e portal** | Solicitações, lembretes automáticos, portal do cliente, upload seguro p/ MinIO, central de documentos, notificações por e-mail | 3–4 semanas |
| **4 — Gestão e prova** | Dashboard, fechamento mensal, linha do tempo de responsabilidade, relatórios PDF/XLSX/CSV, pesquisa global, importação CSV, superadmin | 3 semanas |
| **5 — MVP hardening** | Testes de isolamento/e2e, backup/restore validados, instalação VPS de ponta a ponta, critérios do requisito 36 | 1–2 semanas |
| **Pós-MVP** | WhatsApp Cloud API, validador XML avançado, certificados/procurações, billing, white-label completo, Integra Contador, IA | contínuo |

## 12. Critérios de aceitação da Fase 1

- [ ] `docker compose up` sobe Postgres, Redis, MinIO, api, web e worker sem erro.
- [ ] `prisma migrate deploy` aplica a migration inicial; seed cria superadmin, planos e tenant demo.
- [ ] Superadmin faz login e cria um escritório via `POST /admin/tenants` (com admin inicial).
- [ ] Admin do escritório loga no subdomínio/slug do tenant e cadastra usuários.
- [ ] Access token expira em 15 min; refresh rotativo funciona; logout revoga a sessão.
- [ ] Usuário do tenant A recebe 404/403 ao tentar ler qualquer recurso do tenant B (teste automatizado).
- [ ] Toda mutação gera registro em `audit_logs` com usuário, tenant, IP e diff.
- [ ] OpenAPI disponível em `/docs` (somente fora de produção ou autenticado).
- [ ] README permite a um dev subir o ambiente do zero em < 15 minutos.

## 13. Riscos técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| Vazamento entre tenants por query sem filtro | Crítico | Extensão Prisma automática + testes de isolamento no CI (não opcional) |
| Regras de vencimento/dias úteis/feriados municipais erradas | Alto | Tabela `holidays` editável por tenant + engine testada com casos reais; validação contábil (item 15 abaixo) |
| Diversidade de leiautes NFS-e municipais | Alto | Pós-MVP; arquitetura de validadores plugáveis por leiaute |
| WhatsApp Cloud API: aprovação de templates e custos | Médio | Abstração de canal (e-mail primeiro); fila com retry e fallback |
| VPS única = ponto único de falha | Médio | Backups externos + restore testado + compose portável p/ nova VPS em < 1 h |
| Upload malicioso | Alto | Validação MIME + ClamAV + bucket privado + links assinados expiráveis |
| Crescimento de armazenamento (XML/PDF) | Médio | Quotas por plano + métricas de uso + compressão + política de retenção |
| LGPD (dados fiscais sensíveis) | Alto | Criptografia em repouso p/ certificados, RBAC granular, trilha de auditoria, DPA com clientes |
| Reforma tributária (IBS/CBS) muda leiautes | Médio | Validador versionado por vigência de leiaute |

## 14. Integrações futuras (camada abstrata)

Interface `IntegrationProvider` (status, credenciais criptografadas, homologação/produção,
logs, retry com backoff, rate limit, alertas de falha) com adapters:
e-mail SMTP (fase 3, primeiro canal real) → WhatsApp Cloud API → Integra Contador (SERPRO)
→ webhooks de saída → gateways de pagamento → sistemas contábeis (Domínio, Alterdata…).
Regra: nunca automação frágil de navegador quando houver API oficial.

## 15. Complexidade estimada por módulo

| Módulo | Complexidade | Observação |
|---|---|---|
| Auth + multi-tenant + RBAC | Alta | Base de tudo; erro aqui compromete o produto |
| Tenants/usuários/empresas | Média | CRUD com regras de limite por plano |
| Obrigações + recorrência + dias úteis | **Alta** | Motor de datas é o coração fiscal; precisa validação contábil |
| Tarefas + visualizações | Média | Volume de UI |
| Documentos + portal + upload | Alta | Segurança de arquivos + UX do cliente leigo |
| Cobranças automáticas | Média | Idempotência e anti-spam |
| Dashboard/fechamento | Média | Agregações e cache |
| Linha do tempo/auditoria | Média | Append-only, imutabilidade |
| Relatórios/exportações | Média | Geração assíncrona no worker |
| Validador XML | **Alta** | Schemas SEFAZ, assinatura digital, regras por documento |
| Certificados/procurações | Média | Criptografia forte |
| Billing | Média | Estados de assinatura e bloqueio parcial |
| White-label/DNS | Média | Certificados por domínio custom |
| IA | Alta | Futuro; nunca altera dado fiscal sem aprovação humana |

### Pontos que exigem validação jurídica/contábil (requisito 37.10)

- Regras de vencimento de cada obrigação por UF/município/regime (validar com contador).
- Texto dos termos de uso, política de privacidade e bases legais LGPD (validar com jurídico).
- Retenção legal de documentos fiscais (prazos de guarda) antes de qualquer exclusão.
- Comunicação de cobrança a clientes (tom e registro probatório).

### Integrações que exigirão credenciais do cliente (requisito 37.9)

SMTP (fase 3), WhatsApp Cloud API (Meta Business), Integra Contador (SERPRO),
gateway de pagamento, S3 externo opcional, DNS para subdomínios wildcard.
