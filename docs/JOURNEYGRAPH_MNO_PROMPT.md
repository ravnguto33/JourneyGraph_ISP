# Prompt de Desenvolvimento — JourneyGraph MNO Edition (São Paulo / Claro)

**Vísent · CDRView MNO Edition — a jornada do assinante móvel, com antenas e cobertura reais**

> Prompt completo, pronto para ser entregue a um desenvolvedor ou a um agente de IA (ex.: Claude Code), sem depender de contexto de conversa anterior. Objetivo: criar uma variante do **JourneyGraph** (`journeygraph/index.html`) voltada a **MNO** (operadora móvel) — mesma arquitetura de dígrafo, Painel de Alertas e Assistente já validada no ISP Edition, mas sobre dados de rede móvel reais (antenas Anatel), praça de **São Paulo** (segunda cidade, depois de Florianópolis) e personas geradas por um pipeline externo já existente, curado em planilha. Este documento resulta da leitura direta dos pipelines reais em `C:\PERSDEV\poc_personas` e `C:\PERSDEV\poc_personas_v2` — não é especulação sobre o que esses pipelines deveriam conter.

---

## 1. Objetivo e racional

### 1.1 Objetivo

Desenvolver o **JourneyGraph MNO Edition**, em `journeygraph-mno/index.html` (novo diretório, irmão de `journeygraph/`, `netgraph/`, `step/`, `itxview/`, `egide-vita/`), clonando a arquitetura do JourneyGraph ISP Edition — dígrafo D3, sidebars, tela de Qualidade (IQRE), Painel de Alertas com Bayes/Markov por persona (`docs/JOURNEYGRAPH_BAYES_MARKOV_PROMPT.md`), Consulta Individual restrita e Assistente RAG — mas com:

- **Fonte de dados**: CDR de voz/dados móveis (RADIUS/IPFIX é o mundo fixo; o equivalente móvel é o `tensor_mobilidade.csv` já produzido pelo pipeline de `poc_personas`/`poc_personas_v2`), não mais sessões RADIUS de banda larga fixa;
- **Cobertura real**: antenas e localização a partir da base licenciada da **Anatel** (`Estacoes_Licenciadas_SMP.csv`), filtradas por operadora e cidade — não mais um catálogo fixo de bairros de Florianópolis;
- **Praça**: **São Paulo** capital, como segunda cidade da arquitetura multi-cidade (a primeira, Florianópolis, é a do JourneyGraph ISP atual — fixo, não móvel);
- **Personas**: reaproveitando o pipeline de geração e curadoria de personas já existente em `poc_personas`/`poc_personas_v2` (P1–P8, ver §3.3), não a lista hardcoded que o `step/index.html` usa hoje para o domínio fixo.

### 1.2 Por que São Paulo e por que Claro

São Paulo é a cidade-alvo de validação já escolhida na arquitetura multi-cidade (`C:\PERSDEV\poc_personas_v2\pipeline\config\cidade_alvo_SP.yaml` já existe, com `antenas_SP.csv` pré-gerado). Claro é o escopo inicial de operadora — mas **operadora deve ser parâmetro do pipeline de antenas, não hardcode**, para permitir trocar para TIM/Vivo/Oi sem reescrever código (ver §3.2 e §4 para o estado atual dessa parametrização, que **ainda não existe** e precisa ser criada por este trabalho).

### 1.3 Por que um pipeline de antenas separado, fora do navegador

O catálogo nacional da Anatel (`Estacoes_Licenciadas_SMP.csv`, ~650 MB) é grande demais para processar client-side, e o padrão "HTML único sem build" do restante da Lounge não muda — o pipeline de antenas roda **fora do navegador**, em Python, como já acontece em `poc_personas_v2/pipeline/00_preparar_antenas_anatel.py`, e produz um CSV pequeno (antenas já filtradas, clusterizadas e com Voronoi) que é o que efetivamente entra no `RAW` embutido no HTML — o mesmo padrão que o RADIUS/IPFIX real já segue hoje no JourneyGraph ISP (upload de CSV pré-processado, não o dado bruto de bilhetagem).

### 1.4 Por que a planilha de curadoria é fonte de verdade, não artefato gerado

