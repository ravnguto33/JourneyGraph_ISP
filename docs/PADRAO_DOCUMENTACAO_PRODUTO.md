# Padrão de Documentação de Produto — Vísent

**Versão:** 1.1 · **Data:** 2026-08-03 (revisão: acrescenta o capítulo 8, Glossário e Siglas, como capítulo obrigatório) · **Status:** adotado para os produtos da Lounge de Soluções ISP (JourneyGraph, NetGraph, Égide Vita, StepGraph, ITXView) e para novos produtos do portfólio Vísent.

## 0. Origem e escopo deste documento

Este padrão parte de uma proposta de estrutura em blocos (Product Report / Tech Reference / Data Reference / Base Metodológica / Use Cases) recebida do usuário. A proposta original tinha um bom esqueleto, mas apresentava um bug de numeração (o bloco "Data Reference" ficava sem número entre "2. Tech Reference" e "3. Base Metodológica") e diluía, em bullets genéricos, práticas que já existem de forma consistente e amadurecida em pelo menos dois produtos reais da Lounge — honestidade metodológica, controle de acesso a dado pessoal, histórico de evolução. Este documento corrige a numeração, formaliza essas práticas como capítulos de primeira classe e registra dois problemas técnicos conhecidos (dialeto de corpus divergente entre produtos; duplicação de indicadores dentro do próprio JourneyGraph) como itens a resolver em produtos futuros — sem alterar retroativamente o código dos produtos já em produção.

Este padrão **não é imposto de cima para baixo sobre um vazio**: cada capítulo abaixo cita de qual produto real da Lounge a prática foi extraída, para que fique rastreável o que é generalização de algo que já funciona versus o que é aspiracional para produtos futuros.

---

## 1. Estrutura Padrão do Documento

Todo documento de produto formal da Vísent segue os cinco blocos abaixo, nesta ordem e com esta numeração:

```
Capa
Sumário
1. Product Report
2. Tech Reference
3. Data Reference          ← numerado (bug da proposta original corrigido)
4. Base Metodológica
5. Use Cases
Ressalvas / Honestidade Metodológica (capítulo consolidado — ver §3)
Base Legal / Controle de Acesso a Dado Pessoal (capítulo condicional — ver §4)
Glossário e Siglas (capítulo obrigatório — ver §8; sempre o último capítulo do documento)
```

Os capítulos sem número de bloco fixo vêm depois de Use Cases, nesta ordem: Ressalvas (sempre presente — ver §3), Base Legal (condicional — ver §4) e, por fim, Glossário e Siglas, que fecha o documento por definição (ver §8) — inclusive depois de qualquer anexo específico de produto que o documento venha a ter (ex.: os Anexos A–E do JourneyGraph, os Anexos A–C do Égide Vita).

### 1.1 Bloco 1 — Product Report

Visão de negócio e produto, para leitor não necessariamente técnico (comercial, parceiro, cliente ISP, investidor).

| Seção | Conteúdo |
|---|---|
| 1.1 Objeto | O que o produto é, em 1–2 parágrafos |
| 1.2 Objetivo | Problema que resolve e para quem |
| 1.3 Aplicações | Onde gera valor, por área da operação (NOC, comercial, produto, compliance...) |
| 1.4 Benefícios | Ganho mensurável ou qualitativo por aplicação |
| 1.5 Diferenciais | Por que este produto e não a alternativa de mercado/genérica |
| 1.6 Arquitetura (visão executiva) | Diagrama/resumo de alto nível — sem profundidade técnica, isso fica no bloco 2 |
| 1.7 Funcionalidades | Por tela/módulo, o que o usuário faz no produto |
| 1.8 Entradas | Fontes de dado que o produto consome |
| 1.9 Transformações | O que o pipeline faz com o dado, em linguagem de produto (não fórmula — isso fica no bloco 2/4) |
| 1.10 Persistência e Saídas | Onde/como o resultado fica disponível (arquivo, dashboard, export) |
| 1.11 Integrações | Sistemas de terceiros ou de outros produtos Vísent com que troca dado ou contexto |
| 1.12 Ambientes | Onde roda (navegador, servidor, on-premise, cloud) |
| 1.13 Requisitos | Dependências mínimas para operar |
| 1.14 Deploy | Como se instala/distribui |
| 1.15 Testes | Como a qualidade é verificada hoje (mesmo que informal) |
| 1.16 Capacitação | O que um novo usuário/operador precisa saber para operar o produto |
| 1.17 Sustentação | Quem mantém, com que cadência, e onde fica o histórico de mudanças |
| **1.18 Histórico de Evolução** | **Obrigatório — ver §2 abaixo** |

