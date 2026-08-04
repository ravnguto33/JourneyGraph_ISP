# Handoff — Prompt de Desenvolvimento do JourneyGraph MNO (São Paulo / Claro)

**Para continuar em uma sessão local do Claude Code, com acesso ao filesystem Windows**

> Este documento existe porque o trabalho começou numa sessão do Claude Code **on the web** (container remoto, isolado, só com este repositório clonado — sem acesso a `C:\PERSDEV\...`). Para avançar, a tarefa precisa de leitura de arquivos que só existem na sua máquina local. Abra uma sessão local do Claude Code neste repositório (ou anexe este repositório à sessão local que já tem acesso a `C:\PERSDEV`) e cole este documento como ponto de partida — ele contém todo o contexto acumulado até aqui.

---

## 1. O pedido original

Escrever um **prompt de desenvolvimento** (no mesmo formato/padrão de `docs/JOURNEYGRAPH_BAYES_MARKOV_PROMPT.md` e `docs/NETGRAPH_PROMPT.md`) para criar uma variante do JourneyGraph voltada a **MNO** (operadora móvel), usando **São Paulo** como praça, com:

- Antenas e cobertura reais da **Anatel**;
- Malha territorial do **IBGE** (mencionado como referência, ainda não confirmado com o usuário se entra de fato ou fica de fora — ver §4, item aberto);
- O mesmo padrão de personas do StepGraph, reaproveitando o **pipeline de geração de personas** já existente no projeto "Personas" (não o `step/index.html` deste repo, que hoje tem as personas fixas hardcoded no HTML);
- A arquitetura de **múltiplas cidades** já iniciada em outro projeto, com São Paulo como segunda praça (a primeira é Florianópolis, usada no JourneyGraph ISP atual).

Antes de escrever o prompt, o usuário pediu para eu levantar dúvidas primeiro — o que gerou a rodada de perguntas/respostas abaixo.

---

## 2. Decisões já tomadas (respostas do usuário — tratar como premissas fechadas)

1. **Dados de antenas Anatel**: **pipeline separado** (fora do navegador, fora do padrão "HTML único sem build" do resto da Lounge) que processa a **base real de antenas da Anatel**. Escopo inicial: **Claro**, mas **MNO deve ser parâmetro** do pipeline (não hardcode "Claro" no código — desenhar para trocar de operadora).
2. **Referência de pipeline de personas em React** (o que no StepGraph seria o equivalente): está em `C:\PERSDEV\poc_personas\pipeline`.
3. **Projeto de múltiplas cidades já iniciado**: está em `C:\PERSDEV\poc_personas_v2\pipeline4`.
4. **Estado atual do projeto Personas** (via `poc_personas`/`poc_personas_v2`): já existe **tanto**
   - o pipeline de geração da **base sintética coerente de CDRs de MNO**, **quanto**
   - uma **planilha de curadoria das personas**.

   A planilha **deve ser ampliada** com as novas personas necessárias para o JourneyGraph MNO, **mantida como ambiente de curadoria** (fonte de verdade editável por humano), e o **pipeline deve respeitá-la** — ou seja: a planilha não é só documentação, é *input* que o pipeline de geração de CDRs precisa consumir/obedecer, não um artefato gerado a partir do pipeline. Isso é uma restrição de design importante para o prompt final: qualquer geração automática de personas não pode sobrescrever ou ignorar o que está curado manualmente na planilha.

Nenhuma dessas decisões foi corrigida ou contestada pelo usuário — são premissas, não hipóteses a revalidar.

---

## 3. O que já existe neste repositório (`JourneyGraph_ISP`) e serve de referência

Estrutura relevante:

```
docs/
  JOURNEYGRAPH_BAYES_MARKOV_PROMPT.md   ← MODELO de formato para o prompt a escrever
  NETGRAPH_PROMPT.md                     ← outro exemplo do mesmo padrão
  PADRAO_DOCUMENTACAO_PRODUTO.md         ← padrão de documentação de produto da Vísent
  produtos/*.docx                        ← Product Reports gerados (JourneyGraph, NetGraph, StepGraph, Égide Vita, ITXView)
journeygraph/index.html                  ← app JourneyGraph ISP atual (Florianópolis, RADIUS+IPFIX, ~15.000 assinantes sintéticos)
step/index.html                          ← StepGraph atual; personas hoje são listas fixas no próprio HTML (não vêm de pipeline React)
netgraph/index.html
egide-vita/index.html
itxview/index.html
```

**Padrão dos "prompts de desenvolvimento"** (ver `docs/JOURNEYGRAPH_BAYES_MARKOV_PROMPT.md` na íntegra — leia antes de escrever o novo): documento markdown autocontido, sem depender de contexto de conversa anterior, com seções tipicamente:

1. Objetivo
2. Racional de decisões de design já tomadas (registrar o porquê, não só o quê)
3. Tabela "hoje → depois"
4. Dados necessários (o que precisa existir no `RAW` embutido no HTML)
5–N. Seções técnicas específicas do trabalho
Explicabilidade / requisitos técnicos / critérios de aceite (checklist) / fora de escopo
Última seção: **"Prompt-resumo"** — um único parágrafo denso, executável, que resume tudo, pensado para ser colado sozinho num agente sem mais contexto.

