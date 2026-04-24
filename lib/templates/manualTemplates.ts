import type { AppLocale } from "@/lib/i18n/config";
import type { BuildPageTypeAddonsOptions, PageTypeId } from "@/lib/pageTypes/registry";
import type { RichDocBlock } from "@/lib/addons/types";

export type WizardProjectType = "digital_game";
export type WizardGenre = "rpg" | "roguelike" | "platformer" | "puzzle" | "simulation";
export type WizardPlatform = "pc" | "mobile" | "console" | "web";
export type WizardScope = "mini" | "medio" | "completo";
export type WizardStyle = "enxuto" | "padrao" | "profundo";

export type WizardChoices = {
  projectType: WizardProjectType;
  genre: WizardGenre;
  platforms: WizardPlatform[];
  scope: WizardScope;
  style: WizardStyle;
};

export type TemplateSection = {
  id: string;
  title: string;
  content: string;
  subsections?: TemplateSection[];
  /**
   * Optional page type assignment. When present, the section is created with
   * the page type's default addons seeded — the same way the sidebar's
   * page-type picker does — instead of a plain text-only section.
   *
   * `options` is fed into `buildPageTypeAddons` to pre-seed the addons
   * (e.g. attribute presets, seeded currency defaults, etc.).
   */
  pageType?: {
    id: PageTypeId;
    options?: BuildPageTypeAddonsOptions;
  };
};

export type ResolvedTemplate = {
  projectTitle: string;
  projectDescription: string;
  sections: TemplateSection[];
};

type GenreMeta = {
  baseTitle: string;
  description: string;
};

type LocaleText = {
  en: string;
  es: string;
};

const section = (
  id: string,
  title: string,
  content: string,
  subsections?: TemplateSection[],
  pageType?: TemplateSection["pageType"]
): TemplateSection => ({ id, title, content, subsections, pageType });

const GENRE_META: Record<WizardGenre, GenreMeta> = {
  rpg: {
    baseTitle: "Projeto RPG",
    description: "Template de RPG focado em progressao profunda, combate, narrativa e economia.",
  },
  roguelike: {
    baseTitle: "Projeto Roguelike",
    description: "Template de roguelike focado em run design, variabilidade e metaprogressao.",
  },
  platformer: {
    baseTitle: "Projeto Platformer",
    description: "Template de platformer focado em sensacao de controle, faseamento e desafio.",
  },
  puzzle: {
    baseTitle: "Projeto Puzzle",
    description: "Template de puzzle focado em regras formais, onboarding e curva de dificuldade.",
  },
  simulation: {
    baseTitle: "Projeto Simulacao",
    description: "Template de simulacao focado em sistemas interligados, economia e tuning.",
  },
};

const TEMPLATE_TEXT_TRANSLATIONS: Record<string, LocaleText> = {
  "Visao Geral": { en: "Overview", es: "Visión general" },
  "Visao Geral Completa": { en: "Full Overview", es: "Visión general completa" },
  "Core Loop": { en: "Core Loop", es: "Bucle principal" },
  "Core Loop e Loops Secundarios": { en: "Core Loop and Secondary Loops", es: "Bucle principal y bucles secundarios" },
  "Progressao": { en: "Progression", es: "Progresión" },
  "Progressao e Dificuldade": { en: "Progression and Difficulty", es: "Progresión y dificultad" },
  "Progressao, Dificuldade e Balanceamento": { en: "Progression, Difficulty and Balance", es: "Progresión, dificultad y balance" },
  "Controles e Input": { en: "Controls and Input", es: "Controles e input" },
  "Controles, Input e Acessibilidade": { en: "Controls, Input and Accessibility", es: "Controles, input y accesibilidad" },
  "Controles, Acessibilidade e QoL": { en: "Controls, Accessibility and QoL", es: "Controles, accesibilidad y QoL" },
  "UX/UI": { en: "UX/UI", es: "UX/UI" },
  "UX/UI Essencial": { en: "Essential UX/UI", es: "UX/UI esencial" },
  "UX/UI e Feedback": { en: "UX/UI and Feedback", es: "UX/UI y feedback" },
  "Roadmap Inicial": { en: "Initial Roadmap", es: "Roadmap inicial" },
  "Roadmap e Riscos": { en: "Roadmap and Risks", es: "Roadmap y riesgos" },
  "Roadmap de Producao": { en: "Production Roadmap", es: "Roadmap de producción" },
  "Mecanicas Centrais": { en: "Core Mechanics", es: "Mecánicas centrales" },
  "Mecanicas e Regras de Sistema": { en: "Mechanics and System Rules", es: "Mecánicas y reglas de sistema" },
  "Direcao de Arte e Audio": { en: "Art and Audio Direction", es: "Dirección de arte y audio" },
  "Arte e Audio": { en: "Art and Audio", es: "Arte y audio" },
  "Tecnologia": { en: "Technology", es: "Tecnología" },
  "Tecnologia e Arquitetura": { en: "Technology and Architecture", es: "Tecnología y arquitectura" },
  "Riscos e Mitigacoes": { en: "Risks and Mitigations", es: "Riesgos y mitigaciones" },
  "KPIs e Telemetria": { en: "KPIs and Telemetry", es: "KPIs y telemetría" },
  "Monetizacao (quando aplicavel)": { en: "Monetization (when applicable)", es: "Monetización (cuando aplica)" },
  "QA, Testes e Instrumentacao": { en: "QA, Testing and Instrumentation", es: "QA, pruebas e instrumentación" },
  "Classes e Atributos": { en: "Classes and Attributes", es: "Clases y atributos" },
  "Sistema de Combate": { en: "Combat System", es: "Sistema de combate" },
  "Combate": { en: "Combat", es: "Combate" },
  "Mundo e Narrativa": { en: "World and Narrative", es: "Mundo y narrativa" },
  "Personagens Jogaveis": { en: "Playable Characters", es: "Personajes jugables" },
  "Atributos": { en: "Attributes", es: "Atributos" },
  "Itens e Equipamentos": { en: "Items and Equipment", es: "Ítems y equipamiento" },
  "Narrativa e NPCs": { en: "Narrative and NPCs", es: "Narrativa y NPCs" },
  "Economia": { en: "Economy", es: "Economía" },
  "Mecanicas Principais de RPG": { en: "Main RPG Mechanics", es: "Mecánicas principales de RPG" },
  "Exploracao": { en: "Exploration", es: "Exploración" },
  "Inventario": { en: "Inventory", es: "Inventario" },
  "Personagens, Classes e Buildcraft": { en: "Characters, Classes and Buildcraft", es: "Personajes, clases y buildcraft" },
  "Classes": { en: "Classes", es: "Clases" },
  "Arvore de Habilidades": { en: "Skill Tree", es: "Árbol de habilidades" },
  "Sistema de Combate Avancado": { en: "Advanced Combat System", es: "Sistema de combate avanzado" },
  "Formulas Base": { en: "Base Formulas", es: "Fórmulas base" },
  "IA Inimiga e Bosses": { en: "Enemy AI and Bosses", es: "IA enemiga y jefes" },
  "Itens, Equipamentos e Loot": { en: "Items, Equipment and Loot", es: "Ítems, equipamiento y loot" },
  "Politica de Loot": { en: "Loot Policy", es: "Política de loot" },
  "Upgrade e Encantamento": { en: "Upgrade and Enchanting", es: "Mejora y encantamiento" },
  "Narrativa, Lore e Missoes": { en: "Narrative, Lore and Quests", es: "Narrativa, lore y misiones" },
  "Sistemas Secundarios": { en: "Secondary Systems", es: "Sistemas secundarios" },
  "Economia e Monetizacao de RPG": { en: "RPG Economy and Monetization", es: "Economía y monetización de RPG" },
  "Estrutura de Run": { en: "Run Structure", es: "Estructura de run" },
  "Metaprogressao": { en: "Meta Progression", es: "Meta progresión" },
  "Run Design": { en: "Run Design", es: "Diseño de run" },
  "Geracao Procedural": { en: "Procedural Generation", es: "Generación procedural" },
  "Buildcraft e Sinergias": { en: "Buildcraft and Synergies", es: "Buildcraft y sinergias" },
  "Metaprogressao e Persistencia": { en: "Meta Progression and Persistence", es: "Meta progresión y persistencia" },
  "Economia de Run": { en: "Run Economy", es: "Economía de run" },
  "Arquitetura de Run": { en: "Run Architecture", es: "Arquitectura de run" },
  "Curva de Risco": { en: "Risk Curve", es: "Curva de riesgo" },
  "Objetivos Primario e Secundario": { en: "Primary and Secondary Objectives", es: "Objetivos primario y secundario" },
  "Geracao Procedural Avancada": { en: "Advanced Procedural Generation", es: "Generación procedural avanzada" },
  "Combate, Armas e Modificadores": { en: "Combat, Weapons and Modifiers", es: "Combate, armas y modificadores" },
  "Buildcraft": { en: "Buildcraft", es: "Buildcraft" },
  "Elites e Bosses": { en: "Elites and Bosses", es: "Élites y jefes" },
  "Economia e Loja de Run": { en: "Run Economy and Shop", es: "Economía y tienda de run" },
  "Movimento": { en: "Movement", es: "Movimiento" },
  "Estrutura de Fases": { en: "Level Structure", es: "Estructura de niveles" },
  "Physics e Controle": { en: "Physics and Control", es: "Física y control" },
  "Level Design": { en: "Level Design", es: "Diseño de niveles" },
  "Checkpoints e Recuperacao": { en: "Checkpoints and Recovery", es: "Checkpoints y recuperación" },
  "Inimigos e Obstaculos": { en: "Enemies and Obstacles", es: "Enemigos y obstáculos" },
  "Recompensas e Colecionaveis": { en: "Rewards and Collectibles", es: "Recompensas y coleccionables" },
  "Sistema de Movimento Avancado": { en: "Advanced Movement System", es: "Sistema de movimiento avanzado" },
  "Parametros de Movimento": { en: "Movement Parameters", es: "Parámetros de movimiento" },
  "Assistencias": { en: "Assists", es: "Asistencias" },
  "Arquitetura de Fases": { en: "Level Architecture", es: "Arquitectura de niveles" },
  "Curva de Dificuldade e Pacing": { en: "Difficulty Curve and Pacing", es: "Curva de dificultad y pacing" },
  "Combate (se aplicavel)": { en: "Combat (if applicable)", es: "Combate (si aplica)" },
  "Boss Fights": { en: "Boss Fights", es: "Combates de jefe" },
  "Economia de Colecionaveis": { en: "Collectibles Economy", es: "Economía de coleccionables" },
  "Playtest de Sensacao de Controle": { en: "Control Feel Playtest", es: "Playtest de sensación de control" },
  "Regras do Puzzle": { en: "Puzzle Rules", es: "Reglas del puzzle" },
  "Progressao de Fases": { en: "Level Progression", es: "Progresión de niveles" },
  "Feedback": { en: "Feedback", es: "Feedback" },
  "Regras Formais": { en: "Formal Rules", es: "Reglas formales" },
  "Taxonomia de Puzzles": { en: "Puzzle Taxonomy", es: "Taxonomía de puzzles" },
  "Onboarding Pedagogico": { en: "Pedagogical Onboarding", es: "Onboarding pedagógico" },
  "Sistema de Dicas": { en: "Hint System", es: "Sistema de pistas" },
  "Telemetria de Dificuldade": { en: "Difficulty Telemetry", es: "Telemetría de dificultad" },
  "Modelo Formal do Puzzle": { en: "Formal Puzzle Model", es: "Modelo formal del puzzle" },
  "Solver de Referencia": { en: "Reference Solver", es: "Solver de referencia" },
  "Geracao de Conteudo": { en: "Content Generation", es: "Generación de contenido" },
  "Curva de Dificuldade": { en: "Difficulty Curve", es: "Curva de dificultad" },
  "Onboarding e Tutoriais": { en: "Onboarding and Tutorials", es: "Onboarding y tutoriales" },
  "Sistema de Hints e Recuperacao": { en: "Hints and Recovery System", es: "Sistema de pistas y recuperación" },
  "UI Cognitiva": { en: "Cognitive UI", es: "UI cognitiva" },
  "Analytics de Qualidade": { en: "Quality Analytics", es: "Analítica de calidad" },
  "Plano de Conteudo": { en: "Content Plan", es: "Plan de contenido" },
  "Loop de Gestao": { en: "Management Loop", es: "Bucle de gestión" },
  "Recursos": { en: "Resources", es: "Recursos" },
  "Cadeias de Producao": { en: "Production Chains", es: "Cadenas de producción" },
  "Economia Sistemica": { en: "Systemic Economy", es: "Economía sistémica" },
  "Agentes e Comportamento": { en: "Agents and Behavior", es: "Agentes y comportamiento" },
  "Eventos Dinamicos": { en: "Dynamic Events", es: "Eventos dinámicos" },
  "UI de Operacao e Telemetria": { en: "Operations UI and Telemetry", es: "UI operativa y telemetría" },
  "Modelagem de Sistemas": { en: "Systems Modeling", es: "Modelado de sistemas" },
  "Buffers e Capacidade": { en: "Buffers and Capacity", es: "Buffers y capacidad" },
  "Economia de Simulacao": { en: "Simulation Economy", es: "Economía de simulación" },
  "Agentes, IA e Comportamentos": { en: "Agents, AI and Behaviors", es: "Agentes, IA y comportamientos" },
  "Eventos e Gestao de Crise": { en: "Events and Crisis Management", es: "Eventos y gestión de crisis" },
  "Balanceamento e Tuning": { en: "Balancing and Tuning", es: "Balance y tuning" },
  "UX de Supervisao": { en: "Supervision UX", es: "UX de supervisión" },
  "Expansao de Conteudo": { en: "Content Expansion", es: "Expansión de contenido" },
};

// ───────────────────────────────────────────────────────────────────
// Page-type seed helpers
// ───────────────────────────────────────────────────────────────────
// Small factories that build `BuildPageTypeAddonsOptions` payloads used
// to pre-seed addons on page-typed template sections. Kept here — not in
// the registry — because they're opinionated defaults scoped to template
// starter kits, not to the app-wide page type system.

/**
 * Progression table seed covering the most common 1→20 level range with a
 * gentle exponential growth. Good default for starter kits because it shows
 * the progression curve visibly without feeling overwhelming.
 */
function seedProgression1to20(): TemplateSection["pageType"] {
  return {
    id: "progression",
    // progression page type seeds xpBalance + progressionTable with its own
    // defaults; we don't need to override here — tuning is done in the UI.
  };
}

/** RPG-style attributes: HP, ATK, DEF, MAG, SPD. */
function seedRpgAttributes(): TemplateSection["pageType"] {
  return {
    id: "attributeDefinitions",
    options: {
      attributeDefinitionsOverrides: {
        attributes: [
          { key: "hp", label: "HP", valueType: "int", defaultValue: 100, min: 0 },
          { key: "atk", label: "ATK", valueType: "int", defaultValue: 10, min: 0 },
          { key: "def", label: "DEF", valueType: "int", defaultValue: 5, min: 0 },
          { key: "mag", label: "MAG", valueType: "int", defaultValue: 8, min: 0 },
          { key: "spd", label: "SPD", valueType: "int", defaultValue: 5, min: 0 },
        ],
      },
    },
  };
}

/** Platformer-style attributes: HP and Speed — simpler, movement-centric. */
function seedPlatformerAttributes(): TemplateSection["pageType"] {
  return {
    id: "attributeDefinitions",
    options: {
      attributeDefinitionsOverrides: {
        attributes: [
          { key: "hp", label: "HP", valueType: "int", defaultValue: 3, min: 0 },
          { key: "spd", label: "Speed", valueType: "float", defaultValue: 1.0, min: 0 },
          { key: "jump", label: "Jump Height", valueType: "float", defaultValue: 1.5, min: 0 },
        ],
      },
    },
  };
}

/** Simple economy page — defaults to the registry's seeded currency. */
function seedEconomy(): TemplateSection["pageType"] {
  return { id: "economy" };
}

/** Single character example (class/enemy) — relies on registry defaults. */
function seedCharacterExample(): TemplateSection["pageType"] {
  return { id: "characters" };
}

/** Single equipment item example. */
function seedEquipmentExample(): TemplateSection["pageType"] {
  return { id: "equipmentItem" };
}

/** Single consumable/collectible item example. */
function seedItemExample(): TemplateSection["pageType"] {
  return { id: "items" };
}

/** Craft table example — starts empty, user links recipes later. */
function seedCraftTableExample(): TemplateSection["pageType"] {
  return { id: "craftTable" };
}

/** Narrative rich-doc page for lore/script content. */
function seedNarrative(): TemplateSection["pageType"] {
  return { id: "narrative" };
}

// ───────────────────────────────────────────────────────────────────
// Rich doc block builders — short, readable helpers for authoring the
// templates below. We keep the output as BlockNote-compatible blocks
// (matching the editor's document shape). Minimal metadata: the editor
// fills ids/defaults on load.
// ───────────────────────────────────────────────────────────────────

/** Paragraph block with a single plain-text run. */
function p(text: string): RichDocBlock {
  return {
    type: "paragraph",
    content: [{ type: "text", text, styles: {} }],
  };
}

/** Heading block (h2 by default — templates rarely need h1). */
function h(text: string, level: 1 | 2 | 3 = 2): RichDocBlock {
  return {
    type: "heading",
    props: { level },
    content: [{ type: "text", text, styles: {} }],
  };
}

/** Bullet list item. */
function li(text: string): RichDocBlock {
  return {
    type: "bulletListItem",
    content: [{ type: "text", text, styles: {} }],
  };
}

/** Callout block (variant maps to CalloutVariantId). */
function callout(
  variant: "note" | "warning" | "design-decision" | "balance-note",
  text: string
): RichDocBlock {
  return {
    type: "callout",
    props: { variant },
    content: [{ type: "text", text, styles: {} }],
  };
}

/**
 * Factory for a "narrative" template section pre-seeded with rich-doc
 * blocks. Use this for sections that tell the user what a concept is +
 * show a worked example from a fictional game.
 *
 * `shortSummary` fills the section's plain `content` markdown (used in
 * search + list previews). The `blocks` become the richDoc addon body.
 */
function narrative(
  id: string,
  title: string,
  shortSummary: string,
  blocks: RichDocBlock[],
  subsections?: TemplateSection[]
): TemplateSection {
  return {
    id,
    title,
    content: shortSummary,
    subsections,
    pageType: {
      id: "narrative",
      options: { richDocBlocks: blocks },
    },
  };
}

/**
 * Factory for a "group container" section — a narrative page whose job
 * is to introduce a cluster of child sections (Design, Conteudo, etc.)
 * so the user opening the GDD has a mental map of what's in each branch.
 *
 * The container itself is browseable (has intro text + a list of what's
 * inside) and its children appear underneath it in the sidebar.
 */
function groupContainer(
  id: string,
  title: string,
  summary: string,
  intro: string,
  whatsInside: string[],
  children: TemplateSection[]
): TemplateSection {
  return {
    id,
    title,
    content: summary,
    subsections: children,
    pageType: {
      id: "narrative",
      options: {
        richDocBlocks: [
          h(title, 2),
          p(intro),
          h("O que tem aqui", 3),
          ...whatsInside.map((item) => li(item)),
          callout(
            "note",
            "Abra as subpaginas ao lado pra ver detalhes. Voce pode preencher nessa ordem ou saltar pro que quer atacar primeiro."
          ),
        ],
      },
    },
  };
}