### 1.2 Bloco 2 — Tech Reference

Profundidade técnica, para leitor de engenharia/arquitetura (equipe interna, due diligence técnica, integrador).

- 2.1 Arquitetura detalhada (camadas físicas e lógicas, diagrama de fluxo de dados)
- 2.2 Stack (linguagens, bibliotecas, versões, motivo da escolha)
- 2.3 Desempenho (volumetria de referência, tempo de execução, limites conhecidos)
- 2.4 Parametrização (o que é configurável e onde)
- 2.5 ML / IA / RAG / Agentes — **obrigatório declarar explicitamente, para cada componente "inteligente" do produto, se é (a) regra/heurística determinística, (b) modelo estatístico real (ex. cadeia de Markov, rede Bayesiana, regressão, clustering) calculado de fato sobre o dado, ou (c) placeholder/mock ainda não implementado.** Esta seção é o ponto de ancoragem principal das notas de honestidade metodológica inline (§3).

### 1.3 Bloco 3 — Data Reference

- 3.1 Dicionário de dados (campo, tipo, fonte, uso no produto — ver o schema mínimo do corpus do Assistente em §5)
- 3.2 Volumetria (volume de entrada/saída de referência, tamanho de artefato gerado)
- 3.3 Esquema do(s) dado(s) de saída (o que é persistido/exportado e em que formato)

### 1.4 Bloco 4 — Base Metodológica

- 4.1 Bases teóricas dos algoritmos e abordagens usados (uma explicação por técnica, consolidada uma única vez — ver o problema de duplicação em §6)
- **4.2 Normas e Frameworks Setoriais** — subcapítulo nomeado, não diluído em "boas práticas de mercado" genérico. Ver §4.3 para o conteúdo mínimo obrigatório.
- 4.3 Referências bibliográficas/institucionais citadas

### 1.5 Bloco 5 — Use Cases

Por caso de uso relevante do produto:

- Caso (nome/resumo)
- Contexto (cenário de negócio em que se aplica)
- Benefícios (o que muda para quem usa)
- Limitações (o que o caso de uso não cobre ou exige de cuidado)
- Benchmark (comparação com alternativa de mercado, quando disponível)
- Exemplos (número, tela ou situação concreta do produto que ilustra o caso)

---

## 2. Histórico de Evolução — capítulo obrigatório do Product Report

**Regra:** todo Product Report deve ter uma seção "Histórico de Evolução" (§1.18) com uma linha do tempo real de commits/sprints/versões — não uma narrativa reconstruída de memória.

**Por que virou padrão:** dois dos três produtos maduros da Lounge já praticam isso de forma independente — JourneyGraph tem um capítulo 8 "Histórico de Evolução (Sprints)" com 14 entradas cobrindo junho–agosto de 2026, e Égide Vita tem um capítulo 8 "Histórico de Evolução (Sessão Única — Julho 2026)". O NetGraph, apesar de ser o produto mais novo e mais bem especificado via prompt formal (`docs/NETGRAPH_PROMPT.md`), não tinha esse capítulo até este documento formalizar a lacuna — o histórico dele foi reconstruído a partir de `git log --oneline -- netgraph/` (3 commits reais: topologia + motor analítico, telas de Alertas/Capacidade/Assistente, Consulta Individual + card na Lounge, todos em 2026-08-02) e passa a valer como precedente do capítulo obrigatório.

**Fonte de verdade recomendada:** `git log --oneline --date=short -- <pasta-do-produto>/` no momento de redigir o documento, complementado por qualquer changelog textual já embutido no próprio produto (ex.: seção 8/9 do corpus do Assistente, quando existir).

---

## 3. Ressalvas / Honestidade Metodológica — capítulo obrigatório, com duas camadas

