"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { SectionPickerModal, type SectionLite } from "@/components/SectionPickerModal";

/**
 * Global keyboard shortcut (Ctrl+K / Cmd+K) that opens a page picker for the
 * current project. Select a page → navigates to it. Mounted once per project
 * shell.
 */
export function GlobalPagePicker({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));

  const sections: SectionLite[] = useMemo(() => {
    const list = project?.sections || [];
    return list.map((s: { id: string; title?: string; parentId?: string | null; order?: number; color?: string }) => ({
      id: s.id,
      title: s.title ?? "",
      parentId: s.parentId ?? null,
      order: s.order,
      color: s.color,
    }));
  }, [project?.sections]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (!isShortcut) return;
      // Don't hijack if user is composing in a field that needs Ctrl+K (rare).
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <SectionPickerModal
      open={open}
      onClose={() => setOpen(false)}
      onConfirm={(target) => {
        setOpen(false);
        router.push(`/projects/${projectId}/sections/${target}`);
      }}
      title={t("globalPicker.title", "Ir para página")}
      description={t("globalPicker.description", "Busque uma página para abrir")}
      confirmLabel={t("globalPicker.confirm", "Abrir")}
      confirmVariant="blue"
      sections={sections}
    />
  );
}
