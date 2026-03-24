import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureUserProfile } from "@/lib/supabase/ensureUserProfile";
import {
  FREE_MAX_PROJECTS,
  FREE_MAX_SECTIONS_PER_PROJECT,
  FREE_MAX_SECTIONS_TOTAL,
} from "@/lib/structuralLimits";
import { normalizeSectionAddons, stableAddonsForCompare } from "@/lib/addons/normalize";

/** Plano Free: 30 créditos/hora por projeto. Ajuste via env CLOUD_SYNC_CREDITS_PER_HOUR para Pro/outros. */
const DEFAULT_CLOUD_SYNC_CREDITS_PER_HOUR = 30;
/** Cota por projeto: dono e membros compartilham o mesmo pool. */
const CLOUD_SYNC_USAGE_BY_PROJECT_TABLE = "cloud_sync_usage_hourly_by_project";

/** Limite de requisições POST por usuário por minuto (proteção disk I/O / IOPS no Supabase). */
const SYNC_REQUESTS_PER_MINUTE = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

type RateLimitEntry = { count: number; windowStartMs: number };
const syncRequestCountByUser = new Map<string, RateLimitEntry>();

function checkSyncRateLimit(userId: string): { allowed: boolean } {
  const now = Date.now();
  const entry = syncRequestCountByUser.get(userId);
  if (!entry) {
    syncRequestCountByUser.set(userId, { count: 1, windowStartMs: now });
    return { allowed: true };
  }
  if (now - entry.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
    syncRequestCountByUser.set(userId, { count: 1, windowStartMs: now });
    return { allowed: true };
  }
  if (entry.count >= SYNC_REQUESTS_PER_MINUTE) {
    return { allowed: false };
  }
  entry.count += 1;
  return { allowed: true };
}

type CloudSyncQuotaStatus = {
  limitPerHour: number;
  usedInWindow: number;
  remainingInWindow: number;
  windowStartedAt: string;
  windowEndsAt: string;
  consumedThisSync: number;
};

type SyncAddonChange = {
  action: "added" | "updated" | "removed";
  addonId: string;
  addonType: string;
  addonName: string;
};

type SyncSectionChangeSummary = {
  sectionId: string;
  sectionTitle: string;
  facets: Array<"created" | "title" | "content" | "domainTags" | "parent" | "order" | "color" | "addons">;
  addons: SyncAddonChange[];
};

function getHourlyCreditLimit(): number {
  const raw = process.env.CLOUD_SYNC_CREDITS_PER_HOUR;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return DEFAULT_CLOUD_SYNC_CREDITS_PER_HOUR;
}

function getWindowTimestamps(now: Date) {
  const windowStart = new Date(now);
  windowStart.setMinutes(0, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);
  return {
    windowStartIso: windowStart.toISOString(),
    windowEndIso: windowEnd.toISOString(),
  };
}

function isMissingUsageTable(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const errStr =
    typeof error === "object" && error && "error" in error
      ? String((error as { error?: unknown }).error || "")
      : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  const combined = `${message} ${errStr}`.toLowerCase();

  return (
    code === "42P01" ||
    message.includes(CLOUD_SYNC_USAGE_BY_PROJECT_TABLE) ||
    message.toLowerCase().includes("does not exist") ||
    combined.includes("supabase_non_json_response") ||
    combined.includes("supabase_unavailable")
  );
}

function isMissingBalanceAddonsColumn(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const details =
    typeof error === "object" && error && "details" in error
      ? String((error as { details?: unknown }).details || "")
      : "";
  const combined = `${message} ${details}`.toLowerCase();
  return combined.includes("balance_addons") && combined.includes("column");
}

function isMissingProjectCoverImageColumn(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const details =
    typeof error === "object" && error && "details" in error
      ? String((error as { details?: unknown }).details || "")
      : "";
  const combined = `${message} ${details}`.toLowerCase();
  return combined.includes("cover_image_url") && combined.includes("column");
}

