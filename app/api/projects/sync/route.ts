import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureUserProfile } from "@/lib/supabase/ensureUserProfile";
import { getRemoteConfig } from "@/lib/remoteConfig";
import type { Section } from "@/store/slices/types";

/** Plano Free: 30 créditos/hora por projeto. Ajuste via env CLOUD_SYNC_CREDITS_PER_HOUR para Pro/outros. */
const DEFAULT_CLOUD_SYNC_CREDITS_PER_HOUR = 30;
/** Cota por projeto: dono e membros compartilham o mesmo pool. */
const CLOUD_SYNC_USAGE_BY_PROJECT_TABLE = "cloud_sync_usage_hourly_by_project";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * A linha de `sections` como ela volta do banco: snake_case.
 *
 * O payload que o app envia é o `Section` do store, camelCase. Os dois
 * circulam lado a lado nesta rota, e enquanto ambos eram `any` uma
 * comparação entre a chave errada dos dois lados compilava calada — foi
 * exatamente assim que a escolha de exibição no Deck deixou de subir.
 */
type LinhaDeSecao = {
  id: string;
  parent_id: string | null;
  title: string | null;
  content: string | null;
  sort_order: number | null;
  color: string | null;
  domain_tags: string[] | null;
  data_id: string | null;
  thumb_image_url: string | null;
  status: string | null;
  status_at: string | null;
  deck_layout: string | null;
  flowchart_state: unknown;
  content_blocks: unknown;
};

type RateLimitEntry = { count: number; windowStartMs: number };
const syncRequestCountByUser = new Map<string, RateLimitEntry>();

/** Purge stale rate-limit entries every 5 minutes to prevent unbounded memory growth. */
const RATE_LIMIT_GC_INTERVAL_MS = 5 * 60 * 1000;
let lastRateLimitGc = Date.now();

function gcRateLimitEntries(now: number) {
  if (now - lastRateLimitGc < RATE_LIMIT_GC_INTERVAL_MS) return;
  lastRateLimitGc = now;
  for (const [uid, entry] of syncRequestCountByUser) {
    if (now - entry.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
      syncRequestCountByUser.delete(uid);
    }
  }
}

