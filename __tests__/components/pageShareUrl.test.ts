import { pageShareUrl } from "@/components/project/PageModeLinks";

const SECTION_ID = "2b9e4f17-6a3c-4d85-8e1b-0c7f9a2d5e31";

describe("pageShareUrl", () => {
  it("sem link público, devolve a rota interna em slug do mesmo modo", () => {
    const project = { title: "Colheita Feliz" };
    expect(pageShareUrl("doc", { project, sectionId: SECTION_ID })).toEqual({
      kind: "internal",
      path: `/projects/colheita-feliz/view?focus=${SECTION_ID}`,
    });
    expect(pageShareUrl("graph", { project, sectionId: SECTION_ID }).path).toBe(
      `/projects/colheita-feliz/mindmap?focus=${SECTION_ID}`
    );
  });

  it("com link público ligado, o dono copia a URL pública", () => {
    const project = {
      title: "Colheita Feliz",
      mindMapSettings: { sharing: { isPublic: true, shareToken: "tok123" } },
    };
    expect(pageShareUrl("deck", { project, sectionId: SECTION_ID })).toEqual({
      kind: "public",
      path: `/s/tok123?mode=deck&focus=${SECTION_ID}`,
    });
  });

  it("token guardado com o link público desligado não vaza", () => {
    const project = {
      title: "Colheita Feliz",
      mindMapSettings: { sharing: { isPublic: false, shareToken: "tok123" } },
    };
    expect(pageShareUrl("doc", { project, sectionId: SECTION_ID }).kind).toBe("internal");
  });

  it("quem chegou pelo token reaproveita o token, mesmo sem sharing no projeto", () => {
    expect(
      pageShareUrl("graph", { project: { title: "X" }, sectionId: SECTION_ID, publicToken: "tok123" })
    ).toEqual({ kind: "public", path: `/s/tok123?mode=mindmap&focus=${SECTION_ID}` });
  });
});
