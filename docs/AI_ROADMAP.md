# Roadmap: IA que entende sistemas e balanceamento

## Objetivos

| # | Objetivo | Estado atual | Próximos passos |
|---|----------|--------------|-----------------|
| 1 | IA entende relações entre sistemas (economy, combat, progression) | ✅ Parcial | Domínios e suggest-relations existem. Reforçar prompts e uso em todas as chamadas de IA. |
| 2 | IA entende conceitos: Economy, Combat, Progression, Crafting, Items, World | ✅ Feito | `lib/gameDesignDomains.ts` + suggest-domain-tags com definições por domínio. |
| 3 | Sugerir relações (Combat→Enemy Stats→Damage Formula; Economy→Crafting Cost→Drop Rate; etc.) | ✅ Feito | API `suggest-relations` + menu "Sugerir relações entre sistemas". |
| 4 | Analisar consistência (ex.: HP=100, Dano=80, Poção=10 → alerta de sobrevivência) | ✅ Feito | API `analyze-consistency` + ação "Analisar consistência" no menu Ações com IA. |
| 5 | Simulação e balanceamento (economy sim, loot rates, XP curve) | 📋 Planejado | Estender analyze-consistency com "modo simulação" ou API dedicada; opcionalmente extrair números e rodar cálculos simples. |

## Arquivos principais

- **Domínios:** `lib/gameDesignDomains.ts`
- **Sugestão de tags:** `app/api/ai/suggest-domain-tags/route.ts`
- **Sugestão de relações:** `app/api/ai/suggest-relations/route.ts`
- **Análise de consistência:** `app/api/ai/analyze-consistency/route.ts` (novo)
- **Menu IA:** `app/projects/[id]/ProjectDetailClient.tsx`

---

## Melhorias na análise (etapas futuras)

Ideias para ajudar o usuário a *resolver* os alertas, a implementar em etapas:

1. **Links para as seções relacionadas**  
   Tornar "Seções relacionadas" clicáveis: ao clicar, abrir (ou navegar para) a seção no documento.

2. **"Abrir e sugerir conteúdo"**  
   Botão "Sugerir texto para esta seção" que chama a IA com o contexto do alerta e preenche/sugere rascunho na seção (ex.: fórmula de XP, relação tempo → XP).

3. **Pré-preencher o chat a partir do alerta**  
   Botão "Discutir no chat" que abre o chat com a primeira mensagem já escrita com o contexto do alerta (ex.: "Preciso detalhar o Sistema de Experiência de Fazenda...").

4. **Wizard de simulação**  
   Para alertas "Sugestão de Simulação": fluxo "Simular este sistema" com 3–5 parâmetros (XP por ação, XP para level, etc.) e resultado simples (dias para nível 10, chance de drop raro).

5. **Lista de tarefas de design** (opcional)  
   "Adicionar como tarefa" por alerta → checklist no projeto ("Detalhar cálculo de XP", "Documentar loot").

6. **Marcar alerta como resolvido** (opcional)  
   Checkbox por alerta; na próxima análise mostrar só novos ou resumo "X resolvidos".

---

## Design: preservar resultado da análise

**Problema:** A análise hoje aparece em um popup/modal. Se o usuário clicar fora, abrir um link ou navegar, o modal fecha e **perde todo o resultado**. Ele precisa da análise à mão para ir resolvendo e conferindo.

**Objetivo:** Preservar a análise para o usuário poder agir (abrir seções, chat, etc.) e voltar a consultar sem ter que rodar de novo.

**Sugestões (avaliar antes de implementar):**

- **A. Página/aba dedicada à análise**  
  Em vez de (ou além de) modal: ter um lugar fixo no projeto para o resultado (ex. rota `/projects/[id]/analysis` ou aba "Análise" no header). O usuário clica em "Analisar consistência" → vai para essa página e a análise roda lá; o resultado é o conteúdo da página e **permanece** até rodar de novo ou recarregar. Pode abrir seções em nova aba, voltar, e a análise continua lá.

- **B. Última análise persistida (store/session)**  
  Guardar o último resultado da análise (alertas + simulação) no store do projeto ou em sessionStorage por `projectId`. O modal pode continuar existindo para "visualização rápida", mas ao fechar não descarta: fica salvo. Em algum lugar (menu "Ações com IA", ou um indicador tipo "Última análise: 6 alertas") o usuário pode "Ver última análise" e reabrir o mesmo conteúdo. Assim, mesmo depois de fechar o modal ou navegar, ele pode reabrir sem rodar de novo.

- **C. Modal que não fecha no clique fora + "Abrir em página"**  
  (1) Modal só fecha com botão "Fechar" ou X (desativar close on overlay). (2) Botão "Abrir análise em nova página" que leva para uma view (ex. `/projects/[id]/analysis`) com o mesmo resultado já carregado (passando estado ou lendo do store). Aí o usuário trabalha a partir dessa página e o resultado fica preservado lá.

- **D. Drawer lateral (como o chat)**  
  Mostrar a análise em um drawer lateral em vez de modal central. O usuário pode abrir links em nova aba sem fechar o drawer. Se navegar na mesma aba (ex. clicar em link interno), ainda perde o estado a menos que se combine com B (persistir última análise) para reabrir depois.

**Recomendações:**  
- **Melhor base:** ter um **lugar fixo** para o resultado (A ou C). Assim o usuário tem uma "página da análise" onde pode voltar e de onde pode seguir os links das seções, chat, etc.  
- **Reforço:** persistir a última análise (B) em store/session, para que ao reabrir "Ver última análise" ou a página dedicada, o conteúdo ainda esteja lá sem nova chamada à API.  
- **Comportamento do modal:** se mantiver o modal, evitar fechar no clique fora (só pelo botão) e/ou oferecer "Abrir em página" para quem quiser trabalhar com a análise aberta de forma estável.
