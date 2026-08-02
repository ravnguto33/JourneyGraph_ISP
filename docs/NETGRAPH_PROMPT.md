# Prompt de Desenvolvimento — NetGraph

**Vísent · CDRView ISP Edition — Service Assurance Inteligente**

> Este documento é um prompt completo, pronto para ser entregue a um desenvolvedor ou a um agente de IA (ex.: Claude Code), solicitando a construção do **NetGraph** como novo card da Lounge de Soluções ISP, no mesmo repositório do JourneyGraph e do StepGraph. Ele assume o leitor sem contexto prévio da conversa que o originou — todo o necessário está descrito abaixo.

---

## 1. Objetivo

Desenvolver o **NetGraph**, uma nova demonstração interativa (HTML/D3, single-file, no padrão dos demais apps da Lounge) que representa a camada de **Service Assurance** do **CDRView ISP Edition** — a versão SaaS multi-tenant do CDRView para provedores regionais de internet (ISPs).

O NetGraph deve fazer pela **rede** (topologia, capacidade, falhas, causa raiz) o que o JourneyGraph já faz pela **jornada do assinante**: transformar dados operacionais brutos em um grafo interativo, com alertas explicáveis e um Assistente conversacional que contextualiza tudo em normas, processos e dados de outras áreas da operação.

---

## 2. Por que a arquitetura do JourneyGraph (e não a do StepGraph)

O repositório já contém dois padrões arquiteturais distintos entre os quais escolher. A escolha correta é o **JourneyGraph**, pelos motivos abaixo — inclua esse racional no PR/commit de entrega, para registro:

| Critério | JourneyGraph | StepGraph |
|---|---|---|
| Modelo de dados nativo | Grafo nó-aresta (dígrafo força-dirigida, D3) | Fluxos O-D sobre mapa geográfico (Leaflet + curvas D3) |
| Alinhamento com o pedido | Topologia de rede é literalmente um grafo nó-aresta (POP → OLT → PON → ONT/CTO) | Mapa serve movimento geográfico de pessoas/dispositivos, não hierarquia de rede |
| Tela de Alertas | Já existe, com priorização, causa provável e encaminhamento | Não existe |
| Consulta individual restrita (senha, log de auditoria, escopo por papel) | Já existe (`Consulta Individual de Assinante`) — modelo direto para "Consulta Individual de Elemento de Rede" | Não existe |
| Assistente SLM/RAG com corpus técnico (Tech Reference) | Já existe, já cita RADIUS/IPFIX, ITU-T, TM Forum, Markov, Bayes | Não existe |
| Responsividade mobile (sidebars-gaveta, nav scrollável, alvos de toque) | Já validada em duas rodadas de auditoria | Parcial (só a correção pontual de nav-tabs/toque) |

**Conclusão:** clone a arquitetura de `journeygraph/index.html` (estrutura de telas, sidebars, dígrafo D3, tela de Alertas, Consulta Individual restrita e Assistente) e adapte o domínio de dados de "jornada do assinante" para "topologia e saúde de rede". Não parta do `step/index.html`.

---

## 3. Posicionamento de Produto

O NetGraph é um **módulo/vertical do CDRView ISP Edition** (Negócio 2 do plano 2026–2028 da Vísent), ao lado do Customer DNA™ (churn) e da Égide (verificação etária). Enquanto o Customer DNA responde "quem vai cancelar e por quê", o NetGraph responde:

- "Onde a rede vai falhar antes de falhar?" (predição)
- "Por que este conjunto de alertas está acontecendo?" (causa raiz)
- "Qual alerta eu resolvo primeiro?" (priorização por gravidade técnica × impacto de negócio)
- "Isso já virou reclamação? Vai virar multa da Anatel?" (correlação com CRM/Ouvidoria/regulatório)

Diferencial competitivo frente a MK BI, cVortex Analytics e soluções open-source (ntopng/Grafana): estas mostram métricas e dashboards; o NetGraph propõe **explicar e priorizar automaticamente**, unindo grafo + modelos probabilísticos + linguagem natural — o mesmo salto que o JourneyGraph propõe para jornada de assinante.

