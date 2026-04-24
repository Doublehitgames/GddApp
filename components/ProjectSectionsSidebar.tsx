"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { useI18n } from "@/lib/i18n/provider";
import { getSectionSearchText } from "@/utils/sectionSearchText";
import { GAME_DESIGN_DOMAIN_IDS } from "@/lib/gameDesignDomains";
import {
  BUY_DISCOUNT_VAR_KEY,
  PAGE_TYPES,
  PRESET_ATTRIBUTES,
  PRESET_ATTRIBUTES_DISPLAY,
  REQUIREMENT_KIND_TO_PAGE_TYPE,
  SELL_MARKUP_VAR_KEY,
  buildPageTypeAddons,
  createBuyDiscountGlobalVariableAddon,
  createSellMarkupGlobalVariableAddon,
  extractFieldLibraryRefForAttrs,
  findAllEconomyModifierCandidates,
  findAttributeDefinitionsCandidates,
  findCurrencyCandidates,
  findEconomyModifierSectionIds,
  findItemCandidates,
  findRecipeCandidates,
  getPageType,
  getPageTypeDefaultSectionTitle,
  getPageTypeDescription,
  getPageTypeLabel,
  type PageType,
  type PageTypeId,
  type RequiresCandidate,
  type RequirementKind,
} from "@/lib/pageTypes/registry";
import { CraftTableRecipePickerDialog } from "@/components/CraftTableRecipePickerDialog";
import {
  AttributeDefinitionsSetupDialog,
  type AttributeDefinitionsSetupResult,
} from "@/components/AttributeDefinitionsSetupDialog";
import { PageCreationReviewDialog } from "@/components/PageCreationReviewDialog";
import { PageTypeRequiresDialog, type PageTypeRequiresChoice } from "@/components/PageTypeRequiresDialog";
import {
  Collision,
  CollisionDetection,
  DndContext,
  DragOverlay,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  projectId: string;
}

