# Especificação e Plano de Implementação — Base de Dados Clínica Integrada MapMind × Égide Vita e Console Analítico do Profissional

**Vísent OSX Telecomunicações S/A**
**Referência:** TR-VIS-2026-MAPMIND-EGIDE-002 (segue TR-VIS-2026-MAPMIND-EGIDE-001 v1.0)
**Nome de trabalho do componente:** Console Clínico Integrado MapMind × Égide Vita ("CCI" — renomeável)
**Status:** Proposta técnica para abertura de projeto. Não inicia com dado real de paciente antes do sign-off do comitê de ética/compliance (ver Seção 13).

> Este documento é autocontido: pode ser entregue a um desenvolvedor ou a um agente de IA (ex.: Claude Code) para abrir um novo projeto, sem depender do restante desta conversa. Ele assume como dado de entrada tudo o que já foi definido em **TR-VIS-2026-MAPMIND-EGIDE-001** (arquitetura de dados do MapMind, oito domínios D1–D8, Protocolo D4.RISK, personas MM-1..7, matriz de correlação subjetivo–objetivo, proposta de contrato de integração) e não o repete por extenso — resume o essencial em cada seção e referencia a seção original entre colchetes, ex. `[-001 §8]`.

---

## 0. O que este componente é (e o que não é)

O pedido de origem: as respostas autodeclaradas do paciente no MapMind devem compor, junto com os indicadores objetivos individuais (opt-in) e coletivos gerados pelo Égide Vita, **uma base de dados integrada** — e sobre essa base deve existir **uma ferramenta analítica para a profissional (Mirian Noêmia e futuros profissionais habilitados) visualizar, explorar e analisar essas informações em favor do paciente**.

Três entregas compõem este projeto:

1. **Base de dados clínica integrada** — armazena e correlaciona dado subjetivo (MapMind) + dado objetivo individual opt-in + dado objetivo coletivo/baseline (Égide Vita), sob pseudonimização e fronteiras herdadas de `[-001 §10]`.
2. **Console analítico do profissional** — a superfície de uso: visualização, exploração e análise por profissional habilitado, escopada a pacientes com vínculo terapêutico e consentimento ativos.
3. **Integrações** — os contratos de API/webhook entre MapMind Cloud, Égide Vita e esta nova camada.

**Não é escopo:** engenharia de coleta/classificação de tráfego de rede (isso é do Égide Vita, `[-001 §2]`), diagnóstico automatizado, alteração do Protocolo D4.RISK, nem qualquer forma de encaminhamento automático. Este é um instrumento de **apoio à visualização e ao raciocínio clínico humano** — nunca de decisão automatizada.

---

## PARTE I — ESPECIFICAÇÃO

### 1. Fronteiras invioláveis (herdadas, sem exceção)

Estas regras vêm de `[-001 §7 e §10]` e se aplicam **integralmente** a este novo componente — inclusive à profissional responsável técnica, inclusive sob opt-in amplo:

- O **valor de resposta do item D4.RISK nunca entra na base integrada**, em nenhuma forma (bruta, agregada, derivada, texto, flag). Não existe coluna, tabela, evento ou log que o contenha.
- **`journal_entries`** (diário terapêutico, E2) e **`beliefs`/crenças em texto livre** (D7.1, D7.2, E8) nunca são sincronizados — nem para a nuvem do próprio MapMind, muito menos para esta base integrada.
- **Nenhum termo-gatilho de crise** homologado é replicado fora do repositório do MapMind.
- **O valor/conteúdo de resposta do D4.RISK nunca alimenta correlação, persona, insight automatizado, base analítica ou relatório agregado** — nem individual nem coletivo. Isso não impede a *notificação de presença*: `[-001 §7.2]` já especifica que, havendo consentimento e profissional vinculada, o app dispara `POST /risk-alerts` com `{ user_hash, triggered_at, alert_type: "risk_item" }` — presença e horário, nunca o valor. A responsável técnica tem dever de cuidado direto com o paciente; este projeto herda esse canal já existente como **alerta de notificação em tempo real**, mantido deliberadamente **fora da base analítica integrada** (Seção 3.6) — nunca como dado de série histórica correlacionável, nunca em relatório agregado, nunca no painel corporativo do Égide Vita. A pergunta em aberto de `[-001 §12]` ("Alertas... Painel de Alertas do Égide Vita... Recomendação preliminar: não") trata do **painel corporativo** (contexto RH/SESMT, empregador) — público distinto da profissional com vínculo terapêutico consentido. Para o painel corporativo a recomendação "não" permanece; para a profissional responsável, a notificação de presença é apropriada e já prevista no produto.
- Qualquer dado coletivo/populacional do Égide Vita usado como baseline de comparação deve ser **k-anonimizado** — nunca reidentificável, mesmo combinado com outros filtros do console.

