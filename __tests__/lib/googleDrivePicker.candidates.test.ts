/**
 * Ordem e tamanho das URLs candidatas do Drive. A ordem é medida (lh3 12ms,
 * thumbnail 786ms, uc 403 no mesmo arquivo), então merece teste: uma inversão
 * acidental volta a produzir miniatura quebrada em grade.
 */

import {
  driveFileIdToImageCandidates,
  driveFileIdToImageUrl,
  getDriveImageDisplayCandidates,
  getDriveImageDisplayUrl,
} from "@/lib/googleDrivePicker";

describe("driveFileIdToImageCandidates", () => {
  it("tenta o CDN primeiro e o uc?export=view por último", () => {
    expect(driveFileIdToImageCandidates("abc")).toEqual([
      "https://lh3.googleusercontent.com/d/abc=w1600",
      "https://drive.google.com/thumbnail?id=abc&sz=w1600",
      "https://drive.google.com/uc?export=view&id=abc",
    ]);
  });

  it("pede o tamanho informado nas duas primeiras", () => {
    const [cdn, thumb] = driveFileIdToImageCandidates("abc", 240);
    expect(cdn).toContain("=w240");
    expect(thumb).toContain("sz=w240");
  });

  it("id vazio não vira URL quebrada", () => {
    expect(driveFileIdToImageCandidates("")).toEqual([]);
    expect(driveFileIdToImageCandidates("   ")).toEqual([]);
  });
});

describe("URL gravada x URL exibida", () => {
  it("o formato GRAVADO não muda — thumbnail, como todo dado já salvo", () => {
    expect(driveFileIdToImageUrl("abc")).toBe("https://drive.google.com/thumbnail?id=abc&sz=w1000");
  });

  it("exibir um link do Drive resolve para a primeira candidata", () => {
    expect(getDriveImageDisplayUrl("https://drive.google.com/thumbnail?id=abc&sz=w1000"))
      .toBe("https://lh3.googleusercontent.com/d/abc=w1600");
  });

  it("entende os três formatos de link do Drive", () => {
    const esperado = "https://lh3.googleusercontent.com/d/abc=w240";
    for (const src of [
      "https://drive.google.com/thumbnail?id=abc&sz=w1000",
      "https://drive.google.com/uc?export=view&id=abc",
      "https://drive.google.com/file/d/abc/view",
    ]) {
      expect(getDriveImageDisplayCandidates(src, 240)[0]).toBe(esperado);
    }
  });

  it("URL que não é do Drive passa intacta, sem candidatas inventadas", () => {
    const externa = "https://cdn.exemplo.com/icone.png";
    expect(getDriveImageDisplayCandidates(externa)).toEqual([externa]);
    expect(getDriveImageDisplayUrl(externa)).toBe(externa);
  });

  it("vazio não gera candidata", () => {
    expect(getDriveImageDisplayCandidates("")).toEqual([]);
  });
});
