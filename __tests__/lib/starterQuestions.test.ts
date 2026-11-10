import * as fs from "fs";
import {
  STARTER_AREAS,
  STARTER_GENRES,
  STARTER_QUESTIONS,
  isStarterAnswered,
  isStarterClosed,
  openStarterQuestions,
  starterQuestionsFor,
} from "@/lib/onboarding/starterQuestions";

describe("starter questions", () => {
  it("the npm server ships the very same file", () => {
    // O pacote do MCP precisa ser autocontido; a cópia não pode divergir.
    expect(fs.readFileSync("packages/mcp-server/src/starterQuestions.ts", "utf8")).toBe(
      fs.readFileSync("lib/onboarding/starterQuestions.ts", "utf8"),
    );
  });

  it("ids are unique and every question has text in the three languages", () => {
    const ids = STARTER_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of STARTER_QUESTIONS) {
      for (const text of [q.question, q.hint]) {
        expect(text["pt-BR"]).toBeTruthy();
        expect(text.en).toBeTruthy();
        expect(text.es).toBeTruthy();
      }
    }
  });

  it.each(STARTER_GENRES.map((g) => g.id))("%s gets questions in every area, and the vision is always five", (genre) => {
    for (const area of STARTER_AREAS) expect(starterQuestionsFor(area, genre).length).toBeGreaterThan(0);
    expect(starterQuestionsFor("vision", genre)).toHaveLength(5);
  });

  it("genre swaps a question instead of piling one on", () => {
    const ids = (genre: string) => starterQuestionsFor("docs", genre).map((q) => q.id);
    expect(ids("action-rpg")).toContain("docs.progression");
    expect(ids("puzzle")).toContain("docs.difficulty");
    expect(ids("puzzle")).not.toContain("docs.progression");
    expect(ids("simulation")).toContain("docs.growth");
  });

  describe("answered means there is content", () => {
    const logline = STARTER_QUESTIONS.find((q) => q.id === "vision.logline")!;
    const title = STARTER_QUESTIONS.find((q) => q.id === "vision.name")!;
    const story = STARTER_QUESTIONS.find((q) => q.id === "docs.story")!;

    it("a vision field filled anywhere closes its question", () => {
      expect(isStarterAnswered(logline, { vision: { logline: "Um aprendiz quebra o tempo." }, rootPageTitles: [] })).toBe(true);
      expect(isStarterAnswered(logline, { vision: { logline: "  " }, rootPageTitles: [] })).toBe(false);
    });

    it("a root page with the question's title — in any language — closes it", () => {
      expect(isStarterAnswered(story, { rootPageTitles: ["história"] })).toBe(true);
      expect(isStarterAnswered(story, { rootPageTitles: ["Story"] })).toBe(true);
      expect(isStarterAnswered(story, { rootPageTitles: ["Mundo"] })).toBe(false);
    });

    it("every project has a title, so the name only closes when actually answered", () => {
      expect(isStarterAnswered(title, { rootPageTitles: [] })).toBe(false);
      expect(isStarterAnswered(title, { vision: { starter: { answered: ["vision.name"], skipped: [] } }, rootPageTitles: [] })).toBe(true);
    });

    it("skipped is closed but not answered", () => {
      const state = { vision: { starter: { answered: [], skipped: ["docs.story"] } }, rootPageTitles: [] };
      expect(isStarterAnswered(story, state)).toBe(false);
      expect(isStarterClosed(story, state)).toBe(true);
      expect(openStarterQuestions(state).map((q) => q.id)).not.toContain("docs.story");
    });
  });
});

/**
 * The app saved the genre as its translated label ("RPG de ação") while the
 * questions looked it up by id ("action-rpg"), so picking a genre never changed
 * the questions. Now the id is stored, and both forms are recognised.
 */
describe("genre", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { starterGenreOf, genreLabel } = require("@/lib/onboarding/starterQuestions") as typeof import("@/lib/onboarding/starterQuestions");

  it("is recognised by id or by its label in any language", () => {
    expect(starterGenreOf("action-rpg")).toBe("action-rpg");
    expect(starterGenreOf("RPG de ação")).toBe("action-rpg");
    expect(starterGenreOf(" puzzle ")).toBe("puzzle");
    expect(starterGenreOf("Simulación")).toBe("simulation");
    expect(starterGenreOf("Fazendinha")).toBeUndefined();
    expect(starterGenreOf(undefined)).toBeUndefined();
  });

  it("changes the questions whether it was saved as id or as label", () => {
    const ids = (genre: string) => starterQuestionsFor("docs", genre).map((q) => q.id);
    expect(ids("Puzzle")).toEqual(ids("puzzle"));
    expect(ids("puzzle")).not.toEqual(ids("other"));
  });

  it("shows as the label of the screen's language, or as the text it was given", () => {
    expect(genreLabel("simulation", "pt-BR")).toBe("Simulação");
    expect(genreLabel("RPG de ação", "en")).toBe("Action RPG");
    expect(genreLabel("Fazendinha", "pt-BR")).toBe("Fazendinha");
    expect(genreLabel(undefined, "pt-BR")).toBe("");
  });
});
