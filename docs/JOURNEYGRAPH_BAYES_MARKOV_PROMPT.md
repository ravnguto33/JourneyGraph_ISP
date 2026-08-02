# Prompt de Desenvolvimento — Bayes/Markov/ML reais no JourneyGraph (por segmento)

**Vísent · JourneyGraph ISP Edition — do "Anexo B" ao produto distinto, por persona**

> Prompt completo, pronto para ser entregue a um desenvolvedor ou a um agente de IA (ex.: Claude Code), sem depender de contexto de conversa anterior. Objetivo: fechar a lacuna que o próprio JourneyGraph já documenta ter — "causa provável" e "tendência" são heurísticas de score, não Bayes/Markov reais (ver `journeygraph/index.html`, corpus do Assistente, documento `alertas-causa-provavel-1` e Anexo B) — substituindo-a por cálculo real, mas **por segmento (persona), não por assinante individual**.

---

## 1. Objetivo

Fazer no JourneyGraph o mesmo salto metodológico que o `docs/NETGRAPH_PROMPT.md` propôs para o NetGraph: sair de heurísticas de score nomeadas para modelos matematicamente reais (Markov, Bayes, detecção de outlier) — mas aplicados à **jornada de assinante por segmento comportamental**, não à topologia de rede. Ao final, o Painel de Alertas (4.7) deve calcular "causa provável" e "tendência" via inferência real, e o Anexo B deve ser reescrito para documentar isso, em vez de disclaimar a ausência.

---

## 2. Por que por segmento, e não por assinante individual

Esta decisão já foi tomada e é a premissa deste documento — registre o racional no PR de entrega:

- **Escala.** O JourneyGraph carrega ~15.000 assinantes reais do pipeline (`RAW`, embutido no HTML). Markov/Bayes por assinante individual, ao vivo, no navegador, para 15.000 entidades e vários indicadores cada, é uma carga de computação e de payload muito maior do que os 303 nós sintéticos do NetGraph — arriscaria travar a página.
- **A base de indicadores já é por segmento.** O IQRE_ISP (`tr-28`, §5.3.2) já é definido como "índice composto de qualidade por segmento... **média por segmento**", não por assinante. As Personas (`tr-13`/`tr-27`, §4.4/§5.3.1) já existem como segmentação oficial: **K-Means++, k=8**, sobre 14 features comportamentais (mix de categorias, busy_hour, cv_daily, du_ratio, journey_entropy, gini_cats), rotuladas por `classify_persona()`. Calcular por persona é extensão natural do que já existe, não uma mudança de paradigma.
- **LGPD/minimização de dados.** Como já discutido para o NetGraph, ficar no nível agregado (8 personas, não 15.000 indivíduos) evita transformar o motor analítico num vetor de reidentificação de assinante — é a mesma lógica de "ficar no nível operacional/agregado por padrão, só descer ao individual sob controle" já aplicada na Consulta Individual restrita.
- **Não invente uma segmentação nova.** A unidade de segmento deste trabalho é a Persona (PF-1…PF-8) já existente. Se for necessário mais granularidade, cruze persona × zona/cidade — mas não crie um esquema de clustering paralelo.

---

## 3. O que muda em relação ao estado atual

| | Hoje (heurística) | Depois (real, por persona) |
|---|---|---|
| Fonte da "causa provável" | Decomposição por peso dos componentes do próprio indicador (soma sempre 1,0) — `alertas-causa-provavel-1` | Posterior de uma rede Bayesiana simplificada sobre causas candidatas |
| Fonte da "tendência" | Distância ao limiar / heurística de score | Probabilidade de transição de estado via cadeia de Markov estimada |
| Onde é calculado | Pré-calculado por um pipeline citado (`build_alerts_isp() — pipeline_tensor_isp.py`) — que **não existe neste repositório**, é referência de proveniência fictícia dos dados sintéticos | Client-side, em JS puro, no próprio `journeygraph/index.html`, como já é feito no NetGraph |
| Granularidade | Já é por segmento no indicador (IQRE), mas a causa/tendência é heurística sobre o valor agregado | Por persona (PF-1…PF-8), com opção de cruzar por zona/cidade |
| Honestidade metodológica | Anexo B admite ser heurística | Anexo B deve ser **reescrito** para descrever o método real, com a mesma transparência (nada de prometer granularidade individual que não existe) |

---

## 4. Dados necessários — o que precisa existir no `RAW`

Hoje o `RAW` embute indicadores e alertas já resolvidos, não a série histórica por persona que um cálculo real precisa consumir. Adicione (gerado de forma determinística, seed fixa, como o resto da base sintética):