### Nível de fidelidade analítica exigido — importante

O corpus do Assistente do JourneyGraph é explícito (Anexo B / tr-17 / tr-50) em admitir que suas "causas prováveis" e seu Assistente são **heurísticas de score e mock por palavras-chave**, não Bayes, Markov ou RAG reais — e chega a dizer que implementar "Inferência Bayesiana real, Cadeias de Markov/HMM, Classificador supervisionado" seria "produto distinto".

**O NetGraph é esse produto distinto.** Diferente do JourneyGraph, o NetGraph deve calcular, client-side e em JavaScript puro (sem backend), modelos **matematicamente reais, ainda que simplificados**, sobre a base sintética:

- uma **matriz de transição de Markov** de fato estimada a partir do histórico sintético (contagem de transições observadas → normalização em probabilidades), não uma cor fixa por limiar;
- uma **rede Bayesiana simplificada** (ex.: 4–6 nós de causa candidata × probabilidades condicionais definidas a priori, atualizadas via regra de Bayes com a evidência dos alertas ativos), com posterior calculado de verdade, não apenas o alerta com maior score;
- um **detector de outlier real** (ex.: z-score robusto/MAD, ou IQR, ou uma Isolation Forest simplificada em poucas dezenas de linhas) rodando sobre a série sintética de cada métrica, não um limiar fixo disfarçado de "ML";
- uma **projeção de capacidade** por regressão real (linear ou exponencial simples) sobre o histórico sintético, com intervalo de confiança, não um número decorativo.

Mantenha o disclaimer de transparência do padrão Lounge ("dados de demonstração fictícios"), mas troque o disclaimer de *método* — o NetGraph deve poder dizer, com verdade, "os modelos abaixo são reais; os dados são sintéticos", e não o inverso.

---

## 4. Modelo de Dados — Grafo de Topologia de Rede

Construa uma topologia sintética de ISP regional, geograficamente coerente com a Grande Florianópolis já usada no StepGraph (mesmas zonas: Centro, Trindade/UFSC, Ingleses, Lagoa da Conceição, Estreito/Continente, São José/Kobrasol, Palhoça, Campeche) — reforça a coerência narrativa da Lounge como um único ISP fictício visto por múltiplas lentes.

**Hierarquia de nós (grafo dirigido/hierárquico):**

1. **Backbone/Core** — 1–2 nós (roteadores de borda, upstream/trânsito IP)
2. **POP** — 3–5 nós, um por região/zona
3. **Anel de distribuição (fibra)** — enlaces entre POPs, com capacidade nominal e utilização
4. **OLT** — 2–4 por POP
5. **PON/Splitter** — várias por OLT
6. **CTO/Caixa de atendimento** — várias por PON
7. **ONT/CPE do assinante** — folhas do grafo (agregadas por CTO na visão macro; individualizadas só na Consulta Individual restrita)

**Atributos por nó:** capacidade nominal, utilização atual (%), latência, perda de pacotes, uptime, nº de assinantes dependentes (downstream), SLA do contrato mais crítico atendido (residencial/corporativo), estado de saúde (Saudável/Degradado/Crítico/Falha), histórico sintético de série temporal (para Markov/outlier/capacidade).

**Atributos por aresta:** tipo de enlace, capacidade, utilização, latência, redundância (enlace único = SPOF).

---

## 5. Motor Analítico

### 5.1 Camada de Grafos — Análise Topológica

- Cálculo de **centralidade** (grau/betweenness simplificado) para identificar nós críticos.
- Identificação de **pontos únicos de falha (SPOF)**: nós/enlaces sem redundância cujo blast radius é alto.
- **Blast radius**: dado um nó em falha, calcular via travessia do grafo (BFS/DFS) todos os nós e assinantes downstream afetados.
- Visualização: dígrafo força-dirigida (D3, mesmo padrão do JourneyGraph — arrastar para fixar, clique para detalhe), cor por estado de saúde, espessura de aresta por utilização, ícone/badge para SPOF.

