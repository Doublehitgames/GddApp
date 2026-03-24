"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore, LevelConfig, type Project } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { MINDMAP_CONFIG } from "@/lib/mindMapConfig";
import { useI18n } from "@/lib/i18n/provider";
import { pushProjectMindMapSettings } from "@/lib/supabase/projectSync";
import { ToggleSwitch } from "@/components/ToggleSwitch";

interface Props {
  projectId: string;
}

type MemberRow = { userId: string; email: string | null; displayName: string | null; role: string; createdAt: string };

export default function SettingsClient({ projectId }: Props) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { user } = useAuthStore();
  const isPt = locale === "pt-BR";
  const tr = useCallback((pt: string, en: string) => (isPt ? pt : en), [isPt]);
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
      alert(isPt ? "Não foi possível copiar o link." : "Could not copy the link.");
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
        alert(isPt ? 'Erro ao importar configurações. Verifique se o arquivo é válido.' : 'Failed to import settings. Check if the file is valid.');
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
          name: tr("Seções (Nível 0)", "Sections (Level 0)"), 
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
          name: tr("Subseções (Nível 1)", "Subsections (Level 1)"), 
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
          name: tr("Sub-subseções (Nível 2+)", "Sub-subsections (Level 2+)"), 
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
  }, [project, tr]);

  const handleAddLevel = () => {
    const currentLevels = settings.levels || [];
    const nextLevel = currentLevels.length;
    const newLevel: LevelConfig = { 
      level: nextLevel, 
      name: `${tr("Nível", "Level")} ${nextLevel}`, 
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
    if (currentLevels.length <= 1) { alert(isPt ? "Você precisa ter pelo menos 1 nível!" : "You need at least 1 level!"); return; }
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
    if (confirm(isPt ? "Resetar todas as configurações?" : "Reset all settings?")) {
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

  if (!project) return <div>{tr("Projeto não encontrado", "Project not found")}</div>;
  const levels = settings.levels || [];
  const shareToken = (getValue("sharing.shareToken") || "") as string;
  const isPublicShareEnabled = Boolean(getValue("sharing.isPublic"));
  const publicShareUrl = shareToken ? `${shareBaseUrl}/s/${encodeURIComponent(shareToken)}` : "";

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-8">
          <button onClick={() => router.push(`/projects/${projectId}`)} className="text-gray-400 hover:text-white mb-4">← {isPt ? "Voltar" : "Back"}</button>
          <h1 className="text-3xl font-bold mb-2">⚙️ {t("settings.pageTitle")}</h1>
          <p className="text-gray-400">{project.title}</p>
        </div>
        {showSuccess && <div className="mb-6 bg-green-600 text-white px-4 py-3 rounded-lg">✓ {isPt ? "Configurações salvas com sucesso!" : "Settings saved successfully!"}</div>}
        
        {/* Input file oculto para importar */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        
        <div className="flex gap-3 mb-8">
          <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold">💾 {isPt ? "Salvar" : "Save"}</button>
          <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold">🔄 {isPt ? "Resetar" : "Reset"}</button>
          <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold">📥 {isPt ? "Exportar" : "Export"}</button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold">📤 {isPt ? "Importar" : "Import"}</button>
        </div>
        <div className="space-y-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">📏 {tr("Tamanhos dos Nós", "Node Sizes")}</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><label className="block text-sm text-gray-400 mb-2">{tr("Base (px)", "Base (px)")}</label><input type="number" value={getValue("nodeSize.baseSize")} onChange={(e) => setValue("nodeSize.baseSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-400 mb-2">{tr("Redução", "Reduction")}</label><input type="number" step="0.1" value={getValue("nodeSize.reductionFactor")} onChange={(e) => setValue("nodeSize.reductionFactor", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-400 mb-2">{tr("Mínimo (px)", "Minimum (px)")}</label><input type="number" value={getValue("nodeSize.minSize")} onChange={(e) => setValue("nodeSize.minSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
            </div>
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">📐 {tr("Espaçamento", "Spacing")}</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm text-gray-400 mb-2">{tr("Margem do Sol (px)", "Sun Margin (px)")}</label><input type="number" value={getValue("spacing.projectMargin") || 80} onChange={(e) => setValue("spacing.projectMargin", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-400 mb-2">{tr("Margem entre Níveis (px)", "Level Margin (px)")}</label><input type="number" value={getValue("spacing.levelMargin") || 60} onChange={(e) => setValue("spacing.levelMargin", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              </div>
              <p className="text-xs text-gray-500">{tr("Margem do Sol = espaço entre o projeto central e as seções. Margem entre Níveis = espaço entre nós pai e filho.", "Sun Margin = spacing between the central project and sections. Level Margin = spacing between parent and child nodes.")}</p>
            </div>
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">🔤 {tr("Fonte", "Font")}</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm text-gray-400 mb-2">{tr("Tamanho Base (px)", "Base Size (px)")}</label><input type="number" value={getValue("nodeSize.baseFontSize") || 14} onChange={(e) => setValue("nodeSize.baseFontSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-400 mb-2">{tr("Tamanho Mínimo (px)", "Minimum Size (px)")}</label><input type="number" value={getValue("nodeSize.minFontSize") || 8} onChange={(e) => setValue("nodeSize.minFontSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{tr("Família da Fonte", "Font Family")}</label>
                  <select value={getValue("nodeSize.fontFamily") || "system-ui"} onChange={(e) => setValue("nodeSize.fontFamily", e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2">
                    <option value="system-ui">{tr("System UI (Padrão)", "System UI (Default)")}</option>
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
                  <label className="block text-sm text-gray-400 mb-2">{tr("Peso da Fonte", "Font Weight")}</label>
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
              <p className="text-xs text-gray-500">{tr("Tamanho Base = fonte quando a bolinha tem 100px. Escala proporcionalmente com o tamanho do nó. Ex: Base=14 + Nó=1000px = Fonte de 140px.", "Base Size = font when the node has 100px. It scales proportionally with node size. Ex: Base=14 + Node=1000px = 140px font.")}</p>
            </div>
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">🧾 {tr("Painel Lateral", "Sidebar Panel")}</h3>
              <div className="grid grid-cols-1 gap-4 mb-2">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{tr("Escala do Conteúdo", "Content Scale")}</label>
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
              <p className="text-xs text-gray-500">{tr("1.00 = 100% (normal). Exemplo: 0.85 reduz o texto para 85%. Botões não são afetados.", "1.00 = 100% (normal). Example: 0.85 reduces text to 85%. Buttons are not affected.")}</p>
            </div>
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">🌐 {tr("Compartilhamento Público", "Public Sharing")}</h3>
              {isOwner ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2">
                      <ToggleSwitch
                        checked={isPublicShareEnabled}
                        onChange={(next) => setValue("sharing.isPublic", next)}
                        ariaLabel={tr("Permitir visualização pública", "Allow public viewing")}
                      />
                      <span className="text-sm text-gray-300">{tr("Permitir visualização pública", "Allow public viewing")}</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 mb-3">
                    <input
                      type="text"
                      readOnly
                      value={shareToken}
                      placeholder={tr("Token de compartilhamento", "Share token")}
                      className="w-full bg-gray-700 rounded px-3 py-2 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setValue("sharing.shareToken", generateShareToken())}
                      className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded font-semibold"
                    >
                      {tr("Gerar Token", "Generate Token")}
                    </button>
                  </div>

                  {isPublicShareEnabled && shareToken && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <input readOnly value={publicShareUrl} className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm" />
                        <button type="button" onClick={() => void copyToClipboard(publicShareUrl)} className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-semibold">{tr("Copiar", "Copy")}</button>
                      </div>
                      <p className="text-xs text-gray-500">{tr("Este link único abre o Documento e permite alternar para o Mapa Mental.", "This single link opens the Document and allows switching to Mind Map.")}</p>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    {tr(
                      "Salve as configurações para publicar os links. Quem tiver o token poderá abrir documento e mapa mental.",
                      "Save settings to publish the link. Anyone with the token can open document and mind map."
                    )}
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
                        <button type="button" onClick={() => void copyToClipboard(publicShareUrl)} className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-semibold">{tr("Copiar", "Copy")}</button>
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
            <h2 className="text-xl font-bold mb-4">🎯 {tr("Projeto Central", "Central Project")}</h2>
            <h3 className="text-lg font-semibold mb-3 text-gray-300">{tr("Nó (Bolinha)", "Node (Circle)")}</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div><label className="block text-sm text-gray-400 mb-2">{tr("Tamanho (px)", "Size (px)")}</label><input type="number" value={getValue("project.node.size")} onChange={(e) => setValue("project.node.size", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-400 mb-2">{tr("Gradiente (Início)", "Gradient (Start)")}</label><div className="flex gap-2"><input type="color" value={getValue("project.node.colors.gradient.from")} onChange={(e) => setValue("project.node.colors.gradient.from", e.target.value)} className="w-16 h-10 rounded" /><input type="text" value={getValue("project.node.colors.gradient.from")} onChange={(e) => setValue("project.node.colors.gradient.from", e.target.value)} className="flex-1 bg-gray-700 rounded px-3 py-2 font-mono text-sm" /></div></div>
              <div><label className="block text-sm text-gray-400 mb-2">{tr("Gradiente (Fim)", "Gradient (End)")}</label><div className="flex gap-2"><input type="color" value={getValue("project.node.colors.gradient.to")} onChange={(e) => setValue("project.node.colors.gradient.to", e.target.value)} className="w-16 h-10 rounded" /><input type="text" value={getValue("project.node.colors.gradient.to")} onChange={(e) => setValue("project.node.colors.gradient.to", e.target.value)} className="flex-1 bg-gray-700 rounded px-3 py-2 font-mono text-sm" /></div></div>
            </div>
            
            <h3 className="text-lg font-semibold mb-3 text-gray-300">{tr("Conexões (Linhas)", "Connections (Lines)")}</h3>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Cor da Linha", "Line Color")}</label>
                <div className="flex gap-2">
                  <input type="color" value={getValue("project.edge.color")} onChange={(e) => setValue("project.edge.color", e.target.value)} className="w-16 h-10 rounded" />
                  <input type="text" value={getValue("project.edge.color")} onChange={(e) => setValue("project.edge.color", e.target.value)} className="flex-1 bg-gray-700 rounded px-3 py-2 font-mono text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Espessura (px)", "Thickness (px)")}</label>
                <input type="number" step="0.5" min="0.5" max="10" value={getValue("project.edge.strokeWidth")} onChange={(e) => setValue("project.edge.strokeWidth", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Tracejada?", "Dashed?")}</label>
                <ToggleSwitch
                  checked={Boolean(getValue("project.edge.dashed"))}
                  onChange={(next) => setValue("project.edge.dashed", next)}
                  ariaLabel={tr("Tracejada?", "Dashed?")}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Animada?", "Animated?")}</label>
                <ToggleSwitch
                  checked={Boolean(getValue("project.edge.animated"))}
                  onChange={(next) => setValue("project.edge.animated", next)}
                  ariaLabel={tr("Animada?", "Animated?")}
                />
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">🎨 {isPt ? "Níveis de Hierarquia" : "Hierarchy Levels"}</h2>
              <button onClick={handleAddLevel} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold">+ {isPt ? "Adicionar Nível" : "Add Level"}</button>
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
                          <label className="block text-sm text-gray-400 mb-2">{tr("Nome do Nível", "Level Name")}</label>
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
                      <h3 className="font-semibold text-gray-300">{tr("Nó", "Node")}</h3>
                      <div><label className="block text-sm text-gray-400 mb-1">{tr("Cor", "Color")}</label><div className="flex gap-2"><input type="color" value={lvl.node.color || "#a855f7"} onChange={(e) => handleLevelChange(lvl.level, "node.color", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={lvl.node.color || "#a855f7"} onChange={(e) => handleLevelChange(lvl.level, "node.color", e.target.value)} className="flex-1 bg-gray-600 rounded px-2 py-1 font-mono text-sm" /></div></div>
                      <div><label className="block text-sm text-gray-400 mb-1">{tr("Texto", "Text")}</label><div className="flex gap-2"><input type="color" value={lvl.node.textColor || "#ffffff"} onChange={(e) => handleLevelChange(lvl.level, "node.textColor", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={lvl.node.textColor || "#ffffff"} onChange={(e) => handleLevelChange(lvl.level, "node.textColor", e.target.value)} className="flex-1 bg-gray-600 rounded px-2 py-1 font-mono text-sm" /></div></div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-300">{tr("Conexão", "Connection")}</h3>
                      <div><label className="block text-sm text-gray-400 mb-1">{tr("Cor", "Color")}</label><div className="flex gap-2"><input type="color" value={lvl.edge.color || "#94a3b8"} onChange={(e) => handleLevelChange(lvl.level, "edge.color", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={lvl.edge.color || "#94a3b8"} onChange={(e) => handleLevelChange(lvl.level, "edge.color", e.target.value)} className="flex-1 bg-gray-600 rounded px-2 py-1 font-mono text-sm" /></div></div>
                      <div><label className="block text-sm text-gray-400 mb-1">{tr("Espessura", "Thickness")}</label><input type="number" step="0.1" value={lvl.edge.strokeWidth || 0.5} onChange={(e) => handleLevelChange(lvl.level, "edge.strokeWidth", Number(e.target.value))} className="w-full bg-gray-600 rounded px-2 py-1" /></div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2"><ToggleSwitch checked={lvl.edge.animated || false} onChange={(next) => handleLevelChange(lvl.level, "edge.animated", next)} ariaLabel={tr("Animado", "Animated")} /><span className="text-sm">{tr("Animado", "Animated")}</span></label>
                        <label className="flex items-center gap-2"><ToggleSwitch checked={lvl.edge.dashed || false} onChange={(next) => handleLevelChange(lvl.level, "edge.dashed", next)} ariaLabel={tr("Tracejado", "Dashed")} /><span className="text-sm">{tr("Tracejado", "Dashed")}</span></label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Borda para Nós com Filhos */}
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold text-gray-300">🔲 {tr("Borda para Nós com Filhos", "Border for Nodes with Children")}</h3>
                      <label className="flex items-center gap-2">
                        <ToggleSwitch
                          checked={lvl.node.hasChildrenBorder?.enabled || false}
                          onChange={(next) => handleLevelChange(lvl.level, "node.hasChildrenBorder.enabled", next)}
                          ariaLabel={tr("Ativar", "Enable")}
                        />
                        <span className="text-sm text-gray-400">{tr("Ativar", "Enable")}</span>
                      </label>
                    </div>
                    
                    {(lvl.node.hasChildrenBorder?.enabled) && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">{tr("Cor", "Color")}</label>
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
                          <label className="block text-sm text-gray-400 mb-1">{tr("Largura Base", "Base Width")}</label>
                          <input 
                            type="number" 
                            step="0.5" 
                            value={lvl.node.hasChildrenBorder?.width || 2} 
                            onChange={(e) => handleLevelChange(lvl.level, "node.hasChildrenBorder.width", Number(e.target.value))} 
                            className="w-full bg-gray-600 rounded px-2 py-1" 
                          />
                          <p className="text-xs text-gray-500 mt-1">{tr("Proporcional ao tamanho", "Proportional to size")}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="flex items-center gap-2">
                            <ToggleSwitch
                              checked={lvl.node.hasChildrenBorder?.dashed || false}
                              onChange={(next) => handleLevelChange(lvl.level, "node.hasChildrenBorder.dashed", next)}
                              ariaLabel={tr("Tracejada", "Dashed")}
                            />
                            <span className="text-sm text-gray-400">{tr("Tracejada", "Dashed")}</span>
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
            <h2 className="text-xl font-bold mb-4">✨ {tr("Highlight (Seleção)", "Highlight (Selection)")}</h2>
            <div className="grid grid-cols-4 gap-4 mb-3">
              <div><label className="block text-sm text-gray-400 mb-2">{tr("Cor", "Color")}</label><div className="flex gap-2"><input type="color" value={getValue("sections.edge.highlighted.color")} onChange={(e) => setHighlightValue("color", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={getValue("sections.edge.highlighted.color")} onChange={(e) => setHighlightValue("color", e.target.value)} className="flex-1 bg-gray-700 rounded px-2 py-1 font-mono text-sm" /></div></div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Espessura Base", "Base Thickness")}</label>
                <input type="number" step="0.1" value={getValue("sections.edge.highlighted.strokeWidth")} onChange={(e) => setHighlightValue("strokeWidth", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{tr("Ajustado pelo zoom", "Adjusted by zoom")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Padrão de Tracejado Base", "Base Dash Pattern")}</label>
                <input type="number" step="0.5" value={getValue("sections.edge.highlighted.dashPattern")} onChange={(e) => setHighlightValue("dashPattern", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{tr("Ex: 5 = traços de 5px", "Ex: 5 = 5px dashes")}</p>
              </div>
              <div><label className="block text-sm text-gray-400 mb-2">{tr("Animado", "Animated")}</label><ToggleSwitch checked={Boolean(getValue("sections.edge.highlighted.animated"))} onChange={(next) => setHighlightValue("animated", next)} ariaLabel={tr("Animado", "Animated")} /></div>
            </div>
            <p className="text-xs text-gray-500">{tr("A espessura e tracejado das linhas destacadas são proporcionais ao zoom para manter visual constante.", "The thickness and dashing of highlighted lines are proportional to zoom to keep a consistent visual.")}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🔍 {tr("Zoom", "Zoom")}</h2>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Zoom Mínimo", "Minimum Zoom")}</label>
                <input type="number" step="0.01" min="0.01" max="1" value={getValue("zoom.minZoom")} onChange={(e) => setValue("zoom.minZoom", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Ex: 0.01 = 1%</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">FitView Max Zoom</label>
                <input type="number" step="0.5" min="0.5" max="10" value={getValue("zoom.fitViewMaxZoom")} onChange={(e) => setValue("zoom.fitViewMaxZoom", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{tr("Limite ao carregar", "Limit on load")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("FitView Margem", "FitView Padding")}</label>
                <input type="number" step="0.05" min="0" max="0.5" value={getValue("zoom.fitViewPadding") || 0.2} onChange={(e) => setValue("zoom.fitViewPadding", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Ex: 0.2 = 20%</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              <strong>{tr("Zoom Mínimo", "Minimum Zoom")}:</strong> {tr("Menor zoom possível (quanto menor, mais você pode afastar).", "Lowest possible zoom (the lower, the farther you can zoom out).")}
              <br />
              <strong>FitView Max Zoom:</strong> {tr("Limite de zoom ao carregar - valores altos (5+) permitem zoom out total para ver tudo.", "Zoom limit on load - high values (5+) allow full zoom out to see everything.")}
              <br />
              <strong>{tr("FitView Margem", "FitView Padding")}:</strong> {tr("Espaçamento ao redor do mapa ao carregar.", "Spacing around the map on load.")}
            </p>
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">🎯 {tr("Zoom ao Clicar", "Zoom on Click")}</h3>
              <div className="grid grid-cols-1 gap-4">
                <div><label className="block text-sm text-gray-400 mb-2">{tr("Tamanho Alvo na Tela (px)", "Target Size on Screen (px)")}</label><input type="number" value={getValue("zoom.onClickTargetSize") || 200} onChange={(e) => setValue("zoom.onClickTargetSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{tr("Ao clicar em qualquer bolinha, ela será ampliada para ter este tamanho na tela. Ex: 200px = todas as bolinhas aparecem com 200px quando clicadas", "When clicking any node, it will be enlarged to this size on screen. Ex: 200px = all nodes appear at 200px when clicked")}</p>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🎬 {tr("Animação das Conexões", "Connection Animation")}</h2>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Velocidade (segundos)", "Speed (seconds)")}</label>
                <input type="number" step="0.5" min="0.5" max="10" value={getValue("animation.speed") || 2} onChange={(e) => setValue("animation.speed", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{tr("Menor = mais rápido", "Lower = faster")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Distância do Movimento (px)", "Movement Distance (px)")}</label>
                <input type="number" step="10" min="50" max="500" value={getValue("animation.distance") || 500} onChange={(e) => setValue("animation.distance", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{tr("Quanto os traços se movem", "How far dashes move")}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">{tr("Controla o movimento dos traços animados em todas as conexões. Teste valores diferentes para encontrar a melhor visibilidade!", "Controls animated dash movement on all connections. Try different values to find the best visibility!")}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🌫️ {tr("Efeito de Esmaecer", "Fade Effect")}</h2>
            <p className="text-sm text-gray-400 mb-4">{tr("Quando um nó é selecionado, os nós que NÃO estão no caminho ficam esmaecidos para destacar a hierarquia.", "When a node is selected, nodes NOT in the path are faded to highlight hierarchy.")}</p>
            <div className="mb-3">
              <label className="flex items-center">
                <ToggleSwitch
                  checked={getValue("fadeEffect.enabled") ?? true}
                  onChange={(next) => setValue("fadeEffect.enabled", next)}
                  ariaLabel={tr("Ativar efeito de esmaecer", "Enable fade effect")}
                />
                <span className="text-sm">{tr("Ativar efeito de esmaecer", "Enable fade effect")}</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Opacidade", "Opacity")}</label>
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
                <p className="text-xs text-gray-500 mt-1">{tr("0 = invisível, 1 = normal", "0 = invisible, 1 = normal")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Grayscale (%)</label>
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
                <p className="text-xs text-gray-500 mt-1">{tr("0 = colorido, 100 = cinza", "0 = colored, 100 = gray")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Blur (px)</label>
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
                <p className="text-xs text-gray-500 mt-1">{tr("0 = nítido, 10 = muito borrado", "0 = sharp, 10 = very blurry")}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">{tr("Combine opacidade, grayscale e blur para encontrar o efeito ideal. Recomendado: opacity 0.3, grayscale 50, blur 1", "Combine opacity, grayscale and blur to find the ideal effect. Recommended: opacity 0.3, grayscale 50, blur 1")}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🔗 {tr("Referências Cruzadas", "Cross References")}</h2>
            <p className="text-sm text-gray-400 mb-4">{tr("Ao selecionar um nó, mostra conexões azuis para seções referenciadas no conteúdo usando a sintaxe $[Nome da Seção]", "When selecting a node, it shows blue links to sections referenced in content using $[Section Name] syntax")}</p>
            <div className="mb-3">
              <label className="flex items-center">
                <ToggleSwitch
                  checked={getValue("references.enabled") ?? true}
                  onChange={(next) => setValue("references.enabled", next)}
                  ariaLabel={tr("Mostrar referências cruzadas", "Show cross references")}
                />
                <span className="text-sm">{tr("Mostrar referências cruzadas", "Show cross references")}</span>
              </label>
            </div>
            <h3 className="text-sm font-semibold mb-3 text-gray-300">{tr("Estilo da Conexão", "Connection Style")}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Cor da Linha", "Line Color")}</label>
                <input 
                  type="color" 
                  value={getValue("references.edgeColor") || '#3b82f6'} 
                  onChange={(e) => setValue("references.edgeColor", e.target.value)} 
                  className="w-full h-10 bg-gray-700 rounded cursor-pointer"
                  disabled={!getValue("references.enabled")}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Espessura (px)", "Thickness (px)")}</label>
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
                    ariaLabel={tr("Animar linha (movimento)", "Animate line (movement)")}
                  />
                  <span className="text-sm">{tr("Animar linha (movimento)", "Animate line (movement)")}</span>
                </label>
              </div>
              <div>
                <label className="flex items-center">
                  <ToggleSwitch
                    checked={getValue("references.edgeDashed") !== false}
                    onChange={(next) => setValue("references.edgeDashed", next)}
                    disabled={!getValue("references.enabled")}
                    ariaLabel={tr("Linha tracejada", "Dashed line")}
                  />
                  <span className="text-sm">{tr("Linha tracejada", "Dashed line")}</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Padrão do tracejado", "Dash Pattern")}</label>
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
                <p className="text-xs text-gray-500 mt-1">{tr("Usado para traço e animação", "Used for dash and animation")}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">💡 {tr("A animação usa as mesmas configurações globais (velocidade/distância) de outras conexões animadas", "Animation uses the same global settings (speed/distance) as other animated connections")}</p>
            <h3 className="text-sm font-semibold mb-3 text-gray-300">{tr("Ícone na Conexão", "Connection Icon")}</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="flex items-center">
                  <ToggleSwitch
                    checked={getValue("references.showIcon") ?? true}
                    onChange={(next) => setValue("references.showIcon", next)}
                    disabled={!getValue("references.enabled")}
                    ariaLabel={tr("Mostrar ícone na linha", "Show icon on line")}
                  />
                  <span className="text-sm">{tr("Mostrar ícone na linha", "Show icon on line")}</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Ícone/Emoji", "Icon/Emoji")}</label>
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
              <label className="block text-sm text-gray-400 mb-2">{tr("Tamanho do Ícone", "Icon Size")}</label>
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
            <h3 className="text-sm font-semibold mb-3 text-gray-300">{tr("Destaque dos Nós Referenciados", "Referenced Node Highlight")}</h3>
            <div className="mb-3">
              <label className="flex items-center">
                <ToggleSwitch
                  checked={getValue("references.nodeHighlight.enabled") ?? true}
                  onChange={(next) => setValue("references.nodeHighlight.enabled", next)}
                  disabled={!getValue("references.enabled")}
                  ariaLabel={tr("Destacar nós referenciados", "Highlight referenced nodes")}
                />
                <span className="text-sm">{tr("Destacar nós referenciados", "Highlight referenced nodes")}</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Cor da Borda", "Border Color")}</label>
                <input 
                  type="color" 
                  value={getValue("references.nodeHighlight.borderColor") || '#3b82f6'} 
                  onChange={(e) => setValue("references.nodeHighlight.borderColor", e.target.value)} 
                  className="w-full h-10 bg-gray-700 rounded cursor-pointer"
                  disabled={!getValue("references.enabled") || !getValue("references.nodeHighlight.enabled")}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Espessura da Borda", "Border Thickness")}</label>
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
            <p className="text-xs text-gray-500">{tr("As referências são detectadas automaticamente quando você usa $[Nome da Seção] ou $[#id] no conteúdo. Azul é recomendado por lembrar hyperlinks!", "References are detected automatically when you use $[Section Name] or $[#id] in content. Blue is recommended as it resembles hyperlinks!")}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">⚙️ {tr("Física da Simulação", "Simulation Physics")}</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Link Strength</label>
                <input type="number" step="0.01" min="0" max="1" value={getValue("physics.simulation.linkStrength") ?? 1} onChange={(e) => setValue("physics.simulation.linkStrength", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{tr("0-1 (menor = mais livre)", "0-1 (lower = freer)")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Collision Strength</label>
                <input type="number" step="0.1" min="0" max="1" value={getValue("physics.simulation.collisionStrength") ?? 0.3} onChange={(e) => setValue("physics.simulation.collisionStrength", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{tr("0-1 (recomendado: 0.1-0.3 para simetria)", "0-1 (recommended: 0.1-0.3 for symmetry)")}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{tr("Iterações", "Iterations")}</label>
                <input type="number" step="10" min="10" max="500" value={getValue("physics.simulation.iterations") ?? 130} onChange={(e) => setValue("physics.simulation.iterations", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">{tr("Precisão da simulação", "Simulation precision")}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">{tr("Ajuste a física para controlar como os nós se organizam. Link = atração aos pais, Collision = evita sobreposição, Iterações = qualidade do cálculo.", "Tune physics to control how nodes organize. Link = attraction to parents, Collision = avoid overlap, Iterations = calculation quality.")}</p>
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
          <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold">💾 {isPt ? "Salvar" : "Save"}</button>
          <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold">🔄 {isPt ? "Resetar" : "Reset"}</button>
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