function checkSyncRateLimit(userId: string, limit: number): { allowed: boolean } {
  const now = Date.now();
  gcRateLimitEntries(now);
  const entry = syncRequestCountByUser.get(userId);
  if (!entry) {
    syncRequestCountByUser.set(userId, { count: 1, windowStartMs: now });
    return { allowed: true };
  }
  if (now - entry.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
    syncRequestCountByUser.set(userId, { count: 1, windowStartMs: now });
    return { allowed: true };
  }
  if (entry.count >= limit) {
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

type SyncSectionChangeSummary = {
  sectionId: string;
  sectionTitle: string;
  facets: Array<"created" | "title" | "content" | "domainTags" | "parent" | "order" | "color" | "thumbnail" | "flowchart" | "dataId" | "status" | "deckLayout">;
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

function isMissingSectionThumbImageColumn(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const details =
    typeof error === "object" && error && "details" in error
      ? String((error as { details?: unknown }).details || "")
      : "";
  const combined = `${message} ${details}`.toLowerCase();
  return combined.includes("thumb_image_url") && combined.includes("column");
}

function isMissingSectionFlowchartStateColumn(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const details =
    typeof error === "object" && error && "details" in error
      ? String((error as { details?: unknown }).details || "")
      : "";
  const combined = `${message} ${details}`.toLowerCase();
  return combined.includes("flowchart_state") && combined.includes("column");
}

function isMissingSectionContentBlocksColumn(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const details =
    typeof error === "object" && error && "details" in error
      ? String((error as { details?: unknown }).details || "")
      : "";
  const combined = `${message} ${details}`.toLowerCase();
  return combined.includes("content_blocks") && combined.includes("column");
}

function isMissingSectionStatusColumn(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const details =
    typeof error === "object" && error && "details" in error
      ? String((error as { details?: unknown }).details || "")
      : "";
  const combined = `${message} ${details}`.toLowerCase();
  if (!combined.includes("column")) return false;
  // O Postgres diz "column sections.status does not exist"; o PostgREST diz
  // "Could not find the 'status' column of 'sections'". As duas formas contam.
  return /sections\.status(_at)?\b/.test(combined) || /'status(_at)?'/.test(combined) || combined.includes("status_at");
}

/**
 * Enquanto a migração não roda, o app tem que sincronizar sem esta coluna.
 * O Postgres diz "column sections.deck_layout does not exist"; o PostgREST diz
 * "Could not find the deck_layout column of sections". As duas contam —
 * pegar só uma derruba todo o sync com 500 até alguém aplicar o SQL.
 */
function isMissingSectionDeckLayoutColumn(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const details =
    typeof error === "object" && error && "details" in error
      ? String((error as { details?: unknown }).details || "")
      : "";
  const combined = `${message} ${details}`.toLowerCase();
  if (!combined.includes("column")) return false;
  return /sections.deck_layout/.test(combined) || /.deck_layout./.test(combined);
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(obj[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
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

    const remoteConfig = await getRemoteConfig(user.id);

    if (!dryRun) {
      const { allowed } = checkSyncRateLimit(user.id, remoteConfig.SYNC_REQUESTS_PER_MINUTE);
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
    // Limites estruturais valem os do DONO — inclusive os overrides individuais dele.
    const ownerConfig =
      projectOwnerId === user.id ? remoteConfig : await getRemoteConfig(projectOwnerId);

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

    const incomingSections: Section[] = project.sections || [];

    // Limites estruturais: aplicados ao DONO do projeto (membros sujeitos aos limites do dono).
    // Contar projetos só interessa ao criar um projeto novo — e nesse caso quem
    // sincroniza é sempre o próprio dono, então a consulta sob RLS enxerga tudo.
    if (isNewProject) {
      const { data: ownerProjects, error: ownerProjectsErr } = await supabase
        .from("projects")
        .select("id")
        .eq("owner_id", projectOwnerId);

      if (ownerProjectsErr) {
        const msg = getSupabaseErrorMessage(ownerProjectsErr, "projects_query_failed");
        return NextResponse.json({ error: msg, code: "projects_query" }, { status: 500 });
      }

      if ((ownerProjects || []).length >= ownerConfig.FREE_MAX_PROJECTS) {
        return NextResponse.json(
          {
            error: "structural_limit_exceeded",
            code: "structural_limit_exceeded",
            reason: "projects_limit",
            limit: ownerConfig.FREE_MAX_PROJECTS,
          },
          { status: 403 }
        );
      }
    }

    if (incomingSections.length > ownerConfig.FREE_MAX_SECTIONS_PER_PROJECT) {
      return NextResponse.json(
        {
          error: "structural_limit_exceeded",
          code: "structural_limit_exceeded",
          reason: "sections_per_project_limit",
          limit: ownerConfig.FREE_MAX_SECTIONS_PER_PROJECT,
        },
        { status: 403 }
      );
    }

    let includeThumbImageColumn = true;
    let includeFlowchartStateColumn = true;
    let includeContentBlocksColumn = true;
    let includeStatusColumn = true;
    let includeDeckLayoutColumn = true;
    let existingSections: LinhaDeSecao[] | null = null;
    let existingErr: unknown = null;

    // Uma tentativa por coluna que a migração pode não ter aplicado ainda,
    // mais a boa.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const selectedColumns = [
        "id",
        "parent_id",
        "title",
        "content",
        "sort_order",
        "color",
        "domain_tags",
        "data_id",
        includeThumbImageColumn ? "thumb_image_url" : null,
        includeFlowchartStateColumn ? "flowchart_state" : null,
        includeContentBlocksColumn ? "content_blocks" : null,
        includeStatusColumn ? "status" : null,
        includeStatusColumn ? "status_at" : null,
        includeDeckLayoutColumn ? "deck_layout" : null,
      ]
        .filter(Boolean)
        .join(",");

      const current = await supabase
        .from("sections")
        .select(selectedColumns)
        .eq("project_id", project.id);

      existingErr = current.error;
      if (!existingErr) {
        existingSections = ((current.data || []) as unknown as LinhaDeSecao[]).map((section) => ({
          ...section,
          thumb_image_url: includeThumbImageColumn ? section.thumb_image_url ?? null : null,
          flowchart_state: includeFlowchartStateColumn ? section.flowchart_state ?? null : null,
          content_blocks: includeContentBlocksColumn ? section.content_blocks ?? null : null,
          status: includeStatusColumn ? section.status ?? null : null,
          status_at: includeStatusColumn ? section.status_at ?? null : null,
          deck_layout: includeDeckLayoutColumn ? section.deck_layout ?? null : null,
        }));
        break;
      }

      let retried = false;
      if (includeThumbImageColumn && isMissingSectionThumbImageColumn(existingErr)) {
        includeThumbImageColumn = false;
        retried = true;
      }
      if (includeFlowchartStateColumn && isMissingSectionFlowchartStateColumn(existingErr)) {
        includeFlowchartStateColumn = false;
        retried = true;
      }
      if (includeContentBlocksColumn && isMissingSectionContentBlocksColumn(existingErr)) {
        includeContentBlocksColumn = false;
        retried = true;
      }
      if (includeStatusColumn && isMissingSectionStatusColumn(existingErr)) {
        includeStatusColumn = false;
        retried = true;
      }
      if (includeDeckLayoutColumn && isMissingSectionDeckLayoutColumn(existingErr)) {
        includeDeckLayoutColumn = false;
        retried = true;
      }
      if (!retried) break;
    }

    if (existingErr) {
      const msg = getSupabaseErrorMessage(existingErr, "sections_select_failed");
      return NextResponse.json({ error: msg, code: "sections_select" }, { status: 500 });
    }

    const existingById = new Map((existingSections || []).map((section) => [section.id, section]));
    const incomingIds = new Set(incomingSections.map((section) => section.id));

    const domainTagsEqual = (a: unknown, b: unknown): boolean => {
      const arrA = Array.isArray(a) ? [...a].sort() : [];
      const arrB = Array.isArray(b) ? [...b].sort() : [];
      if (arrA.length !== arrB.length) return false;
      return arrA.every((v, i) => v === arrB[i]);
    };
    const flowchartStateEqual = (a: unknown, b: unknown): boolean => stableSerialize(a) === stableSerialize(b);
    const getSectionChangeSummary = (existing: LinhaDeSecao | undefined, section: Section): SyncSectionChangeSummary => {
      const facets: SyncSectionChangeSummary["facets"] = [];

      if (!existing) {
        facets.push("created");
      } else {
        if ((existing.title || "") !== (section.title || "")) facets.push("title");
        if ((existing.content || "") !== (section.content || "")) facets.push("content");
        if (!domainTagsEqual(existing.domain_tags, section.domainTags)) facets.push("domainTags");
        if ((existing.parent_id || null) !== (section.parentId || null)) facets.push("parent");
        if (Number((existing as { sort_order?: number }).sort_order ?? 0) !== Number(section.order || 0)) facets.push("order");
        if ((existing.color || null) !== (section.color || null)) facets.push("color");
        if ((existing.thumb_image_url || null) !== (section.thumbImageUrl || null)) facets.push("thumbnail");
        if ((existing.data_id || null) !== (section.dataId || null)) facets.push("dataId");
        if ((existing.status || null) !== (section.status || null)) facets.push("status");
        // `section` é o payload do store, em camelCase; `existing` é a linha do
        // banco, em snake_case. Ler section.deck_layout comparava a coluna com
        // undefined e a escolha de exibição no Deck nunca subia sozinha.
        if ((existing.deck_layout || null) !== (section.deckLayout || null)) facets.push("deckLayout");
        if (!flowchartStateEqual(existing.flowchart_state, section.flowchartState || null)) facets.push("flowchart");
      }

      const uniqueFacets = Array.from(new Set(facets));
      return {
        sectionId: String(section.id),
        sectionTitle: (section.title && String(section.title).trim()) || "Sem título",
        facets: uniqueFacets,
      };
    };

    const sectionsToUpsert = incomingSections.filter((section) => {
      const existing = existingById.get(section.id);
      if (!existing) return true;

      return (
        (existing.parent_id || null) !== (section.parentId || null) ||
        (existing.title || "") !== (section.title || "") ||
        (existing.content || "") !== (section.content || "") ||
        Number((existing as { sort_order?: number }).sort_order ?? 0) !== Number(section.order || 0) ||
        (existing.color || null) !== (section.color || null) ||
        (existing.thumb_image_url || null) !== (section.thumbImageUrl || null) ||
        (existing.data_id || null) !== (section.dataId || null) ||
        (existing.status || null) !== (section.status || null) ||
        (existing.deck_layout || null) !== (section.deckLayout || null) ||
        !domainTagsEqual(existing.domain_tags, section.domainTags) ||
        !flowchartStateEqual((existing as { flowchart_state?: unknown }).flowchart_state, section.flowchartState || null) ||
        stableSerialize((existing as { content_blocks?: unknown }).content_blocks ?? null) !==
          stableSerialize(section.contentBlocks ?? null)
      );
    });

    // Só contamos como "excluídas" seções que JÁ ESTÃO no cloud. Se o usuário criou uma seção
    // localmente e apagou sem nunca ter sincronizado, ela não está no DB → 0 créditos de delete.
    const removedSectionIds = (existingSections || [])
      .map((section) => section.id)
      .filter((id: string) => !incomingIds.has(id));

    const sectionsTotal = incomingSections.length;
    const sectionsUpserted = sectionsToUpsert.length;
    const sectionsDeleted = removedSectionIds.length;
    const sectionsUnchanged = Math.max(0, sectionsTotal - sectionsUpserted);

    // Crédito é o preço do CONTEÚDO: página nova, texto novo, página apagada.
    //
    // Metadado não entra na conta — hoje a ordem no mapa e o estado da página.
    // São escritas minúsculas, não geram versão no histórico nem linha no
    // changelog, e cobrar por elas inviabilizava justamente o uso que a gente
    // quer incentivar: num GDD maduro, classificar 200 páginas custaria vários
    // dias de cota, então ninguém classificaria.
    //
    // As listas continuam separadas porque o sync parcial precisa saber o que
    // cabe no que sobrou de crédito.
    const contentUpsertList: Section[] = [];
    const metadataOnlyList: Section[] = [];
    for (const section of sectionsToUpsert) {
      const existing = existingById.get(section.id);
      if (!existing) {
        contentUpsertList.push(section);
        continue;
      }
      // Ordem e estado ficam de fora da comparação de propósito: são exatamente
      // os dois campos que podem mudar de graça.
      const onlyMetadataChanged =
        (existing.parent_id || null) === (section.parentId || null) &&
        (existing.title || "") === (section.title || "") &&
        (existing.content || "") === (section.content || "") &&
        stableSerialize((existing as { content_blocks?: unknown }).content_blocks ?? null) ===
          stableSerialize(section.contentBlocks ?? null) &&
        (existing.color || null) === (section.color || null) &&
        (existing.thumb_image_url || null) === (section.thumbImageUrl || null) &&
        (existing.data_id || null) === (section.dataId || null) &&
        domainTagsEqual(existing.domain_tags, section.domainTags) &&
        flowchartStateEqual((existing as { flowchart_state?: unknown }).flowchart_state, section.flowchartState || null);
      if (onlyMetadataChanged) {
        metadataOnlyList.push(section);
      } else {
        contentUpsertList.push(section);
      }
    }
    const contentChangeCount = contentUpsertList.length;
    const consumedThisSync = contentChangeCount + sectionsDeleted;

    // Ordenar conteúdo por profundidade (pais antes de filhos) para sync parcial
    const byId = new Map(contentUpsertList.map((s) => [s.id, s]));
    const getDepth = (s: Section): number => (s.parentId && byId.get(s.parentId) ? 1 + getDepth(byId.get(s.parentId)!) : 0);
    const contentUpsertSorted = [...contentUpsertList].sort(
      (a, b) => getDepth(a) - getDepth(b) || Number(a.order) - Number(b.order)
    );

    if (dryRun) {
      const existingArr = existingSections || [];
      const sectionsNew = sectionsToUpsert
        .filter((s) => !existingById.has(s.id))
        .map((s) => ({ id: s.id, title: (s.title && String(s.title).trim()) || "Sem título" }));
      const sectionsUpdated = sectionsToUpsert
        .filter((s) => existingById.has(s.id))
        .map((s) => ({ id: s.id, title: (s.title && String(s.title).trim()) || "Sem título" }));
      const sectionsDeletedList = removedSectionIds.map((id: string) => {
        const ex = existingArr.find((e) => e.id === id);
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
    // Sync que não custa nada não passa pela cota: classificar páginas ou
    // reordenar o mapa tem que funcionar mesmo com a cota do dia esgotada.
    const wouldExceedQuota =
      quotaEnabled && consumedThisSync > 0 && usageBefore + consumedThisSync > hourlyLimit;

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

    // Sync parcial: usar só os créditos disponíveis (upserts por profundidade, depois deletes).
    // O metadado vai junto sempre, custe o que custar o resto — segurar a ordem
    // ou o estado numa sincronização parcial não economizaria crédito nenhum.
    let sectionsToApply: Section[] = [];
    let deletesToApply: string[] = [];
    let actualCredits = 0;
    let partial = false;

    if (wouldExceedQuota && availableCredits > 0) {
      partial = true;
      let remaining = availableCredits;
      const nContent = Math.min(remaining, contentUpsertSorted.length);
      sectionsToApply = [...contentUpsertSorted.slice(0, nContent), ...metadataOnlyList];
      remaining -= nContent;
      actualCredits += nContent;
      const nDelete = Math.min(remaining, removedSectionIds.length);
      deletesToApply = removedSectionIds.slice(0, nDelete);
      actualCredits += nDelete;
    } else {
      sectionsToApply = [...contentUpsertSorted, ...metadataOnlyList];
      deletesToApply = [...removedSectionIds];
      actualCredits = consumedThisSync;
    }

    const appliedSectionChanges = sectionsToApply.map((section) =>
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
        ai_instructions: project.aiInstructions || "",
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
        ai_instructions: project.aiInstructions || "",
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
      const byIdApply = new Map(sectionsToApply.map((s) => [s.id, s]));
      const getDepthApply = (s: Section): number =>
        s.parentId && byIdApply.get(s.parentId) ? 1 + getDepthApply(byIdApply.get(s.parentId)!) : 0;
      const sortedApply = [...sectionsToApply].sort(
        (a, b) => getDepthApply(a) - getDepthApply(b) || Number(a.order) - Number(b.order)
      );

      const nowIso = new Date().toISOString();
      const rows = sortedApply.map((s) => ({
        id: String(s.id),
        project_id: String(project.id),
        parent_id: s.parentId != null ? String(s.parentId) : null,
        title: String(s.title ?? ""),
        content: String(s.content ?? ""),
        sort_order: Number(s.order) ?? 0,
        color: s.color != null ? String(s.color) : null,
        thumb_image_url: s.thumbImageUrl != null ? String(s.thumbImageUrl) : null,
        created_at: s.created_at ? String(s.created_at) : nowIso,
        updated_at: s.updated_at ? String(s.updated_at) : nowIso,
        created_by: s.created_by ?? null,
        created_by_name: s.created_by_name ?? null,
        updated_by: s.updated_by ?? null,
        updated_by_name: s.updated_by_name ?? null,
        data_id: s.dataId != null ? String(s.dataId) : null,
        status: s.status != null ? String(s.status) : null,
        status_at: s.statusAt != null ? String(s.statusAt) : null,
        deck_layout: s.deckLayout != null ? String(s.deckLayout) : null,
        domain_tags: Array.isArray(s.domainTags) && s.domainTags.length > 0 ? s.domainTags : [],
        flowchart_state: s.flowchartState ?? null,
        content_blocks: Array.isArray(s.contentBlocks) && s.contentBlocks.length > 0 ? s.contentBlocks : null,
      }));
      const hasAnyThumbPayload = rows.some((row) => typeof row.thumb_image_url === "string" && row.thumb_image_url.trim().length > 0);
      const hasAnyFlowchartPayload = rows.some((row) => row.flowchart_state != null);
      const hasAnyContentBlocksPayload = rows.some((row) => row.content_blocks != null);
      const hasAnyStatusPayload = rows.some((row) => row.status != null);
      const hasAnyDeckLayoutPayload = rows.some((row) => row.deck_layout != null);

      // Garante que parent_id só aponta para seções que sobreviverão ao sync.
      // Evita FK violation quando o store tem seções órfãs (pai deletado sem cascade no store).
      const upsertBatchIds = new Set(rows.map((r) => String(r.id)));
      const deletedThisSync = new Set(deletesToApply);
      const existingDbIds = new Set(
        (existingSections || [])
          .map((s: { id: string }) => s.id)
          .filter((id: string) => !deletedThisSync.has(id))
      );
      let rowsForUpsert: Array<Record<string, unknown>> = rows.map((r) => {
        if (r.parent_id == null) return r;
        const pid = String(r.parent_id);
        if (upsertBatchIds.has(pid) || existingDbIds.has(pid)) return r;
        return { ...r, parent_id: null };
      });
      let droppedThumbColumn = false;
      let droppedFlowchartColumn = false;
      let droppedContentBlocksColumn = false;
      let droppedStatusColumn = false;
      let droppedDeckLayoutColumn = false;
      let sErr: unknown = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const upsertResult = await supabase
          .from("sections")
          .upsert(rowsForUpsert as unknown as object[], { onConflict: "id" });
        sErr = upsertResult.error;
        if (!sErr) break;

        let retried = false;
        if (!droppedThumbColumn && isMissingSectionThumbImageColumn(sErr)) {
          rowsForUpsert = rowsForUpsert.map(({ thumb_image_url: _ignored, ...rest }) => rest);
          droppedThumbColumn = true;
          retried = true;
        }
        if (!droppedFlowchartColumn && isMissingSectionFlowchartStateColumn(sErr)) {
          rowsForUpsert = rowsForUpsert.map(({ flowchart_state: _ignored, ...rest }) => rest);
          droppedFlowchartColumn = true;
          retried = true;
        }
        if (!droppedContentBlocksColumn && isMissingSectionContentBlocksColumn(sErr)) {
          rowsForUpsert = rowsForUpsert.map(({ content_blocks: _ignored, ...rest }) => rest);
          droppedContentBlocksColumn = true;
          retried = true;
        }
        if (!droppedDeckLayoutColumn && isMissingSectionDeckLayoutColumn(sErr)) {
          rowsForUpsert = rowsForUpsert.map(({ deck_layout: _deckLayout, ...rest }) => rest);
          droppedDeckLayoutColumn = true;
          retried = true;
        }
        if (!droppedStatusColumn && isMissingSectionStatusColumn(sErr)) {
          rowsForUpsert = rowsForUpsert.map(
            ({ status: _status, status_at: _statusAt, ...rest }) => rest
          );
          droppedStatusColumn = true;
          retried = true;
        }
        if (!retried) break;
      }
      if (!sErr && droppedThumbColumn && hasAnyThumbPayload) {
        console.warn("[api/projects/sync] sections.thumb_image_url ausente; sincronizando sem thumbs.");
      }
      if (!sErr && droppedDeckLayoutColumn && hasAnyDeckLayoutPayload) {
        console.warn("[api/projects/sync] sections.deck_layout ausente; sincronizando sem a exibição no Deck. Aplique add_sections_deck_layout.sql.");
      }
      if (!sErr && droppedStatusColumn && hasAnyStatusPayload) {
        console.warn("[api/projects/sync] sections.status ausente; sincronizando sem o estado das páginas. Aplique add_sections_status.sql.");
      }
      if (!sErr && droppedContentBlocksColumn && hasAnyContentBlocksPayload) {
        // Aviso (não erro): a descrição ainda persiste via `content` (markdown
        // espelho). A migração da coluna sections.content_blocks habilita a
        // edição lossless nativa em blocks.
        console.warn("[api/projects/sync] sections.content_blocks ausente; sincronizando descrição só como markdown. Aplique a migração para edição nativa em blocks.");
      }
      if (!sErr && droppedFlowchartColumn && hasAnyFlowchartPayload) {
        return NextResponse.json(
          {
            error: "flowchart_column_missing_in_sections",
            code: "sections_flowchart_state_column_missing",
            hint: "Aplique a migração da coluna sections.flowchart_state no Supabase para persistir fluxogramas por seção.",
          },
          { status: 500 }
        );
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
          created_at: r.updated_at ?? nowIso,
          updated_by: r.updated_by ?? null,
          updated_by_name: r.updated_by_name ?? null,
        }));
      if (versionRows.length > 0) {
        // O changelog separa o que o time escreveu do que o agente escreveu, e
        // tudo que passa por aqui veio do navegador. A coluna `origin` chegou
        // depois: sem a migração aplicada, grava-se o snapshot sem ela.
        const { error: verErr } = await supabase
          .from("section_versions")
          .insert(versionRows.map((row) => ({ ...row, origin: "app" })));
        if (verErr) {
          const retry = await supabase.from("section_versions").insert(versionRows);
          if (retry.error) {
            console.error("[api/projects/sync] section_versions insert failed:", retry.error);
          }
        }
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
