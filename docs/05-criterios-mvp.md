# Critérios de aceitação do MVP (requisito 36) — verificação item a item

> Atualizado em 04/08/2026, ao final da Fase 5. "Evidência" aponta o teste
> automatizado ou o procedimento que comprova o critério.

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | Superadministrador consegue criar um escritório | ✅ | e2e `tenant-isolation` e `fase2-flow` (POST /admin/tenants); painel do superadmin lista escritórios |
| 2 | Escritório consegue cadastrar usuários | ✅ | e2e (POST /users com papéis); limite por plano testado em código |
| 3 | Escritório consegue cadastrar empresas | ✅ | e2e `fase2-flow` (CNPJ validado, duplicata recusada) + importação CSV (`fase4-flow`) |
| 4 | Usuários acessam apenas empresas autorizadas | ✅ | Cliente do portal: filtro duplo tenant+vínculo (e2e `fase3-flow`); demais papéis por permissão |
| 5 | Tarefas recorrentes geradas automaticamente | ✅ | Motor `planTasks` (17 testes de datas) + worker diário 06:00 + e2e de idempotência |
| 6 | Contador consegue solicitar documentos | ✅ | e2e `fase3-flow`; tela /solicitacoes |
| 7 | Cliente recebe a solicitação | ✅ | Notificação in-app + e-mail enfileirado; portal exibe (e2e + smoke web) |
| 8 | Cliente consegue enviar arquivos | ✅ | Upload multipart real p/ MinIO (e2e + smoke com download byte a byte) |
| 9 | Contador aprova ou rejeita arquivos | ✅ | e2e: rejeição exige motivo; cliente notificado; status agregado recalcula |
| 10 | Sistema registra todo o histórico | ✅ | audit_logs (206+ registros no teste de backup) + responsibility_timeline append-only |
| 11 | Dashboard apresenta pendências | ✅ | /dashboard (contadores reais) + /fechamento (semáforo req. 8) |
| 12 | Sistema identifica tarefas vencidas | ✅ | Worker marca VENCIDA diariamente; e2e `fase4` (vencida ⇒ painel VERMELHO) |
| 13 | Relatórios podem ser exportados | ✅ | CSV/XLSX/PDF verificados por conteúdo e magic bytes (e2e `fase4-flow`) |
| 14 | Dados isolados por tenant | ✅ | 3 camadas (JWT→contexto→Prisma scoped fail-closed) + testes de isolamento em TODAS as suítes e2e |
| 15 | Aplicação instalável em VPS | ⚠️ parcial | Imagens Docker de produção **buildadas e testadas em execução** (API respondeu health+login, worker agendou crons e processou fila real de e-mails, web serviu páginas); `install-vps.sh` pronto, mas o ensaio ponta a ponta (DNS+TLS+compose com Nginx) exige uma **VPS limpa dedicada** — a atual compartilha as portas 80/443 com outros sistemas. Fazer no primeiro deploy real. |
| 16 | Backups gerados e restaurados | ✅ | Teste na VPS: pg_dump→criptografia AES-256→restore com contagens idênticas em 8 tabelas + ciclo completo do MinIO |
| 17 | Logs de auditoria funcionando | ✅ | Interceptor + chamadas explícitas; consultados nos smoke tests; campos sensíveis redigidos |

## Pendências conscientes para o primeiro deploy real (fora do escopo de código)

1. **VPS dedicada** + domínio + DNS wildcard → rodar `bash scripts/install-vps.sh <dominio>` e validar o item 15 por completo.
2. **SMTP** (`SMTP_*` no `.env`) para os e-mails saírem de fato (hoje ficam registrados com o motivo).
3. **ClamAV** nos uploads (validação atual: extensão + MIME + tamanho + bucket privado).
4. Validação contábil das regras de vencimento estaduais/municipais (req. 37.10).

## Pós-MVP contratado (requisito 35, segunda lista)

WhatsApp Cloud API · validador avançado de XML (NF-e/CT-e/NFS-e) · certificados e
procurações com criptografia · integrações oficiais (Integra Contador) · cobrança
de assinaturas · white-label completo · IA assistiva.