const COMMON_BY_SCOPE: Record<WizardScope, TemplateSection[]> = {
  mini: [
    section(
      "common-mini-visao-geral",
      "Visao Geral",
      "Defina nome do jogo, pitch, publico-alvo, plataformas e diferencial principal."
    ),
    narrative(
      "common-mini-core-loop",
      "Core Loop",
      "O ciclo principal que o jogador repete — a essencia do jogo.",
      [
        h("O que e um Core Loop?", 2),
        p(
          "Core Loop e o ciclo de acoes que o jogador repete o tempo todo. E a resposta pra \"o que o jogador ESTA FAZENDO quando joga seu jogo?\"."
        ),
        h("Exemplos por Genero", 3),
        li("RPG: explorar → combater → ganhar XP/loot → melhorar personagem → explorar area mais dificil."),
        li("Roguelike: descer andar → coletar itens → lutar boss → morrer/avancar → gastar meta currency."),
        li("Platformer: correr → pular → alcancar checkpoint → enfrentar desafio novo."),
        li("Puzzle: ver fase → testar hipotese → ajustar → resolver → proxima fase."),
        li("Simulation: coletar recursos → transformar → distribuir → reinvestir."),
        callout(
          "design-decision",
          "Um core loop deve caber numa frase. Se precisa de um paragrafo pra descrever, voce tem loops demais — escolha o dominante."
        ),
        callout(
          "warning",
          "Todo o resto do jogo (narrativa, UI, economia) gira em torno do core loop. Comece por ele — nao tente definir economia antes de saber o que o jogador vai fazer com o dinheiro."
        ),
      ]
    ),
    {
      id: "common-mini-progressao",
      title: "Progressao",
      content: "Como o jogador evolui, desbloqueia conteudo e percebe ganho de poder.",
      pageType: {
        id: "progression",
        options: {
          richDocBlocks: [
            h("O que e Progressao?", 2),
            p(
              "Progressao e a sensacao de \"estou ficando melhor\" que o jogador percebe ao longo da sessao e entre sessoes. Pode ser numerica (nivel/stats), de habilidade (player aprende melhor), de conteudo (novas areas), ou narrativa (historia avanca)."
            ),
            h("Tipos de Progressao", 3),
            li("Numerica: stats sobem, itens melhores, numeros maiores."),
            li("De Habilidade: player executa melhor, mesmo sem mudanca no jogo."),
            li("De Conteudo: novas areas, inimigos, mecanicas desbloqueadas."),
            li("Narrativa: historia avanca, novos NPCs, mundo muda."),
            callout(
              "design-decision",
              "Os melhores jogos misturam 3+ tipos. So numerica vira grind; so habilidade vira frustracao; so conteudo vira drift (nunca termina). Equilibre."
            ),
            callout(
              "note",
              "A tabela de progressao ao lado vem com uma curva de XP exponencial 1-20. Use-a como ponto de partida e ajuste os numeros em playtest."
            ),
            callout(
              "warning",
              "Progressao e o que faz o jogador VOLTAR amanha. Se ele nao tem claro o que ganha por jogar mais 30min, voce perde retencao."
            ),
          ],
        },
      },
    },
    narrative(
      "common-mini-controles",
      "Controles e Input",
      "Mapeamento basico por plataforma.",
      [
        h("Controles e Input", 2),
        p(
          "Como o jogador interage com o jogo fisicamente. Mapping claro aqui evita retrabalho enorme depois."
        ),
        h("Regras de Ouro", 3),
        li("Maximo 4-5 botoes principais no core loop. Mais vira luta com controles."),
        li("Botoes devem ser semanticamente agrupados: \"acoes ofensivas\" juntas, \"acoes defensivas\" juntas."),
        li("Plataforma mobile: alvo minimo de 44px por hit area (Apple HIG)."),
        callout(
          "design-decision",
          "Controles bons sao invisiveis: jogador esquece deles e foca no jogo. Controles ruins aparecem como frustracao constante."
        ),
        callout(
          "warning",
          "Testar controles com PAD + TECLADO + MOUSE (se PC) desde cedo. Alguns designs funcionam num, falham no outro."
        ),
      ]
    ),
    narrative(
      "common-mini-ui",
      "UX/UI Essencial",
      "HUD minimo, feedback visual e fluxo de menus.",
      [
        h("UX/UI Essencial", 2),
        p(
          "HUD (Heads-Up Display) mostra informacao em jogo. Menus sao telas fora do jogo. Ambos precisam ser rapidos de ler e de navegar."
        ),
        h("HUD", 3),
        li("Mostra SO informacao critica: HP, recursos chave, alerta urgente."),
        li("Sempre no mesmo canto da tela — jogador aprende onde olhar."),
        li("Some em momentos cinematicos."),
        h("Menus", 3),
        li("Fluxo principal com no maximo 3 clicks ate qualquer tela."),
        li("Back button consistente (mesmo local em todas as telas)."),
        li("Feedback imediato: todo botao pressionado responde em < 100ms."),
        callout(
          "design-decision",
          "HUD minimalista vence HUD rico em quase todos os casos. Se voce DEVE mostrar algo, pergunte: \"quando o jogador consulta isso?\" Se raramente, fora do HUD."
        ),
        callout(
          "warning",
          "Evite popup de tutorial no meio do gameplay. Ensine pelo DESIGN (ver Onboarding Pedagogico em Puzzle, se tem), nao por texto."
        ),
      ]
    ),
    narrative(
      "common-mini-roadmap",
      "Roadmap Inicial",
      "Do protipo ao primeiro jogavel — marcos realistas.",
      [
        h("Roadmap Inicial", 2),
        p(
          "Roadmap e o plano de construcao do jogo em marcos. Cada marco entrega algo jogavel e testavel. Sem marcos, projeto naufraga em \"quase pronto\" eterno."
        ),
        h("Marcos Tipicos pra Mini-Jogo", 3),
        li("M1 — Protipo vertical: 1 tela, 1 mecanica, sem arte final (2-4 semanas)."),
        li("M2 — Primeiro jogavel: core loop completo, 3-5 fases, arte placeholder (6-10 semanas)."),
        li("M3 — Content complete: todas as fases, arte final 70%, audio 50% (12-16 semanas)."),
        li("M4 — Polish + lancamento: bugs, audio 100%, marketing (4-8 semanas)."),
        callout(
          "design-decision",
          "Protipo vertical ANTES de content complete: voce prova que o core loop e divertido com 1 tela. Se nao for, mudar 1 tela e barato. Mudar 50 fases e catastrofico."
        ),
        callout(
          "balance-note",
          "Dobre todos os prazos. Solo dev: triplique. Nao e pessimismo — e estatistica. Jogos estao sempre atrasados."
        ),
        callout(
          "warning",
          "Se voce nao consegue quebrar o projeto em marcos claros, ainda nao tem projeto — tem ideia. Marcos sao o primeiro sinal de execucao real."
        ),
      ]
    ),
  ],
  medio: [
    // Visao Geral is now genre-specific — each genre provides its own rich,
    // narrative version (e.g. rpg-medio-visao-geral-elder).
    narrative(
      "common-medio-core-loop",
      "Core Loop e Loops Secundarios",
      "Loop principal + loops de suporte (economia, colecao, crafting).",
      [
        h("Core Loop Primario", 2),
        p(
          "O loop que o jogador executa 80% do tempo. Descreva em 3-5 passos curtos, de acao a recompensa, fechando em nova acao."
        ),
        h("Loops Secundarios", 3),
        p(
          "Loops que alimentam o primario mas nao sao o foco. Aparecem com menos frequencia, geralmente em momentos escolhidos pelo jogador."
        ),
        li("Economia: jogador vende/compra entre ciclos principais."),
        li("Colecao: jogador junta itens raros encontrados na exploracao."),
        li("Crafting: jogador transforma recursos entre sessoes."),
        li("Social: jogador interage com outros entre runs."),
        callout(
          "design-decision",
          "Loops secundarios NAO devem interromper o primario por mais de 1-2 min. Se \"comprar pocao\" exige 5min de menu, voce matou o flow."
        ),
        callout(
          "balance-note",
          "Playtest: peca pro jogador descrever o que \"fez\" no jogo. Se ele nao mencionar o core loop nas primeiras 3 frases, ele esta confuso sobre o que o jogo pede."
        ),
        callout(
          "warning",
          "Evite empilhar loops secundarios antes do primario estar redondo. 3 loops ruins nao viram 1 bom."
        ),
      ]
    ),
    narrative(
      "common-medio-mecanicas",
      "Mecanicas Centrais",
      "As mecanicas que definem o jogo — o que o jogador faz moment-to-moment.",
      [
        h("Mecanicas Centrais", 2),
        p(
          "Mecanicas sao as acoes que o jogador executa + as regras que definem como o mundo responde. Diferenca pra \"feature\": uma feature e uma adicao (ex: sistema de guilda). Uma MECANICA e uma acao (ex: pular, atacar, negociar)."
        ),
        h("Categorias comuns", 3),
        li("Movimento — como o jogador se move (correr, pular, esquivar, voar)."),
        li("Interacao — como o jogador interage com o mundo (atacar, usar, falar, coletar)."),
        li("Progressao — como o jogador evolui (ganhar XP, craftar, melhorar gear)."),
        li("Recursos — como o jogador gerencia (vida, mana, moedas, inventario)."),
        h("Regra de definicao", 3),
        p(
          "Pra cada mecanica, defina: entrada (botao/input), saida (resultado no jogo), regras de exceção (quando NAO funciona)."
        ),
        callout(
          "design-decision",
          "Mecanicas com exceção clara (ex: \"nao pode pular dentro da agua\") sao MAIS divertidas que mecanicas sempre disponiveis. A restricao e o que cria problema pra jogador resolver."
        ),
        callout(
          "balance-note",
          "Jogos bons tem 5-8 mecanicas centrais. Menos de 3: jogo raso. Mais de 10: jogador sobrecarregado. Se voce listou 15, pense o que pode fundir."
        ),
        callout(
          "warning",
          "Mecanicas devem aparecer no DESIGN antes de aparecer no jogo. Se voce esta implementando sem ter definido aqui, e receita de sistema incoerente."
        ),
      ]
    ),
    {
      id: "common-medio-progressao",
      title: "Progressao e Dificuldade",
      content: "Curva de progressao + dificuldade calibrada + marcos de desbloqueio.",
      pageType: {
        id: "progression",
        options: {
          richDocBlocks: [
            h("Progressao e Dificuldade", 2),
            p(
              "Progressao e \"o que o jogador ganha ao jogar\". Dificuldade e \"qual desafio e apresentado\". As duas precisam andar juntas: se so sobe progressao, jogo vira trivial; se so sobe dificuldade, vira frustrante."
            ),
            h("Curva de Progressao", 3),
            p(
              "A tabela ao lado mostra valores por nivel. Exponencial (crescimento 1.15) e um bom default — cresce perceptivelmente mas nao explode. Ajuste em playtest."
            ),
            li("Linear: ganho constante por nivel. Funciona em puzzle/platformer."),
            li("Exponencial: ganho acelera. Funciona em RPG/roguelike (matches time-to-max)."),
            li("Softcap: ganho acelera ate X, depois achata. Funciona em MMO/long-term."),
            h("Marcos de Desbloqueio", 3),
            li("Toda 5-10 niveis, desbloqueie ALGO (nova mecanica, area, classe)."),
            li("Evite \"niveis vazios\" (so stats sobem, nada novo acontece)."),
            callout(
              "design-decision",
              "Milestones (nao so niveis) e o que mantem engajamento. Nivel 17 sem nada de novo e chato. Nivel 15 com \"desbloqueou skill nova\" mantem o jogador."
            ),
            callout(
              "balance-note",
              "Tempo alvo entre marcos: 20-45min in-game. Menos = milestone inflation (perde valor). Mais = jogador cansa antes do proximo."
            ),
            callout(
              "warning",
              "Dificuldade deve subir MAIS LENTAMENTE que progressao. Senao, o jogador nao sente ganho — continua no mesmo nivel de desafio relativo."
            ),
          ],
        },
      },
    },
    narrative(
      "common-medio-controles",
      "Controles, Acessibilidade e QoL",
      "Mapping, remapping e acessibilidade.",
      [
        h("Controles, Acessibilidade e QoL", 2),
        p(
          "Controles respondem a pergunta \"como jogo?\". Acessibilidade a \"posso jogar?\". QoL (Quality of Life) a \"jogar e prazeroso?\". As tres precisam estar planejadas."
        ),
        h("Controles", 3),
        li("Mapping principal por plataforma (PC, console, mobile)."),
        li("Input buffering em acoes rapidas (ex: dash durante pulo)."),
        li("Dead zones customizaveis em sticks analogicos."),
        h("Acessibilidade Basica", 3),
        li("Remapping de todos os botoes."),
        li("Daltonismo: UI nao pode depender SO de cor pra transmitir info."),
        li("Opcao de reducao de flash/motion (epilepsia, enjoo)."),
        li("Legendas por padrao ON em cutscenes/dialogo."),
        h("QoL Classicos", 3),
        li("Autosave frequente + save manual."),
        li("Skip de cutscenes ja vistas."),
        li("Sistema de pause confiavel em qualquer momento."),
        callout(
          "design-decision",
          "Acessibilidade nao e pos-producao. Planejar desde Alpha (ex: escolher paleta com contraste alto, evitar UI so-com-cor) e 100x mais barato que retrofit."
        ),
        callout(
          "balance-note",
          "QoL e o que separa \"jogo bom\" de \"jogo que jogadores AMAM\". Autosave robusto, skip de repetitivo, UI limpa — tudo invisivel quando funciona, devastador quando falta."
        ),
        callout(
          "warning",
          "Se voce lanca sem remapping de botoes, esta EXCLUINDO jogadores com desabilidade motora. E nao custa muito implementar — e decisao, nao limitacao."
        ),
      ]
    ),
    narrative(
      "common-medio-ui",
      "UX/UI e Feedback",
      "HUD, menus, fluxos e feedback consistente.",
      [
        h("UX/UI e Feedback", 2),
        p(
          "UI e visual. UX e comportamento. Feedback e resposta. Os tres formam uma experiencia coerente — faltando um, o jogo sente defeituoso."
        ),
        h("Arquitetura de Telas", 3),
        li("Menu principal (novo jogo, continuar, opcoes, creditos)."),
        li("Menu in-game (pause, inventario, mapa, opcoes)."),
        li("Telas de overlay (level up, death, victory)."),
        h("Feedback Consistente", 3),
        li("Som e animacao para toda acao do jogador."),
        li("Feedback de erro distinto de feedback de sucesso (cor, som)."),
        li("Anticipa acao quando possivel (hover state em botao)."),
        callout(
          "design-decision",
          "Feedback consistente = contrato com o jogador. Se \"verde = bom\" em uma tela, tem que ser verde em todas. Quebrar isso gera desconfianca."
        ),
        callout(
          "balance-note",
          "Latencia perceptivel: acima de 100ms entre input e feedback, jogador percebe como lag. Em genres competitivos (FPS, fighting), alvo < 50ms."
        ),
      ]
    ),
    narrative(
      "common-medio-arte-audio",
      "Arte e Audio",
      "Direcao visual + assinatura sonora.",
      [
        h("Arte e Audio", 2),
        p(
          "Arte define a PRIMEIRA impressao. Audio define a IMERSAO. Juntos, criam a identidade do jogo — marca o jogador de forma que mecanica sozinha nao consegue."
        ),
        h("Direcao de Arte", 3),
        li("Moodboard: 20-40 imagens que representam o look/feel desejado."),
        li("Paleta: cores primarias e secundarias limitadas (nao mais de 5-7)."),
        li("Silhuetas: todos os personagens/inimigos devem ser reconheciveis em silhueta."),
        li("Animacao chave: idle, walk/run, ataque, morte. Qualidade acima da quantidade."),
        h("Direcao de Audio", 3),
        li("Assinatura musical: 2-3 temas principais que voltam em variacoes."),
        li("SFX: cada acao chave tem som unico e identificavel."),
        li("Audio ambient: background que preenche sem distrair."),
        li("Mix: SFX > musica em momentos de acao; musica > SFX em cinematicas."),
        callout(
          "design-decision",
          "Restricao de paleta/estilo AUMENTA identidade. Jogos com 20 estilos visuais misturados parecem generic. Limite quantidade pra maximizar impacto."
        ),
        callout(
          "balance-note",
          "Playtest SEM som. Se o jogo sente perda dramatica, audio esta fazendo o trabalho pesado — bom sinal. Se sente igual, audio esta decorativo — repensa."
        ),
        callout(
          "warning",
          "Audio final (composer, voice acting) e caro. Placeholder audio ate Beta e aceitavel — pro final, contrate cedo pra evitar crunch artistico."
        ),
      ]
    ),
    narrative(
      "common-medio-tecnologia",
      "Tecnologia",
      "Engine, ferramentas, pipeline e decisoes tecnicas.",
      [
        h("Tecnologia", 2),
        p(
          "Decisoes tecnicas tem custo assimetrico: trocar depois e MUITO mais caro que decidir certo cedo. Pensar aqui cedo salva meses depois."
        ),
        h("Principais Decisoes", 3),
        li("Engine: Unity / Unreal / Godot / Custom — cada uma com tradeoffs de velocidade, custo, licenciamento."),
        li("Linguagem: C# / C++ / GDScript / Lua — pela equipe e pela engine."),
        li("Arquitetura: ECS / MVC / state machines — define como sistemas se conectam."),
        li("Versionamento: git / perforce / svn + branching strategy (trunk-based, gitflow)."),
        li("Backend (se houver): auth, save cloud, analytics, A/B."),
        h("Pipeline", 3),
        li("Asset pipeline: como arte/audio sai do tool pra o jogo (automacao)."),
        li("Build system: como gera builds testaveis (CI/CD)."),
        li("Test suite: smoke tests automatizados, regressao."),
        callout(
          "design-decision",
          "Escolha engine pelo QUE VOCE PODE ENTREGAR, nao pelo que parece bonito. Unreal e poderoso mas exige time grande. Godot e leve mas ecosystem menor. Escolha por fit."
        ),
        callout(
          "balance-note",
          "Build time cresce com projeto. Investir em CI cedo (de mes 3) evita 30min de build manual em mes 12. Pensa matematica: 30min × 10 builds/dia × 6 meses = 150h perdidos."
        ),
        callout(
          "warning",
          "Dependencia de biblioteca com licenca ambigua e bomba-relogio. Audit legal em Beta PELO MENOS — melhor no Alpha."
        ),
      ]
    ),
    narrative(
      "common-medio-roadmap-riscos",
      "Roadmap e Riscos",
      "MVP/Alpha/Beta/Launch + catalogo de riscos com mitigacao.",
      [
        h("Roadmap e Riscos", 2),
        p(
          "Roadmap sem analise de riscos e optimismo enganador. Toda decisao de planejamento tem risco embutido — documenta-los separa projeto serio de wishlist."
        ),
        h("Marcos Tipicos", 3),
        li("MVP (Minimum Viable Product) — core loop + 20% do conteudo final. Jogavel por estranhos."),
        li("Alpha — 70% do conteudo. Funcionalmente completo, cheio de bugs. Playtest externo."),
        li("Beta — 95% do conteudo. Polish fase. Bug hunting, otimizacao, localizacao."),
        li("Soft Launch — release em 1-2 territorios. Valida retencao, monetizacao."),
        li("Global Launch — marketing push, servidor scaling, suporte ao vivo."),
        h("Riscos Comuns (categorizados)", 3),
        li("Risco de Escopo — designs que crescem alem do orcamento. Ex: \"so mais uma classe\"."),
        li("Risco Tecnico — dependencia critica que pode falhar. Ex: engine nova que ninguem dominou."),
        li("Risco de Mercado — concorrente lanca primeiro. Ex: outro RPG com mesmo tema."),
        li("Risco de Equipe — dev chave sai. Ex: lead programmer burnout."),
        li("Risco de Plataforma — mudanca em politica. Ex: Apple muda regras de IAP."),
        callout(
          "design-decision",
          "Pra cada risco: probabilidade (baixa/media/alta) + impacto (baixo/medio/alto) + plano de mitigacao. Risco \"medio×alto\" sem mitigacao significa projeto provavelmente vai explodir."
        ),
        callout(
          "balance-note",
          "Regra de bolso: scope creep e o risco #1 de 90% dos projetos. Nao e tecnologia. Nao e arte. E \"nao saber quando parar de adicionar\"."
        ),
        callout(
          "warning",
          "Projetos que ignoram riscos falham por motivos previsiveis. Projetos que documentam riscos falham por motivos imprevisiveis (mais raros). Na duvida, documente."
        ),
        callout(
          "warning",
          "Revisite esta secao a cada marco. Riscos mudam: o que era critico no MVP pode ser trivial no Beta, e vice-versa."
        ),
      ]
    ),
  ],
  completo: [
    narrative(
      "common-completo-visao-geral",
      "Visao Geral Completa",
      "Pitch, publico, plataformas, referencias + USP + Metas de Produto.",
      [
        h("Visao Geral — preencha com SEU jogo", 2),
        p(
          "Esta pagina e o resumo executivo do seu projeto. Qualquer pessoa (dev novo, publisher, marketing) deve conseguir entender o projeto inteiro lendo esta pagina por 2-3 minutos."
        ),
        h("Campos Essenciais", 3),
        li("Nome do jogo (final ou working title)."),
        li("Genero (incluindo micro-genero: nao so \"RPG\", mas \"RPG tatico em turnos com elementos de deck-building\")."),
        li("Publico-alvo (faixa etaria, plataforma preferida, jogos similares que consomem)."),
        li("Plataformas alvo (ordem de prioridade)."),
        li("Referencias (3-5 jogos que inspiram, com POR QUE)."),
        li("Pitch (uma frase que vende o jogo)."),
        li("Diferencial competitivo (o que te torna escolhido em vez do concorrente)."),
        callout(
          "warning",
          "Os subitens abaixo (USP e Metas de Produto) aprofundam. Comece por eles se ainda nao tem claro o que diferencia o seu jogo."
        ),
        callout(
          "design-decision",
          "Se voce nao consegue preencher esta pagina com numeros e decisoes concretas, o projeto ainda e ideia. Projetos reais tem pitch claro, publico definido, plataforma priorizada."
        ),
      ],
      [
        narrative(
          "common-completo-visao-usp",
          "USP e Proposta de Valor",
          "Unique Selling Proposition detalhada.",
          [
            h("USP — Unique Selling Proposition", 2),
            p(
              "USP e o que separa seu jogo dos concorrentes. Nao e \"melhor graficos\" nem \"mais conteudo\" — e uma COMBINACAO ESPECIFICA de elementos que ninguem mais tem."
            ),
            h("Template", 3),
            li("\"Um [genero] com [mecanica principal unica] onde o jogador [acao central] em [contexto especifico]\"."),
            h("Exemplos", 3),
            li("Hades: \"Um roguelike onde a morte avanca a narrativa e relacionamentos interpessoais sao metaprogressao.\""),
            li("Celeste: \"Um platformer preciso onde a dificuldade extrema e acompanhada de modo assist sem penalidade.\""),
            li("Monument Valley: \"Um puzzle 3D onde a perspectiva e a mecanica, nao decorativa.\""),
            callout(
              "design-decision",
              "USP especifico > USP amplo. \"Jogo divertido\" nao e USP. \"Roguelike com narrativa que avanca na morte\" e USP."
            ),
            callout(
              "balance-note",
              "Teste seu USP com 10 pessoas que nao conhecem o projeto. Se metade nao consegue repetir em uma frase, USP ainda esta confuso."
            ),
            callout(
              "warning",
              "Sem USP claro, marketing fica generico e dificil de pegar. Publisher rejeita. Media ignora. USP e o gancho — invista."
            ),
          ]
        ),
        narrative(
          "common-completo-visao-meta",
          "Metas de Produto",
          "Objetivos de experiencia + metas de qualidade.",
          [
            h("Metas de Produto", 2),
            p(
              "Definir objetivos ANTES da producao permite medir sucesso. Sem metas, qualquer resultado pode ser justificado como \"o que era esperado\"."
            ),
            h("Metas de Experiencia", 3),
            li("Sentimento dominante no core loop (ex: tensao, descoberta, dominio, zen)."),
            li("Momento memoravel por sessao (o que o jogador vai contar pro amigo)."),
            li("Curva de engajamento: primeira hora, primeiros 10 horas, long-term."),
            h("Metas de Qualidade", 3),
            li("Meta critica: Metacritic 80+? 70+? Depende do orcamento."),
            li("Meta de user review: 85%+ positivo no Steam."),
            li("Meta de retencao D7: 30%+ pra indie premium, 20%+ pra F2P."),
            h("Metas de Negocio (se aplicavel)", 3),
            li("Vendas no primeiro mes."),
            li("ROI (Return on Investment) em 12 meses."),
            li("Break-even point."),
            callout(
              "design-decision",
              "Metas devem ser ambiciosas MAS alcancaveis. \"Vender 1M\" em um primeiro jogo indie e delirio. \"Vender 30k no ano 1\" pode ser meta razoavel pra mercado especifico."
            ),
            callout(
              "warning",
              "Metas muito vagas (ex: \"fazer um bom jogo\") nao orientam decisoes. Metas muito rigidas (ex: \"MUST hit 90 meta\") levam a cortar escopo arriscado. Calibre."
            ),
          ]
        ),
      ]
    ),
    narrative(
      "common-completo-core-loop",
      "Core Loop e Loops Secundarios",
      "Ciclo principal + loops de suporte detalhados.",
      [
        h("Arquitetura de Loops", 2),
        p(
          "Todo jogo tem 1 core loop DOMINANTE (executado 70-80% do tempo) + loops secundarios. A relacao entre eles define o feel do jogo."
        ),
        callout(
          "design-decision",
          "Se voce nao consegue identificar o core loop dominante, o design ainda esta inconclusivo. Todo jogo \"bom\" que voce joga tem UM loop que voce repete mais que os outros — e intencional."
        ),
        callout(
          "warning",
          "Os dois subitens abaixo detalham loop primario e secundarios. Preencha ambos antes de definir outros sistemas do jogo — sem core loop claro, todo o resto vira suposicao."
        ),
      ],
      [
        narrative(
          "common-completo-loop-primario",
          "Loop Primario",
          "Etapas com entrada, decisao e saida por ciclo.",
          [
            h("Loop Primario", 2),
            p(
              "Descreva o loop em 3-5 passos. Cada passo deve ter: entrada (o que dispara), acao (o que o jogador faz), saida (o que o jogador recebe, que alimenta o proximo passo)."
            ),
            h("Template", 3),
            li("Passo 1: [entrada] → [acao] → [saida]."),
            li("Passo 2: [saida do 1 vira entrada] → [acao] → [saida]."),
            li("... fecha de volta no passo 1 com variacao."),
            callout(
              "design-decision",
              "Fechar o loop com VARIACAO (nao mesma coisa) e o que impede tedio. Ex: depois de lutar inimigo X, jogador volta pra lutar X+1, nao X de novo."
            ),
            callout(
              "balance-note",
              "Tempo de um ciclo do loop primario: de 30s (platformer) a 10min (RPG). Se leva > 15min, considere quebrar em sub-loops."
            ),
          ]
        ),
        narrative(
          "common-completo-loop-sec",
          "Loops Secundarios",
          "Sistemas que alimentam ou recompensam o core loop.",
          [
            h("Loops Secundarios", 2),
            p(
              "Sistemas que o jogador acessa esporadicamente. Alimentam o core loop (crafting prepara ferramentas pra exploracao) ou recompensam progresso (social celebra conquistas)."
            ),
            li("Social: guilds, chat, ranking, PvP opcional."),
            li("Crafting: receitas, workshops, upgrade."),
            li("Eventos: sazonais, semanais, narrativos."),
            li("Desafios: achievements, mastery challenges."),
            callout(
              "design-decision",
              "Loop secundario deve ter seu PROPRIO loop pequeno — nao deve ser so uma tela estatica. \"Craftar um item\" ja eh um mini-loop (juntar materiais → combinar → ganhar item)."
            ),
            callout(
              "warning",
              "Priorize o minimo viavel de secundarios no lancamento. Guilda, ranking, eventos, crafting — e MUITO sistema. Escolha 1-2 pro lancamento e planeje os outros pra pos-launch."
            ),
          ]
        ),
      ]
    ),
    narrative(
      "common-completo-mecanicas",
      "Mecanicas e Regras de Sistema",
      "Mecanicas formalizadas + regras de sistema + interdependencias.",
      [
        h("Mecanicas Formalizadas", 2),
        p(
          "Para cada mecanica, documente: o que faz, quando esta disponivel, interdependencia com outras, e como o jogador aprende ela."
        ),
        h("Template por Mecanica", 3),
        li("Nome — ex: \"Dash\"."),
        li("Input — ex: \"pressionar botao X no ar\"."),
        li("Efeito — ex: \"movimento rapido de 2m na direcao do stick\"."),
        li("Restricoes — ex: \"1 uso por pulo, cooldown de 0.3s\"."),
        li("Interacoes — ex: \"pode atravessar projetis, nao pode atravessar paredes\"."),
        li("Ensino — ex: \"introduzido no mundo 3 apos obstaculo que exige\"."),
        h("Interdependencia entre Sistemas", 3),
        p(
          "Mecanicas nunca vivem isoladas. Documente como combinam: dash + ataque = dash-attack. XP + equipamento = item de nivel. Esta matriz e o que da profundidade ao jogo."
        ),
        callout(
          "design-decision",
          "Mecanicas que COMBINAM multiplicam possibilidades. 3 mecanicas que se combinam tem MAIS design space que 6 mecanicas isoladas. Priorize combinacao, nao adicao."
        ),
        callout(
          "balance-note",
          "Toda mecanica nova EXIGE re-validacao das existentes. Adicionou dash? Testa combate, plataforma, exploracao com dash ATIVO em cada uma. Senao, voce criou bugs invisiveis."
        ),
        callout(
          "warning",
          "Mecanica que voce nao consegue ensinar ao jogador em 1-2 minutos de gameplay e forte candidata a ser removida. Mecanicas invisiveis ao jogador sao dinheiro jogado fora."
        ),
      ]
    ),
    narrative(
      "common-completo-progressao",
      "Progressao, Dificuldade e Balanceamento",
      "Curva de poder + gates + controle de power creep.",
      [
        h("Progressao e Balanceamento", 2),
        p(
          "Em jogos grandes (RPG completo, MMO, roguelike), progressao tem 3 dimensoes: curva de poder (quanto o player cresce), gates de conteudo (o que destrava quando), e controle de power creep (evitar que conteudo antigo vire trivial)."
        ),
        h("Os 3 Erros Classicos", 3),
        li("Curva plana — jogador nao sente progresso. Abandona."),
        li("Curva muito ingrime — jogador que atrasa nunca recupera. Abandona."),
        li("Power creep descontrolado — conteudo novo invalida antigo. Backlog inutil."),
        callout(
          "design-decision",
          "A solucao pra power creep moderno e scaling: enemigos/desafios escalam com player. Perde sensacao de dominar? NAO — com limiares (nivel 1-20 escala, 20+ para). Hibrido preserva os dois sentimentos."
        ),
        callout(
          "warning",
          "Os dois subitens abaixo aprofundam XP e Economia separadamente. Sao o coracao do balanceamento — erre neles e o jogo inteiro fica desequilibrado."
        ),
      ],
      [
        {
          id: "common-completo-balance-xp",
          title: "Balanceamento de XP",
          content: "Custos de nivel, pacing de level up e power spikes.",
          pageType: {
            id: "progression",
            options: {
              richDocBlocks: [
                h("Balanceamento de XP", 2),
                p(
                  "XP e a moeda de tempo do jogador. Cada atividade (matar, quest, boss) da XP. Curva define quanto XP subir de nivel. Erros aqui afetam a experiencia inteira."
                ),
                h("Tipos de Curva", 3),
                li("Linear: nivel N custa N × base. Previsivel. Bom pra jogos de sessao curta."),
                li("Exponencial: nivel N custa base × 1.15^N. Cresce acelerado. Bom pra RPG."),
                li("Tiered (patamar): custos saltam em niveis pivots (10, 25, 50). Bom pra MMO."),
                li("Softcap: exponencial ate X, depois linear lento. Bom pra mobile long-term."),
                h("Regras de Ouro", 3),
                li("Primeiros niveis devem ser RAPIDOS (2-3 min). Prende o jogador."),
                li("Niveis mid-game: 15-30 min. Sweet spot de engagement."),
                li("Endgame: 1-3 h por nivel. Respeita tempo mas mantem horizonte."),
                callout(
                  "design-decision",
                  "Primeiros niveis rapidos (\"easy wins\") sao cientificamente comprovados (dopamine hit). Nao punca novato com level slow."
                ),
                callout(
                  "balance-note",
                  "Playtestar com dados reais: telemetria tempo-ate-level(N) por quartil de jogador. Se quartil inferior demora 5x mais que mediana, curva esta muito severa pra casual."
                ),
                callout(
                  "warning",
                  "A tabela ao lado comeca com exponencial 1.15. Ajuste apos PRIMEIRO playtest — nunca em teoria pura. Seu jogo concreto tem demandas que numero sozinho nao prevê."
                ),
              ],
            },
          },
        },
        {
          id: "common-completo-balance-economia",
          title: "Balanceamento de Economia",
          content: "Fontes/sinks de moeda, inflacao e controles antifarming.",
          pageType: {
            id: "economy",
            options: {
              richDocBlocks: [
                h("Balanceamento de Economia", 2),
                p(
                  "Economia saudavel e circular: moeda entra (fontes), moeda sai (sinks). Se entra mais que sai, inflacao (moeda vira lixo). Se sai mais que entra, escassez (jogador nao consegue nada)."
                ),
                h("Fontes Comuns", 3),
                li("Drop de combate (menor valor, alta frequencia)."),
                li("Missoes (valor medio, frequencia controlada)."),
                li("Bosses (valor alto, raro)."),
                li("Venda de itens (liquida excesso de inventario)."),
                h("Sinks Comuns", 3),
                li("Consumiveis (pocoes, buffs temporarios)."),
                li("Equipamento (upgrade, repair, sockets)."),
                li("Fast-travel, housing, cosmeticos."),
                li("Taxas e impostos (quando faz sentido narrativamente)."),
                callout(
                  "design-decision",
                  "Cosmeticos sao sinks eficientes: tiram moeda sem afetar balanceamento de poder. Muitos jogos usam cosmeticos so pra estabilizar economia."
                ),
                callout(
                  "balance-note",
                  "Alvo: razao fontes/sinks = 1.1-1.3 em steady state (jogador com reserva saudavel). Se > 2.0, inflacao. Se < 1.0, jogador frustrado."
                ),
                callout(
                  "warning",
                  "Controles antifarming sao essenciais. Diminishing returns em XP/moeda apos X kills/hora e a regra padrao pra evitar bots e grinding abusivo."
                ),
                callout(
                  "warning",
                  "Economia e sistema VIVO. Monitore apos lancamento: se preco de item X na trade/auction house disparar, algum sink quebrou."
                ),
              ],
            },
          },
        },
      ]
    ),
    narrative(
      "common-completo-controles",
      "Controles, Input e Acessibilidade",
      "Mapping detalhado, sensibilidade, acessibilidade e assistive options.",
      [
        h("Controles, Input e Acessibilidade", 2),
        p(
          "Jogo completo precisa entregar controles excelentes + acessibilidade de nivel AAA. Eis o check-list."
        ),
        h("Controles", 3),
        li("Mapping padrao por plataforma (documentar cada)."),
        li("Remapping completo (todo botao deve ser reatribuivel)."),
        li("Sensibilidade: cameras e sticks com 0-100 ajustavel."),
        li("Input buffer: 4-6 frames pra jogos de acao, maior pra plataformas."),
        li("Curva de input: resposta ao stick (linear vs curva)."),
        h("Acessibilidade AAA", 3),
        li("Daltonismo: modos Protanopia, Deuteranopia, Tritanopia (3 comuns)."),
        li("Motor: slow mode, auto-target, controle-com-uma-mao."),
        li("Cognitivo: hints opcionais, skip de puzzles, simplificacao de mecanicas."),
        li("Visual: text scaling, UI scaling, high contrast mode."),
        li("Audio: legendas com nome do falante, descricao de SFX importantes."),
        li("Epilepsia: modo de flash reduzido, screen shake controlavel."),
        callout(
          "design-decision",
          "Acessibilidade nao e feature de PUBLICO DE NICHO — e feature de TODOS OS JOGADORES. Legenda ON ajuda em ambiente barulhento. Slow mode ajuda em sessao cansada. UI grande ajuda em celular."
        ),
        callout(
          "balance-note",
          "Cada feature de acessibilidade precisa de QA dedicado. Testar \"funciona\" e diferente de testar \"e usavel\" — valide com usuarios da comunidade."
        ),
        callout(
          "warning",
          "Skip de puzzle em jogo de puzzle pode parecer contradicao — mas jogador preso em UMA fase abandona O JOGO INTEIRO. Skip NUNCA e obrigatorio; existe por emergencia."
        ),
      ]
    ),
    narrative(
      "common-completo-ui",
      "UX/UI",
      "Arquitetura de telas, hierarquia visual e fluxos detalhados.",
      [
        h("UX/UI", 2),
        p(
          "Em jogos grandes, UI vira sistema complexo. Sem arquitetura, vira colcha de retalhos — telas inconsistentes, navegacao confusa, telemetria invisivel."
        ),
        h("Arquitetura de Telas", 3),
        li("Mapa de telas: diagrama de todas as telas e transicoes."),
        li("Agrupamento por tarefa (managing character, managing world, settings)."),
        li("Ordem de entrada: do ACESSAVEL (1 click) ao RARO (5+ clicks)."),
        h("Hierarquia de Informacao", 3),
        li("Primary info (HP, main objective): maior, sempre visivel."),
        li("Secondary info (resources, buffs): medio, contextual."),
        li("Tertiary info (achievements, stats): pequeno, on-demand."),
        h("Fluxo de Onboarding", 3),
        li("Tutorial integrado, nao modal."),
        li("Progressive disclosure: nova mecanica = novo tutorial curto."),
        li("Refresh: player voltando apos hiato ve \"ultima atividade\"."),
        callout(
          "design-decision",
          "Mapa de telas antes de implementar: papel e caneta. Um diagrama ruim em papel custa 1h; um fluxo ruim em codigo custa 100h."
        ),
        callout(
          "balance-note",
          "Telemetria de UI: tempo por tela, click rate por botao, abandono por fluxo. Telas com alta friccao aparecem sozinhas nos dados."
        ),
      ]
    ),
    narrative(
      "common-completo-arte-audio",
      "Direcao de Arte e Audio",
      "Guia visual + assinatura sonora + mix profissional.",
      [
        h("Direcao de Arte e Audio", 2),
        p(
          "Em jogos completos, arte e audio sao responsaveis por 40-50% do budget. Direcao forte evita iteracao cara depois."
        ),
        h("Guia Visual (Style Guide)", 3),
        li("Moodboard de referencia (4-8 imagens canonicas)."),
        li("Paleta: 5-7 cores primarias + secundarias. Documentada com hex codes."),
        li("Silhuetas: todo character/inimigo deve ser reconhecivel em sombra."),
        li("Anima principal: idle, walk/run, attack, hit, death. 12-24 frames em 2D, boneco 3D completo em 3D."),
        li("VFX: framework de particles (fire, magic, impact) padronizado."),
        h("Direcao de Audio", 3),
        li("Tema principal + 3-5 variacoes por situacao (combate, calma, boss)."),
        li("SFX library: por categoria (UI, player, world, enemy, environment)."),
        li("Dialogue: voice acting lead actors + background extras."),
        li("Mix profissional: mastering, ducking (musica cede pra SFX em acao)."),
        callout(
          "design-decision",
          "Paleta RESTRITA aumenta identidade. Hades tem 6 cores dominantes. Monument Valley tem 8. Jogos que \"misturam tudo\" perdem distinctiveness."
        ),
        callout(
          "balance-note",
          "Audio lead deve ter clara autoridade sobre mix final. Muitos jogos tem audio bom que e estragado por mix ruim — cada sistema grita por atencao."
        ),
        callout(
          "warning",
          "Outsourcing de arte/audio requer onboarding pesado do style guide. Sem style guide, cada freelancer entrega algo diferente e voce tem colcha de retalhos."
        ),
      ]
    ),
    narrative(
      "common-completo-tecnologia",
      "Tecnologia e Arquitetura",
      "Engine, backend, analytics, observabilidade.",
      [
        h("Tecnologia e Arquitetura", 2),
        p(
          "Em jogo completo, tech vira sistema vivo com multiplas camadas: engine, backend, analytics, tools, observability. Decisoes aqui afetam custo operacional por anos."
        ),
        h("Frontend (Engine)", 3),
        li("Engine + linguagem + arquitetura (ECS, MVC, state)."),
        li("Asset pipeline com automacao."),
        li("Build system com CI/CD."),
        h("Backend (se houver)", 3),
        li("Auth: provider (Firebase, custom, PlayFab)."),
        li("Save cloud + sync offline."),
        li("Analytics events + dashboards."),
        li("Server auth (pra evitar cheats) em features competitivas."),
        h("Tools Internos", 3),
        li("Editor de conteudo pra designer (quests, dialogos, balance)."),
        li("Debug menu: teleport, give item, set level, force event."),
        li("Replay system pra QA reproduzir bugs."),
        h("Observabilidade", 3),
        li("Crash reporting (Sentry, custom)."),
        li("Performance monitoring em real devices."),
        li("Analytics funnel: de instalacao a primeira acao core."),
        callout(
          "design-decision",
          "Tools internos parecem \"custo morto\" mas aceleram iteracao 10x. Editor custom de quest = designer cria quest em 10min em vez de 2h. ROI enorme."
        ),
        callout(
          "balance-note",
          "Orcamento de infra (servidores, analytics SaaS) deve ser estimado ANTES de Beta. Lancamento com infra subdimensionada = crash em dia 1."
        ),
        callout(
          "warning",
          "Dependencias externas (engine, SDK, bibliotecas) mudam de politica. Substituicao pode custar meses. Avalie bus factor de cada uma."
        ),
      ]
    ),
    narrative(
      "common-completo-kpis",
      "KPIs e Telemetria",
      "Metricas de sucesso + dashboards + eventos de telemetria.",
      [
        h("KPIs e Telemetria", 2),
        p(
          "Sem metricas, voce nao sabe o que esta funcionando. KPIs (Key Performance Indicators) sao as 5-10 metricas que RESUMEM a saude do jogo. Telemetria e a infraestrutura que as captura."
        ),
        h("KPIs Classicos", 3),
        li("DAU/MAU (Daily/Monthly Active Users) — pico de atividade e retencao."),
        li("D1/D7/D30 retention — % jogadores que voltam em 1/7/30 dias."),
        li("ARPU (Average Revenue Per User) — receita por usuario ativo."),
        li("LTV (Lifetime Value) — receita total esperada por usuario."),
        li("Churn rate — % jogadores que param de jogar."),
        li("CPI (Cost Per Install) — custo de marketing por usuario novo."),
        h("KPIs Funcionais (jogo)", 3),
        li("Tempo medio ate primeiro sucesso no core loop."),
        li("Taxa de conclusao do tutorial."),
        li("Taxa de conclusao por ato/capitulo."),
        li("Tempo medio por sessao."),
        h("Telemetria Essencial", 3),
        li("Eventos estruturados: install, first_launch, tutorial_start/end, level_up, boss_attempt/defeat."),
        li("Contexto em cada evento: device, versao, tempo desde install, nivel atual."),
        li("Dashboards: visualizacao em tempo real dos KPIs."),
        callout(
          "design-decision",
          "Telemetria sobre jogadores: privacy first. Nao colete mais do que precisa. Opt-in em territorios com GDPR/LGPD. Anonimize dados pessoais."
        ),
        callout(
          "balance-note",
          "Se D1 < 40%, jogo tem problema de onboarding. Se D7/D1 < 30%, core loop nao engaja. Esses numeros sao thresholds claros da industria."
        ),
        callout(
          "warning",
          "Telemetria sem analise e lixo. Defina quem olha os dashboards semanalmente — designer? product? analytics dedicated? Sem responsavel, dados viram ruido."
        ),
      ]
    ),
    narrative(
      "common-completo-monetizacao",
      "Monetizacao (quando aplicavel)",
      "Modelos, etica e impacto em UX.",
      [
        h("Monetizacao", 2),
        p(
          "Monetizacao define como o jogo paga sua producao. Escolha certa pra seu genero e publico + execucao etica = sustento de longo prazo. Errada = jogadores abandonam (ou pior, reviews destruidoras)."
        ),
        h("Modelos", 3),
        li("Premium (one-time) — paga 1x, joga tudo. Classico. Ex: Hollow Knight, Stardew Valley."),
        li("Freemium IAP — gratuito, compra itens/speed-up. Dominante em mobile."),
        li("Battle Pass — assinatura por temporada com recompensas. Fortnite-style."),
        li("Ads — gratuito, interrupcao publicitaria. Hyper-casual mobile."),
        li("Subscription (GamePass, Apple Arcade) — acesso a catalogo. Modelo novo."),
        li("Hybrid — combinacao (premium + cosmetics, freemium + premium version)."),
        h("Principios Eticos", 3),
        li("Nao paywall progressao core: jogador nao-pagante deve poder terminar o jogo."),
        li("Loot boxes com odds TRANSPARENTES (obrigatorio em varios paises)."),
        li("Limite em gastos de menor (parental lock)."),
        li("Cosmetico > funcional: melhor vender skin que power."),
        h("Impacto em UX", 3),
        li("Freemium requer loops de engagement retentive (daily rewards, energy)."),
        li("Ads precisam timing cuidadoso — interrupcao errada afasta."),
        li("IAP store deve ser acessivel mas nao agressivo."),
        callout(
          "design-decision",
          "Pay-to-win mata retencao longterm em praticamente todo jogo nao-competitivo casual. Pague pra SER mais forte e diferente de pagar pra DESBLOQUEAR conteudo — so o segundo e sustentavel."
        ),
        callout(
          "balance-note",
          "Whales (top spenders) geram 60-80% da receita freemium. Nao quer dizer que voce deve explorar — significa que design deve dar valor REAL ao whale (colecionismo, status) enquanto protege casual."
        ),
        callout(
          "warning",
          "Se monetizacao aparece antes do player se divertir, jogador abandona antes de virar cliente. Regra de ouro: prove o FUN antes de oferecer o PAGAMENTO."
        ),
      ]
    ),
    narrative(
      "common-completo-qa",
      "QA, Testes e Instrumentacao",
      "Plano de teste, regressao e automacao.",
      [
        h("QA, Testes e Instrumentacao", 2),
        p(
          "QA (Quality Assurance) vai alem de \"procurar bug\". E um sistema com estrategia, ferramentas, processo e priorizacao."
        ),
        h("Tipos de Teste", 3),
        li("Funcional: cada feature faz o que deve fazer."),
        li("Regressao: features antigas nao quebraram com mudanca nova."),
        li("Compatibilidade: em diferentes devices, OS, resolucoes."),
        li("Performance: framerate, memoria, tempo de load."),
        li("Balanceamento: sistema econômico/progressão equilibrado."),
        li("Localizacao: strings traduzidas, cultural appropriateness."),
        li("Usability: jogador novo consegue entender sem doc externa."),
        h("Automacao", 3),
        li("Smoke tests: build carrega, menu aparece, gameplay basico nao crasha."),
        li("Regression suite: cenarios criticos testados a cada build."),
        li("Stress test: N jogadores simulados simultaneos (online games)."),
        h("Bug Tracking", 3),
        li("Severidade: Critical (crash, data loss) / High (feature broken) / Medium (UX) / Low (cosmetic)."),
        li("Prioridade: Must-fix (bloqueia release) / Should-fix / Nice-to-have."),
        li("Matriz severidade × prioridade orienta sprint."),
        callout(
          "design-decision",
          "QA interno + externo separados. Equipe interna vicia (conhece shortcut), QA externo pega o que voce ja nao ve. Faz beta fechado cedo se orcamento permite."
        ),
        callout(
          "balance-note",
          "Bug que aparece em 20+ reports e claramente critical. Bug em 1 report pode ser fringe case. Priorize por frequencia real — nao por dor subjetiva."
        ),
        callout(
          "warning",
          "Ignorar QA de acessibilidade e garantia de review ruim. Comunidade gamer com disability e vocal e justa — testar com eles ou com ferramentas apropriadas e obrigatorio."
        ),
      ]
    ),
    narrative(
      "common-completo-roadmap",
      "Roadmap de Producao",
      "Timeline detalhada com marcos entregaveis.",
      [
        h("Roadmap de Producao", 2),
        p(
          "Roadmap completo e mais detalhado que o medio: alem de marcos, inclui metas verificaveis e DO/DONE criteria (quando um marco e considerado fechado)."
        ),
        h("Estrutura de Marco", 3),
        li("Nome + prazo em semanas (absoluto, nao relativo)."),
        li("Entregaveis: lista do que DEVE estar pronto."),
        li("DO criteria: como saber que marco esta completo (objetivo, nao subjetivo)."),
        li("Dependencias: quais marcos anteriores precisam estar fechados."),
        li("Responsaveis: quem entrega cada parte."),
        h("Marcos Recomendados", 3),
        li("Pre-producao (concept, prototipo vertical, GDD draft)."),
        li("Producao Alpha (core systems, primeiro 30% conteudo, art style locked)."),
        li("Producao Beta (feature complete, 95% conteudo, polish)."),
        li("Pre-lancamento (QA, localizacao, marketing, store page)."),
        li("Soft launch (1-2 territorios, 2-4 semanas de learn)."),
        li("Global launch + pos-lancamento (hotfixes, content updates)."),
        callout(
          "design-decision",
          "DO criteria OBJETIVOS evitam \"marco terminado\" subjetivo. Ex: Alpha = \"jogador novo consegue terminar ato 1 sem crash em 20min\". Claro? Sim. Verificavel? Sim."
        ),
        callout(
          "balance-note",
          "Tempos tipicos (estimativas conservadoras pra solo/small team): Pre-producao 2-4 meses. Alpha 6-12 meses. Beta 3-6 meses. Pre-lancamento 2-3 meses. Triplica pra solo dev."
        ),
        callout(
          "warning",
          "Roadmap sem datas absolutas = roadmap inutil. \"Em algumas semanas\" nao e planejamento. \"Entregar em 15 de marco\" e."
        ),
      ]
    ),
    narrative(
      "common-completo-riscos",
      "Riscos e Mitigacoes",
      "Catalogo de riscos com probabilidade × impacto × plano de contingencia.",
      [
        h("Riscos e Mitigacoes", 2),
        p(
          "Nenhum projeto grande entrega sem enfrentar riscos. A diferenca entre projeto que sobrevive e projeto que explode e: quem documentou, priorizou e mitigou preventivamente."
        ),
        h("Matriz de Risco", 3),
        p(
          "Pra cada risco: Probabilidade (1-5) × Impacto (1-5) = Score. Ordenar por score. Atacar top 5-10."
        ),
        h("Riscos Tecnicos Tipicos", 3),
        li("Engine/framework nao suporta X feature planejada. Mitigacao: prototipar cedo a feature critica."),
        li("Performance em plataforma alvo. Mitigacao: profile em device real desde mes 1."),
        li("Dependencia de biblioteca que pode mudar licenca. Mitigacao: avaliar alternativas em Alpha."),
        li("Dev chave sai. Mitigacao: documentar, bus factor > 1, pair programming em areas criticas."),
        h("Riscos de Design Tipicos", 3),
        li("Core loop nao se sustenta (playtest ruim). Mitigacao: playtest EM PROTIPO, nao em Alpha."),
        li("Dificuldade desbalanceada. Mitigacao: telemetria de mortes/tempo desde Beta aberto."),
        li("Monetizacao hostil ao player. Mitigacao: soft launch em mercado pequeno antes."),
        h("Riscos de Mercado Tipicos", 3),
        li("Concorrente lanca jogo similar antes. Mitigacao: acompanhar anuncios, ajustar USP."),
        li("Plataforma muda politica (Apple, Google, Steam). Mitigacao: diversificar plataformas."),
        li("Genre perde hype (ex: roguelikes saturados). Mitigacao: USP forte, nao so \"mais um\"."),
        h("Riscos de Projeto/Equipe", 3),
        li("Scope creep. Mitigacao: feature freeze em marcos, backlog \"depois do lancamento\"."),
        li("Burnout. Mitigacao: 40h/semana (nao crunch), ferias obrigatorias entre marcos."),
        li("Conflito interno. Mitigacao: decisor claro por area, retrospectivas mensais."),
        callout(
          "design-decision",
          "Regra do top-10: atacar os 10 riscos com maior probabilidade × impacto. Os outros sao noise — nao gaste tempo de planejamento, apenas monitore."
        ),
        callout(
          "balance-note",
          "Sem mitigacao, risco vira certeza. Nao basta listar — tem que ter plano executavel. \"Prototipar feature X ate semana 8\" e mitigacao. \"Se acontecer, a gente pensa\" nao e."
        ),
        callout(
          "warning",
          "Scope creep e o killer. Em quase todo projeto post-mortem, aparece. Aceite que vai acontecer e tenha sistema pra barrar (feature freeze dates, priorizacao MUSThave/SHOULDhave/COULDhave)."
        ),
        callout(
          "warning",
          "Revisite riscos A CADA MARCO. Riscos que eram teoricos no concept viram reais em Alpha. Riscos de lancamento so existem quando voce esta perto de lancar."
        ),
        callout(
          "warning",
          "Guarde tambem lista de RISCOS JA MATERIALIZADOS: \"em mes 3 perdemos o artista principal, mitigamos por outsource.\" Esse historico ensina MUITO pros proximos projetos."
        ),
      ]
    ),
  ],
};