`C:\PERSDEV\poc_personas\pipeline\curadoria_features_personas.xlsx` (aba `PERSONAS_DEF`) já define 8 personas curadas — P1–P4 (Wave 1, `ATIVO`: Executivo Mobile, Gamer/Streamer, Comutador Urbano Diário, Churn Silencioso) e P5–P8 (Wave 2, `PLANEJADO`: Big Data User, Usuário de Voz Premium, Usuário Multi-SIM/Itinerante, Usuário Social/Comunicação Intenso) — com critério de inclusão/exclusão, features discriminantes primárias/secundárias e status de implementação por feature. Essa planilha é **input do pipeline, não output**: o script `04_gerar_features_personas.py`/`05_treinar_kmeans.py` deve respeitar os critérios curados manualmente, não sobrescrevê-los com um K-Means "livre" que poderia reagrupar diferente a cada execução. Qualquer trabalho de expansão de personas para o cenário MNO/São Paulo deve **ampliar essa planilha** (novas linhas em `PERSONAS_DEF`, mantendo o formato de colunas existente), não criar uma segmentação paralela.

### 1.5 Por que a arquitetura de app (dígrafo, Alertas, Assistente) não muda

O JourneyGraph ISP já tem o motor analítico certo para "jornada de assinante": dígrafo força-dirigida, IQRE por segmento, Painel de Alertas com causa provável/tendência real por persona (Markov/Bayes, `docs/JOURNEYGRAPH_BAYES_MARKOV_PROMPT.md`), Consulta Individual restrita e Assistente RAG com corpus técnico. O MNO Edition **não reinventa esse motor** — troca o domínio de dados de entrada (RADIUS/IPFIX fixo → CDR móvel + antenas Anatel) e adiciona parametrização de cidade, mantendo a mesma UI e os mesmos padrões de explicabilidade. Não usar o `step/index.html` como base (ele é fluxo O–D sobre mapa geográfico, arquitetura diferente, já com personas hardcoded fixas do domínio fixo — ver §2).

---

## 2. O que muda em relação ao JourneyGraph ISP atual

| | Hoje (JourneyGraph ISP Edition) | Depois (JourneyGraph MNO Edition) |
|---|---|---|
| Fonte de dados | RADIUS RFC2866 (`Acct-Session-Id, _subscriber_id, Acct-Start-Time, Acct-Stop-Time, Acct-Input-Octets, Acct-Output-Octets` obrigatórios; `_isp_segment, _arpu, _link_mbps, _instalacao_cidade, _instalacao_bairro, NAS-Port-Id` recomendados) + IPFIX opcional | CDR de voz/dados/SMS móveis — schema `tensor_mobilidade.csv` já produzido pelo pipeline (§3.1), granularidade `(assinante_hash, day_date, ecgi, periodo_sessao)` |
| Localização/cobertura | Catálogo fixo de bairros/clusters de Florianópolis (`_instalacao_cidade`/`_instalacao_bairro` por assinante, sem antena real) | Antenas Anatel reais (`ecgi, cluster, municipio, lat, lon, tecnologia, altura_m, azimute_graus`), filtradas por operadora (parâmetro) e cidade, clusterizadas por K-Means geográfico |
| Cidade | Única, hardcoded (Florianópolis) | Multi-cidade parametrizada via `cidade_alvo_XXX.yaml` (§4) — São Paulo como segunda praça, mesma arquitetura reaproveitável para novas cidades |
| Personas | K-Means++ k=8 rodado sobre os dados carregados no próprio navegador, upload de RADIUS/IPFIX dispara o clustering ali mesmo | Pipeline externo (`poc_personas`/`poc_personas_v2`, scripts 01–06) gera as features e roda o clustering **antes**, respeitando a planilha de curadoria (§1.4/§3.3) como fonte de verdade; o HTML consome o resultado já curado, não recalcula do zero a cada upload |
| Operadora | Não é conceito no ISP fixo (é o próprio ISP, sem concorrência de MNO no dado) | Parâmetro explícito do pipeline de antenas e da base de CDR — escopo inicial Claro, mas trocável (§3.2) |
| IBGE | Não usado | Códigos de município (`codigo_ibge_principal`, `municipios_ibge`) já usados como filtro geográfico no `cidade_loader.py` — malha territorial completa (polígonos de setor censitário) **fora de escopo** nesta primeira versão (ver §7) |
| Arquitetura de app | `journeygraph/index.html`, single-file, client-side, sem build | Mesmo padrão, novo arquivo `journeygraph-mno/index.html` — reaproveita dígrafo D3, Painel de Alertas (Bayes/Markov por persona), Consulta Individual restrita e Assistente, adaptando rótulos e corpus ao domínio móvel |