Todo teste de aceite deste projeto deve incluir um teste automatizado negativo — "X nunca aparece em nenhum payload/log/view" — no mesmo espírito dos 21 testes já existentes no D4.RISK do `mapmind-v4` (`[-001 §7.3]`).

### 2. Modelo de consentimento

Estende o mapeamento de finalidades de `[-001 §9.2]` com uma finalidade nova:

| Finalidade | O que habilita | Quem concede | Granularidade |
|---|---|---|---|
| `network` *(já existe)* | Correlação servidor-a-servidor MapMind↔Égide Vita | Paciente | Global, por escore/instrumento |
| `professional_link` *(nova)* | Vínculo paciente↔profissional específico com validade e escopo | Paciente | Por profissional, por prazo, revogável a qualquer momento |
| `professional_analytics` *(nova)* | Acesso da profissional vinculada ao console (visualização da base integrada daquele paciente) | Paciente, condicionado a `professional_link` ativo | Por domínio de dado (ex.: pode consentir escores mas não sinais objetivos individuais) |
| `professional_risk_alert` *(nova)* | Notificação de presença de evento D4.RISK à profissional vinculada — herda `[-001 §7.2]` | Paciente, condicionado a `professional_link` ativo | Binária: liga/desliga por vínculo; não tem granularidade por domínio (é presença, não conteúdo) |
| `research` *(já existe)* | Uso em baseline coletivo k-anonimizado | Paciente | Agregado, nunca individualizável |

Regras derivadas:

- **Dado objetivo individual (opt-in)** só entra na base integrada e só aparece no console se o paciente tiver `network` **e** `professional_analytics` ativos simultaneamente.
- **Dado objetivo coletivo** (baseline populacional) não exige opt-in individual — por definição não é identificável — mas exige que o Égide Vita já o forneça k-anonimizado na origem `[-001 §9.2, linha "research"]`.
- Revogar `professional_link` revoga em cascata `professional_analytics` para aquele par paciente-profissional, sem apagar histórico de auditoria de acesso já realizado (LGPD exige rastreabilidade do que já foi acessado, mesmo após revogação).
- Todo consentimento é registrado com: quem, o quê (lista de domínios/fontes), quando, validade, e evento de revogação — nunca "consentimento implícito por uso".
- `professional_risk_alert` é **independente** de `professional_analytics`: um paciente pode habilitar a notificação de presença de risco à profissional sem habilitar acesso à base analítica completa, e vice-versa. Recomenda-se que o fluxo de criação do `professional_link` apresente `professional_risk_alert` como parte padrão do consentimento de vínculo terapêutico — explicado explicitamente nesse momento, não oculto em termo geral — dado o dever de cuidado da responsável técnica; `professional_analytics` e `network` permanecem opt-in explícito e separado, sem esse padrão.

### 3. Arquitetura de dados integrada

#### 3.1 Fontes

| Fonte | Natureza | Exemplos de dado |
|---|---|---|
| MapMind Cloud | Subjetivo, pseudonimizado | Escores PHQ-9/GAD-7/WHO-5, respostas por domínio D1–D8 (exceto D4.RISK valor), metadados de exercícios |
| Égide Vita — individual (opt-in) | Objetivo, pseudonimizado | Vamping, Verificação Compulsiva, Binge Watching, IRE, DCE, Taxa de Troca de Contexto (`[-001 §8]`) |
| Égide Vita — coletivo | Objetivo, agregado, k-anonimizado | Baselines populacionais dos mesmos indicadores, por segmento não identificável |

