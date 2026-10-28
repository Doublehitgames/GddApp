import {
  resolveTemplateFromWizard,
  type TemplateSection,
  type WizardGenre,
  type WizardScope,
} from "@/lib/templates/manualTemplates";

const GENRES: WizardGenre[] = ["rpg", "roguelike", "platformer", "puzzle", "simulation"];
const SCOPES: WizardScope[] = ["mini", "medio", "completo"];

function collectIds(sections: TemplateSection[]): string[] {
  return sections.flatMap((s) => [s.id, ...collectIds(s.subsections ?? [])]);
}

describe("resolveTemplateFromWizard", () => {
  it.each(GENRES.flatMap((genre) => SCOPES.map((scope) => [genre, scope] as const)))(
    "%s/%s não repete página",
    (genre, scope) => {
      const { sections } = resolveTemplateFromWizard({
        projectType: "digital_game",
        genre,
        platforms: ["pc"],
        scope,
        style: "padrao",
      });
      const ids = collectIds(sections);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  );
});
