"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProjectStore, type Project } from "@/store/projectStore";
import { sectionPath, toSlug } from "@/lib/utils/slug";
import { getSectionAiContent } from "@/utils/sectionAiContent";
import { useAuthStore } from "@/store/authStore";
import { MarkdownWithReferences } from "@/components/MarkdownWithReferences";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useI18n } from "@/lib/i18n/provider";
import AIChat from "@/components/AIChat";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { GAME_DESIGN_DOMAIN_IDS } from "@/lib/gameDesignDomains";
import {
    normalizeProjectDocumentSpotlight,
    type ProjectStoreLink,
} from "@/lib/projectSpotlight";
import {
    driveFileIdToImageUrl,
    getDriveImageDisplayCandidates,
    getGoogleClientId,
    openGoogleDriveImagePicker,
} from "@/lib/googleDrivePicker";

interface Props {
    projectId: string;
}

type DetailPreset = {
    id: string;
    label: string;
    placeholder: string;
};

type DetailQuickPreset = {
    mode: "single" | "multi";
    hint: string;
    options: string[];
};

type LinkPreset = {
    id: string;
    label: string;
    category: "mobile" | "console" | "pc" | "social" | "site";
    placeholder: string;
};

const FEATURE_PRESETS: string[] = [
    "Salvamento Manual",
    "Salvamento Automático",
    "Salvamento na Nuvem",
    "Multiplayer Online",
    "Cooperativo (Co-op)",
    "PvP",
    "Crossplay",
    "Leaderboard Global",
    "Conquistas / Achievements",
    "Suporte a Controle",
    "Modo Offline",
    "Chat de Voz",
    "Chat de Texto",
    "Suporte a Mods",
    "Cross-save",
    "Acessibilidade (dublagem/legenda)",
];

const DETAIL_PRESETS: DetailPreset[] = [
    { id: "tags", label: "Tags", placeholder: "Escape Room, Aventura, Mistérios" },
    { id: "style", label: "Estilo", placeholder: "3D Primeira Pessoa" },
    { id: "platforms", label: "Plataformas", placeholder: "Android, iOS, PC" },
    { id: "release", label: "Lançamento Oficial", placeholder: "Q4 2026" },
    { id: "disk", label: "Espaço em Disco", placeholder: "500 MB" },
    { id: "business", label: "Modelo de Negócio", placeholder: "Free to Play com Ads" },
    { id: "producedBy", label: "Produzido por", placeholder: "Estúdio Exemplo" },
    { id: "publishedBy", label: "Publicado por", placeholder: "Publisher Exemplo" },
    { id: "expansions", label: "Conteúdos de Expansão", placeholder: "DLC pago" },
    { id: "minimumAge", label: "Idade Mínima", placeholder: "10 anos" },
    { id: "languages", label: "Idiomas", placeholder: "PT-BR, EN, ES" },
    { id: "internet", label: "Internet Obrigatória", placeholder: "Não" },
    { id: "engine", label: "Engine", placeholder: "Unity / Unreal" },
    { id: "version", label: "Versão Atual", placeholder: "1.0.0" },
];

const STORE_TAG_PRESETS: string[] = [
    "Action",
    "Adventure",
    "RPG",
    "Strategy",
    "Simulation",
    "Puzzle",
    "Casual",
    "Arcade",
    "Racing",
    "Sports",
    "Fighting",
    "Shooter",
    "Platformer",
    "Survival",
    "Horror",
    "Sandbox",
    "Open World",
    "Story Rich",
    "Indie",
    "Single Player",
    "Multiplayer",
    "Online PvP",
    "Co-op",
    "Cross-Platform",
    "Controller Support",
    "Achievements",
    "Leaderboards",
    "Cloud Save",
    "Offline",
    "Family Friendly",
    "Educational",
    "Card",
    "Board",
    "Roguelike",
    "Turn-Based",
    "Real-Time Strategy",
    "Tactical",
    "MMO",
    "Battle Royale",
    "2D",
    "3D",
];

const DETAIL_VALUE_PRESETS: Record<string, DetailQuickPreset> = {
    tags: {
        mode: "multi",
        hint: "Tags populares de lojas (Google Play, App Store, Steam, Xbox): clique para selecionar.",
        options: STORE_TAG_PRESETS,
    },
    platforms: {
        mode: "multi",
        hint: "Plataformas mais comuns de publicação.",
        options: [
            "Android",
            "iOS",
            "PC (Windows)",
            "macOS",
            "Linux",
            "Steam Deck",
            "Xbox Series X|S",
            "Xbox One",
            "PlayStation 5",
            "PlayStation 4",
            "Nintendo Switch",
            "Web",
        ],
    },
    business: {
        mode: "single",
        hint: "Modelos de negócio comuns em lojas digitais.",
        options: [
            "Free to Play",
            "Free to Play com Ads",
            "Free to Play com IAP",
            "Premium (Pago)",
            "Premium + DLC",
            "Assinatura",
            "Demo + Upgrade",
            "Episódico",
        ],
    },
    minimumAge: {
        mode: "single",
        hint: "Classificação etária padrão por faixa.",
        options: ["Livre", "7+", "10+", "12+", "14+", "16+", "18+"],
    },
    languages: {
        mode: "multi",
        hint: "Idiomas mais frequentes em lançamento global.",
        options: ["PT-BR", "EN", "ES", "FR", "DE", "IT", "JA", "ZH", "KO", "RU"],
    },
    internet: {
        mode: "single",
        hint: "Defina rapidamente o requisito de conexão.",
        options: ["Não", "Sim (apenas recursos online)", "Sim (obrigatória)"],
    },
};

