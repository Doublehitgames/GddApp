/**
 * Diff de texto para o changelog.
 *
 * O conteúdo de uma página é markdown escrito à mão, então o que interessa ao
 * leitor é a palavra que mudou, não a linha: trocar "10 moedas" por "12 moedas"
 * tem que acender duas palavras, e não repintar o parágrafo inteiro.
 *
 * Duas defesas contra o custo quadrático do LCS: as pontas iguais são cortadas
 * antes (edição típica mexe no meio de um texto longo) e, se o miolo ainda for
 * grande demais, a comparação cai para linha e, no limite, para "reescrita".
 */

export type DiffSegment = { type: "eq" | "add" | "del"; text: string };

export type DiffGranularity = "word" | "line" | "coarse";

export type DiffResult = {
  segments: DiffSegment[];
  /** Palavras (tokens não-brancos) presentes só no texto novo. */
  added: number;
  /** Palavras presentes só no texto antigo. */
  removed: number;
  granularity: DiffGranularity;
};

/** Acima disto o LCS palavra-a-palavra sai caro demais para rodar no browser. */
const MAX_CELLS = 1_200_000;

function tokenizeWords(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? [];
}

function tokenizeLines(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split("\n")) out.push(part, "\n");
  out.pop(); // o split não termina em quebra
  return out.filter((t) => t !== "");
}

function countWords(tokens: string[]): number {
  let n = 0;
  for (const t of tokens) if (t.trim() !== "") n++;
  return n;
}

/** Junta segmentos vizinhos do mesmo tipo — o backtrack os produz picotados. */
function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const seg of segments) {
    if (seg.text === "") continue;
    const last = out[out.length - 1];
    if (last && last.type === seg.type) last.text += seg.text;
    else out.push({ ...seg });
  }
  return out;
}

/** LCS clássico em programação dinâmica, com backtrack produzindo os segmentos. */
function diffTokens(a: string[], b: string[]): DiffSegment[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + (j + 1)] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      segments.push({ type: "eq", text: a[i] });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      segments.push({ type: "del", text: a[i] });
      i++;
    } else {
      segments.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) segments.push({ type: "del", text: a[i++] });
  while (j < m) segments.push({ type: "add", text: b[j++] });

  return segments;
}

function diffWithTokens(
  a: string[],
  b: string[],
  granularity: DiffGranularity
): DiffResult | null {
  // Pontas iguais saem fora da conta: elas dominam qualquer edição pontual.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let end = 0;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  ) {
    end++;
  }

  const midA = a.slice(start, a.length - end);
  const midB = b.slice(start, b.length - end);

  if ((midA.length + 1) * (midB.length + 1) > MAX_CELLS) return null;

  const middle = midA.length === 0
    ? midB.map((text) => ({ type: "add" as const, text }))
    : midB.length === 0
      ? midA.map((text) => ({ type: "del" as const, text }))
      : diffTokens(midA, midB);

  const segments = mergeSegments([
    ...a.slice(0, start).map((text) => ({ type: "eq" as const, text })),
    ...middle,
    ...a.slice(a.length - end).map((text) => ({ type: "eq" as const, text })),
  ]);

  return {
    segments,
    added: countWords(middle.filter((s) => s.type === "add").map((s) => s.text)),
    removed: countWords(middle.filter((s) => s.type === "del").map((s) => s.text)),
    granularity,
  };
}

/**
 * Compara dois textos e devolve os trechos iguais, adicionados e removidos.
 * Nunca lança: no pior caso devolve o texto antigo inteiro como removido e o
 * novo inteiro como adicionado.
 */
export function diffText(before: string, after: string): DiffResult {
  const a = before ?? "";
  const b = after ?? "";

  if (a === b) {
    return { segments: a === "" ? [] : [{ type: "eq", text: a }], added: 0, removed: 0, granularity: "word" };
  }

  const byWord = diffWithTokens(tokenizeWords(a), tokenizeWords(b), "word");
  if (byWord) return byWord;

  const byLine = diffWithTokens(tokenizeLines(a), tokenizeLines(b), "line");
  if (byLine) return byLine;

  const segments: DiffSegment[] = [];
  if (a !== "") segments.push({ type: "del", text: a });
  if (b !== "") segments.push({ type: "add", text: b });
  return {
    segments,
    added: countWords(tokenizeWords(b)),
    removed: countWords(tokenizeWords(a)),
    granularity: "coarse",
  };
}

/**
 * Só as vizinhanças do que mudou, para o cartão fechado não despejar a página
 * inteira. Cada trecho igual longo vira "…" com um pedaço de cada lado.
 */
export function condenseSegments(segments: DiffSegment[], context = 90): DiffSegment[] {
  const out: DiffSegment[] = [];
  segments.forEach((seg, index) => {
    if (seg.type !== "eq" || seg.text.length <= context * 2) {
      out.push(seg);
      return;
    }
    const isFirst = index === 0;
    const isLast = index === segments.length - 1;
    const head = isFirst ? "" : seg.text.slice(0, context);
    const tail = isLast ? "" : seg.text.slice(-context);
    out.push({ type: "eq", text: `${head} … ${tail}` });
  });
  return mergeSegments(out);
}

/** Palavras de um texto — o sinal barato que o cartão fechado mostra. */
export function countTextWords(text: string): number {
  return countWords(tokenizeWords(text ?? ""));
}