### 5.2 Camada de Markov — Predição de Degradação de Estado

- Estados por nó: `Saudável → Degradado → Crítico → Falha` (+ `Recuperado`).
- Matriz de transição estimada a partir da série sintética de cada classe de nó (OLT, PON, backbone…).
- Para cada nó, calcular a **probabilidade de transitar para um estado pior nas próximas N horas** (ex.: `P(Crítico em 4h | Degradado agora)`).
- Exibir essa probabilidade no painel de detalhe do nó e usá-la como um dos insumos de priorização de alerta.

### 5.3 Camada Bayesiana — Isolamento de Causa Raiz

- Rede Bayesiana simplificada com nós de causa candidata plausíveis para um ISP (ex.: rompimento de fibra, falha de energia/UPS no POP, sobrecarga de OLT, falha de equipamento ativo, ataque/anomalia de tráfego, degradação de trânsito upstream).
- Priors definidos a partir de frequência histórica sintética; likelihood dado o padrão de alertas correlacionados observados (quais nós downstream estão com sintoma simultâneo).
- Calcular o **posterior** sobre as causas candidatas e apresentar a causa mais provável **com o grau de confiança e as evidências que a sustentam** (não só um rótulo).

### 5.4 Camada de ML — Outliers e Capacidade

- **Detecção de outliers**: aplicar o detector real (5.3 acima) sobre métricas de latência, perda de pacote e utilização por nó, sinalizando desvios estatisticamente significativos mesmo abaixo de limiares fixos.
- **Predição de capacidade**: projeção de saturação (quando um enlace/OLT atinge 90–100% de utilização) via regressão sobre a série sintética, com data estimada e intervalo de confiança — insumo direto para planejamento de expansão de rede.
- **Predição de falha**: score de risco combinando Markov (5.2) + outlier (ML) + centralidade (5.1) em um índice único por nó.

### 5.5 Correlação por Impacto e Priorização de Alertas

- **Correlação**: quando um nó upstream falha, os alertas dos nós downstream devem ser agrupados sob o alerta-raiz (não listados como incidentes independentes) — usar o blast radius (5.1) para isso.
- **Priorização** por dois eixos explícitos, combinados em um score único e visível:
  - **Gravidade técnica**: estado (Markov), confiança da causa raiz (Bayes), score de outlier/risco (ML), SPOF ou não.
  - **Impacto de negócio**: nº de assinantes afetados, presença de clientes corporativos/SLA contratual diferenciado, sobreposição com reclamações já abertas no CRM (ver §6.2), risco de escalonamento à Ouvidoria/Anatel (ver §6.3–6.4).
- Ordenar a lista de Alertas por esse score combinado, não por hora de chegada.

### 5.6 Explicabilidade Obrigatória (todo alerta)

Nenhum alerta pode aparecer sem explicação. Cada alerta, ao ser expandido ou perguntado ao Assistente, deve mostrar:

1. **O quê**: métrica/nó/aresta e limiar ou padrão estatístico rompido.
2. **Por quê (causa provável)**: saída da rede Bayesiana (5.3), com as evidências que pesaram a favor e as descartadas.
3. **Para onde (tendência)**: probabilidade de piora via Markov (5.2).
4. **Quem é afetado**: blast radius (5.1) — número de assinantes, zonas, se há corporativo/SLA envolvido.
5. **Por que essa prioridade**: decomposição do score de 5.5 (gravidade técnica × impacto de negócio), em linguagem simples.
6. **O que fazer**: recomendação de ação (mesmo padrão de encaminhamento do JourneyGraph — Nível 1 semi-automático).
7. **Narrativa em linguagem natural**, gerada pelo Assistente (§6), citando a norma/processo pertinente quando aplicável (ex.: "este padrão de degradação se enquadra no indicador X do RQUAL").

