import { explainDriveError, parseDriveFolderId, driveFolderUrl } from "@/lib/googleDriveFolder";

describe("parseDriveFolderId", () => {
  it("aceita o link normal de pasta compartilhada", () => {
    expect(parseDriveFolderId("https://drive.google.com/drive/folders/1AbC_dEf-123?usp=sharing"))
      .toBe("1AbC_dEf-123");
  });

  it("aceita link antigo com ?id=", () => {
    expect(parseDriveFolderId("https://drive.google.com/open?id=1AbC_dEf-123")).toBe("1AbC_dEf-123");
  });

  it("aceita o id cru", () => {
    expect(parseDriveFolderId("1AbCdEfGhIjKlMnOpQrStUvWxYz")).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("recusa o que não é pasta, em vez de inventar um id", () => {
    expect(parseDriveFolderId("https://exemplo.com/pasta")).toBeNull();
    expect(parseDriveFolderId("   ")).toBeNull();
    expect(parseDriveFolderId("curto")).toBeNull();
  });

  it("monta a URL canônica da pasta", () => {
    expect(driveFolderUrl("abc")).toBe("https://drive.google.com/drive/folders/abc");
  });
});

describe("explainDriveError", () => {
  it("transforma o erro de API desativada em instrução com o link do projeto certo", () => {
    const out = explainDriveError(
      "Google Drive API has not been used in project 789615777145 before or it is disabled.",
    );
    expect(out).toContain("Drive API está desativada");
    expect(out).toContain("project=789615777145");
    // A distinção que causa a confusão precisa aparecer.
    expect(out).toContain("Picker API");
  });

  it("cai no link genérico quando a mensagem não traz o número do projeto", () => {
    const out = explainDriveError("accessNotConfigured");
    expect(out).toContain("apis/library/drive.googleapis.com");
    expect(out).not.toContain("project=");
  });

  it("explica pasta inexistente e falta de permissão", () => {
    expect(explainDriveError("File not found: abc")).toContain("Pasta não encontrada");
    expect(explainDriveError("Insufficient permissions")).toContain("Sem permissão");
  });

  it("repassa o que não sabe traduzir", () => {
    expect(explainDriveError("boom")).toBe("Erro ao listar a pasta: boom");
  });
});
