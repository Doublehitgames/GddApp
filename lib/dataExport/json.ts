import type { Project } from "@/store/slices/types";

/**
 * Backup completo em JSON — o MESMO formato do /backup (`{ projects,
 * exportDate, version: "1.0" }`), que é o que a restauração de lá e o
 * `importAllProjects` leem. Mudar a forma aqui quebra a restauração.
 */
export type FullBackup = {
  projects: Project[];
  exportDate: string;
  version: "1.0";
};

export function buildFullBackup(projects: Project[], now: Date = new Date()): FullBackup {
  return { projects, exportDate: now.toISOString(), version: "1.0" };
}

/** Os dados da conta: só o que identifica a pessoa, nunca token ou sessão. */
export type AccountExportInput = {
  user: {
    id: string;
    email?: string | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
    app_metadata?: { provider?: string; providers?: string[] } | null;
    user_metadata?: Record<string, unknown> | null;
  } | null;
  profile: { display_name?: string | null; avatar_url?: string | null; email?: string | null } | null;
  locale: string;
  theme?: string | null;
  projects: Array<Pick<Project, "id" | "title" | "ownerId" | "createdAt" | "updatedAt" | "sections">>;
};

export type AccountExport = {
  exportDate: string;
  account: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
    signInMethods: string[];
  } | null;
  preferences: { language: string; theme: string | null };
  projects: Array<{
    id: string;
    title: string;
    role: "owner" | "member" | "local";
    pages: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function buildAccountExport(input: AccountExportInput, now: Date = new Date()): AccountExport {
  const { user, profile } = input;
  const meta = user?.user_metadata ?? {};
  const providers = user?.app_metadata?.providers ?? (user?.app_metadata?.provider ? [user.app_metadata.provider] : []);
  return {
    exportDate: now.toISOString(),
    account: user
      ? {
          id: user.id,
          email: str(user.email) ?? str(profile?.email),
          name: str(profile?.display_name) ?? str(meta.full_name) ?? str(meta.name),
          avatarUrl: str(profile?.avatar_url) ?? str(meta.avatar_url),
          createdAt: str(user.created_at),
          lastSignInAt: str(user.last_sign_in_at),
          signInMethods: providers.filter((p): p is string => typeof p === "string"),
        }
      : null,
    preferences: { language: input.locale, theme: input.theme ?? null },
    projects: input.projects.map((p) => ({
      id: p.id,
      title: p.title,
      role: projectRole(p, user?.id ?? null),
      pages: p.sections?.length ?? 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  };
}

/**
 * De quem é o projeto, pelo mesmo critério da home: sem `ownerId` é projeto
 * que nasceu neste navegador e é da pessoa.
 */
export function projectRole(project: Pick<Project, "ownerId">, userId: string | null): "owner" | "member" | "local" {
  if (!userId) return "local";
  if (project.ownerId == null || project.ownerId === userId) return "owner";
  return "member";
}

export function toJsonBlob(data: unknown): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
}