---

## 3. Dados necessários no `RAW` da variante MNO

O `RAW` embutido no HTML continua sendo o dado **já processado** pelo pipeline externo — o navegador não lê o catálogo Anatel de 650 MB nem gera CDR bruto. Três blocos de dado precisam chegar ao `RAW`: CDR (3.1), antenas/cobertura (3.2) e personas (3.3).

### 3.1 Schema de CDR móvel

Fonte real: `tensor_mobilidade.csv`, produzido por `01_gerar_base_mobilidade.py` (`C:\PERSDEV\poc_personas_v2\pipeline`, versão genérica multi-cidade) e documentado campo a campo na aba `TENSOR_MOBILIDADE` de `curadoria_features_personas.xlsx`. Granularidade: `(assinante_hash, day_date, ecgi, periodo_sessao)`.

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `assinante_hash` | STRING(64) | Sim | SHA-256 do MSISDN em produção; nunca exportar MSISDN em claro (LGPD Art. 12) |
| `day_date` | DATE | Sim | Janela de retenção de referência: 45 dias |
| `ecgi` | STRING(18) | Sim | `MCC+MNC+eNB+CellID` — compatível com o catálogo de antenas do §3.2 |
| `periodo_sessao` | ENUM | Sim | `MADRUGADA` (0–6h) / `MANHA` (6–12h) / `TARDE` (12–18h) / `NOITE` (18–24h) |
| `cluster`, `municipio` | STRING | Sim | Join com o catálogo de antenas (§3.2) |
| `rg_type` | ENUM | Sim | `STREAMING/GAMING/SOCIAL/COMUNICACAO/VPN/OUTROS` — classificação de serviço (DPI) |
| `rat_type` | ENUM | Sim | `NR` (5G) / `LTE` (4G) / `WCDMA` (3G) |
| `n_sessoes, dur_total_s, download_bytes, upload_bytes` | INT/FLOAT | Sim | Contadores de dados |
| `drop_pct, congestionamento` | FLOAT (0–1) | Sim | Qualidade de rede — mesmo papel do IQRE no ISP fixo |
| `chamadas, conversacao_seg, completamento_voz, cong_voz` | INT/FLOAT | Sim | Voz |
| `mensagens, completamento_sms, cong_sms` | INT/FLOAT | Sim (exceto `cong_sms`, opcional) | SMS |
| `rg_streaming, rg_game, rg_social, rg_comunicacao, rg_outros` | INT | Sim | Contadores por categoria de serviço, usados nas features `uso_pct_*` |
| `income_cluster, age_group, flag_flagship` | ENUM/INT | Sim (sintético) / Wave 2 (produção via CRM) | Enriquecimento demográfico |

Campos derivados por `02_agregar_trajetos.py` (tensor_sequencias — mobilidade por assinante/dia, análogo à sequência de nós do dígrafo): `seq_num, arrival_time, permanencia_seg, distancia_km_anterior, mob_ancora_residencial, mob_ancora_trabalho`. Esses campos alimentam diretamente a topologia do dígrafo (arestas = transições entre antenas/clusters) e as features de mobilidade usadas na definição de persona (§3.3).

Camada core sintética opcional (`antenas_topologia_core.csv`: `ecgi → sgw_id, pgw_upf_id, mme_amf_id`) e `tensor_sinalizacao.csv` (eventos ATTACH/DETACH/TIMEOUT) existem no pipeline v1 para cenários de storm de sinalização — **fora de escopo da primeira entrega do MNO Edition** a menos que o Painel de Alertas venha a precisar de um tipo de alerta de sinalização de rede core; registrar como candidato de Wave futura se não for implementado agora.

### 3.2 Campos de antena/cobertura (Anatel)

Fonte real: `00_preparar_antenas_anatel.py`. Duas versões existem hoje, e nenhuma resolve o requisito de MNO-como-parâmetro:

- **v1** (`C:\PERSDEV\poc_personas\pipeline\00_preparar_antenas_anatel.py`): filtra Claro hardcoded (CNPJ `40432544`/`24086044` + nome contendo `CLARO`/`NET `/`AMERICATEL`) e bounding box fixo de Florianópolis. Produz `ecgi, cluster, municipio, lat, lon`.
- **v2** (`C:\PERSDEV\poc_personas_v2\pipeline\00_preparar_antenas_anatel.py`): generalizou a cidade (lê `cfg.bbox`, `cfg.municipios_ibge` do YAML) mas **removeu o filtro de operadora por completo** — filtra só por UF/IBGE/bounding box, qualquer operadora incluída. Produz `ecgi, lat, lon, tecnologia, altura_m, azimute_graus` (schema ligeiramente diferente do v1: sem `cluster`/`municipio` diretos, adicionados depois pelo K-Means geográfico de `gerar_clusters_kmeans.py`).

**Trabalho a fazer neste projeto** (não é só juntar código existente): adicionar de volta ao script v2 um filtro de operadora **parametrizável** — `--mno claro|tim|vivo|oi` (ou lista de CNPJs/nomes de prestadora configurável), reaproveitando a lógica de matching por CNPJ+nome do v1, mas sem hardcode de uma operadora só. `MCC_MNC` também está hardcoded como `724050` (Brasil/Claro) em `01_gerar_base_mobilidade.py` — deve virar parâmetro derivado da operadora escolhida, não constante.

Schema final de antena a expor no `RAW` (união do necessário para o dígrafo e para o mapa, se houver): `ecgi, cluster, municipio, lat, lon, tecnologia, altura_m, azimute_graus, operadora`. Adicionar `operadora` explicitamente ao schema de saída, mesmo com escopo inicial de uma operadora só — é o que torna o parâmetro visível e testável.

### 3.3 Personas

Fonte de verdade: `curadoria_features_personas.xlsx`, aba `PERSONAS_DEF` (ver §1.4). Colunas: `persona_id, nome, wave, pct_base_poc, descricao, features_primarias, features_secundarias, criterio_inclusao, criterio_exclusao, qualidade_rede_esperada, intensidade_uso_esperada, status, notas_curador`.

- **Wave 1 (ATIVO, implementar primeiro)**: P1 Executivo Mobile, P2 Gamer/Streamer, P3 Comutador Urbano Diário, P4 Churn Silencioso.
- **Wave 2 (PLANEJADO, dependem de CRM/Billing — não bloqueiam a primeira entrega)**: P5 Big Data User, P6 Usuário de Voz Premium, P7 Usuário Multi-SIM/Itinerante, P8 Usuário Social/Comunicação Intenso.

Cada persona tem critério de inclusão/exclusão formal (ex.: P1 = `income_cluster IN {A,B} AND flag_flagship=1 AND uso_pct_vpn_corp > 0.15`, excluído se `uso_pct_gaming > 0.30 OR churn_sem_reclamacao = 1`) — o pipeline (`04_gerar_features_personas.py` → `05_treinar_kmeans.py`) deve aplicar esses critérios como regras de curadoria sobre o resultado do K-Means, não apenas rotular clusters automaticamente. As features usadas (`uso_pct_vpn_corp`, `mob_recorrencia_rota`, `mob_ancora_match`, `churn_queda_uso_30d` etc.) estão todas catalogadas na aba `FEATURES_PERSONAS`, com fórmula de agregação, janela (45 dias) e normalização — reaproveitar esse catálogo integralmente, não redefinir features novas sem necessidade.

**Importante — não confundir com as personas do JourneyGraph ISP atual**: o app fixo já usa uma segmentação própria rotulada `PF-1`…`PF-8` (K-Means++ sobre 14 features de banda larga fixa — mix de categorias, `busy_hour`, `cv_daily` etc.), definida em `journeygraph/index.html`. É um esquema **diferente e paralelo** ao P1–P8 do domínio móvel — não tentar unificar os dois; são personas de produtos/domínios distintos (fixo vs. móvel) mesmo que a Lounge os apresente lado a lado.

Ao ampliar a planilha para o cenário MNO/São Paulo, seguir a mesma estrutura de colunas e o mesmo padrão de `criterio_inclusao`/`criterio_exclusao` formal (não texto livre) usado nas 8 personas já curadas.

---

## 4. Arquitetura multi-cidade

