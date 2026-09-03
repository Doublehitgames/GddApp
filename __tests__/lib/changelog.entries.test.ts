import {
  buildChangelogEntries,
  countSince,
  filterChangelogEntries,
  groupByDay,
  listAuthors,
} from "@/lib/changelog/entries";
import type { SectionVersionRow } from "@/lib/changelog/types";

const BASE = "2026-08-20T10:00:00.000Z";

function version(over: Partial<SectionVersionRow> & { section_id: string; created_at: string }): SectionVersionRow {
  return {
    id: `${over.section_id}-${over.created_at}`,
    project_id: "p1",
    title: "Galinha",
    content: "",
    sort_order: 0,
    color: null,
    updated_by: null,
    updated_by_name: "Julio",
    origin: "app",
    ...over,
  };
}

const galinha = { id: "s1", title: "🐔Galinha", created_at: BASE };

describe("buildChangelogEntries", () => {
  it("chama de criada a primeira versão que nasce junto com a página", () => {
    const entries = buildChangelogEntries({
      versions: [version({ section_id: "s1", created_at: BASE, content: "Bota ovos." })],
      sections: [galinha],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("created");
    expect(entries[0].sectionTitle).toBe("🐔Galinha");
    expect(entries[0].before).toBe("");
  });

  it("chama de editada a primeira versão quando a página é bem mais velha", () => {
    const entries = buildChangelogEntries({
      versions: [version({ section_id: "s1", created_at: "2026-08-25T10:00:00.000Z" })],
      sections: [galinha],
    });

    expect(entries[0].kind).toBe("edited");
  });

  it("separa renomear de editar", () => {
    const entries = buildChangelogEntries({
      versions: [
        version({ section_id: "s1", created_at: BASE, title: "Galinha", content: "Bota ovos." }),
        version({ section_id: "s1", created_at: "2026-08-21T10:00:00.000Z", title: "🐔Galinha", content: "Bota ovos." }),
        version({ section_id: "s1", created_at: "2026-08-22T10:00:00.000Z", title: "🐔Galinha", content: "Bota dois ovos." }),
      ],
      sections: [galinha],
    });

    expect(entries.map((e) => e.kind)).toEqual(["edited", "renamed", "created"]);
    const renamed = entries.find((e) => e.kind === "renamed")!;
    expect(renamed.previousTitle).toBe("Galinha");
  });

  it("liga a versão nova à anterior para formar o par do diff", () => {
    const entries = buildChangelogEntries({
      versions: [
        version({ section_id: "s1", created_at: BASE, content: "Bota 10 ovos." }),
        version({ section_id: "s1", created_at: "2026-08-21T10:00:00.000Z", content: "Bota 12 ovos." }),
      ],
      sections: [galinha],
    });

    const edited = entries[0];
    expect(edited.before).toBe("Bota 10 ovos.");
    expect(edited.after).toBe("Bota 12 ovos.");
  });

  it("descarta save que não mudou nada visível", () => {
    const entries = buildChangelogEntries({
      versions: [
        version({ section_id: "s1", created_at: BASE, content: "Igual." }),
        version({ section_id: "s1", created_at: "2026-08-21T10:00:00.000Z", content: "Igual." }),
      ],
      sections: [galinha],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("created");
  });

  it("traz páginas apagadas do log, já que o snapshot some junto", () => {
    const entries = buildChangelogEntries({
      versions: [],
      sections: [],
      activity: [
        {
          id: "e1",
          project_id: "p1",
          section_id: "s9",
          section_title: "Espantalho",
          action: "deleted",
          created_at: "2026-08-23T10:00:00.000Z",
          user_name: "Julio",
          origin: "app",
        },
      ],
    });

    expect(entries[0].kind).toBe("deleted");
    expect(entries[0].sectionExists).toBe(false);
  });

  it("não duplica criação que já veio como versão", () => {
    const entries = buildChangelogEntries({
      versions: [version({ section_id: "s1", created_at: BASE })],
      sections: [galinha],
      activity: [
        {
          id: "e1",
          project_id: "p1",
          section_id: "s1",
          section_title: "Galinha",
          action: "created",
          created_at: BASE,
          user_name: "Julio",
          origin: "app",
        },
      ],
    });

    expect(entries).toHaveLength(1);
  });

  it("marca a origem do agente", () => {
    const entries = buildChangelogEntries({
      versions: [version({ section_id: "s1", created_at: BASE, origin: "mcp" })],
      sections: [galinha],
    });

    expect(entries[0].origin).toBe("mcp");
  });
});

describe("filtros e agrupamento", () => {
  const entries = buildChangelogEntries({
    versions: [
      version({ section_id: "s1", created_at: "2026-08-20T10:00:00.000Z", content: "a" }),
      version({ section_id: "s1", created_at: "2026-08-28T10:00:00.000Z", content: "b", updated_by_name: "Ana", origin: "mcp" }),
    ],
    sections: [galinha],
  });
  const now = new Date("2026-08-29T10:00:00.000Z").getTime();

  it("corta pela janela de dias", () => {
    expect(filterChangelogEntries(entries, { days: 7, author: null, origin: "all" }, now)).toHaveLength(1);
    expect(filterChangelogEntries(entries, { days: null, author: null, origin: "all" }, now)).toHaveLength(2);
  });

  it("filtra por autor e por origem", () => {
    expect(filterChangelogEntries(entries, { days: null, author: "Ana", origin: "all" }, now)).toHaveLength(1);
    expect(filterChangelogEntries(entries, { days: null, author: null, origin: "mcp" }, now)).toHaveLength(1);
  });

  it("agrupa por dia mantendo a ordem decrescente", () => {
    const days = groupByDay(entries);
    expect(days).toHaveLength(2);
    expect(days[0].entries[0].at).toBe("2026-08-28T10:00:00.000Z");
  });

  it("lista autores e conta novidades desde um instante", () => {
    expect(listAuthors(entries)).toEqual(["Ana", "Julio"]);
    expect(countSince(entries, "2026-08-25T00:00:00.000Z")).toBe(1);
    expect(countSince(entries, null)).toBe(0);
  });
});
