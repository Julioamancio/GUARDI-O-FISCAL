# Execução em desenvolvimento

Pré-requisitos: **Node 20+**, **pnpm 9+** (`corepack enable`), **Docker**.

```bash
# 1. Clonar e configurar
git clone https://github.com/Julioamancio/GUARDI-O-FISCAL.git guardiao-fiscal
cd guardiao-fiscal
cp .env.example .env        # edite as senhas/segredos (openssl rand -base64 48)

# 2. Infra (Postgres, Redis, MinIO)
docker compose up -d

# 3. Dependências (gera pnpm-lock.yaml na primeira vez — commite o lockfile!)
pnpm install

# 4. Banco: migrations + seed (cria permissões, papéis, planos e superadmin)
pnpm prisma:generate
pnpm --filter @guardiao/api exec prisma migrate deploy
pnpm prisma:seed

# 5. Subir os serviços (3 terminais, ou use um multiplexador)
pnpm dev:api      # http://localhost:3001  (Swagger em /docs)
pnpm dev:web      # http://localhost:3000
pnpm dev:worker
```

## Fluxo de teste manual (critérios da Fase 1)

1. Acesse `http://localhost:3000` → redireciona para `/login`.
2. Marque **"Sou administrador da plataforma"** e entre com `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`.
3. Crie um escritório via API (Swagger `/docs` → `POST /admin/tenants`):
   ```json
   {
     "razaoSocial": "Contabilidade Exemplo LTDA",
     "slug": "exemplo",
     "email": "contato@exemplo.com.br",
     "planSlug": "escritorio-pequeno",
     "admin": { "name": "Maria Silva", "email": "maria@exemplo.com.br", "password": "SenhaForte123" }
   }
   ```
4. Saia e entre como admin do escritório: escritório `exemplo`, e-mail e senha acima.
5. Cadastre usuários via `POST /users` e liste com `GET /users`.
6. Confira a trilha na tabela `audit_logs` (`docker compose exec postgres psql -U guardiao -c 'select action, entity, "createdAt" from audit_logs order by "createdAt" desc limit 20'`).

## Testes

```bash
pnpm --filter @guardiao/api test        # unitários (auth: senha, rotação, reuso)
# e2e de isolamento entre tenants — exige banco migrado + seed:
pnpm --filter @guardiao/api test:e2e
```

## Solução de problemas

- **`prisma migrate deploy` falha**: confira `DATABASE_URL` no `.env` e se o Postgres do compose está saudável (`docker compose ps`).
- **API não sobe com erro de variável de ambiente**: a validação de boot exige `JWT_*` com 32+ caracteres e `ENCRYPTION_KEY` com 64 hex — é proposital.
- **Login retorna sempre 401**: verifique se o seed rodou (tabela `roles` populada).
