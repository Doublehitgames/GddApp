import type { ProjectStore, UUID } from "./types";
import type { SectionAddon } from "@/lib/addons/types";
import { normalizeSectionAddons } from "@/lib/addons/normalize";
import { copyAddon, overwriteShell } from "@/lib/addons/copy";
import { moveAddon } from "@/lib/addons/move";
import { collectReverseRefUpdates, relinkIntraSectionRefsToSection } from "@/lib/addons/refs";
import { SINGLETON_ADDON_TYPES } from "@/lib/addons/singletons";
import type { SectionAuditBy } from "./types";

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

// Debounce por addon: agrupa múltiplas edições de campos num único evento 'modified'
const addonModifiedTimers = new Map<string, ReturnType<typeof setTimeout>>();
const ADDON_LOG_DEBOUNCE_MS = 60_000; // 1 minuto — tempo razoável entre edições de campos

function logAddonModified(
  get: StoreGet,
  projectId: UUID,
  sectionId: UUID,
  addonType: string,
  updatedBy?: SectionAuditBy,
  debounceKey?: string
) {
  const key = debounceKey ?? `${projectId}:${sectionId}:${addonType}`;
  const existing = addonModifiedTimers.get(key);
  if (existing) clearTimeout(existing);
  addonModifiedTimers.set(key, setTimeout(() => {
    addonModifiedTimers.delete(key);
    const sec = get().projects.find((p) => p.id === projectId)?.sections?.find((s) => s.id === sectionId);
    if (!sec) return;
    get().logSectionActivity({
      project_id:    projectId,
      section_id:    sectionId,
      section_title: sec.title,
      action:        "modified",
      detail:        addonType,
      user_id:       updatedBy?.userId      ?? null,
      user_name:     updatedBy?.displayName ?? null,
    });
  }, ADDON_LOG_DEBOUNCE_MS));
}

