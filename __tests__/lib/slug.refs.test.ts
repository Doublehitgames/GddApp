import {
  canonicalProjectPathname,
  findProjectByRef,
  findSectionByRef,
  stableSectionSegment,
} from "@/lib/utils/slug";

const PROJECT_ID = "8f0c7a52-3d1e-4b6a-9c2f-5e7d1a4b3c90";
const SECTION_ID = "2b9e4f17-6a3c-4d85-8e1b-0c7f9a2d5e31";
const OTHER_ID = "c4d8a1e6-7b2f-4e93-a5c0-1f6e8b3d9a72";
const TWIN_ID = "e1a7c3b9-5d4f-4a28-b6e0-9c2d7f1a8b54";

const project = {
  id: PROJECT_ID,
  title: "Colheita Feliz",
  sections: [
    { id: SECTION_ID, title: "🌽 Milho" },
    { id: OTHER_ID, title: "Moinho" },
  ],
};
const projects = [project];

describe("findProjectByRef / findSectionByRef", () => {
  it("acha pelo UUID e pelo slug", () => {
    expect(findProjectByRef(projects, PROJECT_ID)?.id).toBe(PROJECT_ID);
    expect(findProjectByRef(projects, "colheita-feliz")?.id).toBe(PROJECT_ID);
    expect(findSectionByRef(project.sections, SECTION_ID)?.id).toBe(SECTION_ID);
    expect(findSectionByRef(project.sections, "milho")?.id).toBe(SECTION_ID);
  });

  it("slug que não existe continua sem achar nada", () => {
    expect(findProjectByRef(projects, "nao-existe")).toBeUndefined();
    expect(findSectionByRef(project.sections, "nao-existe")).toBeUndefined();
  });
});

describe("canonicalProjectPathname", () => {
  it("troca o link por UUID (o do plugin Unity) pela forma em slug", () => {
    expect(
      canonicalProjectPathname(`/projects/${PROJECT_ID}/sections/${SECTION_ID}`, projects, project)
    ).toBe("/projects/colheita-feliz/sections/milho");
    expect(canonicalProjectPathname(`/projects/${PROJECT_ID}/mindmap`, projects, project)).toBe(
      "/projects/colheita-feliz/mindmap"
    );
    expect(
      canonicalProjectPathname(`/projects/colheita-feliz/sections/${SECTION_ID}/diagramas`, projects, project)
    ).toBe("/projects/colheita-feliz/sections/milho/diagramas");
  });

  it("URL que já está em slug não é trocada", () => {
    expect(canonicalProjectPathname("/projects/colheita-feliz", projects, project)).toBeNull();
    expect(canonicalProjectPathname("/projects/colheita-feliz/sections/milho", projects, project)).toBeNull();
  });

  it("página que não existe fica como veio, para a tela mostrar 'não encontrada'", () => {
    expect(
      canonicalProjectPathname("/projects/colheita-feliz/sections/nao-existe", projects, project)
    ).toBeNull();
    expect(canonicalProjectPathname(`/projects/${PROJECT_ID}/sections/nao-existe`, projects, project)).toBe(
      "/projects/colheita-feliz/sections/nao-existe"
    );
  });

  it("com dois títulos de mesmo slug, o UUID fica — o slug abriria a outra página", () => {
    const withTwin = {
      ...project,
      sections: [...project.sections, { id: TWIN_ID, title: "Moinho!" }],
    };
    expect(stableSectionSegment(withTwin.sections, withTwin.sections[2])).toBe(TWIN_ID);
    expect(
      canonicalProjectPathname(`/projects/${PROJECT_ID}/sections/${TWIN_ID}`, [withTwin], withTwin)
    ).toBe(`/projects/colheita-feliz/sections/${TWIN_ID}`);
    expect(
      canonicalProjectPathname(`/projects/colheita-feliz/sections/${TWIN_ID}`, [withTwin], withTwin)
    ).toBeNull();
  });
});
