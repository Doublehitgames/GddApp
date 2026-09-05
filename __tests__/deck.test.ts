import {
  buildDeckTree,
  caretOffset,
  colorOf,
  columnsForWidth,
  drawerInsertionIndex,
  iconOf,
  initialsOf,
  inkOn,
  isInventory,
  labelOf,
  levelOf,
  pathOf,
  placeInDeck,
  splitTitleIcon,
  type DeckSection,
} from "@/lib/deck/deck";

const s = (id: string, title: string, extra: Partial<DeckSection> = {}): DeckSection => ({
  id,
  title,
  created_at: "2026-01-01T00:00:00.000Z",
  ...extra,
});

describe("buildDeckTree", () => {
  const sections: DeckSection[] = [
    s("insumos", "📦 Insumos", { order: 1 }),
    s("sementes", "🌰 Sementes", { parentId: "insumos", order: 0, color: "#4e9a3e" }),
    s("ferramentas", "Ferramentas", { parentId: "insumos", order: 1 }),
    s("cenoura", "🥕 Semente de Cenoura", { parentId: "sementes", order: 0 }),
    s("crescimento", "📈 Crescimento", { parentId: "cenoura", order: 0 }),
    s("mecanica", "🌾 Mecânica de Fazenda", { order: 0 }),
  ];

  const tree = buildDeckTree(sections);

  it("ordena as raízes por order", () => {
    expect(tree.roots.map((n) => n.section.id)).toEqual(["mecanica", "insumos"]);
  });

  it("conta o ramo inteiro, não só as filhas diretas", () => {
    const insumos = tree.byId.get("insumos")!;
    expect(insumos.children).toHaveLength(2);
    expect(insumos.branchTotal).toBe(4); // sementes, ferramentas, cenoura, crescimento
  });

  it("monta a trilha da raiz até a folha", () => {
    const trail = pathOf(tree, tree.byId.get("crescimento")!);
    expect(trail.map((n) => n.section.id)).toEqual(["insumos", "sementes", "cenoura", "crescimento"]);
  });

  it("sobe para a raiz quem aponta para um pai que não existe", () => {
    const órfã = buildDeckTree([s("a", "A"), s("b", "B", { parentId: "sumiu" })]);
    expect(órfã.roots.map((n) => n.section.id).sort()).toEqual(["a", "b"]);
  });

  it("não trava com ciclo em parentId", () => {
    const cíclica = buildDeckTree([
      s("x", "X", { parentId: "y" }),
      s("y", "Y", { parentId: "x" }),
    ]);
    expect(cíclica.byId.size).toBe(2);
  });
});

describe("cor herdada", () => {
  const tree = buildDeckTree([
    s("social", "Social", { color: "#c05780" }),
    s("visitas", "Visitas", { parentId: "social" }),
    s("sem-cor", "Solta"),
    s("azul", "Azul", { color: "#ABC" }),
  ]);

  it("usa a cor do ancestral mais próximo", () => {
    expect(colorOf(tree, tree.byId.get("visitas")!)).toBe("#c05780");
  });

  it("cai no neutro quando ninguém no caminho tem cor", () => {
    expect(colorOf(tree, tree.byId.get("sem-cor")!)).toBe("#64748B");
  });

  it("aceita hex de 3 dígitos", () => {
    expect(colorOf(tree, tree.byId.get("azul")!)).toBe("#aabbcc");
  });

  it("escolhe a tinta pelo contraste", () => {
    expect(inkOn("#1f2937")).toBe("#ffffff");
    expect(inkOn("#fde68a")).toBe("#1f2937");
    expect(inkOn("#4e9a3e")).toBe("#ffffff");
  });
});

