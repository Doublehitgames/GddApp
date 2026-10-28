/**
 * Primeiros passos: as perguntas que dão a quem nunca escreveu um GDD um
 * começo. Não é um checklist de completude — respondidas (ou puladas), o GDD é
 * da pessoa. Cada pergunta diz para onde vai a resposta: um campo da Visão do
 * projeto, ou uma página com aquele título.
 *
 * GÊMEO: packages/mcp-server/src/starterQuestions.ts é cópia byte a byte deste
 * arquivo (o pacote npm precisa ser autocontido). Mexeu aqui, copie lá —
 * __tests__/lib/starterQuestions.test.ts compara os dois.
 */

export type StarterArea = "vision" | "docs" | "library" | "systems";

export type StarterGenre =
  | "action-rpg"
  | "rpg"
  | "platformer"
  | "metroidvania"
  | "roguelike"
  | "puzzle"
  | "simulation"
  | "strategy"
  | "narrative"
  | "other";

export type LocalizedText = { "pt-BR": string; en: string; es: string };

export type StarterTarget =
  | { kind: "vision"; field: "title" | "logline" | "playerVerb" | "feeling" | "pillars" }
  | { kind: "page"; title: LocalizedText; domain: string };

export type StarterQuestion = {
  id: string;
  area: StarterArea;
  question: LocalizedText;
  hint: LocalizedText;
  target: StarterTarget;
  multiline: boolean;
  /** Só para estes gêneros. Ausente = vale para todos. */
  onlyFor?: StarterGenre[];
  /** Não aparece nestes gêneros (outra pergunta toma o lugar). */
  notFor?: StarterGenre[];
};

export const STARTER_GENRES: { id: StarterGenre; label: LocalizedText }[] = [
  { id: "action-rpg", label: { "pt-BR": "RPG de ação", en: "Action RPG", es: "RPG de acción" } },
  { id: "rpg", label: { "pt-BR": "RPG", en: "RPG", es: "RPG" } },
  { id: "platformer", label: { "pt-BR": "Plataforma", en: "Platformer", es: "Plataformas" } },
  { id: "metroidvania", label: { "pt-BR": "Metroidvania", en: "Metroidvania", es: "Metroidvania" } },
  { id: "roguelike", label: { "pt-BR": "Roguelike", en: "Roguelike", es: "Roguelike" } },
  { id: "puzzle", label: { "pt-BR": "Puzzle", en: "Puzzle", es: "Puzle" } },
  { id: "simulation", label: { "pt-BR": "Simulação", en: "Simulation", es: "Simulación" } },
  { id: "strategy", label: { "pt-BR": "Estratégia", en: "Strategy", es: "Estrategia" } },
  { id: "narrative", label: { "pt-BR": "Narrativo", en: "Narrative", es: "Narrativo" } },
  { id: "other", label: { "pt-BR": "Outro", en: "Other", es: "Otro" } },
];

const FIGHTS: StarterGenre[] = ["action-rpg", "rpg", "metroidvania", "roguelike", "platformer"];