#### 3.2 Camadas

```
[MapMind Cloud API]        [Égide Vita — webhook individual]   [Égide Vita — export coletivo]
        │                              │                                  │
        ▼                              ▼                                  ▼
   ┌─────────────────────────── STAGING (append-only, por fonte) ───────────────────────────┐
   │  Validação de payload · verificação de fronteiras (rejeita D4.RISK/journal/beliefs)     │
   │  Verificação de consentimento ativo no momento da ingestão                              │
   └───────────────────────────────────────┬──────────────────────────────────────────────────┘
                                            ▼
                          ┌───────────────────────────────────┐
                          │   BASE INTEGRADA (pseudonimizada)   │  ← Postgres, RLS por profissional
                          │   Reconciliação de pseudônimos      │
                          └────────────────┬────────────────────┘
                                            ▼
                          ┌───────────────────────────────────┐
                          │   CAMADA ANALÍTICA (serving)        │  ← views materializadas, matriz
                          │   Matriz de correlação, personas    │     de correlação, agregações
                          │   lado a lado, baseline comparativo │
                          └────────────────┬────────────────────┘
                                            ▼
                              ┌─────────────────────────┐
                              │  CONSOLE DO PROFISSIONAL │  ← API + dashboard, RBAC + auditoria
                              └─────────────────────────┘
```

#### 3.3 Modelo de dados (entidades principais)

- **`patient`** — identidade pseudonimizada nesta base (`patient_ref`), nunca nome/CPF/e-mail diretamente; vínculo com identidade real existe apenas dentro de `professional_link` (ver 3.4).
- **`consent_record`** — paciente, finalidade, domínios habilitados, profissional (se aplicável), concedido_em, válido_até, revogado_em.
- **`professional_link`** — paciente↔profissional, status, criado_em, encerrado_em.
- **`subjective_instrument_score`** — instrumento (PHQ-9/GAD-7/WHO-5), escore, nível (régua `[-001 §6]`), `scored_at`. Espelha o payload já definido em `[-001 §9.3]`.
- **`subjective_domain_response`** — domínio (D1–D8, exceto D4.RISK), item, valor, respondido_em. **Sem campo para D4.RISK.**
- **`objective_signal_individual`** — indicador Égide Vita (Vamping, Verificação Compulsiva, etc.), valor, janela temporal, `patient_ref`. Só populada sob `network` + `professional_analytics`.
- **`objective_baseline_collective`** — mesmos indicadores, agregados por segmento k-anonimizado, sem `patient_ref`.
- **`correlation_insight`** — saída do motor de correlação (Seção 5.2): par (domínio subjetivo, indicador objetivo), força observada, janela, referência à hipótese de `[-001 §8]`. Auditável e explicável — nunca "caixa-preta".
- **`persona_assignment`** — persona MM-x (MapMind) e PerfilDeRisco (Égide Vita) lado a lado, por paciente e período — **sem fusão automática** (ver decisão na Seção 3.5).
- **`access_audit_log`** — todo acesso da profissional a dado de um paciente: quem, quando, o quê, de onde. Imutável (append-only, sem UPDATE/DELETE em nível de aplicação).

Nenhuma entidade contém: valor de D4.RISK, texto de `journal_entries`, texto de `beliefs`, termos-gatilho. O evento de risco em si (presença + horário) **não é uma entidade desta base** — ver Seção 3.6.

#### 3.4 Reconciliação de pseudônimos

`[-001 §9.1]` deixa em aberto se `user_hash = SHA-256(user_id + salt rotativo mensal)` do MapMind é compatível com o esquema de pseudonimização do Égide Vita/CDRView. Proposta:

- Um **serviço de resolução de identidade** separado da base analítica, que guarda **apenas** o mapeamento hash-MapMind ↔ hash-Égide-Vita ↔ `patient_ref` interno — nunca dado clínico.
- Esse serviço só grava um mapeamento quando **ambos** os consentimentos (`network` no MapMind e o opt-in equivalente no Égide Vita) estão ativos simultaneamente, e remove o mapeamento (não apenas marca como inativo) na revogação de qualquer um dos dois.
- Acesso a esse serviço é o ponto de maior sensibilidade técnica do projeto — deve ter seu próprio controle de acesso, mais restrito que o resto do sistema, e ser auditado separadamente. Recomenda-se que decisão de design final seja validada com quem mantém o esquema de pseudonimização do lado Égide Vita/CDRView antes da Fase F1 (pergunta aberta herdada de `[-001 §12]`).