describe("cascata do ícone", () => {
  it("usa a imagem da página quando existe", () => {
    expect(iconOf(s("a", "🌰 Sementes", { thumbImageUrl: "https://x/y.png" }))).toEqual({
      kind: "image",
      url: "https://x/y.png",
    });
  });

  it("usa o emoji do título quando não há imagem", () => {
    expect(iconOf(s("a", "🦴Osso"))).toEqual({ kind: "emoji", char: "🦴" });
  });

  it("cai nas iniciais quando não há emoji", () => {
    expect(iconOf(s("a", "Semente de Ervilha"))).toEqual({ kind: "initials", text: "SE" });
    expect(initialsOf("Ração")).toBe("R");
    expect(initialsOf("")).toBe("?");
  });

  it("separa emoji composto sem comer o nome", () => {
    expect(splitTitleIcon("🧑‍🌾 Personagens")).toEqual({ emoji: "🧑‍🌾", text: "Personagens" });
    expect(splitTitleIcon("🗺️Mapa")).toEqual({ emoji: "🗺️", text: "Mapa" });
  });

  it("não esvazia um título que é só emoji", () => {
    expect(splitTitleIcon("🌱").text).toBe("🌱");
  });

  it("tira do rótulo o emoji que virou ícone, mas mantém quando o ícone é imagem", () => {
    expect(labelOf(s("a", "🌰 Sementes"))).toBe("Sementes");
    expect(labelOf(s("a", "🌰 Sementes", { thumbImageUrl: "https://x/y.png" }))).toBe("🌰 Sementes");
  });
});

describe("regra do inventário", () => {
  const filhas = (n: number) =>
    Array.from({ length: n }, (_, i) => s(`k${i}`, `Filha ${i}`, { parentId: "pai", order: i }));

  it("vira parede de cartas a partir de 20 filhas", () => {
    const magra = buildDeckTree([s("pai", "Pai"), ...filhas(19)]);
    const gorda = buildDeckTree([s("pai", "Pai"), ...filhas(20)]);
    expect(isInventory(magra.byId.get("pai")!, magra)).toBe(false);
    expect(isInventory(gorda.byId.get("pai")!, gorda)).toBe(true);
  });

  it("um capítulo gordo continua sendo capítulo", () => {
    // Insumos, Economia e Progressão têm de 8 a 11 filhas no GDD real e são
    // capítulos — foi por isso que o corte saiu de 8 para 20.
    const capitulo = buildDeckTree([s("pai", "Pai"), ...filhas(11)]);
    expect(isInventory(capitulo.byId.get("pai")!, capitulo)).toBe(false);
  });

  it("a escolha da pessoa manda sobre a contagem", () => {
    // Um capítulo de 3 filhas que alguém quis ver como grade
    const forcaGrade = buildDeckTree([
      s("pai", "Pai", { deckLayout: "grid" }),
      ...filhas(3),
    ]);
    expect(isInventory(forcaGrade.byId.get("pai")!, forcaGrade)).toBe(true);

    // E um inventário de 30 que alguém preferiu ler como lista
    const forcaLista = buildDeckTree([
      s("pai", "Pai", { deckLayout: "list" }),
      ...filhas(30),
    ]);
    expect(isInventory(forcaLista.byId.get("pai")!, forcaLista)).toBe(false);
  });

  it("valor estranho no campo cai no automático em vez de quebrar", () => {
    const tree = buildDeckTree([
      s("pai", "Pai", { deckLayout: "mosaico" as never }),
      ...filhas(30),
    ]);
    expect(isInventory(tree.byId.get("pai")!, tree)).toBe(true);
  });

  it("o térreo nunca é inventário, por mais raízes que existam", () => {
    const tree = buildDeckTree(Array.from({ length: 30 }, (_, i) => s(`r${i}`, `Raiz ${i}`, { order: i })));
    expect(levelOf(tree, null)).toHaveLength(30);
    expect(isInventory(null, tree)).toBe(false);
  });
});