export const STARTER_QUESTIONS: StarterQuestion[] = [
  // ── Visão ──────────────────────────────────────────────────────────────
  {
    id: "vision.name",
    area: "vision",
    question: { "pt-BR": "Como o jogo se chama?", en: "What is the game called?", es: "¿Cómo se llama el juego?" },
    hint: { "pt-BR": "Pode ser provisório. Nome de trabalho também vale.", en: "It can be temporary. A working title is fine.", es: "Puede ser provisional. Un nombre de trabajo vale." },
    target: { kind: "vision", field: "title" },
    multiline: false,
  },
  {
    id: "vision.logline",
    area: "vision",
    question: { "pt-BR": "Em uma frase, do que ele trata?", en: "In one sentence, what is it about?", es: "En una frase, ¿de qué trata?" },
    hint: { "pt-BR": "A frase que você diria para alguém no elevador.", en: "What you'd say to someone in an elevator.", es: "Lo que le dirías a alguien en un ascensor." },
    target: { kind: "vision", field: "logline" },
    multiline: true,
  },
  {
    id: "vision.playerVerb",
    area: "vision",
    question: { "pt-BR": "O que o jogador faz na maior parte do tempo?", en: "What does the player do most of the time?", es: "¿Qué hace el jugador la mayor parte del tiempo?" },
    hint: { "pt-BR": "O verbo principal: lutar, explorar, construir, conversar…", en: "The main verb: fight, explore, build, talk…", es: "El verbo principal: luchar, explorar, construir, conversar…" },
    target: { kind: "vision", field: "playerVerb" },
    multiline: true,
  },
  {
    id: "vision.feeling",
    area: "vision",
    question: { "pt-BR": "Que sensação o jogo deve deixar?", en: "What feeling should the game leave?", es: "¿Qué sensación debe dejar el juego?" },
    hint: { "pt-BR": "O que a pessoa leva quando desliga.", en: "What people carry with them when they stop playing.", es: "Lo que la persona se lleva al apagar." },
    target: { kind: "vision", field: "feeling" },
    multiline: true,
  },
  {
    id: "vision.pillars",
    area: "vision",
    question: { "pt-BR": "Quais são os pilares do jogo?", en: "What are the game's pillars?", es: "¿Cuáles son los pilares del juego?" },
    hint: { "pt-BR": "Três ou quatro, um por linha. São as regras que decidem as brigas de design.", en: "Three or four, one per line. They settle design arguments.", es: "Tres o cuatro, uno por línea. Deciden las discusiones de diseño." },
    target: { kind: "vision", field: "pillars" },
    multiline: true,
  },

  // ── Documentação ───────────────────────────────────────────────────────
  {
    id: "docs.coreLoop",
    area: "docs",
    question: { "pt-BR": "O que o jogador faz em um minuto de jogo, do começo ao fim?", en: "What does the player do in one minute of play, start to finish?", es: "¿Qué hace el jugador en un minuto de juego, de principio a fin?" },
    hint: { "pt-BR": "O ciclo que se repete: ver, decidir, agir, ganhar alguma coisa.", en: "The loop that repeats: see, decide, act, gain something.", es: "El ciclo que se repite: ver, decidir, actuar, ganar algo." },
    target: { kind: "page", title: { "pt-BR": "Loop principal", en: "Core loop", es: "Bucle principal" }, domain: "other" },
    multiline: true,
  },
  {
    id: "docs.controls",
    area: "docs",
    question: { "pt-BR": "Como o jogador controla o jogo?", en: "How does the player control the game?", es: "¿Cómo controla el jugador el juego?" },
    hint: { "pt-BR": "Teclas, botões, toque — e o que cada um faz.", en: "Keys, buttons, touch — and what each one does.", es: "Teclas, botones, toque — y qué hace cada uno." },
    target: { kind: "page", title: { "pt-BR": "Controles", en: "Controls", es: "Controles" }, domain: "ui" },
    multiline: true,
  },
  {
    id: "docs.progression",
    area: "docs",
    question: { "pt-BR": "Como o jogador fica mais forte ao longo do jogo?", en: "How does the player get stronger over time?", es: "¿Cómo se vuelve más fuerte el jugador con el tiempo?" },
    hint: { "pt-BR": "Níveis, equipamento, habilidades novas, atalhos no mapa…", en: "Levels, gear, new abilities, map shortcuts…", es: "Niveles, equipo, habilidades nuevas, atajos en el mapa…" },
    target: { kind: "page", title: { "pt-BR": "Progressão", en: "Progression", es: "Progresión" }, domain: "progression" },
    multiline: true,
    notFor: ["puzzle", "narrative", "simulation"],
  },
  {
    id: "docs.difficulty",
    area: "docs",
    question: { "pt-BR": "Como os desafios ficam mais difíceis?", en: "How do the challenges get harder?", es: "¿Cómo se vuelven más difíciles los desafíos?" },
    hint: { "pt-BR": "Que regra nova entra em cada fase, e quando ela combina com as anteriores.", en: "Which new rule each stage adds, and when it combines with earlier ones.", es: "Qué regla nueva entra en cada fase, y cuándo se combina con las anteriores." },
    target: { kind: "page", title: { "pt-BR": "Curva de dificuldade", en: "Difficulty curve", es: "Curva de dificultad" }, domain: "progression" },
    multiline: true,
    onlyFor: ["puzzle"],
  },
  {
    id: "docs.growth",
    area: "docs",
    question: { "pt-BR": "O que o jogador constrói ou faz crescer?", en: "What does the player build or grow?", es: "¿Qué construye o hace crecer el jugador?" },
    hint: { "pt-BR": "A fazenda, a cidade, a empresa — e o que destrava cada etapa.", en: "The farm, the city, the company — and what unlocks each step.", es: "La granja, la ciudad, la empresa — y qué desbloquea cada etapa." },
    target: { kind: "page", title: { "pt-BR": "Progressão", en: "Progression", es: "Progresión" }, domain: "progression" },
    multiline: true,
    onlyFor: ["simulation"],
  },
  {
    id: "docs.story",
    area: "docs",
    question: { "pt-BR": "Qual é a história, em poucas frases?", en: "What's the story, in a few sentences?", es: "¿Cuál es la historia, en pocas frases?" },
    hint: { "pt-BR": "Quem quer o quê, o que impede, e como termina (pode ser só a ideia).", en: "Who wants what, what stands in the way, and how it ends (just the idea is fine).", es: "Quién quiere qué, qué lo impide y cómo termina (basta la idea)." },
    target: { kind: "page", title: { "pt-BR": "História", en: "Story", es: "Historia" }, domain: "narrative" },
    multiline: true,
  },
  {
    id: "docs.world",
    area: "docs",
    question: { "pt-BR": "Onde o jogo se passa?", en: "Where does the game take place?", es: "¿Dónde transcurre el juego?" },
    hint: { "pt-BR": "O mundo, a época, o tom. O que torna esse lugar diferente.", en: "The world, the era, the tone. What makes this place different.", es: "El mundo, la época, el tono. Qué hace distinto a ese lugar." },
    target: { kind: "page", title: { "pt-BR": "Mundo", en: "World", es: "Mundo" }, domain: "world" },
    multiline: true,
  },
  {
    id: "docs.art",
    area: "docs",
    question: { "pt-BR": "Como o jogo deve parecer e soar?", en: "How should the game look and sound?", es: "¿Cómo debe verse y sonar el juego?" },
    hint: { "pt-BR": "Estilo de arte, paleta de cores, jogos de referência, clima da música.", en: "Art style, color palette, reference games, mood of the music.", es: "Estilo de arte, paleta de colores, juegos de referencia, clima de la música." },
    target: { kind: "page", title: { "pt-BR": "Direção de arte e som", en: "Art and sound direction", es: "Dirección de arte y sonido" }, domain: "audio" },
    multiline: true,
  },

  // ── Biblioteca ─────────────────────────────────────────────────────────
  {
    id: "library.hero",
    area: "library",
    question: { "pt-BR": "Quem é o protagonista?", en: "Who is the protagonist?", es: "¿Quién es el protagonista?" },
    hint: { "pt-BR": "O que quer, o que sabe fazer, o que o diferencia.", en: "What they want, what they can do, what sets them apart.", es: "Qué quiere, qué sabe hacer, qué lo diferencia." },
    target: { kind: "page", title: { "pt-BR": "Protagonista", en: "Protagonist", es: "Protagonista" }, domain: "characters" },
    multiline: true,
    notFor: ["puzzle", "strategy", "simulation"],
  },
  {
    id: "library.enemies",
    area: "library",
    question: { "pt-BR": "Quais inimigos o jogador enfrenta?", en: "Which enemies does the player face?", es: "¿Qué enemigos enfrenta el jugador?" },
    hint: { "pt-BR": "Um por linha, com o papel de cada um: o que patrulha, o que atira, o que aguenta pancada.", en: "One per line, with each one's role: the patroller, the shooter, the tank.", es: "Uno por línea, con el papel de cada uno: el que patrulla, el que dispara, el que aguanta." },
    target: { kind: "page", title: { "pt-BR": "Inimigos", en: "Enemies", es: "Enemigos" }, domain: "combat" },
    multiline: true,
    onlyFor: FIGHTS,
  },
  {
    id: "library.items",
    area: "library",
    question: { "pt-BR": "Que coisas o jogador coleta ou usa?", en: "What does the player collect or use?", es: "¿Qué recoge o usa el jugador?" },
    hint: { "pt-BR": "Itens, recursos, cartas, peças — o que existir no seu jogo.", en: "Items, resources, cards, pieces — whatever your game has.", es: "Objetos, recursos, cartas, piezas — lo que exista en tu juego." },
    target: { kind: "page", title: { "pt-BR": "Itens", en: "Items", es: "Objetos" }, domain: "items" },
    multiline: true,
  },
  {
    id: "library.places",
    area: "library",
    question: { "pt-BR": "Quais lugares o jogador visita?", en: "Which places does the player visit?", es: "¿Qué lugares visita el jugador?" },
    hint: { "pt-BR": "Fases, regiões, telas. Um por linha, na ordem em que aparecem.", en: "Levels, regions, screens. One per line, in the order they appear.", es: "Fases, regiones, pantallas. Uno por línea, en el orden en que aparecen." },
    target: { kind: "page", title: { "pt-BR": "Locais", en: "Places", es: "Lugares" }, domain: "world" },
    multiline: true,
  },

  // ── Sistemas ───────────────────────────────────────────────────────────
  {
    id: "systems.economy",
    area: "systems",
    question: { "pt-BR": "O que o jogador ganha e em que ele gasta?", en: "What does the player earn, and what do they spend it on?", es: "¿Qué gana el jugador y en qué lo gasta?" },
    hint: { "pt-BR": "Moedas, XP, recursos — de onde vem cada um e para onde vai.", en: "Coins, XP, resources — where each comes from and where it goes.", es: "Monedas, XP, recursos — de dónde viene cada uno y a dónde va." },
    target: { kind: "page", title: { "pt-BR": "Economia", en: "Economy", es: "Economía" }, domain: "economy" },
    multiline: true,
  },
  {
    id: "systems.failure",
    area: "systems",
    question: { "pt-BR": "O que acontece quando o jogador falha?", en: "What happens when the player fails?", es: "¿Qué pasa cuando el jugador falla?" },
    hint: { "pt-BR": "O que ele perde, de onde recomeça, o que fica.", en: "What they lose, where they restart, what they keep.", es: "Qué pierde, desde dónde vuelve a empezar, qué conserva." },
    target: { kind: "page", title: { "pt-BR": "Falha e recomeço", en: "Failure and retry", es: "Fallo y reintento" }, domain: "progression" },
    multiline: true,
  },
  {
    id: "systems.longLoop",
    area: "systems",
    question: { "pt-BR": "O que faz o jogador voltar amanhã?", en: "What brings the player back tomorrow?", es: "¿Qué hace que el jugador vuelva mañana?" },
    hint: { "pt-BR": "O objetivo de longo prazo: a próxima área, o próximo chefe, a coleção quase completa.", en: "The long-term goal: the next area, the next boss, the almost-complete collection.", es: "El objetivo a largo plazo: la próxima zona, el próximo jefe, la colección casi completa." },
    target: { kind: "page", title: { "pt-BR": "Loop de longo prazo", en: "Long-term loop", es: "Bucle a largo plazo" }, domain: "progression" },
    multiline: true,
  },
];

export const STARTER_AREAS: StarterArea[] = ["vision", "docs", "library", "systems"];

/** As perguntas de uma área que valem para o gênero escolhido (sem gênero, as gerais). */
export function starterQuestionsFor(area: StarterArea, genre?: string): StarterQuestion[] {
  const g = (genre || "other") as StarterGenre;
  return STARTER_QUESTIONS.filter(
    (q) => q.area === area && (!q.onlyFor || q.onlyFor.includes(g)) && !q.notFor?.includes(g),
  );
}

/** Progresso guardado em `project.vision.starter`. */
export type StarterProgress = { answered: string[]; skipped: string[]; doneAt?: string };

/** As perguntas ainda abertas (nem respondidas nem puladas), na ordem das áreas. */
export function openStarterQuestions(progress: StarterProgress | undefined, genre?: string): StarterQuestion[] {
  const closed = new Set([...(progress?.answered ?? []), ...(progress?.skipped ?? [])]);
  return STARTER_AREAS.flatMap((area) => starterQuestionsFor(area, genre)).filter((q) => !closed.has(q.id));
}

export function localized(text: LocalizedText, locale: string): string {
  return text[locale as keyof LocalizedText] ?? text.en;
}