A generalização multi-cidade **já existe e está mais madura do que o README do projeto sugere** — `C:\PERSDEV\poc_personas_v2\pipeline\cidade_loader.py` lê `cidade_alvo_XXX.yaml` e expõe um objeto `ConfigCidade` tipado, consumido pelos scripts 00–06 (todos já refatorados para ler da config, não hardcoded — apesar do `README.md` do projeto ainda listar "refatorar scripts 01–06" como pendência de Fase 2).

**O que é comum entre praças** (definido no YAML, uma vez por cidade):
- Identificação: `codigo, nome, uf, codigo_ibge_principal, municipios_ibge, populacao_estimada, linhas_claro_estimadas` (renomear para `linhas_mno_estimadas` ao generalizar operadora).
- Geoespacial: `bounding_box` (WGS84) e `mapa_react` (centro, zoom, tile provider).
- `clusters_referencia` (opcional, nomes manuais de bairros conhecidos, sobrepostos ao K-Means automático).
- `eventos_recorrentes`, `calendario` (feriados nacionais/estaduais/municipais, férias escolares), `clima` (fonte Open-Meteo/INMET/sintético).
- `personas_wave_1` (P1–P4, com proporção esperada por cidade — recalibrada por cidade, mas as 4 personas em si são as mesmas, ver §3.3).
- `dados_sinteticos` (`n_assinantes, n_dias, semente_aleatoria`) e `clustering` (`n_clusters, raio_max_km, semente_aleatoria, nomenclatura`).

**O que é específico por cidade**: os valores numéricos acima (bbox, população, `n_clusters` — 27 para RM Florianópolis, referência de 50 para o município de SP), a lista de `clusters_referencia` (nomes de bairros relevantes que precisam de renomeação manual pós-K-Means) e os `eventos_recorrentes` locais (não há automação para isso — precisa ser preenchido por quem conhece a cidade, mesma ressalva que o README do `poc_personas_v2` já registra).

`config/cidade_alvo_SP.yaml` já existe como baseline de validação, com `antenas_SP.csv` pré-gerado. O trabalho deste prompt não recria essa infraestrutura — consome o `ConfigCidade` de São Paulo e a integra ao `RAW` do `journeygraph-mno/index.html`, incluindo a lacuna de MNO-como-parâmetro do §3.2, que a infraestrutura de cidade não resolve (bbox/IBGE filtram geografia; operadora é um eixo ortogonal, ainda a implementar).

Exportação para o front-end: `cidade_loader.py` já tem `exportar_json_react(cfg, saida)`, pensado para um app **React** (o pipeline de personas em `poc_personas/pipeline` tem seu próprio front-end React em `mapa-rm/`, já publicado como "StepGraph MNO Edition" em `stepvis.netlify.app`, referenciado no `index.html` da Lounge). O `journeygraph-mno/index.html` **não é esse app** — é single-file, sem build, no padrão da Lounge — então não reaproveitar o exportador React diretamente; adaptar para gerar o bloco `RAW.cidade` equivalente (bbox, centro do mapa, título, personas, clusters de referência) já embutido no HTML, mesmo padrão de como o `RAW` de RADIUS/IPFIX é embutido hoje no JourneyGraph ISP.

---

## 5. Requisitos técnicos