export function createAddonSlice(_set: StoreSet, get: StoreGet) {
  return {
    setSectionAddons: (projectId: UUID, sectionId: UUID, addons: SectionAddon[], updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const normalizedAddons = normalizeSectionAddons(addons) || [];
      get().editSection(
        projectId,
        sectionId,
        section.title,
        section.content || "",
        undefined,
        section.color,
        updatedBy,
        section.domainTags,
        normalizedAddons
      );
      // Log é disparado pelas funções específicas (updateSectionAddon, etc.)
    },
    addSectionAddon: (projectId: UUID, sectionId: UUID, addon: SectionAddon, updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const current = section.addons || [];
      get().setSectionAddons(projectId, sectionId, [...current, addon], updatedBy);
      // Ação discreta — sem debounce
      logAddonModified(get, projectId, sectionId, addon.type, updatedBy, `${projectId}:${sectionId}:add:${addon.type}`);
    },
    updateSectionAddon: (projectId: UUID, sectionId: UUID, addonId: string, nextAddon: SectionAddon, updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const current = section.addons || [];
      get().setSectionAddons(
        projectId,
        sectionId,
        current.map((addon) => (addon.id === addonId ? nextAddon : addon)),
        updatedBy
      );
      // Debounce por addon — edições rápidas de campos viram um único evento
      logAddonModified(get, projectId, sectionId, nextAddon.type, updatedBy);
    },
    removeSectionAddon: (projectId: UUID, sectionId: UUID, addonId: string, updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const addonType = section.addons?.find((a) => a.id === addonId)?.type ?? "unknown";
      const current = section.addons || [];
      get().setSectionAddons(
        projectId,
        sectionId,
        current.filter((addon) => addon.id !== addonId),
        updatedBy
      );
      // Ação discreta — sem debounce
      logAddonModified(get, projectId, sectionId, addonType, updatedBy, `${projectId}:${sectionId}:remove:${addonType}`);
    },
    copyAddonToSection: (
      projectId: UUID,
      fromSectionId: UUID,
      toSectionId: UUID,
      addonId: string,
      updatedBy?: SectionAuditBy,
      overwrite?: boolean
    ) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;
      const fromSection = project.sections?.find((s) => s.id === fromSectionId);
      const toSection = project.sections?.find((s) => s.id === toSectionId);
      if (!fromSection || !toSection) return;
      const source = (fromSection.addons || []).find((a) => a.id === addonId);
      if (!source) return;
      // Religa as refs intra-página (dataSchema/production/economyLink/RemoteConfig)
      // aos addons equivalentes do destino, em vez de limpá-las — assim os vínculos
      // de valor continuam funcionando quando o destino já tem os addons certos.
      const copied = copyAddon(source, {
        fromSectionId,
        toSectionId,
        targetAddons: toSection.addons || [],
      });
      const existing = SINGLETON_ADDON_TYPES.has(source.type)
        ? (toSection.addons || []).find((a) => a.type === source.type)
        : undefined;
      if (existing) {
        // Singleton já presente no destino. Sem permissão de sobrescrita, aborta.
        if (!overwrite) return;
        // Sobrescreve in-place, preservando id/grupo/nome do addon de destino.
        const replaced = overwriteShell(copied, existing);
        get().updateSectionAddon(projectId, toSectionId, existing.id, replaced, updatedBy);
        return;
      }
      get().addSectionAddon(projectId, toSectionId, copied, updatedBy);
    },
    moveAddonToSection: (
      projectId: UUID,
      fromSectionId: UUID,
      toSectionId: UUID,
      addonId: string,
      updatedBy?: SectionAuditBy,
      overwrite?: boolean
    ) => {
      return get().moveAddonsToSection(projectId, fromSectionId, toSectionId, [addonId], updatedBy, overwrite);
    },
    moveAddonsToSection: (
      projectId: UUID,
      fromSectionId: UUID,
      toSectionId: UUID,
      addonIds: string[],
      updatedBy?: SectionAuditBy,
      overwrite?: boolean
    ) => {
      if (fromSectionId === toSectionId || addonIds.length === 0) {
        return { reverseRefsUpdated: 0 };
      }
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return { reverseRefsUpdated: 0 };
      const fromSection = project.sections?.find((s) => s.id === fromSectionId);
      const toSection = project.sections?.find((s) => s.id === toSectionId);
      if (!fromSection || !toSection) return { reverseRefsUpdated: 0 };

      const sourceAddons = fromSection.addons || [];
      const movingSet = new Set(addonIds);
      const movingSources = sourceAddons.filter((a) => movingSet.has(a.id));
      if (movingSources.length === 0) return { reverseRefsUpdated: 0 };

      // Clona sem tratar refs agora — a religação ocorre depois, contra o snapshot
      // final do destino (inclui irmãos que vieram juntos no cascade).
      const movedAddons = movingSources.map((a) => moveAddon(a, undefined, { skipRefHandling: true }));

      // Resolve conflitos de singleton no destino. Cada addon singleton que chega
      // e já existe no destino: com overwrite, funde sobre o existente (preservando
      // id/grupo/nome do destino) e remove o antigo; sem overwrite, é descartado do
      // movimento (fica na origem) — defensivo, a UI já confirma antes.
      const targetAddons = toSection.addons || [];
      const overwrittenTargetIds = new Set<string>();
      const skippedFromMove = new Set<string>();
      const arrivingAddons: SectionAddon[] = [];
      for (const moved of movedAddons) {
        if (SINGLETON_ADDON_TYPES.has(moved.type)) {
          const existing = targetAddons.find(
            (a) => a.type === moved.type && !overwrittenTargetIds.has(a.id)
          );
          if (existing) {
            if (!overwrite) {
              skippedFromMove.add(moved.id);
              continue;
            }
            overwrittenTargetIds.add(existing.id);
            arrivingAddons.push(overwriteShell(moved, existing));
            continue;
          }
        }
        arrivingAddons.push(moved);
      }

      // Religa as refs intra-página dos addons que chegam aos addons que existirão
      // no destino após o move (pré-existentes não sobrescritos + os que chegam).
      const finalTargetAddons = [
        ...targetAddons.filter((a) => !overwrittenTargetIds.has(a.id)),
        ...arrivingAddons,
      ];
      for (const arriving of arrivingAddons) {
        relinkIntraSectionRefsToSection(arriving.data as Record<string, unknown>, arriving.type, fromSectionId, toSectionId, finalTargetAddons);
      }

      // Build post-move snapshot.
      const postMoveSections = (project.sections || []).map((s) => {
        if (s.id === fromSectionId) {
          // Addons descartados do movimento permanecem na origem.
          return { ...s, addons: (s.addons || []).filter((a) => !movingSet.has(a.id) || skippedFromMove.has(a.id)) };
        }
        if (s.id === toSectionId) {
          const kept = (s.addons || []).filter((a) => !overwrittenTargetIds.has(a.id));
          return { ...s, addons: [...kept, ...arrivingAddons] };
        }
        return s;
      });

      // Apply reverse-ref updates per *type* of moved addon.
      const movedTypes = Array.from(new Set(movingSources.map((a) => a.type)));
      let sectionsAfterRefs = postMoveSections;
      let totalCount = 0;
      for (const t of movedTypes) {
        const { updatedSections, count } = collectReverseRefUpdates(
          sectionsAfterRefs,
          t,
          fromSectionId,
          toSectionId
        );
        sectionsAfterRefs = updatedSections;
        totalCount += count;
      }

      // Persist only changed sections.
      const originalById = new Map(
        (project.sections || []).map((s) => [s.id, s.addons || []] as const)
      );
      for (const section of sectionsAfterRefs) {
        const previous = originalById.get(section.id);
        const nextAddons = section.addons || [];
        if (previous !== nextAddons) {
          get().setSectionAddons(projectId, section.id, nextAddons, updatedBy);
        }
      }

      return { reverseRefsUpdated: totalCount };
    },
  };
}
