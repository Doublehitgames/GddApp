"use client";

import { useAuthInit } from "@/hooks/useAuthInit";
import ProjectSyncFooter from "@/components/ProjectSyncFooter";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { QuickNewPageModal } from "@/components/QuickNewPageModal";

export default function ClientInit() {
  useAuthInit();
  return (
    <>
      <ProjectSyncFooter />
      <KeyboardShortcutsModal />
      <QuickNewPageModal />
    </>
  );
}