**Regra:** todo produto que faça qualquer alegação de método (fórmula, modelo estatístico, fundamentação científica, comparação com outro produto) deve praticar as duas camadas abaixo simultaneamente — não uma ou outra:

1. **Nota inline, no ponto exato da alegação** (padrão observado no Égide Vita — ex.: dentro das seções 6.2 e 6.3 do Tech Reference, cada uma tem um parágrafo iniciado por "Nota de honestidade metodológica:" explicando uma correção de desenho feita durante o desenvolvimento, no lugar exato onde a alegação técnica aparece).
2. **Capítulo/anexo consolidado, que resume e referencia (por número de seção) todas as notas inline do documento** (padrão observado no JourneyGraph — Anexo B, especialmente B.7 "Bayes e Markov Reais, por Persona — Nota de Honestidade Metodológica", mais o capítulo 7 "Ressalvas Consolidadas").

**Por que as duas juntas, não uma:** só a nota inline corre o risco de se perder no meio do documento e nunca ser lida por quem só consulta o índice; só o capítulo consolidado corre o risco de a ressalva ficar desconectada da alegação específica que ela qualifica, sendo lida fora de contexto. A prática dos dois produtos maduros, cada um tendo desenvolvido independentemente metade da solução, é o próprio argumento de que o padrão completo precisa das duas metades.

**O que uma nota de honestidade metodológica deve conter, no mínimo:** (a) o que o método faz de fato, sem eufemismo; (b) o que ele NÃO é (ex.: "não é Bayes real", "não valida cientificamente o score", "não é controle de acesso de produção"); (c) se aplicável, o que mudou de uma versão anterior para a atual e por quê.

---

## 4. Base Legal / Controle de Acesso a Dado Pessoal — capítulo de primeira classe, condicional

**Regra:** sempre que um produto tiver uma funcionalidade de **Consulta Individual restrita** — acesso a dado de uma pessoa/elemento identificável, fora do agregado normal do produto, protegido por senha ilustrativa + motivo/protocolo obrigatório + log de auditoria (ainda que só em memória de sessão) + hipóteses de uso nomeadas — este capítulo é **obrigatório como capítulo de primeira classe do documento**, não uma sub-linha dentro de um capítulo genérico de "segurança" ou "IAM".

**Por que isso não é opcional:** a prática já existe, de forma independente, em dois produtos:

- **JourneyGraph — Anexo E** ("Base Legal — Acesso Individualizado sem Opt-in do Titular"): fundamenta a Consulta Individual de Assinante nas três hipóteses de uso (mandado judicial, apuração de ouvidoria, SLA de NOC), cita a base legal específica (LGT art. 3º/72, Lei 9.296/1996, Marco Civil art. 10, LGPD art. 7º VI/X), e tem um Anexo E.1 dedicado às limitações do gate de senha client-side.
- **Égide Vita — Anexo C.3** (dentro do bloco normativo): trata a base legal de consentimento por cohort (agregado/anônimo em saúde pública, coletivo em contexto corporativo/NR-1, do responsável legal em contexto parental/ECA Digital).

**Conteúdo mínimo obrigatório deste capítulo, quando presente:**

1. As hipóteses de uso nomeadas que justificam o acesso sem opt-in do titular (nunca "consulta discricionária ou de rotina").
2. A base legal específica citada por artigo/lei (não só "conformidade com a LGPD" genérico).
3. Uma nota de honestidade metodológica própria (ligando este capítulo ao §3) explicitando que a autenticação é ilustrativa/client-side e o que uma implantação de produção exigiria de verdade (SSO/LDAP, MFA, RBAC por papel, log de auditoria imutável server-side, política de retenção).

Produtos sem Consulta Individual restrita (ex.: StepGraph na versão atual) **não precisam** deste capítulo — mas devem registrar explicitamente "Não aplicável nesta versão do produto" em vez de omitir a seção silenciosamente, para deixar claro que a ausência foi avaliada, não esquecida.

---

## 5. Schema Mínimo do Corpus do Assistente

