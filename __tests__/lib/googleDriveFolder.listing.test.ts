/**
 * A varredura da pasta do Drive: recursão nas subpastas, caminho relativo,
 * proteção contra ciclo e propagação de erro com o que já foi coletado.
 */

import { listDriveFolderImages, imageLabel } from "@/lib/googleDriveFolder";

const FOLDER = "application/vnd.google-apps.folder";

type Entry = { id: string; name: string; mimeType: string };

/** Fake do files.list: devolve os filhos de cada pasta conforme a árvore dada. */
function mockDrive(tree: Record<string, Entry[]>, opts: { failOn?: string } = {}) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: string) => {
    const query = decodeURIComponent(new URL(url).searchParams.get("q") || "");
    const parent = query.match(/'([^']+)' in parents/)?.[1] ?? "";
    calls.push(parent);
    if (opts.failOn === parent) {
      return {
        ok: false,
        json: async () => ({ error: { message: "Rate limit exceeded" } }),
      } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ files: tree[parent] ?? [] }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return calls;
}

const img = (id: string, name: string): Entry => ({ id, name, mimeType: "image/png" });
const dir = (id: string, name: string): Entry => ({ id, name, mimeType: FOLDER });

afterEach(() => {
  jest.restoreAllMocks();
});

describe("listDriveFolderImages", () => {
  it("desce em todas as subpastas e guarda o caminho relativo", async () => {
    mockDrive({
      root: [img("i1", "logo.png"), dir("d1", "sementes")],
      d1: [img("i2", "SEED_TURNIP.png"), dir("d2", "raras")],
      d2: [img("i3", "SEED_GOLD.png")],
    });

    const { files, truncated, error } = await listDriveFolderImages("tok", "root");

    expect(error).toBeNull();
    expect(truncated).toBe(false);
    expect(files.map(imageLabel)).toEqual([
      "logo.png",
      "sementes/SEED_TURNIP.png",
      "sementes/raras/SEED_GOLD.png",
    ]);
    // Arquivo na raiz não carrega path — o jsonb de quem não usa subpasta fica igual.
    expect(files[0]).toEqual({ fileId: "i1", name: "logo.png" });
    expect(files[1].path).toBe("sementes");
  });

  it("mantém o nome do arquivo intacto, para o casamento por dataId", async () => {
    mockDrive({ root: [dir("d1", "icones")], d1: [img("i1", "SEED_TURNIP.png")] });
    const { files } = await listDriveFolderImages("tok", "root");
    expect(files[0].name).toBe("SEED_TURNIP.png");
  });

  it("distingue arquivos de mesmo nome em pastas diferentes", async () => {
    mockDrive({
      root: [dir("d1", "ui"), dir("d2", "itens")],
      d1: [img("i1", "icon.png")],
      d2: [img("i2", "icon.png")],
    });
    const { files } = await listDriveFolderImages("tok", "root");
    expect(files).toHaveLength(2);
    expect(new Set(files.map(imageLabel))).toEqual(new Set(["ui/icon.png", "itens/icon.png"]));
  });

  it("não entra em loop quando uma subpasta aponta de volta (atalho)", async () => {
    const calls = mockDrive({
      root: [dir("d1", "a")],
      d1: [dir("root", "volta"), img("i1", "x.png")],
    });
    const { files } = await listDriveFolderImages("tok", "root");
    expect(files.map(imageLabel)).toEqual(["a/x.png"]);
    // Cada pasta é visitada uma única vez.
    expect(calls.filter((c) => c === "root")).toHaveLength(1);
  });

  it("ignora pastas vazias sem quebrar", async () => {
    mockDrive({ root: [dir("d1", "vazia")], d1: [] });
    const { files, error } = await listDriveFolderImages("tok", "root");
    expect(error).toBeNull();
    expect(files).toEqual([]);
  });

  it("devolve o erro do Drive junto do que já tinha coletado", async () => {
    mockDrive(
      { root: [img("i1", "logo.png"), dir("d1", "sementes")], d1: [img("i2", "SEED.png")] },
      { failOn: "d1" },
    );
    const { files, error } = await listDriveFolderImages("tok", "root");
    expect(error).toBe("Rate limit exceeded");
    expect(files.map((f) => f.name)).toEqual(["logo.png"]);
  });

  it("pede imagens e pastas na mesma query, sem uma varredura extra por tipo", async () => {
    mockDrive({ root: [] });
    await listDriveFolderImages("tok", "root");
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    const q = decodeURIComponent(new URL(url).searchParams.get("q") || "");
    expect(q).toContain("mimeType contains 'image/'");
    expect(q).toContain(FOLDER);
    expect(q).toContain("trashed = false");
  });
});