export default function ProjectSectionsSidebar({ projectId }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { user, profile } = useAuthStore();
  const sectionAuditBy = user
    ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null }
    : undefined;

  const getProject = useProjectStore((s) => s.getProject);
  const projects = useProjectStore((s) => s.projects);
  const addSection = useProjectStore((s) => s.addSection);
  const addSubsection = useProjectStore((s) => s.addSubsection);
  const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
  const reorderSections = useProjectStore((s) => s.reorderSections);

  const [mounted, setMounted] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showSectionTopFade, setShowSectionTopFade] = useState(false);
  const [showSectionBottomFade, setShowSectionBottomFade] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [selectedAddonFilters, setSelectedAddonFilters] = useState<string[]>([]);
  const [tagFilterMenuOpen, setTagFilterMenuOpen] = useState(false);
  const [addonFilterMenuOpen, setAddonFilterMenuOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [nameError, setNameError] = useState("");
  const [selectedPageTypeId, setSelectedPageTypeId] = useState<PageTypeId>("blank");
  const [pageTypePickerOpen, setPageTypePickerOpen] = useState(false);
  const [requiresDialog, setRequiresDialog] = useState<{
    open: boolean;
    pageType: PageType | null;
    requiredPageType: PageType | null;
    candidates: RequiresCandidate[];
    requirementKind: RequirementKind | null;
    introCopy?: string;
    askNameOnCreateNew?: boolean;
    createNewNameLabel?: string;
    createNewNamePlaceholder?: string;
    defaultCreateNewName?: string;
    allowEmptyCreateNewName?: boolean;
    dialogTitle?: string;
    linkExistingHeader?: string;
    createNewLabel?: string;
    createNewDescription?: string;
    skipLabel?: string;
    skipDescription?: string;
    showRecipeSettings?: boolean;
    defaultRecipeSettings?: { ingredientQty: number; outputQty: number; craftTimeSeconds: number };
    showAttributeSlotsPicker?: boolean;
    showAttributeModifiersPicker?: boolean;
    showCharacterSettings?: boolean;
    stepIndex?: number;
    stepCount?: number;
    defaultCharacterSettings?: {
      selectedAttrKeys: string[];
      customAttrs: Array<{ key: string; label: string }>;
      startLevel: number;
      endLevel: number;
      growthRate: number;
    };
    characterAttributePresets?: ReadonlyArray<{ key: string; label: string }>;
    showEconomySettings?: boolean;
    defaultEconomySettings?: {
      buyValue: number;
      sellValue: number;
      modifiersMode: "existing" | "new";
      applyBuyDiscount: boolean;
      applySellMarkup: boolean;
      selectedBuyDiscountSectionIds: string[];
      selectedSellMarkupSectionIds: string[];
      buyDiscountPct: number;
      sellMarkupPct: number;
      buyDiscountName?: string;
      sellMarkupName?: string;
    };
    existingBuyDiscountCandidates?: ReadonlyArray<{ sectionId: string; sectionTitle: string; addonName: string; percent: number }>;
    existingSellMarkupCandidates?: ReadonlyArray<{ sectionId: string; sectionTitle: string; addonName: string; percent: number }>;
    /** Snapshot of inputs captured when the dialog was opened. */
    title: string;
    parentSectionId: string | null;
    pageTypeId: PageTypeId;
  }>({
    open: false,
    pageType: null,
    requiredPageType: null,
    candidates: [],
    requirementKind: null,
    title: "",
    parentSectionId: null,
    pageTypeId: "blank",
  });

  const sectionListRef = useRef<HTMLDivElement | null>(null);
  const tagFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const addonFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const pageTypePickerRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setProject(getProject(projectId));
  }, [mounted, projectId, projects, getProject]);

  const currentSectionId = useMemo(() => {
    const match = pathname.match(/\/projects\/[^/]+\/sections\/([^/?#]+)/);
    const rawId = match?.[1] ?? null;
    if (!rawId) return null;
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  }, [pathname]);

  const sectionIds = useMemo(
    () => (project?.sections || []).map((s: any) => s.id),
    [project?.sections]
  );

  const availableDomainTags = useMemo(() => {
    const tags = new Set<string>(GAME_DESIGN_DOMAIN_IDS as unknown as string[]);
    (project?.sections || []).forEach((section: any) => {
      const sectionTags = Array.isArray(section?.domainTags) ? section.domainTags : [];
      sectionTags.forEach((tag: string) => {
        if (tag?.trim()) tags.add(tag.trim());
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [project?.sections]);

  const availableAddonTypes = useMemo(() => {
    const addonTypes = new Set<string>();
    (project?.sections || []).forEach((section: any) => {
      const sectionAddons = Array.isArray(section?.addons)
        ? section.addons
        : Array.isArray(section?.balanceAddons)
          ? section.balanceAddons
          : [];
      sectionAddons.forEach((addon: any) => {
        const type = typeof addon?.type === "string" ? addon.type.trim() : "";
        if (type) addonTypes.add(type);
      });
    });
    return Array.from(addonTypes).sort((a, b) =>
      t(`sectionDetail.history.addonType.${a}`, a).localeCompare(
        t(`sectionDetail.history.addonType.${b}`, b)
      )
    );
  }, [project?.sections, t]);

  const updateSectionFades = useCallback(() => {
    const el = sectionListRef.current;
    if (!el) {
      setShowSectionTopFade(false);
      setShowSectionBottomFade(false);
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = el;
    const hasScrollableContent = scrollHeight - clientHeight > 2;
    if (!hasScrollableContent) {
      setShowSectionTopFade(false);
      setShowSectionBottomFade(false);
      return;
    }
    setShowSectionTopFade(scrollTop > 2);
    setShowSectionBottomFade(scrollTop + clientHeight < scrollHeight - 2);
  }, []);

  useEffect(() => {
    updateSectionFades();
    window.addEventListener("resize", updateSectionFades);
    return () => window.removeEventListener("resize", updateSectionFades);
  }, [updateSectionFades, project?.sections, searchTerm, expandedSections]);

  useEffect(() => {
    setSelectedTagFilters((prev) => prev.filter((tag) => availableDomainTags.includes(tag)));
  }, [availableDomainTags]);

  useEffect(() => {
    setSelectedAddonFilters((prev) => prev.filter((type) => availableAddonTypes.includes(type)));
  }, [availableAddonTypes]);

  useEffect(() => {
    if (!tagFilterMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (tagFilterMenuRef.current?.contains(event.target as Node)) return;
      setTagFilterMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [tagFilterMenuOpen]);

  useEffect(() => {
    if (!addonFilterMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (addonFilterMenuRef.current?.contains(event.target as Node)) return;
      setAddonFilterMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [addonFilterMenuOpen]);

  useEffect(() => {
    if (!pageTypePickerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (pageTypePickerRef.current?.contains(event.target as Node)) return;
      setPageTypePickerOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [pageTypePickerOpen]);


  useEffect(() => {
    if (!currentSectionId) return;
    const sections = project?.sections || [];
    if (sections.length === 0) return;

    const sectionById = new Map<string, any>(
      sections.map((section: any) => [section.id, section])
    );
    const currentSection = sectionById.get(currentSectionId);
    if (!currentSection) return;

    const idsToExpand = new Set<string>();

    // Keep lineage visible so current section is always reachable in the tree.
    let cursor: any = currentSection;
    const visited = new Set<string>();
    while (cursor?.parentId && !visited.has(cursor.id)) {
      const parent = sectionById.get(cursor.parentId);
      if (!parent) break;
      idsToExpand.add(parent.id);
      visited.add(cursor.id);
      cursor = parent;
    }

    // If current section has children, open exactly one level for quick navigation.
    const hasChildren = sections.some((section: any) => section.parentId === currentSectionId);
    if (hasChildren) idsToExpand.add(currentSectionId);

    if (idsToExpand.size === 0) return;
    setExpandedSections((prev) => {
      const next = new Set(prev);
      idsToExpand.forEach((id) => next.add(id));
      return next;
    });
  }, [currentSectionId, project?.sections]);

  const canExpandAll = sectionIds.some((id: string) => !expandedSections.has(id));
  const canCollapseAll = expandedSections.size > 0;

  const handleExpandAllSections = () => {
    setExpandedSections(new Set(sectionIds));
  };

  const handleCollapseAllSections = () => {
    setExpandedSections(new Set());
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleAddonFilter = (type: string) => {
    setSelectedAddonFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const createSectionWithArgs = (
    title: string,
    parentSectionId: string | null,
    pageTypeId: PageTypeId,
    customAddons?: import("@/lib/addons/types").SectionAddon[],
    domainTagsOverride?: string[]
  ): string | undefined => {
    const pageTypeArg = pageTypeId === "blank" ? undefined : pageTypeId;
    const pt = getPageType(pageTypeId);
    const domainTags = domainTagsOverride ?? (pt?.tags ? [...pt.tags] : undefined);
    try {
      if (parentSectionId) {
        return addSubsection(projectId, parentSectionId, title, "", sectionAuditBy, pageTypeArg, customAddons, domainTags);
      }
      return addSection(projectId, title, undefined, sectionAuditBy, pageTypeArg, customAddons, domainTags);
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message === "structural_limit_sections_per_project" ||
          e.message === "structural_limit_sections_total")
      ) {
        setNameError(
          e.message === "structural_limit_sections_total"
            ? t("limits.sectionsTotal")
            : t("limits.sectionsPerProject")
        );
        return undefined;
      }
      throw e;
    }
  };

  type PendingCreate = {
    title: string;
    parentSectionId: string | null;
    pageTypeId: PageTypeId;
    resolved: Partial<Record<RequirementKind, PageTypeRequiresChoice>>;
    remainingKinds: RequirementKind[];
    /**
     * Kinds the user actually resolved via a wizard modal, in visit order.
     * Used by the review dialog's "Voltar" to reopen the last visited step
     * (pre-resolved kinds like `recipe.itemOutput` never enter this list).
     */
    visitedKinds: RequirementKind[];
  };

  const resetAddInputs = () => {
    setNewSectionTitle("");
    setSelectedPageTypeId("blank");
  };

  /**
   * Returns globalVariable section IDs for the item's buy discount / sell
   * markup modifiers. Behaviour depends on `opts.mode`:
   *   - "existing": reuse sentinel-key pages if present. When missing, creates
   *     them with defaults (first-time setup). Never mutates existing values.
   *   - "new": always creates fresh globalVariable sections with unique keys,
   *     per-item values and custom display names. Sentinel pages are left
   *     intact.
   */
  const ensureEconomyModifierSectionIds = (opts?: {
    mode?: "existing" | "new";
    buyDiscountPct?: number;
    sellMarkupPct?: number;
    buyDiscountName?: string;
    sellMarkupName?: string;
    applyBuyDiscount?: boolean;
    applySellMarkup?: boolean;
    /** Existing discount section IDs selected by the user (existing mode only). */
    selectedBuySectionIds?: string[];
    selectedSellSectionIds?: string[];
  }): { buyIds: string[]; sellIds: string[] } => {
    const mode = opts?.mode ?? "existing";
    const applyBuy = opts?.applyBuyDiscount ?? true;
    const applySell = opts?.applySellMarkup ?? true;
    const sections = project?.sections || [];

    if (mode === "new") {
      const slug = (s: string) =>
        s
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\w]+/g, "_")
          .toLowerCase()
          .replace(/^_+|_+$/g, "")
          .slice(0, 24);
      const now = Date.now();
      const buyIds: string[] = [];
      const sellIds: string[] = [];

      if (applyBuy) {
        const rand = Math.random().toString(36).slice(2, 6);
        const buyDisplayName =
          opts?.buyDiscountName?.trim() ||
          `${t("pageTypes.globalVariables.buyDiscountDisplayName", "Desconto de Compra")} ${rand}`;
        const buyKey = `${BUY_DISCOUNT_VAR_KEY}_${slug(buyDisplayName) || rand}`;
        const buyAddonId = `gvar-buy-${now}-${rand}`;
        const buyAddon = createBuyDiscountGlobalVariableAddon(buyAddonId, {
          displayName: buyDisplayName,
          notes: t("pageTypes.globalVariables.buyDiscountNotes", "Reduz o valor de compra de itens em 10%."),
          defaultValue: opts?.buyDiscountPct,
          key: buyKey,
        });
        const buySectionTitle = `📉 ${buyDisplayName}`;
        const newBuy = createSectionWithArgs(buySectionTitle, null, "blank", [buyAddon], ["economy"]);
        if (newBuy) buyIds.push(newBuy);
      }

      if (applySell) {
        const sellRand = Math.random().toString(36).slice(2, 6);
        const sellDisplayName =
          opts?.sellMarkupName?.trim() ||
          `${t("pageTypes.globalVariables.sellMarkupDisplayName", "Bônus de Venda")} ${sellRand}`;
        const sellKey = `${SELL_MARKUP_VAR_KEY}_${slug(sellDisplayName) || sellRand}`;
        const sellAddonId = `gvar-sell-${now}-${sellRand}`;
        const sellAddon = createSellMarkupGlobalVariableAddon(sellAddonId, {
          displayName: sellDisplayName,
          notes: t("pageTypes.globalVariables.sellMarkupNotes", "Aumenta o valor de venda de itens em 10%."),
          defaultValue: opts?.sellMarkupPct,
          key: sellKey,
        });
        const sellSectionTitle = `📈 ${sellDisplayName}`;
        const newSell = createSectionWithArgs(sellSectionTitle, null, "blank", [sellAddon], ["economy"]);
        if (newSell) sellIds.push(newSell);
      }

      return { buyIds, sellIds };
    }

    // mode === "existing": link to the user-selected subset of existing pages.
    // First-time callers (no candidates AT ALL) bootstrap a default pair.
    const existing = findEconomyModifierSectionIds(sections);
    const buyIds: string[] = applyBuy ? [...(opts?.selectedBuySectionIds || [])] : [];
    const sellIds: string[] = applySell ? [...(opts?.selectedSellSectionIds || [])] : [];

    if (applyBuy && buyIds.length === 0 && !existing.buyDiscountSectionId) {
      const addonId = `gvar-buy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const addon = createBuyDiscountGlobalVariableAddon(addonId, {
        displayName: t("pageTypes.globalVariables.buyDiscountDisplayName", "Desconto de Compra"),
        notes: t("pageTypes.globalVariables.buyDiscountNotes", "Reduz o valor de compra de itens em 10%."),
        defaultValue: opts?.buyDiscountPct,
      });
      const sectionTitle = t("pageTypes.autoSections.buyDiscount", "📉 Desconto de Compra");
      const newId = createSectionWithArgs(sectionTitle, null, "blank", [addon], ["economy"]);
      if (newId) buyIds.push(newId);
    }
    if (applySell && sellIds.length === 0 && !existing.sellMarkupSectionId) {
      const addonId = `gvar-sell-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const addon = createSellMarkupGlobalVariableAddon(addonId, {
        displayName: t("pageTypes.globalVariables.sellMarkupDisplayName", "Bônus de Venda"),
        notes: t("pageTypes.globalVariables.sellMarkupNotes", "Aumenta o valor de venda de itens em 10%."),
        defaultValue: opts?.sellMarkupPct,
      });
      const sectionTitle = t("pageTypes.autoSections.sellMarkup", "📈 Bônus de Venda");
      const newId = createSectionWithArgs(sectionTitle, null, "blank", [addon], ["economy"]);
      if (newId) sellIds.push(newId);
    }
    return { buyIds, sellIds };
  };

  const openModalForKind = (kind: RequirementKind, state: PendingCreate) => {
    const pageType = getPageType(state.pageTypeId) ?? null;
    if (!pageType) return;
    const sectionNameLabel = t("pageTypes.requiresDialog.sectionNameLabel", "Nome da página");

    // Step chip: 1-indexed position of this modal among the USER-FACING
    // kinds. Pre-resolved kinds (e.g. recipe.itemOutput) are excluded, so
    // `visitedKinds.length + remainingKinds.length` yields the visible total.
    const stepIndex = state.visitedKinds.length + 1;
    const stepCount = state.visitedKinds.length + state.remainingKinds.length;

    // Helper: resolves the per-kind copy block (title/headers/labels/descriptions).
    // Interpolates `{name}` placeholders with the title the user typed.
    const interp = (s: string) => s.replace(/\{name\}/g, state.title);
    const kindCopy = (kindId: RequirementKind) => {
      const base = `pageTypes.requiresDialog.byKind.${kindId}`;
      return {
        title: interp(t(`${base}.title`, "")),
        linkExistingHeader: interp(t(`${base}.linkExistingHeader`, "")),
        createNewLabel: interp(t(`${base}.createNewLabel`, "")),
        createNewDescription: interp(t(`${base}.createNewDescription`, "")),
        skipLabel: interp(t(`${base}.skipLabel`, "")),
        skipDescription: interp(t(`${base}.skipDescription`, "")),
      };
    };
    // Fallback to undefined when the locale returns an empty string so the
    // dialog falls back to the generic copy.
    const orUndef = (s: string) => (s && s.trim() ? s : undefined);

    if (kind === "attributeDefinitions") {
      const reqPT = getPageType("attributeDefinitions");
      const defaultName = reqPT ? getPageTypeDefaultSectionTitle(reqPT, t) : "Atributos";
      const copy = kindCopy("attributeDefinitions");
      // Level range + growth only make sense for `characters` (which seeds a
      // progression table). EquipmentItem uses the slots picker without the
      // level knobs.
      const attachCharacterSettings = state.pageTypeId === "characters";
      // Parents that seed `attributeModifiers` (and therefore also care about
      // which attribute slots exist) opt into both the slots editor on
      // create-new AND the per-attribute modifier editor on link-existing.
      const supportsAttrCustomization =
        state.pageTypeId === "characters" || state.pageTypeId === "equipmentItem";
      setRequiresDialog({
        open: true,
        pageType,
        requiredPageType: reqPT ?? null,
        candidates: findAttributeDefinitionsCandidates(project?.sections || []),
        requirementKind: "attributeDefinitions",
        title: state.title,
        parentSectionId: state.parentSectionId,
        pageTypeId: state.pageTypeId,
        askNameOnCreateNew: true,
        createNewNameLabel: sectionNameLabel,
        createNewNamePlaceholder: defaultName,
        defaultCreateNewName: defaultName,
        dialogTitle: orUndef(copy.title),
        linkExistingHeader: orUndef(copy.linkExistingHeader),
        createNewLabel: orUndef(copy.createNewLabel),
        createNewDescription: orUndef(copy.createNewDescription),
        skipLabel: orUndef(copy.skipLabel),
        skipDescription: orUndef(copy.skipDescription),
        showAttributeSlotsPicker: supportsAttrCustomization,
        showAttributeModifiersPicker: supportsAttrCustomization,
        showCharacterSettings: attachCharacterSettings,
        defaultCharacterSettings: supportsAttrCustomization
          ? {
              selectedAttrKeys: PRESET_ATTRIBUTES.map((p) => p.key),
              customAttrs: [],
              startLevel: 1,
              endLevel: 100,
              growthRate: 1.15,
            }
          : undefined,
        characterAttributePresets: supportsAttrCustomization ? PRESET_ATTRIBUTES_DISPLAY : undefined,
        stepIndex,
        stepCount,
      });
      return;
    }
    if (kind === "currency") {
      const pageTypeLabel = getPageTypeLabel(pageType, t).toLowerCase();
      const introCopy = t(
        "pageTypes.requiresDialog.introCurrency",
        "Páginas de {page} usam uma moeda para definir valores de compra e venda. Escolha abaixo qual moeda vincular — a página também receberá modificadores de desconto e bônus automaticamente."
      ).replace("{page}", pageTypeLabel);
      const reqPT = getPageType("economy");
      const defaultName = reqPT ? getPageTypeDefaultSectionTitle(reqPT, t) : "Coin";
      const copy = kindCopy("currency");
      // Expose economy knobs for page types that seed an economyLink.
      const attachEconomySettings =
        state.pageTypeId === "items" || state.pageTypeId === "equipmentItem";
      // Collect ALL existing discount/markup globalVariables so the user can
      // pick any subset to stack as modifiers on this item.
      const allModCandidates = findAllEconomyModifierCandidates(project?.sections || []);
      const hasExistingModifiers =
        allModCandidates.discounts.length > 0 || allModCandidates.markups.length > 0;
      const defaultEconomy = attachEconomySettings
        ? {
            buyValue: 100,
            sellValue: 50,
            modifiersMode: (hasExistingModifiers ? "existing" : "new") as "existing" | "new",
            applyBuyDiscount: true,
            applySellMarkup: true,
            selectedBuyDiscountSectionIds: allModCandidates.discounts.map((c) => c.sectionId),
            selectedSellMarkupSectionIds: allModCandidates.markups.map((c) => c.sectionId),
            buyDiscountPct: allModCandidates.discounts[0]?.percent ?? -10,
            sellMarkupPct: allModCandidates.markups[0]?.percent ?? 10,
            buyDiscountName: "",
            sellMarkupName: "",
          }
        : undefined;
      setRequiresDialog({
        open: true,
        pageType,
        requiredPageType: reqPT ?? null,
        candidates: findCurrencyCandidates(project?.sections || []),
        requirementKind: "currency",
        introCopy,
        title: state.title,
        parentSectionId: state.parentSectionId,
        pageTypeId: state.pageTypeId,
        askNameOnCreateNew: true,
        createNewNameLabel: sectionNameLabel,
        createNewNamePlaceholder: defaultName,
        defaultCreateNewName: defaultName,
        dialogTitle: orUndef(copy.title),
        linkExistingHeader: orUndef(copy.linkExistingHeader),
        createNewLabel: orUndef(copy.createNewLabel),
        createNewDescription: orUndef(copy.createNewDescription),
        skipLabel: orUndef(copy.skipLabel),
        skipDescription: orUndef(copy.skipDescription),
        showEconomySettings: attachEconomySettings,
        defaultEconomySettings: defaultEconomy,
        existingBuyDiscountCandidates: attachEconomySettings ? allModCandidates.discounts : undefined,
        existingSellMarkupCandidates: attachEconomySettings ? allModCandidates.markups : undefined,
        stepIndex,
        stepCount,
      });
      return;
    }
    if (kind === "itemIngredient" || kind === "itemOutput") {
      const isIngredient = kind === "itemIngredient";
      const introKey = isIngredient
        ? "pageTypes.requiresDialog.introItemIngredient"
        : "pageTypes.requiresDialog.introItemOutput";
      const introFallback = isIngredient
        ? "Selecione o item usado como ingrediente desta receita. Você pode linkar um item existente ou criar um novo."
        : "Selecione o item gerado como saída desta receita. Você pode linkar um item existente ou criar um novo.";
      const nameLabel = isIngredient
        ? t("pageTypes.requiresDialog.ingredientNameLabel", "Nome do ingrediente")
        : t("pageTypes.requiresDialog.outputNameLabel", "Nome do item de saída");
      const placeholder = isIngredient
        ? t("pageTypes.requiresDialog.ingredientNamePlaceholder", "Ex.: Madeira, Tecido, Ferro")
        : undefined;
      const copy = kindCopy(kind);
      // Recipe quantities + time show up in the ingredient modal, since for
      // `recipe` this is the only step the user sees.
      const attachRecipeSettings = state.pageTypeId === "recipe" && isIngredient;
      setRequiresDialog({
        open: true,
        pageType,
        requiredPageType: getPageType("items") ?? null,
        candidates: findItemCandidates(project?.sections || []),
        requirementKind: kind,
        introCopy: t(introKey, introFallback),
        title: state.title,
        parentSectionId: state.parentSectionId,
        pageTypeId: state.pageTypeId,
        askNameOnCreateNew: true,
        createNewNameLabel: nameLabel,
        createNewNamePlaceholder: placeholder,
        // Ingredient: no default (user must name). Output: pre-fill with typed recipe title.
        defaultCreateNewName: isIngredient ? undefined : state.title,
        dialogTitle: orUndef(copy.title),
        linkExistingHeader: orUndef(copy.linkExistingHeader),
        createNewLabel: orUndef(copy.createNewLabel),
        createNewDescription: orUndef(copy.createNewDescription),
        skipLabel: orUndef(copy.skipLabel),
        skipDescription: orUndef(copy.skipDescription),
        showRecipeSettings: attachRecipeSettings,
        defaultRecipeSettings: attachRecipeSettings
          ? { ingredientQty: 10, outputQty: 1, craftTimeSeconds: 60 }
          : undefined,
        stepIndex,
        stepCount,
      });
    }
  };

  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [craftTablePending, setCraftTablePending] = useState<{
    title: string;
    parentSectionId: string | null;
    candidates: RequiresCandidate[];
  } | null>(null);
  // Pending self-setup for an `attributeDefinitions` page. Holds the typed
  // title + parent until the user confirms the setup dialog with a name and
  // slot choices; then we create the page with overrides.
  const [attrSetupPending, setAttrSetupPending] = useState<{
    title: string;
    parentSectionId: string | null;
  } | null>(null);
  // Holds the fully-resolved PendingCreate while the user reviews the
  // summary dialog. Null when the review is not active.
  const [reviewPending, setReviewPending] = useState<PendingCreate | null>(null);

  const handleAddByContext = () => {
    const title = newSectionTitle.trim();
    if (!title || nameError) return;

    const parentSectionId =
      currentSectionId &&
      (project?.sections || []).some((section: any) => section.id === currentSectionId)
        ? currentSectionId
        : null;

    const pageType = selectedPageTypeId === "blank" ? null : getPageType(selectedPageTypeId) ?? null;
    const kinds: RequirementKind[] = pageType?.requires ? [...pageType.requires] : [];

    // attributeDefinitions: no `requires`, but we want the user to confirm
    // the page name and pick which slots to seed (including custom ones)
    // before actually creating the page.
    if (pageType?.id === "attributeDefinitions") {
      setAttrSetupPending({ title, parentSectionId });
      return;
    }

    // craftTable: no requires, but always show the recipe picker so the user
    // sees the current set (or the empty-state hint when no recipes exist).
    if (pageType?.id === "craftTable") {
      const recipeCandidates = findRecipeCandidates(project?.sections || []);
      setCraftTablePending({ title, parentSectionId, candidates: recipeCandidates });
      return;
    }

    if (!pageType || kinds.length === 0) {
      const created = createSectionWithArgs(title, parentSectionId, selectedPageTypeId);
      if (created === undefined) return;
      setNameError("");
      resetAddInputs();
      return;
    }

    // For `recipe`: the typed title IS the output name. Pre-resolve the
    // itemOutput requirement so the user only sees the ingredient modal.
    const preResolved: PendingCreate["resolved"] = {};
    const remainingKinds = kinds.filter((k) => {
      if (selectedPageTypeId === "recipe" && k === "itemOutput") {
        // If an item with this exact title already exists (minus emoji prefix),
        // link to it; otherwise create a new one with the typed name.
        const sections = project?.sections || [];
        const normalize = (s: string) => s.replace(/^[^\w]+/, "").trim().toLowerCase();
        const typedNorm = normalize(title);
        const existing = findItemCandidates(sections).find(
          (c) => normalize(c.sectionTitle) === typedNorm
        );
        if (existing) {
          preResolved.itemOutput = { mode: "link-existing", candidate: existing };
        } else {
          preResolved.itemOutput = { mode: "create-new", name: title };
        }
        return false;
      }
      return true;
    });

    const state: PendingCreate = {
      title,
      parentSectionId,
      pageTypeId: selectedPageTypeId,
      resolved: preResolved,
      remainingKinds,
      visitedKinds: [],
    };
    setPendingCreate(state);
    if (state.remainingKinds.length > 0) {
      openModalForKind(state.remainingKinds[0], state);
    } else {
      // No wizard steps — simple page types (blank, narrative, economy,
      // progression) skip the review dialog entirely.
      executePendingCreate(state);
    }
  };

  const handleRequiresCancel = () => {
    setRequiresDialog((prev) => ({ ...prev, open: false }));
    setPendingCreate(null);
  };

  const handleRequiresChoice = (choice: PageTypeRequiresChoice) => {
    if (!pendingCreate) return;
    const kind = requiresDialog.requirementKind;
    setRequiresDialog((prev) => ({ ...prev, open: false }));
    if (!kind) return;

    // Track this kind as visited (preResolved kinds like recipe.itemOutput
    // never enter here — the review dialog uses this to know where "Voltar"
    // should reopen). Dedupe so reopening a step doesn't double-count.
    const visitedKinds = pendingCreate.visitedKinds.includes(kind)
      ? pendingCreate.visitedKinds
      : [...pendingCreate.visitedKinds, kind];

    const nextState: PendingCreate = {
      ...pendingCreate,
      resolved: { ...pendingCreate.resolved, [kind]: choice },
      remainingKinds: pendingCreate.remainingKinds.slice(1),
      visitedKinds,
    };
    setPendingCreate(nextState);

    if (nextState.remainingKinds.length > 0) {
      openModalForKind(nextState.remainingKinds[0], nextState);
    } else {
      // All wizard steps done — hand off to the review dialog instead of
      // committing directly. User confirms there to actually create.
      setReviewPending(nextState);
    }
  };

  const executePendingCreate = (state: PendingCreate) => {
    setPendingCreate(null);

    // Resolve attribute definitions link.
    let attrDefsSectionId: string | null = null;
    let attrDefsAttributes: Array<{ key: string; label?: string; defaultValue: number | boolean }> = [];
    let attrDefsFieldLibrary:
      | { libraryAddonId: string; entryIdByAttrKey: Record<string, string> }
      | undefined;
    const attrChoice = state.resolved.attributeDefinitions;
    if (attrChoice?.mode === "link-existing") {
      attrDefsSectionId = attrChoice.candidate.sectionId;
      attrDefsAttributes = (attrChoice.candidate.attributes || []).map((a) => ({
        key: a.key,
        label: a.label,
        defaultValue: a.defaultValue,
      }));
      const linkedSection = (project?.sections || []).find(
        (s: any) => s.id === attrChoice.candidate.sectionId
      );
      attrDefsFieldLibrary = extractFieldLibraryRefForAttrs(
        linkedSection,
        attrDefsAttributes.map((a) => a.key)
      );
    } else if (attrChoice?.mode === "create-new") {
      const reqPT = getPageType("attributeDefinitions");
      if (reqPT) {
        // Derive attribute overrides from character settings (if present on this choice).
        const charSettings = (
          attrChoice as {
            characterSettings?: {
              selectedAttrKeys: string[];
              customAttrs?: Array<{ key: string; label: string }>;
            };
          }
        ).characterSettings;
        const selectedKeys = charSettings?.selectedAttrKeys ?? null;
        const customAttrs = charSettings?.customAttrs ?? [];
        // Start from the filtered presets (or all presets if nothing selected)
        // and append user-defined custom slots with sane int defaults so they
        // match the AttributeDefinitionEntry shape `seedAttributeDefinitions`
        // expects.
        const presetBase =
          selectedKeys && selectedKeys.length > 0
            ? PRESET_ATTRIBUTES.filter((p) => selectedKeys.includes(p.key))
            : undefined;
        const customBase = customAttrs.map((attr) => ({
          key: attr.key,
          label: attr.label,
          valueType: "int" as const,
          defaultValue: 0,
          min: 0,
        }));
        const attrOverrides =
          presetBase || customBase.length > 0
            ? [...(presetBase ?? []), ...customBase]
            : undefined;
        const attrBuildOptions = attrOverrides
          ? { attributeDefinitionsOverrides: { attributes: attrOverrides } }
          : {};
        // Build the addons ONCE so we can both pass them as customAddons
        // to the create call AND derive stable ref IDs from the same seed.
        const seededAll = buildPageTypeAddons(reqPT.id, attrBuildOptions, t);
        const baseTitle = attrChoice.name?.trim() || getPageTypeDefaultSectionTitle(reqPT, t);
        const sectionTitle = `${reqPT.emoji} ${baseTitle}`;
        const newId = createSectionWithArgs(sectionTitle, null, reqPT.id, seededAll);
        if (!newId) return;
        attrDefsSectionId = newId;
        const seededAttrs = seededAll.find((a) => a.type === "attributeDefinitions");
        if (seededAttrs && seededAttrs.type === "attributeDefinitions") {
          attrDefsAttributes = seededAttrs.data.attributes.map((a) => ({
            key: a.key,
            label: a.label,
            defaultValue: a.defaultValue,
          }));
        }
        attrDefsFieldLibrary = extractFieldLibraryRefForAttrs(
          { id: newId, title: sectionTitle, addons: seededAll },
          attrDefsAttributes.map((a) => a.key)
        );
      }
    }

    // Resolve currency link.
    let currencySectionId: string | null = null;
    const currencyChoice = state.resolved.currency;
    if (currencyChoice?.mode === "link-existing") {
      currencySectionId = currencyChoice.candidate.sectionId;
    } else if (currencyChoice?.mode === "create-new") {
      const reqPT = getPageType("economy");
      if (reqPT) {
        const baseTitle = currencyChoice.name?.trim() || getPageTypeDefaultSectionTitle(reqPT, t);
        const sectionTitle = `${reqPT.emoji} ${baseTitle}`;
        const newId = createSectionWithArgs(sectionTitle, null, reqPT.id);
        if (!newId) return;
        currencySectionId = newId;
      }
    }

    // Ensure economy modifier sections when the page type declares an economy
    // requirement (items, equipmentItem). Also sync any user-chosen % with the
    // existing globalVariable addon so the values take effect.
    const economyChoice = state.resolved.currency as
      | {
          economySettings?: {
            buyValue: number;
            sellValue: number;
            modifiersMode?: "existing" | "new";
            applyBuyDiscount?: boolean;
            applySellMarkup?: boolean;
            buyDiscountPct: number;
            sellMarkupPct: number;
            buyDiscountName?: string;
            sellMarkupName?: string;
          };
        }
      | undefined;
    const economySettings = economyChoice?.economySettings as
      | {
          buyValue: number;
          sellValue: number;
          modifiersMode?: "existing" | "new";
          applyBuyDiscount?: boolean;
          applySellMarkup?: boolean;
          selectedBuyDiscountSectionIds?: string[];
          selectedSellMarkupSectionIds?: string[];
          buyDiscountPct: number;
          sellMarkupPct: number;
          buyDiscountName?: string;
          sellMarkupName?: string;
        }
      | undefined;
    let buyIds: string[] = [];
    let sellIds: string[] = [];
    if (state.resolved.currency) {
      const mod = ensureEconomyModifierSectionIds(
        economySettings
          ? {
              mode: economySettings.modifiersMode ?? "existing",
              buyDiscountPct: economySettings.buyDiscountPct,
              sellMarkupPct: economySettings.sellMarkupPct,
              buyDiscountName: economySettings.buyDiscountName,
              sellMarkupName: economySettings.sellMarkupName,
              applyBuyDiscount: economySettings.applyBuyDiscount,
              applySellMarkup: economySettings.applySellMarkup,
              selectedBuySectionIds: economySettings.selectedBuyDiscountSectionIds,
              selectedSellSectionIds: economySettings.selectedSellMarkupSectionIds,
            }
          : undefined
      );
      buyIds = mod.buyIds;
      sellIds = mod.sellIds;
    }

    // Resolve item ingredient/output links for the `recipe` page type.
    const resolveItemChoice = (
      choice: PageTypeRequiresChoice | undefined,
      titleOverride: string,
      titleFallback: string
    ): string | null => {
      if (!choice || choice.mode === "skip") return null;
      if (choice.mode === "link-existing") return choice.candidate.sectionId;
      // create-new: route through the full items flow so ingredient/output items
      // end up with their own currency + modifier refs already wired.
      const itemsPT = getPageType("items");
      if (!itemsPT) return null;
      const currencyId = currencySectionId;
      if (!currencyId) return null; // can't create an item without a currency resolved
      const chosenName = choice.name?.trim();
      const base = chosenName || titleOverride || titleFallback;
      const itemTitle = `${itemsPT.emoji} ${base}`;
      const itemAddons = buildPageTypeAddons(
        "items",
        {
          linkCurrency: { sectionId: currencyId },
          linkEconomyModifiers: { buySectionIds: buyIds, sellSectionIds: sellIds },
          economyLinkBaseValues: { buyValue: 100, sellValue: 50 },
        },
        t
      );
      const newId = createSectionWithArgs(itemTitle, null, "items", itemAddons);
      return newId ?? null;
    };

    // For recipe flow, also guarantee a currency exists so we can seed item pages' economy link.
    if (
      state.pageTypeId === "recipe" &&
      (state.resolved.itemIngredient?.mode === "create-new" ||
        state.resolved.itemOutput?.mode === "create-new") &&
      !currencySectionId
    ) {
      const ecoPT = getPageType("economy");
      if (ecoPT) {
        const ecoTitle = `${ecoPT.emoji} ${getPageTypeDefaultSectionTitle(ecoPT, t)}`;
        const newId = createSectionWithArgs(ecoTitle, null, ecoPT.id);
        if (newId) {
          currencySectionId = newId;
          const mod = ensureEconomyModifierSectionIds();
          buyIds = mod.buyIds;
          sellIds = mod.sellIds;
        }
      }
    }

    const ingredientSectionId = resolveItemChoice(
      state.resolved.itemIngredient,
      "", // no default override — the modal asks the user for a name
      t("pageTypes.autoSections.newIngredientItem", "Novo Ingrediente")
    );
    // Output inherits the title the user typed for the Recipe page (e.g. "Tábua").
    const outputSectionId = resolveItemChoice(
      state.resolved.itemOutput,
      state.title,
      t("pageTypes.autoSections.newOutputItem", "Novo Item de Saída")
    );

    // Pull character-settings progression overrides from the attrDefs choice.
    const charSettingsForProgression = (
      state.resolved.attributeDefinitions as
        | { characterSettings?: { startLevel: number; endLevel: number; growthRate: number } }
        | undefined
    )?.characterSettings;
    const progressionOverrides = charSettingsForProgression
      ? {
          startLevel: charSettingsForProgression.startLevel,
          endLevel: charSettingsForProgression.endLevel,
          growthRate: charSettingsForProgression.growthRate,
        }
      : undefined;

    // Collect the user-authored per-attribute modifier plan (only present
    // when the user picked an existing attributeDefinitions page in the
    // wizard and the parent seeds an attributeModifiers addon).
    const attrModifiersPlan = (
      state.resolved.attributeDefinitions as
        | {
            attributeModifiersPlan?: Array<{
              attributeKey: string;
              mode: "add" | "mult" | "set";
              value: number;
            }>;
          }
        | undefined
    )?.attributeModifiersPlan;

    const options = {
      linkAttributeDefinitions: attrDefsSectionId
        ? {
            sectionId: attrDefsSectionId,
            attributes: attrDefsAttributes,
            fieldLibrary: attrDefsFieldLibrary,
            progressionOverrides,
          }
        : undefined,
      attributeModifiersSeed:
        attrModifiersPlan && attrModifiersPlan.length > 0
          ? attrModifiersPlan
          : undefined,
      linkCurrency: currencySectionId ? { sectionId: currencySectionId } : undefined,
      linkEconomyModifiers: state.resolved.currency
        ? { buySectionIds: buyIds, sellSectionIds: sellIds }
        : undefined,
      economyLinkBaseValues: state.resolved.currency
        ? {
            buyValue: economySettings?.buyValue ?? 100,
            sellValue: economySettings?.sellValue ?? 50,
          }
        : undefined,
      linkRecipe:
        ingredientSectionId || outputSectionId
          ? (() => {
              // Recipe settings flow in via the ingredient-modal choice
              // (recipe's only visible step). Fall back to sensible defaults.
              const settings =
                (state.resolved.itemIngredient as { recipeSettings?: { ingredientQty: number; outputQty: number; craftTimeSeconds: number } } | undefined)?.recipeSettings;
              return {
                ingredientSectionId: ingredientSectionId ?? undefined,
                outputSectionId: outputSectionId ?? undefined,
                ingredientQuantity: settings?.ingredientQty ?? 10,
                outputQuantity: settings?.outputQty ?? 1,
                craftTimeSeconds: settings?.craftTimeSeconds ?? 60,
              };
            })()
          : undefined,
    };

    const customAddons = buildPageTypeAddons(state.pageTypeId, options, t);
    // For the recipe page type, prefix the section title with "Receita de"
    // (skipped when the user already typed the prefix).
    let finalTitle = state.title;
    if (state.pageTypeId === "recipe") {
      const prefix = t("pageTypes.autoSections.recipePrefix", "Receita de");
      const normalized = finalTitle.toLowerCase().trim();
      const normalizedPrefix = prefix.toLowerCase() + " ";
      if (!normalized.startsWith(normalizedPrefix)) {
        finalTitle = `${prefix} ${finalTitle}`;
      }
    }
    const created = createSectionWithArgs(
      finalTitle,
      state.parentSectionId,
      state.pageTypeId,
      customAddons.length ? customAddons : undefined
    );
    if (created === undefined) return;
    resetAddInputs();
  };

  // Called when the user confirms the attributeDefinitions self-setup dialog.
  // Builds the addons with slot overrides derived from the chosen presets +
  // user-defined custom slots, then creates the section in one shot.
  const handleAttrSetupConfirm = (result: AttributeDefinitionsSetupResult) => {
    if (!attrSetupPending) return;
    const snap = attrSetupPending;
    setAttrSetupPending(null);
    const reqPT = getPageType("attributeDefinitions");
    if (!reqPT) return;
    const presetBase =
      result.selectedPresetKeys.length > 0
        ? PRESET_ATTRIBUTES.filter((p) => result.selectedPresetKeys.includes(p.key))
        : [];
    const customBase = result.customAttrs.map((attr) => ({
      key: attr.key,
      label: attr.label,
      valueType: "int" as const,
      defaultValue: 0,
      min: 0,
    }));
    const attrOverrides =
      presetBase.length > 0 || customBase.length > 0
        ? [...presetBase, ...customBase]
        : undefined;
    const customAddons = buildPageTypeAddons(
      "attributeDefinitions",
      attrOverrides
        ? { attributeDefinitionsOverrides: { attributes: attrOverrides } }
        : {},
      t
    );
    const baseTitle =
      result.name.trim() || snap.title || getPageTypeDefaultSectionTitle(reqPT, t);
    const sectionTitle = `${reqPT.emoji} ${baseTitle}`;
    const created = createSectionWithArgs(
      sectionTitle,
      snap.parentSectionId,
      "attributeDefinitions",
      customAddons.length ? customAddons : undefined
    );
    if (created === undefined) return;
    setNameError("");
    resetAddInputs();
  };

  // Fires when the user hits "Criar tudo" in the review dialog. This is the
  // real commit — everything before this point was staging.
  const handleReviewConfirm = () => {
    if (!reviewPending) return;
    const snap = reviewPending;
    setReviewPending(null);
    executePendingCreate(snap);
  };

  // Reopens the last wizard step the user actually saw (from `visitedKinds`)
  // with prior choices preserved. If a user changes their mind on the new
  // choice, the old entry in `resolved` is overwritten by handleRequiresChoice.
  const handleReviewBack = () => {
    if (!reviewPending) return;
    const last = reviewPending.visitedKinds[reviewPending.visitedKinds.length - 1];
    if (!last) {
      // Nothing to go back to — simple page type; just cancel.
      setReviewPending(null);
      setPendingCreate(null);
      return;
    }
    const restored: PendingCreate = {
      ...reviewPending,
      remainingKinds: [last],
      visitedKinds: reviewPending.visitedKinds.slice(0, -1),
    };
    setPendingCreate(restored);
    setReviewPending(null);
    openModalForKind(last, restored);
  };

  const handleReviewCancel = () => {
    setReviewPending(null);
    setPendingCreate(null);
  };

  const handleCraftTableConfirm = (selectedSectionIds: string[]) => {
    if (!craftTablePending) return;
    const snap = craftTablePending;
    setCraftTablePending(null);
    const customAddons = buildPageTypeAddons(
      "craftTable",
      { linkCraftTableRecipes: { recipeSectionIds: selectedSectionIds } },
      t
    );
    const created = createSectionWithArgs(
      snap.title,
      snap.parentSectionId,
      "craftTable",
      customAddons.length ? customAddons : undefined
    );
    if (created === undefined) return;
    resetAddInputs();
  };

  if (!mounted || !project) return null;

  const isAtProjectHome = pathname === `/projects/${projectId}`;

  return (
    <aside className="relative overflow-hidden bg-gray-800/75 border border-gray-700/80 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/10 h-full flex flex-col">
      <span
        className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10 pointer-events-none"
        aria-hidden
      />

      <Link
        href={`/projects/${projectId}`}
        aria-current={isAtProjectHome ? "page" : undefined}
        className={`relative mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-150 ${
          isAtProjectHome
            ? "border-indigo-300/70 bg-indigo-600/25 text-indigo-50 shadow-md shadow-indigo-900/25"
            : "border-gray-700/70 bg-gray-900/60 text-gray-200 hover:border-indigo-400/50 hover:bg-gray-800/80 hover:text-white"
        }`}
        title={t("projectDetail.projectHomeLabel", "Página inicial do projeto")}
      >
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" />
        </svg>
        <span className="truncate">{t("projectDetail.projectHomeLabel", "Página inicial do projeto")}</span>
      </Link>

      <div className="relative mb-4" ref={tagFilterMenuRef}>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("projectDetail.sectionsTitle")}</h2>
          <p className="text-sm text-gray-400 mt-1">{t("projectDetail.sectionsSubtitle")}</p>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-indigo-400/45 bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/20 px-2 text-xs font-semibold text-indigo-100 tabular-nums shadow-sm shadow-indigo-900/25">
            {(project.sections || []).length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExpandAllSections}
              disabled={!canExpandAll || sectionIds.length === 0}
              title={t("projectDetail.expandAllSections")}
              aria-label={t("projectDetail.expandAllSections")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-600 bg-gray-900/75 text-gray-200 transition-all duration-150 hover:border-indigo-400 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7l5 5 5-5M7 13l5 5 5-5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleCollapseAllSections}
              disabled={!canCollapseAll}
              title={t("projectDetail.collapseAllSections")}
              aria-label={t("projectDetail.collapseAllSections")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-600 bg-gray-900/75 text-gray-200 transition-all duration-150 hover:border-indigo-400 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 11l-5-5-5 5M17 17l-5-5-5 5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setTagFilterMenuOpen((v) => !v)}
              title={t("projectDetail.tagFilterLabel")}
              aria-label={t("projectDetail.tagFilterLabel")}
              aria-expanded={tagFilterMenuOpen}
              aria-haspopup="true"
              className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border text-gray-200 transition-all duration-150 hover:-translate-y-px ${
                tagFilterMenuOpen || selectedTagFilters.length > 0
                  ? "border-indigo-400 bg-indigo-600/20 text-indigo-100 shadow-md shadow-indigo-900/30"
                  : "border-gray-600 bg-gray-900/75 hover:border-indigo-400 hover:text-white hover:bg-gray-800/90"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
              </svg>
              {selectedTagFilters.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-indigo-500 text-[10px] font-semibold text-white">
                  {selectedTagFilters.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setAddonFilterMenuOpen((v) => !v)}
              title={t("projectDetail.addonFilterLabel")}
              aria-label={t("projectDetail.addonFilterLabel")}
              aria-expanded={addonFilterMenuOpen}
              aria-haspopup="true"
              className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border text-gray-200 transition-all duration-150 hover:-translate-y-px ${
                addonFilterMenuOpen || selectedAddonFilters.length > 0
                  ? "border-fuchsia-400 bg-fuchsia-600/20 text-fuchsia-100 shadow-md shadow-fuchsia-900/30"
                  : "border-gray-600 bg-gray-900/75 hover:border-fuchsia-400 hover:text-white hover:bg-gray-800/90"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10l2 3-3 2v5l-4 2v-7l-3-2 2-3z" />
              </svg>
              {selectedAddonFilters.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-fuchsia-500 text-[10px] font-semibold text-white">
                  {selectedAddonFilters.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {tagFilterMenuOpen && (
          <div className="ui-menu-pop absolute z-30 right-0 mt-2 w-80 rounded-xl border border-gray-600/90 bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-black/35 p-3">
            <div className="flex items-center justify-between gap-2 px-1 pb-3 border-b border-gray-700/70 mb-3">
              <span className="text-xs font-medium text-gray-300">{t("projectDetail.tagFilterLabel")}</span>
              <button
                type="button"
                onClick={() => setSelectedTagFilters([])}
                disabled={selectedTagFilters.length === 0}
                className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("projectDetail.tagFilterClear")}
              </button>
            </div>
            {availableDomainTags.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 py-3">{t("projectDetail.tagFilterNoTags")}</p>
            ) : (
              <div className="max-h-56 overflow-y-auto scrollbar-premium pr-1 space-y-1.5">
                {availableDomainTags.map((tag) => {
                  const checked = selectedTagFilters.includes(tag);
                  return (
                    <label key={tag} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm cursor-pointer transition-all ${checked ? "border-indigo-400/60 bg-gradient-to-r from-indigo-600/25 to-fuchsia-600/20 text-indigo-100" : "border-gray-700/80 text-gray-200 hover:bg-gray-800/80 hover:border-gray-600"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleTagFilter(tag)} className="sr-only" />
                      <span aria-hidden="true" className={`inline-flex h-4 w-4 items-center justify-center rounded border transition-all duration-150 ${checked ? "border-indigo-300/80 bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-sm shadow-indigo-900/30" : "border-gray-500 bg-gray-900/70"}`}>
                        {checked && (
                          <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{t(`sectionDetail.domain.${tag}`, tag)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {addonFilterMenuOpen && (
          <div ref={addonFilterMenuRef} className="ui-menu-pop absolute z-30 right-0 mt-2 w-80 rounded-xl border border-gray-600/90 bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-black/35 p-3">
            <div className="flex items-center justify-between gap-2 px-1 pb-3 border-b border-gray-700/70 mb-3">
              <span className="text-xs font-medium text-gray-300">{t("projectDetail.addonFilterLabel")}</span>
              <button
                type="button"
                onClick={() => setSelectedAddonFilters([])}
                disabled={selectedAddonFilters.length === 0}
                className="text-xs text-fuchsia-300 hover:text-fuchsia-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("projectDetail.addonFilterClear")}
              </button>
            </div>
            {availableAddonTypes.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 py-3">{t("projectDetail.addonFilterNoAddons")}</p>
            ) : (
              <div className="max-h-56 overflow-y-auto scrollbar-premium pr-1 space-y-1.5">
                {availableAddonTypes.map((type) => {
                  const checked = selectedAddonFilters.includes(type);
                  return (
                    <label key={type} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm cursor-pointer transition-all ${checked ? "border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-600/25 to-indigo-600/20 text-fuchsia-100" : "border-gray-700/80 text-gray-200 hover:bg-gray-800/80 hover:border-gray-600"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleAddonFilter(type)} className="sr-only" />
                      <span aria-hidden="true" className={`inline-flex h-4 w-4 items-center justify-center rounded border transition-all duration-150 ${checked ? "border-fuchsia-300/80 bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow-sm shadow-fuchsia-900/30" : "border-gray-500 bg-gray-900/70"}`}>
                        {checked && (
                          <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{t(`sectionDetail.history.addonType.${type}`, type)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
        </svg>
        <input
          type="text"
          placeholder={t("projectDetail.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => {
            const term = e.target.value;
            setSearchTerm(term);
            if (term.trim()) {
              const allIds = new Set<string>((project.sections || []).map((s: any) => s.id));
              setExpandedSections(allIds);
            }
          }}
          className="ui-input-dark ui-focus-ring-indigo w-full pl-9 pr-3 py-2.5 text-sm"
        />
      </div>

      <div className="relative flex-1 min-h-0">
        <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-gray-800/90 to-transparent transition-opacity duration-300 ease-out ${showSectionTopFade ? "opacity-90" : "opacity-0"}`} aria-hidden />
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-gray-800/90 to-transparent transition-opacity duration-300 ease-out ${showSectionBottomFade ? "opacity-90" : "opacity-0"}`} aria-hidden />
        <div ref={sectionListRef} onScroll={updateSectionFades} className="scrollbar-premium h-full max-h-[45vh] lg:max-h-none overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1">
          <SectionTree
            sections={project.sections || []}
            projectId={projectId}
            reorderSections={reorderSections}
            sensors={sensors}
            searchTerm={searchTerm}
            selectedTagFilters={selectedTagFilters}
            selectedAddonFilters={selectedAddonFilters}
            activeSectionId={currentSectionId}
            expandedSections={expandedSections}
            setExpandedSections={setExpandedSections}
            labels={{
              resultsFoundOne: t("projectDetail.resultsFoundOne"),
              resultsFoundMany: t("projectDetail.resultsFoundMany"),
              match: t("projectDetail.match"),
              reorder: t("projectDetail.reorder"),
              flowchart: t("sectionDetail.flowchart.breadcrumb"),
            }}
          />
        </div>
      </div>

      <div className="relative z-20 mt-4 pt-4 border-t border-gray-700/80">
        <div className="relative flex gap-2 flex-wrap items-center" ref={pageTypePickerRef}>
          <button
            type="button"
            onClick={() => setPageTypePickerOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={pageTypePickerOpen}
            title={`${t("pageTypes.sidebar.pickerButtonTitlePrefix", "Tipo de página:")} ${
              getPageType(selectedPageTypeId)
                ? getPageTypeLabel(getPageType(selectedPageTypeId)!, t)
                : t("pageTypes.ids.blank.label", "Em branco")
            }`}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-2.5 text-sm transition-all duration-150 ${
              pageTypePickerOpen || selectedPageTypeId !== "blank"
                ? "border-indigo-400 bg-indigo-600/20 text-indigo-100 shadow-sm shadow-indigo-900/30"
                : "border-gray-600 bg-gray-900/75 text-gray-200 hover:border-indigo-400 hover:text-white hover:bg-gray-800/90"
            }`}
          >
            <span className="text-base leading-none">{getPageType(selectedPageTypeId)?.emoji ?? "📄"}</span>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <input
            value={newSectionTitle}
            onChange={(e) => {
              const val = e.target.value;
              setNewSectionTitle(val);
              const parentId = currentSectionId ?? undefined;
              if (val.trim() && hasDuplicateName(projectId, val.trim(), parentId)) {
                setNameError(parentId ? t("sectionDetail.subsections.duplicate") : t("projectDetail.rootSectionDuplicate"));
              } else {
                setNameError("");
              }
            }}
            placeholder={(() => {
              const fallback = currentSectionId
                ? t("sectionDetail.subsections.addPlaceholder")
                : t("projectDetail.newSectionPlaceholder");
              if (selectedPageTypeId === "blank") return fallback;
              const custom = t(
                `pageTypes.ids.${selectedPageTypeId}.sidebarInputPlaceholder`,
                ""
              );
              return custom && custom.trim() ? custom : fallback;
            })()}
            className={`ui-input-dark ui-focus-ring-indigo flex-1 min-w-[160px] px-3 py-2 text-sm ${nameError ? "border-red-500" : "border-gray-600"}`}
          />
          <button
            onClick={handleAddByContext}
            className="ui-btn-primary-gradient relative z-20 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-900/30 disabled:opacity-100 disabled:brightness-75 disabled:saturate-50 disabled:cursor-not-allowed"
            disabled={!newSectionTitle.trim() || !!nameError}
          >
            <span className="text-base leading-none">+</span>
            {t("projectDetail.add")}
          </button>

          {pageTypePickerOpen && (
            <div className="ui-menu-pop absolute z-40 left-0 bottom-full mb-2 w-80 rounded-xl border border-gray-600/90 bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-black/35 p-2">
              <div className="px-2 py-1.5 text-xs font-medium text-gray-300 border-b border-gray-700/70 mb-1">
                {t("pageTypes.sidebar.pickerHeader", "Tipo de página")}
              </div>
              <div className="max-h-72 overflow-y-auto scrollbar-premium pr-1 space-y-0.5">
                {PAGE_TYPES.map((pt) => {
                  const active = pt.id === selectedPageTypeId;
                  const addonsCount = pt.addons.length;
                  const badgeKey = addonsCount === 1
                    ? "pageTypes.sidebar.addonsBadgeOne"
                    : "pageTypes.sidebar.addonsBadgeMany";
                  const badgeFallback = addonsCount === 1 ? "{n} addon" : "{n} addons";
                  const badgeText = t(badgeKey, badgeFallback).replace("{n}", String(addonsCount));
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => {
                        setSelectedPageTypeId(pt.id);
                        setPageTypePickerOpen(false);
                      }}
                      className={`w-full text-left flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition-all ${
                        active
                          ? "border-indigo-400/60 bg-gradient-to-r from-indigo-600/25 to-fuchsia-600/20 text-indigo-100"
                          : "border-transparent text-gray-200 hover:bg-gray-800/80 hover:border-gray-700/80"
                      }`}
                    >
                      <span className="text-lg leading-none mt-0.5" aria-hidden="true">{pt.emoji}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{getPageTypeLabel(pt, t)}</span>
                          {addonsCount > 0 && (
                            <span className="inline-flex items-center h-4 px-1.5 rounded-md bg-gray-800/80 border border-gray-700/70 text-[10px] font-semibold text-gray-300 tabular-nums">
                              {badgeText}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-gray-400 mt-0.5 leading-snug">
                          {getPageTypeDescription(pt, t)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {nameError && <span className="text-red-400 text-sm mt-1 block">{nameError}</span>}
      </div>
      <PageTypeRequiresDialog
        // Force a full remount on step change so state (selection, name field,
        // checkboxes, pcts) cannot leak between sequential steps of a multi-
        // requires wizard. Without this, React batches the close/open into
        // props-only updates and the "reset on open" effect never fires.
        key={requiresDialog.requirementKind ?? "closed"}
        open={requiresDialog.open}
        pageType={requiresDialog.pageType}
        requiredPageType={requiresDialog.requiredPageType}
        candidates={requiresDialog.candidates}
        introCopy={requiresDialog.introCopy}
        askNameOnCreateNew={requiresDialog.askNameOnCreateNew}
        createNewNameLabel={requiresDialog.createNewNameLabel}
        createNewNamePlaceholder={requiresDialog.createNewNamePlaceholder}
        defaultCreateNewName={requiresDialog.defaultCreateNewName}
        allowEmptyCreateNewName={requiresDialog.allowEmptyCreateNewName}
        title={requiresDialog.dialogTitle}
        linkExistingHeader={requiresDialog.linkExistingHeader}
        createNewLabel={requiresDialog.createNewLabel}
        createNewDescription={requiresDialog.createNewDescription}
        skipLabel={requiresDialog.skipLabel}
        skipDescription={requiresDialog.skipDescription}
        showRecipeSettings={requiresDialog.showRecipeSettings}
        defaultRecipeSettings={requiresDialog.defaultRecipeSettings}
        showAttributeSlotsPicker={requiresDialog.showAttributeSlotsPicker}
        showAttributeModifiersPicker={requiresDialog.showAttributeModifiersPicker}
        showCharacterSettings={requiresDialog.showCharacterSettings}
        defaultCharacterSettings={requiresDialog.defaultCharacterSettings}
        characterAttributePresets={requiresDialog.characterAttributePresets}
        showEconomySettings={requiresDialog.showEconomySettings}
        defaultEconomySettings={requiresDialog.defaultEconomySettings}
        existingBuyDiscountCandidates={requiresDialog.existingBuyDiscountCandidates}
        existingSellMarkupCandidates={requiresDialog.existingSellMarkupCandidates}
        stepIndex={requiresDialog.stepIndex}
        stepCount={requiresDialog.stepCount}
        onCancel={handleRequiresCancel}
        onConfirm={handleRequiresChoice}
      />
      <CraftTableRecipePickerDialog
        open={craftTablePending !== null}
        candidates={craftTablePending?.candidates || []}
        onCancel={() => setCraftTablePending(null)}
        onConfirm={handleCraftTableConfirm}
      />
      <AttributeDefinitionsSetupDialog
        open={attrSetupPending !== null}
        defaultName={attrSetupPending?.title || ""}
        presets={PRESET_ATTRIBUTES_DISPLAY}
        onCancel={() => setAttrSetupPending(null)}
        onConfirm={handleAttrSetupConfirm}
      />
      <PageCreationReviewDialog
        open={reviewPending !== null}
        pending={reviewPending}
        onCancel={handleReviewCancel}
        onBack={handleReviewBack}
        onConfirm={handleReviewConfirm}
      />
    </aside>
  );
}

function SectionTree({
  sections,
  projectId,
  reorderSections,
  sensors,
  searchTerm,
  selectedTagFilters,
  selectedAddonFilters,
  activeSectionId,
  expandedSections,
  setExpandedSections,
  labels,
}: {
  sections: any[];
  projectId: string;
  reorderSections: any;
  sensors: any;
  searchTerm: string;
  selectedTagFilters: string[];
  selectedAddonFilters: string[];
  activeSectionId: string | null;
  expandedSections: Set<string>;
  setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  labels: {
    resultsFoundOne: string;
    resultsFoundMany: string;
    match: string;
    reorder: string;
    flowchart: string;
  };
}) {
  const matchesSearch = (section: any): boolean => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return getSectionSearchText(section).toLowerCase().includes(term);
  };

  const matchesTags = (section: any): boolean => {
    if (selectedTagFilters.length === 0) return true;
    const sectionTags = Array.isArray(section?.domainTags) ? section.domainTags : [];
    return sectionTags.some((tag: string) => selectedTagFilters.includes(tag));
  };

  const matchesAddons = (section: any): boolean => {
    if (selectedAddonFilters.length === 0) return true;
    const sectionAddons = Array.isArray(section?.addons)
      ? section.addons
      : Array.isArray(section?.balanceAddons)
        ? section.balanceAddons
        : [];
    const addonTypes = sectionAddons
      .map((addon: any) => (typeof addon?.type === "string" ? addon.type : ""))
      .filter(Boolean);
    return addonTypes.some((type: string) => selectedAddonFilters.includes(type));
  };

  const matchesFilters = (section: any): boolean =>
    matchesSearch(section) && matchesTags(section) && matchesAddons(section);

  const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
    const section = allSections.find((s) => s.id === sectionId);
    if (!section) return false;
    if (matchesFilters(section)) return true;
    const children = allSections.filter((s) => s.parentId === sectionId);
    return children.some((child) => sectionMatchesOrHasMatchingChildren(child.id, allSections));
  };

  const roots = sections
    .filter((s) => !s.parentId)
    .filter((s) => sectionMatchesOrHasMatchingChildren(s.id, sections))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const parentById = useMemo(() => {
    const map = new Map<string, string | null>();
    sections.forEach((section: any) => {
      map.set(section.id, section.parentId ?? null);
    });
    return map;
  }, [sections]);
  const siblingsByParent = useMemo(() => {
    const map = new Map<string, any[]>();
    sections.forEach((section: any) => {
      const key = section.parentId ?? "__root__";
      const current = map.get(key) ?? [];
      current.push(section);
      map.set(key, current);
    });
    map.forEach((items, key) => {
      map.set(
        key,
        [...items].sort((a, b) => (a.order || 0) - (b.order || 0))
      );
    });
    return map;
  }, [sections]);
  const sectionById = useMemo(
    () => new Map<string, any>(sections.map((section: any) => [section.id, section])),
    [sections]
  );
  const expandedBeforeDragRef = useRef<Set<string> | null>(null);
  const lastValidOverIdRef = useRef<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragWidth, setActiveDragWidth] = useState<number | null>(null);

  const totalMatches =
    searchTerm.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0
      ? sections.filter(matchesFilters).length
      : 0;
  const dragContextKey = useMemo(
    () => `${activeSectionId ?? "home"}::${roots.map((r) => r.id).join("|")}`,
    [activeSectionId, roots]
  );
  const isTreeDragging = activeDragId !== null;
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeId = String(args.active.id);
    const activeParent = parentById.get(activeId) ?? null;
    const siblingContainers = args.droppableContainers.filter((container) => {
      const containerId = String(container.id);
      if (containerId === activeId) return false;
      return (parentById.get(containerId) ?? null) === activeParent;
    });

    if (siblingContainers.length === 0) return [];

    // Use dragged element geometry instead of pointer coordinates to avoid
    // horizontal-position side effects when sidebar/content have different hit areas.
    const collisionCenterY = args.collisionRect.top + args.collisionRect.height / 2;
    const collisions: Collision[] = siblingContainers
      .map((container) => {
        const rect = args.droppableRects.get(container.id);
        if (!rect) return null;
        const centerY = rect.top + rect.height / 2;
        const yDistance = Math.abs(collisionCenterY - centerY);
        return {
          id: container.id,
          data: { droppableContainer: container, value: yDistance },
        } as Collision;
      })
      .filter((collision): collision is Collision => collision !== null)
      .sort((a, b) => {
        const av = Number(a.data?.value ?? Number.MAX_SAFE_INTEGER);
        const bv = Number(b.data?.value ?? Number.MAX_SAFE_INTEGER);
        return av - bv;
      });

    return collisions;
  }, [parentById]);

  function restoreExpandedSections() {
    if (!expandedBeforeDragRef.current) return;
    setExpandedSections(new Set(expandedBeforeDragRef.current));
    expandedBeforeDragRef.current = null;
  }

  function handleDragStart(_event: DragStartEvent) {
    const activeId = String(_event.active.id);
    setActiveDragId(activeId);
    lastValidOverIdRef.current = null;
    const measuredWidth =
      _event.active.rect.current?.initial?.width ?? _event.active.rect.current?.translated?.width ?? null;
    setActiveDragWidth(
      typeof measuredWidth === "number" && Number.isFinite(measuredWidth) && measuredWidth > 0
        ? measuredWidth
        : null
    );
    if (!expandedBeforeDragRef.current) {
      expandedBeforeDragRef.current = new Set(expandedSections);
    }
    const contextualExpanded = new Set<string>();
    let cursor = parentById.get(activeId) ?? null;
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor)) {
      contextualExpanded.add(cursor);
      visited.add(cursor);
      cursor = parentById.get(cursor) ?? null;
    }
    // For nested drags, collapse must be immediate; delaying by frame causes
    // stale Y geometry and noticeable offset on child items.
    flushSync(() => {
      setExpandedSections(contextualExpanded);
    });
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDragId(null);
    setActiveDragWidth(null);
    lastValidOverIdRef.current = null;
    restoreExpandedSections();
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const activeParent = parentById.get(activeId) ?? null;
    const overParent = parentById.get(overId) ?? null;
    if (activeParent !== overParent) return;
    lastValidOverIdRef.current = overId;
  }

  useEffect(() => {
    // Navegacao sem refresh: limpa estado transitório de drag.
    expandedBeforeDragRef.current = null;
    lastValidOverIdRef.current = null;
    setActiveDragWidth(null);
  }, [activeSectionId]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = String(active.id);
    const fallbackOverId = lastValidOverIdRef.current;
    const overId = over ? String(over.id) : fallbackOverId;
    setActiveDragId(null);
    setActiveDragWidth(null);
    lastValidOverIdRef.current = null;
    if (!overId || activeId === overId) {
      restoreExpandedSections();
      return;
    }
    const activeParent = parentById.get(activeId) ?? null;
    const overParent = parentById.get(overId) ?? null;
    if (activeParent !== overParent) {
      restoreExpandedSections();
      return;
    }

    const parentKey = activeParent ?? "__root__";
    const siblings = siblingsByParent.get(parentKey) ?? [];
    const oldIndex = siblings.findIndex((s) => s.id === activeId);
    const newIndex = siblings.findIndex((s) => s.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      restoreExpandedSections();
      return;
    }

    const reordered = arrayMove(siblings, oldIndex, newIndex);
    reorderSections(projectId, reordered.map((s) => s.id));
    restoreExpandedSections();
  }

  return (
    <>
      {(searchTerm.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0) &&
        totalMatches > 0 && (
          <p className="text-sm text-gray-400 mb-2 ml-1">
            {totalMatches} {totalMatches === 1 ? labels.resultsFoundOne : labels.resultsFoundMany}
          </p>
        )}
      <DndContext
        key={dragContextKey}
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
        autoScroll={false}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={roots.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {roots.map((sec) => (
              <SortableRootItem
                key={sec.id}
                section={sec}
                sections={sections}
                projectId={projectId}
                searchTerm={searchTerm}
                selectedTagFilters={selectedTagFilters}
                selectedAddonFilters={selectedAddonFilters}
                activeSectionId={activeSectionId}
                expandedSections={expandedSections}
                setExpandedSections={setExpandedSections}
                isTreeDragging={isTreeDragging}
                isRootLevel={true}
                labels={labels}
              />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay dropAnimation={null} adjustScale={false}>
          {activeDragId ? (
            <DragPreviewCard
              section={sectionById.get(activeDragId) ?? null}
              labels={labels}
              width={activeDragWidth}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function SortableRootItem({
  section,
  sections,
  projectId,
  searchTerm,
  selectedTagFilters,
  selectedAddonFilters,
  activeSectionId,
  expandedSections,
  setExpandedSections,
  isTreeDragging,
  isRootLevel,
  labels,
}: {
  section: any;
  sections: any[];
  projectId: string;
  searchTerm: string;
  selectedTagFilters: string[];
  selectedAddonFilters: string[];
  activeSectionId: string | null;
  expandedSections: Set<string>;
  setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  isTreeDragging: boolean;
  isRootLevel?: boolean;
  labels: {
    match: string;
    reorder: string;
    flowchart: string;
  };
}) {
  const router = useRouter();
  const highlightText = (text: string, term?: string) => {
    if (!term || !term.trim()) return text;
    const regex = new RegExp(`(${term})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
    );
  };

  const matchesDirectly = (sec: any): boolean => {
    if (!searchTerm || !searchTerm.trim()) return false;
    const term = searchTerm.toLowerCase();
    return sec.title.toLowerCase().includes(term) || sec.content?.toLowerCase().includes(term);
  };

  const getContentSnippet = (content: string, term: string): string => {
    if (!content || !term) return "";
    const lowerContent = content.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const index = lowerContent.indexOf(lowerTerm);
    if (index === -1) return "";
    const start = Math.max(0, index - 40);
    const end = Math.min(content.length, index + term.length + 40);
    let snippet = content.substring(start, end);
    if (start > 0) snippet = "..." + snippet;
    if (end < content.length) snippet = snippet + "...";
    return snippet;
  };

  const directMatch = matchesDirectly(section);
  const contentSnippet = directMatch && section.content ? getContentSnippet(section.content, searchTerm) : "";
  const isActiveSection = activeSectionId === section.id;
  const hasFlowchart = Boolean(section?.flowchartEnabled);
  const hasChildren = sections.some((s: any) => s.parentId === section.id);
  const isExpanded =
    expandedSections.has(section.id) ||
    searchTerm.trim() ||
    selectedTagFilters.length > 0 ||
    selectedAddonFilters.length > 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const clickGuardStartRef = useRef<{ x: number; y: number } | null>(null);
  const shouldBlockClickRef = useRef(false);
  const CLICK_GUARD_THRESHOLD_PX = 6;
  const stableTransform = transform
    ? {
        ...transform,
        scaleX: 1,
        scaleY: 1,
      }
    : null;

  const style = {
    transform: CSS.Transform.toString(stableTransform),
    transition: isTreeDragging ? undefined : transition,
    opacity: isDragging ? 0.35 : 1,
    transformOrigin: "top left" as const,
  };
  const dragVisualClass = isTreeDragging
    ? isDragging
      ? "ring-2 ring-indigo-300/70 shadow-lg shadow-indigo-900/30"
      : "opacity-85"
    : "";
  const handlePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    clickGuardStartRef.current = { x: event.clientX, y: event.clientY };
    shouldBlockClickRef.current = false;
  };
  const handlePointerMoveCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = clickGuardStartRef.current;
    if (!start || shouldBlockClickRef.current) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= CLICK_GUARD_THRESHOLD_PX || Math.abs(dy) >= CLICK_GUARD_THRESHOLD_PX) {
      shouldBlockClickRef.current = true;
    }
  };
  const handlePointerUpCapture = () => {
    clickGuardStartRef.current = null;
  };
  const handlePointerCancelCapture = () => {
    clickGuardStartRef.current = null;
    shouldBlockClickRef.current = false;
  };
  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!shouldBlockClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    shouldBlockClickRef.current = false;
  };
  const handleCardClick = () => {
    if (shouldBlockClickRef.current) return;
    router.push(`/projects/${projectId}/sections/${section.id}`);
  };

  return (
    <li ref={setNodeRef} style={style} className="mb-2">
      <div
        className={`group relative overflow-hidden flex items-center gap-2 border transition-all duration-150 cursor-grab active:cursor-grabbing ${
          isRootLevel
            ? "p-2.5 rounded-xl"
            : "px-2.5 py-2 rounded-lg"
        } ${isActiveSection ? "border-indigo-300/70 bg-indigo-600/20 shadow-md shadow-indigo-900/25" : hasFlowchart ? `border-emerald-500/45 bg-emerald-900/15 hover:border-emerald-400/70 ${isTreeDragging ? "" : "hover:-translate-y-px"}` : `border-gray-700 bg-gray-900/70 hover:border-indigo-500/60 ${isTreeDragging ? "" : "hover:-translate-y-px"}`} ${dragVisualClass}`}
        {...attributes}
        {...listeners}
        aria-label={labels.reorder}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerMoveCapture={handlePointerMoveCapture}
        onPointerUpCapture={handlePointerUpCapture}
        onPointerCancelCapture={handlePointerCancelCapture}
        onClickCapture={handleClickCapture}
        onClick={handleCardClick}
      >
        <span className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none" aria-hidden />
        {hasFlowchart && (
          <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-emerald-400/90 pointer-events-none" aria-hidden />
        )}
        <span className="relative text-gray-400 pointer-events-none select-none" aria-hidden>
          ⋮⋮
        </span>
        {hasChildren ? (
          <button
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              const next = new Set(expandedSections);
              if (next.has(section.id)) next.delete(section.id);
              else next.add(section.id);
              setExpandedSections(next);
            }}
            className={`relative inline-flex items-center justify-center h-5 w-5 rounded-md border text-sm transition-colors ${isActiveSection ? "border-indigo-300/60 text-indigo-100 bg-indigo-500/20" : "border-gray-600 text-gray-300 hover:text-white hover:border-indigo-400"}`}
          >
            {isExpanded ? "−" : "+"}
          </button>
        ) : null}
        {section?.thumbImageUrl && (
          <img
            src={section.thumbImageUrl}
            alt=""
            loading="lazy"
            className={`${isRootLevel ? "h-7 w-7" : "h-6 w-6"} shrink-0 overflow-hidden rounded-md border border-gray-600/80 object-cover`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
        <span
          className={`relative flex-1 min-w-0 truncate text-sm transition-colors rounded px-0.5 pointer-events-none ${isActiveSection ? "text-indigo-100 font-semibold" : "text-blue-300 group-hover:text-blue-200"}`}
        >
          {highlightText(section.title, searchTerm)}
        </span>
        {hasFlowchart && (
          <span
            className="relative inline-flex items-center gap-1 rounded-full border border-emerald-400/55 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 pointer-events-none"
            title={labels.flowchart}
            aria-label={labels.flowchart}
          >
            <svg className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="7" height="5" rx="1.2" strokeWidth={2} />
              <rect x="14" y="3" width="7" height="6" rx="1.2" strokeWidth={2} />
              <rect x="8" y="15" width="8" height="6" rx="1.2" strokeWidth={2} />
            </svg>
            {isRootLevel ? labels.flowchart : ""}
          </span>
        )}
        {directMatch && searchTerm.trim() && (
          <span className="relative text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">
            ✓ {labels.match}
          </span>
        )}
      </div>
      {contentSnippet && isRootLevel && (
        <div className="ml-8 text-xs text-gray-300 italic mt-1 bg-yellow-950/30 border border-yellow-700/60 p-2 rounded-lg">
          {highlightText(contentSnippet, searchTerm)}
        </div>
      )}
      {hasChildren && (
        <div
          className={`grid ${
            isTreeDragging ? "transition-none duration-0" : "transition-all duration-200 ease-out"
          } ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            <SectionChildren
              parentId={section.id}
              sections={sections}
              projectId={projectId}
              searchTerm={searchTerm}
              selectedTagFilters={selectedTagFilters}
              selectedAddonFilters={selectedAddonFilters}
              activeSectionId={activeSectionId}
              expandedSections={expandedSections}
              setExpandedSections={setExpandedSections}
              isTreeDragging={isTreeDragging}
              labels={labels}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function DragPreviewCard({
  section,
  labels,
  width,
}: {
  section: any | null;
  labels: {
    reorder: string;
  };
  width: number | null;
}) {
  if (!section) return null;
  return (
    <div
      className="group relative overflow-hidden flex items-center gap-2 border p-2.5 rounded-xl transition-all duration-150 border-indigo-300/70 bg-indigo-600/20 shadow-md shadow-indigo-900/25 pointer-events-none"
      style={width ? { width: `${width}px`, maxWidth: "min(420px, 80vw)" } : { width: "min(420px, 80vw)" }}
    >
      <span className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none" aria-hidden />
      <span className="relative text-gray-300 pointer-events-none select-none" aria-hidden>
        ⋮⋮
      </span>
      {section?.thumbImageUrl && (
        <img
          src={section.thumbImageUrl}
          alt=""
          loading="lazy"
          className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-gray-600/80 object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
      <span className="relative flex-1 min-w-0 truncate text-sm text-indigo-100 font-semibold">
        {section.title}
      </span>
    </div>
  );
}

function SectionChildren({
  parentId,
  sections,
  projectId,
  searchTerm,
  selectedTagFilters,
  selectedAddonFilters,
  activeSectionId,
  expandedSections,
  setExpandedSections,
  isTreeDragging,
  labels,
}: {
  parentId: string;
  sections: any[];
  projectId: string;
  searchTerm?: string;
  selectedTagFilters: string[];
  selectedAddonFilters: string[];
  activeSectionId: string | null;
  expandedSections: Set<string>;
  setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  isTreeDragging: boolean;
  labels: {
    match: string;
    reorder: string;
    flowchart: string;
  };
}) {
  const matchesSearch = (section: any): boolean => {
    if (!searchTerm || !searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return getSectionSearchText(section).toLowerCase().includes(term);
  };

  const matchesTags = (section: any): boolean => {
    if (selectedTagFilters.length === 0) return true;
    const sectionTags = Array.isArray(section?.domainTags) ? section.domainTags : [];
    return sectionTags.some((tag: string) => selectedTagFilters.includes(tag));
  };

  const matchesAddons = (section: any): boolean => {
    if (selectedAddonFilters.length === 0) return true;
    const sectionAddons = Array.isArray(section?.addons)
      ? section.addons
      : Array.isArray(section?.balanceAddons)
        ? section.balanceAddons
        : [];
    const addonTypes = sectionAddons
      .map((addon: any) => (typeof addon?.type === "string" ? addon.type : ""))
      .filter(Boolean);
    return addonTypes.some((type: string) => selectedAddonFilters.includes(type));
  };

  const matchesFilters = (section: any): boolean =>
    matchesSearch(section) && matchesTags(section) && matchesAddons(section);

  const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
    const section = allSections.find((s) => s.id === sectionId);
    if (!section) return false;
    if (matchesFilters(section)) return true;
    const children = allSections.filter((s) => s.parentId === sectionId);
    return children.some((child) => sectionMatchesOrHasMatchingChildren(child.id, allSections));
  };

  const kids = sections
    .filter((s) => s.parentId === parentId)
    .filter((s) => sectionMatchesOrHasMatchingChildren(s.id, sections))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (kids.length === 0) return null;

  return (
    <SortableContext items={kids.map((k) => k.id)} strategy={verticalListSortingStrategy}>
      <ul className="ml-4 mt-2 pl-3 border-l border-gray-700/70 space-y-2">
        {kids.map((sec) => (
          <SortableRootItem
            key={sec.id}
            section={sec}
            sections={sections}
            projectId={projectId}
            searchTerm={searchTerm || ""}
            selectedTagFilters={selectedTagFilters}
            selectedAddonFilters={selectedAddonFilters}
            activeSectionId={activeSectionId}
            expandedSections={expandedSections}
            setExpandedSections={setExpandedSections}
            isTreeDragging={isTreeDragging}
            isRootLevel={false}
            labels={labels}
          />
        ))}
      </ul>
    </SortableContext>
  );
}