const LINK_PRESETS: LinkPreset[] = [
    { id: "googlePlay", label: "Google Play", category: "mobile", placeholder: "https://play.google.com/..." },
    { id: "appStore", label: "Apple App Store", category: "mobile", placeholder: "https://apps.apple.com/..." },
    { id: "appleGameCenter", label: "Apple Game Center", category: "mobile", placeholder: "https://apps.apple.com/..." },
    { id: "galaxyStore", label: "Samsung Galaxy Store", category: "mobile", placeholder: "https://galaxystore.samsung.com/..." },

    { id: "playstationStore", label: "PlayStation Store", category: "console", placeholder: "https://store.playstation.com/..." },
    { id: "xboxStore", label: "Xbox Store", category: "console", placeholder: "https://www.xbox.com/games/store/..." },
    { id: "nintendoEshop", label: "Nintendo eShop", category: "console", placeholder: "https://www.nintendo.com/store/products/..." },

    { id: "steam", label: "Steam", category: "pc", placeholder: "https://store.steampowered.com/app/..." },
    { id: "epic", label: "Epic Games Store", category: "pc", placeholder: "https://store.epicgames.com/..." },
    { id: "gog", label: "GOG", category: "pc", placeholder: "https://www.gog.com/..." },
    { id: "microsoftStore", label: "Microsoft Store", category: "pc", placeholder: "https://www.microsoft.com/store/..." },
    { id: "itchio", label: "itch.io", category: "pc", placeholder: "https://seu-jogo.itch.io/..." },

    { id: "website", label: "Site Oficial", category: "site", placeholder: "https://seu-jogo.com" },
    { id: "pressKit", label: "Press Kit", category: "site", placeholder: "https://seu-jogo.com/presskit" },

    { id: "discord", label: "Discord", category: "social", placeholder: "https://discord.gg/..." },
    { id: "x", label: "X / Twitter", category: "social", placeholder: "https://x.com/..." },
    { id: "youtube", label: "YouTube", category: "social", placeholder: "https://youtube.com/..." },
    { id: "instagram", label: "Instagram", category: "social", placeholder: "https://instagram.com/..." },
    { id: "tiktok", label: "TikTok", category: "social", placeholder: "https://tiktok.com/@..." },
    { id: "facebook", label: "Facebook", category: "social", placeholder: "https://facebook.com/..." },
    { id: "reddit", label: "Reddit", category: "social", placeholder: "https://reddit.com/r/..." },
    { id: "twitch", label: "Twitch", category: "social", placeholder: "https://twitch.tv/..." },
];

const LINK_CATEGORY_LABEL: Record<LinkPreset["category"], string> = {
    mobile: "Lojas Mobile",
    console: "Lojas Console",
    pc: "Lojas PC",
    site: "Site & Press",
    social: "Redes Sociais",
};

function readDetailValue(details: string[], label: string): string | null {
    const lowerLabel = label.toLowerCase();
    for (const line of details) {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();
        if (lower === lowerLabel) return "";
        const prefix = `${lowerLabel}:`;
        if (lower.startsWith(prefix)) {
            return trimmed.slice(trimmed.indexOf(":") + 1).trim();
        }
    }
    return null;
}

function readLinkUrl(links: ProjectStoreLink[], label: string): string | null {
    const lowerLabel = label.toLowerCase();
    const found = links.find((item) => item.label.trim().toLowerCase() === lowerLabel);
    return found?.url || null;
}

function normalizeTagList(tags: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    tags.forEach((tag) => {
        const clean = tag.trim();
        if (!clean) return;
        const key = clean.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        normalized.push(clean);
    });
    return normalized;
}

function parseTagValue(value: string): string[] {
    return normalizeTagList(value.split(","));
}

function formatTagValue(tags: string[]): string {
    return normalizeTagList(tags).join(", ");
}

function hasValue(values: string[], candidate: string): boolean {
    const key = candidate.trim().toLowerCase();
    return values.some((value) => value.trim().toLowerCase() === key);
}

function removeValue(values: string[], candidate: string): string[] {
    const key = candidate.trim().toLowerCase();
    return values.filter((value) => value.trim().toLowerCase() !== key);
}