const GENRE_BY_SCOPE: Record<WizardGenre, Record<WizardScope, TemplateSection[]>> = {
  rpg: {
    mini: [
      narrative(
        "rpg-mini-visao-geral",
        "Visao Geral — Elder Realms",
        "Pitch rapido do jogo de exemplo.",
        [
          h("Visao Geral — Elder Realms", 2),
          p(
            "Elder Realms e um RPG de fantasia tatico em turnos. Voce joga como Kael, um guerreiro amnesico que porta a Reliquia do Sol — unica arma capaz de selar fendas entre mundos. Tres faccoes disputam o controle dessas fendas e voce vai escolher lado."
          ),
          callout(
            "warning",
            "Este e um exemplo ficticio pra te guiar. Substitua Elder Realms, Kael e as faccoes pelos elementos do SEU jogo."
          ),
        ]
      ),
      {
        id: "rpg-mini-classes",
        title: "Classes e Atributos",
        content: "5 atributos base + identidade de classe (Kael, Aria, Bran).",
        pageType: {
          id: "attributeDefinitions",
          options: {
            attributeDefinitionsOverrides: {
              attributes: [
                { key: "hp", label: "HP", valueType: "int", defaultValue: 100, min: 0 },
                { key: "atk", label: "ATK", valueType: "int", defaultValue: 10, min: 0 },
                { key: "def", label: "DEF", valueType: "int", defaultValue: 5, min: 0 },
                { key: "mag", label: "MAG", valueType: "int", defaultValue: 8, min: 0 },
                { key: "spd", label: "SPD", valueType: "int", defaultValue: 5, min: 0 },
              ],
            },
            richDocBlocks: [
              h("Classes e Atributos", 2),
              p(
                "Elder Realms usa cinco atributos base (HP/ATK/DEF/MAG/SPD) compartilhados por todas as classes."
              ),
              li("Kael, o Guerreiro Solar — tanque + DPS corpo-a-corpo (HP, DEF altos)."),
              li("Aria, a Maga Eclipsada — dano magico a distancia (MAG, SPD altos)."),
              li("Bran, o Vagante Sombrio — DPS agil com adagas e venenos (ATK, SPD altos)."),
              callout(
                "note",
                "Os 5 atributos ja foram criados no painel lateral. Adicione mais se precisar (ex: LUK pra sorte). Crie uma pagina de Personagem por classe e linke esta pagina como fonte dos atributos."
              ),
              callout(
                "warning",
                "Como mini-template, esta versao nao gera paginas individuais de classes — crie-as manualmente usando o tipo \"Personagem\" no sidebar."
              ),
            ],
          },
        },
      },
      narrative(
        "rpg-mini-combate",
        "Combate",
        "Combate tatico em turnos com Reliquia como recurso de escolha.",
        [
          h("Combate — Elder Realms", 2),
          p(
            "Tatico em turnos ordenados por SPD. Cada turno: atacar, usar skill, defender ou item. Dano = (ATK — DEF) × mod_skill × critico, com minimo de 1 hit."
          ),
          li("A Reliquia do Sol da 3 cargas por batalha, nao regenera durante combate."),
          li("Estados: queima, congelamento, envenenamento — cada um com contrapeso."),
          callout(
            "design-decision",
            "Formula subtrativa de dano ((ATK-DEF)×mod) em vez de multiplicativa: DEF baixo e mais impactante no comeco, criando sensacao clara de evolucao."
          ),
          callout(
            "warning",
            "Este e um modelo — se seu jogo e action, card-based ou tempo real, reescreva essa secao inteira."
          ),
        ]
      ),
      narrative(
        "rpg-mini-mundo",
        "Mundo e Narrativa",
        "Tema, faccoes e objetivo da jornada de Kael.",
        [
          h("Mundo de Elder Realms", 2),
          p(
            "Mundo de fantasia em decadencia. Fendas entre dimensoes apareceram ha 20 anos e estao consumindo regioes inteiras. Tres faccoes disputam o controle delas."
          ),
          h("As Tres Faccoes", 3),
          li("Ordem do Sol — teocratica, quer selar as fendas permanentemente."),
          li("Reino Livre — quer usar as fendas como fonte de energia."),
          li("Nomades do Veu — tribos que consideram as fendas sagradas."),
          callout(
            "design-decision",
            "Tres faccoes (em vez de dois lados) forcam o jogador a ponderar tradeoffs — nao existe \"escolha obvia\" entre bem e mal."
          ),
          callout(
            "warning",
            "Esta e uma pagina Narrativa — o addon Rich Doc abaixo e seu espaco principal pra lore. Use headings (H2, H3) pra organizar por capitulos, regioes ou personagens."
          ),
        ]
      ),
    ],
    medio: [
      narrative(
        "rpg-medio-visao-geral",
        "Visao Geral — Elder Realms",
        "Pitch, publico-alvo, plataformas e diferencial do jogo de exemplo.",
        [
          h("Visao Geral — Elder Realms", 2),
          p(
            "Elder Realms e um RPG de fantasia focado em exploracao aberta e combate tatico em turnos. O jogador controla Kael, um guerreiro amnesico que acorda no topo de uma torre em ruinas e descobre que e o ultimo portador de uma reliquia capaz de selar fendas entre mundos."
          ),

          h("Pitch", 3),
          p(
            "Um RPG de fantasia onde cada decisao de combate reverbera na historia. Jogue como Kael, descubra tres faccoes em guerra, e escolha se vai salvar o mundo ou conquista-lo."
          ),
          callout(
            "warning",
            "O que e um pitch? E a frase de elevador que voce diria pra alguem ter interesse no seu jogo em 15 segundos. Nao e a sinopse — e o gancho. Pergunta que ele responde: por que alguem se importaria?"
          ),

          h("Publico-alvo", 3),
          p(
            "Fas de RPGs classicos dos anos 2000 (Final Fantasy X, Dragon Quest). Players de 25-45 anos que valorizam narrativa e progressao tatica acima de reflexos."
          ),

          h("Plataformas", 3),
          p("PC (Steam) no lancamento. Port para Switch previsto seis meses depois."),

          h("USP — Unique Selling Proposition", 3),
          li(
            "Reliquia como mecanica central: toda escolha de combate consome cargas da reliquia, que tambem move a narrativa."
          ),
          li(
            "Sistema de faccoes dinamicas: tres faccoes (Ordem do Sol, Reino Livre, Nomades do Veu) respondem as suas acoes em tempo real."
          ),
          li(
            "Morte permanente opcional: modo hard desbloqueavel apos zerar o jogo."
          ),
          callout(
            "warning",
            "O que e USP? E o que diferencia SEU jogo de todos os outros do genero. Nao precisa ser revolucionario — precisa ser especifico o suficiente pra alguem escolher o seu em vez do concorrente."
          ),

          h("Diferencial Competitivo", 3),
          p(
            "Elder Realms nao e \"mais um JRPG\" — o hook e que a reliquia (sua unica vantagem) e tambem seu limite. Cada batalha vencida te torna mais forte mas mais visado pelas faccoes."
          ),
          callout(
            "design-decision",
            "Por que comecamos esta secao com o protagonista, nao com o mundo: e mais facil vender uma pessoa do que um cenario. Quando voce falar do seu jogo, comece com \"voce joga como X\" — o contexto vem depois."
          ),

          callout(
            "warning",
            "Este conteudo e ficticio e serve como exemplo. Substitua Elder Realms, Kael e as faccoes pelos elementos do SEU jogo. As secoes (Pitch, Publico, USP) sao o que voce deve preencher — a ordem e a profundidade tambem."
          ),
        ]
      ),
      narrative(
        "rpg-medio-personagens",
        "Personagens Jogaveis",
        "Classes, papeis e assinatura de gameplay do elenco de Elder Realms.",
        [
          h("Personagens Jogaveis — Elder Realms", 2),
          p(
            "O grupo de Elder Realms tem tres classes principais, cada uma com identidade clara e espaco pra evolucao. O equilibrio entre elas e a base do combate tatico: uma classe sozinha nao vence os encontros mais duros."
          ),

          h("Kael — O Guerreiro Solar", 3),
          p(
            "Tanque e atacante corpo-a-corpo. Portador da Reliquia do Sol, Kael convoca escudos de luz que absorvem dano e retornam parte dele ao atacante."
          ),
          li("Especialidade: proteger aliados e controlar a frente de batalha."),
          li("Atributos fortes: HP e DEF. Atributos fracos: MAG e SPD."),

          h("Aria — A Maga Eclipsada", 3),
          p(
            "Dano magico a distancia. Aria manipula fendas entre mundos pra conjurar ataques elementais — mas cada feitico drena a Reliquia do Sol, criando tensao entre poder e custo."
          ),
          li("Especialidade: dano em area e debuffs."),
          li("Atributos fortes: MAG e SPD. Atributos fracos: HP e DEF."),

          h("Bran — O Vagante Sombrio", 3),
          p(
            "DPS agil e furtivo. Bran nao tem reliquia — luta com duas adagas e venenos. Sua aposta e acabar com o inimigo antes de ser visto."
          ),
          li("Especialidade: critico alto, esquiva e mobilidade."),
          li("Atributos fortes: ATK e SPD. Atributos fracos: HP e DEF."),

          callout(
            "design-decision",
            "Por que tres classes com fraquezas explicitas: forca o jogador a formar time em vez de solar com o favorito. Em Elder Realms, TODOS os bosses tem fases que exigem mais de uma classe ativa — isso da valor narrativo e mecanico ao grupo."
          ),
          callout(
            "warning",
            "Use este elenco como molde. Troque nomes, apelidos e a identidade estetica pelos personagens do SEU jogo. Guarde a estrutura: cada classe com UM ponto forte claro + UM ponto fraco claro."
          ),
        ],
        [
          // Typed page (attributeDefinitions) + richDoc addon added by registry
          // because richDocBlocks is present. Kept as a plain object literal
          // because `narrative()` hardcodes page type to "narrative".
          {
            id: "rpg-medio-atributos",
            title: "Atributos Base",
            content: "Os cinco atributos compartilhados por Kael, Aria e Bran.",
            pageType: {
              id: "attributeDefinitions",
              options: {
                attributeDefinitionsOverrides: {
                  attributes: [
                    { key: "hp", label: "HP", valueType: "int", defaultValue: 100, min: 0 },
                    { key: "atk", label: "ATK", valueType: "int", defaultValue: 10, min: 0 },
                    { key: "def", label: "DEF", valueType: "int", defaultValue: 5, min: 0 },
                    { key: "mag", label: "MAG", valueType: "int", defaultValue: 8, min: 0 },
                    { key: "spd", label: "SPD", valueType: "int", defaultValue: 5, min: 0 },
                  ],
                },
                richDocBlocks: [
                  h("Atributos Base", 2),
                  p(
                    "Elder Realms usa cinco atributos numericos que afetam combate e exploracao. O painel ao lado mostra os valores iniciais; os reais escalam pela tabela de progressao (nivel 1 a 20)."
                  ),
                  li("HP — pontos de vida. Morre em 0."),
                  li("ATK — dano fisico por golpe."),
                  li("DEF — reducao de dano recebido."),
                  li("MAG — poder de feiticos e cargas da Reliquia."),
                  li("SPD — ordem no turno e chance de esquiva."),
                  callout(
                    "note",
                    "Esta pagina ja vem com os 5 atributos criados no painel lateral. Voce pode editar valores, adicionar (ex: LUK pra sorte) ou remover — so nao esqueca de ajustar os personagens que referenciam ela."
                  ),
                  callout(
                    "design-decision",
                    "SPD afeta ordem E esquiva de proposito: um unico atributo com dois efeitos simplifica o mental model sem empobrecer o balanceamento."
                  ),
                ],
              },
            },
          },
          {
            id: "rpg-medio-kael",
            title: "Kael, o Guerreiro Solar",
            content: "Ficha completa do protagonista tanque/DPS corpo-a-corpo.",
            pageType: {
              id: "characters",
              options: {
                richDocBlocks: [
                  h("Kael, o Guerreiro Solar", 2),
                  p(
                    "Kael acordou sem memorias no topo da Torre Vermelha, com a Reliquia do Sol fundida ao peito. Ele nao escolheu ser o portador — mas e o unico que pode selar as fendas."
                  ),
                  h("Perfil de combate", 3),
                  li("Papel: tanque + DPS corpo-a-corpo."),
                  li("Assinatura: Escudo Solar (absorve dano e reflete 30% no atacante)."),
                  li("Contra: inimigos com SPD alto que evitam seus golpes pesados."),
                  callout(
                    "note",
                    "Esta pagina ja vem com os addons de Perfil de Atributos, Curva de XP, Tabela de Progressao e Efeitos por Personagem. Use-os pra balancear numeros sem mexer na ficha narrativa."
                  ),
                  callout(
                    "warning",
                    "Esta e uma classe de exemplo pra voce duplicar. Crie Aria, Bran e quantos mais precisar — cada uma com Perfil de Atributos proprio linkado a mesma pagina de Atributos Base."
                  ),
                ],
              },
            },
          },
          narrative(
            "rpg-medio-skills",
            "Skills — Habilidades Ativas e Passivas",
            "Como skills funcionam em Elder Realms: custo, cooldown e sinergia.",
            [
              h("Skills em Elder Realms", 2),
              p(
                "Cada classe tem 4 skills ativas + 2 passivas. Ativas custam energia (regenerada por turno) ou cargas da Reliquia (escassas). Passivas sao sempre ativas mas nao se acumulam — so uma por tipo."
              ),
              h("Exemplos — Kael", 3),
              li("Golpe Solar (ativa, 20 energia): ATK×1.8, ignora 50% da DEF."),
              li("Escudo Aurora (ativa, 1 carga Reliquia): absorve 100+MAG de dano por 2 turnos."),
              li("Postura Defensiva (passiva): +20% DEF enquanto HP > 50%."),
              callout(
                "design-decision",
                "Custos duplos (energia OU Reliquia) existem pra criar escolhas reais: skills baratas pra uso constante, caras pra momentos chave. Se tudo fosse so cooldown, sairia roteirizado."
              ),
              callout(
                "warning",
                "Skills nao sao um page type — descreva elas aqui em texto por enquanto. Se evoluir, a gente pode criar um page type dedicado no futuro."
              ),
            ]
          ),
        ]
      ),

      narrative(
        "rpg-medio-combate",
        "Sistema de Combate",
        "Modelo tatico em turnos com Reliquia como recurso de escolha.",
        [
          h("Sistema de Combate — Elder Realms", 2),
          p(
            "Combate acontece em turnos, ordenados por SPD. Cada personagem tem uma acao por turno: atacar, usar skill, defender ou item. Posicao importa: quem ataca pelas costas ganha 50% de critico."
          ),

          h("Formula de Dano", 3),
          p(
            "Dano final = (ATK — DEF_alvo) × modificador_skill × critico. Se DEF ≥ ATK, dano minimo = 1 (nunca zero — impede cenarios impossiveis)."
          ),

          h("Estados Alterados", 3),
          li("Queima — perde 5% HP por turno por 3 turnos (zera com agua)."),
          li("Congelamento — pula proximo turno (zera com fogo)."),
          li("Envenenamento — perde 3% HP por turno por 5 turnos (antidoto)."),

          h("A Reliquia do Sol", 3),
          p(
            "Kael comeca cada batalha com 3 cargas da Reliquia. Cargas nao regeneram durante combate — voce recebe 1 ao acabar. Isso forca escolha: gastar tudo agora ou guardar pra boss?"
          ),
          callout(
            "design-decision",
            "A formula de dano e subtrativa ((ATK-DEF)×mod) em vez de multiplicativa (ATK×(1-DEF%)) de proposito: valores baixos de DEF sao mais impactantes no comeco do jogo, o que da sensacao clara de evolucao ao subir DEF."
          ),
          callout(
            "balance-note",
            "Dano minimo de 1 e uma rede de seguranca, mas pode virar vetor de exploit (ex: Bran com multiplos ataques conseguir matar um boss de DEF altissima). Monitore em playtest e considere cap de quantos hits de dano-1 um inimigo aceita por turno."
          ),
          callout(
            "warning",
            "Combate tatico em turnos e so UM modelo — pode ser tempo real, ACT, card-based, etc. Mantenha este texto apenas como referencia e reescreva se seu jogo usar outro modelo."
          ),
        ]
      ),

      narrative(
        "rpg-medio-itens",
        "Itens e Equipamentos",
        "Tipos, raridade e como equipamentos interagem com atributos em Elder Realms.",
        [
          h("Itens e Equipamentos — Elder Realms", 2),
          p(
            "Itens dividem-se em tres categorias: equipamentos (usaveis por classe), consumiveis (usados no inventario) e materiais (ingredientes de craft)."
          ),

          h("Raridade", 3),
          li("Comum (cinza) — armas basicas, sem bonus especiais."),
          li("Raro (azul) — 1 atributo extra + efeito modesto."),
          li("Epico (roxo) — 2 atributos extras + efeito ativo ou passivo."),
          li("Lendario (dourado) — assinatura unica com efeito narrativo."),

          h("Exemplos — Elder Realms", 3),
          li("Lamina do Crepusculo (epico): +8 ATK, +3 SPD. Ao matar inimigo, proximo ataque tem critico garantido."),
          li("Escudo da Aurora (raro): +5 DEF. Reflete 15% do dano recebido."),
          li("Pocao de Nevoa (consumivel): Bran fica invisivel por 2 turnos."),

          callout(
            "design-decision",
            "Raridade dourada e reservada pra itens com peso narrativo — ganhar um deles e um marco da jornada, nao dropa aleatorio. Isso transforma raridade num sinal de progresso da historia, nao so de tempo de grind."
          ),
          callout(
            "warning",
            "Esta pagina e um container: dentro dela voce encontra \"Lamina do Crepusculo\" como exemplo de item com efeito. Duplique pra criar mais equipamentos, consumiveis e materiais do seu jogo."
          ),
        ],
        [
          {
            id: "rpg-medio-item-exemplo",
            title: "Lamina do Crepusculo",
            content: "Espada lendaria de Bran — equipamento de exemplo com efeitos.",
            pageType: {
              id: "equipmentItem",
              options: {
                richDocBlocks: [
                  h("Lamina do Crepusculo", 2),
                  p(
                    "A Lamina do Crepusculo foi forjada pelos Nomades do Veu no ultimo eclipse. So quem ja matou um ser do Veu pode empunha-la — uma condicao que Bran cumpre no capitulo 3 da historia principal."
                  ),
                  h("Efeitos de atributo", 3),
                  li("+8 ATK"),
                  li("+3 SPD"),
                  h("Efeito ativo", 3),
                  p(
                    "Apos matar um inimigo, o proximo golpe de Bran tem critico garantido. Efeito expira se ele passar 1 turno sem atacar."
                  ),
                  callout(
                    "note",
                    "Esta pagina ja vem com os addons de Inventario, Economia e Efeitos por Personagem. Voce ajusta preco, atributos e inventario nos paineis laterais."
                  ),
                  callout(
                    "design-decision",
                    "Efeitos narrativos (matar um ser do Veu) em vez de condicoes genericas (nivel 10) ancoram items na historia. Quando o jogador recebe a Lamina, ele ja tem contexto — ele ganhou."
                  ),
                  callout(
                    "warning",
                    "Duplique esta pagina pra criar mais equipamentos. Mantenha o padrao: 1-2 atributos + 1 efeito ativo ou passivo + descricao com gancho narrativo."
                  ),
                ],
              },
            },
          },
        ]
      ),

      narrative(
        "rpg-medio-narrativa",
        "Narrativa e NPCs",
        "Arco principal, faccoes e lore de Elder Realms.",
        [
          h("Narrativa — Elder Realms", 2),
          p(
            "A historia central de Elder Realms gira em torno de tres faccoes em guerra fria pelo controle das fendas entre mundos. Kael, Aria e Bran entram no meio desse conflito sem escolher lado — forcados pela Reliquia do Sol a tomar decisoes que os alinharao com uma ou outra."
          ),

          h("As Tres Faccoes", 3),
          li("Ordem do Sol — teocratica, quer fechar as fendas permanentemente. Aliados se voce escolher \"salvar o mundo\"."),
          li("Reino Livre — democratica, quer usar as fendas como fonte de energia. Aliados se voce escolher \"transformar o mundo\"."),
          li("Nomades do Veu — tribos nomades, acham que as fendas sao sagradas. Aliados se voce escolher \"abracar o caos\"."),

          h("Arco Principal", 3),
          li("Ato 1 — Kael desperta, encontra Aria. Descobrem o sistema das fendas."),
          li("Ato 2 — Bran se junta, conflito com a Ordem do Sol. Escolha: selar uma fenda e enfraquecer o Reino Livre, ou deixa-la aberta."),
          li("Ato 3 — decisao final sobre as fendas. 3 finais possiveis alinhados com cada faccao."),

          callout(
            "design-decision",
            "Tres faccoes em vez de dois lados forca o jogador a fazer tradeoffs — nao existe \"escolha obvia\". Tambem permite 3 finais sem multiplicar o conteudo exponencialmente: cada final muda narrativamente, nao mecanicamente."
          ),
          callout(
            "warning",
            "Este addon Rich Doc e perfeito pra desenvolver lore extensa. Use headings (H2, H3) pra organizar por capitulos, personagens ou regioes. Callouts tipo design-decision ajudam voce a lembrar POR QUE tomou certas decisoes narrativas."
          ),
        ]
      ),

      {
        id: "rpg-medio-economia",
        title: "Economia",
        content: "Moeda Ouro de Elder Realms, fontes, sinks e regras de progressao.",
        pageType: {
          id: "economy",
          options: {
            richDocBlocks: [
              h("Economia — Elder Realms", 2),
              p(
                "Elder Realms usa uma unica moeda, o Ouro. Ela e ganha em combate, explorando baus e vendendo itens. E gasta comprando consumiveis, reparando equipamentos e em servicos de cidade (tavernas, fast-travel)."
              ),

              h("Fontes (onde o ouro aparece)", 3),
              li("Dropa de monstros comuns: 5-50 ouro por inimigo."),
              li("Baus: 50-500 ouro por bau, dependendo da area."),
              li("Vendendo itens: equipamentos comuns valem 10% do preco de compra."),

              h("Sinks (onde o ouro some)", 3),
              li("Reparo de equipamentos — taxa de 5% do valor por ponto de durabilidade."),
              li("Pocoes e consumiveis — 20-200 ouro."),
              li("Fast-travel entre cidades — 100 ouro por viagem."),

              callout(
                "note",
                "Esta pagina ja vem com o addon de Moeda configurado. Use o painel lateral pra ajustar nome (\"Ouro\" virou \"Coins\" por padrao — renomeie), codigo e tipo."
              ),
              callout(
                "design-decision",
                "Uma moeda so (em vez de varias — ouro, gemas, tokens) mantem a economia legivel pra player casual. Se seu jogo precisa de economias secundarias (moedas de evento, metaprogressao), crie paginas separadas e linke entre elas."
              ),
              callout(
                "balance-note",
                "A taxa de reparo (5% por ponto) e delicada: se for alta demais, jogador evita usar equipamento caro; se for baixa, reparo vira irrelevante. Monitore em playtest se jogadores estao pescando por \"equipamento que nao quebra\"."
              ),
              callout(
                "warning",
                "Se seu jogo precisa de mais moedas, crie novas paginas de Economia — nao empilhe tudo nesta. Paginas separadas tornam mais facil linkar regras de conversao entre elas."
              ),
            ],
          },
        },
      },
    ],
    completo: [
      narrative(
        "rpg-completo-visao-geral",
        "Visao Geral — Elder Realms",
        "Pitch, publico, plataformas e USP completos do jogo de exemplo.",
        [
          h("Visao Geral — Elder Realms", 2),
          p(
            "Elder Realms e um RPG de fantasia focado em exploracao aberta e combate tatico em turnos. O jogador controla Kael, guerreiro amnesico que acorda no topo de uma torre em ruinas portando a Reliquia do Sol — unica arma capaz de selar fendas entre mundos. Tres faccoes disputam o controle dessas fendas."
          ),
          h("Pitch", 3),
          p(
            "Um RPG de fantasia onde cada decisao de combate reverbera na historia. Jogue como Kael, descubra tres faccoes em guerra, e escolha se vai salvar o mundo, transforma-lo ou conquista-lo."
          ),
          h("USP — Diferenciais Competitivos", 3),
          li("Reliquia como mecanica central: cargas escassas, decisao por turno."),
          li("Faccoes dinamicas: acoes em uma regiao afetam relacionamentos em outras."),
          li("Tres finais narrativamente distintos mas mecanicamente iguais (nao exige rejogar ato 1)."),
          li("Morte permanente opcional em New Game+."),
          callout(
            "warning",
            "O que e USP? Unique Selling Proposition — o que faz o seu jogo diferente dos concorrentes. Nao precisa ser revolucionario: precisa ser especifico."
          ),
          callout(
            "design-decision",
            "Comecamos a visao geral com o protagonista (Kael), nao com o cenario. Motivo: e mais facil vender uma pessoa do que um mundo. O contexto vem depois."
          ),
          callout(
            "warning",
            "Este conteudo e ficticio pra servir de exemplo. Substitua por Elder Realms pelos elementos do SEU jogo, mantendo a estrutura das secoes (Pitch, Publico, USP, Diferencial)."
          ),
        ]
      ),

      narrative(
        "rpg-completo-mecanicas",
        "Mecanicas Principais",
        "Exploracao, combate, progressao e inventario de Elder Realms.",
        [
          h("Mecanicas Centrais — Elder Realms", 2),
          p(
            "O jogo alterna entre fases de exploracao (mundo aberto, puzzles ambientais, dialogo) e fases de combate (turnos taticos). Transicao e ativada por encontros visiveis no mapa — nao tem combate aleatorio."
          ),
          h("Pilares", 3),
          li("Exploracao livre com gates narrativos, nao gates de nivel."),
          li("Combate sempre opcional ate o boss de ato — voce pode tentar evitar."),
          li("Reliquia alimenta tanto combate (skills) quanto exploracao (selar fendas)."),
          callout(
            "design-decision",
            "Sem combate aleatorio: respeitamos o tempo do jogador. Quando ele luta, e porque escolheu."
          ),
        ],
        [
          narrative(
            "rpg-completo-exploracao",
            "Exploracao",
            "Mundo aberto de Elder Realms, eventos, puzzles e gates.",
            [
              h("Exploracao", 2),
              p(
                "Elder Realms tem cinco regioes conectadas: Torre Vermelha (tutorial), Cidade Portal, Floresta do Veu, Deserto do Eclipse e Capital Branca. Voce pode acessa-las em ordem livre apos completar o ato 1."
              ),
              li("Cada regiao tem 3-5 fendas. Selar todas desbloqueia um boss opcional."),
              li("Baus comuns requerem exploracao; baus raros requerem puzzle ambiental."),
              li("NPCs ambientais contam lore sem bloquear progressao."),
              callout(
                "design-decision",
                "Mundo semi-aberto (nao open world puro): controla o escopo de conteudo sem perder a sensacao de liberdade. Essa e a arquitetura usada por FF10 e Chrono Trigger."
              ),
            ]
          ),
          narrative(
            "rpg-completo-inventario",
            "Inventario",
            "Regras de stack, filtros e comparacao em Elder Realms.",
            [
              h("Inventario", 2),
              li("Limite: 99 itens unicos + 9 stacks de consumiveis."),
              li("Consumiveis stackam ate 99. Equipamentos sao unicos."),
              li("Filtros: Equipamento / Consumivel / Material / Chave."),
              li("Ao equipar, aparece comparativo lado-a-lado com o item atual."),
              callout(
                "balance-note",
                "Limite de 99 itens pode virar apertado no ato 2 — considere expansao via upgrade da cidade como recompensa de side quest."
              ),
            ]
          ),
        ]
      ),

      narrative(
        "rpg-completo-personagens",
        "Personagens, Classes e Buildcraft",
        "Kael, Aria, Bran e o sistema de build de Elder Realms.",
        [
          h("Elenco Principal — Elder Realms", 2),
          p(
            "Tres classes jogaveis com identidades contrastantes. A composicao de grupo (escolha dois em cada batalha) e uma decisao tatica central."
          ),
          li("Kael — Guerreiro Solar (tanque + DPS corpo-a-corpo)."),
          li("Aria — Maga Eclipsada (dano magico e debuffs)."),
          li("Bran — Vagante Sombrio (critico alto, esquiva, venenos)."),
          callout(
            "design-decision",
            "Cada classe tem UM ponto forte claro + UM ponto fraco claro. Sem isso, os jogadores escolheriam sempre a mesma — e a composicao de grupo perderia sentido."
          ),
        ],
        [
          {
            id: "rpg-completo-atributos-base",
            title: "Atributos Base",
            content: "5 atributos compartilhados: HP, ATK, DEF, MAG, SPD.",
            pageType: {
              id: "attributeDefinitions",
              options: {
                attributeDefinitionsOverrides: {
                  attributes: [
                    { key: "hp", label: "HP", valueType: "int", defaultValue: 100, min: 0 },
                    { key: "atk", label: "ATK", valueType: "int", defaultValue: 10, min: 0 },
                    { key: "def", label: "DEF", valueType: "int", defaultValue: 5, min: 0 },
                    { key: "mag", label: "MAG", valueType: "int", defaultValue: 8, min: 0 },
                    { key: "spd", label: "SPD", valueType: "int", defaultValue: 5, min: 0 },
                  ],
                },
                richDocBlocks: [
                  h("Atributos Base — Elder Realms", 2),
                  li("HP — pontos de vida. Morre em 0."),
                  li("ATK — dano fisico por golpe."),
                  li("DEF — reducao de dano recebido."),
                  li("MAG — poder de feiticos e cargas da Reliquia."),
                  li("SPD — ordem no turno e chance de esquiva."),
                  callout(
                    "note",
                    "Esta pagina e referenciada por todas as classes. Adicionar atributo aqui (ex: LUK) afeta todos os personagens."
                  ),
                ],
              },
            },
          },
          narrative(
            "rpg-completo-classes",
            "Classes",
            "As tres classes de Elder Realms: funcoes, sinergias e counters.",
            [
              h("Classes — Elder Realms", 2),
              p(
                "Kael, Aria e Bran sao as classes de partida. Elas nao mudam durante o jogo — o que evolui e a build dentro da arvore de habilidades."
              ),
              h("Sinergias", 3),
              li("Kael+Aria — Kael tanka enquanto Aria castiga. Combo classico."),
              li("Aria+Bran — debuff + critico. Otimo contra bosses de HP alto."),
              li("Kael+Bran — dano bruto. Fraco contra inimigos voadores."),
              callout(
                "warning",
                "Se seu jogo tem so uma classe, apague os 3 subsections abaixo e descreva so a classe principal. Se tem 5+, duplique o padrao mas cuide do escopo — cada classe vira conteudo."
              ),
            ],
            [
              {
                id: "rpg-completo-kael",
                title: "Kael, o Guerreiro Solar",
                content: "Tanque e atacante corpo-a-corpo, portador da Reliquia do Sol.",
                pageType: {
                  id: "characters",
                  options: {
                    richDocBlocks: [
                      h("Kael, o Guerreiro Solar", 2),
                      p(
                        "Guerreiro amnesico que acorda no topo da Torre Vermelha com a Reliquia do Sol fundida ao peito. Tanque + DPS corpo-a-corpo."
                      ),
                      li("Papel: absorver dano e controlar frente."),
                      li("Skill assinatura: Escudo Solar (absorve dano e reflete 30%)."),
                      li("Fraqueza: inimigos de SPD alto."),
                      callout(
                        "note",
                        "Esta pagina ja vem com Perfil de Atributos, Curva de XP, Tabela de Progressao e Efeitos. Duplique-a pra criar Aria e Bran."
                      ),
                    ],
                  },
                },
              },
            ]
          ),
          narrative(
            "rpg-completo-skill-tree",
            "Arvore de Habilidades",
            "Ramos, custos e milestones de build em Elder Realms.",
            [
              h("Arvore de Habilidades", 2),
              p(
                "Cada classe tem tres ramos (Forca, Tecnica, Reliquia). Cada ramo tem 8 habilidades desbloqueaveis por pontos de skill (1 por level up)."
              ),
              li("Ramo Forca: melhora ataque bruto e sobrevivencia."),
              li("Ramo Tecnica: habilidades conditionais (criticos, combos)."),
              li("Ramo Reliquia: reduz custo de skills que gastam Reliquia."),
              callout(
                "design-decision",
                "3 ramos × 8 habilidades = 24 habilidades por classe. Impossivel maxar tudo ate level 20 — forca escolhas reais de build em cada run."
              ),
              callout(
                "balance-note",
                "Cuidado com ramos \"obvios\" (ex: Bran sempre maxa Tecnica). Se um ramo e sempre escolhido, o sistema de escolha virou ilusao."
              ),
            ]
          ),
        ]
      ),

      narrative(
        "rpg-completo-combate",
        "Sistema de Combate Avancado",
        "Formulas, status, IA inimiga e bosses de Elder Realms.",
        [
          h("Combate — Detalhado", 2),
          p(
            "Combate em turnos ordenados por SPD. Posicionamento existe em grid 3×3. Ataque pelas costas = +50% critico. A Reliquia do Sol da 3 cargas por batalha e nao regenera durante combate."
          ),
        ],
        [
          narrative(
            "rpg-completo-formulas",
            "Formulas Base",
            "Dano, critico, mitigacao e status effects de Elder Realms.",
            [
              h("Formulas Base", 2),
              p("Dano = (ATK — DEF_alvo) × mod_skill × critico."),
              p("Critico = 1.0 (normal) ou 1.5 (ataque pelas costas ou skill de critico garantido)."),
              p("Chance de esquiva = (SPD_alvo — SPD_atacante) × 2%, cap em 40%."),
              li("Queima — 5% HP/turno por 3 turnos (zera com agua)."),
              li("Congelamento — pula 1 turno (zera com fogo)."),
              li("Envenenamento — 3% HP/turno por 5 turnos (zera com antidoto)."),
              callout(
                "design-decision",
                "Formula subtrativa ((ATK-DEF)×mod) em vez de multiplicativa (ATK×(1-DEF%)): DEF baixo e mais impactante no comeco, reforcando progressao."
              ),
              callout(
                "balance-note",
                "Cap de 40% esquiva previne Bran ficar \"intocavel\" com SPD 30+ contra inimigos lentos. Considere cap diferente em Hard Mode."
              ),
            ]
          ),
          narrative(
            "rpg-completo-ia-inimiga",
            "IA Inimiga e Bosses",
            "Como inimigos decidem e como bosses tem fases.",
            [
              h("IA Inimiga", 2),
              p(
                "Inimigos comuns seguem heuristicas simples: priorizam alvo de menor HP, fogem quando abaixo de 20% HP. Previsiveis de proposito — o foco e a tatica do jogador."
              ),
              h("Bosses", 3),
              li("3 fases: neutral (usa skills basicas), pressionado (< 50% HP: novas skills), desesperado (< 15%: ultimate)."),
              li("Cada fase tem telegrafo visual (flash de cor) 1 turno antes."),
              callout(
                "design-decision",
                "Telegrafo 1 turno antes da ultimate e sagrado: garante que morrer de boss e culpa do jogador, nao do dado. Essa regra salva de frustracao."
              ),
            ]
          ),
        ]
      ),

      narrative(
        "rpg-completo-itens",
        "Itens, Equipamentos e Loot",
        "Taxonomia, raridade, drop table e upgrade em Elder Realms.",
        [
          h("Itens e Equipamentos", 2),
          p(
            "Tres tipos: equipamentos (usaveis por classe), consumiveis (pocoes, antidotos) e materiais (crafting)."
          ),
          h("Raridade", 3),
          li("Comum (cinza) — armas basicas sem bonus."),
          li("Raro (azul) — 1 atributo extra + efeito modesto."),
          li("Epico (roxo) — 2 atributos extras + efeito ativo/passivo."),
          li("Lendario (dourado) — assinatura unica + peso narrativo."),
          callout(
            "design-decision",
            "Lendarios nao dropam aleatorio — so em momentos narrativos. Isso transforma raridade em sinal de progresso da historia."
          ),
        ],
        [
          {
            id: "rpg-completo-lamina",
            title: "Lamina do Crepusculo",
            content: "Espada lendaria de Bran, ganha no capitulo 3.",
            pageType: {
              id: "equipmentItem",
              options: {
                richDocBlocks: [
                  h("Lamina do Crepusculo", 2),
                  p(
                    "Forjada pelos Nomades do Veu no ultimo eclipse. So quem ja matou um ser do Veu pode empunha-la."
                  ),
                  li("+8 ATK, +3 SPD."),
                  li("Ao matar inimigo, proximo ataque tem critico garantido."),
                  callout(
                    "design-decision",
                    "Pre-requisito narrativo (matar um ser do Veu) em vez de nivel. Quando Bran recebe a lamina, ja tem contexto — ele ganhou."
                  ),
                ],
              },
            },
          },
          narrative(
            "rpg-completo-loot",
            "Politica de Loot",
            "Drop tables, pity timers e garantias em Elder Realms.",
            [
              h("Politica de Loot", 2),
              li("Drop rates: comum 70%, raro 25%, epico 4.5%, lendario 0% (so narrativo)."),
              li("Pity timer: 10 baus sem raro+ garante um raro no 11."),
              li("Garantia minima: chefe de ato sempre dropa 1 epico."),
              callout(
                "balance-note",
                "Pity timer e contra-intuitivo pra designer mas essencial pra player: evita sequencias de azar que matam engajamento."
              ),
            ]
          ),
          narrative(
            "rpg-completo-upgrade",
            "Upgrade e Encantamento",
            "Custos, risco e progressao de gear em Elder Realms.",
            [
              h("Upgrade e Encantamento", 2),
              p(
                "Equipamentos podem ser aprimorados em ferreiros. Upgrade +1 ao +5 sucesso garantido (custo crescente). +6 em diante tem chance de falha (perde materiais, mantem arma)."
              ),
              li("Cada +1 adiciona +10% aos stats base."),
              li("Falha em +6 ou superior usa materiais raros — decisao de risco."),
              callout(
                "design-decision",
                "Sucesso garantido ate +5 e contrato implicito: todo equipamento e upgradavel sem frustracao. Risco so acima disso, onde o player ja tomou decisao informada."
              ),
              callout(
                "warning",
                "Se seu jogo nao tem ferreiro/upgrade, apague esta secao. Se tem encantamento tipo diablo/poe, expanda com tabelas de affixes."
              ),
            ]
          ),
        ]
      ),

      narrative(
        "rpg-completo-narrativa",
        "Narrativa, Lore e Missoes",
        "Arco principal, side quests e impacto de escolhas em Elder Realms.",
        [
          h("Narrativa — Elder Realms", 2),
          p(
            "3 atos com escolhas que ecoam no ato seguinte. Ato 1 tutorial e despertar; ato 2 guerra das faccoes; ato 3 decisao final sobre as fendas."
          ),
          h("Main Quest", 3),
          li("Ato 1 — Kael desperta, encontra Aria, descobre o sistema das fendas. 3-5h."),
          li("Ato 2 — Bran se junta, confronto com a Ordem. Escolha pivota o ato 3. 8-12h."),
          li("Ato 3 — decisao final: selar tudo, usar como energia, ou libertar. 3 finais. 3-6h por final."),
          h("Side Quests", 3),
          li("15 side quests principais, cada uma alinhada com uma faccao."),
          li("Completar todas as de uma faccao desbloqueia final \"puro\" daquela faccao."),
          callout(
            "design-decision",
            "Side quests que alinham com uma faccao (em vez de neutras) transformam quest-grind em posicionamento politico. O jogador nao farma XP — ele escolhe lado."
          ),
          callout(
            "warning",
            "Esta pagina e o lar da lore. Use o addon Rich Doc abaixo pra escrever backstories de NPCs, descricoes de regioes e roteiros de quest. Callouts de design-decision ajudam a lembrar POR QUE tomou certas decisoes narrativas."
          ),
        ]
      ),

      narrative(
        "rpg-completo-secundarios",
        "Sistemas Secundarios",
        "Crafting, guildas, eventos e PvP opcional em Elder Realms.",
        [
          h("Sistemas Secundarios", 2),
          p(
            "Conteudo opcional que estende o ciclo de vida do jogo sem bloquear main quest."
          ),
          li("Crafting — forjar equipamentos a partir de materiais (mesa dedicada abaixo)."),
          li("Guildas — 3 guildas alinhadas com as faccoes. Recompensam com equipamento e skills."),
          li("Arena — PvE roguelike pos-game. Sem recompensa narrativa, so skins."),
          callout(
            "warning",
            "Sistemas secundarios sao armadilha de escopo. Se voce e solo dev, comece com UM (ex: so crafting). Guildas e arena podem vir em update pos-lancamento."
          ),
        ],
        [
          {
            id: "rpg-completo-mesa-forja",
            title: "Mesa de Forja",
            content: "Estacao de crafting — agrega receitas de equipamento.",
            pageType: {
              id: "craftTable",
              options: {
                richDocBlocks: [
                  h("Mesa de Forja", 2),
                  p(
                    "Local em Cidade Portal onde o jogador transforma materiais em equipamentos. Cada receita tem ingredientes, saida e tempo de produc ao."
                  ),
                  callout(
                    "note",
                    "Esta mesa comeca vazia. Crie paginas de Receita no sidebar e depois ligue-as aqui pelo addon Mesa de Producao."
                  ),
                  callout(
                    "warning",
                    "Se seu jogo nao tem crafting, remova esta subsection inteira."
                  ),
                ],
              },
            },
          },
        ]
      ),

      {
        id: "rpg-completo-economia",
        title: "Economia",
        content: "Moeda Ouro de Elder Realms, fontes, sinks e limites.",
        pageType: {
          id: "economy",
          options: {
            richDocBlocks: [
              h("Economia — Elder Realms", 2),
              p(
                "Moeda unica (Ouro). Fontes: combate, baus, venda de itens. Sinks: reparo, consumiveis, fast-travel, upgrade."
              ),
              h("Fontes", 3),
              li("Drops de inimigos: 5-50 ouro."),
              li("Baus: 50-500 ouro."),
              li("Venda de equipamentos: 10% do preco de compra."),
              h("Sinks", 3),
              li("Reparo — 5% do valor do item por ponto de durabilidade."),
              li("Upgrade — custo crescente por nivel do equipamento."),
              li("Fast-travel — 100 ouro por viagem."),
              li("Consumiveis — 20-200 ouro."),
              callout(
                "design-decision",
                "Moeda unica mantem economia legivel pra player casual. Se precisar de metaprogressao (ex: gemas pra cosmeticos), crie pagina separada."
              ),
              callout(
                "balance-note",
                "Reparo a 5% por ponto e delicado. Se alto, jogador evita usar bom equipamento. Se baixo, reparo vira irrelevante."
              ),
              callout(
                "warning",
                "Monetizacao em RPG premium e diferente de F2P. Esta pagina cobre economia IN-GAME. Se seu jogo tem store real (DLCs, skins pagas), crie pagina separada pra modelo de monetizacao."
              ),
            ],
          },
        },
      },
    ],
  },
  roguelike: {
    mini: [
      narrative(
        "rogue-mini-visao-geral",
        "Visao Geral — Abyss Descent",
        "Pitch curto do jogo de exemplo.",
        [
          h("Visao Geral — Abyss Descent", 2),
          p(
            "Abyss Descent e um action roguelike onde voce joga como Nyx, uma Errante amaldicoada a descer um poco infinito chamado Abissao. Cada descida e uma run. Morrer retorna voce a superficie, mas algumas almas colhidas (Essence) persistem — alimentando sua arvore de meta-progressao."
          ),
          callout(
            "warning",
            "Este e um exemplo ficticio. Substitua Nyx, Abissao e a Essence pelos elementos do SEU roguelike."
          ),
        ]
      ),
      narrative(
        "rogue-mini-run",
        "Estrutura de Run",
        "Como uma descida da Abissao funciona.",
        [
          h("Estrutura de Run", 2),
          li("Cada run tem 5 andares + 1 boss final."),
          li("Andar = 4-6 salas interligadas, com saida pra proxima."),
          li("Ao morrer, volta a superficie com Essence coletada."),
          callout(
            "design-decision",
            "5 andares e um sweet-spot pra sessao de 30-40min. Menos vira \"so comecei e acabou\"; mais cansa antes do boss."
          ),
        ]
      ),
      narrative(
        "rogue-mini-build",
        "Builds",
        "Pilares de build e sinergias em Abyss Descent.",
        [
          h("Builds", 2),
          li("Pilar 1: Dano Direto (armas fisicas, critico alto)."),
          li("Pilar 2: Dano Sustentado (veneno, queima, marcas)."),
          li("Pilar 3: Defesa (escudos, lifesteal, reflexao)."),
          callout(
            "design-decision",
            "3 pilares (nao 2, nao 5): o minimo pra ter escolha real sem overwhelming o jogador novo."
          ),
        ]
      ),
      narrative(
        "rogue-mini-meta",
        "Metaprogressao",
        "O que persiste entre runs em Abyss Descent.",
        [
          h("Metaprogressao", 2),
          p(
            "Essence coletada nas runs pode ser gasta no Altar da Superficie entre descidas. Desbloqueia novas armas, relicarios iniciais e vantagens passivas."
          ),
          callout(
            "design-decision",
            "Meta persiste mas NAO substitui skill. Um player novo com meta maxa nao passa do boss sem aprender mecanicas."
          ),
          callout(
            "balance-note",
            "Playtestar cedo: meta nao pode trivializar early game. Se o jogador com 50h de meta clica no jogo e nao morre nunca, quebrou."
          ),
        ]
      ),
    ],
    medio: [
      narrative(
        "rogue-medio-visao-geral",
        "Visao Geral — Abyss Descent",
        "Pitch, USP e diferencial do jogo de exemplo.",
        [
          h("Visao Geral — Abyss Descent", 2),
          p(
            "Abyss Descent e um action roguelike com fogo em tempo real, inspirado em Hades e Dead Cells. Voce joga Nyx, a Errante, descendo a Abissao atras da Alma da Mae — relic lendaria que concederia fim ao seu ciclo de maldicao."
          ),
          h("USP", 3),
          li("Narrativa que progride DENTRO de cada run via dialogos curtos entre andares."),
          li("Essence (meta currency) com escolha de 3 caminhos de upgrade mutuamente exclusivos."),
          li("Variancia controlada: pools de loot ajustam com base no seu historico de runs (anti-frustracao)."),
          callout(
            "design-decision",
            "Diferencial competitivo vs Hades: dialogos narrativos aparecem DURANTE a run (entre andares), nao so na superficie. Aumenta densidade narrativa sem aumentar tempo fora da acao."
          ),
          callout(
            "warning",
            "Este conteudo e ficticio. Substitua Abyss Descent e Nyx pelos elementos do SEU roguelike, mantendo a estrutura das secoes."
          ),
        ]
      ),
      narrative(
        "rogue-medio-run-design",
        "Run Design",
        "Pacing, escalada de risco e recursos por run.",
        [
          h("Run Design — Abyss Descent", 2),
          p(
            "Uma run tipica dura 30-45 minutos. 5 biomes (Cavernas, Ruinas, Pantanos, Abismo, Vazio), cada um com 4-6 salas + sala elite opcional. Boss no final do bioma 5."
          ),
          h("Escalada de Risco", 3),
          li("Bioma 1-2: onboarding, inimigos lentos, loot generoso."),
          li("Bioma 3-4: densidade sobe, aparecem elites, loot fica seletivo."),
          li("Bioma 5: cenario estreito, inimigos coordenados, pouca oportunidade de cura."),
          h("Pacing de Recursos", 3),
          li("Vida regenerada so entre biomas (sala de descanso)."),
          li("Moeda de run (Vestigio) dropa em todo combate. Lojas em cada bioma."),
          callout(
            "design-decision",
            "Vida nao regenera entre salas DENTRO do bioma: mantem tensao tatica alta. Entre biomas SIM: respira o player antes do spike."
          ),
          callout(
            "balance-note",
            "Se jogador acaba bioma 5 com 100% vida, significa que desafio do bioma 4 foi baixo. Meta de playtest: chegar ao boss com 40-60% vida."
          ),
        ]
      ),
      narrative(
        "rogue-medio-procedural",
        "Geracao Procedural",
        "Regras de composicao de salas, eventos e encontros em Abyss Descent.",
        [
          h("Geracao Procedural", 2),
          p(
            "Cada run usa uma seed. Bioma embaralha uma lista fixa de salas (40 por bioma), escolhe 5-6 respeitando regras: ao menos 1 combate, ao menos 1 elite aos 60% do bioma, sala de loja em posicao aleatoria."
          ),
          li("Salas proibidas de repetir no mesmo bioma (pool de 40, escolhe 5)."),
          li("Eventos especiais (ex: mercador misterioso) tem chance base 10% por bioma, +10% se nao apareceu nos biomas anteriores."),
          li("Seed visivel pro jogador: compartilha runs dificeis com amigos."),
          callout(
            "design-decision",
            "Seed visivel e compartilhavel e feature de comunidade — nao compromete a fantasia de aleatoriedade e cria conteudo emergente (desafios, speedruns)."
          ),
        ]
      ),
      narrative(
        "rogue-medio-builds",
        "Buildcraft e Sinergias",
        "Como builds se formam em Abyss Descent.",
        [
          h("Sistema de Tags", 2),
          p(
            "Cada item e relicario tem 1-3 tags: Fogo, Veneno, Sangue, Luz, Sombra, Ferro. Itens com tags iguais criam sinergias passivas (ex: 3 itens de Fogo = +50% dano de queima)."
          ),
          h("Pilares de Build", 3),
          li("Pirokinetic — foco em Fogo + Sangue. Burst curto, dano alto."),
          li("Plaguebearer — foco em Veneno + Sombra. Dano em tempo."),
          li("Lightguard — foco em Luz + Ferro. Defensivo/control."),
          callout(
            "design-decision",
            "Tags explicit (visiveis no item) em vez de categorias escondidas: player novo ja entende sinergia sem tutorial."
          ),
          callout(
            "balance-note",
            "Cuidado com sinergias de 4+ tags iguais. Testamos no Hades que pura single-tag vira loop matematicamente superior — mistas precisam ser incentivadas."
          ),
        ]
      ),
      narrative(
        "rogue-medio-meta",
        "Metaprogressao e Persistencia",
        "Essence, Altar e desbloqueios permanentes em Abyss Descent.",
        [
          h("Metaprogressao", 2),
          p(
            "Essence e a alma fragmentada de criaturas derrotadas. Ela persiste entre runs e e gasta no Altar da Superficie."
          ),
          h("Arvore do Altar", 3),
          li("Ramo Forca — novas armas iniciais."),
          li("Ramo Sabedoria — relicarios iniciais (buff passivo por run)."),
          li("Ramo Persistencia — extra cura, mais moedas, +1 reroll por run."),
          p(
            "Os 3 ramos sao MUTUAMENTE EXCLUSIVOS num mesmo \"ciclo\". Voce escolhe um, maxa, depois pode mudar."
          ),
          callout(
            "design-decision",
            "Exclusividade mutua forca o jogador a comprometer-se com um estilo por um periodo. Evita \"vou maxar tudo em 200h e o jogo vira trivial\"."
          ),
          callout(
            "warning",
            "Meta deve ser opcional pra clear. Balanceamento: um player com ZERO meta tem que ser capaz de clear (dificil, mas possivel). Se meta vira gate, vira grinding."
          ),
        ]
      ),
      {
        id: "rogue-medio-economia",
        title: "Economia de Run",
        content: "Vestigios (moeda de run) em Abyss Descent: drops, lojas, rerolls.",
        pageType: {
          id: "economy",
          options: {
            richDocBlocks: [
              h("Economia de Run", 2),
              p(
                "Abyss Descent tem DUAS moedas com ciclos diferentes:"
              ),
              li("Vestigios — moeda de run. Evapora ao morrer. Compra em lojas de bioma."),
              li("Essence — moeda meta. Persiste entre runs. Gasta no Altar."),
              h("Vestigios — Economia Dentro da Run", 3),
              li("Inimigo comum: 5-15 vestigios."),
              li("Elite: 30-80 vestigios."),
              li("Sala de loja: compra itens (50-300) ou reroll (50)."),
              h("Essence — Economia Meta", 3),
              li("Dropa em quantidade proporcional a quanto voce avancou na run."),
              li("Gasto unico no Altar da Superficie."),
              callout(
                "design-decision",
                "Duas moedas com ciclos distintos resolvem tensao \"rush acc vs explore\": Vestigios te empurra pra usar agora (some), Essence recompensa risco (so vale se avancar)."
              ),
              callout(
                "balance-note",
                "Preco de reroll em loja e sensivel. Muito barato: player reroll-spam e o jogo vira lottery. Muito caro: loja vira decorativa."
              ),
              callout(
                "warning",
                "Esta pagina de Economia ja vem configurada com UMA moeda. Pra Abyss Descent, crie uma SEGUNDA pagina de Economia pra Essence."
              ),
            ],
          },
        },
      },
    ],
    completo: [
      narrative(
        "rogue-completo-visao-geral",
        "Visao Geral — Abyss Descent",
        "Pitch completo, publico, plataformas e USP.",
        [
          h("Visao Geral — Abyss Descent", 2),
          p(
            "Action roguelike PC/Switch inspirado em Hades e Dead Cells. Voce joga Nyx, a Errante, numa descida infinita ao poco Abissao em busca da Alma da Mae. Cada run dura 30-45min. Morrer e parte do ciclo: Essence persiste e alimenta meta-progressao."
          ),
          h("Pitch", 3),
          p(
            "Uma roguelike onde cada run te deixa um pouco menos humana. Colete Essence, escolha seu caminho de corrupcao, e descubra se a Alma da Mae vale o preco."
          ),
          h("USP", 3),
          li("Narrativa progride DENTRO da run (dialogos entre andares)."),
          li("Tres caminhos de meta-progressao mutuamente exclusivos (commitment)."),
          li("Variancia controlada por historico de runs (anti-streak de azar)."),
          callout(
            "design-decision",
            "Dialogos entre andares (nao so na superficie) ancoram o jogador no mundo sem interromper pacing do combate."
          ),
          callout(
            "warning",
            "Conteudo ficticio — substitua Abyss Descent e Nyx pelos elementos do seu roguelike."
          ),
        ]
      ),
      narrative(
        "rogue-completo-run-architecture",
        "Arquitetura de Run",
        "Modelo completo de run em Abyss Descent.",
        [
          h("Arquitetura de Run", 2),
          p(
            "Uma run tem 5 biomas sequenciais + boss final + boss secreto (unlockavel). Cada bioma tem estrutura propria: salas, elite opcional, sala de loja, sala de descanso, boss de bioma."
          ),
        ],
        [
          narrative(
            "rogue-completo-curva",
            "Curva de Risco",
            "Escalada de desafio por bioma.",
            [
              h("Curva de Risco", 2),
              li("Bioma 1 (Cavernas): onboarding. Inimigos lentos. Loot generoso."),
              li("Bioma 2 (Ruinas): padrões mais complexos. Primeiro elite opcional."),
              li("Bioma 3 (Pantanos): densidade aumenta. Estados alterados."),
              li("Bioma 4 (Abismo): inimigos coordenados. Cura escassa."),
              li("Bioma 5 (Vazio): pre-boss. Desafio maximo."),
              callout(
                "design-decision",
                "Escalada em steps (nao rampa linear) permite momentos de respiro apos cada bioma. Evita \"pico monotono de dificuldade\"."
              ),
              callout(
                "balance-note",
                "Monitore taxa de morte por bioma. Se bioma 3 tem mais mortes que bioma 5, curva esta invertida."
              ),
            ]
          ),
          narrative(
            "rogue-completo-objetivos",
            "Objetivos Primario e Secundario",
            "Quest de run + mastery opcional em Abyss Descent.",
            [
              h("Objetivos", 2),
              p("Primario: chegar ao boss final (desce 5 biomas)."),
              p(
                "Secundario (opcional): mastery challenges por run — derrotar elites em cada bioma, completar sem usar potions, coletar X essencia, etc. Completam \"marcas\" que persistem."
              ),
              callout(
                "design-decision",
                "Mastery opcional (nao obrigatorio pra progresso) adiciona rejogabilidade sem punir o jogador casual."
              ),
            ]
          ),
        ]
      ),
      narrative(
        "rogue-completo-procedural",
        "Geracao Procedural Avancada",
        "Pools, seeds e regras de composicao em Abyss Descent.",
        [
          h("Geracao Procedural Avancada", 2),
          p(
            "Cada bioma tem um pool de 40 salas. Gerador escolhe 5-6 por run respeitando restricoes. Cada sala tem subvariantes (inimigos diferentes, layouts espelhados) que aumentam variacao sem novo conteudo manual."
          ),
          h("Regras", 3),
          li("Ao menos 1 combate direto por bioma."),
          li("1 sala elite opcional aparece aos 60-80% do bioma."),
          li("Sala de loja em posicao aleatoria (nao primeira nem ultima)."),
          li("Eventos narrativos unlockam com base em quantas runs voce ja fez."),
          callout(
            "design-decision",
            "Pool grande (40 por bioma) com muitas subvariantes (>3x multiplier) cria variancia de ~120 salas percebidas com esforco de ~40."
          ),
        ]
      ),
      narrative(
        "rogue-completo-combate",
        "Combate, Armas e Modificadores",
        "Framework de combate tempo real em Abyss Descent.",
        [
          h("Combate — Abyss Descent", 2),
          p(
            "Acao em tempo real, camera de topo. Nyx tem 3 botoes principais: ataque basico (dash-attack), ataque especial (cooldown), e dash (i-frames curtos)."
          ),
          li("Ataque basico: combo de 3 hits, ultimo mais forte."),
          li("Especial: unico por arma. Cooldown 4-12s."),
          li("Dash: 6 frames invencivel. 3 usos consecutivos antes de cooldown."),
          h("Armas", 3),
          li("Espada Runica — balanceada."),
          li("Martelo Carmesim — slow, dano massivo."),
          li("Adagas Gemeas — rapido, requer combo."),
          li("Cajado Cristalino — distancia, canal de casts."),
          callout(
            "design-decision",
            "3 botoes e sagrado pra acessibilidade em pad. Mais que isso vira luta com controles."
          ),
          callout(
            "balance-note",
            "Monitore pick rate de armas. Se Espada Runica e 60%+, balanceamento esta tendencioso a \"safe default\"."
          ),
        ]
      ),
      narrative(
        "rogue-completo-buildcraft",
        "Buildcraft",
        "Sistema de tags, sinergias e teto de poder em Abyss Descent.",
        [
          h("Buildcraft", 2),
          p(
            "Itens tem 1-3 tags (Fogo, Veneno, Sangue, Luz, Sombra, Ferro). Combinacoes geram sinergias passivas escalonadas: 2 itens mesmos tag = +25% efeito; 3 itens = +50%; 4+ = +75% com diminishing returns."
          ),
          h("Antisinergias", 3),
          li("Luz + Sombra: reducao de 50% em ambos os efeitos."),
          li("Fogo + Agua (se tiver): cancela ambos."),
          callout(
            "design-decision",
            "Antisinergias explicitas existem pra impedir builds \"stack tudo\" e forcar escolhas reais."
          ),
          callout(
            "balance-note",
            "Teto de poder em tag: 5 itens mesmo tag = mesmo bonus que 4. Previne scaling infinito em runs longas."
          ),
        ]
      ),
      narrative(
        "rogue-completo-metaprogressao",
        "Metaprogressao",
        "Desbloqueios permanentes + tres caminhos exclusivos.",
        [
          h("Metaprogressao — Altar da Superficie", 2),
          p(
            "Gasta Essence pra desbloquear armas, relicarios iniciais e vantagens passivas. Tres ramos MUTUAMENTE EXCLUSIVOS dentro de um ciclo."
          ),
          li("Forca — desbloqueia armas novas."),
          li("Sabedoria — desbloqueia relicarios iniciais."),
          li("Persistencia — buffs passivos (+cura, +essencia, +reroll)."),
          callout(
            "design-decision",
            "Exclusividade por ciclo obriga commitment: voce escolhe um caminho, maxa, AI troca. Evita o \"maxa tudo, trivialize o jogo\"."
          ),
          callout(
            "warning",
            "Teste: um player com meta-progressao ZERO deve conseguir clear em 100-300 runs. Se menos, meta virou obrigatoria."
          ),
        ]
      ),
      narrative(
        "rogue-completo-bosses",
        "Elites e Bosses",
        "Padroes, telegrafos e fairness em Abyss Descent.",
        [
          h("Elites e Bosses", 2),
          p(
            "Cada bioma tem 1 boss fixo. Elites spawnam aleatoriamente em salas designadas. Boss final desbloqueia boss secreto no new game+."
          ),
          h("Estrutura de Boss", 3),
          li("Fase 1 (100% HP): 3 padroes alternando."),
          li("Fase 2 (60% HP): adiciona 2 padroes. Muda musica."),
          li("Fase 3 (20% HP): padrao ultimate com telegrafo de 2 segundos."),
          callout(
            "design-decision",
            "Fase 3 com telegrafo longo e sagrado: morrer pro boss deve ser leitura do jogador, nao dado. Salva de frustacao."
          ),
          callout(
            "balance-note",
            "Primeiro boss (bioma 1) deve ter taxa de morte ~80% na primeira tentativa do player. Menos = trivial. Muito mais = frustracao antes de engajamento."
          ),
        ]
      ),
      {
        id: "rogue-completo-economia",
        title: "Economia e Loja de Run",
        content: "Vestigios (run) + Essence (meta) em Abyss Descent.",
        pageType: {
          id: "economy",
          options: {
            richDocBlocks: [
              h("Economia — Abyss Descent", 2),
              p("Duas moedas, ciclos diferentes:"),
              li("Vestigios — moeda de run. Some ao morrer."),
              li("Essence — moeda meta. Persiste."),
              h("Lojas de Bioma (Vestigios)", 3),
              li("Itens: 50-300 vestigios."),
              li("Reroll de loja: 50 vestigios."),
              li("Cura completa: 150 vestigios."),
              callout(
                "design-decision",
                "Lojas 1 por bioma (5 por run) e o ideal: mais torna Vestigios commodity; menos torna irrelevante."
              ),
              callout(
                "balance-note",
                "Preco de cura (150) e calibrado pra ser decisao real: cobre ~3 inimigos comuns de loot. Mais barato = nunca morre em bioma facil; caro = player usa potion em vez."
              ),
              callout(
                "warning",
                "Esta pagina representa UMA moeda. Crie segunda pagina de Economia pra Essence (meta currency) com configuracao diferente."
              ),
            ],
          },
        },
      },
    ],
  },
  platformer: {
    mini: [
      narrative(
        "plat-mini-visao-geral",
        "Visao Geral — Spark the Fox",
        "Pitch curto do jogo de exemplo.",
        [
          h("Visao Geral — Spark the Fox", 2),
          p(
            "Spark the Fox e um platformer 2D sobre uma raposinha laranja chamada Spark que sai em busca de sua irma Ember, capturada pelo Rei das Sombras. Oito mundos coloridos, pulo preciso, foco em timing e mastery."
          ),
          callout(
            "warning",
            "Exemplo ficticio. Substitua Spark, Ember e o Rei das Sombras pelos elementos do SEU platformer."
          ),
        ]
      ),
      narrative(
        "plat-mini-movimento",
        "Movimento",
        "Pulo, velocidade e sensacao de controle de Spark.",
        [
          h("Movimento — Spark the Fox", 2),
          li("Spark corre a 6 u/s. Acelera ate o pico em 0.3s."),
          li("Pulo: 3.5 unidades de altura, 0.5s de duracao."),
          li("Coyote time: 0.1s apos cair da plataforma."),
          li("Jump buffer: 0.15s antes de encostar no chao."),
          callout(
            "design-decision",
            "Coyote time e jump buffer sao \"mentiras bonitas\" do platformer: o jogador sente que o controle funciona mesmo em timings ligeiramente errados. Invisivel mas crucial."
          ),
          callout(
            "warning",
            "Numeros (6 u/s, 3.5 alt) sao exemplo de Spark. Seu jogo precisa tunar esses valores em playtest — sensacao de pulo e sensivel a variacoes de 5-10%."
          ),
        ]
      ),
      narrative(
        "plat-mini-fases",
        "Estrutura de Fases",
        "Como uma fase de Spark the Fox e construida.",
        [
          h("Estrutura de Fase", 2),
          li("Inicio (30s): apresenta uma mecanica nova de forma segura."),
          li("Desenvolvimento (1-2min): combina a mecanica nova com mecanicas antigas."),
          li("Pico (30-45s): desafio que exige mastery da mecanica."),
          li("Conclusao (15s): trecho relaxante que celebra a passagem do pico."),
          callout(
            "design-decision",
            "Essa arquitetura (intro-desenvolv-pico-conclusao) e o padrao Nintendo do Mario 3D World. Funciona porque respeita o ritmo cognitivo do jogador."
          ),
        ]
      ),
      narrative(
        "plat-mini-progressao",
        "Progressao",
        "Habilidades desbloqueaveis em Spark the Fox.",
        [
          h("Progressao", 2),
          p(
            "Nao ha leveling up. Progressao e por habilidades colecionadas ao longo da aventura — cada mundo novo introduz uma habilidade (dash, double jump, wall slide, etc.)."
          ),
          callout(
            "design-decision",
            "Progressao por habilidade, nao por numero, respeita o gender: em platformers, ganhar \"dobro de HP\" nao deixa o pulo mais divertido. Ganhar dash si."
          ),
        ]
      ),
    ],
    medio: [
      narrative(
        "plat-medio-visao-geral",
        "Visao Geral — Spark the Fox",
        "Pitch, USP e publico-alvo do jogo de exemplo.",
        [
          h("Visao Geral — Spark the Fox", 2),
          p(
            "Platformer 2D cute-dark onde Spark, uma raposinha laranja, corre em 8 mundos coloridos atras da irma Ember, capturada pelo Rei das Sombras. Foco em timing preciso, level design ensinante e trilha sonora memoravel."
          ),
          h("USP", 3),
          li("Cada mundo tem UMA mecanica nova (dash, double jump, wall slide, glide, time slow, etc.) — sem inflacao de botoes."),
          li("Modo speedrun built-in com leaderboards online."),
          li("Trilha sonora dinamica que se adapta ao ritmo do jogador."),
          callout(
            "design-decision",
            "Uma mecanica por mundo (nao varias) garante que cada fase ensine algo novo sem sobrecarregar os controles."
          ),
          callout(
            "warning",
            "Conteudo ficticio. Substitua Spark, Ember e Rei das Sombras pelos elementos do SEU platformer."
          ),
        ]
      ),
      narrative(
        "plat-medio-physics",
        "Physics e Controle",
        "Parametros tecnicos de pulo e movimento de Spark the Fox.",
        [
          h("Physics", 2),
          li("Velocidade maxima: 6 u/s."),
          li("Aceleracao: 0-6 u/s em 0.3s (suave). Freada: 6-0 em 0.15s (rapida)."),
          li("Pulo: altura 3.5u, duracao 0.5s (curva quadratica)."),
          li("Gravidade: 18 u/s². Gravidade pos-pico +50% (cai mais rapido que sobe)."),
          h("Assistencias", 3),
          li("Coyote time: 0.1s."),
          li("Jump buffer: 0.15s."),
          li("Edge forgiveness: se cair em borda, empurra 0.2u pra seguranca."),
          callout(
            "design-decision",
            "Gravidade pos-pico aumentada e outro \"trick\" classico: faz o pulo sentir peso sem deixar o jogador no ar tempo demais. Usado em Celeste, Hollow Knight, Mario."
          ),
          callout(
            "balance-note",
            "Valor crucial: altura do pulo x espaco entre plataformas. 3.5u cobre gaps de ate 4.5u horizontal (com corrida). Alterar um sem ajustar o outro quebra level design."
          ),
        ]
      ),
      {
        id: "plat-medio-atributos",
        title: "Atributos do Jogador",
        content: "HP, Speed e Jump Height de Spark — valores base ajustaveis.",
        pageType: {
          id: "attributeDefinitions",
          options: {
            attributeDefinitionsOverrides: {
              attributes: [
                { key: "hp", label: "HP", valueType: "int", defaultValue: 3, min: 0 },
                { key: "spd", label: "Speed", valueType: "float", defaultValue: 1.0, min: 0 },
                { key: "jump", label: "Jump Height", valueType: "float", defaultValue: 1.5, min: 0 },
              ],
            },
            richDocBlocks: [
              h("Atributos do Jogador — Spark the Fox", 2),
              p(
                "Platformer tem atributos mais simples que RPG — o foco e movimento, nao numeros. Spark tem 3 atributos base."
              ),
              li("HP (int) — pontos de vida. Default 3 (estilo clasico de platformer)."),
              li("Speed (float) — multiplicador de velocidade. Default 1.0 (base)."),
              li("Jump Height (float) — multiplicador de altura do pulo. Default 1.5."),
              callout(
                "design-decision",
                "Atributos multiplicativos (Speed 1.0 como base) em vez de aditivos permitem power-ups mais expressivos sem quebrar math: Speed 2.0 claramente dobra."
              ),
              callout(
                "note",
                "Esta pagina ja vem com os 3 atributos criados. Ajuste valores iniciais ou adicione novos (ex: Dash Count pra numero de dashes por pulo) no painel lateral."
              ),
              callout(
                "warning",
                "Platformer pode viver com 2-3 atributos. Evite o impulso de \"RPG-izar\" — em platformer, design da FASE e muito mais importante que stats do personagem."
              ),
            ],
          },
        },
      },
      narrative(
        "plat-medio-level-design",
        "Level Design",
        "Principios de ensino, ritmo e leitura visual em Spark the Fox.",
        [
          h("Principios de Level Design", 2),
          p(
            "Toda fase de Spark segue 3 leis de level design:"
          ),
          li("Mostra a mecanica em ambiente seguro antes de exigir (conheca-estrese-teste)."),
          li("Usa linguagem visual consistente: espinhos sempre vermelhos, plataformas moveis sempre amarelas."),
          li("Toda morte deve ensinar algo novo — morrer pelo mesmo motivo duas vezes e failure do designer."),
          callout(
            "design-decision",
            "Linguagem visual consistente e sagrada: se espinhos viram azuis em algum mundo, o jogador nao consegue mais confiar no que ve. Leitura visual e um contrato."
          ),
          callout(
            "balance-note",
            "Playtest com jogador novo: se ele morre mais de 5x no mesmo obstaculo, o obstaculo esta mal sinalizado ou injusto — nao dificil."
          ),
        ]
      ),
      narrative(
        "plat-medio-checkpoints",
        "Checkpoints e Recuperacao",
        "Distribuicao de checkpoints e tempo de retorno em Spark the Fox.",
        [
          h("Checkpoints", 2),
          li("Checkpoint a cada 60-90s de gameplay perfeito (ou seja: apos cada secao desafiadora)."),
          li("Ao morrer, renasce no checkpoint com 100% HP e colecionaveis da secao anteriores mantidos."),
          li("Respawn em 0.5s — nao penaliza o jogador com tela de Game Over."),
          callout(
            "design-decision",
            "Respawn rapido (<1s) e regra ouro do platformer moderno: penalizacao por tempo mata engagement. Celeste e Super Meat Boy consagraram o padrao."
          ),
          callout(
            "warning",
            "Checkpoint denso demais vira chato (tira tensao). Denso de menos vira frustrante. Monitore em playtest: taxa de desistencia em secao = checkpoint mal colocado."
          ),
        ]
      ),
      narrative(
        "plat-medio-enemies",
        "Inimigos e Obstaculos",
        "Catalogo de ameacas em Spark the Fox.",
        [
          h("Inimigos e Obstaculos", 2),
          h("Inimigos (mundos)", 3),
          li("Mundo 1 (Floresta Verdejante) — cogumelos saltadores, velozes mas previsiveis."),
          li("Mundo 2 (Cavernas Azuis) — morcegos que seguem Spark em padrao senoidal."),
          li("Mundo 3 (Deserto Laranja) — escorpioes que atiram areia em arco."),
          h("Obstaculos", 3),
          li("Espinhos — morte instantanea, sempre vermelhos."),
          li("Plataformas moveis — amarelas, padrão previsivel."),
          li("Agua — morte instantanea ate mundo 4 onde Spark aprende a nadar."),
          callout(
            "design-decision",
            "Regra: cada mundo apresenta 1-2 inimigos NOVOS, mas nao mais que 3 tipos ao mesmo tempo na tela. Mantem leitura visual clara."
          ),
        ]
      ),
      narrative(
        "plat-medio-recompensas",
        "Recompensas e Colecionaveis",
        "O que Spark coleta e por que.",
        [
          h("Recompensas e Colecionaveis", 2),
          li("Moedas (100 por mundo) — vida extra a cada 100. Totalmente opcional."),
          li("Cristais Estelares (3 por fase, 24 no jogo) — desbloqueiam fases bonus."),
          li("Relicarios de Ember (1 por mundo, 8 no total) — expansao de lore via flashbacks."),
          callout(
            "design-decision",
            "3 tiers de colecionavel (facil/medio/dificil) servem publicos diferentes: casual pega moedas, completionist busca Cristais, hardcore+lore busca Relicarios."
          ),
          callout(
            "warning",
            "Esta pagina e um container. Dentro dela ha um item exemplo (Moeda). Duplique pra criar Cristais, Relicarios e quantos mais o seu jogo precisar."
          ),
        ],
        [
          {
            id: "plat-medio-moeda-exemplo",
            title: "Moeda Estelar",
            content: "Colecionavel basico de Spark the Fox — 100 delas dao vida extra.",
            pageType: {
              id: "items",
              options: {
                richDocBlocks: [
                  h("Moeda Estelar", 2),
                  p(
                    "Moedas brilhantes espalhadas por todas as fases. 100 moedas coletadas dao uma vida extra. Elas nao sao necessarias pra clear o jogo — sao recompensa de exploracao."
                  ),
                  li("100 unidades por mundo = 800 no jogo."),
                  li("Coletar todas desbloqueia skin dourada de Spark."),
                  callout(
                    "note",
                    "Esta pagina ja vem com Inventario e Economia configurados. Ajuste preco/quantidades no painel lateral."
                  ),
                  callout(
                    "design-decision",
                    "Colecionavel NAO obrigatorio e classico do platformer: serve o completionist sem frustrar o casual."
                  ),
                  callout(
                    "warning",
                    "Duplique esta pagina pra criar os outros colecionaveis (Cristais, Relicarios) — cada um com sua mecanica e raridade."
                  ),
                ],
              },
            },
          },
        ]
      ),
    ],
    completo: [
      narrative(
        "plat-completo-visao-geral",
        "Visao Geral — Spark the Fox",
        "Pitch, USP completos do jogo de exemplo.",
        [
          h("Visao Geral — Spark the Fox", 2),
          p(
            "Platformer 2D cute-dark. Spark, raposinha laranja, corre por 8 mundos coloridos atras de Ember (irma) sequestrada pelo Rei das Sombras. Foco em timing preciso, level design ensinante, trilha sonora dinamica. Publico: 8-35 anos, fas de Celeste, Mario, Rayman."
          ),
          h("USP", 3),
          li("Uma mecanica nova por mundo — progressao de habilidade, nao de numero."),
          li("Modo speedrun com leaderboards e ghost data de outros players."),
          li("Trilha sonora adaptativa (intensidade varia com pace do jogador)."),
          li("Modo assist opcional pra acessibilidade (mais dash, dano reduzido, etc.)."),
          callout(
            "warning",
            "Conteudo ficticio — substitua Spark e Ember pelos elementos do SEU jogo."
          ),
        ]
      ),
      narrative(
        "plat-completo-movimento",
        "Sistema de Movimento Avancado",
        "Modelo tecnico completo do pulo e corrida de Spark.",
        [
          h("Sistema de Movimento", 2),
          p(
            "Movimento em Spark e tunado pra \"sentir certo\" antes de medir certo. Numeros aqui sao pontos de partida — playtest dita a realidade."
          ),
        ],
        [
          narrative(
            "plat-completo-params",
            "Parametros de Movimento",
            "Valores tecnicos ajustaveis de Spark.",
            [
              h("Parametros", 2),
              li("Velocidade: 6 u/s."),
              li("Aceleracao: 20 u/s² (0-6 em 0.3s)."),
              li("Freada: 40 u/s² (6-0 em 0.15s)."),
              li("Gravidade: 18 u/s² (subindo). 27 u/s² (caindo — 50% a mais)."),
              li("Pulo: velocidade inicial 10 u/s. Altura maxima 3.5u."),
              li("Curva de input: dead zone 0.1, response quadratico 0.1-0.9, linear acima."),
              callout(
                "design-decision",
                "Gravidade assimetrica (cai mais rapido que sobe) faz pulo sentir weight sem perder responsividade. Classico de plataformers modernos."
              ),
              callout(
                "balance-note",
                "Nao altere estes numeros isoladamente. Cada um afeta os outros: aumentar velocidade sem aumentar freada cria \"slippery\" feel."
              ),
            ]
          ),
          narrative(
            "plat-completo-assists",
            "Assistencias",
            "Features que escondem o erro e modos de acessibilidade.",
            [
              h("Assistencias", 2),
              h("Invisiveis (sempre ativas)", 3),
              li("Coyote time: 0.1s."),
              li("Jump buffer: 0.15s."),
              li("Edge forgiveness: empurra 0.2u pra seguranca em bordas."),
              li("Corner correction: se bater canto da cabeca, empurra pro lado."),
              h("Modo Assist (opcional)", 3),
              li("Slow motion em secoes dificeis (ate 50%)."),
              li("Invulneravel a espinhos (mantem desafio de layout)."),
              li("Dash ilimitado."),
              callout(
                "design-decision",
                "Modo assist nao penaliza conquistas nem leaderboards — escolha pessoal do jogador sobre como se divertir. Celeste consagrou o padrao."
              ),
            ]
          ),
        ]
      ),
      narrative(
        "plat-completo-level-architecture",
        "Arquitetura de Fases",
        "Blueprint de fase com onboarding, combinacao e mastery.",
        [
          h("Arquitetura de Fase", 2),
          p(
            "Cada fase de Spark segue 4 fases internas de pacing, cada uma com objetivo cognitivo claro."
          ),
          li("Intro (30s) — apresenta mecanica em ambiente seguro."),
          li("Desenvolvimento (1-2min) — combina com mecanicas anteriores."),
          li("Pico (30-45s) — exige mastery da nova mecanica."),
          li("Conclusao (15s) — trecho celebratorio de baixa tensao."),
          callout(
            "design-decision",
            "Padrao vindo do Mario 3D World / Donkey Kong Country: respeita o ritmo cognitivo do jogador — nao deixa ele em tensao continua (cansativo) nem em descanso continuo (enfadonho)."
          ),
        ]
      ),
      narrative(
        "plat-completo-curva",
        "Curva de Dificuldade e Pacing",
        "Como a dificuldade cresce ao longo de Spark the Fox.",
        [
          h("Curva de Dificuldade", 2),
          p(
            "Entre mundos, dificuldade sobe em steps (nao rampa). Primeira fase de mundo novo e sempre mais facil que ultima do mundo anterior — respiro pra absorver nova mecanica."
          ),
          li("Mundo 1: tutorial. Cada fase mais dificil que a anterior."),
          li("Mundo 2: reseta com fases faceis no comeco. Pico no final."),
          li("... padrao se repete ate Mundo 8."),
          li("Fases bonus: dificuldade propria, entre \"mundo atual\" e \"mundo +1\"."),
          callout(
            "balance-note",
            "Taxa de desistencia por fase: alvo abaixo de 20% pra fases normais. Acima de 40% = fase mal calibrada."
          ),
        ]
      ),
      {
        id: "plat-completo-atributos",
        title: "Atributos do Jogador",
        content: "HP + Speed + Jump Height de Spark, com notas de balanceamento.",
        pageType: {
          id: "attributeDefinitions",
          options: {
            attributeDefinitionsOverrides: {
              attributes: [
                { key: "hp", label: "HP", valueType: "int", defaultValue: 3, min: 0 },
                { key: "spd", label: "Speed", valueType: "float", defaultValue: 1.0, min: 0 },
                { key: "jump", label: "Jump Height", valueType: "float", defaultValue: 1.5, min: 0 },
              ],
            },
            richDocBlocks: [
              h("Atributos do Jogador — Detalhe", 2),
              p(
                "Spark tem 3 atributos minimalistas. Aqui detalhamos interacao com itens, power-ups e modo assist."
              ),
              h("HP", 3),
              li("Default: 3."),
              li("Power-up \"Coracao\" aumenta HP max em +1 (permanente)."),
              li("Modo Assist: HP inicial 5 (invisivel no tracking)."),
              h("Speed", 3),
              li("Default: 1.0 (6 unidades/seg absoluto)."),
              li("Multiplicado por power-up \"Bota Veloz\" (×1.3, temporario)."),
              li("Multiplicado por terreno (gelo ×1.5, areia ×0.7)."),
              h("Jump Height", 3),
              li("Default: 1.5 (3.5 unidades de altura)."),
              li("Power-up \"Super Pulo\" (×1.2, permanente)."),
              li("Power-up \"Double Jump\" desbloqueia pulo extra no ar (nao afeta altura)."),
              callout(
                "design-decision",
                "Atributos multiplicativos sao compostos em ordem: base × power-up × terreno. Isso torna math previsivel: final = base × todos multiplicadores."
              ),
              callout(
                "balance-note",
                "Speed × Jump Height conjunta define GAP maximo que Spark consegue atravessar. Alterar um SEM ajustar o outro quebra level design das fases existentes."
              ),
              callout(
                "warning",
                "Em fases de boss, alguns atributos sao OVERRIDEN (ex: speed fixo no boss pra consistencia). Documente excecoes por fase."
              ),
            ],
          },
        },
      },
      narrative(
        "plat-completo-combate",
        "Combate (se aplicavel)",
        "Combate simples em Spark the Fox.",
        [
          h("Combate", 2),
          p(
            "Spark nao ataca diretamente. Derrota inimigos pulando em cima (Mario-style). Alguns inimigos sao invencíveis por cima (espinhos nas costas): exigem dash lateral ou desvio."
          ),
          li("Inimigo comum: 1 pulo = derrotado. Da moeda extra."),
          li("Inimigo blindado: 3 dashes laterais = derrotado."),
          li("Spark leva dano: perde uma vida (respawn no checkpoint)."),
          callout(
            "design-decision",
            "Combate minimalista e proposital: platformer deve ser sobre pulo, nao sobre armas. Combate serve pra adicionar variedade sem competir com movimento."
          ),
          callout(
            "warning",
            "Se seu platformer tem combate rico (Hollow Knight), apague esta secao e escreva um modelo proprio."
          ),
        ]
      ),
      narrative(
        "plat-completo-bosses",
        "Boss Fights",
        "Design dos bosses de Spark the Fox.",
        [
          h("Boss Fights", 2),
          p(
            "Cada mundo (8) termina com boss. Bosses tem 3 fases, cada uma com padrao visual distinto. Uma batalha demora 2-3min se o jogador dominou a mecanica daquele mundo."
          ),
          h("Estrutura padrao", 3),
          li("Fase 1 — padrão lento, 2 ataques, ensina a leitura."),
          li("Fase 2 — acrescenta 1 ataque, aumenta velocidade."),
          li("Fase 3 — rage mode. Combinacoes de todos os ataques, sem pausa entre eles."),
          callout(
            "design-decision",
            "Boss usa as mecanicas DAQUELE mundo especificamente: se Mundo 3 introduziu dash, boss 3 exige dash pra esquivar. Isso valida o aprendizado."
          ),
          callout(
            "balance-note",
            "Tempo alvo de clear do boss apos primeira vitoria: 2-3min. Se e 5min+, o boss e boring (arrastado). Se e <1min, e trivial."
          ),
        ]
      ),
      {
        id: "plat-completo-colecionaveis",
        title: "Economia de Colecionaveis",
        content: "Moedas + Cristais + Relicarios em Spark the Fox.",
        pageType: {
          id: "economy",
          options: {
            richDocBlocks: [
              h("Economia de Colecionaveis", 2),
              p(
                "Spark tem 3 moedas/colecionaveis, cada um com publico diferente."
              ),
              h("Moedas Estelares", 3),
              li("100 por mundo, 800 no jogo total."),
              li("100 moedas = 1 vida extra."),
              li("Publico: casual. Nao obrigatorio."),
              h("Cristais Estelares", 3),
              li("3 por fase, 24 total. Um e obvio; dois sao escondidos."),
              li("10 Cristais desbloqueiam fase bonus."),
              li("Publico: completionist."),
              h("Relicarios de Ember", 3),
              li("1 por mundo, 8 total. Bem escondidos."),
              li("Cada um expande lore via flashback de 30s."),
              li("Publico: fa de narrativa e hardcore."),
              callout(
                "design-decision",
                "3 tiers atende 3 publicos distintos sem precisar de 3 jogos diferentes. Moedas atendem o casual, Cristais o completionist, Relicarios o lore hunter."
              ),
              callout(
                "warning",
                "Platformer com UM unico colecionavel (ex: so moedas) atende um publico so. Multiplicar e barato (e design, nao arte) e amplia enormemente rejogabilidade."
              ),
            ],
          },
        },
      },
      narrative(
        "plat-completo-qa",
        "Playtest de Sensacao de Controle",
        "Plano de teste focado em feel de Spark the Fox.",
        [
          h("Plano de Playtest", 2),
          li("Teste alpha com 5-10 jogadores de cada perfil (casual, medio, hardcore)."),
          li("Meta: gravar reacao facial + input. Pulo perdido = investigar se foi erro do jogador ou se tunning estava errado."),
          li("Questao critica: \"Em algum momento voce sentiu que o pulo \'traiu\' voce?\""),
          callout(
            "design-decision",
            "\"Trair\" e a palavra chave. Morte por erro do jogador e aceitavel. Morte por controle e feedback loop quebrado."
          ),
          callout(
            "balance-note",
            "Se 3+ jogadores distintos reclamam do mesmo obstaculo/mecanica, nao e skill issue — e tuning."
          ),
        ]
      ),
    ],
  },
  puzzle: {
    mini: [
      narrative(
        "puzzle-mini-visao-geral",
        "Visao Geral — Spectra",
        "Pitch curto do jogo de exemplo.",
        [
          h("Visao Geral — Spectra", 2),
          p(
            "Spectra e um puzzle minimalista de combinar cores. Cada fase e uma grade com prismas coloridos. O jogador conecta prismas da mesma familia (vermelho/laranja, azul/verde) por caminhos curtos pra gerar luz branca e clear a fase."
          ),
          callout(
            "warning",
            "Exemplo ficticio. Substitua Spectra e prismas pelos elementos do SEU puzzle."
          ),
        ]
      ),
      narrative(
        "puzzle-mini-regras",
        "Regras do Puzzle",
        "Regras basicas de Spectra.",
        [
          h("Regras", 2),
          li("Grade de 5×5 ate 8×8 celulas."),
          li("Cada celula contem 0 ou 1 prisma."),
          li("Jogador desenha caminhos conectando prismas de cores COMPATIVEIS (lista definida)."),
          li("Caminho nao pode cruzar outro caminho."),
          li("Fase e vencida quando todos os prismas estao conectados."),
          li("Nao ha perda — puzzle permite retry infinito."),
          callout(
            "design-decision",
            "Ausencia de \"perda\" (vs game over) e intencional em puzzle: o desafio e mental, nao temporal. Pressao arruinaria a experiencia."
          ),
        ]
      ),
      narrative(
        "puzzle-mini-fases",
        "Progressao de Fases",
        "Como fases ensinam em Spectra.",
        [
          h("Progressao de Fases", 2),
          p(
            "Cada set de 5 fases introduz UMA mecanica nova (ex: prismas bloqueadores, cores exclusivas, espelhos). A quinta fase de cada set testa mastery."
          ),
          callout(
            "design-decision",
            "1 mecanica por set mantem carga cognitiva gerenciavel. Introduzir 2 mecanicas simultaneas confunde o jogador sobre qual e o teste."
          ),
        ]
      ),
      narrative(
        "puzzle-mini-feedback",
        "Feedback",
        "Feedback visual e sonoro em Spectra.",
        [
          h("Feedback", 2),
          li("Conectar prismas: som suave de chime + brilho na linha."),
          li("Conexao incorreta: linha pisca vermelho, volta ao estado anterior."),
          li("Fase vencida: todos os prismas pulsam em unisono + som satisfatorio + transicao lenta."),
          callout(
            "design-decision",
            "Erro \"gentil\" (volta ao estado anterior) em vez de game over: puzzle e iterativo. Punir erro mata experimentacao."
          ),
        ]
      ),
    ],
    medio: [
      narrative(
        "puzzle-medio-visao-geral",
        "Visao Geral — Spectra",
        "Pitch, USP do jogo de exemplo.",
        [
          h("Visao Geral — Spectra", 2),
          p(
            "Puzzle mobile/PC minimalista de combinar cores. Grade de prismas; jogador traca caminhos pra conectar cores compativeis. Foco em 100 fases handcrafted + geracao procedural pos-clear. Trilha sonora ambient evolui com progresso."
          ),
          h("USP", 3),
          li("Solver de referencia que prova que cada fase tem pelo menos UMA solucao."),
          li("Sistema de hints gradual (3 niveis) sem punicao."),
          li("Geracao procedural pos-clear usando o solver pra validar."),
          callout(
            "design-decision",
            "Solver de referencia e o que separa puzzle de qualidade (Baba Is You, Monument Valley) de puzzle \"duvidoso\": toda fase e GARANTIDA solvavel."
          ),
          callout(
            "warning",
            "Ficticio. Substitua Spectra pelos elementos do SEU puzzle."
          ),
        ]
      ),
      narrative(
        "puzzle-medio-regras-formais",
        "Regras Formais",
        "Definicao matematica das regras de Spectra.",
        [
          h("Regras Formais", 2),
          p(
            "Fase e uma grade G(m, n) com subset P ⊂ G de celulas com prismas. Cada prisma tem cor c ∈ {V, L, A, E, R, I} (vermelho, laranja, azul, esmeralda, roxo, indigo)."
          ),
          h("Operacoes Permitidas", 3),
          li("Tracar caminho T entre prismas p1 e p2 tal que cor(p1) e compativel com cor(p2)."),
          li("Caminhos so andam ortogonalmente (sem diagonais)."),
          li("Caminho nao pode se cruzar com outro caminho."),
          h("Condicao de Solucao", 3),
          p(
            "Fase clear quando todo prisma P tem exatamente UM caminho conectado a ele, e todos os caminhos sao validos (cores compativeis)."
          ),
          callout(
            "design-decision",
            "Definir regras formalmente (com variaveis matematicas) permite escrever o solver. Sem isso, puzzle vira adivinhacao de design."
          ),
          callout(
            "warning",
            "Se seu puzzle tem regras dificeis de formalizar, ele tambem vai ser dificil de balancear. Forca a definicao antes de construir."
          ),
        ]
      ),
      narrative(
        "puzzle-medio-taxonomia",
        "Taxonomia de Puzzles",
        "Tipos de puzzle em Spectra por habilidade cognitiva.",
        [
          h("Taxonomia", 2),
          p("Os 100 puzzles de Spectra se dividem em 4 tipos cognitivos:"),
          li("Planejamento (planejar sequencia de conexoes antes de desenhar) — 40 fases."),
          li("Reconhecimento (ver padrao visual que sugere solucao) — 25 fases."),
          li("Tentativa e erro controlado (experimento com espaco pequeno) — 20 fases."),
          li("Lateral (solucao nao-obvia, \"aha moment\") — 15 fases."),
          callout(
            "design-decision",
            "Misturar tipos mantem variedade cognitiva. Jogo de so-planejamento cansa; so-lateral frustra."
          ),
        ]
      ),
      narrative(
        "puzzle-medio-onboarding",
        "Onboarding Pedagogico",
        "Como Spectra ensina sem texto.",
        [
          h("Onboarding sem texto", 2),
          p(
            "As 10 primeiras fases de Spectra ensinam mecanicas pela forma como sao construidas — sem tutorial em texto. O jogador so pode avancar se entendeu."
          ),
          li("Fase 1: 2 prismas da mesma cor. Solucao obvia ensina \"tracar caminho\"."),
          li("Fase 2: 4 prismas em 2 pares. Ensina \"conectar multiplos\"."),
          li("Fase 3: adiciona obstaculo simples (celula vazia bloqueia). Ensina \"caminho desvia\"."),
          li("... ate Fase 10: todas as regras basicas foram aprendidas pelo jogar."),
          callout(
            "design-decision",
            "Ensinar por design e mais efetivo que ensinar por texto. Tutorial de texto e lido passivamente; fase ensinante e exercitada ativamente."
          ),
          callout(
            "balance-note",
            "Alvo: 95% dos jogadores devem concluir as 10 primeiras fases em <20 minutos. Se demora mais, onboarding falhou e precisa simplificar."
          ),
        ]
      ),
      narrative(
        "puzzle-medio-dicas",
        "Sistema de Dicas",
        "Hints graduais em Spectra.",
        [
          h("Sistema de Hints", 2),
          p(
            "Jogador pode pedir hint em qualquer fase. Cada fase tem 3 niveis de hint, revelados progressivamente."
          ),
          li("Hint 1 — destaca UM prisma da solucao (dica visual sutil)."),
          li("Hint 2 — mostra o PRIMEIRO segmento do caminho correto."),
          li("Hint 3 — revela a solucao completa (jogador pode tracar manualmente ou aceitar solve automatico)."),
          callout(
            "design-decision",
            "Hints sem penalizacao respeitam o jogador casual. Se hint custa coisa, jogadores travam sem avancar — o pior resultado pra um puzzle."
          ),
        ]
      ),
      narrative(
        "puzzle-medio-telemetria",
        "Telemetria de Dificuldade",
        "O que medir em playtest de Spectra.",
        [
          h("Telemetria", 2),
          li("Tempo ate primeira solucao — alvo: 30s (facil), 2min (medio), 5min (dificil)."),
          li("Numero de tentativas antes de clear — alvo: <10 por fase."),
          li("Taxa de uso de hint — alvo: <30% dos jogadores em fase bem calibrada."),
          li("Taxa de desistencia — alvo: <5% por fase. Acima: fase quebrada."),
          callout(
            "design-decision",
            "Puzzle bem calibrado tem \"aha moment\" em 1-3 tentativas. Se demora 10+, a pista visual esta ruim. Se eh < 3 segundos, e facil demais."
          ),
        ]
      ),
    ],
    completo: [
      narrative(
        "puzzle-completo-visao-geral",
        "Visao Geral — Spectra",
        "Pitch, USP e publico completos.",
        [
          h("Visao Geral — Spectra", 2),
          p(
            "Puzzle premium mobile/PC com 100 fases handcrafted + geracao procedural pos-clear + modo daily challenge. Estetica minimalista (geometrica, cores quentes), trilha ambient. Publico: 25-50 anos, fans de Monument Valley, The Witness, Baba Is You."
          ),
          h("USP", 3),
          li("Solver de referencia: toda fase procedural GARANTIDA solvavel."),
          li("Hints graduais sem penalizacao (3 niveis)."),
          li("Daily Challenge com leaderboards."),
          li("Zero iAP — premium one-time."),
          callout(
            "warning",
            "Ficticio. Substitua Spectra pelo seu puzzle."
          ),
        ]
      ),
      narrative(
        "puzzle-completo-modelo",
        "Modelo Formal do Puzzle",
        "Representacao formal de Spectra pra solver.",
        [
          h("Modelo Formal", 2),
          p(
            "Grade G com celulas. Prismas P com cor c. Caminho T e sequencia de celulas adjacentes ortogonais. Solucao S = conjunto de caminhos que conecta todos os P com cores compativeis sem cruzamento."
          ),
        ],
        [
          narrative(
            "puzzle-completo-solver",
            "Solver de Referencia",
            "Como o solver valida fases de Spectra.",
            [
              h("Solver", 2),
              p(
                "Implementacao BFS com backtracking. Para cada par de prismas compativeis, busca caminho mais curto; tenta todas as combinacoes de pareamento; retorna true/false e numero de solucoes."
              ),
              li("Tempo alvo: solver termina em <500ms pra fase 8×8."),
              li("Detecta fases \"triviais\" (uma unica solucao facil): rejeita pra curadoria."),
              li("Detecta fases \"ambiguas\" (mais de 1 solucao): marca pra review."),
              callout(
                "design-decision",
                "Solver nao aceita fases com 1 ou 100+ solucoes. 1 = muito restrita (player frustra). 100+ = solucao obvia (player acha sem pensar)."
              ),
              callout(
                "warning",
                "Solver e investimento pesado de engenharia no comeco mas salva tempo de design depois: voce pode gerar 1000 fases em vez de desenhar 100."
              ),
            ]
          ),
          narrative(
            "puzzle-completo-geracao",
            "Geracao de Conteudo",
            "Como fases sao geradas procedualmente em Spectra.",
            [
              h("Geracao Procedural", 2),
              p(
                "Gerador escolhe: tamanho (5-8), numero de prismas (4-12), distribuicao de cores. Aplica solver pra validar. Rejeita se: trivial, sem solucao, ou multiplas solucoes faceis."
              ),
              li("Taxa de aceitacao: ~15% (8 de cada 10 geradas sao rejeitadas)."),
              li("Tempo por fase aceita: 5-10 segundos (maior no 8×8)."),
              li("Fases geradas taggeadas por tipo cognitivo (planejamento, lateral, etc.)."),
              callout(
                "design-decision",
                "Taxa de aceitacao baixa (15%) e sinal de que o solver esta rigoroso. Se fosse 80%, o gerador estaria aceitando lixo."
              ),
            ]
          ),
        ]
      ),
      narrative(
        "puzzle-completo-curva",
        "Curva de Dificuldade",
        "Dificuldade por capitulo em Spectra.",
        [
          h("Curva de Dificuldade", 2),
          p(
            "10 capitulos × 10 fases = 100 handcrafted. Dentro do capitulo: 3 faceis, 5 medias, 2 dificeis. Entre capitulos: nova mecanica introduzida."
          ),
          li("Capitulo 1-3: ensino. Mecanica basicas."),
          li("Capitulo 4-7: combinacao. Misturar mecanicas ja ensinadas."),
          li("Capitulo 8-10: mastery. Fases \"aha moment\" que exigem insight lateral."),
          callout(
            "balance-note",
            "Primeiros 3 capitulos precisam ter taxa de abandono <2%. Se mais, player novo bate de frente com dificuldade e desiste."
          ),
        ]
      ),
      narrative(
        "puzzle-completo-onboarding",
        "Onboarding e Tutoriais",
        "Como Spectra ensina sem texto.",
        [
          h("Onboarding Silencioso", 2),
          p(
            "Nenhum texto explicativo nas primeiras 15 fases. Mecanicas sao ensinadas pela construcao da fase — jogador ou entende e avanca, ou nao entende e nao avanca."
          ),
          li("Fase 1-5: conectar 2-4 prismas de mesma cor."),
          li("Fase 6-10: introduz cores compativeis (laranja = vermelho+amarelo)."),
          li("Fase 11-15: obstaculos estaticos."),
          callout(
            "design-decision",
            "Onboarding silencioso respeita inteligencia do jogador e funciona melhor que tutorial textual em qualquer idioma (Monument Valley e prova)."
          ),
        ]
      ),
      narrative(
        "puzzle-completo-hints",
        "Sistema de Hints e Recuperacao",
        "Hints graduais, undo, reset e antitrava.",
        [
          h("Hints e Recuperacao", 2),
          h("Hints (3 niveis, sem penalidade)", 3),
          li("Hint 1 — destaca um prisma da solucao."),
          li("Hint 2 — mostra primeiro segmento do caminho."),
          li("Hint 3 — revela solucao completa, jogador pode aceitar solve."),
          h("Recuperacao", 3),
          li("Undo ilimitado."),
          li("Reset rapido (botao, 1 clique, sem confirmacao)."),
          li("Skip fase: desbloqueado apos 10min de frustracao numa fase. Skip nao marca como clear — fica opcional voltar."),
          callout(
            "design-decision",
            "Skip apos 10min e auto-antitrava: evita que o jogador abandone o JOGO por causa de UMA fase quebrada."
          ),
        ]
      ),
      narrative(
        "puzzle-completo-ui",
        "UI Cognitiva",
        "Hierarquia visual e minimizacao de ruido em Spectra.",
        [
          h("UI Cognitiva", 2),
          li("Grade sempre centralizada, com padding igual em todos os lados."),
          li("Prismas sempre mesma escala (16% do tamanho da celula)."),
          li("Caminhos tracados em cor neutra (cinza claro) pra nao competir com cor dos prismas."),
          li("Fundo estatico (sem animacao de fundo que tire atencao)."),
          callout(
            "design-decision",
            "Minimizar ruido visual nao e so estetica — e funcao. Puzzle exige foco. Elementos decorativos competem com o raciocinio."
          ),
        ]
      ),
      narrative(
        "puzzle-completo-analytics",
        "Analytics de Qualidade",
        "Matriz de friccao em Spectra.",
        [
          h("Analytics", 2),
          p(
            "Captura por fase: tempo ate clear, numero de tentativas, uso de hint, taxa de skip, taxa de retorno (jogou fase X, voltou ao menu, jogou de novo?)."
          ),
          h("Sinalizadores de Fase Quebrada", 3),
          li("Taxa de skip > 10%: fase muito dificil ou pista ruim."),
          li("Uso de hint 3 > 40%: solucao nao-obvia o suficiente."),
          li("Taxa de retorno > 5%: jogador desiste no meio da sessao."),
          callout(
            "balance-note",
            "Uma vez por mes, rode matriz de friccao pra identificar top 10 fases problematicas. Nao tente consertar todas — foque nas 3 piores."
          ),
        ]
      ),
      narrative(
        "puzzle-completo-conteudo",
        "Plano de Conteudo",
        "Expansao pos-lancamento de Spectra.",
        [
          h("Plano de Conteudo", 2),
          li("Lancamento: 100 fases handcrafted + modo procedural infinito."),
          li("Mes 1 pos-lancamento: Daily Challenge (1 fase nova por dia)."),
          li("Mes 3: DLC tematica (gelo, fogo, espelho) — nova mecanica em 20 fases."),
          li("Mes 6: Comunity packs (fases criadas pelos jogadores, validadas pelo solver)."),
          callout(
            "design-decision",
            "Community packs usam o MESMO solver — validacao automatizada. Sem isso, moderacao manual seria inviavel."
          ),
          callout(
            "warning",
            "Plano de conteudo pos-lancamento e importante desde o design inicial: alguns sistemas (validacao automatizada) precisam existir no core pra expansoes serem viaveis depois."
          ),
        ]
      ),
    ],
  },
  simulation: {
    mini: [
      narrative(
        "sim-mini-visao-geral",
        "Visao Geral — Harbor Town",
        "Pitch curto do jogo de exemplo.",
        [
          h("Visao Geral — Harbor Town", 2),
          p(
            "Harbor Town e um jogo de gestao de vila portuaria. Voce administra uma pequena cidade na costa: recebe caravanas com recursos brutos, transforma em mercadorias na cidade, e envia barcos pro mar vender o que produziu. Cresce gradual de 20 habitantes pra 500+."
          ),
          callout(
            "warning",
            "Ficticio. Substitua Harbor Town pelos elementos do SEU jogo de simulacao."
          ),
        ]
      ),
      narrative(
        "sim-mini-loop",
        "Loop de Gestao",
        "O ciclo principal de Harbor Town.",
        [
          h("Loop Principal", 2),
          li("Caravanas chegam (a cada 5min, trazem recursos brutos)."),
          li("Trabalhadores transformam (madeira → tabua; ferro → ferramentas)."),
          li("Barcos distribuem (leva mercadorias pro mar, trazem ouro)."),
          li("Ouro reinveste (contrata mais trabalhadores, melhora workshops)."),
          callout(
            "design-decision",
            "Loop e sempre 4 passos: coletar, transformar, distribuir, reinvestir. Se faltar um, jogo vira \"acumular e nao fazer nada\" ou \"fazer e nao progredir\"."
          ),
        ]
      ),
      narrative(
        "sim-mini-recursos",
        "Recursos",
        "Recursos primarios de Harbor Town.",
        [
          h("Recursos", 2),
          h("Brutos (caravanas)", 3),
          li("Madeira, Pedra, Ferro."),
          h("Processados (workshops)", 3),
          li("Tabua (madeira), Tijolo (pedra), Ferramenta (ferro)."),
          h("Mercadorias (exportacao)", 3),
          li("Moveis (tabua+ferramenta), Construcao (tijolo+ferramenta), Armas (ferramenta+ferramenta)."),
          callout(
            "design-decision",
            "Cada mercadoria requer 2+ recursos diferentes. Isso cria interdependencia e impede \"especializar em um so\"."
          ),
        ]
      ),
      narrative(
        "sim-mini-progressao",
        "Progressao",
        "Como Harbor Town cresce.",
        [
          h("Progressao", 2),
          li("Marco 1 (50 habitantes): desbloqueia 2o tipo de workshop."),
          li("Marco 2 (100 habitantes): desbloqueia porto maior (mais barcos)."),
          li("Marco 3 (250 habitantes): desbloqueia banco (emprestimos)."),
          li("Marco 4 (500 habitantes): endgame — exportacao para capital real do reino."),
          callout(
            "design-decision",
            "Marcos por populacao (nao tempo) — recompensa o jogador que expande, nao o que espera."
          ),
        ]
      ),
    ],
    medio: [
      narrative(
        "sim-medio-visao-geral",
        "Visao Geral — Harbor Town",
        "Pitch, USP do jogo de exemplo.",
        [
          h("Visao Geral — Harbor Town", 2),
          p(
            "Sim de gestao de vila portuaria. Voce comeca com 20 habitantes e expande ate 500+. Recebe caravanas com recursos, transforma em mercadorias, exporta via barcos. Eventos dinamicos (tempestade, praga, festival) forcam adaptacao."
          ),
          h("USP", 3),
          li("Cadeias de producao interdependentes (cada mercadoria precisa de 2+ workshops)."),
          li("Eventos dinamicos contextuais (nao aleatorios puros — baseados em situacao da vila)."),
          li("Modo sandbox + Modo campanha (10 cenarios com objetivos)."),
          callout(
            "design-decision",
            "Eventos contextuais em vez de totalmente aleatorios: se a vila esta dependente de pesca, \"seca\" e pouco impactante mas \"tempestade\" e catastrofe. Isso torna cada vila unica."
          ),
          callout(
            "warning",
            "Ficticio — substitua Harbor Town pelos elementos do SEU sim."
          ),
        ]
      ),
      narrative(
        "sim-medio-cadeias",
        "Cadeias de Producao",
        "Cadeias de valor e dependencias em Harbor Town.",
        [
          h("Cadeias de Producao", 2),
          p(
            "Harbor Town tem 3 tipos de trabalhadores (Lenhador, Ferreiro, Marinheiro) e 4 workshops (Carpintaria, Forja, Estaleiro, Mercado). Mercadorias finais precisam de 2+ workshops — cria interdependencia."
          ),
          h("Fluxos Tipicos", 3),
          li("Madeira bruta → Carpintaria (Lenhador) → Tabua."),
          li("Tabua + Prego → Forja (Ferreiro) → Moveis."),
          li("Moveis → Mercado → venda externa (ouro)."),
          callout(
            "design-decision",
            "Cadeias longas (3-4 passos) em vez de curtas (1-2) sao proposital: cria gargalos interessantes. Se tudo fosse \"1 passo\", nao haveria decisao de onde alocar trabalhadores."
          ),
          callout(
            "balance-note",
            "Cuidado com upstream bottlenecks. Se Lenhador e sempre o gargalo, jogo vira \"spam de Lenhador\". Balanceie pra que cada trabalhador tenha pico de demanda em momentos diferentes."
          ),
        ],
        [
          {
            id: "sim-medio-carpintaria",
            title: "Carpintaria",
            content: "Workshop de exemplo de Harbor Town — agrupa receitas de madeira.",
            pageType: {
              id: "craftTable",
              options: {
                richDocBlocks: [
                  h("Carpintaria", 2),
                  p(
                    "Primeiro workshop de Harbor Town. Transforma madeira bruta em tabuas e moveis. Requer 1 Lenhador alocado. Produz uma tabua a cada 20s."
                  ),
                  h("Receitas iniciais", 3),
                  li("Tabua — 2 madeira → 1 tabua (20s)."),
                  li("Barril — 3 tabua → 1 barril (40s)."),
                  li("Movel Simples — 2 tabua + 1 prego → 1 movel (60s)."),
                  callout(
                    "note",
                    "Este craftTable comeca vazio. Crie paginas de Receita no sidebar (Tabua, Barril, Movel) e linke-as aqui pelo addon Mesa de Producao."
                  ),
                  callout(
                    "design-decision",
                    "Tempo de produc ao crescente por complexidade (20s → 40s → 60s) cria decisao: produzir muitos simples ou alguns complexos?"
                  ),
                ],
              },
            },
          },
        ]
      ),
      {
        id: "sim-medio-economia",
        title: "Economia Sistemica",
        content: "Moeda Ouro + sistema de fontes/sinks em Harbor Town.",
        pageType: {
          id: "economy",
          options: {
            richDocBlocks: [
              h("Economia Sistemica — Harbor Town", 2),
              p(
                "Moeda unica: Ouro. Fontes: vendas externas (mercadorias exportadas), impostos coletados. Sinks: salarios, manutencao de workshops, compra de recursos em emergencia."
              ),
              h("Fontes", 3),
              li("Venda de mercadoria via barco: 10-200 ouro."),
              li("Imposto sobre habitantes: 1 ouro por habitante por dia."),
              li("Eventos (ex: festival): 100-500 ouro."),
              h("Sinks", 3),
              li("Salario de trabalhador: 2 ouro/dia."),
              li("Manutencao de workshop: 10 ouro/dia."),
              li("Compra de emergencia (mercadoria com escassez): 5x preco normal."),
              callout(
                "design-decision",
                "Salario > 0 forca o jogador a operar a vila lucrativamente. Trabalhador ocioso custa dinheiro — pressao constante pra otimizar."
              ),
              callout(
                "balance-note",
                "Se o jogador chega a ter ouro ilimitado sem pressao, quebrou. Alvo de \"breathing room\": jogador bem-sucedido tem reserva de 1-3 dias de despesas. Menos vira estressante; mais vira snowball."
              ),
            ],
          },
        },
      },
      narrative(
        "sim-medio-agentes",
        "Agentes e Comportamento",
        "Habitantes de Harbor Town como agentes de IA.",
        [
          h("Agentes — Habitantes", 2),
          p(
            "Cada habitante e um agente independente com estado interno: fome, fadiga, felicidade. Decide a cada tick: ir trabalhar, comer, dormir, reclamar com o prefeito."
          ),
          h("Regras Basicas", 3),
          li("Fome crescente: aos 80%, procura comida. Aos 100%, para de trabalhar."),
          li("Fadiga crescente: aos 70%, produtividade cai 30%. Aos 100%, dorme."),
          li("Felicidade: cresce com bons eventos, cai com escassez, grave cai em evento negativo."),
          li("Felicidade < 30%: habitante ameaca sair da vila (grace period de 3 dias)."),
          callout(
            "design-decision",
            "Agentes independentes (em vez de contador abstrato \"felicidade total\") da vida ao jogo — o jogador pode acompanhar um habitante especifico se quiser."
          ),
          callout(
            "balance-note",
            "Monitore: taxa de saida de habitantes. Alvo: <5% ao dia em vila saudavel. Acima = sistema quebrado em algum lugar (fome? fadiga?)."
          ),
        ]
      ),
      narrative(
        "sim-medio-eventos",
        "Eventos Dinamicos",
        "Eventos de Harbor Town.",
        [
          h("Eventos Dinamicos", 2),
          p(
            "Eventos nao sao aleatorios puros — sao escolhidos com base no estado da vila. Uma vila que depende de pesca tem mais chance de \"tempestade\" que \"seca\". Isso torna cada vila unica."
          ),
          h("Tipos", 3),
          li("Positivos — Festival, Mercador Raro, Boa Colheita."),
          li("Neutros — Visitante Estrangeiro, Pedido Especial."),
          li("Negativos — Tempestade, Praga, Incendio, Escassez."),
          callout(
            "design-decision",
            "Eventos sao escolhidos pelo sistema nao pelo RNG puro. Uma vila que cresceu sem investir em seguranca vai receber \"incendio\" — o evento parece injusto mas e consequencia."
          ),
          callout(
            "warning",
            "Eventos devem SEMPRE ter solucao. Evento que \"so da azar\" frustra. Evento que testa preparacao da vila ensina."
          ),
        ]
      ),
      narrative(
        "sim-medio-ui",
        "UI de Operacao e Telemetria",
        "Indicadores operacionais de Harbor Town.",
        [
          h("UI", 2),
          p(
            "UI de sim precisa balancear \"info completa\" com \"nao sufocar\". Harbor Town usa camadas: overview sempre visivel, detalhes on-demand."
          ),
          h("Sempre Visivel", 3),
          li("Populacao atual / maxima."),
          li("Ouro atual + renda liquida (ultimas 24h)."),
          li("Alertas urgentes (fome, escassez, evento negativo)."),
          h("On-demand", 3),
          li("Graficos de producao (ultimos 7 dias)."),
          li("Lista de habitantes com estado."),
          li("Relatorios de comercio."),
          callout(
            "design-decision",
            "Alertas sao o que tira o jogador do overview pra ir agir. Se voce tem MUITOS alertas o tempo todo, eles ficam invisiveis. Seja seletivo."
          ),
        ]
      ),
    ],
    completo: [
      narrative(
        "sim-completo-visao-geral",
        "Visao Geral — Harbor Town",
        "Pitch, USP, publico completos.",
        [
          h("Visao Geral — Harbor Town", 2),
          p(
            "Sim de gestao portuaria PC. 20 a 500+ habitantes. Cadeias de producao interdependentes, eventos contextuais, modo campanha com 10 cenarios + sandbox. Inspirado em Anno 1800, Banished."
          ),
          h("USP", 3),
          li("Cadeias interdependentes (toda mercadoria exige 2+ workshops)."),
          li("Eventos contextuais (baseados em dependencias da vila)."),
          li("Habitantes como agentes independentes (fome, fadiga, felicidade individuais)."),
          li("Modo campanha narrativo (nao so sandbox)."),
          callout(
            "warning",
            "Ficticio — Harbor Town e exemplo. Substitua pelo SEU sim."
          ),
        ]
      ),
      narrative(
        "sim-completo-modelagem",
        "Modelagem de Sistemas",
        "Como sistemas de Harbor Town sao modelados.",
        [
          h("Modelagem", 2),
          p(
            "Harbor Town modela a vila como sistema de fluxos: recursos entram (caravanas, producao), fluem por workshops (transformacao), saem (exportacao, consumo). Cada no tem capacidade e throughput."
          ),
        ],
        [
          narrative(
            "sim-completo-cadeias",
            "Cadeias de Producao",
            "Detalhes de throughput e bottleneck em Harbor Town.",
            [
              h("Cadeias de Producao", 2),
              p(
                "Cada workshop tem: capacidade maxima, workers alocados, throughput efetivo (capacidade × workers%)."
              ),
              li("Carpintaria max: 10 tabuas/hora. 1 Lenhador: 5/h. 2 Lenhadores: 8/h (diminishing)."),
              li("Forja max: 8 ferramentas/hora. 1 Ferreiro: 4/h. 2 Ferreiros: 7/h."),
              li("Estaleiro max: 2 barcos/mes (producao lenta)."),
              callout(
                "design-decision",
                "Diminishing returns em workers alocados (2 trabalhadores NAO dobram output) forca o jogador a distribuir em vez de concentrar."
              ),
              callout(
                "balance-note",
                "Throughput e a metrica central. Se um workshop sempre tem worker ocioso, throughput esta ok (folga). Se sempre cheio, e gargalo — sinal pra expandir."
              ),
            ],
            [
              {
                id: "sim-completo-carpintaria",
                title: "Carpintaria",
                content: "Workshop de madeira em Harbor Town — exemplo.",
                pageType: {
                  id: "craftTable",
                  options: {
                    richDocBlocks: [
                      h("Carpintaria", 2),
                      p(
                        "Primeiro workshop de Harbor Town. Transforma madeira em tabua, barris, moveis. Tempo varia por complexidade da receita."
                      ),
                      callout(
                        "note",
                        "Este craftTable comeca vazio. Crie paginas de Receita e linke-as aqui."
                      ),
                    ],
                  },
                },
              },
            ]
          ),
          narrative(
            "sim-completo-buffer",
            "Buffers e Capacidade",
            "Estoque, capacidade e gargalos em Harbor Town.",
            [
              h("Buffers e Capacidade", 2),
              li("Armazem central: capacidade inicial 500 unidades. Expansivel."),
              li("Cada workshop tem inventario local: 20 unidades de input + 20 de output."),
              li("Quando inventario local enche, workshop para (worker fica ocioso)."),
              callout(
                "design-decision",
                "Workshops param quando output local enche — NAO escrevem pro armazem automaticamente. Isso cria necessidade de transporte (logistica) e variety de gameplay."
              ),
              callout(
                "balance-note",
                "Tamanho do buffer afeta forte o gameplay. Buffer grande: jogo vira relaxante. Buffer pequeno: constante micro-gerenciamento. Alvo: jogador precisa agir 2-3x por ciclo produtivo."
              ),
            ]
          ),
        ]
      ),
      {
        id: "sim-completo-economia",
        title: "Economia de Simulacao",
        content: "Politica de preco, inflacao e sinks estruturais em Harbor Town.",
        pageType: {
          id: "economy",
          options: {
            richDocBlocks: [
              h("Economia — Harbor Town", 2),
              p(
                "Economia tem Ouro interno (circulacao na vila) + Ouro de exportacao (ganho ao vender pro mercado externo). Precos flutuam com oferta/demanda."
              ),
              h("Precos Dinamicos", 3),
              li("Mercadoria em abundancia: preco cai ate 50% do base."),
              li("Mercadoria escassa: preco sobe ate 200% do base."),
              li("Atualizacao de preco: a cada dia in-game (5min real)."),
              h("Sinks Estruturais", 3),
              li("Salarios (2 ouro por worker/dia)."),
              li("Manutencao de workshops (10 ouro/dia)."),
              li("Impostos do reino (20% de toda exportacao)."),
              li("Eventos (incendio, praga): custos imprevisiveis."),
              callout(
                "design-decision",
                "Sinks estruturais (constantes) + sinks imprevisiveis (eventos) criam tensao: jogador precisa manter reserva pra eventos sem estocar demais (ouro parado nao rende)."
              ),
              callout(
                "balance-note",
                "Cap de ouro util: 500-1000 em reserva e suficiente pra qualquer evento. Mais que isso, jogador deveria estar reinvestindo."
              ),
            ],
          },
        },
      },
      narrative(
        "sim-completo-agentes",
        "Agentes, IA e Comportamentos",
        "Habitantes de Harbor Town como agentes.",
        [
          h("Sistema de Agentes", 2),
          p(
            "Cada habitante e um agente independente com atributos (fome, fadiga, felicidade, skill de trabalho). Decide a cada tick: qual acao priorizar."
          ),
          h("Sistema de Prioridade", 3),
          li("Fome 80%+: buscar comida (override trabalho)."),
          li("Fadiga 90%+: dormir."),
          li("Felicidade <30%: ir a taverna/templo. Nao trabalha."),
          li("Senao: trabalhar no workshop alocado."),
          h("Conflitos", 3),
          li("Dois habitantes querem mesma comida: vai o que tem mais fome."),
          li("Workshop cheio: worker fica ocioso e perde felicidade."),
          li("Greve coletiva: >50% dos habitantes infelizes param tudo por 24h."),
          callout(
            "design-decision",
            "Greve coletiva e feature, nao bug: evita que o jogador ignore felicidade indefinidamente. Cria evento climatico que forca mudanca de estrategia."
          ),
        ]
      ),
      narrative(
        "sim-completo-riscos",
        "Eventos e Gestao de Crise",
        "Eventos contextuais e planos de contingencia.",
        [
          h("Eventos e Crise", 2),
          p(
            "Eventos em Harbor Town sao contextuais — escolhidos com base em vulnerabilidades da vila. Vila sem guarda tem mais chance de \"banditismo\". Vila sem estoque tem mais chance de \"escassez\"."
          ),
          h("Catalogo", 3),
          li("Tempestade (impacto: -30% producao da pesca por 3 dias)."),
          li("Praga (impacto: +50% fome dos habitantes por 5 dias)."),
          li("Banditismo (impacto: rouba 20% do armazem. Preveni vel com Guarda)."),
          li("Festival (impacto positivo: +30% felicidade, +20% produtividade por 3 dias)."),
          callout(
            "design-decision",
            "Evento SEMPRE tem solucao ou mitigacao. Evento \"so da azar\" frustra. Evento que teste preparacao ensina."
          ),
          callout(
            "balance-note",
            "Frequencia de eventos: 1 a cada 5 dias in-game e saudavel. Mais frequente vira caos; menos frequente vira tedio."
          ),
        ]
      ),
      narrative(
        "sim-completo-balance",
        "Balanceamento e Tuning",
        "Metricas e parametros de tuning em Harbor Town.",
        [
          h("Balanceamento", 2),
          h("Metricas Principais", 3),
          li("Tempo medio pra atingir 100 habitantes (alvo: 90-120 min)."),
          li("Taxa de sobrevivencia em evento negativo (alvo: 85%)."),
          li("Razao ouro-gasto/ouro-ganho em steady state (alvo: 0.6-0.8)."),
          h("Parametros Tunaveis", 3),
          li("Custo de workshop (muda a agressividade da expansao)."),
          li("Salario de worker (muda a pressao economica)."),
          li("Taxa de crescimento populacional (muda o pacing geral)."),
          callout(
            "design-decision",
            "Expor estes 3 parametros como sliders in-game transforma \"balanceamento\" em \"modo de dificuldade\". Jogador experiente tuna pra si."
          ),
        ]
      ),
      narrative(
        "sim-completo-ux",
        "UX de Supervisao",
        "Dashboards, alertas e comandos em Harbor Town.",
        [
          h("UX de Supervisao", 2),
          p(
            "Jogo de gestao pede UX diferente de jogo de acao. O jogador precisa VER o sistema inteiro e agir sem micro-management."
          ),
          h("Painel Principal", 3),
          li("Overview da vila: pop, ouro, renda liquida, alertas."),
          li("Mapa: visao de cima dos workshops e habitantes."),
          li("Timeline: ultimos 7 dias de eventos chave."),
          h("Comandos Rapidos", 3),
          li("Pause/Play/Speed 2x/Speed 4x."),
          li("Drill-down em qualquer workshop clicando."),
          li("Alert pinning: ancora um alerta pra nao some ate resolver."),
          callout(
            "design-decision",
            "Speed 4x e essencial em sim: permite pular periodos de rotina. Mas sempre pausavel pra decisao critica."
          ),
        ]
      ),
      narrative(
        "sim-completo-expansao",
        "Expansao de Conteudo",
        "Como Harbor Town evolui pos-lancamento.",
        [
          h("Expansao de Conteudo", 2),
          li("Lancamento: 10 cenarios de campanha + sandbox."),
          li("Mes 3: DLC Comercio Exterior (4 novos cenarios em rotas comerciais)."),
          li("Mes 6: DLC Guerra (sistema militar, defesa, ataques a outras vilas)."),
          li("Mes 12: expansao Colonizacao (criar vilas-satelite)."),
          callout(
            "design-decision",
            "DLCs ADICIONAM sistemas, nao substituem. Jogador que comprou so base continua tendo jogo completo. Essa e a etica dos DLCs Paradox."
          ),
          callout(
            "warning",
            "Plano de conteudo existe desde o design: sistemas novos (militar, colonizacao) precisam de hooks na arquitetura inicial ou viram retrofit doloroso."
          ),
        ]
      ),
    ],
  },
};