Todo produto da Lounge com Assistente RAG (mock, busca por palavras-chave) documenta a si mesmo através de um corpus de objetos com este schema mínimo:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | Identificador único do documento dentro do corpus |
| `secao` | string | Número/rótulo da seção do Tech Reference a que o documento corresponde |
| `corpus` | string | Categoria temática do documento (ex.: `metodologia`, `indicador`, `changelog`, `normativo`, `fonte_dados`, `etom`) |
| `titulo` | string | Título curto do documento, usado como cabeçalho de citação |
| `fonte` | string | Referência de origem (ex.: "JourneyGraph — Tech Reference", uma publicação científica, uma norma) |
| `texto` | string | Corpo do documento — o texto de fato buscado/citado pelo Assistente |

Este schema é o dicionário de dados de referência para a seção de Data Reference (§1.3) de qualquer produto com Assistente.

### 5.1 Problema conhecido — dois dialetos sintáticos para o mesmo schema

O schema acima é semanticamente idêntico entre os produtos, mas a **sintaxe de declaração diverge**:

- **JourneyGraph** declara o corpus como JSON estrito, com todas as chaves entre aspas: `{"id":"tr-1","secao":"1","corpus":"metodologia",...}`.
- **NetGraph e Égide Vita** declaram o corpus como objeto JavaScript literal, com chaves sem aspas: `{id:"ev-1", secao:"1", corpus:"changelog",...}`.

Os dois formatos são funcionalmente equivalentes em tempo de execução (ambos são literais de objeto JavaScript válidos), mas divergem como convenção de código, o que dificulta qualquer ferramenta futura de extração automática do corpus entre produtos (como a que gerou parte do conteúdo deste próprio conjunto de documentos precisou tratar cada produto com um parser diferente). **Recomendação:** convergir para um único padrão sintático em produtos futuros — sugere-se JSON estrito entre aspas, por ser parseável tanto por `JSON.parse` quanto por qualquer ferramenta externa sem depender de um interpretador JavaScript completo. Não é recomendado migrar retroativamente o corpus dos produtos já em produção só por causa desta divergência — o risco de regressão numa RAW de até 1,7 MB não se justifica por um ganho estético/de tooling.

---

## 6. Problema conhecido — duplicação de indicadores entre capítulos narrativos e catálogo

O JourneyGraph documenta, hoje, uma parte de seus indicadores da família Saúde Digital **duas vezes**: uma vez de forma narrativa nas seções 2.x/3.x do corpus (com fundamentação científica institucional extensa, citando OMS/Ministério da Saúde/Anvisa/CRM/CRP/SciELO) e novamente, com fórmula e regra de cálculo, no catálogo consolidado da seção 5.4. Exemplos: "Score de Menoridade" aparece em 2.6 e novamente em 5.4.6; VAMPING em 2.1 e 5.4.1; e o padrão se repete para Verificação Compulsiva, Binge Watching, Isolamento Digital, Dependência de IA e três dos quatro indicadores complementares (IFCN, IFA, IACF — CDAR é a exceção, presente só na versão narrativa).

Isso é um problema real de fonte não-única (a mesma alegação de fato — "isto é o que este indicador mede e por quê" — vive em dois lugares que podem divergir silenciosamente com o tempo). **Este padrão de documentação existe, entre outros motivos, para evitar que isso se repita**: a regra é uma fonte canônica por fato, com qualquer outra menção ao mesmo fato feita por referência de seção (ex.: "ver §5.4.6"), nunca por repetição do conteúdo. Não se recomenda editar retroativamente o corpus do JourneyGraph em produção só por causa desta duplicação — risco desproporcional ao ganho, dado que o conteúdo duplicado é hoje consistente entre si; registra-se aqui como item de melhoria futura e como o caso de estudo que motivou esta regra.

---

## 7. Aplicação aos produtos existentes

