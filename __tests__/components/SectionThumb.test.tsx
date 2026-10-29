/**
 * A cara de uma página: a thumb que ela escolheu e, sem ela, o ícone do
 * domínio. O que se testa aqui é a cascata — foi ela que faltou no modal de
 * prévia, que mostrava só o texto enquanto a carta ao lado mostrava a imagem.
 */

import { render, screen } from "@testing-library/react";
import { SectionThumb } from "@/components/common/SectionThumb";

const THUMB = "https://drive.google.com/thumbnail?id=19AWWk7obe24c9JtFAHoiuiDaVYCzZAhX&sz=w1000";

describe("SectionThumb", () => {
  it("mostra a imagem da página quando ela tem thumb", () => {
    render(<SectionThumb section={{ title: "Galinha", thumbImageUrl: THUMB }} />);
    const img = screen.getByAltText("Galinha") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    // A URL do Drive vira candidata de exibição, então o que importa é que o id esteja lá.
    expect(img.src).toContain("19AWWk7obe24c9JtFAHoiuiDaVYCzZAhX");
  });

  it("sem thumb, desenha o ícone do primeiro domínio da página", () => {
    const { container } = render(<SectionThumb section={{ title: "Galinha", domainTags: ["economy"] }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("sem thumb e sem domínio, ainda desenha algo — o quadrado não fica vazio", () => {
    const { container } = render(<SectionThumb section={{ title: "Galinha" }} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("aguenta página indefinida", () => {
    const { container } = render(<SectionThumb section={null} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
