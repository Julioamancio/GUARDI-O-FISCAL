# Prompt pronto para gerar o Manual do Usuário no Claude (app)

> Copie TUDO abaixo da linha e cole no Claude. Se quiser o manual visual
> (artefato/página), peça no final "gere como página HTML"; se quiser Word/PDF,
> troque por "gere como documento".

---

Você é um designer instrucional especializado em manuais de software para
pessoas NÃO técnicas. Crie o **Manual do Usuário do Radar Contábil**, um
sistema web para escritórios de contabilidade. O manual terá **um capítulo por
papel de usuário**, do administrador da plataforma até o cliente final.

## O que é o produto (contexto que você deve usar)

**Radar Contábil** — sistema por assinatura que ajuda escritórios de
contabilidade a nunca perder prazos, receber documentos dos clientes sem
correr atrás e guardar prova de tudo. Identidade visual: azul (#2a78d6),
logo de antena de radar ciano, mascote robozinho 3D simpático. Tom da marca:
próximo, direto, sem juridiquês. Acesso pelo navegador (funciona no celular).

Conceitos que o manual deve explicar num glossário curto:
- **Escritório**: a conta de cada empresa de contabilidade (identificada por um
  código, ex.: "demo", usado na tela de entrada).
- **Competência**: o mês de referência das obrigações (formato 08/2026).
- **Obrigação**: um dever recorrente (DAS, FGTS, folha...) que gera tarefas
  automaticamente todo mês, já com feriados e dias úteis calculados.
- **Semáforo**: cores de situação — verde (concluído), amarelo (atenção),
  azul (em andamento), vermelho (vencido/crítico), cinza (não iniciado).
- **Solicitação de documentos**: pedido feito ao cliente; o sistema cobra
  sozinho (5 dias antes, 3 dias antes, no dia e depois do prazo).
- **Linha do tempo**: registro que não pode ser apagado de tudo que aconteceu
  com cada empresa (pedidos, envios, aprovações) — a "prova" do escritório.

## A tela de entrada (igual para todos)

Campos: **Escritório** (código do escritório), **E-mail**, **Senha**, botão
**"Entrar no meu escritório"**. Quem administra a plataforma marca a caixinha
**"Sou administrador da plataforma"** (e aí o campo Escritório some).

## Os papéis e o que documentar em cada capítulo

### Capítulo 1 — Dono da plataforma (superadministrador)
Quem vende o sistema. Documentar:
1. Entrar marcando "Sou administrador da plataforma".
2. Ler o painel: escritórios, usuários, empresas atendidas, tarefas e
   armazenamento; tabela de escritórios com plano e situação.
3. **Criar um escritório**: botão "+ Criar escritório" → razão social,
   identificador (gerado sozinho, editável), e-mail, plano (Contador
   Individual até 30 empresas / Escritório Pequeno até 100 / Profissional até
   300 / Enterprise), e dados do administrador inicial (nome, e-mail, senha de
   10+ caracteres com maiúscula, minúscula e número). Todo escritório novo
   ganha **14 dias de teste grátis**.
4. Entregar as credenciais ao cliente com segurança e orientar a troca de senha.

### Capítulo 2 — Administrador do escritório
O dono/sócio da contabilidade. Documentar:
1. Entrada com o código do escritório.
2. **Dashboard**: os 4 cartões (empresas ativas, tarefas em aberto, vencem em
   7 dias, vencidas), a rosquinha "Saúde do fechamento", tarefas por status e
   por departamento, evolução de 6 meses, próximos vencimentos — tudo clicável.
3. **Empresas**: cadastrar (o CNPJ é validado na hora), importar várias por
   planilha CSV (baixar modelo → validar → ver erros linha a linha → confirmar),
   abrir o detalhe, e **adicionar obrigações do catálogo** (DAS, FGTS, eSocial,
   ICMS, ISS...) — avisar que ICMS/ISS variam por estado/município e a regra é
   ajustável. Botão "⚡ Gerar tarefas agora" (o sistema também gera sozinho toda
   madrugada).
4. **Fechamento**: ler o semáforo por empresa e departamento; clicar nas
   bolinhas leva às tarefas filtradas.
5. **Tarefas**: filtros, mudar status direto na lista, exportar CSV/XLSX/PDF.
6. **Solicitações**: criar pedido de documentos (empresa, título, competência,
   prazo, itens comuns ou personalizados), acompanhar recebimento, **aprovar ou
   rejeitar com motivo** (o cliente é avisado), pausar cobranças, exportar o
   relatório de pendências.
7. **Linha do tempo** da empresa (no detalhe da empresa): consultar e exportar
   em PDF como prova.
8. **Busca** no topo: empresas, tarefas, documentos, solicitações.
> Nota a incluir: o cadastro de novos usuários da equipe e o vínculo de
> clientes ao portal são feitos hoje com apoio do administrador da plataforma
> (tela própria em desenvolvimento).

### Capítulo 3 — Contador / analista
Quem executa. Documentar: dashboard e próximos vencimentos como rotina diária;
trabalhar a fila de Tarefas (status: não iniciada → em andamento → em
conferência → aguardando aprovação → concluída); criar solicitações de
documentos e conferir o que o cliente mandou (aprovar/rejeitar com motivo);
baixar documentos por link seguro temporário.

### Capítulo 4 — Auditor / supervisor
Quem revisa. Documentar: leitura do Fechamento e do Dashboard; aprovação de
itens em conferência; consulta da Linha do tempo e dos relatórios; deixar claro
que este papel **não exclui nada** — é papel de conferência.

### Capítulo 5 — Cliente do escritório (o mais simples e ilustrado)
O dono de empresa que envia documentos. Público leigo — capricho redobrado:
1. Recebe e-mail avisando que o contador pediu documentos.
2. Entra no site com código do escritório, e-mail e senha → cai direto no
   **Portal**.
3. Vê os pedidos pendentes com prazo; cada item tem o botão **"📤 Enviar
   arquivo"** (aceita PDF, XML, XLS/XLSX, CSV, JPG, PNG, ZIP, TXT, OFX — até
   25 MB).
4. Situações do item: "Aguardando envio" → "Enviado — em conferência" →
   "Aprovado ✓" ou "Reenvio necessário" (com o motivo escrito; basta enviar de
   novo, o histórico de versões fica guardado).
5. "Documentos enviados": consultar e baixar tudo que já mandou.
6. Tranquilizar: os lembretes por e-mail param sozinhos quando ele envia.

## Formato do manual

- Capa com nome do produto e a promessa: "Seu escritório nunca mais perde um
  prazo".
- Sumário; um capítulo por papel (na ordem acima); glossário no fim.
- Passo a passo numerado com frases curtas; nome de botões e campos em
  **negrito** exatamente como aparecem na tela.
- Marcadores visuais: 💡 Dica, ⚠️ Atenção, ✅ Pronto quando.
- Em cada passo que merece imagem, insira o marcador
  `[CAPTURA: descrição exata da tela a fotografar]` para eu tirar os prints depois.
- Cada capítulo termina com "Perguntas frequentes" (3 a 5) e um checklist
  "Seu primeiro dia" com 5 itens.
- Linguagem: português do Brasil, simples, direta, acolhedora — escreva para
  alguém que tem pressa e não gosta de computador.
