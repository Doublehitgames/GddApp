"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore, LevelConfig, type Project } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { MINDMAP_CONFIG } from "@/lib/mindMapConfig";
import { useI18n } from "@/lib/i18n/provider";
import { pushProjectMindMapSettings } from "@/lib/supabase/projectSync";
import { DOCUMENT_THEME_OPTIONS, normalizeDocumentTheme, type DocumentThemeId } from "@/lib/documentThemes";
import { ToggleSwitch } from "@/components/ToggleSwitch";

interface Props {
  projectId: string;
}

type MemberRow = { userId: string; email: string | null; displayName: string | null; role: string; createdAt: string };

const DOCUMENT_THEME_PREVIEW_BAR: Record<DocumentThemeId, string> = {
  clean: "from-slate-200 via-slate-300 to-slate-200",
  modern: "from-sky-300 via-blue-500 to-cyan-300",
  luxury: "from-amber-100 via-amber-500 to-yellow-200",
  editorial: "from-zinc-300 via-zinc-700 to-zinc-300",
  night: "from-cyan-300 via-indigo-500 to-sky-300",
};

export default function SettingsClient({ projectId }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const {
    getProject,
    updateProjectSettings,
    updateProjectMindMapSettingsOnly,
    removeProject,
    loadFromSupabase,
    refreshQuotaStatus,
    setProjectOwnerLocally,
  } = useProjectStore();
  const project = getProject(projectId);
  const [settings, setSettings] = useState(project?.mindMapSettings || {});
  const [showSuccess, setShowSuccess] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set()); // Todos colapsados por padrão
  const [shareBaseUrl, setShareBaseUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = Boolean(user?.id && (project?.ownerId === user.id || (project && !project.ownerId && user.id)));
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [memberDialog, setMemberDialog] = useState<MemberRow | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferConfirmValue, setTransferConfirmValue] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [deleteBackupChecked, setDeleteBackupChecked] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!projectId) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/members`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.members)) setMembers(data.members);
      else setMembers([]);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) void fetchMembers();
  }, [projectId, fetchMembers]);

  useEffect(() => {
    if (!transferSuccess) return;
    const id = setTimeout(() => setTransferSuccess(null), 3000);
    return () => clearTimeout(id);
  }, [transferSuccess]);

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError(t("settings.mindmapShareMembers.inviteErrorRequired"));
      return;
    }
    setInviteError(null);
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setInviteEmail("");
        await fetchMembers();
      } else {
        const msg = (data.debug as string) || (data.message as string) || (data.error as string) || t("settings.mindmapShareMembers.inviteErrorGeneric");
        setInviteError(msg);
      }
    } catch {
      setInviteError(t("settings.mindmapShareMembers.inviteErrorNetwork"));
    } finally {
      setInviteLoading(false);
    }
  };

  const downloadProjectBackup = useCallback((proj: Project) => {
    const backupData = { project: proj, exportDate: new Date().toISOString(), version: "1.0" };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${proj.title.replace(/[^a-z0-9]/gi, "_")}_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleRemoveMember = async (userId: string) => {
    if (!confirm(t("settings.mindmapShareMembers.removeConfirm"))) return;
    setRemoveError(null);
    setRemovingUserId(userId);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/members?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchMembers();
      } else {
        setRemoveError((data.message as string) || (data.error as string) || t("settings.mindmapShareMembers.removeErrorGeneric"));
      }
    } catch {
      setRemoveError(t("settings.mindmapShareMembers.inviteErrorNetwork"));
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleOpenMemberDialog = (member: MemberRow) => {
    setTransferError(null);
    setMemberDialog(member);
  };

  const handleTransferProject = async () => {
    if (!memberDialog || !project || !isOwner) return;
    if (memberDialog.role !== "editor") {
      setTransferError(t("settings.mindmapShareMembers.transfer.onlyEditor"));
      return;
    }
    if (transferConfirmValue.trim() !== project.title.trim()) {
      setTransferError(t("settings.mindmapShareMembers.transfer.confirmMismatch"));
      return;
    }

    setTransferError(null);
    setTransferLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetUserId: memberDialog.userId,
          confirmProjectTitle: transferConfirmValue.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTransferError(
          (data.message as string) ||
            (data.error as string) ||
            t("settings.mindmapShareMembers.transfer.errorGeneric")
        );
        return;
      }

      setProjectOwnerLocally(projectId, memberDialog.userId);
      setTransferSuccess(t("settings.mindmapShareMembers.transfer.success"));
      setTransferModalOpen(false);
      setMemberDialog(null);
      setTransferConfirmValue("");
      await fetchMembers();
      await loadFromSupabase();
      await refreshQuotaStatus(projectId);
    } catch {
      setTransferError(t("settings.mindmapShareMembers.transfer.errorNetwork"));
    } finally {
      setTransferLoading(false);
    }
  };

  const generateShareToken = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    }
    return Math.random().toString(36).slice(2, 14);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch {
      alert(t("settings.messages.copyFailed", "Could not copy the link."));
    }
  };

  // Função para exportar configurações
  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mindmap-config-${project?.title || 'export'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Função para importar configurações
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string);
        setSettings(importedSettings);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch (error) {
        alert(t("settings.messages.importFailed", "Failed to import settings. Check if the file is valid."));
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
    
    // Limpar o input para permitir reimportar o mesmo arquivo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Sincronizar com mudanças do projeto (quando recarrega a página)
  useEffect(() => {
    if (project?.mindMapSettings) {
      setSettings(project.mindMapSettings);
    }
  }, [project]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareBaseUrl(window.location.origin);
    }
  }, []);

  // Inicializar levels default apenas se o projeto não tiver configurações salvas
  useEffect(() => {
    if (project && (!project.mindMapSettings?.levels || project.mindMapSettings.levels.length === 0)) {
      const defaultLevels: LevelConfig[] = [
        { 
          level: 0, 
          name: t("settings.levels.defaultLevel0", "Sections (Level 0)"),
          node: { 
            color: MINDMAP_CONFIG.sections.node.color, 
            textColor: MINDMAP_CONFIG.sections.node.textColor,
            hasChildrenBorder: MINDMAP_CONFIG.sections.node.hasChildrenBorder
          }, 
          edge: { 
            strokeWidth: MINDMAP_CONFIG.sections.edge.strokeWidth, 
            color: MINDMAP_CONFIG.sections.edge.color, 
            animated: MINDMAP_CONFIG.sections.edge.animated, 
            dashed: MINDMAP_CONFIG.sections.edge.dashed, 
            dashPattern: MINDMAP_CONFIG.sections.edge.dashPattern 
          } 
        },
        { 
          level: 1, 
          name: t("settings.levels.defaultLevel1", "Subsections (Level 1)"),
          node: { 
            color: MINDMAP_CONFIG.subsections.node.color, 
            textColor: MINDMAP_CONFIG.subsections.node.textColor,
            hasChildrenBorder: MINDMAP_CONFIG.subsections.node.hasChildrenBorder
          }, 
          edge: { 
            strokeWidth: MINDMAP_CONFIG.subsections.edge.strokeWidth, 
            color: MINDMAP_CONFIG.subsections.edge.color, 
            animated: MINDMAP_CONFIG.subsections.edge.animated, 
            dashed: MINDMAP_CONFIG.subsections.edge.dashed, 
            dashPattern: MINDMAP_CONFIG.subsections.edge.dashPattern 
          } 
        },
        { 
          level: 2, 
          name: t("settings.levels.defaultLevel2", "Sub-subsections (Level 2+)"),
          node: { 
            color: MINDMAP_CONFIG.deepSubsections.node.color, 
            textColor: MINDMAP_CONFIG.deepSubsections.node.textColor,
            hasChildrenBorder: MINDMAP_CONFIG.deepSubsections.node.hasChildrenBorder
          }, 
          edge: { 
            strokeWidth: MINDMAP_CONFIG.deepSubsections.edge.strokeWidth, 
            color: MINDMAP_CONFIG.deepSubsections.edge.color, 
            animated: MINDMAP_CONFIG.deepSubsections.edge.animated, 
            dashed: MINDMAP_CONFIG.deepSubsections.edge.dashed, 
            dashPattern: MINDMAP_CONFIG.deepSubsections.edge.dashPattern 
          } 
        }
      ];
      setSettings((prev) => ({ ...prev, levels: defaultLevels }));
    }
  }, [project, t]);

  const handleAddLevel = () => {
    const currentLevels = settings.levels || [];
    const nextLevel = currentLevels.length;
    const newLevel: LevelConfig = { 
      level: nextLevel, 
      name: `${t("settings.levels.levelPrefix", "Level")} ${nextLevel}`,
      node: { 
        color: "#a855f7", 
        textColor: "#ffffff",
        hasChildrenBorder: {
          enabled: false,
          width: 2,
          color: "#fbbf24",
          dashed: false,
          dashPattern: "5 5"
        }
      }, 
      edge: { 
        strokeWidth: 0.5, 
        color: "#94a3b8", 
        animated: false, 
        dashed: false, 
        dashPattern: "" 
      } 
    };
    setSettings({ ...settings, levels: [...currentLevels, newLevel] });
  };

  const handleRemoveLevel = (level: number) => {
    const currentLevels = settings.levels || [];
    if (currentLevels.length <= 1) { alert(t("settings.messages.minOneLevel", "You need at least 1 level!")); return; }
    const filtered = currentLevels.filter((l) => l.level !== level);
    const reindexed = filtered.map((l, index) => ({ ...l, level: index }));
    setSettings({ ...settings, levels: reindexed });
  };

  const handleLevelChange = (level: number, path: string, value: any) => {
    const currentLevels = settings.levels || [];
    const updated = currentLevels.map((l) => {
      if (l.level !== level) return l;
      const clone = { ...l };
      const keys = path.split(".");
      let obj: any = clone;
      for (let i = 0; i < keys.length - 1; i++) { obj[keys[i]] = obj[keys[i]] || {}; obj = obj[keys[i]]; }
      obj[keys[keys.length - 1]] = value;
      return clone;
    });
    
    // Atualizar settings.levels
    const newSettings = { ...settings, levels: updated };
    
    // TAMBÉM atualizar formato flat (sections, subsections, deepSubsections) para compatibilidade
    updated.forEach((lvl) => {
      let targetKey: string;
      if (lvl.level === 0) {
        targetKey = 'sections';
      } else if (lvl.level === 1) {
        targetKey = 'subsections';
      } else {
        targetKey = 'deepSubsections';
      }
      
      // Garantir que a estrutura existe
      if (!(newSettings as any)[targetKey]) {
        (newSettings as any)[targetKey] = { node: {}, edge: {} };
      }
      if (!(newSettings as any)[targetKey].node) (newSettings as any)[targetKey].node = {};
      if (!(newSettings as any)[targetKey].edge) (newSettings as any)[targetKey].edge = {};
      
      // Copiar valores do level para o formato flat
      if (lvl.node) {
        Object.assign((newSettings as any)[targetKey].node, lvl.node);
      }
      if (lvl.edge) {
        Object.assign((newSettings as any)[targetKey].edge, lvl.edge);
      }
    });
    
    setSettings(newSettings);
  };

  const toggleLevelExpanded = (level: number) => {
    setExpandedLevels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  };

  const getValue = (path: string) => {
    const keys = path.split(".");
    let value: any = settings;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) {
        let defaultValue: any = MINDMAP_CONFIG;
        for (const k of keys) { defaultValue = defaultValue?.[k]; }
        return defaultValue;
      }
    }
    return value;
  };

  const setValue = (path: string, value: any) => {
    const keys = path.split(".");
    const newSettings = { ...settings };
    let obj: any = newSettings;
    for (let i = 0; i < keys.length - 1; i++) { obj[keys[i]] = obj[keys[i]] || {}; obj = obj[keys[i]]; }
    obj[keys[keys.length - 1]] = value;
    setSettings(newSettings);
  };

  // Helper para atualizar highlight em project E sections ao mesmo tempo
  const setHighlightValue = (property: string, value: any) => {
    setSettings((prev) => {
      const newSettings = { ...prev } as any;
      
      // Garantir que as estruturas existem
      if (!newSettings.project) newSettings.project = {};
      if (!newSettings.project.edge) newSettings.project.edge = {};
      if (!newSettings.project.edge.highlighted) newSettings.project.edge.highlighted = {};
      
      if (!newSettings.sections) newSettings.sections = {};
      if (!newSettings.sections.edge) newSettings.sections.edge = {};
      if (!newSettings.sections.edge.highlighted) newSettings.sections.edge.highlighted = {};
      
      if (!newSettings.subsections) newSettings.subsections = {};
      if (!newSettings.subsections.edge) newSettings.subsections.edge = {};
      if (!newSettings.subsections.edge.highlighted) newSettings.subsections.edge.highlighted = {};
      
      if (!newSettings.deepSubsections) newSettings.deepSubsections = {};
      if (!newSettings.deepSubsections.edge) newSettings.deepSubsections.edge = {};
      if (!newSettings.deepSubsections.edge.highlighted) newSettings.deepSubsections.edge.highlighted = {};
      
      // Atualizar todas as configurações
      newSettings.project.edge.highlighted[property] = value;
      newSettings.sections.edge.highlighted[property] = value;
      newSettings.subsections.edge.highlighted[property] = value;
      newSettings.deepSubsections.edge.highlighted[property] = value;
      
      return newSettings;
    });
  };

  const handleSave = () => {
    updateProjectMindMapSettingsOnly(projectId, settings);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    // Envia só mindmap_settings para o Supabase (sem custo, sem usar sync de seções)
    void pushProjectMindMapSettings(projectId, settings);
  };
  const handleReset = () => {
    if (confirm(t("settings.messages.resetAllConfirm", "Reset all settings?"))) {
      updateProjectMindMapSettingsOnly(projectId, {});
      setSettings({});
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      void pushProjectMindMapSettings(projectId, {});
    }
  };

  const handleDeleteProject = () => {
    if (!project || deleteConfirmValue.trim() !== project.title.trim()) return;
    if (deleteBackupChecked) {
      try { downloadProjectBackup(project); } catch (e) { console.error(e); }
    }
    removeProject(projectId);
    setDeleteModalOpen(false);
    setDeleteConfirmValue("");
    setDeleteBackupChecked(false);
    router.push("/");
  };

  const deleteConfirmMatch = Boolean(project && deleteConfirmValue.trim() === project.title.trim());
  const transferConfirmMatch = Boolean(project && transferConfirmValue.trim() === project.title.trim());

  if (!project) return <div>{t("settings.messages.projectNotFound", "Project not found")}</div>;
  const levels = settings.levels || [];
  const shareToken = (getValue("sharing.shareToken") || "") as string;
  const isPublicShareEnabled = Boolean(getValue("sharing.isPublic"));
  const publicShareUrl = shareToken ? `${shareBaseUrl}/s/${encodeURIComponent(shareToken)}` : "";
  const selectedDocumentTheme = normalizeDocumentTheme(getValue("documentView.theme"));

  const setDocumentTheme = (theme: DocumentThemeId) => {
    setValue("documentView.theme", theme);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-8">
          <button onClick={() => router.push(`/projects/${projectId}`)} className="text-gray-400 hover:text-white mb-4">← {t("settings.actions.backToProject", "Back")}</button>
          <h1 className="text-3xl font-bold mb-2">⚙️ {t("settings.pageTitle")}</h1>
          <p className="text-gray-400">{project.title}</p>
        </div>
        {showSuccess && <div className="mb-6 bg-green-600 text-white px-4 py-3 rounded-lg">✓ {t("settings.messages.savedSuccess", "Settings saved successfully!")}</div>}
        
        {/* Input file oculto para importar */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        
        <div className="flex gap-3 mb-8">
          <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold">💾 {t("settings.actions.save", "Save")}</button>
          <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold">🔄 {t("settings.actions.reset", "Reset")}</button>
          <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold">📥 {t("settings.actions.export", "Export")}</button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold">📤 {t("settings.actions.import", "Import")}</button>
        </div>
        <div className="space-y-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-2">{t("settings.documentThemes.title")}</h2>
            <p className="text-sm text-gray-400 mb-4">{t("settings.documentThemes.description")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              {DOCUMENT_THEME_OPTIONS.map((theme) => {
                const isActive = selectedDocumentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setDocumentTheme(theme.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isActive
                        ? "border-blue-400 bg-blue-900/30 ring-2 ring-blue-500/40"
                        : "border-gray-700 bg-gray-900/40 hover:border-gray-500 hover:bg-gray-700/40"
                    }`}
                    aria-pressed={isActive}
                  >
                    <div className={`mb-2 h-1.5 rounded-full bg-gradient-to-r ${DOCUMENT_THEME_PREVIEW_BAR[theme.id]}`} />
                    <div className="text-sm font-semibold text-white">{t(theme.labelKey)}</div>
                    <div className="mt-1 text-xs text-gray-400">{t(theme.descriptionKey)}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">{t("settings.documentThemes.hint")}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">📏 {t("settings.settingsClient.nodeSizes")}</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.basePx")}</label><input type="number" value={getValue("nodeSize.baseSize")} onChange={(e) => setValue("nodeSize.baseSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.reduction")}</label><input type="number" step="0.1" value={getValue("nodeSize.reductionFactor")} onChange={(e) => setValue("nodeSize.reductionFactor", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.minimumPx")}</label><input type="number" value={getValue("nodeSize.minSize")} onChange={(e) => setValue("nodeSize.minSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
            </div>
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">📐 {t("settings.settingsClient.spacing")}</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.sunMarginPx")}</label><input type="number" value={getValue("spacing.projectMargin") || 80} onChange={(e) => setValue("spacing.projectMargin", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.levelMarginPx")}</label><input type="number" value={getValue("spacing.levelMargin") || 60} onChange={(e) => setValue("spacing.levelMargin", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              </div>
              <p className="text-xs text-gray-500">{t("settings.settingsClient.sunMarginHelp")}</p>
            </div>
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">🔤 {t("settings.settingsClient.font")}</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.baseSizePx")}</label><input type="number" value={getValue("nodeSize.baseFontSize") || 14} onChange={(e) => setValue("nodeSize.baseFontSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.minimumSizePx")}</label><input type="number" value={getValue("nodeSize.minFontSize") || 8} onChange={(e) => setValue("nodeSize.minFontSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.fontFamily")}</label>
                  <select value={getValue("nodeSize.fontFamily") || "system-ui"} onChange={(e) => setValue("nodeSize.fontFamily", e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2">
                    <option value="system-ui">{t("settings.settingsClient.systemUiDefault")}</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Courier New', monospace">Courier New (Mono)</option>
                    <option value="Georgia, serif">Georgia (Serif)</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                    <option value="Verdana, sans-serif">Verdana</option>
                    <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
                    <option value="Impact, fantasy">Impact</option>
                    <option value="'Lucida Console', monospace">Lucida Console</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.fontWeight")}</label>
                  <select value={getValue("nodeSize.fontWeight") || "bold"} onChange={(e) => setValue("nodeSize.fontWeight", e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2">
                    <option value="100">100 - Thin</option>
                    <option value="200">200 - Extra Light</option>
                    <option value="300">300 - Light</option>
                    <option value="normal">400 - Normal</option>
                    <option value="500">500 - Medium</option>
                    <option value="600">600 - Semi Bold</option>
                    <option value="bold">700 - Bold</option>
                    <option value="800">800 - Extra Bold</option>
                    <option value="900">900 - Black</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500">{t("settings.settingsClient.baseFontSizeHelp")}</p>
            </div>
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">🧾 {t("settings.settingsClient.sidebarPanel")}</h3>
              <div className="grid grid-cols-1 gap-4 mb-2">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.contentScale")}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="1.2"
                    value={getValue("sidebar.contentScale") ?? 0.85}
                    onChange={(e) => setValue("sidebar.contentScale", Number(e.target.value))}
                    className="w-full bg-gray-700 rounded px-3 py-2"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">{t("settings.settingsClient.contentScaleHelp")}</p>
            </div>
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">🌐 {t("settings.settingsClient.publicSharing")}</h3>
              {isOwner ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2">
                      <ToggleSwitch
                        checked={isPublicShareEnabled}
                        onChange={(next) => setValue("sharing.isPublic", next)}
                        ariaLabel={t("settings.settingsClient.allowPublicViewing")}
                      />
                      <span className="text-sm text-gray-300">{t("settings.settingsClient.allowPublicViewing")}</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 mb-3">
                    <input
                      type="text"
                      readOnly
                      value={shareToken}
                      placeholder={t("settings.settingsClient.shareToken")}
                      className="w-full bg-gray-700 rounded px-3 py-2 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setValue("sharing.shareToken", generateShareToken())}
                      className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded font-semibold"
                    >
                      {t("settings.settingsClient.generateToken")}
                    </button>
                  </div>

                  {isPublicShareEnabled && shareToken && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <input readOnly value={publicShareUrl} className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm" />
                        <button type="button" onClick={() => void copyToClipboard(publicShareUrl)} className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-semibold">{t("settings.settingsClient.copy")}</button>
                      </div>
                      <p className="text-xs text-gray-500">{t("settings.settingsClient.publicLinkHelp")}</p>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    {t("settings.settingsClient.publicShareSaveHelp")}
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">{t("settings.mindmapShareMembers.publicSharingOwnerOnly")}</p>
                  {shareToken && isPublicShareEnabled && (
                    <>
                      <p className="text-sm text-gray-300 mt-2">{t("settings.mindmapShareMembers.publicLinkLabel")}</p>
                      <div className="flex gap-2 items-center">
                        <input readOnly value={publicShareUrl} className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm" />
                        <button type="button" onClick={() => void copyToClipboard(publicShareUrl)} className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-semibold">{t("settings.settingsClient.copy")}</button>
                      </div>
                      <p className="text-xs text-gray-500">{t("settings.mindmapShareMembers.publicLinkMemberHint")}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">👥 {t("settings.mindmapShareMembers.title")}</h3>
              {isOwner && (
                <>
                  <p className="text-sm text-gray-400 mb-3">
                    {t("settings.mindmapShareMembers.description")}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
                      placeholder={t("settings.mindmapShareMembers.invitePlaceholder")}
                      className="flex-1 min-w-[200px] bg-gray-700 rounded px-3 py-2 text-sm"
                      disabled={inviteLoading}
                    />
                    <button
                      type="button"
                      onClick={() => void handleInvite()}
                      disabled={inviteLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded font-semibold text-sm"
                    >
                      {inviteLoading ? t("settings.mindmapShareMembers.sending") : t("settings.mindmapShareMembers.addButton")}
                    </button>
                  </div>
                  {inviteError && <p className="text-sm text-red-400 mb-2">{inviteError}</p>}
                  {removeError && <p className="text-sm text-red-400 mb-2">{removeError}</p>}
                  {transferError && <p className="text-sm text-red-400 mb-2">{transferError}</p>}
                  {transferSuccess && <p className="text-sm text-green-400 mb-2">{transferSuccess}</p>}
                </>
              )}
              {!isOwner && <p className="text-sm text-gray-400 mb-3">{t("settings.mindmapShareMembers.membersListOnly")}</p>}
              {membersLoading ? (
                <p className="text-sm text-gray-500">{t("settings.mindmapShareMembers.loadingMembers")}</p>
              ) : members.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {members.map((m) => (
                    <li key={m.userId} className="flex items-center gap-2 text-gray-300 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenMemberDialog(m)}
                        className="font-medium hover:text-white underline-offset-2 hover:underline"
                      >
                        {m.displayName || m.email || m.userId}
                      </button>
                      {m.email && m.displayName && <span className="text-gray-500">({m.email})</span>}
                      <span className="px-2 py-0.5 rounded bg-gray-600 text-xs">{m.role}</span>
                      {isOwner && m.role === "editor" && (
                        <button
                          type="button"
                          onClick={() => handleOpenMemberDialog(m)}
                          className="text-indigo-300 hover:text-indigo-200 text-xs font-medium"
                        >
                          {t("settings.mindmapShareMembers.transfer.openAction")}
                        </button>
                      )}
                      {isOwner && m.role !== "owner" && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveMember(m.userId)}
                          disabled={removingUserId === m.userId}
                          className="ml-auto text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
                        >
                          {removingUserId === m.userId ? t("settings.mindmapShareMembers.removing") : t("settings.mindmapShareMembers.removeButton")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">{t("settings.mindmapShareMembers.noMembers")}</p>
              )}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🎯 {t("settings.settingsClient.centralProject")}</h2>
            <h3 className="text-lg font-semibold mb-3 text-gray-300">{t("settings.settingsClient.nodeCircle")}</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.sizePx")}</label><input type="number" value={getValue("project.node.size")} onChange={(e) => setValue("project.node.size", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.gradientStart")}</label><div className="flex gap-2"><input type="color" value={getValue("project.node.colors.gradient.from")} onChange={(e) => setValue("project.node.colors.gradient.from", e.target.value)} className="w-16 h-10 rounded" /><input type="text" value={getValue("project.node.colors.gradient.from")} onChange={(e) => setValue("project.node.colors.gradient.from", e.target.value)} className="flex-1 bg-gray-700 rounded px-3 py-2 font-mono text-sm" /></div></div>
              <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.gradientEnd")}</label><div className="flex gap-2"><input type="color" value={getValue("project.node.colors.gradient.to")} onChange={(e) => setValue("project.node.colors.gradient.to", e.target.value)} className="w-16 h-10 rounded" /><input type="text" value={getValue("project.node.colors.gradient.to")} onChange={(e) => setValue("project.node.colors.gradient.to", e.target.value)} className="flex-1 bg-gray-700 rounded px-3 py-2 font-mono text-sm" /></div></div>
            </div>
            
            <h3 className="text-lg font-semibold mb-3 text-gray-300">{t("settings.settingsClient.connectionsLines")}</h3>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.lineColor")}</label>
                <div className="flex gap-2">
                  <input type="color" value={getValue("project.edge.color")} onChange={(e) => setValue("project.edge.color", e.target.value)} className="w-16 h-10 rounded" />
                  <input type="text" value={getValue("project.edge.color")} onChange={(e) => setValue("project.edge.color", e.target.value)} className="flex-1 bg-gray-700 rounded px-3 py-2 font-mono text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.thicknessPx")}</label>
                <input type="number" step="0.5" min="0.5" max="10" value={getValue("project.edge.strokeWidth")} onChange={(e) => setValue("project.edge.strokeWidth", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.dashed")}</label>
                <ToggleSwitch
                  checked={Boolean(getValue("project.edge.dashed"))}
                  onChange={(next) => setValue("project.edge.dashed", next)}
                  ariaLabel={t("settings.settingsClient.dashed")}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.animated")}</label>
                <ToggleSwitch
                  checked={Boolean(getValue("project.edge.animated"))}
                  onChange={(next) => setValue("project.edge.animated", next)}
                  ariaLabel={t("settings.settingsClient.animated")}
                />
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">🎨 {t("settings.levels.title", "Hierarchy Levels")}</h2>
              <button onClick={handleAddLevel} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold">+ {t("settings.levels.add", "Add Level")}</button>
            </div>
            <div className="space-y-4">
              {levels.map((lvl) => {
                const isExpanded = expandedLevels.has(lvl.level);
                return (
                  <div key={lvl.level} className="bg-gray-700 rounded-lg overflow-hidden">
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-600 transition-colors"
                      onClick={() => toggleLevelExpanded(lvl.level)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-lg">{isExpanded ? '▼' : '►'}</span>
                        <span className="text-lg font-bold">{lvl.name}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveLevel(lvl.level); }} 
                        className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    {isExpanded && (
                      <div className="p-4 border-t border-gray-600">
                        <div className="mb-3">
                          <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.levelName")}</label>
                          <input 
                            type="text" 
                            value={lvl.name} 
                            onChange={(e) => handleLevelChange(lvl.level, "name", e.target.value)} 
                            className="w-full bg-gray-600 rounded px-3 py-2"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-300">{t("settings.settingsClient.node")}</h3>
                      <div><label className="block text-sm text-gray-400 mb-1">{t("settings.settingsClient.color")}</label><div className="flex gap-2"><input type="color" value={lvl.node.color || "#a855f7"} onChange={(e) => handleLevelChange(lvl.level, "node.color", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={lvl.node.color || "#a855f7"} onChange={(e) => handleLevelChange(lvl.level, "node.color", e.target.value)} className="flex-1 bg-gray-600 rounded px-2 py-1 font-mono text-sm" /></div></div>
                      <div><label className="block text-sm text-gray-400 mb-1">{t("settings.settingsClient.text")}</label><div className="flex gap-2"><input type="color" value={lvl.node.textColor || "#ffffff"} onChange={(e) => handleLevelChange(lvl.level, "node.textColor", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={lvl.node.textColor || "#ffffff"} onChange={(e) => handleLevelChange(lvl.level, "node.textColor", e.target.value)} className="flex-1 bg-gray-600 rounded px-2 py-1 font-mono text-sm" /></div></div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-300">{t("settings.settingsClient.connection")}</h3>
                      <div><label className="block text-sm text-gray-400 mb-1">{t("settings.settingsClient.color")}</label><div className="flex gap-2"><input type="color" value={lvl.edge.color || "#94a3b8"} onChange={(e) => handleLevelChange(lvl.level, "edge.color", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={lvl.edge.color || "#94a3b8"} onChange={(e) => handleLevelChange(lvl.level, "edge.color", e.target.value)} className="flex-1 bg-gray-600 rounded px-2 py-1 font-mono text-sm" /></div></div>
                      <div><label className="block text-sm text-gray-400 mb-1">{t("settings.settingsClient.thickness")}</label><input type="number" step="0.1" value={lvl.edge.strokeWidth || 0.5} onChange={(e) => handleLevelChange(lvl.level, "edge.strokeWidth", Number(e.target.value))} className="w-full bg-gray-600 rounded px-2 py-1" /></div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2"><ToggleSwitch checked={lvl.edge.animated || false} onChange={(next) => handleLevelChange(lvl.level, "edge.animated", next)} ariaLabel={t("settings.settingsClient.animated2")} /><span className="text-sm">{t("settings.settingsClient.animated2")}</span></label>
                        <label className="flex items-center gap-2"><ToggleSwitch checked={lvl.edge.dashed || false} onChange={(next) => handleLevelChange(lvl.level, "edge.dashed", next)} ariaLabel={t("settings.settingsClient.dashed2")} /><span className="text-sm">{t("settings.settingsClient.dashed2")}</span></label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Borda para Nós com Filhos */}
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold text-gray-300">🔲 {t("settings.settingsClient.childNodesBorder")}</h3>
                      <label className="flex items-center gap-2">
                        <ToggleSwitch
                          checked={lvl.node.hasChildrenBorder?.enabled || false}
                          onChange={(next) => handleLevelChange(lvl.level, "node.hasChildrenBorder.enabled", next)}
                          ariaLabel={t("settings.settingsClient.enable")}
                        />
                        <span className="text-sm text-gray-400">{t("settings.settingsClient.enable")}</span>
                      </label>
                    </div>
                    
                    {(lvl.node.hasChildrenBorder?.enabled) && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">{t("settings.settingsClient.color")}</label>
                          <div className="flex gap-2">
                            <input 
                              type="color" 
                              value={lvl.node.hasChildrenBorder?.color || "#fbbf24"} 
                              onChange={(e) => handleLevelChange(lvl.level, "node.hasChildrenBorder.color", e.target.value)} 
                              className="w-12 h-10 rounded" 
                            />
                            <input 
                              type="text" 
                              value={lvl.node.hasChildrenBorder?.color || "#fbbf24"} 
                              onChange={(e) => handleLevelChange(lvl.level, "node.hasChildrenBorder.color", e.target.value)} 
                              className="flex-1 bg-gray-600 rounded px-2 py-1 font-mono text-sm" 
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">{t("settings.settingsClient.baseWidth")}</label>
                          <input 
                            type="number" 
                            step="0.5" 
                            value={lvl.node.hasChildrenBorder?.width || 2} 
                            onChange={(e) => handleLevelChange(lvl.level, "node.hasChildrenBorder.width", Number(e.target.value))} 
                            className="w-full bg-gray-600 rounded px-2 py-1" 
                          />
                          <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.proportionalToSize")}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="flex items-center gap-2">
                            <ToggleSwitch
                              checked={lvl.node.hasChildrenBorder?.dashed || false}
                              onChange={(next) => handleLevelChange(lvl.level, "node.hasChildrenBorder.dashed", next)}
                              ariaLabel={t("settings.settingsClient.dashed3")}
                            />
                            <span className="text-sm text-gray-400">{t("settings.settingsClient.dashed3")}</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">✨ {t("settings.settingsClient.highlightSelection")}</h2>
            <div className="grid grid-cols-4 gap-4 mb-3">
              <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.color")}</label><div className="flex gap-2"><input type="color" value={getValue("sections.edge.highlighted.color")} onChange={(e) => setHighlightValue("color", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={getValue("sections.edge.highlighted.color")} onChange={(e) => setHighlightValue("color", e.target.value)} className="flex-1 bg-gray-700 rounded px-2 py-1 font-mono text-sm" /></div></div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.baseThickness")}</label>
                <input type="number" step="0.1" value={getValue("sections.edge.highlighted.strokeWidth")} onChange={(e) => setHighlightValue("strokeWidth", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.adjustedByZoom")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.baseDashPattern")}</label>
                <input type="number" step="0.5" value={getValue("sections.edge.highlighted.dashPattern")} onChange={(e) => setHighlightValue("dashPattern", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.ex55pxDashes")}</p>
              </div>
              <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.animated2")}</label><ToggleSwitch checked={Boolean(getValue("sections.edge.highlighted.animated"))} onChange={(next) => setHighlightValue("animated", next)} ariaLabel={t("settings.settingsClient.animated2")} /></div>
            </div>
            <p className="text-xs text-gray-500">{t("settings.settingsClient.highlightLineHelp")}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🔍 {t("settings.settingsClient.zoom")}</h2>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.minimumZoom")}</label>
                <input type="number" step="0.01" min="0.01" max="1" value={getValue("zoom.minZoom")} onChange={(e) => setValue("zoom.minZoom", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.ex0011")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.fitviewMaxZoom")}</label>
                <input type="number" step="0.5" min="0.5" max="10" value={getValue("zoom.fitViewMaxZoom")} onChange={(e) => setValue("zoom.fitViewMaxZoom", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.limitOnLoad")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.fitviewPadding")}</label>
                <input type="number" step="0.05" min="0" max="0.5" value={getValue("zoom.fitViewPadding") || 0.2} onChange={(e) => setValue("zoom.fitViewPadding", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.ex0220")}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              <strong>{t("settings.settingsClient.minimumZoom")}:</strong> {t("settings.settingsClient.minZoomHelp")}
              <br />
              <strong>{t("settings.settingsClient.fitviewMaxZoom")}:</strong> {t("settings.settingsClient.fitViewMaxZoomHelp")}
              <br />
              <strong>{t("settings.settingsClient.fitviewPadding")}:</strong> {t("settings.settingsClient.fitViewPaddingHelp")}
            </p>
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">🎯 {t("settings.settingsClient.zoomOnClick")}</h3>
              <div className="grid grid-cols-1 gap-4">
                <div><label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.targetSizeOnScreenPx")}</label><input type="number" value={getValue("zoom.onClickTargetSize") || 200} onChange={(e) => setValue("zoom.onClickTargetSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{t("settings.settingsClient.zoomOnClickHelp")}</p>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🎬 {t("settings.settingsClient.connectionAnimation")}</h2>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.speedSeconds")}</label>
                <input type="number" step="0.5" min="0.5" max="10" value={getValue("animation.speed") || 2} onChange={(e) => setValue("animation.speed", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.lowerFaster")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.movementDistancePx")}</label>
                <input type="number" step="10" min="50" max="500" value={getValue("animation.distance") || 500} onChange={(e) => setValue("animation.distance", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.howFarDashesMove")}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">{t("settings.settingsClient.connectionAnimationHelp")}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🌫️ {t("settings.settingsClient.fadeEffect")}</h2>
            <p className="text-sm text-gray-400 mb-4">{t("settings.settingsClient.fadeEffectHelp")}</p>
            <div className="mb-3">
              <label className="flex items-center">
                <ToggleSwitch
                  checked={getValue("fadeEffect.enabled") ?? true}
                  onChange={(next) => setValue("fadeEffect.enabled", next)}
                  ariaLabel={t("settings.settingsClient.enableFadeEffect")}
                />
                <span className="text-sm">{t("settings.settingsClient.enableFadeEffect")}</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.opacity")}</label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="1" 
                  value={getValue("fadeEffect.opacity") ?? 0.3} 
                  onChange={(e) => setValue("fadeEffect.opacity", Number(e.target.value))} 
                  className="w-full bg-gray-700 rounded px-3 py-2" 
                  disabled={!getValue("fadeEffect.enabled")}
                />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.k0Invisible1Normal")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.grayscale")}</label>
                <input 
                  type="number" 
                  step="5" 
                  min="0" 
                  max="100" 
                  value={getValue("fadeEffect.grayscale") ?? 50} 
                  onChange={(e) => setValue("fadeEffect.grayscale", Number(e.target.value))} 
                  className="w-full bg-gray-700 rounded px-3 py-2"
                  disabled={!getValue("fadeEffect.enabled")}
                />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.k0Colored100Gray")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.blurPx")}</label>
                <input 
                  type="number" 
                  step="0.5" 
                  min="0" 
                  max="10" 
                  value={getValue("fadeEffect.blur") ?? 1} 
                  onChange={(e) => setValue("fadeEffect.blur", Number(e.target.value))} 
                  className="w-full bg-gray-700 rounded px-3 py-2"
                  disabled={!getValue("fadeEffect.enabled")}
                />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.k0Sharp10VeryBlurry")}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">{t("settings.settingsClient.fadeEffectAdvancedHelp")}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🔗 {t("settings.settingsClient.crossReferences")}</h2>
            <p className="text-sm text-gray-400 mb-4">{t("settings.settingsClient.crossReferencesHelp")}</p>
            <div className="mb-3">
              <label className="flex items-center">
                <ToggleSwitch
                  checked={getValue("references.enabled") ?? true}
                  onChange={(next) => setValue("references.enabled", next)}
                  ariaLabel={t("settings.settingsClient.showCrossReferences")}
                />
                <span className="text-sm">{t("settings.settingsClient.showCrossReferences")}</span>
              </label>
            </div>
            <h3 className="text-sm font-semibold mb-3 text-gray-300">{t("settings.settingsClient.connectionStyle")}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.lineColor")}</label>
                <input 
                  type="color" 
                  value={getValue("references.edgeColor") || '#3b82f6'} 
                  onChange={(e) => setValue("references.edgeColor", e.target.value)} 
                  className="w-full h-10 bg-gray-700 rounded cursor-pointer"
                  disabled={!getValue("references.enabled")}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.thicknessPx")}</label>
                <input 
                  type="number" 
                  step="0.5" 
                  min="0.5" 
                  max="10" 
                  value={getValue("references.edgeWidth") ?? 2} 
                  onChange={(e) => setValue("references.edgeWidth", Number(e.target.value))} 
                  className="w-full bg-gray-700 rounded px-3 py-2"
                  disabled={!getValue("references.enabled")}
                />
              </div>
              <div>
                <label className="flex items-center">
                  <ToggleSwitch
                    checked={getValue("references.edgeAnimated") || false}
                    onChange={(next) => setValue("references.edgeAnimated", next)}
                    disabled={!getValue("references.enabled")}
                    ariaLabel={t("settings.settingsClient.animateLineMovement")}
                  />
                  <span className="text-sm">{t("settings.settingsClient.animateLineMovement")}</span>
                </label>
              </div>
              <div>
                <label className="flex items-center">
                  <ToggleSwitch
                    checked={getValue("references.edgeDashed") !== false}
                    onChange={(next) => setValue("references.edgeDashed", next)}
                    disabled={!getValue("references.enabled")}
                    ariaLabel={t("settings.settingsClient.dashedLine")}
                  />
                  <span className="text-sm">{t("settings.settingsClient.dashedLine")}</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.dashPattern")}</label>
                <input 
                  type="number" 
                  step="1" 
                  min="1" 
                  max="20" 
                  value={getValue("references.edgeDashPattern") ?? 5} 
                  onChange={(e) => setValue("references.edgeDashPattern", Number(e.target.value))} 
                  className="w-full bg-gray-700 rounded px-3 py-2"
                  disabled={!getValue("references.enabled") || (getValue("references.edgeDashed") === false && !getValue("references.edgeAnimated"))}
                />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.usedForDashAndAnimation")}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">💡 {t("settings.settingsClient.crossReferencesAnimationHelp")}</p>
            <h3 className="text-sm font-semibold mb-3 text-gray-300">{t("settings.settingsClient.connectionIcon")}</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="flex items-center">
                  <ToggleSwitch
                    checked={getValue("references.showIcon") ?? true}
                    onChange={(next) => setValue("references.showIcon", next)}
                    disabled={!getValue("references.enabled")}
                    ariaLabel={t("settings.settingsClient.showIconOnLine")}
                  />
                  <span className="text-sm">{t("settings.settingsClient.showIconOnLine")}</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.iconEmoji")}</label>
                <input 
                  type="text" 
                  maxLength={2}
                  value={getValue("references.icon") || '🔗'} 
                  onChange={(e) => setValue("references.icon", e.target.value)} 
                  className="w-full bg-gray-700 rounded px-3 py-2 text-center text-xl"
                  disabled={!getValue("references.enabled") || !getValue("references.showIcon")}
                  placeholder="🔗"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.iconSize")}</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="16" 
                  max="512" 
                  value={getValue("references.iconSize") ?? 32} 
                  onChange={(e) => setValue("references.iconSize", Number(e.target.value))} 
                  className="flex-1"
                  disabled={!getValue("references.enabled") || !getValue("references.showIcon")}
                />
                <span className="text-white w-16 text-center">{getValue("references.iconSize") ?? 32}px</span>
              </div>
            </div>
            <h3 className="text-sm font-semibold mb-3 text-gray-300">{t("settings.settingsClient.referencedNodeHighlight")}</h3>
            <div className="mb-3">
              <label className="flex items-center">
                <ToggleSwitch
                  checked={getValue("references.nodeHighlight.enabled") ?? true}
                  onChange={(next) => setValue("references.nodeHighlight.enabled", next)}
                  disabled={!getValue("references.enabled")}
                  ariaLabel={t("settings.settingsClient.highlightReferencedNodes")}
                />
                <span className="text-sm">{t("settings.settingsClient.highlightReferencedNodes")}</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.borderColor")}</label>
                <input 
                  type="color" 
                  value={getValue("references.nodeHighlight.borderColor") || '#3b82f6'} 
                  onChange={(e) => setValue("references.nodeHighlight.borderColor", e.target.value)} 
                  className="w-full h-10 bg-gray-700 rounded cursor-pointer"
                  disabled={!getValue("references.enabled") || !getValue("references.nodeHighlight.enabled")}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.borderThickness")}</label>
                <input 
                  type="number" 
                  step="0.5" 
                  min="1" 
                  max="10" 
                  value={getValue("references.nodeHighlight.borderWidth") ?? 3} 
                  onChange={(e) => setValue("references.nodeHighlight.borderWidth", Number(e.target.value))} 
                  className="w-full bg-gray-700 rounded px-3 py-2"
                  disabled={!getValue("references.enabled") || !getValue("references.nodeHighlight.enabled")}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">{t("settings.settingsClient.crossReferencesDetectionHelp")}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">⚙️ {t("settings.settingsClient.simulationPhysics")}</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.linkStrength")}</label>
                <input type="number" step="0.01" min="0" max="1" value={getValue("physics.simulation.linkStrength") ?? 1} onChange={(e) => setValue("physics.simulation.linkStrength", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.k01LowerFreer")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.collisionStrength")}</label>
                <input type="number" step="0.1" min="0" max="1" value={getValue("physics.simulation.collisionStrength") ?? 0.3} onChange={(e) => setValue("physics.simulation.collisionStrength", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.collisionStrengthHelp")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t("settings.settingsClient.iterations")}</label>
                <input type="number" step="10" min="10" max="500" value={getValue("physics.simulation.iterations") ?? 130} onChange={(e) => setValue("physics.simulation.iterations", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{t("settings.settingsClient.simulationPrecision")}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">{t("settings.settingsClient.simulationPhysicsHelp")}</p>
          </div>

          {isOwner && (
            <div className="bg-gray-800 rounded-lg p-6 border border-red-900/50">
              <h2 className="text-xl font-bold mb-2 text-red-400">🗑️ {t("settings.deleteProject.title")}</h2>
              <p className="text-sm text-gray-400 mb-4">{t("settings.deleteProject.description")}</p>
              <button
                type="button"
                onClick={() => { setDeleteModalOpen(true); setDeleteConfirmValue(""); }}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg font-semibold"
              >
                {t("settings.deleteProject.delete")}
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold">💾 {t("settings.actions.save", "Save")}</button>
          <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold">🔄 {t("settings.actions.reset", "Reset")}</button>
        </div>

        {memberDialog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onClick={() => {
              setMemberDialog(null);
              setTransferModalOpen(false);
              setTransferConfirmValue("");
            }}
          >
            <div
              className="bg-gray-800 rounded-xl border border-gray-600 shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">{t("settings.mindmapShareMembers.transfer.memberDetailsTitle")}</h3>
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-medium">{t("settings.mindmapShareMembers.transfer.memberNameLabel")}:</span>{" "}
                {memberDialog.displayName || memberDialog.email || memberDialog.userId}
              </p>
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-medium">{t("settings.mindmapShareMembers.transfer.memberEmailLabel")}:</span>{" "}
                {memberDialog.email || "—"}
              </p>
              <p className="text-sm text-gray-300 mb-4">
                <span className="font-medium">{t("settings.mindmapShareMembers.transfer.memberRoleLabel")}:</span>{" "}
                {memberDialog.role}
              </p>

              {isOwner && memberDialog.role === "editor" && (
                <button
                  type="button"
                  onClick={() => {
                    setTransferError(null);
                    setTransferModalOpen(true);
                  }}
                  className="w-full mb-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold"
                >
                  {t("settings.mindmapShareMembers.transfer.button")}
                </button>
              )}

              {isOwner && memberDialog.role !== "editor" && memberDialog.role !== "owner" && (
                <p className="text-sm text-yellow-300 mb-4">{t("settings.mindmapShareMembers.transfer.onlyEditor")}</p>
              )}

              {transferModalOpen && (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-300 mb-2">{t("settings.mindmapShareMembers.transfer.confirmDescription")}</p>
                  <p className="text-sm font-medium text-white mb-2">{project.title}</p>
                  <input
                    type="text"
                    value={transferConfirmValue}
                    onChange={(e) => {
                      setTransferConfirmValue(e.target.value);
                      setTransferError(null);
                    }}
                    placeholder={t("settings.mindmapShareMembers.transfer.confirmPlaceholder")}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 mb-3 text-white placeholder-gray-400"
                  />
                  <p className="text-xs text-gray-400 mb-3">{t("settings.mindmapShareMembers.transfer.confirmHint")}</p>
                  <button
                    type="button"
                    onClick={() => void handleTransferProject()}
                    disabled={!transferConfirmMatch || transferLoading}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold"
                  >
                    {transferLoading
                      ? t("settings.mindmapShareMembers.transfer.transferring")
                      : t("settings.mindmapShareMembers.transfer.confirmButton")}
                  </button>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMemberDialog(null);
                    setTransferModalOpen(false);
                    setTransferConfirmValue("");
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium"
                >
                  {t("settings.deleteProject.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setDeleteModalOpen(false)}>
            <div className="bg-gray-800 rounded-xl border border-gray-600 shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-red-400 mb-2">{t("settings.deleteProject.title")}</h3>
              <p className="text-sm text-gray-300 mb-4">{t("settings.deleteProject.description")}</p>
              <p className="text-sm font-medium text-white mb-2">{project.title}</p>
              <input
                type="text"
                value={deleteConfirmValue}
                onChange={(e) => setDeleteConfirmValue(e.target.value)}
                placeholder={t("settings.deleteProject.placeholder")}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 mb-4 text-white placeholder-gray-400"
                autoFocus
              />
              <label className="flex items-center gap-2 mb-6 text-sm text-gray-300">
                <ToggleSwitch
                  checked={deleteBackupChecked}
                  onChange={setDeleteBackupChecked}
                  ariaLabel={t("settings.deleteProject.backupCheckbox")}
                />
                {t("settings.deleteProject.backupCheckbox")}
              </label>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setDeleteModalOpen(false); setDeleteConfirmValue(""); }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium"
                >
                  {t("settings.deleteProject.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={!deleteConfirmMatch}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold"
                >
                  {t("settings.deleteProject.delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