- **Série temporal por persona × indicador**, cobrindo pelo menos os indicadores já usados nos 9 tipos de alerta (IQRE, Sigma Topológico, Congestionamento OLT, Fault, Configuration, HHI, P2P, Taxa de Queda de Sessão, QoE Proximal): N períodos históricos (ex.: 12–26 semanas) por persona, o suficiente para estimar transições de estado e detectar outlier com significância.
- **Rótulo de severidade por período** (Normal/Atenção/Exceção/Crítico), derivado dos mesmos limiares já documentados por indicador (ex.: IQRE ≥80/≥65/<65; Taxa de Queda de Sessão <7%/7–15%/≥15%) — para servir de base às contagens de transição de estado.
- **Tamanho da persona por período** (nº assinantes), para dimensionar impacto de negócio nos alertas, no mesmo espírito do §5.5 do prompt do NetGraph (gravidade técnica × impacto de negócio).

---

## 5. Camada de Markov — predição de tendência por persona

- Estados por (persona × indicador): `Normal → Atenção → Exceção → Crítico` (+ `Recuperado`, tratado como o NetGraph tratou — rótulo transitório de UI, não 5º estado formal na matriz, a menos que o histórico sintético realmente sustente isso).
- Matriz de transição estimada por contagem real das transições observadas na série sintética de cada persona (não hardcoded, não heurística de distância ao limiar).
- "Tendência" no Painel de Alertas passa a ser, por exemplo: `P(persona PF-3 piorar de Atenção para Exceção nas próximas 2 semanas) = 0,34`, com a matriz exibível no detalhe do alerta.

---

## 6. Camada de Bayes — causa provável por persona

- Para cada tipo de alerta (os 9 já existentes), defina um conjunto pequeno de **causas candidatas concorrentes** plausíveis para aquele indicador — não reaproveite os componentes do próprio indicador como "causa" (isso é o que a heurística atual já faz e é exatamente o que se quer superar). Exemplos:
  - **IQRE crítico**: sobrecarga de rede na zona da persona, mix de tráfego mais pesado (ex. persona migrou para mais streaming/gaming), degradação real de CPE/Wi-Fi agregada, efeito sazonal.
  - **Taxa de Queda de Sessão**: instabilidade de NAS/OLT concentrada, padrão de uso (`Idle-Timeout`/`User-Request` normais vs. `Lost-Carrier` anômalo), problema de energia/rede de acesso.
  - **Sigma Topológico alto**: mudança real de comportamento da persona vs. ruído estatístico.
- Priors a partir da frequência histórica sintética por causa; likelihood a partir do padrão de evidências simultâneas (quais outros indicadores da mesma persona também se moveram, correlação com zona/horário).
- Calcular o posterior de verdade sobre as causas candidatas, com grau de confiança exibido — mesmo padrão do §5.3 do `docs/NETGRAPH_PROMPT.md`.

---

## 7. Camada de ML — outlier e tendência estatística por persona

- **Outlier real** (MAD/z-score robusto ou IQR, mesma técnica usada no NetGraph) sobre a série de cada indicador por persona, para sinalizar desvios estatisticamente significativos mesmo quando ainda dentro do limiar de severidade nominal — hoje o painel só reage a cruzar limiar fixo.
- **Projeção de tendência** por regressão real sobre a série da persona (não a "distância ao limiar" atual), com intervalo de confiança, quando fizer sentido para o indicador (ex.: quando a Taxa de Queda de Sessão de uma persona deve cruzar o limiar crítico, mantido o ritmo atual).

---

## 8. Explicabilidade obrigatória (mantém e adapta o padrão do NetGraph)

Cada alerta do Painel (4.7), ao ser expandido ou perguntado ao Assistente, deve mostrar:

1. **O quê**: indicador, persona (e zona/cidade se cruzado), limiar/padrão estatístico rompido.
2. **Por quê**: saída da rede Bayesiana (§6), com evidências a favor e descartadas.
3. **Para onde**: probabilidade de piora via Markov (§5).
4. **Quem é afetado**: nº de assinantes na persona (e zona, se aplicável) — nunca assinante identificável, ver §2.
5. **Prioridade**: mantém o cruzamento gravidade técnica × impacto de negócio já usado no NetGraph, adaptado (ex.: impacto = nº assinantes na persona afetada × criticidade do indicador).
6. **O que fazer**: mantém o encaminhamento por e-mail/WhatsApp (Nível 1) já existente.
7. **Narrativa em linguagem natural** do Assistente, citando o método real (não mais "heurística de score").

---

## 9. Reescrita do Anexo B e do corpus do Assistente

