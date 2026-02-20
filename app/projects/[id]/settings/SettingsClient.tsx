"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore, LevelConfig } from "@/store/projectStore";
import { MINDMAP_CONFIG } from "@/lib/mindMapConfig";

interface Props {
  projectId: string;
}

export default function SettingsClient({ projectId }: Props) {
  const router = useRouter();
  const { getProject, updateProjectSettings } = useProjectStore();
  const project = getProject(projectId);
  const [settings, setSettings] = useState(project?.mindMapSettings || {});
  const [showSuccess, setShowSuccess] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set()); // Todos colapsados por padrão
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        alert('Erro ao importar configurações. Verifique se o arquivo é válido.');
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

  // Inicializar levels default apenas se o projeto não tiver configurações salvas
  useEffect(() => {
    if (project && (!project.mindMapSettings?.levels || project.mindMapSettings.levels.length === 0)) {
      const defaultLevels: LevelConfig[] = [
        { 
          level: 0, 
          name: "Seções (Nível 0)", 
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
          name: "Subseções (Nível 1)", 
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
          name: "Sub-subseções (Nível 2+)", 
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
  }, [project]);

  const handleAddLevel = () => {
    const currentLevels = settings.levels || [];
    const nextLevel = currentLevels.length;
    const newLevel: LevelConfig = { 
      level: nextLevel, 
      name: `Nível ${nextLevel}`, 
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
    if (currentLevels.length <= 1) { alert("Você precisa ter pelo menos 1 nível!"); return; }
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

  const handleSave = () => { updateProjectSettings(projectId, settings); setShowSuccess(true); setTimeout(() => setShowSuccess(false), 3000); };
  const handleReset = () => { if (confirm("Resetar todas as configurações?")) { updateProjectSettings(projectId, {}); setSettings({}); setShowSuccess(true); setTimeout(() => setShowSuccess(false), 3000); } };

  if (!project) return <div>Projeto não encontrado</div>;
  const levels = settings.levels || [];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-8">
          <button onClick={() => router.push(`/projects/${projectId}`)} className="text-gray-400 hover:text-white mb-4">← Voltar</button>
          <h1 className="text-3xl font-bold mb-2">⚙️ Configurações do Mapa Mental</h1>
          <p className="text-gray-400">{project.title}</p>
        </div>
        {showSuccess && <div className="mb-6 bg-green-600 text-white px-4 py-3 rounded-lg">✓ Configurações salvas com sucesso!</div>}
        
        {/* Input file oculto para importar */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        
        <div className="flex gap-3 mb-8">
          <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold">💾 Salvar</button>
          <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold">🔄 Resetar</button>
          <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold">📥 Exportar</button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold">📤 Importar</button>
        </div>
        <div className="space-y-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">📏 Tamanhos dos Nós</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><label className="block text-sm text-gray-400 mb-2">Base (px)</label><input type="number" value={getValue("nodeSize.baseSize")} onChange={(e) => setValue("nodeSize.baseSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-400 mb-2">Redução</label><input type="number" step="0.1" value={getValue("nodeSize.reductionFactor")} onChange={(e) => setValue("nodeSize.reductionFactor", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-400 mb-2">Mínimo (px)</label><input type="number" value={getValue("nodeSize.minSize")} onChange={(e) => setValue("nodeSize.minSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
            </div>
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">📐 Espaçamento</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm text-gray-400 mb-2">Margem do Sol (px)</label><input type="number" value={getValue("spacing.projectMargin") || 80} onChange={(e) => setValue("spacing.projectMargin", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-400 mb-2">Margem entre Níveis (px)</label><input type="number" value={getValue("spacing.levelMargin") || 60} onChange={(e) => setValue("spacing.levelMargin", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              </div>
              <p className="text-xs text-gray-500">Margem do Sol = espaço entre o projeto central e as seções. Margem entre Níveis = espaço entre nós pai e filho.</p>
            </div>
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">🔤 Fonte</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm text-gray-400 mb-2">Tamanho Base (px)</label><input type="number" value={getValue("nodeSize.baseFontSize") || 14} onChange={(e) => setValue("nodeSize.baseFontSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-400 mb-2">Tamanho Mínimo (px)</label><input type="number" value={getValue("nodeSize.minFontSize") || 8} onChange={(e) => setValue("nodeSize.minFontSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Família da Fonte</label>
                  <select value={getValue("nodeSize.fontFamily") || "system-ui"} onChange={(e) => setValue("nodeSize.fontFamily", e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2">
                    <option value="system-ui">System UI (Padrão)</option>
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
                  <label className="block text-sm text-gray-400 mb-2">Peso da Fonte</label>
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
              <p className="text-xs text-gray-500">Tamanho Base = fonte quando a bolinha tem 100px. Escala proporcionalmente com o tamanho do nó. Ex: Base=14 + Nó=1000px = Fonte de 140px.</p>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🎯 Projeto Central</h2>
            <h3 className="text-lg font-semibold mb-3 text-gray-300">Nó (Bolinha)</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div><label className="block text-sm text-gray-400 mb-2">Tamanho (px)</label><input type="number" value={getValue("project.node.size")} onChange={(e) => setValue("project.node.size", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              <div><label className="block text-sm text-gray-400 mb-2">Gradiente (Início)</label><div className="flex gap-2"><input type="color" value={getValue("project.node.colors.gradient.from")} onChange={(e) => setValue("project.node.colors.gradient.from", e.target.value)} className="w-16 h-10 rounded" /><input type="text" value={getValue("project.node.colors.gradient.from")} onChange={(e) => setValue("project.node.colors.gradient.from", e.target.value)} className="flex-1 bg-gray-700 rounded px-3 py-2 font-mono text-sm" /></div></div>
              <div><label className="block text-sm text-gray-400 mb-2">Gradiente (Fim)</label><div className="flex gap-2"><input type="color" value={getValue("project.node.colors.gradient.to")} onChange={(e) => setValue("project.node.colors.gradient.to", e.target.value)} className="w-16 h-10 rounded" /><input type="text" value={getValue("project.node.colors.gradient.to")} onChange={(e) => setValue("project.node.colors.gradient.to", e.target.value)} className="flex-1 bg-gray-700 rounded px-3 py-2 font-mono text-sm" /></div></div>
            </div>
            
            <h3 className="text-lg font-semibold mb-3 text-gray-300">Conexões (Linhas)</h3>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Cor da Linha</label>
                <div className="flex gap-2">
                  <input type="color" value={getValue("project.edge.color")} onChange={(e) => setValue("project.edge.color", e.target.value)} className="w-16 h-10 rounded" />
                  <input type="text" value={getValue("project.edge.color")} onChange={(e) => setValue("project.edge.color", e.target.value)} className="flex-1 bg-gray-700 rounded px-3 py-2 font-mono text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Espessura (px)</label>
                <input type="number" step="0.5" min="0.5" max="10" value={getValue("project.edge.strokeWidth")} onChange={(e) => setValue("project.edge.strokeWidth", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Tracejada?</label>
                <select value={getValue("project.edge.dashed") ? "true" : "false"} onChange={(e) => setValue("project.edge.dashed", e.target.value === "true")} className="w-full bg-gray-700 rounded px-3 py-2">
                  <option value="false">Não</option>
                  <option value="true">Sim</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Animada?</label>
                <select value={getValue("project.edge.animated") ? "true" : "false"} onChange={(e) => setValue("project.edge.animated", e.target.value === "true")} className="w-full bg-gray-700 rounded px-3 py-2">
                  <option value="false">Não</option>
                  <option value="true">Sim</option>
                </select>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">🎨 Níveis de Hierarquia</h2>
              <button onClick={handleAddLevel} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold">+ Adicionar Nível</button>
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
                          <label className="block text-sm text-gray-400 mb-2">Nome do Nível</label>
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
                      <h3 className="font-semibold text-gray-300">Nó</h3>
                      <div><label className="block text-sm text-gray-400 mb-1">Cor</label><div className="flex gap-2"><input type="color" value={lvl.node.color || "#a855f7"} onChange={(e) => handleLevelChange(lvl.level, "node.color", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={lvl.node.color || "#a855f7"} onChange={(e) => handleLevelChange(lvl.level, "node.color", e.target.value)} className="flex-1 bg-gray-600 rounded px-2 py-1 font-mono text-sm" /></div></div>
                      <div><label className="block text-sm text-gray-400 mb-1">Texto</label><div className="flex gap-2"><input type="color" value={lvl.node.textColor || "#ffffff"} onChange={(e) => handleLevelChange(lvl.level, "node.textColor", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={lvl.node.textColor || "#ffffff"} onChange={(e) => handleLevelChange(lvl.level, "node.textColor", e.target.value)} className="flex-1 bg-gray-600 rounded px-2 py-1 font-mono text-sm" /></div></div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-300">Conexão</h3>
                      <div><label className="block text-sm text-gray-400 mb-1">Cor</label><div className="flex gap-2"><input type="color" value={lvl.edge.color || "#94a3b8"} onChange={(e) => handleLevelChange(lvl.level, "edge.color", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={lvl.edge.color || "#94a3b8"} onChange={(e) => handleLevelChange(lvl.level, "edge.color", e.target.value)} className="flex-1 bg-gray-600 rounded px-2 py-1 font-mono text-sm" /></div></div>
                      <div><label className="block text-sm text-gray-400 mb-1">Espessura</label><input type="number" step="0.1" value={lvl.edge.strokeWidth || 0.5} onChange={(e) => handleLevelChange(lvl.level, "edge.strokeWidth", Number(e.target.value))} className="w-full bg-gray-600 rounded px-2 py-1" /></div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={lvl.edge.animated || false} onChange={(e) => handleLevelChange(lvl.level, "edge.animated", e.target.checked)} className="w-5 h-5" /><span className="text-sm">Animado</span></label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={lvl.edge.dashed || false} onChange={(e) => handleLevelChange(lvl.level, "edge.dashed", e.target.checked)} className="w-5 h-5" /><span className="text-sm">Tracejado</span></label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Borda para Nós com Filhos */}
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold text-gray-300">🔲 Borda para Nós com Filhos</h3>
                      <label className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={lvl.node.hasChildrenBorder?.enabled || false} 
                          onChange={(e) => handleLevelChange(lvl.level, "node.hasChildrenBorder.enabled", e.target.checked)} 
                          className="w-5 h-5" 
                        />
                        <span className="text-sm text-gray-400">Ativar</span>
                      </label>
                    </div>
                    
                    {(lvl.node.hasChildrenBorder?.enabled) && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Cor</label>
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
                          <label className="block text-sm text-gray-400 mb-1">Largura Base</label>
                          <input 
                            type="number" 
                            step="0.5" 
                            value={lvl.node.hasChildrenBorder?.width || 2} 
                            onChange={(e) => handleLevelChange(lvl.level, "node.hasChildrenBorder.width", Number(e.target.value))} 
                            className="w-full bg-gray-600 rounded px-2 py-1" 
                          />
                          <p className="text-xs text-gray-500 mt-1">Proporcional ao tamanho</p>
                        </div>
                        <div className="col-span-2">
                          <label className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={lvl.node.hasChildrenBorder?.dashed || false} 
                              onChange={(e) => handleLevelChange(lvl.level, "node.hasChildrenBorder.dashed", e.target.checked)} 
                              className="w-5 h-5" 
                            />
                            <span className="text-sm text-gray-400">Tracejada</span>
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
            <h2 className="text-xl font-bold mb-4">✨ Highlight (Seleção)</h2>
            <div className="grid grid-cols-4 gap-4 mb-3">
              <div><label className="block text-sm text-gray-400 mb-2">Cor</label><div className="flex gap-2"><input type="color" value={getValue("sections.edge.highlighted.color")} onChange={(e) => setHighlightValue("color", e.target.value)} className="w-12 h-10 rounded" /><input type="text" value={getValue("sections.edge.highlighted.color")} onChange={(e) => setHighlightValue("color", e.target.value)} className="flex-1 bg-gray-700 rounded px-2 py-1 font-mono text-sm" /></div></div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Espessura Base</label>
                <input type="number" step="0.1" value={getValue("sections.edge.highlighted.strokeWidth")} onChange={(e) => setHighlightValue("strokeWidth", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Ajustado pelo zoom</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Padrão de Tracejado Base</label>
                <input type="number" step="0.5" value={getValue("sections.edge.highlighted.dashPattern")} onChange={(e) => setHighlightValue("dashPattern", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Ex: 5 = traços de 5px</p>
              </div>
              <div><label className="block text-sm text-gray-400 mb-2">Animado</label><input type="checkbox" checked={getValue("sections.edge.highlighted.animated")} onChange={(e) => setHighlightValue("animated", e.target.checked)} className="w-6 h-6 mt-2" /></div>
            </div>
            <p className="text-xs text-gray-500">A espessura e tracejado das linhas destacadas são proporcionais ao zoom para manter visual constante.</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🔍 Zoom</h2>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Zoom Mínimo</label>
                <input type="number" step="0.01" min="0.01" max="1" value={getValue("zoom.minZoom")} onChange={(e) => setValue("zoom.minZoom", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Ex: 0.01 = 1%</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">FitView Max Zoom</label>
                <input type="number" step="0.5" min="0.5" max="10" value={getValue("zoom.fitViewMaxZoom")} onChange={(e) => setValue("zoom.fitViewMaxZoom", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Limite ao carregar</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">FitView Margem</label>
                <input type="number" step="0.05" min="0" max="0.5" value={getValue("zoom.fitViewPadding") || 0.2} onChange={(e) => setValue("zoom.fitViewPadding", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Ex: 0.2 = 20%</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              <strong>Zoom Mínimo:</strong> Menor zoom possível (quanto menor, mais você pode afastar).
              <br />
              <strong>FitView Max Zoom:</strong> Limite de zoom ao carregar - valores altos (5+) permitem zoom out total para ver tudo.
              <br />
              <strong>FitView Margem:</strong> Espaçamento ao redor do mapa ao carregar.
            </p>
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-300">🎯 Zoom ao Clicar</h3>
              <div className="grid grid-cols-1 gap-4">
                <div><label className="block text-sm text-gray-400 mb-2">Tamanho Alvo na Tela (px)</label><input type="number" value={getValue("zoom.onClickTargetSize") || 200} onChange={(e) => setValue("zoom.onClickTargetSize", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" /></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Ao clicar em qualquer bolinha, ela será ampliada para ter este tamanho na tela. Ex: 200px = todas as bolinhas aparecem com 200px quando clicadas</p>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🎬 Animação das Conexões</h2>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Velocidade (segundos)</label>
                <input type="number" step="0.5" min="0.5" max="10" value={getValue("animation.speed") || 2} onChange={(e) => setValue("animation.speed", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Menor = mais rápido</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Distância do Movimento (px)</label>
                <input type="number" step="10" min="50" max="500" value={getValue("animation.distance") || 500} onChange={(e) => setValue("animation.distance", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Quanto os traços se movem</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">Controla o movimento dos traços animados em todas as conexões. Teste valores diferentes para encontrar a melhor visibilidade!</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🌫️ Efeito de Esmaecer</h2>
            <p className="text-sm text-gray-400 mb-4">Quando um nó é selecionado, os nós que NÃO estão no caminho ficam esmaecidos para destacar a hierarquia.</p>
            <div className="mb-3">
              <label className="flex items-center">
                <input 
                  type="checkbox" 
                  checked={getValue("fadeEffect.enabled") ?? true} 
                  onChange={(e) => setValue("fadeEffect.enabled", e.target.checked)} 
                  className="mr-2" 
                />
                <span className="text-sm">Ativar efeito de esmaecer</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Opacidade</label>
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
                <p className="text-xs text-gray-500 mt-1">0 = invisível, 1 = normal</p>
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
                <p className="text-xs text-gray-500 mt-1">0 = colorido, 100 = cinza</p>
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
                <p className="text-xs text-gray-500 mt-1">0 = nítido, 10 = muito borrado</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">Combine opacidade, grayscale e blur para encontrar o efeito ideal. Recomendado: opacity 0.3, grayscale 50, blur 1</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">🔗 Referências Cruzadas</h2>
            <p className="text-sm text-gray-400 mb-4">Ao selecionar um nó, mostra conexões azuis para seções referenciadas no conteúdo usando a sintaxe $[Nome da Seção]</p>
            <div className="mb-3">
              <label className="flex items-center">
                <input 
                  type="checkbox" 
                  checked={getValue("references.enabled") ?? true} 
                  onChange={(e) => setValue("references.enabled", e.target.checked)} 
                  className="mr-2" 
                />
                <span className="text-sm">Mostrar referências cruzadas</span>
              </label>
            </div>
            <h3 className="text-sm font-semibold mb-3 text-gray-300">Estilo da Conexão</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Cor da Linha</label>
                <input 
                  type="color" 
                  value={getValue("references.edgeColor") || '#3b82f6'} 
                  onChange={(e) => setValue("references.edgeColor", e.target.value)} 
                  className="w-full h-10 bg-gray-700 rounded cursor-pointer"
                  disabled={!getValue("references.enabled")}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Espessura (px)</label>
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
                  <input 
                    type="checkbox" 
                    checked={getValue("references.edgeAnimated") || false} 
                    onChange={(e) => setValue("references.edgeAnimated", e.target.checked)} 
                    className="mr-2"
                    disabled={!getValue("references.enabled")}
                  />
                  <span className="text-sm">Animar linha (movimento)</span>
                </label>
              </div>
              <div>
                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={getValue("references.edgeDashed") !== false} 
                    onChange={(e) => setValue("references.edgeDashed", e.target.checked)} 
                    className="mr-2"
                    disabled={!getValue("references.enabled")}
                  />
                  <span className="text-sm">Linha tracejada</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Padrão do tracejado</label>
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
                <p className="text-xs text-gray-500 mt-1">Usado para traço e animação</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">💡 A animação usa as mesmas configurações globais (velocidade/distância) de outras conexões animadas</p>
            <h3 className="text-sm font-semibold mb-3 text-gray-300">Ícone na Conexão</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={getValue("references.showIcon") ?? true} 
                    onChange={(e) => setValue("references.showIcon", e.target.checked)} 
                    className="mr-2"
                    disabled={!getValue("references.enabled")}
                  />
                  <span className="text-sm">Mostrar ícone na linha</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Ícone/Emoji</label>
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
              <label className="block text-sm text-gray-400 mb-2">Tamanho do Ícone</label>
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
            <h3 className="text-sm font-semibold mb-3 text-gray-300">Destaque dos Nós Referenciados</h3>
            <div className="mb-3">
              <label className="flex items-center">
                <input 
                  type="checkbox" 
                  checked={getValue("references.nodeHighlight.enabled") ?? true} 
                  onChange={(e) => setValue("references.nodeHighlight.enabled", e.target.checked)} 
                  className="mr-2"
                  disabled={!getValue("references.enabled")}
                />
                <span className="text-sm">Destacar nós referenciados</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Cor da Borda</label>
                <input 
                  type="color" 
                  value={getValue("references.nodeHighlight.borderColor") || '#3b82f6'} 
                  onChange={(e) => setValue("references.nodeHighlight.borderColor", e.target.value)} 
                  className="w-full h-10 bg-gray-700 rounded cursor-pointer"
                  disabled={!getValue("references.enabled") || !getValue("references.nodeHighlight.enabled")}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Espessura da Borda</label>
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
            <p className="text-xs text-gray-500">As referências são detectadas automaticamente quando você usa $[Nome da Seção] ou $[#id] no conteúdo. Azul é recomendado por lembrar hyperlinks!</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">⚙️ Física da Simulação</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Link Strength</label>
                <input type="number" step="0.01" min="0" max="1" value={getValue("physics.simulation.linkStrength") ?? 1} onChange={(e) => setValue("physics.simulation.linkStrength", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">0-1 (menor = mais livre)</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Collision Strength</label>
                <input type="number" step="0.1" min="0" max="1" value={getValue("physics.simulation.collisionStrength") ?? 0.3} onChange={(e) => setValue("physics.simulation.collisionStrength", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">0-1 (recomendado: 0.1-0.3 para simetria)</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Iterações</label>
                <input type="number" step="10" min="10" max="500" value={getValue("physics.simulation.iterations") ?? 130} onChange={(e) => setValue("physics.simulation.iterations", Number(e.target.value))} className="w-full bg-gray-700 rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Precisão da simulação</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">Ajuste a física para controlar como os nós se organizam. Link = atração aos pais, Collision = evita sobreposição, Iterações = qualidade do cálculo.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold">💾 Salvar</button>
          <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold">🔄 Resetar</button>
        </div>
      </div>
    </div>
  );
}
