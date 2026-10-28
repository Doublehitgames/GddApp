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
export type StarterGenre = "action-rpg" | "rpg" | "platformer" | "metroidvania" | "roguelike" | "puzzle" | "simulation" | "strategy" | "narrative" | "other";
export type LocalizedText = {
    "pt-BR": string;
    en: string;
    es: string;
};
export type StarterTarget = {
    kind: "vision";
    field: "title" | "logline" | "playerVerb" | "feeling" | "pillars";
} | {
    kind: "page";
    title: LocalizedText;
    domain: string;
};
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
export declare const STARTER_GENRES: {
    id: StarterGenre;
    label: LocalizedText;
}[];
export declare const STARTER_QUESTIONS: StarterQuestion[];
export declare const STARTER_AREAS: StarterArea[];
/** As perguntas de uma área que valem para o gênero escolhido (sem gênero, as gerais). */
export declare function starterQuestionsFor(area: StarterArea, genre?: string): StarterQuestion[];
/** Progresso guardado em `project.vision.starter`. */
export type StarterProgress = {
    answered: string[];
    skipped: string[];
    doneAt?: string;
};
/**
 * O que é preciso saber do projeto para dizer se uma pergunta já tem resposta.
 * `rootPageTitles` são os títulos das páginas de primeiro nível.
 */
export type StarterState = {
    vision?: {
        logline?: string;
        playerVerb?: string;
        feeling?: string;
        pillars?: string[];
        genre?: string;
        starter?: StarterProgress;
    } | null;
    rootPageTitles: string[];
};
/**
 * Respondida é o que tem conteúdo, não só o que passou pela gaveta: um agente
 * que preenche a Visão pelo MCP, ou alguém que cria a página "História" à mão,
 * também fecha a pergunta. O nome do jogo só fecha quando foi respondido de
 * fato — todo projeto tem um título, nem que seja "Projeto sem nome".
 */
export declare function isStarterAnswered(q: StarterQuestion, state: StarterState): boolean;
export declare function isStarterClosed(q: StarterQuestion, state: StarterState): boolean;
/** As perguntas ainda abertas (nem respondidas nem puladas), na ordem das áreas. */
export declare function openStarterQuestions(state: StarterState): StarterQuestion[];
export declare function localized(text: LocalizedText, locale: string): string;