---

## 6. Assistente SLM/RAG — Fontes de Contexto

Como no JourneyGraph, o NetGraph deve ter um Assistente conversacional (mesmo padrão de UI — aba dedicada + acionável a partir de qualquer alerta) cujo corpus (Tech Reference) cobrigatoriamente cubra as cinco fontes abaixo. Assuma o mesmo disclaimer de honestidade metodológica já usado no JourneyGraph para o *mecanismo* de busca (RAG por palavras-chave/templates sobre corpus estático, sem embeddings/LLM real de produção) — mas com os cálculos analíticos de §5 sendo reais, o Assistente deve narrá-los corretamente, não inventar números.

### 6.1 Cadastro Operacional e de Rede

- Inventário de elementos de rede (o próprio grafo de §4): capacidade nominal, data de instalação, fabricante/modelo, histórico de manutenção, redundância configurada.
- Deve alimentar diretamente as camadas analíticas (não é só "contexto de texto" — é a fonte de verdade dos nós/arestas).

### 6.2 Reclamações do Call Center (CRM)

- Volume sintético de reclamações por zona/nó nas últimas 24h–7d, categorizadas (lentidão, queda de conexão, sem sinal).
- Correlação temporal com alertas de rede: o Assistente deve conseguir responder "este alerta já gerou reclamações no CRM?" cruzando timestamp do alerta com abertura de tickets na mesma zona/CTO.

### 6.3 Ouvidoria e Anatel

- Segue o mesmo princípio de acesso controlado já implementado na Consulta Individual do JourneyGraph (autenticação, escopo por papel, log de auditoria imutável) sempre que a consulta atravessar de "elemento de rede" para "assinante identificável".
- Contexto a cobrir: prazos de resposta a reclamações escaladas à Ouvidoria interna e à Anatel, e como um incidente de rede não resolvido a tempo pode virar reclamação formal — o Assistente deve sinalizar proativamente alertas com risco de escalonamento (ex.: SPOF crítico + zona com histórico de reclamação alta).

### 6.4 Normas Anatel sobre Service Assurance

- **RQUAL** — Regulamento de Qualidade dos Serviços de Telecomunicações (Resolução Anatel nº 717/2019 — **validar edição vigente** com a área regulatória antes de publicar; a Anatel revisa periodicamente). Cobrir ao menos: indicadores de qualidade aplicáveis a SCM/banda larga, metas de disponibilidade e tempo de reparo, e como o NetGraph rastreia e projeta o cumprimento desses indicadores.
- **Selo/certificação de qualidade Anatel** e instrumentos correlatos de aferição pública de desempenho (ex.: painel/ranking de qualidade Anatel) — tratar como referência a ser mantida atualizada pela área regulatória, sem fixar números que possam ficar desatualizados no código.
- O corpus deve deixar explícito, como o JourneyGraph já faz em outros temas, que o texto normativo resumido no Assistente é uma **paráfrase para fins de demonstração**, não a transcrição literal do regulamento vigente.

### 6.5 Boas Práticas ITU-T e TM Forum

- **ITU-T M.3400** (funções de gerenciamento TMN, com foco em Fault Management) e o modelo **FCAPS** (Fault, Configuration, Accounting, Performance, Security) como enquadramento conceitual da camada de assurance.
- **TM Forum eTOM** (GB921, incorporado pela ITU-T na série M.3050 — mesma referência já usada no corpus do JourneyGraph) — mapear o NetGraph ao processo vertical **Assurance** do eTOM (Problem Handling, Service Quality Management, Resource Trouble Management).
- **TM Forum Open APIs** relevantes a citar como referência de interoperabilidade futura (não implementar): TMF642 (Alarm Management), TMF628 (Performance Management), TMF nRootCause.
- Seguir o mesmo estilo do JourneyGraph: citar a referência pública, e deixar claro que o resumo no corpus é elaborado a partir de material público, não transcrição literal de norma paga/restrita.