- Reescreva o documento `alertas-causa-provavel-1` ("Como é calculada a Causa Provável e a Tendência de um alerta") para descrever o método real por persona — Markov para tendência, Bayes para causa — mantendo a mesma transparência que o texto atual já tem, mas invertendo a conclusão.
- Atualize o Anexo B ("Nota de Honestidade Metodológica") para não afirmar mais "isso NÃO é um classificador Bayesiano nem uma cadeia de Markov reais" — e adicionar, no lugar, a ressalva correta: é real, mas **por persona (segmento), não por assinante individual**; útil para priorizar e explicar tendências agregadas, não para decisões sobre um assinante específico (isso continua sendo papel da Consulta Individual restrita, que não muda).
- Ajuste as citações cruzadas (ex. `tr-70`, ITXView, MinorScore™) que hoje comparam o JourneyGraph desfavoravelmente a um "produto distinto com Bayes/HMM genuínos" — o JourneyGraph passa a ser esse produto, ao menos na granularidade de persona.
- Atualize `_ASSIST_REGRAS`/corpus `metodologia` para o Assistente responder corretamente a perguntas como "como é calculada a causa provável de um alerta?" com a nova metodologia.

---

## 10. Requisitos técnicos

- Implementação client-side em JS puro dentro do próprio `journeygraph/index.html`, sem novo build step — mesmo padrão do repositório.
- Cálculo por persona (8) × indicador (9 tipos de alerta) × período: ordens de grandeza menor que os 15.000 assinantes, deve rodar sem problema de performance perceptível no carregamento da aba Alertas.
- Não alterar o volume de dados de assinante individual já existente (dígrafo, gráficos longitudinais, Personas, eFenotipagem) — este trabalho é escopado ao Painel de Alertas (4.7) e ao Assistente relacionado a ele.
- Reaproveitar zonas/cidades já usadas no dígrafo, se optar por cruzar persona × zona.

---

## 11. Critérios de aceite

- [ ] Série histórica sintética por persona × indicador adicionada ao `RAW`, determinística (seed fixa).
- [ ] Matriz de transição de Markov calculada a partir dessa série (não hardcoded), usada para "tendência" no Painel de Alertas.
- [ ] Rede Bayesiana por tipo de alerta, com pelo menos 3 causas candidatas e posterior calculado, usada para "causa provável".
- [ ] Outlier real (MAD/IQR) aplicado a pelo menos um indicador por persona.
- [ ] As 7 dimensões de explicabilidade do §8 presentes em cada alerta.
- [ ] Documento `alertas-causa-provavel-1` e Anexo B reescritos refletindo o método real e a granularidade por persona.
- [ ] Assistente responde corretamente perguntas de metodologia sobre causa provável/tendência com o novo texto.
- [ ] Nenhuma alegação de granularidade por assinante individual introduzida fora da Consulta Individual restrita já existente.

---

## 12. Fora de escopo

- Não alcança assinante individual — isso permanece exclusivo da Consulta Individual restrita (senha ilustrativa + log de auditoria), que não é alterada por este trabalho.
- Não substitui o RAG do Assistente (mock por palavras-chave/templates) por embeddings/LLM real — gap ortogonal, não tratado aqui.
- Não recalcula os indicadores em si (IQRE, Sigma, etc.) — a mudança é na camada de causa provável/tendência sobre eles, não na fórmula dos indicadores.

---

## 13. Prompt-resumo (instrução única, executável)

> No `journeygraph/index.html`, substitua as heurísticas de "causa provável" e "tendência" do Painel de Alertas (4.7) — hoje decomposição por peso e distância ao limiar, conforme o próprio Anexo B documenta — por cálculo real client-side, **agregado por persona (as 8 já existentes via K-Means++, `classify_persona()`), não por assinante individual**: (1) adicione ao `RAW` uma série histórica sintética determinística por persona × indicador, para os 9 tipos de alerta já existentes; (2) estime uma cadeia de Markov de estados de severidade (Normal/Atenção/Exceção/Crítico) por persona a partir dessa série, para "tendência"; (3) construa uma rede Bayesiana simplificada por tipo de alerta, com causas candidatas concorrentes plausíveis para o domínio (não os componentes do próprio indicador), priors e likelihoods estimados da série sintética, para "causa provável" com posterior real; (4) aplique um detector de outlier real (MAD/IQR) por persona/indicador. Garanta as 7 dimensões de explicabilidade por alerta (o quê, por quê, para onde, quem é afetado, prioridade, ação, narrativa). Reescreva o documento `alertas-causa-provavel-1` e o Anexo B do corpus do Assistente para descrever o método real e a granularidade por persona, com a mesma honestidade metodológica já praticada no restante do produto — sem nunca implicar granularidade por assinante individual fora da Consulta Individual restrita existente.