#### 3.5 Personas: paralelas, não fundidas (decisão proposta)

`[-001 §5 e §12]` deixa em aberto se as personas MM-1..7 devem se fundir num vetor único com o PerfilDeRisco do Égide Vita. **Proposta deste projeto: manter paralelas na Fase 1.** O console mostra as duas classificações lado a lado e deixa a síntese para a profissional — fundir os dois motores de clusterização é uma mudança de arquitetura em ambos os produtos, exige validação estatística própria (`[-001 §12]`, item "Validação estatística") e não deveria bloquear a entrega do console. Reavaliar fusão como iniciativa de Fase F6+ (Seção 9).

#### 3.6 Canal de alerta de risco — separado da base analítica

Herda `[-001 §7.2]`: o app já dispara `POST /risk-alerts` com `{ user_hash, triggered_at, alert_type: "risk_item" }` quando há consentimento e profissional vinculada. Este projeto consome esse mesmo evento para notificar a profissional em tempo real, mas com isolamento arquitetural deliberado do restante da base:

- **Serviço próprio** (`risk-alert-notifier`), não uma tabela da base integrada — evita que o evento seja acidentalmente incluído em uma query analítica, um `JOIN`, ou um export.
- Armazena apenas `{ patient_ref, professional_ref, triggered_at }` — sem valor, sem contexto, sem termo-gatilho. Retenção mínima necessária para fins de auditoria de que a notificação foi entregue (não para reconstrução de histórico clínico).
- Entrega como notificação push/e-mail/painel em tempo real ao profissional vinculado — nunca como linha consultável na timeline do paciente (Seção 4.2.1) nem como insumo do motor de correlação (Seção 4.2.2).
- **Nunca** tem `JOIN`, chave estrangeira ou pipeline de exportação em comum com `correlation_insight`, `persona_assignment` ou qualquer view analítica.
- Confirmação de recebimento pela profissional é registrada em `access_audit_log` (Seção 4.1) — não em uma tabela clínica.
- O protocolo de crise em si (CVV/CAPS/SAMU, mediado por humano) continua **inalterado e no app**, `[-001 §7.2]` — este canal é *adicional*: informa a profissional de que o protocolo foi acionado, não o substitui nem o intermedeia.

### 4. Console analítico do profissional

#### 4.1 Perfis de acesso (RBAC)

| Papel | Acesso |
|---|---|
| Profissional habilitada (ex.: Mirian Noêmia) | Pacientes com `professional_link` ativo consigo; dado conforme `professional_analytics` consentido por domínio; recebe notificação de risco (Seção 3.6) sob `professional_risk_alert` independentemente de `professional_analytics` |
| Compliance/auditoria | `access_audit_log` e metadados de consentimento; **nunca** dado clínico bruto |
| Administrador técnico | Configuração de integrações e saúde do pipeline; **nunca** dado clínico, mesmo agregado |

Toda sessão exige autenticação forte, timeout curto, e cada leitura de dado de paciente grava uma linha em `access_audit_log`.

#### 4.2 Casos de uso principais