---

## 7. Telas e Navegação

Espelhar a estrutura de abas do JourneyGraph, adaptada ao domínio de rede:

1. **Topologia** (equivalente ao dígrafo principal) — grafo força-dirigida, cor por estado de saúde, clique para detalhe do nó (com Markov/outlier/capacidade), arrastar para fixar, filtro por zona/tipo de elemento.
2. **Alertas** — lista priorizada (§5.5), painel lateral com explicação (§5.6) e Assistente embutido, igual ao padrão `.alerts-layout` (coluna principal + coluna lateral, empilhando em mobile).
3. **Capacidade** — visão agregada de projeções de saturação (§5.4) por POP/OLT, com timeline de quando cada elemento estourará capacidade.
4. **Consulta Individual de Elemento de Rede** (modo restrito) — análogo direto à "Consulta Individual de Assinante" do JourneyGraph: senha, log de auditoria, e só disponível quando a consulta precisa descer até o nível de ONT/assinante específico (interceptação legal, apuração de ouvidoria, ou SLA de NOC — mesmas três hipóteses já documentadas no JourneyGraph).
5. **Assistente** — aba dedicada de chat RAG, mais acionável a partir de qualquer alerta ou nó (botão "Explicar" que abre o Assistente com a pergunta pré-formulada).

---

## 8. Dados Sintéticos e Coerência com a Lounge

- Reaproveitar as zonas geográficas do StepGraph (Grande Florianópolis) para o mapeamento POP↔zona, mantendo a Lounge como um único ISP fictício coerente entre apps.
- Gerar a topologia e as séries temporais de forma **determinística** (seed fixa), como já é padrão nos demais apps, para que o comportamento seja reprodutível em demonstrações.
- Manter o disclaimer padrão da Lounge: dados de demonstração fictícios, base sintética.

---

## 9. Requisitos Técnicos, Responsividade e Padrões do Repo

- Arquivo único autocontido: `netgraph/index.html`, seguindo a mesma stack (D3.js via CDN, sem framework de build), CSS com as mesmas variáveis de tema (`--bg`, `--panel`, `--accent` etc.) e mesma paleta escura/laranja da Lounge.
- **Aplicar desde o início** os aprendizados de responsividade já validados no JourneyGraph e no StepGraph nesta mesma base de código (não deixar para uma rodada de correção posterior):
  - sidebars como gaveta deslizante em mobile (`sidebar-toggle-btn` + backdrop), não compressão do conteúdo central;
  - nav bar com `overflow-x:auto` + `flex-shrink:0` nos botões como regra base, não só em media query;
  - alvos de toque ≥ ~40px em controles interativos, restrito a media query mobile;
  - `touch-action:none` nos elementos arrastáveis do grafo (nós fixáveis);
  - listener de resize redesenhando o grafo ativo;
  - breakpoints em 1300–1500px (grids), 900–1000px (layout principal) e 480px (topbar/branding), como já padronizado.
- Adicionar link `← Lounge` de volta para `../index.html` e um novo card do NetGraph em `index.html` (raiz), seguindo o padrão visual dos cards existentes (STEP, JourneyGraph, Égide Vita, ITXView).
- Sem dependências de backend: todo o cálculo (grafo, Markov, Bayes, ML) roda client-side em JavaScript puro sobre os dados sintéticos embutidos.

---

## 10. Critérios de Aceite