const STYLE_EXTRA: Record<WizardStyle, string> = {
  enxuto: "Objetivo: manter esta secao direta, clara e operacional.",
  padrao: "Objetivo: equilibrar contexto, regras e exemplos praticos.",
  profundo: "Objetivo: detalhar criterios, edge cases e metricas de acompanhamento.",
};

const STYLE_EXTRA_I18N: Record<WizardStyle, LocaleText> = {
  enxuto: {
    en: "Goal: keep this section direct, clear and operational.",
    es: "Objetivo: mantener esta sección directa, clara y operacional.",
  },
  padrao: {
    en: "Goal: balance context, rules and practical examples.",
    es: "Objetivo: equilibrar contexto, reglas y ejemplos prácticos.",
  },
  profundo: {
    en: "Goal: detail criteria, edge cases and tracking metrics.",
    es: "Objetivo: detallar criterios, casos límite y métricas de seguimiento.",
  },
};

const GENRE_LABEL: Record<WizardGenre, string> = {
  rpg: "RPG",
  roguelike: "Roguelike",
  platformer: "Platformer",
  puzzle: "Puzzle",
  simulation: "Simulacao",
};

const PLATFORM_LABEL: Record<WizardPlatform, string> = {
  pc: "PC",
  mobile: "Mobile",
  console: "Console",
  web: "Web",
};