1. **Timeline consolidada do paciente** — escores de instrumentos (D1–D8, régua `[-001 §6]`) e indicadores objetivos individuais opt-in, no mesmo eixo temporal, para a profissional ver convergência ou divergência ao longo do tempo.
2. **Exploração da matriz de correlação** — reaproveita as hipóteses de `[-001 §8]` (ex.: D3.1/D6.5↔Vamping, D6.2↔Verificação Compulsiva, D5.1/D5.2↔DCE) e mostra, com dado real daquele paciente, se a correlação hipotética se sustenta — com transparência de que é **observação qualitativa**, não validação estatística populacional (essa é item separado, `[-001 §12]`).
3. **Comparação com baseline coletivo k-anonimizado** — contextualiza "este padrão está fora do esperado para a população" sem nunca expor outro indivíduo.
4. **Personas lado a lado** — MM-x e PerfilDeRisco, sem fusão automática (Seção 3.5), com nota explícita de que a leitura integrada é da profissional.
5. **Régua de encaminhamento** — Verde/Amarelo/Laranja (`[-001 §6]`) apenas dentro das telas exploratórias/analíticas (Seção 4.2.1–4.2.4). **Vermelho/D4.RISK não é dado analítico e não aparece nessas telas** — o protocolo de crise em si permanece exclusivamente no fluxo já implementado do app (`[-001 §7]`), com CVV/CAPS/SAMU, mediado por humano, fora desta ferramenta.
6. **Notificação de risco em tempo real** (não é dado analítico — ver Seção 3.6) — um alerta de presença, separado de qualquer tela exploratória: *"paciente vinculado acionou o protocolo de risco em [data/hora]"*, sem valor, sem contexto, sem histórico consultável. É a materialização, neste console, do dever de cuidado da profissional — herdada de `[-001 §7.2]`, nunca uma funcionalidade analítica.
7. **Trilha de consentimento e auditoria por paciente** — o que está consentido, desde quando, e quem acessou o quê (inclui confirmações de recebimento do item 6).

#### 4.3 O que o console nunca mostra nas telas exploratórias/analíticas (lista negativa explícita)

- Valor de resposta do D4.RISK ou qualquer conteúdo/contexto do evento, sob qualquer forma — a única exposição permitida é a notificação de presença isolada do item 4.2.6, nunca dentro de timeline, matriz de correlação, persona ou export.
- Conteúdo de `journal_entries` ou `beliefs` em texto livre.
- Qualquer dado de outro paciente, mesmo agregado, fora de baseline k-anonimizado.
- Qualquer indicador objetivo individual sem `network` + `professional_analytics` ativos.
- Persona fundida automaticamente (Seção 3.5) — apenas leitura lado a lado.
- Evento de risco (Seção 3.6) misturado a qualquer `JOIN`, view ou export analítico.

#### 4.4 Requisitos não funcionais

- LGPD Art. 11 (dado de saúde como dado sensível) e NR-1 quando aplicável (`[-001 §11]`).
- Criptografia em trânsito (TLS) e em repouso (equivalente ao AES-256-GCM já usado no MapMind, `[-001 §3]`).
- `access_audit_log` imutável, exportável para fins de compliance.
- Exportação de relatório para prontuário: apenas dado já visível na tela, nunca payload bruto de rede.

### 5. Integrações

#### 5.1 Contrato com MapMind Cloud

Reaproveita o endpoint interno `POST /scores` já existente (`[-001 §9.3]`): `{ user_hash, instrument, score, level, scored_at }`, mais um novo endpoint de leitura de respostas por domínio (D1–D8, exceto D4.RISK) sob o mesmo `user_hash`.

#### 5.2 Contrato com Égide Vita

Modelo servidor-a-servidor via webhook, `user_hash` como chave, conforme `[-001 §9.1]`. Payload individual proposto:

```json
{
  "user_hash": "sha256(...)",
  "indicator": "vamping | verificacao_compulsiva | binge_watching | ire | dce | taxa_troca_contexto",
  "value": 0.0,
  "window_start": "2026-08-01T00:00:00Z",
  "window_end": "2026-08-07T00:00:00Z"
}
```

Payload coletivo (baseline), sem `user_hash`:

```json
{
  "indicator": "vamping",
  "segment": "k-anonimizado, ex. faixa etária + região",
  "population_stat": { "mean": 0.0, "p50": 0.0, "p90": 0.0 },
  "k": 25,
  "window_start": "2026-08-01T00:00:00Z",
  "window_end": "2026-08-07T00:00:00Z"
}
```

Pré-condições de ambos, herdadas de `[-001 §9.1]`: consentimento específico, parceria formal entre os projetos, pseudonimização bilateral verificada (Seção 3.4).

#### 5.3 Pontos em aberto herdados que este projeto depende de resolver

De `[-001 §12]`, os que bloqueiam ou moldam este projeto:

- Compatibilidade/bridging de pseudonimização (Seção 3.4) — **bloqueante para F1**.
- Personas paralelas vs. fundidas — decisão proposta em Seção 3.5, revisitar em F6.
- Validação estatística da matriz de correlação — quem conduz, quando — **não bloqueia o console, mas molda como a Seção 4.2.2 é rotulada** (hipótese vs. validado).
- Homologação conjunta de limiares entre régua do MapMind e limiares do Égide Vita — decisão de comitê de ética, fora do escopo de engenharia.
- **Alertas ao profissional responsável — resolvida por este projeto** (não permanece em aberto): a recomendação preliminar "não" de `[-001 §12]` aplicava-se ao painel corporativo do Égide Vita; para a profissional com vínculo terapêutico e dever de cuidado direto, este projeto adota a notificação de presença já prevista em `[-001 §7.2]`, isolada em canal próprio (Seção 3.6). Validar essa leitura com Mirian Noêmia e com o comitê de ética antes de F0 sign-off, já que envolve dado de saúde sensível mesmo sendo apenas presença/horário.

---

## PARTE II — PLANO DE IMPLEMENTAÇÃO

### 6. Stack tecnológica proposta

| Camada | Proposta | Racional |
|---|---|---|
| Base integrada | PostgreSQL, com Row-Level Security por profissional/paciente | Suporta RLS nativo (reforça RBAC no nível do banco, não só da API), maduro para dado sensível auditável |
| Serviço de resolução de identidade | Serviço isolado, banco próprio (pode ser o mesmo Postgres, schema separado com acesso restrito) | Isola o ponto mais sensível (Seção 3.4) do resto do sistema |
| API analítica (serving) | REST, TypeScript/Node ou Python (alinhar com stack já usada no backend do Égide Vita, a confirmar) | Consistência com equipe existente |
| Motor de correlação | Job assíncrono (ex.: cron/worker) que materializa `correlation_insight`, não cálculo síncrono na request | Correlação não precisa ser real-time; simplifica auditoria do que foi calculado quando |
| Dashboard do profissional | Web (React), gráficos com D3/Observable Plot | Consistência visual com JourneyGraph/NetGraph já existentes no ecossistema Vísent |
| Autenticação | SSO/OAuth2 com MFA para profissionais | Dado de saúde sensível exige autenticação forte |

### 7. Estrutura de repositório sugerida

```
mapmind-egide-cci/
├── docs/
│   └── TR-VIS-2026-MAPMIND-EGIDE-002.md        # este documento, versionado com o projeto
├── services/
│   ├── ingestion/                               # staging + validação de fronteira por fonte
│   │   ├── mapmind-connector/
│   │   └── egide-vita-connector/
│   ├── identity-resolution/                     # Seção 3.4, isolado
│   ├── risk-alert-notifier/                     # Seção 3.6 — isolado da base analítica, sem FK/JOIN com ela
│   ├── correlation-engine/                      # Seção 4.2.2, jobs assíncronos
│   └── analytics-api/                           # serving layer + RBAC + auditoria
├── apps/
│   └── professional-console/                    # dashboard React (Seção 4)
├── db/
│   ├── migrations/
│   └── policies/                                 # RLS policies versionadas
└── tests/
    ├── boundary/                                 # testes negativos: D4.RISK/journal/beliefs nunca aparecem na base analítica
    ├── risk-alert-isolation/                     # testes negativos: evento de risco nunca alcançável via analytics-api
    └── consent/                                  # testes de cascata de revogação
```

### 8. Fases de implementação