**Baseline técnico do JourneyGraph ISP atual** (para contraste com o que muda na variante MNO):
- Fonte de dados: **RADIUS RFC2866 + IPFIX/NetFlow** (fixo, banda larga). Campos obrigatórios: `Acct-Session-Id, _subscriber_id, Acct-Start-Time, Acct-Stop-Time, Acct-Input-Octets, Acct-Output-Octets`; recomendados: `_isp_segment, _arpu, _link_mbps, _instalacao_cidade, _instalacao_bairro, NAS-Port-Id`; IPFIX opcional: `session_id, dst_port, bytes_in, bytes_out, sni, protocol`.
- Personas: **K-Means++, k=8**, sobre 14 features comportamentais (mix de categorias, busy_hour, cv_daily, du_ratio, journey_entropy, gini_cats), rotuladas por `classify_persona()` — hoje calculado no pipeline de geração do `RAW` (fora do repo), não em React.
- Cidade única: Florianópolis. Sem parametrização multi-cidade hoje.
- Tudo client-side, HTML único, sem build step — **é o padrão que qualquer prompt novo deve preservar**, a menos que o próprio design multi-cidade/MNO exija romper isso conscientemente (documentar se romper).

Para uma variante **MNO**, o equivalente natural a RADIUS/IPFIX é **CDR de voz móvel e/ou sessão de dados móveis** — schema ainda não confirmado com o usuário (ver §4). O pipeline de antenas Anatel (decisão §2.1) provavelmente alimenta a camada de cobertura/localização que hoje, no ISP, vem de `_instalacao_cidade/_instalacao_bairro` fixos por assinante.

---

## 4. Itens ainda em aberto (não perguntar de novo do zero — retomar exatamente daqui)

Estes são os pontos que ainda precisam de uma leitura real dos arquivos locais antes de o prompt poder ser escrito com precisão (ao invés de suposição):

- [ ] **Ler `C:\PERSDEV\poc_personas\pipeline`** — entender a estrutura do pipeline de geração de CDRs de MNO: linguagem, como consome a planilha de curadoria, quais campos de CDR ele produz hoje (schema real de voz e/ou dados móveis), como parametriza segmentação/persona.
- [ ] **Ler `C:\PERSDEV\poc_personas_v2\pipeline4`** — entender o que já foi desenhado para multi-cidade: é generalização do pipeline v1, ou um pipeline paralelo? Como ele parametriza cidade? Já tem São Paulo ou só a estrutura?
- [ ] **Localizar e ler a planilha de curadoria de personas** (provavelmente dentro de um dos dois diretórios acima, ou referenciada por eles) — colunas, quantas personas já curadas, formato que o pipeline espera ao consumi-la.
- [ ] **Confirmar se a malha territorial do IBGE entra no escopo** deste prompt ou não — foi mencionada na minha pergunta original mas a resposta do usuário só confirmou a parte de antenas Anatel, não falou de IBGE explicitamente.
- [ ] **Confirmar o schema de CDR de voz móvel / sessão de dados móveis** a documentar no prompt — se o pipeline em `poc_personas` já define um schema real, usar esse; não inventar um novo.
- [ ] Decidir se o pipeline de antenas Anatel (MNO como parâmetro, escopo inicial Claro) é código **a ser criado agora** ou se também já existe algo equivalente em `poc_personas*` que só falta localizar.

Depois desses itens lidos, o passo seguinte é escrever `docs/JOURNEYGRAPH_MNO_PROMPT.md` (ou nome equivalente) seguindo o formato de `docs/JOURNEYGRAPH_BAYES_MARKOV_PROMPT.md`, cobrindo pelo menos:

1. Objetivo e racional (por que São Paulo/Claro, por que pipeline separado para antenas, por que a planilha de curadoria é fonte de verdade).
2. O que muda em relação ao JourneyGraph ISP atual (tabela hoje/depois: RADIUS+IPFIX → CDR móvel; Florianópolis única → multi-cidade parametrizada; personas hardcoded no HTML → pipeline de personas curado por planilha).
3. Dados necessários no `RAW` da variante MNO (schema de CDR, campos de antena/cobertura, personas).
4. Arquitetura multi-cidade (parametrização, o que é comum entre praças, o que é específico).
5. Requisitos técnicos (client-side, HTML único, sem build — confirmar se mantém).
6. Critérios de aceite.
7. Fora de escopo.
8. Prompt-resumo final.

---

## 5. Como retomar na sessão local

1. Abra o Claude Code local no diretório onde consegue enxergar tanto este repositório (`JourneyGraph_ISP`) quanto `C:\PERSDEV\poc_personas` e `C:\PERSDEV\poc_personas_v2` — ou rode sessões separadas e cole os trechos relevantes de um lado para o outro.
2. Cole este arquivo (`docs/HANDOFF_JOURNEYGRAPH_MNO.md`) como primeira mensagem de contexto.
3. Resolva os itens do checklist da §4 lendo os arquivos reais.
4. Escreva `docs/JOURNEYGRAPH_MNO_PROMPT.md` seguindo o roteiro da §4 (final) e o formato de `docs/JOURNEYGRAPH_BAYES_MARKOV_PROMPT.md`.
5. Commit na branch `claude/journeygraph-documentation-access-56he08` (branch de trabalho designada para este repositório) ou na branch que a sessão local indicar.

---

*Gerado a partir de uma sessão do Claude Code on the web em 2026-08-04, para transferência de contexto a uma sessão local com acesso ao filesystem Windows do usuário.*
