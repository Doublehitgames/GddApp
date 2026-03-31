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

const section = (
  id: string,
  title: string,
  content: string,
  subsections?: TemplateSection[]
): TemplateSection => ({ id, title, content, subsections });

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
      "Explique como o jogador evolui, desbloqueia conteudo e percebe ganho de poder."
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
    section(
      "common-medio-visao-geral",
      "Visao Geral",
      "Registrar pitch, publico, referencias, USP e posicionamento inicial."
    ),
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
      "Curva de progressao, marcos, desbloqueios e controle de dificuldade."
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
        section("common-completo-balance-xp", "Balanceamento de XP", "Custos de nivel, pacing e marcos de dominancia."),
        section("common-completo-balance-economia", "Balanceamento de Economia", "Fontes/sinks, inflacao e controles antifarming."),
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
      section("rpg-mini-classes", "Classes e Atributos", "Classes iniciais, atributos principais e identidade de build."),
      section("rpg-mini-combate", "Combate", "Modelo de combate, alvo e fluxo de turno/tempo real."),
      section("rpg-mini-mundo", "Mundo e Narrativa", "Tema, faccoes e objetivo da jornada principal."),
    ],
    medio: [
      section("rpg-medio-personagens", "Personagens Jogaveis", "Classes, papeis e assinatura de gameplay por classe.", [
        section("rpg-medio-atributos", "Atributos", "STR, AGI, INT, VIT e impacto numerico."),
        section("rpg-medio-skills", "Skills", "Ativas/passivas, cooldowns e custos."),
      ]),
      section("rpg-medio-combate", "Sistema de Combate", "Modelo de dano, defesa, critico, esquiva e status effects."),
      section("rpg-medio-itens", "Itens e Equipamentos", "Tipos, raridade, equipaveis, consumiveis e upgrades."),
      section("rpg-medio-narrativa", "Narrativa e NPCs", "Arco principal, lore, faccoes e missao secundaria."),
      section("rpg-medio-economia", "Economia", "Moedas, fontes, sinks e controle de progressao economica."),
    ],
    completo: [
      section("rpg-completo-mecanicas", "Mecanicas Principais de RPG", "Exploracao, combate, progressao e inventario com regras detalhadas.", [
        section("rpg-completo-exploracao", "Exploracao", "Mapa, eventos, interacoes e gates de area."),
        section("rpg-completo-inventario", "Inventario", "Limites, stack, filtros e comparacao de itens."),
      ]),
      section("rpg-completo-personagens", "Personagens, Classes e Buildcraft", "Design de classes, atributos base e espacos de customizacao.", [
        section("rpg-completo-classes", "Classes", "Funcoes, pontos fortes, counters e sinergias."),
        section("rpg-completo-skill-tree", "Arvore de Habilidades", "Ramos, custos e milestones de build."),
      ]),
      section("rpg-completo-combate", "Sistema de Combate Avancado", "Formula de dano, resistencia, buffs/debuffs, IA e telemetria de combate.", [
        section("rpg-completo-formulas", "Formulas Base", "Dano, mitigacao, critico, esquiva e status."),
        section("rpg-completo-ia-inimiga", "IA Inimiga e Bosses", "Comportamentos, fases e leitura de telegraph."),
      ]),
      section("rpg-completo-itens", "Itens, Equipamentos e Loot", "Taxonomia de item, raridade, drop table, upgrade e item sinks.", [
        section("rpg-completo-loot", "Politica de Loot", "Tabelas, pity timers, garantia minima e anti-frustracao."),
        section("rpg-completo-upgrade", "Upgrade e Encantamento", "Custos, falhas, risco e progressao de gear."),
      ]),
      section("rpg-completo-narrativa", "Narrativa, Lore e Missoes", "Main quest, side quest, worldbuilding e impacto de escolhas."),
      section("rpg-completo-secundarios", "Sistemas Secundarios", "Crafting, guildas, ranking, eventos e PvP opcional."),
      section("rpg-completo-economia", "Economia e Monetizacao de RPG", "Modelagem de moedas, sinks, progressao e limites de monetizacao."),
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
      section("rogue-medio-economia", "Economia de Run", "Drops, lojas, rerolls e custo de decisao."),
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
      section("rogue-completo-economia", "Economia e Loja de Run", "Drops, rerolls, currency sinks e equilibrio de recompensa."),
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
      section("plat-medio-level-design", "Level Design", "Principios de ensino de mecanica e leitura de risco."),
      section("plat-medio-checkpoints", "Checkpoints e Recuperacao", "Distribuicao de checkpoints e tempo de retorno."),
      section("plat-medio-enemies", "Inimigos e Obstaculos", "Tipos, variacoes e combinacoes por mundo."),
      section("plat-medio-recompensas", "Recompensas e Colecionaveis", "Itens opcionais e incentivo de mastery."),
    ],
    completo: [
      section("plat-completo-movimento", "Sistema de Movimento Avancado", "Modelo tecnico completo para consistencia de controle.", [
        section("plat-completo-params", "Parametros de Movimento", "Velocidade, gravidade, friccao e curva de input."),
        section("plat-completo-assists", "Assistencias", "Autoassist, snap e opcoes de acessibilidade."),
      ]),
      section("plat-completo-level-architecture", "Arquitetura de Fases", "Blueprint de fase com onboarding, combinacao e mastery."),
      section("plat-completo-curva", "Curva de Dificuldade e Pacing", "Cadencia de desafio por ato/mundo e descanso cognitivo."),
      section("plat-completo-combate", "Combate (se aplicavel)", "Regras de dano, invencibilidade e leitura de telegraph."),
      section("plat-completo-bosses", "Boss Fights", "Design de fases de boss, pattern readability e tuning."),
      section("plat-completo-colecionaveis", "Economia de Colecionaveis", "Colecionaveis, unlocks e recompensas de habilidade."),
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
      section("sim-medio-cadeias", "Cadeias de Producao", "Cadeias de valor e dependencias entre modulos."),
      section("sim-medio-economia", "Economia Sistemica", "Fontes/sinks de moeda, inflacao e estabilidade."),
      section("sim-medio-agentes", "Agentes e Comportamento", "NPCs/entidades e regras de tomada de decisao."),
      section("sim-medio-eventos", "Eventos Dinamicos", "Eventos aleatorios e resposta do sistema."),
      section("sim-medio-ui", "UI de Operacao e Telemetria", "Indicadores operacionais e alertas importantes."),
    ],
    completo: [
      section("sim-completo-modelagem", "Modelagem de Sistemas", "Representar sistemas, dependencias e limites operacionais.", [
        section("sim-completo-cadeias", "Cadeias de Producao", "Entradas, transformacoes, perdas e throughput alvo."),
        section("sim-completo-buffer", "Buffers e Capacidade", "Estoques, capacidade maxima e gargalos."),
      ]),
      section("sim-completo-economia", "Economia de Simulacao", "Politica de preco, inflacao, subsidios e sinks estruturais."),
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

function cloneSection(item: TemplateSection): TemplateSection {
  return {
    ...item,
    subsections: item.subsections?.map(cloneSection),
  };
}

function applyStyleToSection(item: TemplateSection, style: WizardStyle): TemplateSection {
  return {
    ...item,
    content: `${item.content}\n\n${STYLE_EXTRA[style]}`,
    subsections: item.subsections?.map((child) => applyStyleToSection(child, style)),
  };
}

function composeSections(scope: WizardScope, genre: WizardGenre): TemplateSection[] {
  const common = COMMON_BY_SCOPE[scope].map(cloneSection);
  const genreSpecific = GENRE_BY_SCOPE[genre][scope].map(cloneSection);
  return [...common, ...genreSpecific];
}

export function getWizardGenreOptions(): Array<{ id: WizardGenre; label: string }> {
  return [
    { id: "rpg", label: "RPG" },
    { id: "roguelike", label: "Roguelike" },
    { id: "platformer", label: "Platformer" },
    { id: "puzzle", label: "Puzzle" },
    { id: "simulation", label: "Simulacao" },
  ];
}

export function getWizardPlatformOptions(): Array<{ id: WizardPlatform; label: string }> {
  return [
    { id: "pc", label: "PC" },
    { id: "mobile", label: "Mobile" },
    { id: "console", label: "Console" },
    { id: "web", label: "Web" },
  ];
}

export function getWizardScopeOptions(): Array<{ id: WizardScope; label: string; summary: string }> {
  return [
    { id: "mini", label: "Mini", summary: "Estrutura enxuta para iniciar rapido." },
    { id: "medio", label: "Medio", summary: "Cobertura equilibrada para producao inicial." },
    { id: "completo", label: "Completo", summary: "Estrutura ampla com maior profundidade." },
  ];
}

export function getWizardStyleOptions(): Array<{ id: WizardStyle; label: string; summary: string }> {
  return [
    { id: "enxuto", label: "Enxuto", summary: "Direto ao ponto e objetivo." },
    { id: "padrao", label: "Padrao", summary: "Equilibrado para a maioria dos projetos." },
    { id: "profundo", label: "Profundo", summary: "Mais detalhes e criterios por secao." },
  ];
}

export function resolveTemplateFromWizard(choices: WizardChoices): ResolvedTemplate {
  const meta = GENRE_META[choices.genre];
  const sections = composeSections(choices.scope, choices.genre).map((item) =>
    applyStyleToSection(item, choices.style)
  );

  const platforms =
    choices.platforms.length > 0
      ? choices.platforms.map((platform) => PLATFORM_LABEL[platform]).join(", ")
      : "Nao definido";

  const scopeLabel =
    choices.scope === "mini"
      ? "Mini"
      : choices.scope === "medio"
        ? "Medio"
        : "Completo";

  const styleLabel =
    choices.style === "enxuto"
      ? "Enxuto"
      : choices.style === "padrao"
        ? "Padrao"
        : "Profundo";

  return {
    projectTitle: `${meta.baseTitle} ${GENRE_LABEL[choices.genre]}`,
    projectDescription: `${meta.description}\nPlataformas alvo: ${platforms}.\nEscopo: ${scopeLabel}. Estilo: ${styleLabel}.`,
    sections,
  };
}