const GENRE_LABEL_I18N: Record<WizardGenre, LocaleText> = {
  rpg: { en: "RPG", es: "RPG" },
  roguelike: { en: "Roguelike", es: "Roguelike" },
  platformer: { en: "Platformer", es: "Plataformas" },
  puzzle: { en: "Puzzle", es: "Puzzle" },
  simulation: { en: "Simulation", es: "Simulación" },
};

const PLATFORM_LABEL_I18N: Record<WizardPlatform, LocaleText> = {
  pc: { en: "PC", es: "PC" },
  mobile: { en: "Mobile", es: "Móvil" },
  console: { en: "Console", es: "Consola" },
  web: { en: "Web", es: "Web" },
};

function localizeTemplateText(text: string, locale: AppLocale): string {
  if (locale === "pt-BR") return text;
  const entry = TEMPLATE_TEXT_TRANSLATIONS[text];
  if (!entry) return text;
  return locale === "es" ? entry.es : entry.en;
}

function cloneSection(item: TemplateSection): TemplateSection {
  return {
    ...item,
    subsections: item.subsections?.map(cloneSection),
  };
}

function applyStyleToSection(item: TemplateSection, style: WizardStyle, locale: AppLocale): TemplateSection {
  const suffix =
    locale === "pt-BR" ? STYLE_EXTRA[style] : locale === "es" ? STYLE_EXTRA_I18N[style].es : STYLE_EXTRA_I18N[style].en;
  return {
    ...item,
    title: localizeTemplateText(item.title, locale),
    content: `${localizeTemplateText(item.content, locale)}\n\n${suffix}`,
    subsections: item.subsections?.map((child) => applyStyleToSection(child, style, locale)),
  };
}