- [ ] Grafo de topologia renderizado e interativo (zoom/drag/clique), com pelo menos 3 níveis hierárquicos (POP → OLT → CTO) e ONT/assinante acessível só via Consulta Individual restrita.
- [ ] Matriz de transição de Markov calculada a partir de dados sintéticos reais (não hardcoded), exibida/usada no detalhe do nó.
- [ ] Rede Bayesiana com posterior calculado sobre pelo menos 4 causas candidatas, exibindo grau de confiança.
- [ ] Detector de outlier real (não limiar fixo) aplicado a pelo menos uma métrica por nó.
- [ ] Projeção de capacidade com data estimada de saturação e intervalo de confiança.
- [ ] Todo alerta da tela de Alertas contém as 7 seções de explicabilidade do §5.6.
- [ ] Priorização de alertas combina gravidade técnica e impacto de negócio, com o score visível e decomponível.
- [ ] Assistente responde perguntas contextualizadas citando RQUAL/Selo, ITU-T/TM Forum, CRM e Ouvidoria/Anatel conforme pertinente, com o mesmo disclaimer de honestidade metodológica do JourneyGraph.
- [ ] Responsivo validado via Playwright em pelo menos 375/768/1000/1400px, sem overflow horizontal, replicando a metodologia de auditoria já usada no JourneyGraph/StepGraph.
- [ ] Card adicionado na Lounge (`index.html`) e link `← Lounge` funcional.

---

## 11. Fora de Escopo / Disclaimers

- Não há integração real com CRM, Ouvidoria, sistemas de bilhetagem (RADIUS/IPFIX) ou inventário de rede de produção — tudo é sintético, client-side, para fins de demonstração comercial.
- O texto normativo (RQUAL, Selo Anatel, ITU-T, TM Forum) apresentado no corpus do Assistente é um resumo/paráfrase para fins de demonstração, não deve ser usado como referência jurídica ou de compliance — sinalizar isso explicitamente na UI, como já é feito no JourneyGraph para temas correlatos.
- O Assistente permanece um RAG mock (busca por palavras-chave/templates sobre corpus estático), não um LLM de produção — apenas os modelos analíticos de §5 precisam ser matematicamente reais.
- Autenticação da Consulta Individual restrita é apenas ilustrativa (mesmo padrão do JourneyGraph), não um controle de acesso de produção.

---

## 12. Prompt-resumo (instrução única, executável)

> Desenvolva o **NetGraph**, um novo app da Lounge de Soluções ISP da Vísent, em `netgraph/index.html`, clonando a arquitetura do **JourneyGraph** (não a do StepGraph) — dígrafo D3 força-dirigido, sidebars, tela de Alertas, Consulta Individual restrita e Assistente RAG — mas aplicado a **topologia de rede** de um ISP (POP → OLT → PON → CTO → ONT), reaproveitando as zonas geográficas do StepGraph (Grande Florianópolis) para coerência da Lounge.
>
> Implemente, com cálculo real em JavaScript client-side sobre dados sintéticos determinísticos (não heurísticas disfarçadas, ao contrário do que o próprio JourneyGraph admite fazer em seu Anexo B): (1) análise topológica com centralidade, SPOF e blast radius; (2) cadeia de Markov estimada dos dados sintéticos para prever degradação de estado; (3) rede Bayesiana simplificada para isolar causa raiz com posterior explícito; (4) detector de outlier real e projeção de capacidade por regressão; (5) correlação de alertas por blast radius e priorização por score combinado de gravidade técnica × impacto de negócio (nº assinantes, SLA, sobreposição com CRM).
>
> Todo alerta deve ser explicável nas 7 dimensões do §5.6 deste documento. O Assistente SLM/RAG deve contextualizar alertas e insights citando: cadastro operacional/de rede, reclamações do CRM, escalonamento à Ouvidoria/Anatel, normas Anatel de service assurance (RQUAL, Selo — parafraseadas, com disclaimer de que não são texto normativo literal) e boas práticas ITU-T (M.3400/FCAPS) e TM Forum (eTOM Assurance, APIs TMF642/TMF628), no mesmo estilo e nível de honestidade metodológica já usados no corpus Tech Reference do JourneyGraph.
>
> Aplique desde o início os padrões de responsividade mobile já validados no JourneyGraph e no StepGraph (sidebar-gaveta, nav scrollável, alvos de toque, breakpoints 1300/900/480px) e valide com Playwright em 375/768/1000/1400px. Adicione o card do NetGraph à Lounge (`index.html`) e o link `← Lounge` de volta.