/** Extrai mensagem legível de erro Supabase/PostgREST (message, error, details, hint, code). */
function getSupabaseErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  const o = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : null;
  if (!o) return String(err);
  const message =
    (typeof o.message === "string" && o.message.trim() ? o.message.trim() : null) ||
    (typeof o.error === "string" && o.error.trim() ? o.error.trim() : null) ||
    "";
  const details = typeof o.details === "string" && o.details.trim() ? o.details.trim() : "";
  const hint = typeof o.hint === "string" && o.hint.trim() ? o.hint.trim() : "";
  const code = typeof o.code === "string" ? o.code : "";
  const parts = [message, details, hint].filter(Boolean);
  if (parts.length > 0) return parts.join(" — ");
  if (code) return `Erro ${code}`;
  try {
    const s = JSON.stringify(err);
    if (s && s !== "{}") return s;
  } catch {}
  return fallback;
}

function getDefaultAddonNameByType(type: string): string {
  switch (type) {
    case "xpBalance":
      return "Balanceamento";
    case "progressionTable":
      return "Tabela";
    case "economyLink":
      return "Economia";
    case "currency":
      return "Moeda";
    case "globalVariable":
      return "Variável";
    case "inventory":
      return "Inventário";
    case "production":
      return "Produção";
    default:
      return "Addon";
  }
}

function getAddonNameForSummary(rawAddon: unknown): string {
  if (!rawAddon || typeof rawAddon !== "object") return "Addon";
  const addon = rawAddon as { name?: unknown; type?: unknown };
  if (typeof addon.name === "string" && addon.name.trim()) return addon.name.trim();
  if (typeof addon.type === "string" && addon.type.trim()) return getDefaultAddonNameByType(addon.type.trim());
  return "Addon";
}