- **Cliente**: arquivo único `journeygraph-mno/index.html`, mesma stack do restante da Lounge (D3.js via CDN, CSS com as mesmas variáveis de tema `--bg/--panel/--accent`), sem build step. Reaproveitar diretamente os componentes já existentes no `journeygraph/index.html`: dígrafo força-dirigido, tela de Qualidade (adaptar IQRE → indicador equivalente de qualidade móvel a partir de `drop_pct`/`congestionamento`/`completamento_voz`), Painel de Alertas com camadas de Markov/Bayes por persona (mesmo padrão de `docs/JOURNEYGRAPH_BAYES_MARKOV_PROMPT.md`, agora sobre P1–P8 móveis), Consulta Individual restrita (senha ilustrativa + log de auditoria) e Assistente RAG.
- **Pipeline (fora do navegador)**: Python, reaproveitando `C:\PERSDEV\poc_personas_v2\pipeline\` (scripts 00–06 + `cidade_loader.py`) como base. Trabalho novo necessário: parametrização de operadora no script 00 e no `01_gerar_base_mobilidade.py` (§3.2); cópia/adaptação de `curadoria_features_personas.xlsx` para o contexto v2/multi-cidade, mantendo o formato de colunas.
- **Upload/RAW**: seguir o mesmo padrão de nota técnica do upload atual (`.upl-note`) — documentar no MNO Edition os campos obrigatórios/recomendados do CDR (§3.1) e do catálogo de antenas (§3.2), com mesma UX de detecção automática de separador/encoding.
- **Operadora como parâmetro**: `--mno` no pipeline Python; no `RAW`, expor o campo `operadora` mesmo com escopo de uma operadora só na primeira entrega, para que a UI já possa (futuramente) filtrar/rotular por operadora sem retrabalho.
- **Determinismo**: geração sintética com semente fixa (`semente_aleatoria`), como já é padrão em todo o pipeline — reprodutibilidade em demonstração.
- **LGPD/minimização de dados**: manter o padrão já usado no CDR (`assinante_hash` como SHA-256, nunca MSISDN em claro) e na Consulta Individual restrita (não expor granularidade por assinante fora dela).
- **Responsividade**: aplicar desde o início os padrões já validados no JourneyGraph/StepGraph/NetGraph (sidebar-gaveta em mobile, nav com `overflow-x:auto`, alvos de toque ≥40px, breakpoints 1300/900/480px) — não deixar para uma rodada de correção posterior.
- **Lounge**: adicionar card do JourneyGraph MNO Edition ao `index.html` raiz e link `← Lounge` de volta, seguindo o padrão visual dos cards existentes.

---

## 6. Critérios de aceite

- [ ] `journeygraph-mno/index.html` funcional, single-file, sem build, reaproveitando dígrafo/Alertas/Consulta Individual/Assistente do padrão JourneyGraph.
- [ ] `RAW` populado a partir de CDR real do schema §3.1 (`tensor_mobilidade.csv` ou upload equivalente), não RADIUS/IPFIX.
- [ ] Antenas Anatel de São Paulo, filtradas por operadora parametrizável (não hardcoded Claro no código do app nem do pipeline), com schema §3.2 incluindo o campo `operadora`.
- [ ] Script `00_preparar_antenas_anatel.py` (v2) com filtro de operadora reintroduzido e parametrizado (`--mno`); `MCC_MNC` derivado do parâmetro, não constante fixa.
- [ ] Personas P1–P4 (Wave 1) presentes, geradas respeitando os critérios de inclusão/exclusão da planilha `PERSONAS_DEF` — não um K-Means livre que ignore a curadoria.
- [ ] Planilha `curadoria_features_personas.xlsx` copiada/adaptada para o contexto multi-cidade/MNO, mantendo o formato de colunas (`PERSONAS_DEF`, `FEATURES_PERSONAS`, `CATALOGO_INDICADORES`, `TENSOR_MOBILIDADE`, `GLOSSARIO`), sem sobrescrever a curadoria original de Florianópolis (v1 continua intocado).
- [ ] Configuração de cidade via `cidade_alvo_SP.yaml` consumida corretamente (bbox, mapa, eventos, calendário, clima) e refletida no `RAW.cidade`.
- [ ] Painel de Alertas com causa provável/tendência por persona (Bayes/Markov), mesmo padrão do JourneyGraph ISP, adaptado às 9 (ou o subconjunto pertinente) fontes de indicador móvel (`drop_pct`, `congestionamento`, `completamento_voz`, `churn_queda_uso_30d` etc.).
- [ ] Responsivo validado em pelo menos 375/768/1000/1400px, sem overflow horizontal.
- [ ] Card do JourneyGraph MNO Edition adicionado à Lounge (`index.html`), com link `← Lounge` funcional.
- [ ] Nenhuma alegação de granularidade por assinante individual fora da Consulta Individual restrita.

---

## 7. Fora de escopo

- **Malha territorial completa do IBGE** (polígonos de setor censitário para renderização no mapa) — este item ficou em aberto na conversa que originou este documento (a confirmação do usuário cobriu antenas Anatel, mas não mencionou IBGE explicitamente). Nesta primeira versão, usar **apenas os códigos IBGE de município** (`codigo_ibge_principal`, `municipios_ibge`) já suportados pelo `cidade_loader.py` como filtro geográfico e para lookup de renda (`income_cluster`) — não implementar overlay de polígonos censitários no mapa. Se o produto precisar disso no futuro, tratar como item de escopo à parte, a confirmar com o usuário antes de iniciar.
- **Outras operadoras além de Claro na primeira entrega de dados** — o pipeline deve aceitar `--mno` como parâmetro desde já (§3.2/§6), mas gerar apenas o dataset Claro/São Paulo nesta entrega. TIM/Vivo/Oi ficam para quando houver necessidade de demonstração multi-operadora.
- **Personas Wave 2 (P5–P8)** — dependem de enriquecimento CRM/Billing que a base sintética atual não produz; ficam documentadas na planilha como `PLANEJADO`, não implementadas nesta entrega.
- **Camada core de sinalização** (`antenas_topologia_core.csv`, `tensor_sinalizacao.csv`, cenário de storm ATTACH/DETACH) — existe no pipeline v1 mas não é necessária para o MVP do dígrafo/Alertas; candidato a Wave futura.
- **Não substitui nem se confunde com o "StepGraph MNO Edition"** já publicado (`stepvis.netlify.app`, app React separado do pipeline `poc_personas/pipeline/mapa-rm`) — são produtos/arquiteturas diferentes (dígrafo vs. fluxo O–D em mapa); este prompt trata exclusivamente do JourneyGraph MNO Edition, single-file, na Lounge.
- **Integração real com CRM/Billing/RAN** — toda a base é sintética e determinística, como o restante da Lounge; nenhuma integração de produção.
- **RAG do Assistente com embeddings/LLM real** — mantém o mesmo mock por palavras-chave/templates já usado no JourneyGraph ISP; apenas o corpus é adaptado ao domínio móvel.

---

## 8. Prompt-resumo (instrução única, executável)

> Desenvolva o **JourneyGraph MNO Edition**, em `journeygraph-mno/index.html`, clonando a arquitetura do **JourneyGraph ISP Edition** (`journeygraph/index.html`) — dígrafo D3, tela de Qualidade, Painel de Alertas com Bayes/Markov por persona, Consulta Individual restrita e Assistente RAG — mas trocando o domínio de dado de RADIUS/IPFIX (banda larga fixa) para **CDR de voz/dados/SMS móveis**, com granularidade `(assinante_hash, day_date, ecgi, periodo_sessao)`, no schema real de `tensor_mobilidade.csv` já documentado em `curadoria_features_personas.xlsx` (aba `TENSOR_MOBILIDADE`). Popule o `RAW` com três blocos vindos de um pipeline Python externo (fora do navegador, sem build no HTML): (1) CDR gerado por `poc_personas_v2/pipeline/01_gerar_base_mobilidade.py`; (2) antenas Anatel reais de **São Paulo**, filtradas por operadora — implemente a parametrização de operadora (`--mno`) que hoje **não existe** em `00_preparar_antenas_anatel.py` v2 (a versão v2 generalizou cidade mas removeu o filtro de operadora que a v1 tinha hardcoded para Claro; `MCC_MNC` em `01_gerar_base_mobilidade.py` também precisa deixar de ser constante fixa `724050`); (3) personas **P1–P4** (Wave 1: Executivo Mobile, Gamer/Streamer, Comutador Urbano Diário, Churn Silencioso), geradas respeitando os critérios de inclusão/exclusão formais já curados em `curadoria_features_personas.xlsx` (aba `PERSONAS_DEF`) — essa planilha é fonte de verdade editável por humano, o pipeline de clustering deve obedecê-la, nunca sobrescrevê-la, e deve ser copiada/ampliada (não recriada do zero) para o contexto multi-cidade. Use a infraestrutura multi-cidade já existente e mais madura do que documentado (`poc_personas_v2/pipeline/cidade_loader.py` + `config/cidade_alvo_SP.yaml`) para os parâmetros geográficos, de calendário/eventos e de clustering da praça de São Paulo. Aplique os mesmos padrões de responsividade mobile já validados nos demais apps da Lounge (sidebar-gaveta, nav scrollável, breakpoints 1300/900/480px), adicione o card do JourneyGraph MNO Edition à Lounge (`index.html`) com link `← Lounge`, e documente explicitamente como fora de escopo, nesta primeira versão: malha territorial completa do IBGE (usar apenas códigos de município para filtro), operadoras além de Claro (mas com o parâmetro já pronto para uso futuro), personas Wave 2 (P5–P8) e qualquer integração real de CRM/Billing — mantendo, como em todo o restante da Lounge, a mesma honestidade metodológica sobre o que é real (cálculo/dado sintético determinístico) versus o que é mock (Assistente RAG por palavras-chave).