describe("onde uma página aparece no Deck", () => {
  // Um GDD com as duas formas: Insumos é capítulo (poucas filhas, vira carta
  // com gaveta) e Sementes é inventário (muitas filhas, vira andar).
  const sementes = Array.from({ length: 24 }, (_, i) =>
    s(`sem${i}`, `Semente ${i}`, { parentId: "sementes", order: i })
  );
  const tree = buildDeckTree([
    s("insumos", "Insumos", { order: 0 }),
    s("sementes", "Sementes", { parentId: "insumos", order: 0 }),
    s("frutos", "Frutos", { parentId: "insumos", order: 1 }),
    ...sementes,
    s("cor", "Cor da semente", { parentId: "sem0", order: 0 }),
  ]);

  it("uma raiz é carta do térreo", () => {
    expect(placeInDeck(tree, "insumos")).toEqual({
      floorId: null,
      openId: "insumos",
      menuId: "insumos",
      contentId: "insumos",
    });
  });

  it("um capítulo não vira andar: reabre como carta com gaveta", () => {
    // É o caminho da trilha — clicar em "Insumos" a partir do andar Sementes
    // tem que devolver o capítulo do mesmo jeito que ele aparece por cima.
    expect(isInventory(tree.byId.get("insumos")!, tree)).toBe(false);
    expect(placeInDeck(tree, "insumos")!.floorId).toBeNull();
  });

  it("um inventário aparece como carta, com a passagem para o andar dentro", () => {
    // Sementes mora na lista da gaveta de Insumos; virar andar é um clique a
    // mais, e não o efeito colateral de chegar nela.
    expect(placeInDeck(tree, "sementes")).toEqual({
      floorId: null,
      openId: "insumos",
      menuId: "insumos",
      contentId: "sementes",
    });
  });

  it("uma filha de inventário é carta do andar do inventário", () => {
    expect(placeInDeck(tree, "sem3")).toEqual({
      floorId: "sementes",
      openId: "sem3",
      menuId: null,
      contentId: "sem3",
    });
  });

  it("uma neta sobe até a carta que o andar mostra, e o menu é o pai", () => {
    expect(placeInDeck(tree, "cor")).toEqual({
      floorId: "sementes",
      openId: "sem0",
      menuId: "sem0",
      contentId: "cor",
    });
  });

  it("pula os capítulos empilhados até achar o andar de verdade", () => {
    const fundo = buildDeckTree([
      s("a", "Capítulo A"),
      s("b", "Capítulo B", { parentId: "a" }),
      s("c", "Capítulo C", { parentId: "b" }),
      s("d", "Página D", { parentId: "c" }),
    ]);
    expect(placeInDeck(fundo, "d")).toEqual({
      floorId: null,
      openId: "a",
      menuId: "c",
      contentId: "d",
    });
  });

  it("página que sumiu do projeto não posiciona nada", () => {
    expect(placeInDeck(tree, "fantasma")).toBeNull();
  });
});

describe("corte na linha", () => {
  it("conta colunas como o auto-fill do CSS", () => {
    // 1180 de largura, cartas de 172 com 14 de gap → 6 colunas
    expect(columnsForWidth(1180, 172, 14)).toBe(6);
    expect(columnsForWidth(360, 172, 14)).toBe(2);
    expect(columnsForWidth(100, 172, 14)).toBe(1);
    expect(columnsForWidth(0, 172, 14)).toBe(1);
  });

  it("abre a gaveta depois da última carta da linha", () => {
    // 11 cartas em 4 colunas: linhas [0-3] [4-7] [8-10]
    expect(drawerInsertionIndex(0, 4, 11)).toBe(4);
    expect(drawerInsertionIndex(5, 4, 11)).toBe(8);
    expect(drawerInsertionIndex(9, 4, 11)).toBe(11); // última linha → fim da grade
  });

  it("aponta a setinha para o centro da carta aberta", () => {
    // 4 colunas em 440px com gap 20 → célula de 95
    expect(caretOffset(0, 4, 440, 20)).toBeCloseTo(47.5);
    expect(caretOffset(1, 4, 440, 20)).toBeCloseTo(162.5);
    expect(caretOffset(5, 4, 440, 20)).toBeCloseTo(162.5); // mesma coluna, outra linha
  });
});