export async function POST(request: NextRequest) {
  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const { project } = await request.json();
    if (!project?.id) {
      return NextResponse.json({ error: "project is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    // Garante que o usuário tenha linha em profiles (evita quebra quando auth existe mas profile foi apagado)
    const { ensured, error: profileErr } = await ensureUserProfile(supabase, user);
    if (!ensured && profileErr) {
      return NextResponse.json(
        { error: "profile_missing", code: "profile_missing", message: profileErr },
        { status: 500 }
      );
    }

    // Nome do usuário que está sincronizando (para histórico visível a todos os membros)
    let syncedByDisplayName: string | null = null;
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profileRow && typeof (profileRow as { display_name?: string }).display_name === "string") {
      syncedByDisplayName = (profileRow as { display_name: string }).display_name;
    }
    if (syncedByDisplayName === null && user.email) syncedByDisplayName = user.email;

    if (!dryRun) {
      const { allowed } = checkSyncRateLimit(user.id);
      if (!allowed) {
        return NextResponse.json(
          { error: "rate_limit", code: "rate_limit", message: "Muitas requisições de sync por minuto." },
          { status: 429 }
        );
      }
    }

    // Projeto existente no cloud? (para saber dono e se usuário pode editar)
    const { data: existingProject, error: existingProjectErr } = await supabase
      .from("projects")
      .select("id, owner_id")
      .eq("id", project.id)
      .maybeSingle();

    if (existingProjectErr) {
      const msg = getSupabaseErrorMessage(existingProjectErr, "project_lookup_failed");
      return NextResponse.json({ error: msg, code: "project_lookup" }, { status: 500 });
    }

    // Se o projeto não existe, pode ter sido deletado pelo dono. Impedir que membro re-crie e vire owner.
    if (!existingProject) {
      try {
        const adminClient = createAdminClient();
        const { data: tombstone } = await adminClient
          .from("deleted_projects")
          .select("project_id")
          .eq("project_id", project.id)
          .maybeSingle();
        if (tombstone != null) {
          return NextResponse.json(
            { error: "project_deleted", code: "project_deleted", message: "Este projeto foi excluído pelo dono. Removendo da sua lista local." },
            { status: 410 }
          );
        }
      } catch {
        // Tabela deleted_projects pode não existir ainda; seguir fluxo normal
      }
    }

    const isNewProject = !existingProject;
    const projectOwnerId = existingProject?.owner_id ?? user.id;

    // Acesso: dono ou membro editor. Projeto novo só pode ser criado pelo dono (owner_id = user.id).
    if (existingProject) {
      const isOwner = existingProject.owner_id === user.id;
      let isEditor = false;
      if (!isOwner) {
        const { data: memberRow } = await supabase
          .from("project_members")
          .select("role")
          .eq("project_id", project.id)
          .eq("user_id", user.id)
          .maybeSingle();
        isEditor = (memberRow as { role?: string } | null)?.role === "editor";
      }
      if (!isOwner && !isEditor) {
        return NextResponse.json(
          { error: "forbidden", code: "forbidden", message: "Sem permissão para sincronizar este projeto." },
          { status: 403 }
        );
      }
    } else {
      // Projeto novo: só o criador pode enviar (será o dono)
      if (user.id !== projectOwnerId) {
        return NextResponse.json(
          { error: "forbidden", code: "forbidden", message: "Apenas o dono pode criar o projeto." },
          { status: 403 }
        );
      }
    }

    const incomingSections = project.sections || [];

    // Limites estruturais: aplicados ao DONO do projeto (membros sujeitos aos limites do dono)
    const { data: ownerProjects, error: ownerProjectsErr } = await supabase
      .from("projects")
      .select("id")
      .eq("owner_id", projectOwnerId);

    if (ownerProjectsErr) {
      const msg = getSupabaseErrorMessage(ownerProjectsErr, "projects_query_failed");
      return NextResponse.json({ error: msg, code: "projects_query" }, { status: 500 });
    }

    const ownerProjectIds = new Set((ownerProjects || []).map((r: { id: string }) => r.id));

    if (isNewProject && ownerProjectIds.size >= FREE_MAX_PROJECTS) {
      return NextResponse.json(
        {
          error: "structural_limit_exceeded",
          code: "structural_limit_exceeded",
          reason: "projects_limit",
          limit: FREE_MAX_PROJECTS,
        },
        { status: 403 }
      );
    }

    if (incomingSections.length > FREE_MAX_SECTIONS_PER_PROJECT) {
      return NextResponse.json(
        {
          error: "structural_limit_exceeded",
          code: "structural_limit_exceeded",
          reason: "sections_per_project_limit",
          limit: FREE_MAX_SECTIONS_PER_PROJECT,
        },
        { status: 403 }
      );
    }

    let { data: existingSections, error: existingErr } = await supabase
      .from("sections")
      .select("id,parent_id,title,content,sort_order,color,domain_tags,balance_addons")
      .eq("project_id", project.id);

    if (existingErr && isMissingBalanceAddonsColumn(existingErr)) {
      const retry = await supabase
        .from("sections")
        .select("id,parent_id,title,content,sort_order,color,domain_tags")
        .eq("project_id", project.id);
      existingSections = (retry.data || []).map((section: any) => ({
        ...section,
        balance_addons: null,
      }));
      existingErr = retry.error;
    }

    if (existingErr) {
      const msg = getSupabaseErrorMessage(existingErr, "sections_select_failed");
      return NextResponse.json({ error: msg, code: "sections_select" }, { status: 500 });
    }

    const existingSectionCount = (existingSections || []).length;
    const { count: totalSectionsCount, error: totalSectionsErr } = await supabase
      .from("sections")
      .select("id", { count: "exact", head: true })
      .in("project_id", Array.from(ownerProjectIds));

    if (totalSectionsErr) {
      const msg = getSupabaseErrorMessage(totalSectionsErr, "total_sections_count_failed");
      return NextResponse.json({ error: msg, code: "total_sections_count" }, { status: 500 });
    }

    const totalSectionsAfter =
      (totalSectionsCount ?? 0) - existingSectionCount + incomingSections.length;
    if (totalSectionsAfter > FREE_MAX_SECTIONS_TOTAL) {
      return NextResponse.json(
        {
          error: "structural_limit_exceeded",
          code: "structural_limit_exceeded",
          reason: "sections_total_limit",
          limit: FREE_MAX_SECTIONS_TOTAL,
        },
        { status: 403 }
      );
    }

    const existingById = new Map((existingSections || []).map((section: any) => [section.id, section]));
    const incomingIds = new Set(incomingSections.map((section: any) => section.id));

    const domainTagsEqual = (a: unknown, b: unknown): boolean => {
      const arrA = Array.isArray(a) ? [...a].sort() : [];
      const arrB = Array.isArray(b) ? [...b].sort() : [];
      if (arrA.length !== arrB.length) return false;
      return arrA.every((v, i) => v === arrB[i]);
    };
    const addonsEqual = (a: unknown, b: unknown): boolean => stableAddonsForCompare(a) === stableAddonsForCompare(b);
    const getSectionChangeSummary = (existing: any | undefined, section: any): SyncSectionChangeSummary => {
      const facets: SyncSectionChangeSummary["facets"] = [];
      const addons: SyncAddonChange[] = [];

      if (!existing) {
        facets.push("created");
      } else {
        if ((existing.title || "") !== (section.title || "")) facets.push("title");
        if ((existing.content || "") !== (section.content || "")) facets.push("content");
        if (!domainTagsEqual(existing.domain_tags, section.domainTags)) facets.push("domainTags");
        if ((existing.parent_id || null) !== (section.parentId || null)) facets.push("parent");
        if (Number((existing as { sort_order?: number }).sort_order ?? 0) !== Number(section.order || 0)) facets.push("order");
        if ((existing.color || null) !== (section.color || null)) facets.push("color");
      }

      const previousAddons = normalizeSectionAddons(existing?.balance_addons) || [];
      const incomingAddons = normalizeSectionAddons(section?.addons) || [];
      const previousById = new Map(previousAddons.map((addon) => [addon.id, addon]));
      const incomingById = new Map(incomingAddons.map((addon) => [addon.id, addon]));

      for (const incomingAddon of incomingAddons) {
        const previousAddon = previousById.get(incomingAddon.id);
        if (!previousAddon) {
          addons.push({
            action: "added",
            addonId: incomingAddon.id,
            addonType: incomingAddon.type,
            addonName: getAddonNameForSummary(incomingAddon),
          });
          continue;
        }
        if (stableAddonsForCompare([previousAddon]) !== stableAddonsForCompare([incomingAddon])) {
          addons.push({
            action: "updated",
            addonId: incomingAddon.id,
            addonType: incomingAddon.type,
            addonName: getAddonNameForSummary(incomingAddon),
          });
        }
      }

      for (const previousAddon of previousAddons) {
        if (!incomingById.has(previousAddon.id)) {
          addons.push({
            action: "removed",
            addonId: previousAddon.id,
            addonType: previousAddon.type,
            addonName: getAddonNameForSummary(previousAddon),
          });
        }
      }

      if (addons.length > 0) facets.push("addons");

      const uniqueFacets = Array.from(new Set(facets));
      return {
        sectionId: String(section.id),
        sectionTitle: (section.title && String(section.title).trim()) || "Sem título",
        facets: uniqueFacets,
        addons,
      };
    };

    const sectionsToUpsert = incomingSections.filter((section: any) => {
      const existing = existingById.get(section.id);
      if (!existing) return true;

      return (
        (existing.parent_id || null) !== (section.parentId || null) ||
        (existing.title || "") !== (section.title || "") ||
        (existing.content || "") !== (section.content || "") ||
        Number((existing as { sort_order?: number }).sort_order ?? 0) !== Number(section.order || 0) ||
        (existing.color || null) !== (section.color || null) ||
        !domainTagsEqual(existing.domain_tags, section.domainTags) ||
        !addonsEqual((existing as { balance_addons?: unknown }).balance_addons, section.addons)
      );
    });

    // Só contamos como "excluídas" seções que JÁ ESTÃO no cloud. Se o usuário criou uma seção
    // localmente e apagou sem nunca ter sincronizado, ela não está no DB → 0 créditos de delete.
    const removedSectionIds = (existingSections || [])
      .map((section: any) => section.id)
      .filter((id: string) => !incomingIds.has(id));

    const sectionsTotal = incomingSections.length;
    const sectionsUpserted = sectionsToUpsert.length;
    const sectionsDeleted = removedSectionIds.length;
    const sectionsUnchanged = Math.max(0, sectionsTotal - sectionsUpserted);

    // Créditos: 1 por seção nova/conteúdo, 1 no total por reordenação, 1 por delete. Listas para sync parcial.
    const contentUpsertList: any[] = [];
    const orderOnlyList: any[] = [];
    for (const section of sectionsToUpsert) {
      const existing = existingById.get(section.id);
      if (!existing) {
        contentUpsertList.push(section);
        continue;
      }
      const onlyOrderChanged =
        (existing.parent_id || null) === (section.parentId || null) &&
        (existing.title || "") === (section.title || "") &&
        (existing.content || "") === (section.content || "") &&
        (existing.color || null) === (section.color || null) &&
        domainTagsEqual(existing.domain_tags, section.domainTags) &&
        addonsEqual((existing as { balance_addons?: unknown }).balance_addons, section.addons);
      if (onlyOrderChanged) {
        orderOnlyList.push(section);
      } else {
        contentUpsertList.push(section);
      }
    }
    const orderOnlyCount = orderOnlyList.length;
    const contentChangeCount = contentUpsertList.length;
    const consumedThisSync = contentChangeCount + (orderOnlyCount > 0 ? 1 : 0) + sectionsDeleted;

    // Ordenar conteúdo por profundidade (pais antes de filhos) para sync parcial
    const byId = new Map(contentUpsertList.map((s: any) => [s.id, s]));
    const getDepth = (s: any): number => (s.parentId && byId.get(s.parentId) ? 1 + getDepth(byId.get(s.parentId)!) : 0);
    const contentUpsertSorted = [...contentUpsertList].sort(
      (a: any, b: any) => getDepth(a) - getDepth(b) || Number(a.order) - Number(b.order)
    );

    if (dryRun) {
      const existingArr = existingSections || [];
      const sectionsNew = sectionsToUpsert
        .filter((s: { id: string }) => !existingById.has(s.id))
        .map((s: { id: string; title?: string }) => ({ id: s.id, title: (s.title && String(s.title).trim()) || "Sem título" }));
      const sectionsUpdated = sectionsToUpsert
        .filter((s: { id: string }) => existingById.has(s.id))
        .map((s: { id: string; title?: string }) => ({ id: s.id, title: (s.title && String(s.title).trim()) || "Sem título" }));
      const sectionsDeletedList = removedSectionIds.map((id: string) => {
        const ex = existingArr.find((e: { id: string; title?: string }) => e.id === id);
        return { id, title: (ex && ex.title && String(ex.title).trim()) ? String(ex.title) : "Seção removida" };
      });
      return NextResponse.json({
        estimatedCredits: consumedThisSync,
        details: {
          projectId: project.id,
          projectTitle: (project.title && String(project.title).trim()) ? String(project.title) : "Projeto",
          sectionsNew: sectionsNew,
          sectionsUpdated: sectionsUpdated,
          sectionsDeleted: sectionsDeletedList,
        },
      });
    }

    const now = new Date();
    const { windowStartIso, windowEndIso } = getWindowTimestamps(now);
    const hourlyLimit = getHourlyCreditLimit();

    // Cota por projeto: dono e membros compartilham o mesmo pool
    let usageBefore = 0;
    let quotaEnabled = false;

    const { data: usageRow, error: usageReadErr } = await supabase
      .from(CLOUD_SYNC_USAGE_BY_PROJECT_TABLE)
      .select("used_credits")
      .eq("project_id", project.id)
      .eq("window_start", windowStartIso)
      .maybeSingle();

    if (usageReadErr && !isMissingUsageTable(usageReadErr)) {
      const msg = getSupabaseErrorMessage(usageReadErr, "usage_read_failed");
      return NextResponse.json({ error: msg, code: "usage_read" }, { status: 500 });
    }

    if (!usageReadErr) {
      quotaEnabled = true;
      usageBefore = Number(usageRow?.used_credits || 0);
    }

    const availableCredits = Math.max(0, hourlyLimit - usageBefore);
    const wouldExceedQuota = quotaEnabled && usageBefore + consumedThisSync > hourlyLimit;

    if (wouldExceedQuota && availableCredits <= 0) {
      return NextResponse.json(
        {
          error: "cloud_sync_quota_exceeded",
          code: "quota_exceeded",
          quota: {
            limitPerHour: hourlyLimit,
            usedInWindow: usageBefore,
            remainingInWindow: 0,
            windowStartedAt: windowStartIso,
            windowEndsAt: windowEndIso,
            consumedThisSync: 0,
          },
        },
        { status: 429 }
      );
    }

    // Sync parcial: usar só os créditos disponíveis (upserts por profundidade, depois order-only, depois deletes)
    let sectionsToApply: any[] = [];
    let deletesToApply: string[] = [];
    let actualCredits = 0;
    let partial = false;

    if (wouldExceedQuota && availableCredits > 0) {
      partial = true;
      let remaining = availableCredits;
      const nContent = Math.min(remaining, contentUpsertSorted.length);
      sectionsToApply = contentUpsertSorted.slice(0, nContent);
      remaining -= nContent;
      actualCredits += nContent;
      if (remaining >= 1 && orderOnlyList.length > 0) {
        sectionsToApply = [...sectionsToApply, ...orderOnlyList];
        actualCredits += 1;
        remaining -= 1;
      }
      const nDelete = Math.min(remaining, removedSectionIds.length);
      deletesToApply = removedSectionIds.slice(0, nDelete);
      actualCredits += nDelete;
    } else {
      sectionsToApply = [...contentUpsertSorted, ...orderOnlyList];
      deletesToApply = [...removedSectionIds];
      actualCredits = consumedThisSync;
    }

    const appliedSectionChanges = sectionsToApply.map((section: any) =>
      getSectionChangeSummary(existingById.get(section.id), section)
    );

    // Dono: upsert completo. Membro: só atualiza campos editáveis (não altera owner_id nem sharing público)
    const isOwner = projectOwnerId === user.id;
    if (existingProject && !isOwner) {
      const { data: currentRow } = await supabase
        .from("projects")
        .select("mindmap_settings")
        .eq("id", project.id)
        .maybeSingle();
      const existingSharing =
        currentRow && typeof currentRow === "object" && (currentRow as { mindmap_settings?: { sharing?: unknown } }).mindmap_settings?.sharing;
      const mergedMindmapSettings = {
        ...(project.mindMapSettings || {}),
        sharing: existingSharing ?? (project.mindMapSettings?.sharing ?? {}),
      };
      const updatePayload = {
        title: project.title,
        description: project.description || "",
        cover_image_url: project.coverImageUrl || null,
        mindmap_settings: mergedMindmapSettings,
        updated_at: project.updatedAt,
      };
      let { error: pErr } = await supabase
        .from("projects")
        .update(updatePayload)
        .eq("id", project.id);
      if (pErr && isMissingProjectCoverImageColumn(pErr)) {
        const { cover_image_url: _ignore, ...payloadWithoutCover } = updatePayload;
        const retry = await supabase.from("projects").update(payloadWithoutCover).eq("id", project.id);
        pErr = retry.error;
      }
      if (pErr) {
        const msg = getSupabaseErrorMessage(pErr, "projects_update_failed");
        return NextResponse.json({ error: msg, code: "projects_update" }, { status: 500 });
      }
    } else {
      const upsertPayload = {
        id: project.id,
        owner_id: projectOwnerId,
        title: project.title,
        description: project.description || "",
        cover_image_url: project.coverImageUrl || null,
        mindmap_settings: project.mindMapSettings || {},
        created_at: project.createdAt,
        updated_at: project.updatedAt,
      };
      let { error: pErr } = await supabase.from("projects").upsert(upsertPayload, { onConflict: "id" });
      if (pErr && isMissingProjectCoverImageColumn(pErr)) {
        const { cover_image_url: _ignore, ...payloadWithoutCover } = upsertPayload;
        const retry = await supabase.from("projects").upsert(payloadWithoutCover, { onConflict: "id" });
        pErr = retry.error;
      }

      if (pErr) {
        const msg = getSupabaseErrorMessage(pErr, "projects_upsert_failed");
        const pErrObj = pErr as unknown as Record<string, unknown>;
        const body: Record<string, unknown> = {
          error: msg,
          code: "projects_upsert",
          details: typeof pErrObj.details === "string" ? pErrObj.details : undefined,
          hint: typeof pErrObj.hint === "string" ? pErrObj.hint : undefined,
        };
        if (typeof pErrObj.bodyPreview === "string" && pErrObj.bodyPreview) {
          body.bodyPreview = pErrObj.bodyPreview;
        }
        if (msg.includes("supabase_non_json_response") || msg.includes("supabase_unavailable")) {
          body.hint = (body.hint as string) || "Verifique se o projeto Supabase está ativo (não pausado) e se NEXT_PUBLIC_SUPABASE_URL está correto.";
        }
        if (process.env.NODE_ENV !== "production") {
          try {
            body.debug = JSON.stringify(pErr, null, 2);
          } catch {}
        }
        return NextResponse.json(body, { status: 500 });
      }
    }

    if (sectionsToApply.length > 0) {
      const byIdApply = new Map(sectionsToApply.map((s: any) => [s.id, s]));
      const getDepthApply = (s: any): number =>
        s.parentId && byIdApply.get(s.parentId) ? 1 + getDepthApply(byIdApply.get(s.parentId)!) : 0;
      const sortedApply = [...sectionsToApply].sort(
        (a: any, b: any) => getDepthApply(a) - getDepthApply(b) || Number(a.order) - Number(b.order)
      );

      const nowIso = new Date().toISOString();
      const rows = sortedApply.map((s: any) => ({
        id: String(s.id),
        project_id: String(project.id),
        parent_id: s.parentId != null ? String(s.parentId) : null,
        title: String(s.title ?? ""),
        content: String(s.content ?? ""),
        sort_order: Number(s.order) ?? 0,
        color: s.color != null ? String(s.color) : null,
        created_at: s.created_at ? String(s.created_at) : nowIso,
        updated_at: s.updated_at ? String(s.updated_at) : nowIso,
        created_by: s.created_by ?? null,
        created_by_name: s.created_by_name ?? null,
        updated_by: s.updated_by ?? null,
        updated_by_name: s.updated_by_name ?? null,
        domain_tags: Array.isArray(s.domainTags) && s.domainTags.length > 0 ? s.domainTags : [],
        balance_addons: normalizeSectionAddons(s.addons) || [],
      }));
      const hasAnyAddonPayload = rows.some((row) => Array.isArray(row.balance_addons) && row.balance_addons.length > 0);

      let { error: sErr } = await supabase.from("sections").upsert(rows, { onConflict: "id" });
      if (sErr && isMissingBalanceAddonsColumn(sErr)) {
        const rowsWithoutAddons = rows.map(({ balance_addons: _ignored, ...rest }) => rest);
        const retry = await supabase.from("sections").upsert(rowsWithoutAddons, { onConflict: "id" });
        sErr = retry.error;
        if (!sErr && hasAnyAddonPayload) {
          return NextResponse.json(
            {
              error: "addons_column_missing_in_sections",
              code: "sections_balance_addons_column_missing",
              hint: "Aplique a migração de addons (coluna sections.balance_addons) no Supabase para persistir os addons.",
            },
            { status: 500 }
          );
        }
      }

      if (sErr) {
        const msg = getSupabaseErrorMessage(sErr, "sections_upsert_failed");
        const sErrObj = sErr as unknown as Record<string, unknown>;
        const body: Record<string, unknown> = {
          error: msg,
          code: "sections_upsert_failed",
          details: typeof sErrObj.details === "string" ? sErrObj.details : undefined,
          hint: typeof sErrObj.hint === "string" ? sErrObj.hint : undefined,
          bodyPreview: typeof sErrObj.bodyPreview === "string" ? sErrObj.bodyPreview : undefined,
        };
        if (process.env.NODE_ENV !== "production") {
          try {
            body.debug = JSON.stringify(sErr, null, 2);
            body.rowsCount = rows.length;
          } catch {}
        }
        return NextResponse.json(body, { status: 500 });
      }

      // Histórico de versões: gravar snapshot para seções com alteração de título/conteúdo
      const contentAppliedIds = new Set(contentUpsertList.map((s: { id: string }) => s.id));
      const versionRows = rows
        .filter((r: { id: string }) => contentAppliedIds.has(r.id))
        .map((r: Record<string, unknown>) => ({
          section_id: r.id,
          project_id: r.project_id,
          title: r.title ?? "",
          content: r.content ?? "",
          sort_order: r.sort_order ?? 0,
          color: r.color ?? null,
          balance_addons: r.balance_addons ?? [],
          created_at: r.updated_at ?? nowIso,
          updated_by: r.updated_by ?? null,
          updated_by_name: r.updated_by_name ?? null,
        }));
      if (versionRows.length > 0) {
        let { error: verErr } = await supabase.from("section_versions").insert(versionRows);
        if (verErr && isMissingBalanceAddonsColumn(verErr)) {
          const versionRowsWithoutAddons = versionRows.map(({ balance_addons: _ignored, ...rest }) => rest);
          const retry = await supabase.from("section_versions").insert(versionRowsWithoutAddons);
          verErr = retry.error;
        }
        if (verErr) console.error("[api/projects/sync] section_versions insert failed:", verErr);
      }
    }

    if (deletesToApply.length > 0) {
      const { error: deleteErr } = await supabase
        .from("sections")
        .delete()
        .eq("project_id", project.id)
        .in("id", deletesToApply);

      if (deleteErr) {
        const msg = getSupabaseErrorMessage(deleteErr, "sections_delete_failed");
        return NextResponse.json({ error: msg, code: "sections_delete" }, { status: 500 });
      }
    }

    let quota: CloudSyncQuotaStatus | null = null;
    if (quotaEnabled) {
      const usageAfter = usageBefore + actualCredits;
      const { error: usageWriteErr } = await supabase.from(CLOUD_SYNC_USAGE_BY_PROJECT_TABLE).upsert(
        {
          project_id: project.id,
          window_start: windowStartIso,
          used_credits: usageAfter,
        },
        { onConflict: "project_id,window_start" }
      );

      if (!usageWriteErr) {
        quota = {
          limitPerHour: hourlyLimit,
          usedInWindow: usageAfter,
          remainingInWindow: Math.max(0, hourlyLimit - usageAfter),
          windowStartedAt: windowStartIso,
          windowEndsAt: windowEndIso,
          consumedThisSync: actualCredits,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      partial: partial || undefined,
      remainingCreditsNeeded: partial ? Math.max(0, consumedThisSync - actualCredits) : undefined,
      stats: {
        sectionsTotal: incomingSections.length,
        sectionsUpserted: sectionsToApply.length,
        sectionsDeleted: deletesToApply.length,
        sectionsUnchanged: Math.max(0, incomingSections.length - sectionsToApply.length),
        changeSummary: {
          sections: appliedSectionChanges,
        },
      },
      quota,
      syncedBy: { userId: user.id, displayName: syncedByDisplayName },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[api/projects/sync] POST error:", message, stack);
    return NextResponse.json(
      { error: message || "internal_error", code: "sync_exception" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    // Só o dono pode deletar. Verificar com o client do usuário (respeita RLS).
    const { data: project, error: fetchErr } = await supabase
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: getSupabaseErrorMessage(fetchErr, "project_fetch_failed") }, { status: 500 });
    }
    if (!project) {
      return NextResponse.json({ error: "project_not_found" }, { status: 404 });
    }
    if ((project as { owner_id: string }).owner_id !== user.id) {
      return NextResponse.json(
        { error: "forbidden", message: "Apenas o dono do projeto pode excluí-lo." },
        { status: 403 }
      );
    }

    // Tombstone: registrar como deletado antes de apagar, para membros com cópia offline
    // receberem 410 ao tentar sincronizar e removerem o projeto localmente (evita re-criar como owner).
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        { error: "server_error", message: "Serviço indisponível para exclusão." },
        { status: 500 }
      );
    }
    await admin.from("deleted_projects").upsert({ project_id: projectId }, { onConflict: "project_id" });

    // Deletar com cliente admin; cascade remove sections e project_members.
    const { data: deleted, error } = await admin
      .from("projects")
      .delete()
      .eq("id", projectId)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: getSupabaseErrorMessage(error, "project_delete_failed") }, { status: 500 });
    }
    if (!deleted) {
      return NextResponse.json(
        { error: "project_delete_failed", message: "O projeto não pôde ser removido (nenhuma linha afetada)." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/projects/sync] DELETE error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
