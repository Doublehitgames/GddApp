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

const COMMON_BY_SCOPE: Record<WizardScope, TemplateSection[]> = {
  mini: [
    section(
      "common-mini-visao-geral",
      "Visao Geral",
      "Defina nome do jogo, pitch, publico-alvo, plataformas e diferencial principal."
    ),
    section(
      "common-mini-core-loop",
      "Core Loop",
      "Descreva o loop primario e o resultado esperado por sessao de jogo."
    ),
    section(
      "common-mini-progressao",
      "Progressao",
      "Explique como o jogador evolui, desbloqueia conteudo e percebe ganho de poder.",
      undefined,
      seedProgression1to20()
    ),
    section(
      "common-mini-controles",
      "Controles e Input",
      "Mapeamento minimo por plataforma e requisitos basicos de acessibilidade."
    ),
    section(
      "common-mini-ui",
      "UX/UI Essencial",
      "HUD minimo, feedback de sucesso/erro e fluxo principal de menus."
    ),
    section(
      "common-mini-roadmap",
      "Roadmap Inicial",
      "Passos para prototipo e primeira versao jogavel."
    ),
  ],
  medio: [
    // Visao Geral is now genre-specific — each genre provides its own rich,
    // narrative version (e.g. rpg-medio-visao-geral-elder).
    section(
      "common-medio-core-loop",
      "Core Loop e Loops Secundarios",
      "Documentar loop principal e loops de suporte como economia, colecao e crafting."
    ),
    section(
      "common-medio-mecanicas",
      "Mecanicas Centrais",
      "Listar mecanicas obrigatorias e regras de estado para cada sistema principal."
    ),
    section(
      "common-medio-progressao",
      "Progressao e Dificuldade",
      "Curva de progressao, marcos, desbloqueios e controle de dificuldade.",
      undefined,
      seedProgression1to20()
    ),
    section(
      "common-medio-controles",
      "Controles, Acessibilidade e QoL",
      "Mapeamento por plataforma, remapeamento e recursos de acessibilidade."
    ),
    section(
      "common-medio-ui",
      "UX/UI e Feedback",
      "Fluxo de menu, estados do HUD, telemetria visual e consistencia de feedback."
    ),
    section(
      "common-medio-arte-audio",
      "Arte e Audio",
      "Direcao visual, linguagem de efeitos e trilha/sons de acao."
    ),
    section(
      "common-medio-tecnologia",
      "Tecnologia",
      "Engine, ferramentas, pipelines e dependencias externas."
    ),
    section(
      "common-medio-roadmap-riscos",
      "Roadmap e Riscos",
      "Milestones de MVP/alpha e principais riscos de design, tecnica e escopo."
    ),
  ],
  completo: [
    section(
      "common-completo-visao-geral",
      "Visao Geral Completa",
      "Nome, genero, publico, plataformas, referencias, pitch e diferencial competitivo.",
      [
        section("common-completo-visao-usp", "USP e Proposta de Valor", "Definir promessa central e motivos para retenao."),
        section("common-completo-visao-meta", "Metas de Produto", "Objetivos de experiencia e metas de qualidade."),
      ]
    ),
    section(
      "common-completo-core-loop",
      "Core Loop e Loops Secundarios",
      "Explorar, executar acao principal, receber recompensa, evoluir e repetir com variacao.",
      [
        section("common-completo-loop-primario", "Loop Primario", "Etapas com entrada, decisao e saida por ciclo."),
        section("common-completo-loop-sec", "Loops Secundarios", "Sistema social, crafting, ranking, desafios e eventos."),
      ]
    ),
    section(
      "common-completo-mecanicas",
      "Mecanicas e Regras de Sistema",
      "Regras formais, condicoes de sucesso/fracasso e interdependencia entre sistemas."
    ),
    section(
      "common-completo-progressao",
      "Progressao, Dificuldade e Balanceamento",
      "Curva de poder, gates de conteudo, tuning de dificuldade e prevencao de power creep.",
      [
        section(
          "common-completo-balance-xp",
          "Balanceamento de XP",
          "Custos de nivel, pacing e marcos de dominancia.",
          undefined,
          seedProgression1to20()
        ),
        section(
          "common-completo-balance-economia",
          "Balanceamento de Economia",
          "Fontes/sinks, inflacao e controles antifarming.",
          undefined,
          seedEconomy()
        ),
      ]
    ),
    section(
      "common-completo-controles",
      "Controles, Input e Acessibilidade",
      "Mapeamento completo por plataforma, sensibilidade, customizacao e opcoes assistivas."
    ),
    section(
      "common-completo-ui",
      "UX/UI",
      "Arquitetura de telas, hierarquia de informacao, feedback visual e fluxo de onboarding."
    ),
    section(
      "common-completo-arte-audio",
      "Direcao de Arte e Audio",
      "Guia visual, paleta, animacoes chave, assinatura sonora e mix de eventos."
    ),
    section(
      "common-completo-tecnologia",
      "Tecnologia e Arquitetura",
      "Engine, backend, analytics, save, ferramentas internas e observabilidade."
    ),
    section(
      "common-completo-kpis",
      "KPIs e Telemetria",
      "Definir retencao, conversao, funil de tutorial, ARPU/LTV e metricas de engajamento."
    ),
    section(
      "common-completo-monetizacao",
      "Monetizacao (quando aplicavel)",
      "Politica de monetizacao, limites eticos e impacto de UX em ads/IAP/battle pass."
    ),
    section(
      "common-completo-qa",
      "QA, Testes e Instrumentacao",
      "Plano de teste funcional, regressao de sistemas e testes de balanceamento."
    ),
    section(
      "common-completo-roadmap",
      "Roadmap de Producao",
      "MVP, alpha, soft launch, global launch e metas por milestone."
    ),
    section(
      "common-completo-riscos",
      "Riscos e Mitigacoes",
      "Riscos tecnicos, de design e de mercado com plano de contingencia."
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
      section("rogue-mini-run", "Estrutura de Run", "Inicio, progresso, boss e encerramento de run."),
      section("rogue-mini-build", "Builds", "Pilares de build e 2-3 sinergias principais."),
      section("rogue-mini-meta", "Metaprogressao", "Recompensas permanentes entre runs."),
    ],
    medio: [
      section("rogue-medio-run-design", "Run Design", "Biome sequencing, escalada de risco e pacing de recursos."),
      section("rogue-medio-procedural", "Geracao Procedural", "Regras de composicao de salas, eventos e encontros."),
      section("rogue-medio-builds", "Buildcraft e Sinergias", "Categorias de build, tags e combinacoes proibidas."),
      section("rogue-medio-meta", "Metaprogressao e Persistencia", "Unlock trees, meta currency e onboarding progressivo."),
      section(
        "rogue-medio-economia",
        "Economia de Run",
        "Drops, lojas, rerolls e custo de decisao.",
        undefined,
        seedEconomy()
      ),
    ],
    completo: [
      section("rogue-completo-run-architecture", "Arquitetura de Run", "Modelo completo de inicio ao boss final com checkpoints de decisao.", [
        section("rogue-completo-curva", "Curva de Risco", "Escalada por piso/bioma com controle de spike."),
        section("rogue-completo-objetivos", "Objetivos Primario e Secundario", "Objetivos por run com opcional de mastery."),
      ]),
      section("rogue-completo-procedural", "Geracao Procedural Avancada", "Pools por contexto, seeds, restricoes de composicao e validacoes."),
      section("rogue-completo-combate", "Combate, Armas e Modificadores", "Framework de combate com variancia controlada."),
      section("rogue-completo-buildcraft", "Buildcraft", "Sistemas de tags, sinergias, antisinergias e teto de poder."),
      section("rogue-completo-metaprogressao", "Metaprogressao", "Desbloqueios permanentes sem invalidar desafio de run."),
      section("rogue-completo-bosses", "Elites e Bosses", "Conjuntos de padroes, telegrafo e regras de fairness."),
      section(
        "rogue-completo-economia",
        "Economia e Loja de Run",
        "Drops, rerolls, currency sinks e equilibrio de recompensa.",
        undefined,
        seedEconomy()
      ),
    ],
  },
  platformer: {
    mini: [
      section("plat-mini-movimento", "Movimento", "Velocidade, pulo e sensacao de controle."),
      section("plat-mini-fases", "Estrutura de Fases", "Inicio, desafio, pico e conclusao por fase."),
      section("plat-mini-progressao", "Progressao", "Desbloqueios de habilidade e novos obstaculos."),
    ],
    medio: [
      section("plat-medio-physics", "Physics e Controle", "Aceleracao, desaceleracao, coyote time e jump buffering."),
      section(
        "plat-medio-atributos",
        "Atributos do Jogador",
        "Atributos base do personagem (HP, velocidade, altura de pulo).",
        undefined,
        seedPlatformerAttributes()
      ),
      section("plat-medio-level-design", "Level Design", "Principios de ensino de mecanica e leitura de risco."),
      section("plat-medio-checkpoints", "Checkpoints e Recuperacao", "Distribuicao de checkpoints e tempo de retorno."),
      section("plat-medio-enemies", "Inimigos e Obstaculos", "Tipos, variacoes e combinacoes por mundo."),
      section("plat-medio-recompensas", "Recompensas e Colecionaveis", "Itens opcionais e incentivo de mastery.", [
        section(
          "plat-medio-colecionavel-exemplo",
          "Colecionavel de Exemplo: Moeda",
          "Exemplo de item colecionavel para duplicar.",
          undefined,
          seedItemExample()
        ),
      ]),
    ],
    completo: [
      section("plat-completo-movimento", "Sistema de Movimento Avancado", "Modelo tecnico completo para consistencia de controle.", [
        section("plat-completo-params", "Parametros de Movimento", "Velocidade, gravidade, friccao e curva de input."),
        section("plat-completo-assists", "Assistencias", "Autoassist, snap e opcoes de acessibilidade."),
      ]),
      section("plat-completo-level-architecture", "Arquitetura de Fases", "Blueprint de fase com onboarding, combinacao e mastery."),
      section("plat-completo-curva", "Curva de Dificuldade e Pacing", "Cadencia de desafio por ato/mundo e descanso cognitivo."),
      section(
        "plat-completo-atributos",
        "Atributos do Jogador",
        "Atributos base do personagem.",
        undefined,
        seedPlatformerAttributes()
      ),
      section("plat-completo-combate", "Combate (se aplicavel)", "Regras de dano, invencibilidade e leitura de telegraph."),
      section("plat-completo-bosses", "Boss Fights", "Design de fases de boss, pattern readability e tuning."),
      section("plat-completo-colecionaveis", "Economia de Colecionaveis", "Colecionaveis, unlocks e recompensas de habilidade.", [
        section(
          "plat-completo-colecionavel-exemplo",
          "Colecionavel de Exemplo: Moeda",
          "Item colecionavel para duplicar.",
          undefined,
          seedItemExample()
        ),
      ], seedEconomy()),
      section("plat-completo-qa", "Playtest de Sensacao de Controle", "Plano de teste focado em resposta e frustacao percebida."),
    ],
  },
  puzzle: {
    mini: [
      section("puzzle-mini-regras", "Regras do Puzzle", "Regras simples, condicoes de vitoria e perda."),
      section("puzzle-mini-fases", "Progressao de Fases", "Sequencia basica de dificuldade e introducao de mecanicas."),
      section("puzzle-mini-feedback", "Feedback", "Feedback visual/sonoro para acerto e erro."),
    ],
    medio: [
      section("puzzle-medio-regras-formais", "Regras Formais", "Estados validos, restricoes e condicoes de solucao."),
      section("puzzle-medio-taxonomia", "Taxonomia de Puzzles", "Classes de puzzle por habilidade cognitiva exigida."),
      section("puzzle-medio-onboarding", "Onboarding Pedagogico", "Sequencia de ensino sem texto excessivo."),
      section("puzzle-medio-dicas", "Sistema de Dicas", "Camadas de hint e penalidade opcional."),
      section("puzzle-medio-telemetria", "Telemetria de Dificuldade", "Tempo por fase, tentativas e abandono."),
    ],
    completo: [
      section("puzzle-completo-modelo", "Modelo Formal do Puzzle", "Representacao de estado, operacoes permitidas e validade.", [
        section("puzzle-completo-solver", "Solver de Referencia", "Heuristicas e verificacao de solvabilidade."),
        section("puzzle-completo-geracao", "Geracao de Conteudo", "Geracao de fases com filtros de dificuldade."),
      ]),
      section("puzzle-completo-curva", "Curva de Dificuldade", "Planejamento de dificuldade por capitulo, incluindo revisao de mecanicas."),
      section("puzzle-completo-onboarding", "Onboarding e Tutoriais", "Introducao progressiva com foco em aprendizado ativo."),
      section("puzzle-completo-hints", "Sistema de Hints e Recuperacao", "Hints graduais, undo, reset e suporte antitrava."),
      section("puzzle-completo-ui", "UI Cognitiva", "Legibilidade, hierarquia visual e minimizacao de ruido."),
      section("puzzle-completo-analytics", "Analytics de Qualidade", "Matriz de friccao e sinalizadores de fase mal calibrada."),
      section("puzzle-completo-conteudo", "Plano de Conteudo", "Pacotes de fase, eventos sazonais e desafios semanais."),
    ],
  },
  simulation: {
    mini: [
      section("sim-mini-loop", "Loop de Gestao", "Coletar, transformar, distribuir e reinvestir."),
      section("sim-mini-recursos", "Recursos", "Recursos principais, entradas, saidas e gargalos."),
      section("sim-mini-progressao", "Progressao", "Desbloqueios por marcos e expansao gradual."),
    ],
    medio: [
      section("sim-medio-cadeias", "Cadeias de Producao", "Cadeias de valor e dependencias entre modulos.", [
        section(
          "sim-medio-mesa-exemplo",
          "Mesa de Producao de Exemplo",
          "Estacao que agrupa receitas — ligue receitas criadas depois.",
          undefined,
          seedCraftTableExample()
        ),
      ]),
      section(
        "sim-medio-economia",
        "Economia Sistemica",
        "Fontes/sinks de moeda, inflacao e estabilidade.",
        undefined,
        seedEconomy()
      ),
      section("sim-medio-agentes", "Agentes e Comportamento", "NPCs/entidades e regras de tomada de decisao."),
      section("sim-medio-eventos", "Eventos Dinamicos", "Eventos aleatorios e resposta do sistema."),
      section("sim-medio-ui", "UI de Operacao e Telemetria", "Indicadores operacionais e alertas importantes."),
    ],
    completo: [
      section("sim-completo-modelagem", "Modelagem de Sistemas", "Representar sistemas, dependencias e limites operacionais.", [
        section(
          "sim-completo-cadeias",
          "Cadeias de Producao",
          "Entradas, transformacoes, perdas e throughput alvo.",
          [
            section(
              "sim-completo-mesa-exemplo",
              "Mesa de Producao de Exemplo",
              "Estacao que agrupa receitas.",
              undefined,
              seedCraftTableExample()
            ),
          ]
        ),
        section("sim-completo-buffer", "Buffers e Capacidade", "Estoques, capacidade maxima e gargalos."),
      ]),
      section(
        "sim-completo-economia",
        "Economia de Simulacao",
        "Politica de preco, inflacao, subsidios e sinks estruturais.",
        undefined,
        seedEconomy()
      ),
      section("sim-completo-agentes", "Agentes, IA e Comportamentos", "Regras de decisao, prioridades e conflitos entre agentes."),
      section("sim-completo-riscos", "Eventos e Gestao de Crise", "Eventos de risco, impacto sistico e planos de contingencia."),
      section("sim-completo-balance", "Balanceamento e Tuning", "Parametros de tuning e telemetria para estabilidade de loop."),
      section("sim-completo-ux", "UX de Supervisao", "Dashboards, alertas, drill-down e comandos rapidos."),
      section("sim-completo-expansao", "Expansao de Conteudo", "Novos sistemas, DLC/updates e estrategia de complexidade."),
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

function composeSections(scope: WizardScope, genre: WizardGenre): TemplateSection[] {
  const common = COMMON_BY_SCOPE[scope].map(cloneSection);
  const genreSpecific = GENRE_BY_SCOPE[genre][scope].map(cloneSection);
  return [...common, ...genreSpecific];
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
