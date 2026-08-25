import { classifyDriveError, parseDriveFolderId, driveFolderUrl } from "@/lib/googleDriveFolder";

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

describe("classifyDriveError", () => {
  it("reconhece a API desativada e monta o link do projeto certo", () => {
    const out = classifyDriveError(
      "Google Drive API has not been used in project 789615777145 before or it is disabled.",
    );
    expect(out.kind).toBe("apiDisabled");
    expect(out.enableLink).toContain("project=789615777145");
  });

  it("cai no link genérico quando a mensagem não traz o número do projeto", () => {
    const out = classifyDriveError("accessNotConfigured");
    expect(out.kind).toBe("apiDisabled");
    expect(out.enableLink).toBe("https://console.cloud.google.com/apis/library/drive.googleapis.com");
  });

  it("separa pasta inexistente, limite de requisições e falta de permissão", () => {
    expect(classifyDriveError("File not found: abc").kind).toBe("notFound");
    expect(classifyDriveError("Rate Limit Exceeded").kind).toBe("rateLimit");
    expect(classifyDriveError("Insufficient permissions").kind).toBe("forbidden");
  });

  it("o que não conhece vira unknown com a mensagem crua preservada", () => {
    const out = classifyDriveError("boom");
    expect(out.kind).toBe("unknown");
    expect(out.raw).toBe("boom");
  });

  it("não devolve texto de usuário — isso é responsabilidade do locale", () => {
    const out = classifyDriveError("File not found");
    expect(Object.keys(out).sort()).toEqual(["kind", "raw"]);
  });
});
