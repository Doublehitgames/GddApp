import type { ProjectStore, UUID, Section, SectionAuditBy } from "./types";
import type { PageStatus } from "@/lib/pageStatus/types";
import type { RichDocBlock } from "@/lib/richDoc/types";
import { toSlug } from "@/lib/utils/slug";
import type { SyncEngineAPI } from "./syncEngine";
import { limitsForProject } from "./limits";
import { buildRenameRefPatches } from "@/utils/sectionReferences";

/**
 * Pseudo-section id used to run the project's own description through the
 * rename sweep alongside the pages. It holds refs like any description does,
 * and reusing the sweep keeps one rule instead of two.
 */
const PROJECT_DESCRIPTION_KEY = "__project_description__";

export type DuplicateSectionOutcome = {
  /** ID of the duplicated root section, or null when the limit blocked everything. */
  newRootId: UUID | null;
  /** Pages that were actually cloned (root + included descendants). */
  duplicated: Array<{ oldId: UUID; newId: UUID; title: string }>;
  /** Pages skipped because the structural limit would be exceeded. */
  skipped: Array<{ oldId: UUID; title: string }>;
  /** Which limit was hit (if any were skipped). */
  limitReason:
    | "structural_limit_sections_per_project"
    | null;
};

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

export function createSectionCrudSlice(set: StoreSet, get: StoreGet, engine: SyncEngineAPI) {
  return {
    addSection: (projectId: UUID, title: string, content?: string, createdBy?: SectionAuditBy, domainTags?: string[]) => {
      const projects = get().projects;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return "" as UUID;
      const limits = limitsForProject(get(), project);
      const sectionsInProject = (project.sections || []).length;
      if (sectionsInProject >= limits.FREE_MAX_SECTIONS_PER_PROJECT) {
        throw new Error("structural_limit_sections_per_project");
      }
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const audit = createdBy
        ? { created_by: createdBy.userId, created_by_name: createdBy.displayName ?? null, updated_at: now, updated_by: createdBy.userId, updated_by_name: createdBy.displayName ?? null }
        : {};
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const siblings = (p.sections || []).filter((s) => !s.parentId);
              const maxOrder = siblings.reduce((max, s) => Math.max(max, s.order || 0), -1);
              return {
                ...p,
                updatedAt: now,
                sections: [
                  ...(p.sections || []),
                  {
                    id: newId,
                    title,
                    content: content || "",
                    created_at: now,
                    parentId: undefined,
                    order: maxOrder + 1,
                    ...(domainTags && domainTags.length ? { domainTags } : {}),
                    ...audit,
                  } as Section,
                ],
              };
            }
            return p;
          }),
        projectId
      );
      get().logSectionActivity({
        project_id: projectId,
        section_id: newId,
        section_title: title,
        action: "created",
        user_id: createdBy?.userId ?? null,
        user_name: createdBy?.displayName ?? null,
      });
      return newId;
    },

    addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string, createdBy?: SectionAuditBy, domainTags?: string[]) => {
      const projects = get().projects;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return "" as UUID;
      const limits = limitsForProject(get(), project);
      const sectionsInProject = (project.sections || []).length;
      if (sectionsInProject >= limits.FREE_MAX_SECTIONS_PER_PROJECT) {
        throw new Error("structural_limit_sections_per_project");
      }
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const audit = createdBy
        ? { created_by: createdBy.userId, created_by_name: createdBy.displayName ?? null, updated_at: now, updated_by: createdBy.userId, updated_by_name: createdBy.displayName ?? null }
        : {};
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const siblings = (p.sections || []).filter((s) => s.parentId === parentId);
              const maxOrder = siblings.reduce((max, s) => Math.max(max, s.order || 0), -1);
              return {
                ...p,
                updatedAt: now,
                sections: [
                  ...(p.sections || []),
                  {
                    id: newId,
                    title,
                    content: content || "",
                    created_at: now,
                    parentId,
                    order: maxOrder + 1,
                    ...(domainTags && domainTags.length ? { domainTags } : {}),
                    ...audit,
                  } as Section,
                ],
              };
            }
            return p;
          }),
        projectId
      );
      get().logSectionActivity({
        project_id: projectId,
        section_id: newId,
        section_title: title,
        action: "created",
        user_id: createdBy?.userId ?? null,
        user_name: createdBy?.displayName ?? null,
      });
      return newId;
    },

    duplicateSection: (
      projectId: UUID,
      sectionId: UUID,
      copySuffix: string,
      createdBy?: SectionAuditBy
    ): DuplicateSectionOutcome => {
      const projects = get().projects;
      const project = projects.find((p) => p.id === projectId);
      const empty: DuplicateSectionOutcome = {
        newRootId: null,
        duplicated: [],
        skipped: [],
        limitReason: null,
      };
      if (!project) return empty;
      const allSections = project.sections || [];
      const root = allSections.find((s) => s.id === sectionId);
      if (!root) return empty;

      // BFS in parent-before-child order so cuts never leave an orphan.
      const bfs: Section[] = [];
      const queue: Section[] = [root];
      while (queue.length > 0) {
        const current = queue.shift()!;
        bfs.push(current);
        const children = allSections
          .filter((s) => s.parentId === current.id)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        queue.push(...children);
      }

      // Quantas cabem no teto DESTE projeto (limite do dono dele).
      const limits = limitsForProject(get(), project);
      const sectionsInProject = allSections.length;
      const allowed = Math.max(
        0,
        limits.FREE_MAX_SECTIONS_PER_PROJECT - sectionsInProject
      );

      const limitReason: DuplicateSectionOutcome["limitReason"] =
        allowed < bfs.length ? "structural_limit_sections_per_project" : null;

      if (allowed === 0) {
        return {
          ...empty,
          skipped: bfs.map((s) => ({ oldId: s.id, title: s.title })),
          limitReason,
        };
      }

      const take = bfs.slice(0, allowed);
      const skip = bfs.slice(allowed);
      const idMap = new Map<UUID, UUID>();
      for (const s of take) idMap.set(s.id, crypto.randomUUID());

      const now = new Date().toISOString();
      const audit = createdBy
        ? {
            created_by: createdBy.userId,
            created_by_name: createdBy.displayName ?? null,
            updated_at: now,
            updated_by: createdBy.userId,
            updated_by_name: createdBy.displayName ?? null,
          }
        : {};

      // Sibling ordering: the duplicated root sits right after the original among
      // its siblings. Everything after the original is pushed down by one.
      const rootParent = root.parentId;
      const rootSiblings = allSections
        .filter((s) => s.parentId === rootParent)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const rootIdxInSiblings = rootSiblings.findIndex((s) => s.id === root.id);
      const insertAfterOrder =
        rootSiblings[rootIdxInSiblings]?.order ?? rootSiblings.length;

      const pushedSiblingIds = new Set(
        rootSiblings.slice(rootIdxInSiblings + 1).map((s) => s.id)
      );

      const newSections: Section[] = take.map((s) => {
        const newId = idMap.get(s.id)!;
        const isRoot = s.id === root.id;
        const cloned: Section = {
          ...s,
          id: newId,
          parentId: isRoot ? rootParent : idMap.get(s.parentId as UUID),
          order: isRoot ? insertAfterOrder + 1 : s.order,
          title: isRoot ? `${s.title}${copySuffix}` : s.title,
          created_at: now,
          // Flowchart state references section IDs we did not remap; drop it.
          flowchartEnabled: undefined,
          flowchartState: undefined,
          ...audit,
        };
        return cloned;
      });

      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const shifted = (p.sections || []).map((s) =>
              pushedSiblingIds.has(s.id)
                ? { ...s, order: (s.order || 0) + 1 }
                : s
            );
            return {
              ...p,
              updatedAt: now,
              sections: [...shifted, ...newSections],
            };
          }),
        projectId
      );

      return {
        newRootId: idMap.get(root.id) ?? null,
        duplicated: take.map((s) => ({
          oldId: s.id,
          newId: idMap.get(s.id)!,
          title: s.title,
        })),
        skipped: skip.map((s) => ({ oldId: s.id, title: s.title })),
        limitReason,
      };
    },

    editSection: (
      projectId: UUID,
      sectionId: UUID,
      title: string,
      content: string,
      parentId?: string | null,
      color?: string,
      updatedBy?: SectionAuditBy,
      domainTags?: string[],
      dataId?: string
    ) => {
      const now = new Date().toISOString();
      const audit: Partial<Section> = { updated_at: now };
      // Detectar rename antes de alterar o store
      const oldSection = get().projects
        .find((p) => p.id === projectId)
        ?.sections?.find((s) => s.id === sectionId);
      const titleChanged = oldSection && oldSection.title !== title;
      // editSection is the legacy markdown path (AI improve, version restore,
      // title/color tweaks). If the markdown content actually changed, any
      // previously-stored contentBlocks are now stale — drop them so the
      // read view falls back to the new markdown instead of rendering the old
      // blocks. Inline description edits go through updateSectionDescription
      // (which sets blocks), so they're unaffected.
      const contentChanged = !oldSection || (oldSection.content || "") !== (content || "");

      // A `$[Título]` ref points at whatever page currently carries that title,
      // so renaming the page would orphan every ref written with the old name.
      // Rewriting them here is what keeps the link alive. Refs already stored as
      // `$[#id]` need nothing — they follow the rename on their own.
      const project = get().projects.find((p) => p.id === projectId);
      const refPatches = titleChanged && oldSection
        ? buildRenameRefPatches(
            [
              { id: PROJECT_DESCRIPTION_KEY, title: "", content: project?.description },
              ...(project?.sections || []).map((s) =>
                s.id === sectionId
                  ? {
                      // The renamed page is swept using the content this very
                      // call is writing, not the stale row, so a rename that
                      // also rewrites the description keeps both changes.
                      id: s.id,
                      title: oldSection.title,
                      content,
                      contentBlocks: contentChanged ? undefined : s.contentBlocks,
                    }
                  : { id: s.id, title: s.title, content: s.content, contentBlocks: s.contentBlocks }
              ),
            ],
            sectionId,
            oldSection.title,
            title
          )
        : [];
      const refPatchById = new Map(refPatches.map((patch) => [patch.id, patch]));
      const descriptionPatch = refPatchById.get(PROJECT_DESCRIPTION_KEY);

      if (updatedBy) {
        audit.updated_by = updatedBy.userId;
        audit.updated_by_name = updatedBy.displayName ?? null;
      }
      // Espelha aqui o que o trigger do banco fará no sync: só texto conta.
      // Sem isto o selo de "pode estar desatualizada" ficaria cego entre a
      // edição e o próximo sync — e num uso offline isso pode ser o dia todo.
      if (titleChanged || contentChanged) {
        audit.content_updated_at = now;
      }
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  ...(descriptionPatch?.content !== undefined
                    ? { description: descriptionPatch.content }
                    : {}),
                  sections: (p.sections || []).map((s) => {
                    const refPatch = refPatchById.get(s.id);
                    if (s.id === sectionId) {
                      const updated: Section = {
                        ...s,
                        title,
                        content: refPatch?.content ?? content,
                        ...audit,
                      };
                      if (contentChanged) delete updated.contentBlocks;
                      else if (refPatch?.contentBlocks !== undefined) {
                        updated.contentBlocks = refPatch.contentBlocks as RichDocBlock[];
                      }
                      const isColorPassedAsParentId =
                        typeof parentId === "string" && parentId.startsWith("#") && color === undefined;

                      const resolvedParentId = isColorPassedAsParentId ? undefined : parentId;
                      const resolvedColor = isColorPassedAsParentId ? parentId : color;

                      if (resolvedParentId !== undefined) {
                        if (resolvedParentId === null) delete updated.parentId;
                        else updated.parentId = resolvedParentId;
                      }
                      if (resolvedColor !== undefined) updated.color = resolvedColor;
                      else if (resolvedColor === undefined) delete updated.color;
                      if (domainTags !== undefined) updated.domainTags = domainTags.length ? domainTags : undefined;
                      if (dataId !== undefined) updated.dataId = dataId || undefined;
                      return updated;
                    }
                    if (refPatch) {
                      const swept: Section = { ...s, updated_at: now };
                      if (refPatch.content !== undefined) swept.content = refPatch.content;
                      if (refPatch.contentBlocks !== undefined) {
                        swept.contentBlocks = refPatch.contentBlocks as RichDocBlock[];
                      }
                      return swept;
                    }
                    return s;
                  }),
                }
              : p
          ),
        projectId
      );
      if (titleChanged && oldSection) {
        get().logSectionActivity({
          project_id: projectId,
          section_id: sectionId,
          section_title: title,
          action: "renamed",
          old_title: oldSection.title,
          user_id: updatedBy?.userId ?? null,
          user_name: updatedBy?.displayName ?? null,
        });
      }
    },

    updateSectionDescription: (
      projectId: UUID,
      sectionId: UUID,
      contentBlocks: RichDocBlock[],
      contentMarkdown: string,
      updatedBy?: SectionAuditBy
    ) => {
      const now = new Date().toISOString();
      const editedTitle = get()
        .projects.find((p) => p.id === projectId)
        ?.sections?.find((s) => s.id === sectionId)?.title;
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) => {
                    if (s.id !== sectionId) return s;
                    const updated: Section = {
                      ...s,
                      content: contentMarkdown,
                      contentBlocks: contentBlocks.length ? contentBlocks : undefined,
                      updated_at: now,
                      // Este caminho é sempre texto. Espelha o trigger do banco
                      // para o selo de desatualizada não ficar cego até o sync.
                      content_updated_at: now,
                    };
                    if (updatedBy) {
                      updated.updated_by = updatedBy.userId;
                      updated.updated_by_name = updatedBy.displayName ?? null;
                    }
                    return updated;
                  }),
                }
              : p
          ),
        projectId
      );

      // O autosave chama isto a cada pausa na digitação; logSectionActivity
      // dobra tudo isso em um evento por página por janela de edição.
      if (editedTitle) {
        get().logSectionActivity({
          project_id: projectId,
          section_id: sectionId,
          section_title: editedTitle,
          action: "modified",
          detail: "description",
          user_id: updatedBy?.userId ?? null,
          user_name: updatedBy?.displayName ?? null,
        });
      }
    },

    setSectionDataId: (projectId: UUID, sectionId: UUID, dataId: string | undefined) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: new Date().toISOString(),
                  sections: (p.sections || []).map((s) =>
                    s.id === sectionId ? { ...s, dataId: dataId || undefined, updated_at: new Date().toISOString() } : s
                  ),
                }
              : p
          ),
        projectId
      );
    },

    setSectionStatus: (projectId: UUID, sectionId: UUID, status: PageStatus | undefined) => {
      get().setSectionsStatus(projectId, [sectionId], status);
    },

    setSectionsStatus: (projectId: UUID, sectionIds: UUID[], status: PageStatus | undefined) => {
      if (sectionIds.length === 0) return;
      // Um set só para o lote inteiro: marcar um ramo de 30 páginas é uma
      // decisão, não trinta — e trinta chamadas seriam trinta re-renders da
      // árvore e trinta agendamentos de sync.
      const alvos = new Set(sectionIds);
      const now = new Date().toISOString();
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    alvos.has(s.id)
                      ? {
                          ...s,
                          status,
                          // O carimbo acompanha o estado: é dele que o selo de
                          // "pode estar desatualizada" mede o tempo. Tirar o
                          // estado apaga o carimbo junto, senão sobra uma data
                          // medindo coisa nenhuma.
                          statusAt: status ? now : null,
                          // De propósito NÃO mexe em updated_at: marcar uma
                          // página como aprovada não é editar a página, e o
                          // changelog não deve ganhar uma linha por isso.
                          //
                          // Do lado do banco o trigger sections_updated_at
                          // carimbava now() em qualquer update e desfazia isto
                          // — a migração add_sections_content_updated_at.sql
                          // ensina o trigger a ignorar mudança só de estado, e
                          // a marcar em separado quando o texto mudou.
                        }
                      : s
                  ),
                }
              : p
          ),
        projectId
      );
    },

    removeSection: (projectId: UUID, sectionId: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      const sections = project?.sections || [];

      // Coleta todos os descendentes para replicar o ON DELETE CASCADE do banco
      const toDelete = new Set<string>([sectionId]);
      const collectDescendants = (parentId: string) => {
        sections.forEach((s) => {
          if (s.parentId === parentId && !toDelete.has(s.id)) {
            toDelete.add(s.id);
            collectDescendants(s.id);
          }
        });
      };
      collectDescendants(sectionId);

      const deletedSection = sections.find((s) => s.id === sectionId);

      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, updatedAt: new Date().toISOString(), sections: (p.sections || []).filter((s) => !toDelete.has(s.id)) }
              : p
          ),
        projectId
      );
      get().removeSectionDiagram(projectId, sectionId);

      if (deletedSection) {
        get().logSectionActivity({
          project_id: projectId,
          section_id: sectionId,
          section_title: deletedSection.title,
          action: "deleted",
          user_id: deletedSection.updated_by ?? null,
          user_name: deletedSection.updated_by_name ?? null,
        });
      }
    },

    moveSectionUp: (projectId: UUID, sectionId: UUID) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const sections = p.sections || [];
            const section = sections.find((s) => s.id === sectionId);
            if (!section) return p;
            const siblings = sections.filter((s) => s.parentId === section.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = siblings.findIndex((s) => s.id === sectionId);
            if (currentIndex <= 0) return p;
            const prevSection = siblings[currentIndex - 1];
            const tempOrder = section.order;
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: sections.map((s) => {
                if (s.id === sectionId) return { ...s, order: prevSection.order };
                if (s.id === prevSection.id) return { ...s, order: tempOrder };
                return s;
              }),
            };
          }),
        projectId
      );
    },

    moveSectionDown: (projectId: UUID, sectionId: UUID) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const sections = p.sections || [];
            const section = sections.find((s) => s.id === sectionId);
            if (!section) return p;
            const siblings = sections.filter((s) => s.parentId === section.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = siblings.findIndex((s) => s.id === sectionId);
            if (currentIndex === -1 || currentIndex >= siblings.length - 1) return p;
            const nextSection = siblings[currentIndex + 1];
            const tempOrder = section.order;
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: sections.map((s) => {
                if (s.id === sectionId) return { ...s, order: nextSection.order };
                if (s.id === nextSection.id) return { ...s, order: tempOrder };
                return s;
              }),
            };
          }),
        projectId
      );
    },

    reorderSections: (projectId: UUID, sectionIds: UUID[]) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const sections = p.sections || [];
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: sections.map((s) => {
                const newIndex = sectionIds.indexOf(s.id);
                return newIndex !== -1 ? { ...s, order: newIndex } : s;
              }),
            };
          }),
        projectId
      );
    },

    setSectionThumbImage: (projectId: UUID, sectionId: UUID, thumbImageUrl?: string) => {
      const normalizedThumbUrl =
        typeof thumbImageUrl === "string" && thumbImageUrl.trim()
          ? thumbImageUrl.trim()
          : undefined;
      const now = new Date().toISOString();
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    s.id === sectionId ? { ...s, thumbImageUrl: normalizedThumbUrl, updated_at: now } : s
                  ),
                }
              : p
          ),
        projectId
      );
    },

    countDescendants: (projectId: UUID, sectionId: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return 0;

      const sections = project.sections || [];
      const MAX_DEPTH = 50;
      const countChildren = (parentId: UUID, depth: number): number => {
        if (depth >= MAX_DEPTH) return 0;
        const children = sections.filter((s) => s.parentId === parentId);
        return children.reduce((sum, child) => sum + 1 + countChildren(child.id, depth + 1), 0);
      };

      return countChildren(sectionId, 0);
    },

    getSectionById: (projectId: UUID, sectionId: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      return project?.sections?.find((s) => s.id === sectionId);
    },

    getSectionBySlug: (projectId: UUID, slug: string) => {
      const project = get().projects.find((p) => p.id === projectId);
      return project?.sections?.find((s) => toSlug(s.title) === slug);
    },

    hasDuplicateName: (projectId: UUID, title: string, parentId?: UUID, excludeId?: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return false;

      const newSlug = toSlug(title);
      const siblings = (project.sections || []).filter(
        (s) => s.parentId === parentId && s.id !== excludeId
      );

      return siblings.some((s) => toSlug(s.title) === newSlug);
    },

    hasDuplicateDataId: (projectId: UUID, dataId: string, excludeId?: UUID) => {
      const trimmed = dataId.trim();
      if (!trimmed) return false;
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return false;
      const target = trimmed.toLowerCase();
      return (project.sections || []).some(
        (s) => s.id !== excludeId && (s.dataId || "").trim().toLowerCase() === target
      );
    },
  };
}
