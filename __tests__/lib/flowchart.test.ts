/**
 * Turning "these are the steps and this leads to that" into a diagram.
 *
 * The whole point of the module is that the caller does NOT send coordinates,
 * so most of what matters here is geometric: nodes must not land on top of one
 * another, a branch must fan out, and nothing may end up at a negative
 * coordinate — the editor opens at the origin and would show an empty canvas.
 *
 * The other half is what a rewrite must not destroy. Someone tinted a node in
 * the editor; an agent rewriting the flow's logic keeps that tint.
 */

import {
  buildFlowchartState,
  flowchartDigest,
  FlowchartInputError,
  MAX_FLOWCHART_NODES,
  normalizeShape,
} from "@/lib/flowchart/flowchart";

const NOW = "2026-09-09T12:00:00Z";

const build = (input: Parameters<typeof buildFlowchartState>[0], previous?: unknown) =>
  buildFlowchartState(input, { now: NOW, previous });

const LINEAR = {
  nodes: [{ label: "Entra na sala" }, { label: "Resolve o puzzle" }, { label: "Abre a porta" }],
  edges: [
    { from: "Entra na sala", to: "Resolve o puzzle" },
    { from: "Resolve o puzzle", to: "Abre a porta" },
  ],
};

describe("buildFlowchartState", () => {
  it("produces a diagram the editor can open", () => {
    const state = build(LINEAR);
    expect(state.version).toBe(1);
    expect(state.updatedAt).toBe(NOW);
    expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    // The editor renders nodes through its own component, keyed on this type.
    expect(state.nodes.every((n) => n.type === "diagramNode")).toBe(true);
  });

  it("stacks a linear flow downwards in order", () => {
    const state = build(LINEAR);
    const [a, b, c] = state.nodes;
    expect(a.position.y).toBeLessThan(b.position.y);
    expect(b.position.y).toBeLessThan(c.position.y);
  });

  it("keeps every node inside the visible quadrant", () => {
    // A centred layer puts half the nodes at negative x. The editor opens at
    // the origin, so the whole thing is shifted back into view before saving.
    const state = build({
      nodes: [{ label: "Início" }, { label: "A" }, { label: "B" }, { label: "C" }],
      edges: [
        { from: "Início", to: "A" },
        { from: "Início", to: "B" },
        { from: "Início", to: "C" },
      ],
    });
    for (const node of state.nodes) {
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("fans a branch out side by side, without overlap", () => {
    const state = build({
      nodes: [
        { label: "Acertou?", shape: "losango" },
        { label: "Ganha a chave" },
        { label: "Perde uma vida" },
      ],
      edges: [
        { from: "Acertou?", to: "Ganha a chave", label: "sim" },
        { from: "Acertou?", to: "Perde uma vida", label: "não" },
      ],
    });

    const byId = new Map(state.nodes.map((n) => [n.id, n]));
    const left = byId.get("ganha-a-chave")!;
    const right = byId.get("perde-uma-vida")!;
    expect(left.position.y).toBe(right.position.y);

    const leftEnd = left.position.x + Number(left.data.width);
    const rightEnd = right.position.x + Number(right.data.width);
    // Whichever is drawn first, the two boxes cannot share pixels.
    const overlap = left.position.x < rightEnd && right.position.x < leftEnd;
    expect(overlap).toBe(false);
  });

  it("lays the flow left to right when asked", () => {
    const state = build({ ...LINEAR, direction: "right" });
    const [a, b, c] = state.nodes;
    expect(a.position.x).toBeLessThan(b.position.x);
    expect(b.position.x).toBeLessThan(c.position.x);
    expect(new Set([a.position.y, b.position.y, c.position.y]).size).toBe(1);
  });

  it("survives a flow that loops back on itself", () => {
    // A puzzle flow almost always has one: failing sends the player back.
    const state = build({
      nodes: [{ label: "Tenta" }, { label: "Falhou?", shape: "losango" }, { label: "Sai" }],
      edges: [
        { from: "Tenta", to: "Falhou?" },
        { from: "Falhou?", to: "Tenta", label: "sim" },
        { from: "Falhou?", to: "Sai", label: "não" },
      ],
    });
    expect(state.nodes).toHaveLength(3);
    expect(state.nodes.every((n) => Number.isFinite(n.position.x) && Number.isFinite(n.position.y))).toBe(true);
  });

  it("routes an arrow that goes back up around the side", () => {
    // Straight up through the middle would cross the boxes in between.
    const state = build({
      nodes: [{ label: "Tenta" }, { label: "Erra" }],
      edges: [
        { from: "Tenta", to: "Erra" },
        { from: "Erra", to: "Tenta" },
      ],
    });
    const back = state.edges.find((e) => e.source === "erra" && e.target === "tenta")!;
    expect(back.sourceHandle).toBe("right");
    expect(back.targetHandle).toBe("right");
  });

  it("gives every arrow a direction", () => {
    const state = build(LINEAR);
    expect(state.edges.every((e) => e.endMarker === "arrow" && e.startMarker === "none")).toBe(true);
  });
});

describe("naming nodes", () => {
  it("derives readable ids from the labels", () => {
    const state = build({ nodes: [{ label: "Puzzle da Água" }], edges: [] });
    expect(state.nodes[0].id).toBe("puzzle-da-agua");
  });

  it("keeps an explicit id, which is what edges and rewrites hang on", () => {
    const state = build({
      nodes: [{ id: "p1", label: "Puzzle 1" }, { id: "p2", label: "Puzzle 2" }],
      edges: [{ from: "p1", to: "p2" }],
    });
    expect(state.edges[0]).toMatchObject({ source: "p1", target: "p2" });
  });

  it("resolves an edge that names a node by its label", () => {
    // The forgiving path: an agent that did not invent ids should not have to.
    const state = build(LINEAR);
    expect(state.edges[0]).toMatchObject({ source: "entra-na-sala", target: "resolve-o-puzzle" });
  });

  it("does not let two nodes share an id", () => {
    const state = build({ nodes: [{ label: "Sala" }, { label: "Sala" }], edges: [] });
    expect(state.nodes[0].id).not.toBe(state.nodes[1].id);
  });
});

describe("shapes", () => {
  it("reads the words an agent is likely to try", () => {
    expect(normalizeShape("diamond")).toBe("losango");
    expect(normalizeShape("decision")).toBe("losango");
    expect(normalizeShape("rect")).toBe("retangulo");
    expect(normalizeShape("start")).toBe("pill");
    expect(normalizeShape("circle")).toBe("circulo");
  });

  it("falls back to a plain step rather than refusing", () => {
    expect(normalizeShape("hexagon-ish")).toBe("retangulo");
    expect(normalizeShape(undefined)).toBe("retangulo");
  });
});

describe("a rewrite does not undo the editor", () => {
  const previous = {
    version: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    nodes: [
      {
        id: "p1",
        type: "diagramNode",
        position: { x: 640, y: 320 },
        data: { label: "Puzzle 1", color: "#22c55e", fontSize: 18, borderWidth: 3, width: 200, height: 80 },
      },
    ],
    edges: [],
    viewport: { x: -40, y: 12, zoom: 0.75 },
  };

  it("keeps the colour, size and font someone chose by hand", () => {
    const state = build({ nodes: [{ id: "p1", label: "Puzzle 1 revisado" }], edges: [] }, previous);
    expect(state.nodes[0].data).toMatchObject({
      label: "Puzzle 1 revisado",
      color: "#22c55e",
      fontSize: 18,
      borderWidth: 3,
      width: 200,
      height: 80,
    });
  });

  it("leaves the node where it was dragged to", () => {
    const state = build({ nodes: [{ id: "p1", label: "Puzzle 1" }], edges: [] }, previous);
    expect(state.nodes[0].position).toEqual({ x: 640, y: 320 });
  });

  it("still moves a node the caller placed on purpose", () => {
    const state = build(
      { nodes: [{ id: "p1", label: "Puzzle 1", position: { x: 10, y: 20 } }], edges: [] },
      previous,
    );
    expect(state.nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it("lets an explicit colour win over the stored one", () => {
    const state = build({ nodes: [{ id: "p1", label: "Puzzle 1", color: "#ef4444" }], edges: [] }, previous);
    expect(state.nodes[0].data.color).toBe("#ef4444");
  });

  it("does not move the camera someone left pointed somewhere", () => {
    const state = build({ nodes: [{ id: "p1", label: "Puzzle 1" }], edges: [] }, previous);
    expect(state.viewport).toEqual({ x: -40, y: 12, zoom: 0.75 });
  });

  it("gives a node that did not exist before a place of its own", () => {
    const state = build(
      { nodes: [{ id: "p1", label: "Puzzle 1" }, { id: "p2", label: "Puzzle 2" }], edges: [{ from: "p1", to: "p2" }] },
      previous,
    );
    const p2 = state.nodes.find((n) => n.id === "p2")!;
    expect(p2.position).not.toEqual({ x: 640, y: 320 });
  });
});

describe("input the caller has to fix", () => {
  it("rejects an edge pointing at a node that is not there", () => {
    expect(() =>
      build({ nodes: [{ label: "A" }], edges: [{ from: "A", to: "Sala secreta" }] }),
    ).toThrow(FlowchartInputError);
  });

  it("names the reference it could not resolve", () => {
    expect(() =>
      build({ nodes: [{ label: "A" }], edges: [{ from: "A", to: "Sala secreta" }] }),
    ).toThrow(/Sala secreta/);
  });

  it("rejects a flowchart with no nodes", () => {
    expect(() => build({ nodes: [], edges: [] })).toThrow(FlowchartInputError);
  });

  it("refuses more nodes than the editor holds", () => {
    const nodes = Array.from({ length: MAX_FLOWCHART_NODES + 1 }, (_, i) => ({ label: `n${i}` }));
    expect(() => build({ nodes, edges: [] })).toThrow(FlowchartInputError);
  });
});

describe("flowchartDigest", () => {
  it("reads back as the same flow that was written", () => {
    // This is the round trip an agent makes to edit an existing diagram:
    // read the digest, change it, send it back.
    const state = build({
      nodes: [{ label: "Tenta" }, { label: "Acertou?", shape: "losango" }],
      edges: [{ from: "Tenta", to: "Acertou?", label: "sempre" }],
    });
    expect(flowchartDigest(state)).toEqual({
      nodes: [
        { id: "tenta", label: "Tenta" },
        { id: "acertou", label: "Acertou?", shape: "losango" },
      ],
      edges: [{ from: "tenta", to: "acertou", label: "sempre" }],
    });
  });

  it("says nothing at all when the page has no diagram", () => {
    expect(flowchartDigest(null)).toBeNull();
    expect(flowchartDigest({ version: 1, nodes: [], edges: [] })).toBeNull();
  });
});