export default function ProjectDetailClient({ projectId }: Props) {
    const { t } = useI18n();
    const { user, profile } = useAuthStore();
    const sectionAuditBy = user ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null } : undefined;

    const router = useRouter();
    const pathname = usePathname();
    const getProjectBySlug = useProjectStore((s) => s.getProjectBySlug);
    const addSection = useProjectStore((s) => s.addSection);
    const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
    const reorderSections = useProjectStore((s) => s.reorderSections);
    const setProjectCoverImage = useProjectStore((s) => s.setProjectCoverImage);
    const updateProjectSettings = useProjectStore((s) => s.updateProjectSettings);
    const projects = useProjectStore((s) => s.projects);

    const [mounted, setMounted] = useState(false);
    const [project, setProject] = useState<Project | null>(null);
    const realProjectId = project?.id ?? "";
    const [chatOpen, setChatOpen] = useState(false);
    const [sectionTitle, setSectionTitle] = useState("");
    const [nameError, setNameError] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [isPickingCoverImage, setIsPickingCoverImage] = useState(false);
    const [coverImageError, setCoverImageError] = useState("");
    const [coverImageCandidateIndex, setCoverImageCandidateIndex] = useState(0);
    const [showSectionTopFade, setShowSectionTopFade] = useState(false);
    const [showSectionBottomFade, setShowSectionBottomFade] = useState(false);
    const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
    const [selectedAddonFilters, setSelectedAddonFilters] = useState<string[]>([]);
    const [tagFilterMenuOpen, setTagFilterMenuOpen] = useState(false);
    const [addonFilterMenuOpen, setAddonFilterMenuOpen] = useState(false);
    const [showSpotlightEditor, setShowSpotlightEditor] = useState(false);
    const [featureEnabled, setFeatureEnabled] = useState<Record<string, boolean>>({});
    const [detailState, setDetailState] = useState<Record<string, { enabled: boolean; value: string }>>({});
    const [linkState, setLinkState] = useState<Record<string, { enabled: boolean; url: string }>>({});
    const [spotlightTitleIconUrl, setSpotlightTitleIconUrl] = useState("");
    const [isPickingSpotlightIcon, setIsPickingSpotlightIcon] = useState(false);
    const [spotlightIconError, setSpotlightIconError] = useState("");
    const [spotlightIconCandidateIndex, setSpotlightIconCandidateIndex] = useState(0);
    const [spotlightError, setSpotlightError] = useState("");
    const [spotlightSaved, setSpotlightSaved] = useState(false);
    const sectionListRef = useRef<HTMLDivElement | null>(null);
    const tagFilterMenuRef = useRef<HTMLDivElement | null>(null);
    const addonFilterMenuRef = useRef<HTMLDivElement | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Garantir que estamos no client antes de acessar o store
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (mounted) {
            const p = getProjectBySlug(projectId);
            setProject(p ?? null);
        }
    }, [mounted, projectId, projects]);

    const coverImageCandidates = useMemo(
        () => getDriveImageDisplayCandidates(project?.coverImageUrl || ""),
        [project?.coverImageUrl]
    );
    const spotlightTitleIconCandidates = useMemo(
        () => getDriveImageDisplayCandidates(spotlightTitleIconUrl),
        [spotlightTitleIconUrl]
    );

    useEffect(() => {
        setCoverImageCandidateIndex(0);
    }, [project?.coverImageUrl]);

    useEffect(() => {
        setSpotlightIconCandidateIndex(0);
    }, [spotlightTitleIconUrl]);

    useEffect(() => {
        if (!project) return;
        const spotlight = normalizeProjectDocumentSpotlight(project?.mindMapSettings?.documentView?.spotlight);

        const nextFeatureEnabled: Record<string, boolean> = {};
        const selectedFeatures = new Set(spotlight?.features || []);
        FEATURE_PRESETS.forEach((feature) => {
            nextFeatureEnabled[feature] = selectedFeatures.has(feature);
        });

        const nextDetailState: Record<string, { enabled: boolean; value: string }> = {};
        DETAIL_PRESETS.forEach((preset) => {
            const value = readDetailValue(spotlight?.technicalDetails || [], preset.label);
            nextDetailState[preset.id] = {
                enabled: value !== null,
                value: value ?? "",
            };
        });

        const nextLinkState: Record<string, { enabled: boolean; url: string }> = {};
        LINK_PRESETS.forEach((preset) => {
            const url = readLinkUrl(spotlight?.storeLinks || [], preset.label);
            nextLinkState[preset.id] = {
                enabled: Boolean(url),
                url: url ?? "",
            };
        });

        setFeatureEnabled(nextFeatureEnabled);
        setDetailState(nextDetailState);
        setLinkState(nextLinkState);
        setSpotlightTitleIconUrl(spotlight?.titleIconUrl || "");
        setSpotlightIconError("");
        setSpotlightError("");
        setSpotlightSaved(false);
    }, [project?.id, project?.mindMapSettings?.documentView?.spotlight]);

    useEffect(() => {
        setShowSpotlightEditor(false);
    }, [projectId]);

    function handleAddSection() {
        if (!sectionTitle.trim() || nameError) return;

        try {
            addSection(realProjectId, sectionTitle.trim(), undefined, sectionAuditBy);
            setSectionTitle("");
            setNameError("");
        } catch (e) {
            if (e instanceof Error && (e.message === "structural_limit_sections_per_project" || e.message === "structural_limit_sections_total")) {
                setNameError(e.message === "structural_limit_sections_total" ? t("limits.sectionsTotal") : t("limits.sectionsPerProject"));
            } else {
                throw e;
            }
        }
    }

    async function handlePickCoverImage() {
        if (isPickingCoverImage) return;
        setCoverImageError("");
        setIsPickingCoverImage(true);
        try {
            const googleClientId = await getGoogleClientId();
            if (!googleClientId) {
                setCoverImageError(t("projectDetail.cover.missingGoogleConfig"));
                return;
            }
            const picked = await openGoogleDriveImagePicker(googleClientId);
            if (!picked?.id) return;
            setProjectCoverImage(realProjectId, driveFileIdToImageUrl(picked.id));
            setCoverImageCandidateIndex(0);
        } catch {
            setCoverImageError(t("projectDetail.cover.pickFailed"));
        } finally {
            setIsPickingCoverImage(false);
        }
    }

    async function handlePickSpotlightIcon() {
        if (isPickingSpotlightIcon) return;
        setSpotlightIconError("");
        setIsPickingSpotlightIcon(true);
        try {
            const googleClientId = await getGoogleClientId();
            if (!googleClientId) {
                setSpotlightIconError(t("projectDetail.cover.missingGoogleConfig"));
                return;
            }
            const picked = await openGoogleDriveImagePicker(googleClientId);
            if (!picked?.id) return;
            setSpotlightTitleIconUrl(driveFileIdToImageUrl(picked.id));
            setSpotlightSaved(false);
            setSpotlightIconCandidateIndex(0);
        } catch {
            setSpotlightIconError(t("projectDetail.spotlight.iconPickFailed"));
        } finally {
            setIsPickingSpotlightIcon(false);
        }
    }

    const currentSpotlight = normalizeProjectDocumentSpotlight(project?.mindMapSettings?.documentView?.spotlight);
    const groupedLinkPresets = useMemo(() => {
        return {
            mobile: LINK_PRESETS.filter((preset) => preset.category === "mobile"),
            console: LINK_PRESETS.filter((preset) => preset.category === "console"),
            pc: LINK_PRESETS.filter((preset) => preset.category === "pc"),
            site: LINK_PRESETS.filter((preset) => preset.category === "site"),
            social: LINK_PRESETS.filter((preset) => preset.category === "social"),
        };
    }, []);

    function handleSaveSpotlight() {
        if (!project) return;

        const features = FEATURE_PRESETS.filter((feature) => Boolean(featureEnabled[feature]));
        const technicalDetails = DETAIL_PRESETS.flatMap((preset) => {
            const state = detailState[preset.id];
            if (!state?.enabled) return [];
            const value = state.value.trim();
            if (!value) return [];
            return [`${preset.label}: ${value}`];
        });

        const links: ProjectStoreLink[] = [];
        const invalidLinks: string[] = [];
        LINK_PRESETS.forEach((preset) => {
            const state = linkState[preset.id];
            if (!state?.enabled) return;
            const raw = state.url.trim();
            if (!raw) {
                invalidLinks.push(preset.label);
                return;
            }
            try {
                const parsed = new URL(raw);
                if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                    invalidLinks.push(preset.label);
                    return;
                }
                links.push({ label: preset.label, url: parsed.toString() });
            } catch {
                invalidLinks.push(preset.label);
            }
        });

        if (invalidLinks.length > 0) {
            setSpotlightSaved(false);
            const template = t("projectDetail.spotlight.invalidLinks");
            setSpotlightError(template.replace("{{lines}}", invalidLinks.join(", ")));
            return;
        }

        const nextSpotlight = normalizeProjectDocumentSpotlight({
            features,
            technicalDetails,
            storeLinks: links,
            titleIconUrl: spotlightTitleIconUrl,
        });

        const currentSettings = project.mindMapSettings || {};
        const currentDocumentView = currentSettings.documentView || {};
        const nextDocumentView = {
            ...currentDocumentView,
            ...(nextSpotlight ? { spotlight: nextSpotlight } : {}),
        } as typeof currentDocumentView;

        if (!nextSpotlight && "spotlight" in nextDocumentView) {
            delete (nextDocumentView as { spotlight?: unknown }).spotlight;
        }

        updateProjectSettings(realProjectId, {
            ...currentSettings,
            documentView: nextDocumentView,
        });

        setSpotlightError("");
        setSpotlightSaved(true);
    }

    const projectContext = project ? {
        projectId: project.id,
        projectTitle: project.title,
        projectDescription: project.description,
        sections: (project.sections || []).map((s) => ({
            id: s.id,
            title: s.title,
            content: getSectionAiContent(s),
            parentId: s.parentId,
            domainTags: s.domainTags,
            pageTypeId: s.pageTypeId,
            addonTypes: Array.from(new Set((s.addons || []).map((addon) => addon.type))).filter(Boolean) as string[],
        })),
    } : undefined;

    const navigationActions = [
        {
            href: `/projects/${projectId}/mindmap`,
            label: t("projectDetail.actions.mindMap"),
            accentClass: "from-sky-500/25 to-cyan-500/10",
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            ),
        },
        {
            href: `/projects/${projectId}/view`,
            label: t("projectDetail.actions.viewDocument"),
            accentClass: "from-indigo-500/25 to-violet-500/10",
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            href: `/projects/${projectId}/settings`,
            label: t("projectDetail.actions.settings"),
            accentClass: "from-slate-400/20 to-gray-500/10",
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        },
        {
            href: `/projects/${projectId}/backup`,
            label: t("projectDetail.actions.backup"),
            accentClass: "from-emerald-500/25 to-green-500/10",
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
            ),
        },
    ];

    const aiActions = [
        {
            href: `/projects/${projectId}/relations`,
            label: t("projectDetail.aiMenu.suggestRelations"),
            emoji: "🔗",
            accentClass: "from-fuchsia-500/25 to-purple-500/10",
        },
        {
            href: `/projects/${projectId}/analysis`,
            label: t("projectDetail.aiMenu.analyzeConsistency"),
            emoji: "⚖️",
            accentClass: "from-violet-500/25 to-indigo-500/10",
        },
        {
            href: `/projects/${projectId}/assign-tags`,
            label: t("projectDetail.aiMenu.assignTags"),
            emoji: "🏷️",
            accentClass: "from-pink-500/25 to-fuchsia-500/10",
        },
    ];
    const activeSectionId = useMemo(() => {
        const match = pathname.match(/\/projects\/[^/]+\/sections\/([^/?#]+)/);
        return match?.[1] ?? null;
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

    if (!mounted) return <div className="min-h-screen bg-gray-900 text-white p-6">{t("common.loading")}</div>;

    if (!project) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-6">
                <div className="max-w-5xl mx-auto">
                    <button className="mb-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors" onClick={() => router.push("/")}>
                        {t("projectDetail.backHome")}
                    </button>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-red-300">{t("projectDetail.notFound")} "{projectId}"</div>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-900 text-white px-4 py-8 md:px-8 md:py-10 lg:px-10">
            <div className="mx-auto w-full max-w-7xl">
                <div className="grid gap-6 items-start">
                    <div className="space-y-4">
                        <section className="ui-card-premium">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{project.title}</h1>
                                <button
                                    className="bg-yellow-500 text-black px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-yellow-400 transition-colors"
                                    onClick={() => router.push(`/projects/${projectId}/edit`)}
                                >
                                    {t("projectDetail.edit")}
                                </button>
                            </div>

                            <div className="mb-4">
                                {coverImageError && (
                                    <p className="text-sm text-red-300 mb-3">{coverImageError}</p>
                                )}
                                <button
                                    type="button"
                                    onClick={handlePickCoverImage}
                                    disabled={isPickingCoverImage}
                                    aria-label={t("projectDetail.cover.selectFromDrive")}
                                    className="w-full text-left rounded-xl overflow-hidden border border-gray-600/70 bg-gray-900/60 hover:border-blue-500/70 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {project.coverImageUrl && coverImageCandidateIndex < coverImageCandidates.length ? (
                                        <div className="relative">
                                            <img
                                                src={coverImageCandidates[coverImageCandidateIndex]}
                                                alt={t("projectDetail.cover.alt", "Capa do projeto")}
                                                onError={() => {
                                                    setCoverImageCandidateIndex((prev) => prev + 1);
                                                }}
                                                className="w-full max-h-[320px] object-cover"
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 px-3 py-2 text-xs bg-black/55 text-gray-100">
                                                {isPickingCoverImage ? t("projectDetail.cover.picking") : t("projectDetail.cover.hint")}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-48 md:h-56 border-2 border-dashed border-gray-600 rounded-xl m-3 flex flex-col items-center justify-center gap-2 text-center px-4">
                                            <span className="text-3xl">🖼️</span>
                                            <p className="text-sm font-medium text-gray-200">
                                                {isPickingCoverImage
                                                    ? t("projectDetail.cover.picking")
                                                    : t("projectDetail.cover.selectFromDrive")}
                                            </p>
                                            <p className="text-xs text-gray-400">{t("projectDetail.cover.noImage")}</p>
                                        </div>
                                    )}
                                </button>
                                {project.coverImageUrl && coverImageCandidateIndex >= coverImageCandidates.length && (
                                    <p className="text-amber-300 text-sm mt-2">{t("projectDetail.cover.loadFailed")}</p>
                                )}
                            </div>

                            <div className="text-gray-200">
                                {project.description ? (
                                    <MarkdownWithReferences
                                        content={project.description}
                                        projectId={projectId}
                                        sections={project.sections || []}
                                        projectTokenSource={project}
                                    />
                                ) : (
                                    <p className="text-gray-400 italic">{t("projectDetail.noDescription")}</p>
                                )}
                            </div>
                        </section>

                        <section className="ui-card-premium">
                            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                                <div>
                                    <h2 className="text-xl font-semibold tracking-tight">{t("projectDetail.spotlight.title")}</h2>
                                    <p className="text-sm text-gray-400 mt-1">{t("projectDetail.spotlight.subtitle")}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowSpotlightEditor((prev) => !prev)}
                                        className="px-4 py-2 rounded-lg bg-gray-700 text-white font-semibold hover:bg-gray-600 transition-colors"
                                    >
                                        {showSpotlightEditor
                                            ? t("projectDetail.spotlight.hidePanel")
                                            : t("projectDetail.spotlight.showPanel")}
                                    </button>
                                    {showSpotlightEditor && (
                                        <button
                                            type="button"
                                            onClick={handleSaveSpotlight}
                                            className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors"
                                        >
                                            {t("projectDetail.spotlight.save")}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {!showSpotlightEditor && (
                                <p className="text-sm text-gray-400 italic">{t("projectDetail.spotlight.hiddenHint")}</p>
                            )}

                            {showSpotlightEditor && (
                                <>
                            <div className="rounded-xl border border-gray-700 bg-gray-950/40 p-4 mb-4">
                                <p className="text-sm font-semibold text-gray-100 mb-1">{t("projectDetail.spotlight.iconLabel")}</p>
                                <p className="text-xs text-gray-400 mb-3">{t("projectDetail.spotlight.iconHelp")}</p>

                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-600 bg-gray-900/80 flex items-center justify-center">
                                        {spotlightTitleIconUrl && spotlightIconCandidateIndex < spotlightTitleIconCandidates.length ? (
                                            <img
                                                src={spotlightTitleIconCandidates[spotlightIconCandidateIndex]}
                                                alt={t("projectDetail.spotlight.iconAlt")}
                                                onError={() => setSpotlightIconCandidateIndex((prev) => prev + 1)}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <span className="text-2xl" aria-hidden>🎮</span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void handlePickSpotlightIcon()}
                                            disabled={isPickingSpotlightIcon}
                                            className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {isPickingSpotlightIcon
                                                ? t("projectDetail.cover.picking")
                                                : t("projectDetail.spotlight.iconSelect")}
                                        </button>
                                        {spotlightTitleIconUrl && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSpotlightTitleIconUrl("");
                                                    setSpotlightSaved(false);
                                                    setSpotlightIconError("");
                                                }}
                                                className="px-3 py-2 rounded-lg bg-gray-700 text-gray-100 text-sm font-medium hover:bg-gray-600"
                                            >
                                                {t("projectDetail.spotlight.iconRemove")}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {spotlightIconError && (
                                    <p className="mt-2 text-sm text-rose-300">{spotlightIconError}</p>
                                )}
                            </div>

                            <div className="rounded-xl border border-gray-700 bg-gray-950/40 p-4 mb-4">
                                <p className="text-sm font-semibold text-gray-100 mb-3">{t("projectDetail.spotlight.featuresLabel", "Features")}</p>
                                <div className="grid gap-2 md:grid-cols-2">
                                    {FEATURE_PRESETS.map((feature) => (
                                        <div key={feature} className="flex items-center gap-2 text-sm text-gray-200">
                                            <ToggleSwitch
                                                checked={Boolean(featureEnabled[feature])}
                                                onChange={(next) => {
                                                    setFeatureEnabled((prev) => ({ ...prev, [feature]: next }));
                                                    setSpotlightSaved(false);
                                                    if (spotlightError) setSpotlightError("");
                                                }}
                                                ariaLabel={feature}
                                            />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border border-gray-700 bg-gray-950/40 p-4 mb-4">
                                <p className="text-sm font-semibold text-gray-100 mb-3">{t("projectDetail.spotlight.detailsLabel", "Detalhes")}</p>
                                <div className="grid gap-3">
                                    {DETAIL_PRESETS.map((preset) => {
                                        const state = detailState[preset.id] || { enabled: false, value: "" };
                                        const quickPreset = DETAIL_VALUE_PRESETS[preset.id];
                                        const selectedPresetValues = quickPreset?.mode === "multi"
                                            ? parseTagValue(state.value)
                                            : state.value.trim()
                                                ? [state.value.trim()]
                                                : [];
                                        const quickOptions = quickPreset
                                            ? normalizeTagList([...quickPreset.options, ...selectedPresetValues])
                                            : [];
                                        return (
                                            <div key={preset.id} className="grid gap-2 md:grid-cols-[220px_1fr] md:items-center">
                                                <div className="flex items-center gap-2 text-sm text-gray-200">
                                                    <ToggleSwitch
                                                        checked={state.enabled}
                                                        onChange={(checked) => {
                                                            setDetailState((prev) => ({
                                                                ...prev,
                                                                [preset.id]: {
                                                                    enabled: checked,
                                                                    value: checked ? (prev[preset.id]?.value || "") : "",
                                                                },
                                                            }));
                                                            setSpotlightSaved(false);
                                                        }}
                                                        ariaLabel={preset.label}
                                                    />
                                                    <span>{preset.label}</span>
                                                </div>
                                                {quickPreset ? (
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-gray-400">{quickPreset.hint}</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {quickOptions.map((option) => {
                                                                const isSelected = hasValue(selectedPresetValues, option);
                                                                return (
                                                                    <button
                                                                        key={option}
                                                                        type="button"
                                                                        disabled={!state.enabled}
                                                                        onClick={() => {
                                                                            const nextValue = quickPreset.mode === "multi"
                                                                                ? formatTagValue(
                                                                                    isSelected
                                                                                        ? removeValue(selectedPresetValues, option)
                                                                                        : [...selectedPresetValues, option]
                                                                                )
                                                                                : (isSelected ? "" : option);
                                                                            setDetailState((prev) => ({
                                                                                ...prev,
                                                                                [preset.id]: {
                                                                                    enabled: true,
                                                                                    value: nextValue,
                                                                                },
                                                                            }));
                                                                            setSpotlightSaved(false);
                                                                        }}
                                                                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isSelected
                                                                            ? "border-sky-300 bg-sky-500/20 text-sky-100"
                                                                            : "border-gray-600 bg-gray-900/70 text-gray-200 hover:border-sky-400 hover:text-white"
                                                                            }`}
                                                                    >
                                                                        {option}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <input
                                                            type="text"
                                                            disabled={!state.enabled}
                                                            value={state.value}
                                                            onChange={(event) => {
                                                                const value = event.target.value;
                                                                setDetailState((prev) => ({
                                                                    ...prev,
                                                                    [preset.id]: { enabled: true, value },
                                                                }));
                                                                setSpotlightSaved(false);
                                                            }}
                                                            placeholder={preset.placeholder}
                                                            className="w-full rounded-lg border border-gray-600 bg-gray-900/80 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        disabled={!state.enabled}
                                                        value={state.value}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setDetailState((prev) => ({
                                                                ...prev,
                                                                [preset.id]: { enabled: true, value },
                                                            }));
                                                            setSpotlightSaved(false);
                                                        }}
                                                        placeholder={preset.placeholder}
                                                        className="w-full rounded-lg border border-gray-600 bg-gray-900/80 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="rounded-xl border border-gray-700 bg-gray-950/40 p-4">
                                <p className="text-sm font-semibold text-gray-100 mb-1">{t("projectDetail.spotlight.linksLabel", "Links e botões")}</p>
                                <p className="text-xs text-gray-400 mb-3">{t("projectDetail.spotlight.linksHelp", "Ative e preencha a URL completa para cada botão")}</p>

                                {(Object.keys(groupedLinkPresets) as Array<keyof typeof groupedLinkPresets>).map((category) => (
                                    <div key={category} className="mb-4 last:mb-0">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300 mb-2">
                                            {LINK_CATEGORY_LABEL[category]}
                                        </p>
                                        <div className="grid gap-2">
                                            {groupedLinkPresets[category].map((preset) => {
                                                const state = linkState[preset.id] || { enabled: false, url: "" };
                                                return (
                                                    <div key={preset.id} className="grid gap-2 md:grid-cols-[220px_1fr] md:items-center">
                                                        <div className="flex items-center gap-2 text-sm text-gray-200">
                                                            <ToggleSwitch
                                                                checked={state.enabled}
                                                                onChange={(checked) => {
                                                                    setLinkState((prev) => ({
                                                                        ...prev,
                                                                        [preset.id]: {
                                                                            enabled: checked,
                                                                            url: checked ? (prev[preset.id]?.url || "") : "",
                                                                        },
                                                                    }));
                                                                    setSpotlightSaved(false);
                                                                }}
                                                                ariaLabel={preset.label}
                                                            />
                                                            <span>{preset.label}</span>
                                                        </div>
                                                        <input
                                                            type="url"
                                                            disabled={!state.enabled}
                                                            value={state.url}
                                                            onChange={(event) => {
                                                                const url = event.target.value;
                                                                setLinkState((prev) => ({
                                                                    ...prev,
                                                                    [preset.id]: { enabled: true, url },
                                                                }));
                                                                setSpotlightSaved(false);
                                                                if (spotlightError) setSpotlightError("");
                                                            }}
                                                            placeholder={preset.placeholder}
                                                            className="w-full rounded-lg border border-gray-600 bg-gray-900/80 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {spotlightError && (
                                <p className="mt-3 text-sm text-rose-300">{spotlightError}</p>
                            )}
                            {spotlightSaved && !spotlightError && (
                                <p className="mt-3 text-sm text-emerald-300">{t("projectDetail.spotlight.saved")}</p>
                            )}

                            <div className="mt-5 rounded-xl border border-gray-700 bg-gray-950/60 p-4">
                                <h3 className="text-sm uppercase tracking-wide text-gray-300 mb-3">
                                    {t("projectDetail.spotlight.previewTitle")}
                                </h3>

                                {!currentSpotlight && (
                                    <p className="text-sm text-gray-400 italic">{t("projectDetail.spotlight.previewEmpty")}</p>
                                )}

                                {currentSpotlight?.features?.length ? (
                                    <div className="mb-3">
                                        <p className="text-xs font-semibold text-emerald-300 mb-1">{t("view.spotlight.featuresTitle")}</p>
                                        <ul className="space-y-1 text-sm text-gray-200 list-disc pl-5">
                                            {currentSpotlight.features.map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                {currentSpotlight?.technicalDetails?.length ? (
                                    <div className="mb-3">
                                        <p className="text-xs font-semibold text-sky-300 mb-1">{t("view.spotlight.detailsTitle")}</p>
                                        <ul className="space-y-1 text-sm text-gray-200 list-disc pl-5">
                                            {currentSpotlight.technicalDetails.map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                {currentSpotlight?.storeLinks?.length ? (
                                    <div className="flex flex-wrap gap-2">
                                        {currentSpotlight.storeLinks.map((link) => (
                                            <a
                                                key={`${link.label}-${link.url}`}
                                                href={link.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center rounded-full border border-indigo-400/70 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20"
                                            >
                                                {link.label}
                                            </a>
                                        ))}
                                    </div>
                                ) : null}

                                {currentSpotlight?.titleIconUrl ? (
                                    <p className="mt-3 text-xs text-gray-400">{t("projectDetail.spotlight.iconConfigured")}</p>
                                ) : null}
                            </div>
                                </>
                            )}
                        </section>

                        <section className="ui-card-premium">
                            <h2 className="text-xl font-semibold tracking-tight mb-4">{t("projectDetail.actions.navMenuLabel")}</h2>
                            <div className="scrollbar-premium scrollbar-premium-subtle flex gap-3 overflow-x-auto overflow-y-visible pt-1 pb-2 snap-x snap-mandatory scroll-px-1 sm:snap-none">
                                {navigationActions.map((action) => {
                                    const isActive = pathname === action.href;
                                    return (
                                        <Link
                                            key={action.href}
                                            href={action.href}
                                            prefetch={false}
                                            className={`group relative overflow-hidden shrink-0 snap-start w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-xl border flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-2 text-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset ${isActive
                                                ? "border-indigo-300 bg-indigo-600/20 text-indigo-100 shadow-lg shadow-indigo-900/40 -translate-y-0.5"
                                                : "border-gray-600 bg-gray-900/60 text-gray-300 hover:border-indigo-500 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px hover:shadow-sm hover:shadow-black/25"
                                                }`}
                                        >
                                            <span className={`absolute inset-0 bg-gradient-to-br ${action.accentClass} opacity-80`} aria-hidden />
                                            <span className="relative text-inherit group-hover:scale-105 transition-transform">{action.icon}</span>
                                            <span className="relative text-[11px] sm:text-xs font-medium leading-tight">{action.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="ui-card-premium">
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold tracking-tight">{t("projectDetail.aiMenu.title")}</h2>
                                <p className="text-xs text-gray-400 mt-1">{t("projectDetail.aiMenu.improveHint")}</p>
                            </div>
                            <div className="scrollbar-premium scrollbar-premium-subtle flex gap-3 overflow-x-auto overflow-y-visible pt-1 pb-2 snap-x snap-mandatory scroll-px-1 sm:snap-none">
                                {aiActions.map((action) => {
                                    const isActive = pathname === action.href;
                                    return (
                                        <Link
                                            key={action.href}
                                            href={action.href}
                                            prefetch={false}
                                            className={`group relative overflow-hidden shrink-0 snap-start w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-xl border flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-2 text-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset ${isActive
                                                ? "border-fuchsia-300 bg-fuchsia-600/20 text-fuchsia-100 shadow-lg shadow-fuchsia-900/40 -translate-y-0.5"
                                                : "border-gray-600 bg-gray-900/60 text-gray-300 hover:border-fuchsia-500 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px hover:shadow-sm hover:shadow-black/25"
                                                }`}
                                        >
                                            <span className={`absolute inset-0 bg-gradient-to-br ${action.accentClass} opacity-80`} aria-hidden />
                                            <span className="relative text-xl sm:text-2xl leading-none group-hover:scale-105 transition-transform">{action.emoji}</span>
                                            <span className="relative text-[11px] sm:text-xs font-medium leading-tight">{action.label}</span>
                                        </Link>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setChatOpen(true)}
                                    className={`group relative overflow-hidden shrink-0 snap-start w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-xl border flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-2 text-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset ${chatOpen
                                        ? "border-fuchsia-300 bg-fuchsia-600/20 text-fuchsia-100 shadow-lg shadow-fuchsia-900/40 -translate-y-0.5"
                                        : "border-gray-600 bg-gray-900/60 text-gray-300 hover:border-fuchsia-500 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px hover:shadow-sm hover:shadow-black/25"
                                        }`}
                                >
                                    <span className="absolute inset-0 bg-gradient-to-br from-rose-500/25 to-fuchsia-500/10 opacity-80" aria-hidden />
                                    <span className="relative text-xl sm:text-2xl leading-none group-hover:scale-105 transition-transform">💬</span>
                                    <span className="relative text-[11px] sm:text-xs font-medium leading-tight">{t("projectDetail.aiMenu.openChat")}</span>
                                </button>
                            </div>
                        </section>
                    </div>

                </div>
            </div>

            {/* Painel do chat IA (drawer lateral) - aberto pelo menu */}
            {chatOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setChatOpen(false)} aria-hidden />
                    <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
                        <AIChat
                            projectContext={projectContext}
                            onClose={() => setChatOpen(false)}
                            isOpen={chatOpen}
                        />
                    </div>
                </div>
            )}
        </main>
    );
}

// Componente auxiliar para renderizar árvore de seções (somente links)
function SectionTree({ sections, projectId, reorderSections, sensors, searchTerm, selectedTagFilters, selectedAddonFilters, activeSectionId, expandedSections, setExpandedSections, labels }: { 
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
    };
}) {
    // Filtrar seções que correspondem ao termo de busca
    const matchesSearch = (section: any): boolean => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const titleMatch = section.title.toLowerCase().includes(term);
        const contentMatch = section.content?.toLowerCase().includes(term) || false;
        return titleMatch || contentMatch;
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
    const matchesFilters = (section: any): boolean => matchesSearch(section) && matchesTags(section) && matchesAddons(section);

    // Filtrar raízes que correspondem ou têm filhos que correspondem
    const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
        const section = allSections.find(s => s.id === sectionId);
        if (!section) return false;
        if (matchesFilters(section)) return true;
        
        const children = allSections.filter(s => s.parentId === sectionId);
        return children.some(child => sectionMatchesOrHasMatchingChildren(child.id, allSections));
    };

    const roots = sections
        .filter((s) => !s.parentId)
        .filter(s => sectionMatchesOrHasMatchingChildren(s.id, sections))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    const totalMatches = (searchTerm.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0) ? sections.filter(matchesFilters).length : 0;

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = roots.findIndex((r) => r.id === active.id);
        const newIndex = roots.findIndex((r) => r.id === over.id);

        const newRoots = arrayMove(roots, oldIndex, newIndex);
        const newOrder = newRoots.map((r) => r.id);
        reorderSections(projectId, newOrder);
    }

    return (
        <>
            {(searchTerm.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0) && totalMatches > 0 && (
                <p className="text-sm text-gray-400 mb-2 ml-1">
                    {totalMatches} {totalMatches === 1 ? labels.resultsFoundOne : labels.resultsFoundMany}
                </p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                                labels={labels}
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>
        </>
    );
}

function SortableRootItem({ section, sections, projectId, searchTerm, selectedTagFilters, selectedAddonFilters, activeSectionId, expandedSections, setExpandedSections, labels }: { 
    section: any; 
    sections: any[]; 
    projectId: string; 
    searchTerm: string;
    selectedTagFilters: string[];
    selectedAddonFilters: string[];
    activeSectionId: string | null;
    expandedSections: Set<string>;
    setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
    labels: {
        match: string;
        reorder: string;
    };
}) {
    const highlightText = (text: string, term?: string) => {
        if (!term || !term.trim()) return text;
        const regex = new RegExp(`(${term})`, 'gi');
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
        if (!content || !term) return '';
        const lowerContent = content.toLowerCase();
        const lowerTerm = term.toLowerCase();
        const index = lowerContent.indexOf(lowerTerm);
        if (index === -1) return '';
        const start = Math.max(0, index - 40);
        const end = Math.min(content.length, index + term.length + 40);
        let snippet = content.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        return snippet;
    };

    const directMatch = matchesDirectly(section);
    const contentSnippet = directMatch && section.content ? getContentSnippet(section.content, searchTerm) : '';
    const isActiveSection = activeSectionId === section.id;
    
    const hasChildren = sections.some((s: any) => s.parentId === section.id);
    const isExpanded = expandedSections.has(section.id) || searchTerm.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: section.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <li ref={setNodeRef} style={style} className="mb-2">
            <div className={`group relative overflow-hidden flex items-center gap-2 border p-2.5 rounded-xl transition-all duration-150 ${isActiveSection
                ? "border-indigo-300/70 bg-indigo-600/20 shadow-md shadow-indigo-900/25"
                : "border-gray-700 bg-gray-900/70 hover:border-indigo-500/60 hover:-translate-y-px"
                }`}>
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none" aria-hidden />
                <span
                    className="relative text-gray-400 cursor-grab active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                    aria-label={labels.reorder}
                >
                    ⋮⋮
                </span>
                {hasChildren && (
                    <button
                        onClick={() => {
                            const newExpanded = new Set(expandedSections);
                            if (expandedSections.has(section.id)) {
                                newExpanded.delete(section.id);
                            } else {
                                newExpanded.add(section.id);
                            }
                            setExpandedSections(newExpanded);
                        }}
                        className={`relative inline-flex items-center justify-center h-5 w-5 rounded-md border text-sm transition-colors ${isActiveSection
                            ? "border-indigo-300/60 text-indigo-100 bg-indigo-500/20"
                            : "border-gray-600 text-gray-300 hover:text-white hover:border-indigo-400"
                            }`}
                    >
                        {isExpanded ? '−' : '+'}
                    </button>
                )}
                {!hasChildren && <span className="w-4"></span>}
                <Link
                    href={`/projects/${projectId}/sections/${toSlug(section.title)}`}
                    className={`relative flex-1 min-w-0 truncate text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset rounded px-0.5 ${isActiveSection ? "text-indigo-100 font-semibold" : "text-blue-300 hover:text-blue-200"}`}
                    prefetch={false}
                >
                    {highlightText(section.title, searchTerm)}
                </Link>
                {directMatch && searchTerm.trim() && (
                    <span className="relative text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">✓ {labels.match}</span>
                )}
            </div>
            {contentSnippet && (
                <div className="ml-8 text-xs text-gray-300 italic mt-1 bg-yellow-950/30 border border-yellow-700/60 p-2 rounded-lg">
                    {highlightText(contentSnippet, searchTerm)}
                </div>
            )}
            {hasChildren && (
                <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}>
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
                            labels={labels}
                        />
                    </div>
                </div>
            )}
        </li>
    );
}

function SectionChildren({ parentId, sections, projectId, searchTerm, selectedTagFilters, selectedAddonFilters, activeSectionId, expandedSections, setExpandedSections, labels }: { 
    parentId: string; 
    sections: any[]; 
    projectId: string; 
    searchTerm?: string;
    selectedTagFilters: string[];
    selectedAddonFilters: string[];
    activeSectionId: string | null;
    expandedSections: Set<string>;
    setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
    labels: {
        match: string;
    };
}) {
    const matchesSearch = (section: any): boolean => {
        if (!searchTerm || !searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const titleMatch = section.title.toLowerCase().includes(term);
        const contentMatch = section.content?.toLowerCase().includes(term) || false;
        return titleMatch || contentMatch;
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
    const matchesFilters = (section: any): boolean => matchesSearch(section) && matchesTags(section) && matchesAddons(section);

    const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
        const section = allSections.find(s => s.id === sectionId);
        if (!section) return false;
        if (matchesFilters(section)) return true;
        
        const children = allSections.filter(s => s.parentId === sectionId);
        return children.some(child => sectionMatchesOrHasMatchingChildren(child.id, allSections));
    };

    const kids = sections
        .filter((s) => s.parentId === parentId)
        .filter(s => sectionMatchesOrHasMatchingChildren(s.id, sections))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const highlightText = (text: string, term?: string) => {
        if (!term || !term.trim()) return text;
        const regex = new RegExp(`(${term})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) => 
            regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
        );
    };

    const getContentSnippet = (content: string, term: string): string => {
        if (!content || !term) return '';
        const lowerContent = content.toLowerCase();
        const lowerTerm = term.toLowerCase();
        const index = lowerContent.indexOf(lowerTerm);
        if (index === -1) return '';
        const start = Math.max(0, index - 40);
        const end = Math.min(content.length, index + term.length + 40);
        let snippet = content.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        return snippet;
    };

    if (kids.length === 0) return null;
    return (
        <ul className="ml-4 mt-2 pl-3 border-l border-gray-700/70 space-y-2">
            {kids.map((sec) => {
                const directMatch = matchesSearch(sec);
                const contentSnippet = directMatch && sec.content && searchTerm ? getContentSnippet(sec.content, searchTerm) : '';
                const hasChildren = sections.some((s: any) => s.parentId === sec.id);
                const isExpanded = expandedSections.has(sec.id) || searchTerm?.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0;
                const isActiveSection = activeSectionId === sec.id;
                
                return (
                    <li key={sec.id} className="mb-2">
                        <div className={`group relative overflow-hidden flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${isActiveSection
                            ? "border-indigo-300/60 bg-indigo-600/20"
                            : "border-gray-700/80 bg-gray-900/50 hover:border-indigo-500/50"
                            }`}>
                            {hasChildren && (
                                <button
                                    onClick={() => {
                                        const newExpanded = new Set(expandedSections);
                                        if (expandedSections.has(sec.id)) {
                                            newExpanded.delete(sec.id);
                                        } else {
                                            newExpanded.add(sec.id);
                                        }
                                        setExpandedSections(newExpanded);
                                    }}
                                    className={`inline-flex items-center justify-center h-5 w-5 rounded-md border text-sm transition-colors ${isActiveSection
                                        ? "border-indigo-300/60 text-indigo-100 bg-indigo-500/20"
                                        : "border-gray-600 text-gray-300 hover:text-white hover:border-indigo-400"
                                        }`}
                                >
                                    {isExpanded ? '−' : '+'}
                                </button>
                            )}
                            {!hasChildren && <span className="w-5" />}
                            <Link
                                href={`/projects/${projectId}/sections/${toSlug(sec.title)}`}
                                className={`flex-1 min-w-0 truncate text-sm transition-colors ${isActiveSection ? "text-indigo-100 font-semibold" : "text-blue-300 hover:text-blue-200"}`}
                                prefetch={false}
                            >
                                {highlightText(sec.title, searchTerm)}
                            </Link>
                            {directMatch && searchTerm && searchTerm.trim() && (
                                <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">✓ {labels.match}</span>
                            )}
                        </div>
                        {contentSnippet && (
                            <div className="text-xs text-gray-300 italic mt-1 bg-yellow-950/30 border border-yellow-700/60 p-2 rounded ml-4">
                                {highlightText(contentSnippet, searchTerm || '')}
                            </div>
                        )}
                        {hasChildren && (
                            <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}>
                                <div className="overflow-hidden">
                                    <SectionChildren 
                                        parentId={sec.id} 
                                        sections={sections} 
                                        projectId={projectId} 
                                        searchTerm={searchTerm}
                                        selectedTagFilters={selectedTagFilters}
                                        selectedAddonFilters={selectedAddonFilters}
                                        activeSectionId={activeSectionId}
                                        expandedSections={expandedSections}
                                        setExpandedSections={setExpandedSections}
                                        labels={labels}
                                    />
                                </div>
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
