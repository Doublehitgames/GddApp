import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/supabase/ensureUserProfile";
import {
  FREE_MAX_PROJECTS,
  FREE_MAX_SECTIONS_PER_PROJECT,
  FREE_MAX_SECTIONS_TOTAL,
} from "@/lib/structuralLimits";

/** Plano Free: 30 créditos/hora. Ajuste via env CLOUD_SYNC_CREDITS_PER_HOUR para Pro/outros. */
const DEFAULT_CLOUD_SYNC_CREDITS_PER_HOUR = 30;
const CLOUD_SYNC_USAGE_TABLE = "cloud_sync_usage_hourly";

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
    message.includes(CLOUD_SYNC_USAGE_TABLE) ||
    message.toLowerCase().includes("does not exist") ||
    combined.includes("supabase_non_json_response") ||
    combined.includes("supabase_unavailable")
  );
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

    if (!dryRun) {
      const { allowed } = checkSyncRateLimit(user.id);
      if (!allowed) {
        return NextResponse.json(
          { error: "rate_limit", code: "rate_limit", message: "Muitas requisições de sync por minuto." },
          { status: 429 }
        );
      }
    }

    const incomingSections = project.sections || [];

    // Limites estruturais (plano Free)
    const { data: userProjects, error: userProjectsErr } = await supabase
      .from("projects")
      .select("id")
      .eq("owner_id", user.id);

    if (userProjectsErr) {
      const msg = getSupabaseErrorMessage(userProjectsErr, "projects_query_failed");
      return NextResponse.json({ error: msg, code: "projects_query" }, { status: 500 });
    }

    const userProjectIds = new Set((userProjects || []).map((r: { id: string }) => r.id));
    const isNewProject = !userProjectIds.has(project.id);

    if (isNewProject && (userProjectIds.size >= FREE_MAX_PROJECTS)) {
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

    const { data: existingSections, error: existingErr } = await supabase
      .from("sections")
      .select("id,parent_id,title,content,sort_order,color")
      .eq("project_id", project.id);

    if (existingErr) {
      const msg = getSupabaseErrorMessage(existingErr, "sections_select_failed");
      return NextResponse.json({ error: msg, code: "sections_select" }, { status: 500 });
    }

    const existingSectionCount = (existingSections || []).length;
    const { count: totalSectionsCount, error: totalSectionsErr } = await supabase
      .from("sections")
      .select("id", { count: "exact", head: true })
      .in("project_id", Array.from(userProjectIds));

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

    const sectionsToUpsert = incomingSections.filter((section: any) => {
      const existing = existingById.get(section.id);
      if (!existing) return true;

      return (
        (existing.parent_id || null) !== (section.parentId || null) ||
        (existing.title || "") !== (section.title || "") ||
        (existing.content || "") !== (section.content || "") ||
        Number((existing as { sort_order?: number }).sort_order ?? 0) !== Number(section.order || 0) ||
        (existing.color || null) !== (section.color || null)
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

    // Créditos: cobramos pelo DIFF desta requisição (estado enviado vs. cloud), não por "ações" do usuário.
    // 1 por seção nova ou com alteração de conteúdo; 1 no total por reordenação (só order mudou); 1 por exclusão no cloud.
    // Ex.: criar + editar + mover + apagar (sem nunca ter dado sync) → envio = 0 seções → 0 créditos.
    let contentChangeCount = 0;
    let orderOnlyCount = 0;
    for (const section of sectionsToUpsert) {
      const existing = existingById.get(section.id);
      if (!existing) {
        contentChangeCount += 1;
        continue;
      }
      const onlyOrderChanged =
        (existing.parent_id || null) === (section.parentId || null) &&
        (existing.title || "") === (section.title || "") &&
        (existing.content || "") === (section.content || "") &&
        (existing.color || null) === (section.color || null);
      if (onlyOrderChanged) {
        orderOnlyCount += 1;
      } else {
        contentChangeCount += 1;
      }
    }
    const consumedThisSync = contentChangeCount + (orderOnlyCount > 0 ? 1 : 0) + sectionsDeleted;

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

    let usageBefore = 0;
    let quotaEnabled = false;

    const { data: usageRow, error: usageReadErr } = await supabase
      .from(CLOUD_SYNC_USAGE_TABLE)
      .select("used_credits")
      .eq("user_id", user.id)
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

    if (quotaEnabled && usageBefore + consumedThisSync > hourlyLimit) {
      const remaining = Math.max(0, hourlyLimit - usageBefore);
      return NextResponse.json(
        {
          error: "cloud_sync_quota_exceeded",
          code: "quota_exceeded",
          quota: {
            limitPerHour: hourlyLimit,
            usedInWindow: usageBefore,
            remainingInWindow: remaining,
            windowStartedAt: windowStartIso,
            windowEndsAt: windowEndIso,
            consumedThisSync: 0,
          },
        },
        { status: 429 }
      );
    }

    const { error: pErr } = await supabase.from("projects").upsert(
      {
        id: project.id,
        owner_id: user.id,
        title: project.title,
        description: project.description || "",
        mindmap_settings: project.mindMapSettings || {},
        created_at: project.createdAt,
        updated_at: project.updatedAt,
      },
      { onConflict: "id" }
    );

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

    if (sectionsToUpsert.length > 0) {
      // Ordenar: pais antes de filhos (parent_id referencia sections.id); evita violação de FK no upsert.
      const byId = new Map(sectionsToUpsert.map((s: { id: string }) => [s.id, s]));
      const getDepth = (s: { parentId?: string | null }): number => {
        if (!s.parentId) return 0;
        const parent = byId.get(s.parentId);
        if (!parent) return 0;
        return 1 + getDepth(parent);
      };
      const sorted = [...sectionsToUpsert].sort(
        (a: any, b: any) => getDepth(a) - getDepth(b) || (Number(a.order) - Number(b.order))
      );

      const nowIso = new Date().toISOString();
      const rows = sorted.map((s: any) => ({
        id: String(s.id),
        project_id: String(project.id),
        parent_id: s.parentId != null ? String(s.parentId) : null,
        title: String(s.title ?? ""),
        content: String(s.content ?? ""),
        sort_order: Number(s.order) ?? 0,
        color: s.color != null ? String(s.color) : null,
        created_at: s.created_at ? String(s.created_at) : nowIso,
        updated_at: nowIso,
      }));

      const { error: sErr } = await supabase.from("sections").upsert(rows, { onConflict: "id" });

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
    }

    if (removedSectionIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from("sections")
        .delete()
        .eq("project_id", project.id)
        .in("id", removedSectionIds);

      if (deleteErr) {
        const msg = getSupabaseErrorMessage(deleteErr, "sections_delete_failed");
        return NextResponse.json({ error: msg, code: "sections_delete" }, { status: 500 });
      }
    }

    let quota: CloudSyncQuotaStatus | null = null;
    if (quotaEnabled) {
      const usageAfter = usageBefore + consumedThisSync;
      const { error: usageWriteErr } = await supabase.from(CLOUD_SYNC_USAGE_TABLE).upsert(
        {
          user_id: user.id,
          window_start: windowStartIso,
          used_credits: usageAfter,
        },
        { onConflict: "user_id,window_start" }
      );

      if (!usageWriteErr) {
        quota = {
          limitPerHour: hourlyLimit,
          usedInWindow: usageAfter,
          remainingInWindow: Math.max(0, hourlyLimit - usageAfter),
          windowStartedAt: windowStartIso,
          windowEndsAt: windowEndIso,
          consumedThisSync,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      stats: {
        sectionsTotal,
        sectionsUpserted,
        sectionsDeleted,
        sectionsUnchanged,
      },
      quota,
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

    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/projects/sync] DELETE error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