/**
 * Arranges common + genre-specific sections into a hierarchy that matches
 * how a professional GDD is typically organized:
 *
 *   1. 📋 Visao Geral (capa)
 *   2. 🎮 Design de Jogo (Core Loop, Mecanicas, Progressao)
 *   3. 📦 Conteudo do Jogo (personagens, itens, combate, narrativa, economia)
 *   4. 🎨 Apresentacao (controles, UX/UI, arte/audio)
 *   5. 🏭 Producao (tecnologia, roadmap, riscos, KPIs, monetizacao, QA)
 *
 * Sections that don't exist in a given scope are quietly skipped, and
 * containers with zero children aren't emitted at all.
 */
function composeSections(scope: WizardScope, genre: WizardGenre): TemplateSection[] {
  const common = COMMON_BY_SCOPE[scope].map(cloneSection);
  const genreSpecific = GENRE_BY_SCOPE[genre][scope].map(cloneSection);

  const findByIdEnd = (sections: TemplateSection[], suffix: string) =>
    sections.find((s) => s.id.endsWith(suffix));
  const findNestedById = (sections: TemplateSection[], id: string): TemplateSection | undefined => {
    for (const s of sections) {
      if (s.id === id) return s;
      const inner = s.subsections ? findNestedById(s.subsections, id) : undefined;
      if (inner) return inner;
    }
    return undefined;
  };

  // ─── Visao Geral (genre-specific preferred, common completo USP+Meta as children) ───
  const visaoGeralGenre = findByIdEnd(genreSpecific, "-visao-geral");
  const visaoGeralCommon = findByIdEnd(common, "-visao-geral");
  let visaoGeral = visaoGeralGenre || visaoGeralCommon;
  if (scope === "completo" && visaoGeralGenre) {
    const usp = findNestedById(common, "common-completo-visao-usp");
    const meta = findNestedById(common, "common-completo-visao-meta");
    const extraSubs = [usp, meta].filter((s): s is TemplateSection => Boolean(s));
    if (extraSubs.length > 0) {
      visaoGeral = {
        ...visaoGeralGenre,
        subsections: [...(visaoGeralGenre.subsections || []), ...extraSubs],
      };
    }
  }

  // ─── Children pools (everything except visao-geral / its subs) ───
  const isVisaoGeralRelated = (id: string) =>
    id.endsWith("-visao-geral") ||
    id === "common-completo-visao-usp" ||
    id === "common-completo-visao-meta";
  const commonRest = common.filter((s) => !isVisaoGeralRelated(s.id));
  const genreRest = genreSpecific.filter((s) => !isVisaoGeralRelated(s.id));

  // ─── Group children ───
  const designChildren = [
    findByIdEnd(commonRest, "-core-loop"),
    findByIdEnd(commonRest, "-mecanicas"),
    findByIdEnd(commonRest, "-progressao"),
  ].filter((s): s is TemplateSection => Boolean(s));

  const conteudoChildren = genreRest;

  const apresentacaoChildren = [
    findByIdEnd(commonRest, "-controles"),
    findByIdEnd(commonRest, "-ui"),
    findByIdEnd(commonRest, "-arte-audio"),
  ].filter((s): s is TemplateSection => Boolean(s));

  const producaoChildren = [
    findByIdEnd(commonRest, "-tecnologia"),
    findByIdEnd(commonRest, "-roadmap") || findByIdEnd(commonRest, "-roadmap-riscos"),
    findByIdEnd(commonRest, "-riscos"),
    findByIdEnd(commonRest, "-kpis"),
    findByIdEnd(commonRest, "-monetizacao"),
    findByIdEnd(commonRest, "-qa"),
  ].filter((s): s is TemplateSection => Boolean(s));

  // ─── Assemble in GDD-canonical order ───
  const result: TemplateSection[] = [];

  if (visaoGeral) result.push(visaoGeral);

  if (designChildren.length > 0) {
    result.push(
      groupContainer(
        `group-design-${scope}`,
        "🎮 Design de Jogo",
        "Regras, loops e progressao do jogo.",
        "Esta pasta agrupa as decisoes de design \"de dentro pra fora\": o que o jogador faz, como os sistemas interagem, e como a progressao se desenrola.",
        [
          "Core Loop — o ciclo que o jogador repete.",
          "Mecanicas Centrais — as acoes e regras formais.",
          "Progressao e Dificuldade — como o jogador evolui.",
        ],
        designChildren
      )
    );
  }

  if (conteudoChildren.length > 0) {
    result.push(
      groupContainer(
        `group-conteudo-${scope}`,
        "📦 Conteudo do Jogo",
        "Personagens, itens, combate, narrativa e economia.",
        "Esta pasta contem o \"conteudo\" do jogo — o que o jogador vai ver, controlar, coletar e enfrentar. As paginas aqui sao especificas do seu genero.",
        conteudoChildren.map((c) => `${c.title}`),
        conteudoChildren
      )
    );
  }

  if (apresentacaoChildren.length > 0) {
    result.push(
      groupContainer(
        `group-apresentacao-${scope}`,
        "🎨 Apresentacao",
        "Controles, UX/UI, arte e audio.",
        "Esta pasta agrupa como o jogo se APRESENTA ao jogador: como ele interage (controles), como ele enxerga (UI), e como ele sente (arte e som).",
        [
          "Controles — como o jogador interage, incluindo acessibilidade.",
          "UX/UI — HUD, menus e feedback.",
          "Arte e Audio — direcao visual e sonora.",
        ],
        apresentacaoChildren
      )
    );
  }

  if (producaoChildren.length > 0) {
    result.push(
      groupContainer(
        `group-producao-${scope}`,
        "🏭 Producao",
        "Tecnologia, roadmap, riscos, KPIs, monetizacao e QA.",
        "Esta pasta agrupa decisoes de PRODUCAO — como o jogo vai ser feito, lancado e monitorado. Nao e sobre o que o jogador vive; e sobre como voce entrega.",
        producaoChildren.map((c) => `${c.title}`),
        producaoChildren
      )
    );
  }

  return result;
}

