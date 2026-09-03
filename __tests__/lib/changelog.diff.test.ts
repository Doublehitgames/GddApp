import { condenseSegments, diffText } from "@/lib/changelog/diff";

const text = (type: "eq" | "add" | "del", segments: ReturnType<typeof diffText>["segments"]) =>
  segments.filter((s) => s.type === type).map((s) => s.text).join("");

describe("diffText", () => {
  it("marca só a palavra trocada no meio da frase", () => {
    const result = diffText(
      "A galinha bota 10 ovos por dia.",
      "A galinha bota 12 ovos por dia."
    );

    expect(text("del", result.segments)).toBe("10");
    expect(text("add", result.segments)).toBe("12");
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.granularity).toBe("word");
  });

  it("reconstrói o texto antigo e o novo a partir dos segmentos", () => {
    const before = "O moinho mói trigo e milho.";
    const after = "O moinho mói trigo, milho e cevada.";
    const result = diffText(before, after);

    const rebuiltBefore = result.segments
      .filter((s) => s.type !== "add")
      .map((s) => s.text)
      .join("");
    const rebuiltAfter = result.segments
      .filter((s) => s.type !== "del")
      .map((s) => s.text)
      .join("");

    expect(rebuiltBefore).toBe(before);
    expect(rebuiltAfter).toBe(after);
  });

  it("trata texto vazio dos dois lados", () => {
    expect(diffText("", "Novo parágrafo.").removed).toBe(0);
    expect(diffText("", "Novo parágrafo.").added).toBe(2);
    expect(diffText("Sumiu tudo.", "").added).toBe(0);
    expect(diffText("Sumiu tudo.", "").removed).toBe(2);
  });

  it("não gera diferenças quando o texto é idêntico", () => {
    const result = diffText("Mesma coisa.", "Mesma coisa.");
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.segments.every((s) => s.type === "eq")).toBe(true);
  });

  it("mantém a comparação por palavra num texto longo com uma edição pontual", () => {
    const before = Array.from({ length: 4000 }, (_, i) => `linha ${i}`).join("\n");
    const after = before.replace("linha 2000", "linha dois mil");
    const result = diffText(before, after);

    expect(result.granularity).toBe("word");
    expect(text("add", result.segments)).toContain("dois");
  });

  it("cai para granularidade menor quando o miolo é grande demais", () => {
    const before = Array.from({ length: 3000 }, (_, i) => `alfa${i}`).join(" ");
    const after = Array.from({ length: 3000 }, (_, i) => `beta${i}`).join(" ");
    const result = diffText(before, after);

    expect(result.granularity).not.toBe("word");
    expect(result.added + result.removed).toBeGreaterThan(0);
  });
});

describe("condenseSegments", () => {
  it("encolhe os trechos iguais longos entre as mudanças", () => {
    const long = "palavra ".repeat(200);
    const result = diffText(`${long}dez`, `${long}doze`);
    const condensed = condenseSegments(result.segments, 20);

    const eqLength = condensed
      .filter((s) => s.type === "eq")
      .reduce((sum, s) => sum + s.text.length, 0);

    expect(eqLength).toBeLessThan(long.length);
    expect(text("add", condensed)).toContain("doze");
  });
});