describe("varredura paralela, progresso e cancelamento", () => {
  /** Igual ao mockDrive, mas com atraso por chamada e contagem de concorrência. */
  function mockSlowDrive(tree: Record<string, Entry[]>, delayMs = 20) {
    let inFlight = 0;
    let peak = 0;
    global.fetch = jest.fn(async (url: string) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      const query = decodeURIComponent(new URL(url).searchParams.get("q") || "");
      const parent = query.match(/'([^']+)' in parents/)?.[1] ?? "";
      await new Promise((r) => setTimeout(r, delayMs));
      inFlight--;
      return { ok: true, json: async () => ({ files: tree[parent] ?? [] }) } as unknown as Response;
    }) as unknown as typeof fetch;
    return () => peak;
  }

  it("varre várias pastas ao mesmo tempo, não uma por vez", async () => {
    const dirs = Array.from({ length: 6 }, (_, i) => dir(`d${i}`, `pasta${i}`));
    const tree: Record<string, Entry[]> = { root: dirs };
    for (const d of dirs) tree[d.id] = [img(`i-${d.id}`, "x.png")];
    const peak = mockSlowDrive(tree);

    const { files } = await listDriveFolderImages("tok", "root");

    expect(files).toHaveLength(6);
    // Em série o pico seria 1.
    expect(peak()).toBeGreaterThan(1);
  });

  it("reporta progresso com pastas varridas, fila e imagens encontradas", async () => {
    mockDrive({
      root: [dir("d1", "a"), dir("d2", "b")],
      d1: [img("i1", "1.png")],
      d2: [img("i2", "2.png")],
    });

    const seen: Array<{ scanned: number; images: number }> = [];
    await listDriveFolderImages("tok", "root", {
      onProgress: (p) => seen.push({ scanned: p.scanned, images: p.images }),
    });

    expect(seen.length).toBeGreaterThan(0);
    // O progresso avança e termina com tudo contabilizado.
    expect(seen[seen.length - 1]).toEqual({ scanned: 3, images: 2 });
    expect(seen.map((s) => s.scanned)).toEqual([...seen.map((s) => s.scanned)].sort((a, b) => a - b));
  });

  it("nomeia a pasta atual no progresso, pra dar sinal de vida", async () => {
    mockDrive({ root: [dir("d1", "sementes")], d1: [img("i1", "SEED.png")] });
    const names: string[] = [];
    await listDriveFolderImages("tok", "root", { onProgress: (p) => names.push(p.current) });
    // Raiz vem como caminho vazio: quem renderiza dá o nome traduzido.
    expect(names[0]).toBe("");
    expect(names).toContain("sementes");
  });

  it("cancelar para a varredura e marca canceled, sem devolver erro", async () => {
    const dirs = Array.from({ length: 20 }, (_, i) => dir(`d${i}`, `p${i}`));
    const tree: Record<string, Entry[]> = { root: dirs };
    for (const d of dirs) tree[d.id] = [img(`i-${d.id}`, "x.png")];
    mockSlowDrive(tree, 15);

    const controller = new AbortController();
    const scan = listDriveFolderImages("tok", "root", {
      signal: controller.signal,
      onProgress: (p) => { if (p.scanned >= 1) controller.abort(); },
    });

    const result = await scan;
    expect(result.canceled).toBe(true);
    expect(result.error).toBeNull();
    // Parou no meio: não varreu as 21 pastas.
    expect(result.files.length).toBeLessThan(20);
  });
});