| Fase | Entrega | Bloqueante para próxima fase |
|---|---|---|
| **F0 — Fundamentos** | Modelo de dados final, modelo de consentimento revisado, **sign-off do comitê de ética/compliance** para qualquer piloto com dado real | Sim — nenhuma fase com dado real avança sem isso |
| **F1 — Ingestão (dado sintético)** | Conectores MapMind + Égide Vita, staging com validação de fronteira, serviço de resolução de identidade, `risk-alert-notifier` isolado (Seção 3.6) | Compatibilidade de pseudonimização resolvida (Seção 5.3) |
| **F2 — Base integrada** | Schema em produção, RLS, testes automatizados de fronteira (D4.RISK/journal/beliefs nunca persistem) | Testes de fronteira 100% verdes |
| **F3 — Camada analítica** | Motor de correlação, views de persona lado a lado, baseline comparativo | — |
| **F4 — Console do profissional** | Telas da Seção 4.2, RBAC, auditoria, ainda com dado sintético | Validação de UX com a profissional (Mirian Noêmia) |
| **F5 — Piloto controlado** | Poucos pacientes reais, opt-in específico e documentado, sob acompanhamento do comitê de ética | Aprovação formal do piloto |
| **F6 — Validação estatística e decisões de fusão** | Validação empírica da matriz de correlação (Seção 4.2.2), decisão informada sobre personas paralelas vs. fundidas (Seção 3.5) | — |

### 9. Critérios de aceite (por fase, resumido)

- **F1/F2:** suite `tests/boundary/` cobre — para cada fonte de ingestão — um teste que injeta um payload contendo D4.RISK/journal/beliefs e verifica rejeição antes de tocar a base integrada.
- **F2:** revogar `professional_link` em teste automatizado deve resultar em zero linhas visíveis daquele paciente para aquela profissional na próxima consulta à API, imediatamente.
- **F4:** nenhuma tela do console consegue renderizar D4.RISK/journal/beliefs mesmo com dado de teste malicioso injetado propositalmente (teste de UI/E2E dedicado). Notificação de risco (Seção 3.6) é entregue como alerta isolado, nunca aparece em timeline/matriz/persona/export.
- **F5:** todo acesso da profissional durante o piloto está em `access_audit_log`, verificável por amostragem pelo comitê de ética, incluindo confirmações de recebimento das notificações de risco.

### 10. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Vazamento de dado de risco (D4.RISK) por erro de integração | Testes negativos automatizados em toda camada (Seção 9), reforçados por revisão de código específica antes de cada release que toque ingestão |
| Reidentificação indevida via combinação de baseline coletivo + filtros do console | Enforce k-anonimato mínimo na origem (Égide Vita) e reforçar no console com bloqueio de filtros que reduzam segmento abaixo do k mínimo |
| Incompatibilidade de esquema de pseudonimização | Resolver Seção 3.4 com o time do Égide Vita/CDRView antes de F1 — não inferir |
| Uso do console para decisão automatizada de encaminhamento | Por design, o console não expõe API de "ação automática" — toda ação de encaminhamento permanece manual, fora do sistema |
| Consentimento amplo demais interpretado como "vale tudo" | Consentimento sempre por domínio explícito (Seção 2), nunca um único toggle "aceitar tudo" |

### 11. Dependências e decisões bloqueantes antes de dado real

1. Sign-off do comitê de ética/compliance (F0).
2. Confirmação, com o time responsável pelo Égide Vita/CDRView, da estratégia de bridging de pseudonimização (Seção 3.4).
3. Formalização de parceria entre os projetos (pré-condição já citada em `[-001 §9.1]`).
4. Validação com Mirian Noêmia (responsável clínica) do desenho de telas do console antes de F5.

### 12. Prompt de abertura de projeto

Texto pronto para colar na abertura de uma nova sessão/projeto Claude Code:

> Abra um novo projeto para o **Console Clínico Integrado MapMind × Égide Vita**, conforme a especificação em `TR-VIS-2026-MAPMIND-EGIDE-002` (este documento). Comece pela Fase F0/F1 descrita na Seção 8: modelo de dados (Seção 3.3), staging com validação de fronteira (Seção 1) e conectores de ingestão sintética para MapMind e Égide Vita (Seção 5). Não inclua em nenhuma tabela, payload ou log o valor do item D4.RISK, o conteúdo de `journal_entries` ou o texto de `beliefs` — isso é regra absoluta, testada automaticamente (Seção 1 e 9). Use dado sintético até que as decisões bloqueantes da Seção 11 estejam resolvidas.

---

**Fim do Documento — TR-VIS-2026-MAPMIND-EGIDE-002 · Base de Dados Clínica Integrada e Console Analítico do Profissional · Agosto de 2026**