| Produto | Product Report | Tech Reference | Data Reference | Base Metodológica | Use Cases | Ressalvas (2 camadas) | Base Legal | Histórico de Evolução | Glossário e Siglas |
|---|---|---|---|---|---|---|---|---|---|
| JourneyGraph | Completo | Completo | Completo | Completo (Anexo B/C) | Completo (Anexo D) | Já pratica as 2 camadas | Já existe (Anexo E) | Já existe (cap. 8) | Completo (38 termos) |
| NetGraph | Completo | Completo | Parcial (corpus cobre só §6) | Completo (§6.4/6.5) | Parcial | Só nota inline — falta consolidação (corrigido no documento gerado) | Já existe (§6.3, formato distinto) | **Reconstruído neste ciclo a partir do git log** | Completo (24 termos) |
| Égide Vita | Completo | Completo | Completo | Completo (Anexo B/C) | Parcial | Já pratica as 2 camadas | Já existe (Anexo C.3) | Já existe (cap. 8) | Completo (22 termos) |
| StepGraph | Básico (o que existe hoje) | Não documentado nesta versão | Não documentado nesta versão | Não documentado nesta versão | Não documentado nesta versão | Não aplicável (sem alegação de método algorítmico) | Não aplicável (sem Consulta Individual) | Reconstruído a partir do git log | Completo, deliberadamente enxuto (6 termos) |
| ITXView | Enxuto (código-fonte indisponível no repositório — só bundle de produção) | Não verificável contra código-fonte | Não verificável | Parcial (citações cruzadas do JourneyGraph) | Parcial | Não verificável | Não aplicável neste levantamento | Não aplicável (sem histórico de commits específico no repositório) | Completo (14 termos) |

Os cinco documentos gerados junto com este padrão (`docs/produtos/*.docx`) aplicam esta tabela na prática — preenchendo cada bloco com conteúdo real do produto correspondente, e marcando explicitamente "Não documentado nesta versão" onde não há conteúdo real a reportar, em vez de inventar.

---

## 8. Glossário e Siglas — capítulo obrigatório, sempre o último do documento

**Regra:** todo Product Report deve incluir um capítulo "Glossário e Siglas", em ordem alfabética, como o **último capítulo do documento** — depois de Use Cases, de Ressalvas, de Base Legal (quando presente) e de qualquer anexo específico do produto. Cobrindo, cada um com definição de uma linha (duas quando a fórmula/base legal exigir):

1. **Cada indicador/métrica do produto** citado no documento — o que mede, em uma linha, sem repetir a fórmula completa já detalhada no catálogo de indicadores (Tech Reference) ou no Anexo pertinente. O glossário referencia a seção onde a fórmula completa vive; não a duplica (mesma disciplina de fonte única do §6).
2. **Cada sigla/acrônimo usado no documento** — expandida por extenso, com uma definição curta do que significa no contexto do produto (ex.: FCAPS, SPOF, RQUAL, ARPU, IX.br).
3. **Cada modelo, técnica estatística ou matemática citada** — K-Means, cadeia de Markov, rede Bayesiana, MAD, regressão linear, Divergência de Jensen-Shannon, centralidade de Brandes, HHI etc. — o que o método faz de fato, em uma linha (complementar à explicação mais longa do Anexo/§4.1 de Base Metodológica, não substituta dela).
4. **Cada framework ou norma setorial citada** — eTOM, ITU-T, TM Forum, RQUAL, LGPD, NR-1, ECA Digital etc.

**O que este glossário NÃO é:** uma lista genérica de termos de telecom ou de ciência de dados copiada de um glossário externo. **Só entram termos que o documento em questão efetivamente usa** — verificados contra o HTML/corpus fonte do produto (ou, na ausência de código-fonte como no caso do ITXView, contra o próprio texto do documento e as citações cruzadas de outros produtos). Um termo do glossário-base de um produto que não se aplica a outro (ex.: HHI e K-Means, usados no JourneyGraph e no Égide Vita, não aparecem no NetGraph, que não os calcula) deve ser omitido, não incluído "por completude". A tabela do §7 acima registra a contagem de termos que sobreviveu a essa checagem em cada um dos cinco documentos gerados junto com este padrão — StepGraph, o produto mais simples da Lounge, tem propositalmente o menor glossário (6 termos), proporcional ao que o produto de fato implementa nesta versão do repositório.

**Por que é sempre o último capítulo, mesmo depois de anexos específicos do produto:** o glossário é um índice de consulta rápida sobre o documento inteiro — só cumpre essa função se o leitor souber, sem ambiguidade, onde procurá-lo (o fim do documento), independentemente de quantos anexos o produto específico tiver antes dele.
