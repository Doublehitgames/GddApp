/**
 * Registering Drive files in a project's image library through the API — the
 * path for an agent that just uploaded images and knows their ids, since the
 * server itself cannot read Drive.
 */
import { mergeImageLibrary } from "@/lib/api/v1/imageLibrary";
import { addProjectImagesSchema, createSectionSchema, updateSectionSchema } from "@/lib/api/v1/schemas";

const NOW = "2026-11-10T12:00:00.000Z";
const FOLDER = "1AbCdEfGhIjKlMnOpQrStUv";
const FILE_A = "1aaaaaaaaaaaaaaaaaaaaaaaaa";
const FILE_B = "1bbbbbbbbbbbbbbbbbbbbbbbbb";

const existing = {
  folderId: FOLDER,
  folderUrl: `https://drive.google.com/drive/folders/${FOLDER}`,
  syncedAt: "2026-11-01T00:00:00.000Z",
  files: [{ fileId: FILE_A, name: "SEED_TURNIP.png", path: "seeds" }],
};

describe("mergeImageLibrary", () => {
  it("adds new files and keeps the ones the team already indexed", () => {
    const out = mergeImageLibrary(existing, [{ fileId: FILE_B, name: "SEED_CARROT.png" }], { now: NOW });
    if (!out.ok) throw new Error(out.message);
    expect(out.library.files.map((f) => f.fileId)).toEqual([FILE_A, FILE_B]);
    expect(out.added).toEqual([{ fileId: FILE_B, name: "SEED_CARROT.png" }]);
    expect(out.updated).toEqual([]);
  });

  it("does not add the same file twice, but takes its new name", () => {
    const out = mergeImageLibrary(existing, [{ fileId: FILE_A, name: "TURNIP.png", path: "seeds" }], { now: NOW });
    if (!out.ok) throw new Error(out.message);
    expect(out.library.files).toHaveLength(1);
    expect(out.added).toEqual([]);
    expect(out.updated).toEqual([{ fileId: FILE_A, name: "TURNIP.png", path: "seeds" }]);
  });

  it("leaves syncedAt alone: it is the date of the last folder sync", () => {
    const out = mergeImageLibrary(existing, [{ fileId: FILE_B, name: "x.png" }], { now: NOW });
    if (!out.ok) throw new Error(out.message);
    expect(out.library.syncedAt).toBe(existing.syncedAt);
    expect(out.library.folderId).toBe(FOLDER);
  });

  it("starts a library from folderUrl when none is linked", () => {
    const out = mergeImageLibrary(null, [{ fileId: FILE_B, name: "x.png" }], {
      now: NOW,
      folderUrl: `https://drive.google.com/drive/folders/${FOLDER}?usp=sharing`,
    });
    if (!out.ok) throw new Error(out.message);
    expect(out.library).toEqual({
      folderId: FOLDER,
      folderUrl: `https://drive.google.com/drive/folders/${FOLDER}`,
      syncedAt: NOW,
      files: [{ fileId: FILE_B, name: "x.png" }],
    });
  });

  it("refuses to start a library without a folder", () => {
    const out = mergeImageLibrary(null, [{ fileId: FILE_B, name: "x.png" }], { now: NOW });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("no_folder");
  });

  it("refuses a folderUrl that is not a Drive folder", () => {
    const out = mergeImageLibrary(null, [{ fileId: FILE_B, name: "x.png" }], { now: NOW, folderUrl: "https://example.com/" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("invalid_folder");
  });
});

describe("addProjectImagesSchema", () => {
  it("accepts Drive file ids and refuses anything else", () => {
    expect(addProjectImagesSchema.safeParse({ files: [{ fileId: FILE_A, name: "a.png" }] }).success).toBe(true);
    expect(addProjectImagesSchema.safeParse({ files: [{ fileId: "https://drive.google.com/x", name: "a.png" }] }).success).toBe(false);
    expect(addProjectImagesSchema.safeParse({ files: [] }).success).toBe(false);
  });
});

describe("page categories (domainTags)", () => {
  it("accept the app's categories, forgiving case and spaces", () => {
    const out = updateSectionSchema.parse({ domainTags: ["characters", " World "] });
    expect(out.domainTags).toEqual(["characters", "world"]);
  });

  it("refuse a category the app does not know, instead of filing the page under other", () => {
    expect(updateSectionSchema.safeParse({ domainTags: ["personagens"] }).success).toBe(false);
    expect(createSectionSchema.safeParse({ title: "Rex", domainTags: ["hero"] }).success).toBe(false);
  });
});