export function getWizardGenreOptions(locale: AppLocale = "pt-BR"): Array<{ id: WizardGenre; label: string }> {
  return [
    { id: "rpg", label: locale === "pt-BR" ? "RPG" : locale === "es" ? GENRE_LABEL_I18N.rpg.es : GENRE_LABEL_I18N.rpg.en },
    { id: "roguelike", label: locale === "pt-BR" ? "Roguelike" : locale === "es" ? GENRE_LABEL_I18N.roguelike.es : GENRE_LABEL_I18N.roguelike.en },
    { id: "platformer", label: locale === "pt-BR" ? "Platformer" : locale === "es" ? GENRE_LABEL_I18N.platformer.es : GENRE_LABEL_I18N.platformer.en },
    { id: "puzzle", label: locale === "pt-BR" ? "Puzzle" : locale === "es" ? GENRE_LABEL_I18N.puzzle.es : GENRE_LABEL_I18N.puzzle.en },
    { id: "simulation", label: locale === "pt-BR" ? "Simulacao" : locale === "es" ? GENRE_LABEL_I18N.simulation.es : GENRE_LABEL_I18N.simulation.en },
  ];
}

export function getWizardPlatformOptions(locale: AppLocale = "pt-BR"): Array<{ id: WizardPlatform; label: string }> {
  return [
    { id: "pc", label: locale === "pt-BR" ? "PC" : locale === "es" ? PLATFORM_LABEL_I18N.pc.es : PLATFORM_LABEL_I18N.pc.en },
    { id: "mobile", label: locale === "pt-BR" ? "Mobile" : locale === "es" ? PLATFORM_LABEL_I18N.mobile.es : PLATFORM_LABEL_I18N.mobile.en },
    { id: "console", label: locale === "pt-BR" ? "Console" : locale === "es" ? PLATFORM_LABEL_I18N.console.es : PLATFORM_LABEL_I18N.console.en },
    { id: "web", label: locale === "pt-BR" ? "Web" : locale === "es" ? PLATFORM_LABEL_I18N.web.es : PLATFORM_LABEL_I18N.web.en },
  ];
}

