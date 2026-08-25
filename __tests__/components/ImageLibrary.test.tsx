import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageLibraryPicker } from "@/components/common/ImageLibraryPicker";
import { ImageLibrarySettings } from "@/components/common/ImageLibrarySettings";
import { DriveThumb } from "@/components/common/DriveThumb";
import type { ProjectImage } from "@/store/slices/types";

const FILES: ProjectImage[] = [
  { fileId: "f1", name: "SEED_TURNIP.png" },
  { fileId: "f2", name: "SEED_CARROT.png" },
  { fileId: "f3", name: "TOOL_HOE.png" },
];

describe("ImageLibraryPicker", () => {
  it("mostra a grade inteira e a URL de thumbnail do Drive em cada item", () => {
    render(<ImageLibraryPicker files={FILES} onPick={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText("SEED_TURNIP.png")).toBeInTheDocument();
    // Começa pelo CDN, no tamanho de exibição — não em w1000.
    expect(screen.getByAltText("TOOL_HOE.png")).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/d/f3=w240",
    );
    expect(screen.getByText("3 de 3 imagens")).toBeInTheDocument();
  });

  it("filtra por nome do arquivo", async () => {
    render(<ImageLibraryPicker files={FILES} onPick={jest.fn()} onClose={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/Filtrar por nome/), "seed");
    expect(screen.getByText("2 de 3 imagens")).toBeInTheDocument();
    expect(screen.queryByText("TOOL_HOE.png")).not.toBeInTheDocument();
  });

  it("devolve o arquivo escolhido, não só o id", async () => {
    const onPick = jest.fn();
    render(<ImageLibraryPicker files={FILES} onPick={onPick} onClose={jest.fn()} />);
    await userEvent.click(screen.getByTitle("SEED_CARROT.png"));
    expect(onPick).toHaveBeenCalledWith({ fileId: "f2", name: "SEED_CARROT.png" });
  });

  it("avisa quando o filtro não acha nada, em vez de mostrar grade vazia", async () => {
    render(<ImageLibraryPicker files={FILES} onPick={jest.fn()} onClose={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/Filtrar por nome/), "zzz");
    expect(screen.getByText("Nenhuma imagem com esse nome.")).toBeInTheDocument();
  });
});

describe("ImageLibrarySettings", () => {
  it("recusa uma URL que não é pasta do Drive, sem chamar o onChange", async () => {
    const onChange = jest.fn();
    render(<ImageLibrarySettings onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/drive.google.com/), {
      target: { value: "https://exemplo.com/pasta" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Conectar pasta" }));
    expect(screen.getByText(/Não reconheci essa URL/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("com biblioteca conectada, mostra a contagem e o caminho de atualizar", () => {
    render(
      <ImageLibrarySettings
        library={{
          folderId: "folder-1",
          folderUrl: "https://drive.google.com/drive/folders/folder-1",
          syncedAt: "2026-08-25T10:00:00.000Z",
          files: FILES,
        }}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText(/3 imagens indexadas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar índice" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir pasta no Drive/ })).toHaveAttribute(
      "href",
      "https://drive.google.com/drive/folders/folder-1",
    );
  });

  it("desconectar limpa a biblioteca do projeto", async () => {
    const onChange = jest.fn();
    render(
      <ImageLibrarySettings
        library={{ folderId: "f", folderUrl: "u", syncedAt: "2026-08-25T10:00:00.000Z", files: FILES }}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe("DriveThumb", () => {
  it("desce para a próxima URL candidata quando a imagem falha", () => {
    render(<DriveThumb fileId="f9" alt="icone.png" size={120} />);
    const img = () => screen.getByAltText("icone.png");

    expect(img()).toHaveAttribute("src", "https://lh3.googleusercontent.com/d/f9=w120");
    fireEvent.error(img());
    expect(img()).toHaveAttribute("src", "https://drive.google.com/thumbnail?id=f9&sz=w120");
    fireEvent.error(img());
    expect(img()).toHaveAttribute("src", "https://drive.google.com/uc?export=view&id=f9");
  });

  it("pede o tamanho de exibição, não w1000", () => {
    render(<DriveThumb fileId="f1" alt="a.png" size={64} />);
    expect(screen.getByAltText("a.png").getAttribute("src")).toContain("=w64");
  });

  it("carrega preguiçoso e sem referrer, que é o que destrava o CDN", () => {
    render(<DriveThumb fileId="f1" alt="a.png" />);
    const img = screen.getByAltText("a.png");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("esgotadas as candidatas, mostra 'sem acesso' em vez de imagem quebrada", () => {
    render(<DriveThumb fileId="f1" alt="privada.png" />);
    for (let i = 0; i < 3; i++) {
      const img = screen.queryByAltText("privada.png");
      if (img) fireEvent.error(img);
    }
    expect(screen.queryByAltText("privada.png")).not.toBeInTheDocument();
    expect(screen.getByText("sem acesso")).toBeInTheDocument();
    expect(screen.getByTitle(/privada\.png/)).toHaveAttribute(
      "title",
      expect.stringContaining("qualquer pessoa com o link"),
    );
  });
});