export function getWizardScopeOptions(locale: AppLocale = "pt-BR"): Array<{ id: WizardScope; label: string; summary: string }> {
  if (locale === "en") {
    return [
      { id: "mini", label: "Mini", summary: "Lean structure to start fast." },
      { id: "medio", label: "Medium", summary: "Balanced coverage for early production." },
      { id: "completo", label: "Complete", summary: "Broad structure with more depth." },
    ];
  }
  if (locale === "es") {
    return [
      { id: "mini", label: "Mini", summary: "Estructura ligera para empezar rápido." },
      { id: "medio", label: "Medio", summary: "Cobertura equilibrada para producción inicial." },
      { id: "completo", label: "Completo", summary: "Estructura amplia con mayor profundidad." },
    ];
  }
  return [
    { id: "mini", label: "Mini", summary: "Estrutura enxuta para iniciar rapido." },
    { id: "medio", label: "Medio", summary: "Cobertura equilibrada para producao inicial." },
    { id: "completo", label: "Completo", summary: "Estrutura ampla com maior profundidade." },
  ];
}

export function getWizardStyleOptions(locale: AppLocale = "pt-BR"): Array<{ id: WizardStyle; label: string; summary: string }> {
  if (locale === "en") {
    return [
      { id: "enxuto", label: "Lean", summary: "Straight to the point and objective." },
      { id: "padrao", label: "Standard", summary: "Balanced for most projects." },
      { id: "profundo", label: "Deep", summary: "More details and criteria per section." },
    ];
  }
  if (locale === "es") {
    return [
      { id: "enxuto", label: "Ligero", summary: "Directo al punto y objetivo." },
      { id: "padrao", label: "Estándar", summary: "Equilibrado para la mayoría de proyectos." },
      { id: "profundo", label: "Profundo", summary: "Más detalles y criterios por sección." },
    ];
  }
  return [
    { id: "enxuto", label: "Enxuto", summary: "Direto ao ponto e objetivo." },
    { id: "padrao", label: "Padrao", summary: "Equilibrado para a maioria dos projetos." },
    { id: "profundo", label: "Profundo", summary: "Mais detalhes e criterios por secao." },
  ];
}

export function resolveTemplateFromWizard(choices: WizardChoices, locale: AppLocale = "pt-BR"): ResolvedTemplate {
  const meta = GENRE_META[choices.genre];
  const sections = composeSections(choices.scope, choices.genre).map((item) =>
    applyStyleToSection(item, choices.style, locale)
  );

  const platforms =
    choices.platforms.length > 0
      ? choices.platforms
          .map((platform) =>
            locale === "pt-BR"
              ? PLATFORM_LABEL[platform]
              : locale === "es"
                ? PLATFORM_LABEL_I18N[platform].es
                : PLATFORM_LABEL_I18N[platform].en
          )
          .join(", ")
      : locale === "es"
        ? "No definido"
        : locale === "en"
          ? "Not defined"
          : "Nao definido";

  const scopeLabel =
    locale === "en"
      ? choices.scope === "mini"
        ? "Mini"
        : choices.scope === "medio"
          ? "Medium"
          : "Complete"
      : locale === "es"
        ? choices.scope === "mini"
          ? "Mini"
          : choices.scope === "medio"
            ? "Medio"
            : "Completo"
        : choices.scope === "mini"
          ? "Mini"
          : choices.scope === "medio"
            ? "Medio"
            : "Completo";

  const styleLabel =
    locale === "en"
      ? choices.style === "enxuto"
        ? "Lean"
        : choices.style === "padrao"
          ? "Standard"
          : "Deep"
      : locale === "es"
        ? choices.style === "enxuto"
          ? "Ligero"
          : choices.style === "padrao"
            ? "Estándar"
            : "Profundo"
        : choices.style === "enxuto"
          ? "Enxuto"
          : choices.style === "padrao"
            ? "Padrao"
            : "Profundo";

  const projectBaseTitle =
    locale === "pt-BR"
      ? meta.baseTitle
      : locale === "es"
        ? localizeTemplateText(meta.baseTitle, "es")
        : localizeTemplateText(meta.baseTitle, "en");
  const projectGenreLabel =
    locale === "pt-BR"
      ? GENRE_LABEL[choices.genre]
      : locale === "es"
        ? GENRE_LABEL_I18N[choices.genre].es
        : GENRE_LABEL_I18N[choices.genre].en;

  const descriptionBase =
    locale === "pt-BR"
      ? meta.description
      : locale === "es"
        ? localizeTemplateText(meta.description, "es")
        : localizeTemplateText(meta.description, "en");
  const platformsLabel = locale === "pt-BR" ? "Plataformas alvo" : locale === "es" ? "Plataformas objetivo" : "Target platforms";
  const scopeText = locale === "pt-BR" ? "Escopo" : locale === "es" ? "Alcance" : "Scope";
  const styleText = locale === "pt-BR" ? "Estilo" : locale === "es" ? "Estilo" : "Style";

  return {
    projectTitle: `${projectBaseTitle} ${projectGenreLabel}`,
    projectDescription: `${descriptionBase}\n${platformsLabel}: ${platforms}.\n${scopeText}: ${scopeLabel}. ${styleText}: ${styleLabel}.`,
    sections,
  };
}
