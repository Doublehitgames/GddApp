"use client";

import { useCallback, useEffect, useState, useMemo, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
  MiniMap,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  useStore,
} from "reactflow";
import "reactflow/dist/style.css";
import { useProjectStore, Section, MindMapSettings } from "@/store/projectStore";
import { extractSectionReferences, findSection, getBacklinks, SectionReference } from "@/utils/sectionReferences";
import { MINDMAP_CONFIG, getNodeConfig, getEdgeConfig } from "@/lib/mindMapConfig";
import * as d3 from "d3-force";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MindMapClientProps {
  projectId: string;
}

// Helper: Deep merge de objetos (custom settings sobre defaults)
function deepMerge(target: any, source: any): any {
  if (!source) return target;
  
  const result = { ...target };
  
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];
    
    if (sourceValue !== undefined) {
      if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue) &&
          typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue)) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue;
      }
    }
  }
  
  return result;
}

// Context para compartilhar config mergedo entre todos os componentes
const ConfigContext = createContext<typeof MINDMAP_CONFIG>(MINDMAP_CONFIG);

// Tipo estendido para incluir subsections na visualização
interface SectionWithChildren extends Section {
  subsections?: SectionWithChildren[];
}

// Função para construir árvore de seções
function buildSectionTree(sections: Section[]): SectionWithChildren[] {
  const roots: SectionWithChildren[] = [];
  const sectionMap = new Map<string, SectionWithChildren>();
  
  // Criar mapa de todas as seções
  sections.forEach(section => {
    sectionMap.set(section.id, { ...section, subsections: [] });
  });
  
  // Construir hierarquia
  sections.forEach(section => {
    const sectionWithChildren = sectionMap.get(section.id)!;
    if (section.parentId) {
      const parent = sectionMap.get(section.parentId);
      if (parent) {
        parent.subsections = parent.subsections || [];
        parent.subsections.push(sectionWithChildren);
      }
    } else {
      roots.push(sectionWithChildren);
    }
  });
  
  return roots;
}

// Função para calcular peso da subárvore (sempre uniforme para simetria)
function calculateSubtreeWeight(section: SectionWithChildren): number {
  // Distribuição sempre uniforme - todas as seções têm peso 1
  return 1;
}

// Função para calcular depth máximo da árvore
function calculateMaxDepth(sections: SectionWithChildren[]): number {
  if (sections.length === 0) return 0;
  
  let maxDepth = 0;
  
  function traverse(section: SectionWithChildren, depth: number) {
    maxDepth = Math.max(maxDepth, depth);
    
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach(subsection => {
        traverse(subsection, depth + 1);
      });
    }
  }
  
  sections.forEach(section => traverse(section, 0));
  return maxDepth;
}

// Função para calcular maxZoom baseado no depth
function calculateMaxZoom(maxDepth: number, config: typeof MINDMAP_CONFIG = MINDMAP_CONFIG): number {
  const { baseSize, reductionFactor, minSize } = config.nodeSize;
  const { targetApparentSize, zoomMargin, maxZoom: configMaxZoom } = config.zoom;
  
  // Calcular tamanho da menor bolinha
  const smallestSize = Math.max(baseSize * Math.pow(reductionFactor, maxDepth), minSize);
  
  // Para que a menor bolinha tenha o tamanho alvo na tela
  const requiredZoom = targetApparentSize / smallestSize;
  
  // Adicionar margem de segurança
  const maxZoom = requiredZoom * zoomMargin;
  
  // Garantir mínimo de 2x e máximo configurado
  return Math.max(2, Math.min(configMaxZoom, maxZoom));
}

// Função para calcular tamanho de nó baseado no nível
function getNodeSize(level: number, config: typeof MINDMAP_CONFIG = MINDMAP_CONFIG): number {
  const { baseSize, reductionFactor, minSize } = config.nodeSize;
  const calculatedSize = baseSize * Math.pow(reductionFactor, level);
  return Math.max(calculatedSize, minSize);
}

// Interface para nós da simulação física
interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  level: number;
  size: number;
  isProject?: boolean;
}

// Função para calcular posições usando Híbrido: Orbital + Force para colisões
function calculateNodePositions(sections: SectionWithChildren[], config: typeof MINDMAP_CONFIG = MINDMAP_CONFIG): Map<string, { x: number; y: number; calculatedSize?: number }> {
  const positions = new Map<string, { x: number; y: number; calculatedSize?: number }>();
  
  // Coletar todos os nós
  const nodes: SimulationNode[] = [];
  const links: { source: string; target: string; distance: number }[] = [];
  
  // PASSO 1: POSICIONAMENTO ORBITAL INICIAL
  const centerX = 0;
  const centerY = 0;
  const projectSize = config.project.node.size;
  const level0Size = getNodeSize(0, config);
  // Raio orbital dinâmico: raio do sol + raio da bolinha + margem configurável
  const projectMargin = (config as any).spacing?.projectMargin || 80;
  const mainOrbitRadius = (projectSize / 2) + (level0Size / 2) + projectMargin;
  
  // Adicionar projeto no centro (fixo)
  nodes.push({
    id: 'project-center',
    level: -1,
    size: projectSize,
    isProject: true,
    x: 0,
    y: 0,
    fx: 0, // Fixar permanentemente
    fy: 0,
  });
  
  // Sempre usar distribuição uniforme (simétrica)
  console.log('[MindMap] Distribution: UNIFORM (symmetric)');
  
  // Calcular peso total (sempre 1 por seção)
  const weights = sections.map(s => calculateSubtreeWeight(s));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let currentAngle = -Math.PI / 2; // Começar no topo
  
  // Função recursiva para posicionar seções
  function positionSections(
    secs: SectionWithChildren[],
    parentId: string | null,
    parentX: number,
    parentY: number,
    level: number,
    sectorStart: number,
    sectorEnd: number
  ) {
    if (secs.length === 0) return;
    
    const nodeSize = getNodeSize(level, config);
    const sectorSize = sectorEnd - sectorStart;
    
    // Calcular pesos (sempre uniforme)
    const weights = secs.map(s => calculateSubtreeWeight(s));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    let currentAngle = sectorStart;
    
    secs.forEach((section, index) => {
      const weight = weights[index];
      const subSectorSize = (weight / totalWeight) * sectorSize;
      const subSectorStart = currentAngle;
      const subSectorEnd = currentAngle + subSectorSize;
      const angle = subSectorStart + (subSectorSize / 2);
      
      currentAngle += subSectorSize;
      
      // Calcular raio dinâmico baseado no tamanho dos nós pai e filho
      let radius;
      if (level === 0) {
        radius = mainOrbitRadius;
      } else {
        // Para sub-níveis, calcular baseado no tamanho do pai e do filho
        const parentSize = getNodeSize(level - 1, config);
        const childSize = nodeSize;
        const levelMargin = (config as any).spacing?.levelMargin || 60;
        const baseSubRadius = (parentSize / 2) + (childSize / 2) + levelMargin;
        radius = baseSubRadius / Math.pow(1.2, level - 1);
      }
      
      // Calcular posição orbital
      const x = parentX + radius * Math.cos(angle);
      const y = parentY + radius * Math.sin(angle);
      
      // Adicionar nó com posição inicial
      // Em modo uniforme, fixar apenas nível 0 para simetria das seções principais
      const nodeData: any = {
        id: section.id,
        level,
        size: nodeSize,
        x,
        y,
      };
      
      // Fixar level 0 para manter simetria - física posiciona subsections
      if (level === 0) {
        nodeData.fx = x;
        nodeData.fy = y;
      }
      
      nodes.push(nodeData);
      
      // Adicionar link com distância = raio orbital calculado
      if (parentId) {
        links.push({
          source: parentId,
          target: section.id,
          distance: radius, // Usar o raio calculado como distância do link
        });
      }
      
      // Processar filhos recursivamente
      if (section.subsections && section.subsections.length > 0) {
        positionSections(
          section.subsections,
          section.id,
          x,
          y,
          level + 1,
          subSectorStart,
          subSectorEnd
        );
      }
    });
  }
  
  // Posicionar seções principais
  const sectorAngles: any[] = [];
  sections.forEach((section, index) => {
    const weight = weights[index];
    const sectorSize = (weight / totalWeight) * 2 * Math.PI;
    const sectorStart = currentAngle;
    const sectorEnd = currentAngle + sectorSize;
    
    sectorAngles.push({
      section: section.title,
      weight,
      sectorSize: (sectorSize * 180 / Math.PI).toFixed(1) + '°',
      start: (sectorStart * 180 / Math.PI).toFixed(1) + '°',
      end: (sectorEnd * 180 / Math.PI).toFixed(1) + '°',
    });
    
    currentAngle += sectorSize;
    
    positionSections(
      [section],
      'project-center',
      centerX,
      centerY,
      0,
      sectorStart,
      sectorEnd
    );
  });
  
  // PASSO 2: APLICAR FÍSICA PARA RESOLVER COLISÕES
  const { link, collision, simulation: simConfig } = MINDMAP_CONFIG.physics;
  
  // Usar parâmetros ajustáveis da configuração
  const physicsConfig = (config as any).physics?.simulation || {};
  const linkStrength = physicsConfig.linkStrength ?? 1;
  const collisionStrength = physicsConfig.collisionStrength ?? 0.3;
  const simulationIterations = physicsConfig.iterations ?? 130;
  
  console.log('[MindMap] Physics:', { linkStrength, collisionStrength, iterations: simulationIterations });
  
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id((d: any) => d.id)
      .distance((d: any) => d.distance)
      .strength(linkStrength)
    )
    .force('charge', null)
    .force('collision', d3.forceCollide()
      .radius((d: any) => {
        const baseMargin = d.isProject ? collision.radiusMargin.project : collision.radiusMargin.section;
        const proportionalMargin = (d.size / 2) * 0.15;
        return (d.size / 2) + baseMargin + proportionalMargin;
      })
      .strength(collisionStrength)
      .iterations(collision.iterations)
    )
    .force('center', null)
    .force('radial', null);
  
  simulation.stop();
  for (let i = 0; i < simulationIterations; i++) {
    simulation.tick();
  }
  
  // Extrair posições finais
  nodes.forEach(node => {
    if (node.id !== 'project-center') {
      positions.set(node.id, {
        x: node.x || 0,
        y: node.y || 0,
        calculatedSize: node.size,
      });
    }
  });
  
  return positions;
}

// Função recursiva para processar seções e subseções
function processSections(
  sections: SectionWithChildren[],
  allSections: Section[],
  parentId: string | null = null,
  level: number = 0,
  positions: Map<string, { x: number; y: number; calculatedSize?: number }>,
  config: typeof MINDMAP_CONFIG = MINDMAP_CONFIG
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Helper para obter edge config do nível correto (usa array dinâmico se disponível)
  const getLevelEdgeConfig = (lvl: number) => {
    // Tentar usar array de níveis dinâmicos
    const configWithLevels = config as any;
    if (configWithLevels.levels && configWithLevels.levels.length > 0) {
      // Se level existe no array, usar; senão, pegar o último nível
      const levelConfig = configWithLevels.levels[lvl] || configWithLevels.levels[configWithLevels.levels.length - 1];
      return levelConfig.edge;
    }
    
    // Fallback para sistema antigo
    switch (lvl) {
      case 0:
        return config.sections.edge;
      case 1:
        return config.subsections.edge;
      default:
        return config.deepSubsections.edge;
    }
  };

  sections.forEach((section) => {
    const positionData = positions.get(section.id) || { x: 0, y: 0 };
    const { x, y, calculatedSize } = positionData;
    
    // ReactFlow usa position como canto superior esquerdo, não centro!
    // Ajustar para centralizar o nó: subtrair metade do tamanho
    const nodeSize = calculatedSize || 50;
    const adjustedX = x - (nodeSize / 2);
    const adjustedY = y - (nodeSize / 2);
    
    // Criar node
    nodes.push({
      id: section.id,
      type: 'sectionNode',
      position: { x: adjustedX, y: adjustedY },
      data: {
        label: section.title,
        content: section.content || "",
        level,
        hasSubsections: (section.subsections?.length || 0) > 0,
        isSelected: false, // Será atualizado depois
        calculatedSize, // Passar tamanho calculado
        customColor: section.color, // Cor customizada
      },
    });

    // Criar edge hierárquica (pai -> filho)
    // A config da edge vem do nível do PAI (origem da linha), não do filho
    if (parentId) {
      const edgeConfig = getLevelEdgeConfig(level - 1); // level-1 = nível do pai
      
      // Para edges animadas, precisa ter strokeDasharray para a animação ser visível
      const needsDashPattern = edgeConfig.animated || edgeConfig.dashed;
      const dashValue = edgeConfig.animated 
        ? (edgeConfig.dashPattern || 5) * 15  // Animado: valor fixo maior
        : edgeConfig.dashPattern;              // Estático: valor configurado
      
      edges.push({
        id: `${parentId}-${section.id}`,
        source: parentId,
        target: section.id,
        type: 'straight',
        animated: edgeConfig.animated,
        style: { 
          stroke: edgeConfig.color, 
          strokeWidth: edgeConfig.strokeWidth,
          ...(needsDashPattern && { strokeDasharray: dashValue }),
        },
        data: {
          originalStyle: {
            stroke: edgeConfig.color,
            strokeWidth: edgeConfig.strokeWidth,
            strokeDasharray: needsDashPattern ? dashValue : undefined,
            animated: edgeConfig.animated,
          },
        },
      });
    }

    // REMOVIDO: Não mostrar conexões de referência por padrão
    // Será implementado no futuro quando houver seleção de nó
    // const references = extractSectionReferences(section.content || "");

    // Processar subseções recursivamente
    if (section.subsections && section.subsections.length > 0) {
      const subResult = processSections(section.subsections, allSections, section.id, level + 1, positions, config);
      nodes.push(...subResult.nodes);
      edges.push(...subResult.edges);
    }
  });

  return { nodes, edges };
}

// Custom Node Component - Seção/Subseção
function SectionNode({ data }: { data: any }) {
  const CONFIG = useContext(ConfigContext);
  
  // Obter zoom atual para controlar visibilidade da label
  const zoom = useStore((state) => state.transform[2]);
  
  // Helper: Obter config do nível (usa array dinâmico se disponível)
  const getLevelConfig = (level: number) => {
    // Tentar usar array de níveis dinâmicos
    const configWithLevels = CONFIG as any;
    if (configWithLevels.levels && configWithLevels.levels.length > 0) {
      // Se level existe no array, usar; senão, pegar o último nível (para 2+, 3+, etc)
      const levelConfig = configWithLevels.levels[level] || configWithLevels.levels[configWithLevels.levels.length - 1];
      return {
        node: {
          color: levelConfig.node.color || "#a855f7",
          textColor: levelConfig.node.textColor || "#ffffff",
          padding: levelConfig.node.padding || 0.10,
          borderColor: levelConfig.node.borderColor || "#fbbf24",
          borderWidth: levelConfig.node.borderWidth || 2,
          shadowColor: levelConfig.node.shadowColor || "rgba(0,0,0,0.3)",
          selected: levelConfig.node.selected || {
            borderColor: "#fbbf24",
            borderWidth: 4,
            glowColor: "rgba(168, 85, 247, 0.6)",
            scale: 1.15,
          },
          zoomOnClick: levelConfig.node.zoomOnClick || 1.2,
        },
        edge: levelConfig.edge,
      };
    }
    
    // Fallback para sistema antigo (sections/subsections/deepSubsections)
    switch (level) {
      case 0:
        return CONFIG.sections;
      case 1:
        return CONFIG.subsections;
      default:
        return CONFIG.deepSubsections;
    }
  };
  
  const nodeConfig = getLevelConfig(data.level).node;
  // Usar tamanho calculado se disponível, senão calcular dinamicamente
  const size = data.calculatedSize || getNodeSize(data.level, CONFIG);
  
  // Calcular font-size automaticamente usando configurações customizadas ou padrões
  const hasCustomFontSize = typeof (CONFIG as any).nodeSize?.baseFontSize === 'number';
  const baseFontSize = hasCustomFontSize 
    ? (CONFIG as any).nodeSize.baseFontSize 
    : CONFIG.fonts.section.sizePercent * size;
  const minFontSize = (CONFIG as any).nodeSize?.minFontSize || CONFIG.fonts.section.minSize;
  
  // Se baseFontSize customizado: escalar proporcionalmente (base 100px) sem limite máximo
  // Se automático: usar porcentagem com limites min/max
  const calculatedFontSize = hasCustomFontSize
    ? Math.max(minFontSize, baseFontSize * (size / 100)) // Sem maxFontSize quando customizado
    : Math.max(minFontSize, Math.min(CONFIG.fonts.section.maxSize, size * CONFIG.fonts.section.sizePercent));
  
  const fontSize = `${calculatedFontSize}px`;
  
  // Usar cor customizada se disponível, senão usar cor padrão do nível
  const bgColor = data.customColor || nodeConfig.color;
  const isSelected = data.isSelected;
  const isInPath = data.isInPath; // Nó está no caminho mas não é o selecionado
  const isFaded = data.isFaded; // Nó não está no caminho e deve ser esmaecido
  const isReference = data.isReference; // Nó é referenciado pelo nó selecionado
  
  // Obter configurações do fade effect e references
  const fadeConfig = CONFIG.fadeEffect || { enabled: false, opacity: 0.3, grayscale: 50, blur: 1 };
  const refConfig = CONFIG.references || { enabled: true, nodeHighlight: { enabled: true, borderColor: '#3b82f6', borderWidth: 3 } };

  // Aplicar estilos de seleção
  const selectedStyles = isSelected ? nodeConfig.selected : null;
  const finalSize = isSelected && selectedStyles ? size * selectedStyles.scale : size;
  
  // Lógica de borda
  const hasChildrenBorderConfig = (nodeConfig as any).hasChildrenBorder || { enabled: false };
  let finalBorderColor: string;
  let finalBorderWidthConfig: number;
  let borderDashed = false;
  let borderDashPattern = '';
  
  if (isSelected && selectedStyles) {
    // Selecionado: usar estilos de seleção
    finalBorderColor = selectedStyles.borderColor;
    finalBorderWidthConfig = selectedStyles.borderWidth;
  } else if (data.hasSubsections && hasChildrenBorderConfig.enabled) {
    // Tem filhos e borda habilitada: usar configuração hasChildrenBorder
    finalBorderColor = hasChildrenBorderConfig.color || nodeConfig.borderColor;
    finalBorderWidthConfig = hasChildrenBorderConfig.width || nodeConfig.borderWidth;
    borderDashed = hasChildrenBorderConfig.dashed || false;
    borderDashPattern = hasChildrenBorderConfig.dashPattern || '5 5';
  } else {
    // Sem borda
    finalBorderColor = nodeConfig.borderColor;
    finalBorderWidthConfig = 0;
  }
  
  // Calcular borda proporcional ao tamanho do nó (baseado em 100px)
  // Ex: nó 100px com border 4 = 4px; nó 50px com border 4 = 2px
  const finalBorderWidth = (finalSize / 100) * finalBorderWidthConfig;
  
  // Glow usa a mesma cor da bolinha quando selecionada
  const glowColor = isSelected ? bgColor : null;
  
  // Calcular glow proporcional ao tamanho da bolinha (baseado em 100px = 20px, 40px, 60px de glow)
  const glowSize1 = (finalSize / 100) * 20;
  const glowSize2 = (finalSize / 100) * 40;
  const glowSize3 = (finalSize / 100) * 60;
  
  // Calcular tamanho aparente na tela (size * zoom)
  const apparentSize = finalSize * zoom;
  // Só mostrar label se tamanho aparente for maior que threshold
  const showLabel = apparentSize > CONFIG.zoom.labelVisibility.section;

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: finalSize,
          height: finalSize,
          borderRadius: '50%',
          backgroundColor: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: nodeConfig.textColor,
          fontWeight: (CONFIG as any).nodeSize?.fontWeight || 'bold',
          fontSize,
          fontFamily: (CONFIG as any).nodeSize?.fontFamily || 'system-ui',
          textAlign: 'center',
          padding: `${nodeConfig.padding * 100}%`,
          cursor: 'pointer',
          // Usar box-shadow para borda (fica por fora e não afeta layout)
          boxShadow: glowColor 
            ? `0 4px 6px ${nodeConfig.shadowColor}, 0 0 ${glowSize1}px ${glowColor}, 0 0 ${glowSize2}px ${glowColor}, 0 0 ${glowSize3}px ${glowColor}${finalBorderWidth > 0 ? `, 0 0 0 ${finalBorderWidth}px ${finalBorderColor}` : ''}`
            : isReference && (refConfig as any).nodeHighlight?.enabled
              ? `0 4px 6px ${nodeConfig.shadowColor}, 0 0 0 ${(finalSize / 100) * ((refConfig as any).nodeHighlight.borderWidth || 3)}px ${(refConfig as any).nodeHighlight.borderColor || '#3b82f6'}${finalBorderWidth > 0 ? `, 0 0 0 ${finalBorderWidth}px ${finalBorderColor}` : ''}` // Destaque azul para referências
              : isInPath
                ? `0 4px 6px ${nodeConfig.shadowColor}, 0 0 0 ${(finalSize / 100) * 3}px rgba(251, 191, 36, 0.6)${finalBorderWidth > 0 ? `, 0 0 0 ${finalBorderWidth}px ${finalBorderColor}` : ''}` // Destaque sutil: borda amarela semi-transparente
                : finalBorderWidth > 0
                  ? `0 4px 6px ${nodeConfig.shadowColor}, 0 0 0 ${finalBorderWidth}px ${finalBorderColor}`
                  : `0 4px 6px ${nodeConfig.shadowColor}`,
          transition: data.isDragging ? 'none' : (data.isReturning ? 'all 0.3s ease' : 'all 0.3s ease'),
          wordBreak: CONFIG.fonts.wordBreak ? 'break-word' : 'normal',
          overflowWrap: 'break-word',
          hyphens: 'auto',
          lineHeight: CONFIG.fonts.lineHeight,
          // Aplicar fade effect se o nó não está no caminho
          opacity: (isFaded && fadeConfig.enabled) ? fadeConfig.opacity : 1,
          filter: (isFaded && fadeConfig.enabled) 
            ? `grayscale(${fadeConfig.grayscale}%) blur(${fadeConfig.blur}px)` 
            : 'none',
        }}
        className={data.isDragging ? '' : 'hover:scale-110'}
      >
        {showLabel && data.label}
      </div>
    </div>
  );
}

// Custom Node Component - Projeto Central
function ProjectNode({ data }: { data: any }) {
  const CONFIG = useContext(ConfigContext);
  
  // Obter zoom atual
  const zoom = useStore((state) => state.transform[2]);
  
  const config = CONFIG.project.node;
  const isSelected = data.isSelected;
  const isInPath = data.isInPath; // Nó está no caminho mas não é o selecionado
  const isFaded = data.isFaded; // Nó não está no caminho e deve ser esmaecido
  const isReference = data.isReference; // Nó é referenciado pelo nó selecionado
  
  // Obter configurações do fade effect e references
  const fadeConfig = CONFIG.fadeEffect || { enabled: false, opacity: 0.3, grayscale: 50, blur: 1 };
  const refConfig = CONFIG.references || { enabled: true, nodeHighlight: { enabled: true, borderColor: '#3b82f6', borderWidth: 3 } };
  
  // Aplicar estilos de seleção
  const selectedStyles = isSelected ? config.selected : null;
  const finalSize = isSelected && selectedStyles ? config.size * selectedStyles.scale : config.size;
  const finalBorderWidthConfig = isSelected && selectedStyles ? selectedStyles.borderWidth : 0;
  const finalBorderColor = isSelected && selectedStyles ? selectedStyles.borderColor : 'transparent';
  const glowColor = isSelected && selectedStyles ? selectedStyles.glowColor : config.colors.glow;
  
  // Calcular borda proporcional ao tamanho do nó (baseado em 100px)
  const finalBorderWidth = (finalSize / 100) * finalBorderWidthConfig;
  
  // Calcular glow proporcional ao tamanho da bolinha (baseado em 100px = 60px de glow)
  const glowSize = (finalSize / 100) * 60;
  
  // Calcular font-size automaticamente usando configurações customizadas ou padrões
  const hasCustomFontSize = typeof (CONFIG as any).nodeSize?.baseFontSize === 'number';
  const baseFontSize = hasCustomFontSize 
    ? (CONFIG as any).nodeSize.baseFontSize 
    : CONFIG.fonts.project.sizePercent * finalSize;
  const minFontSize = (CONFIG as any).nodeSize?.minFontSize || CONFIG.fonts.project.minSize;
  
  // Se baseFontSize customizado: escalar proporcionalmente (base 100px) sem limite máximo
  // Se automático: usar porcentagem com limites min/max
  const calculatedFontSize = hasCustomFontSize
    ? Math.max(minFontSize, baseFontSize * (finalSize / 100))
    : Math.max(minFontSize, Math.min(CONFIG.fonts.project.maxSize, finalSize * CONFIG.fonts.project.sizePercent));
  
  const fontSize = `${calculatedFontSize}px`;
  
  // Calcular se deve mostrar label
  const apparentSize = finalSize * zoom;
  const showLabel = apparentSize > CONFIG.zoom.labelVisibility.project;
  
  const baseSize = config.size;
  
  return (
    <div style={{ width: baseSize, height: baseSize, position: 'relative' }}>
      <Handle type="source" position={Position.Top} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Left} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: finalSize,
          height: finalSize,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${config.colors.gradient.from} 0%, ${config.colors.gradient.to} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: config.colors.text,
          fontWeight: (CONFIG as any).nodeSize?.fontWeight || 'bold',
          fontSize,
          fontFamily: (CONFIG as any).nodeSize?.fontFamily || 'system-ui',
          textAlign: 'center',
          padding: `${config.padding * 100}%`,
          cursor: 'pointer',
          boxShadow: isSelected
            ? finalBorderWidth > 0
              ? `0 8px 16px ${config.colors.shadow}, 0 0 ${glowSize}px ${glowColor}, 0 0 0 ${finalBorderWidth}px ${finalBorderColor}`
              : `0 8px 16px ${config.colors.shadow}, 0 0 ${glowSize}px ${glowColor}`
            : isReference && (refConfig as any).nodeHighlight?.enabled
              ? `0 8px 16px ${config.colors.shadow}, 0 0 ${glowSize}px ${glowColor}, 0 0 0 ${(finalSize / 100) * ((refConfig as any).nodeHighlight.borderWidth || 3)}px ${(refConfig as any).nodeHighlight.borderColor || '#3b82f6'}` // Destaque azul para referências
              : isInPath
                ? `0 8px 16px ${config.colors.shadow}, 0 0 ${glowSize}px ${glowColor}, 0 0 0 ${(finalSize / 100) * 3}px rgba(251, 191, 36, 0.6)` // Destaque sutil para nós no caminho
                : `0 8px 16px ${config.colors.shadow}, 0 0 ${glowSize}px ${glowColor}`,
          transition: data.isDragging ? 'none' : (data.isReturning ? 'all 0.3s ease' : 'all 0.3s ease'),
          wordBreak: CONFIG.fonts.wordBreak ? 'break-word' : 'normal',
          overflowWrap: 'break-word',
          hyphens: 'auto',
          lineHeight: CONFIG.fonts.lineHeight,
          // Aplicar fade effect se o nó não está no caminho
          opacity: (isFaded && fadeConfig.enabled) ? fadeConfig.opacity : 1,
          filter: (isFaded && fadeConfig.enabled) 
            ? `grayscale(${fadeConfig.grayscale}%) blur(${fadeConfig.blur}px)` 
            : 'none',
        }}
        className={data.isDragging ? '' : 'hover:scale-110'}
      >
        {showLabel && (
          <div>
            <div>{config.icon}</div>
            <div style={{ marginTop: '8px' }}>{data.label}</div>
          </div>
        )}
        {!showLabel && <div>{config.icon}</div>}
      </div>
    </div>
  );
}

const nodeTypes = Object.freeze({
  sectionNode: SectionNode,
  projectNode: ProjectNode,
});

// Componente para renderizar markdown com referências clicáveis no mapa mental
function MarkdownWithMapReferences({ 
  content, 
  sections, 
  onSectionClick 
}: { 
  content: string; 
  sections: Section[];
  onSectionClick: (sectionId: string) => void;
}) {
  // Processar conteúdo substituindo referências por links clicáveis
  const processedContent = content.replace(/\$\[([^\]]+)\]/g, (match, ref) => {
    const rawContent = ref.trim();
    const isId = rawContent.startsWith('#');
    
    // Criar objeto SectionReference conforme esperado pela função findSection
    const sectionRef: SectionReference = {
      raw: match,
      refType: isId ? 'id' : 'name',
      refValue: isId ? rawContent.substring(1) : rawContent,
      startIndex: 0,
      endIndex: 0
    };
    
    const section = findSection(sections, sectionRef);
    if (section) {
      return `[${section.title}](#ref-${section.id})`;
    }
    return match;
  });

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, href, children, ...props }) => {
            // Se é uma referência de seção
            if (href && href.startsWith('#ref-')) {
              const sectionId = href.replace('#ref-', '');
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onSectionClick(sectionId);
                  }}
                  className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                >
                  {children}
                </button>
              );
            }
            // Link normal
            return (
              <a href={href} {...props} className="text-blue-400 hover:text-blue-300">
                {children}
              </a>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

// Componente interno que tem acesso ao contexto do ReactFlow
function FlowContent({ projectId }: MindMapClientProps) {
  const router = useRouter();
  const { getProject } = useProjectStore();
  const project = getProject(projectId);
  const { setCenter, fitView } = useReactFlow(); // Agora funciona porque está dentro do ReactFlow
  
  // Merge de configurações: custom settings do projeto sobre defaults
  const config = useMemo(() => 
    deepMerge(MINDMAP_CONFIG, project?.mindMapSettings),
    [project?.mindMapSettings]
  );
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Section | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [maxZoom, setMaxZoom] = useState<number>(8);
  
  // Obter zoom atual para cálculos proporcionais
  const currentZoom = useStore((state) => state.transform[2]);
  
  // Estado para guardar posições originais durante o drag
  const [originalPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  
  // Estado para threshold de drag (evitar ativar drag em clicks)
  const [dragStartMouse] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [dragActivated] = useState<Map<string, boolean>>(new Map());
  const DRAG_THRESHOLD = 5; // pixels mínimos de movimento para considerar drag
  
  // Estados de busca
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Set<string>>(new Set());

  // Função para realizar busca
  const performSearch = useCallback((term: string) => {
    if (!term.trim() || !project) {
      setSearchResults(new Set());
      return;
    }
    
    const lowerTerm = term.toLowerCase();
    const results = new Set<string>();
    
    // Buscar em todas as seções
    (project.sections || []).forEach(section => {
      const titleMatch = section.title.toLowerCase().includes(lowerTerm);
      const contentMatch = section.content?.toLowerCase().includes(lowerTerm);
      
      if (titleMatch || contentMatch) {
        results.add(section.id);
      }
    });
    
    setSearchResults(results);
  }, [project]);

  // Effect para realizar busca quando searchTerm muda
  useEffect(() => {
    performSearch(searchTerm);
  }, [searchTerm, performSearch]);

  // Ler parâmetro de foco da URL
  useEffect(() => {
    if (typeof window !== 'undefined' && nodes.length > 0 && !selectedNodeId) {
      const params = new URLSearchParams(window.location.search);
      const focusId = params.get('focus');
      if (focusId) {
        // Encontrar o node
        const nodeToFocus = nodes.find(n => n.id === focusId);
        if (nodeToFocus) {
          // Encontrar a seção
          const section = project?.sections?.find((s: Section) => s.id === focusId);
          if (section) {
            setSelectedNode(section);
            setSelectedNodeId(focusId); // IMPORTANTE: isso aciona os destaques
          }
          
          // Calcular zoom correto baseado na config
          const targetSize = config.zoom?.onClickTargetSize || 200;
          let nodeSize = 100;
          
          if (nodeToFocus.id === 'project-center') {
            nodeSize = config.project.node.size;
          } else if (nodeToFocus.data.calculatedSize) {
            nodeSize = nodeToFocus.data.calculatedSize;
          } else if (nodeToFocus.data.level !== undefined) {
            nodeSize = getNodeSize(nodeToFocus.data.level, config);
          }
          
          const zoomLevel = targetSize / nodeSize;
          
          // Calcular posição central do node (position é o canto superior esquerdo)
          const centerX = nodeToFocus.position.x + (nodeSize / 2);
          const centerY = nodeToFocus.position.y + (nodeSize / 2);
          
          // Centralizar câmera no node com zoom
          setTimeout(() => {
            setCenter(centerX, centerY, {
              zoom: zoomLevel,
              duration: 800,
            });
          }, 300);
        }
      }
    }
  }, [nodes.length, setCenter, project, selectedNodeId, config]);

  useEffect(() => {
    if (!project) return;

    // Construir árvore de seções a partir do array flat
    const sectionTree = buildSectionTree(project.sections || []);
    
    // Calcular depth máximo e maxZoom necessário
    const maxDepth = calculateMaxDepth(sectionTree);
    const calculatedMaxZoom = calculateMaxZoom(maxDepth, config);
    setMaxZoom(calculatedMaxZoom);
    console.log(`Max depth: ${maxDepth}, Max zoom: ${calculatedMaxZoom.toFixed(2)}x, Target size: ${config.zoom.targetApparentSize}px`);
    
    // Calcular posições em layout orbital
    const positions = calculateNodePositions(sectionTree, config);
    
    // Processar seções e criar nodes/edges
    const { nodes: flowNodes, edges: flowEdges } = processSections(
      sectionTree,
      project.sections || [],
      null,
      0,
      positions,
      config
    );

    // Adicionar node central do PROJETO
    // ReactFlow usa position como canto superior esquerdo - ajustar para centralizar
    const projectSize = config.project.node.size;
    const projectNode: Node = {
      id: 'project-center',
      type: 'projectNode',
      position: { x: -(projectSize / 2), y: -(projectSize / 2) },
      data: {
        label: project.title,
        description: project.description || "",
        isProject: true,
        isSelected: false,
      },
    };

    // Adicionar edges do projeto para cada seção principal (sem parentId)
    const projectEdgeConfig = config.project.edge;
    
    // Para edges animadas, precisa ter strokeDasharray para a animação ser visível
    const needsDashPattern = projectEdgeConfig.animated || projectEdgeConfig.dashed;
    const dashValue = projectEdgeConfig.animated 
      ? (projectEdgeConfig.dashPattern || 5) * 15  // Animado: valor fixo maior
      : projectEdgeConfig.dashPattern;              // Estático: valor configurado
    
    const projectEdges: Edge[] = (project.sections || [])
      .filter(s => !s.parentId)
      .map(section => ({
        id: `project-${section.id}`,
        source: 'project-center',
        target: section.id,
        type: 'straight',
        animated: projectEdgeConfig.animated,
        style: { 
          stroke: projectEdgeConfig.color, 
          strokeWidth: projectEdgeConfig.strokeWidth,
          ...(needsDashPattern && { strokeDasharray: dashValue }),
        },
        data: {
          originalStyle: {
            stroke: projectEdgeConfig.color,
            strokeWidth: projectEdgeConfig.strokeWidth,
            strokeDasharray: needsDashPattern ? dashValue : undefined,
            animated: projectEdgeConfig.animated,
          },
        },
      }));

    console.log('Project Edges:', projectEdges.length);
    console.log('Flow Edges:', flowEdges.length);
    console.log('Total Edges:', [...projectEdges, ...flowEdges].length);

    setNodes([projectNode, ...flowNodes]);
    setEdges([...projectEdges, ...flowEdges]);
  }, [project, config, setNodes, setEdges]);

  // Efeito para atualizar destaque das edges quando houver seleção
  useEffect(() => {
    const fadeConfig = config.fadeEffect || { enabled: false, opacity: 0.3, grayscale: 50, blur: 1 };
    
    setEdges((eds) => {
      if (!selectedNodeId) {
        // Sem seleção: resetar todas as edges baseado na configuração ATUAL (não originalStyle salvo)
        return eds.map((edge) => {
          // Ignorar edges de referência - elas são gerenciadas pelo outro useEffect
          if (edge.id.startsWith('ref-')) {
            return edge;
          }
          
          // Determinar qual config usar baseado no source
          const isProjectEdge = edge.source === 'project-center';
          
          let edgeConfig;
          if (isProjectEdge) {
            edgeConfig = config.project.edge;
          } else {
            // Descobrir nível do nó source para usar a config correta
            const sourceNode = nodes.find(n => n.id === edge.source);
            const sourceLevel = sourceNode?.data?.level ?? 0;
            
            // Usar config do nível apropriado
            if (sourceLevel === 0) {
              edgeConfig = config.sections.edge;
            } else if (sourceLevel === 1) {
              edgeConfig = config.subsections.edge;
            } else {
              edgeConfig = config.deepSubsections.edge;
            }
          }
          
          // Para edges animadas, precisa ter strokeDasharray para a animação ser visível
          const needsDashPattern = edgeConfig.animated || edgeConfig.dashed;
          const dashValue = edgeConfig.animated 
            ? (edgeConfig.dashPattern || 5) * 15  // Animado: valor fixo maior
            : edgeConfig.dashPattern;              // Estático: valor configurado
          
          return {
            ...edge,
            animated: edgeConfig.animated || false,
            style: {
              stroke: edgeConfig.color || '#94a3b8',
              strokeWidth: edgeConfig.strokeWidth || 0.5,
              strokeDasharray: needsDashPattern ? dashValue : undefined,
              opacity: 1, // Resetar opacity quando não há seleção
            },
          };
        });
      }

      // Com seleção: encontrar TODAS as edges no caminho até o SOL
      // 1. Construir mapa de parent para cada nó (ignorar edges de referência)
      const parentMap = new Map<string, string>();
      eds.forEach(edge => {
        if (!edge.id.startsWith('ref-')) { // Ignorar edges de referência
          // target é o filho, source é o pai
          parentMap.set(edge.target, edge.source);
        }
      });

      // 2. Encontrar caminho do nó selecionado até o SOL
      const pathToRoot = new Set<string>(); // IDs das edges no caminho
      let currentNode = selectedNodeId;
      
      while (currentNode) {
        const parent = parentMap.get(currentNode);
        if (parent) {
          // Encontrar edge entre currentNode e parent (ignorar refs)
          const edgeId = eds.find(e => 
            !e.id.startsWith('ref-') &&
            e.source === parent && e.target === currentNode
          )?.id;
          if (edgeId) {
            pathToRoot.add(edgeId);
          }
          currentNode = parent;
        } else {
          break; // Chegou no SOL ou nó sem pai
        }
      }

      // 3. Encontrar filhos diretos do nó selecionado
      const directChildren = new Set<string>(); // IDs das edges para filhos diretos
      eds.forEach(edge => {
        if (edge.source === selectedNodeId && !edge.id.startsWith('ref-')) {
          directChildren.add(edge.id);
        }
      });

      // 4. Aplicar highlight nas edges do caminho E nos filhos diretos
      return eds.map((edge) => {
        // Ignorar edges de referência - elas mantêm seu estilo azul/tracejado
        if (edge.id.startsWith('ref-')) {
          return edge;
        }
        
        const original = edge.data?.originalStyle;
        const isInPath = pathToRoot.has(edge.id);
        const isDirectChild = directChildren.has(edge.id);

        if (isInPath || isDirectChild) {
          // Edge no caminho: usar configurações de highlight
          // Determinar qual config usar baseado no source
          const isProjectEdge = edge.source === 'project-center';
          
          let highlightConfig;
          if (isProjectEdge) {
            highlightConfig = config.project.edge.highlighted;
          } else {
            // Descobrir nível do nó source para usar a config correta
            const sourceNode = nodes.find(n => n.id === edge.source);
            const sourceLevel = sourceNode?.data?.level ?? 0;
            
            // Usar config do nível apropriado
            if (sourceLevel === 0) {
              highlightConfig = config.sections.edge.highlighted;
            } else if (sourceLevel === 1) {
              highlightConfig = config.subsections.edge.highlighted;
            } else {
              highlightConfig = config.deepSubsections.edge.highlighted;
            }
          }
          
          // Calcular strokeWidth proporcional ao zoom (mantém espessura visual constante)
          const baseStrokeWidth = highlightConfig.strokeWidth || 1;
          const proportionalStrokeWidth = baseStrokeWidth / Math.max(currentZoom, 0.1);
          
          // Para animação: usar valor fixo maior para que a animação seja visível
          // Para estático: usar valor proporcional ao zoom
          const baseDashSize = highlightConfig.dashPattern || 5;
          let dashValue;
          if (highlightConfig.animated) {
            // Animado: valor fixo MUITO grande para animação ser visível em qualquer zoom
            // Com bolinhas de 1000px e zoom baixo, precisa ser bem grande
            dashValue = baseDashSize * 15; // Ex: 5 * 15 = 75px
          } else {
            // Estático: proporcional ao zoom com limites
            const rawDash = baseDashSize / Math.max(currentZoom, 0.01);
            dashValue = Math.min(Math.max(rawDash, 5), 50);
          }
          
          return {
            ...edge,
            animated: highlightConfig.animated,
            style: {
              strokeWidth: proportionalStrokeWidth,
              stroke: highlightConfig.color,
              strokeDasharray: `${dashValue},${dashValue}`,
              opacity: 1, // Edges destacadas ficam sempre visíveis
            },
          };
        }

        // Edge não conectada: usar estilo baseado na configuração ATUAL (não originalStyle salvo)
        const isProjectEdge = edge.source === 'project-center';
        
        let edgeConfig;
        if (isProjectEdge) {
          edgeConfig = config.project.edge;
        } else {
          // Descobrir nível do nó source para usar a config correta
          const sourceNode = nodes.find(n => n.id === edge.source);
          const sourceLevel = sourceNode?.data?.level ?? 0;
          
          // Usar config do nível apropriado
          if (sourceLevel === 0) {
            edgeConfig = config.sections.edge;
          } else if (sourceLevel === 1) {
            edgeConfig = config.subsections.edge;
          } else {
            edgeConfig = config.deepSubsections.edge;
          }
        }
        
        // Para edges animadas, precisa ter strokeDasharray para a animação ser visível
        const needsDashPattern = edgeConfig.animated || edgeConfig.dashed;
        const dashValue = edgeConfig.animated 
          ? (edgeConfig.dashPattern || 5) * 15  // Animado: valor fixo maior
          : edgeConfig.dashPattern;              // Estático: valor configurado
        
        // Aplicar fade effect nas edges que não estão no caminho
        const edgeOpacity = (fadeConfig.enabled) ? fadeConfig.opacity : 1;
        
        return {
          ...edge,
          animated: edgeConfig.animated || false,
          style: {
            stroke: edgeConfig.color || '#94a3b8',
            strokeWidth: edgeConfig.strokeWidth || 0.5,
            strokeDasharray: needsDashPattern ? dashValue : undefined,
            opacity: edgeOpacity, // Aplicar opacity reduzida nas edges não destacadas
          },
        };
      });
    });
  }, [selectedNodeId, setEdges, config, currentZoom, nodes]);

  // Efeito para marcar node selecionado visualmente (glow)
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: n.id === selectedNodeId },
      }))
    );
  }, [selectedNodeId, setNodes]);

  // Efeito para destacar nós no caminho (sem glow - destaque sutil) e referências
  useEffect(() => {
    const hasActiveSearch = searchTerm.trim().length > 0;
    
    if (!selectedNodeId) {
      // Sem seleção: verificar se há busca ativa
      if (hasActiveSearch) {
        // Aplicar fade baseado em busca
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            data: { 
              ...node.data, 
              isInPath: false, 
              isFaded: !searchResults.has(node.id) && node.id !== 'project-center',
              isReference: false,
              isSearchResult: searchResults.has(node.id),
            },
          }))
        );
      } else {
        // Sem busca: remover destaque de todos os nós
        setNodes((nds) => {
          const hasInPath = nds.some(n => n.data.isInPath || n.data.isFaded || n.data.isReference);
          if (!hasInPath) return nds; // Evitar update desnecessário
          
          return nds.map((node) => ({
            ...node,
            data: { ...node.data, isInPath: false, isFaded: false, isReference: false, isSearchResult: false },
          }));
        });
      }
      
      // Remover edges de referência (só se houver alguma)
      setEdges((eds) => {
        const hasRefs = eds.some(e => e.id.startsWith('ref-'));
        if (!hasRefs) return eds; // Evitar update desnecessário
        return eds.filter(e => !e.id.startsWith('ref-'));
      });
      return;
    }

    // Com seleção: encontrar todos os nós no caminho até o SOL
    // Construir mapa de parent para cada nó (usando edges - ignorar refs)
    const parentMap = new Map<string, string>();
    edges.forEach(edge => {
      if (!edge.id.startsWith('ref-')) { // Ignorar edges de referência
        parentMap.set(edge.target, edge.source);
      }
    });

    // Rastrear caminho do nó selecionado até o SOL
    const nodesInPath = new Set<string>();
    let currentNode = selectedNodeId;
    
    while (currentNode) {
      nodesInPath.add(currentNode);
      const parent = parentMap.get(currentNode);
      if (parent) {
        currentNode = parent;
      } else {
        break; // Chegou no SOL
      }
    }

    // Adicionar filhos diretos também
    edges.forEach(edge => {
      if (edge.source === selectedNodeId && !edge.id.startsWith('ref-')) {
        nodesInPath.add(edge.target);
      }
    });

    // Extrair referências do nó selecionado (para onde ele aponta)
    const referencedNodeIds = new Set<string>();
    const backlinksNodeIds = new Set<string>(); // Quem aponta para ele
    const refConfig = config.references || { enabled: true };
    
    if (refConfig.enabled && project?.sections) {
      // Encontrar a seção selecionada
      const selectedSection = project.sections.find((s: Section) => s.id === selectedNodeId);
      
      if (selectedSection) {
        // 1. Extrair referências que ele faz (saindo dele)
        if (selectedSection.content) {
          const refs = extractSectionReferences(selectedSection.content);
          
          // Encontrar IDs das seções referenciadas
          refs.forEach(ref => {
            const foundSection = findSection(project.sections || [], ref);
            if (foundSection) {
              referencedNodeIds.add(foundSection.id);
            }
          });
        }
        
        // 2. Encontrar quem faz referência a ele (backlinks)
        const backlinks = getBacklinks(selectedNodeId, project.sections || []);
        backlinks.forEach(link => {
          backlinksNodeIds.add(link.id);
        });
      }
    }

    // Atualizar edges de referência (só se necessário)
    const totalRefsCount = referencedNodeIds.size + backlinksNodeIds.size;
    if (totalRefsCount > 0) {
      const forwardEdgeIds = Array.from(referencedNodeIds).map(targetId => `ref-${selectedNodeId}-${targetId}`);
      const backwardEdgeIds = Array.from(backlinksNodeIds).map(sourceId => `ref-${sourceId}-${selectedNodeId}`);
      const allNewRefIds = [...forwardEdgeIds, ...backwardEdgeIds];
      
      setEdges((eds) => {
        // Verificar se as edges de referência mudaram
        const currentRefEdges = eds.filter(e => e.id.startsWith('ref-'));
        const currentRefIds = new Set(currentRefEdges.map(e => e.id));
        const newRefIds = new Set(allNewRefIds);
        
        // Se as refs não mudaram, não atualizar
        if (currentRefIds.size === newRefIds.size && 
            Array.from(newRefIds).every(id => currentRefIds.has(id))) {
          return eds;
        }
        
        // Criar edges de referência (saindo do nó selecionado)
        const forwardReferenceEdges: Edge[] = Array.from(referencedNodeIds).map(targetId => {
          // Calcular dashPattern consistente com outras edges
          const needsDashPattern = refConfig.edgeAnimated || refConfig.edgeDashed;
          const dashValue = refConfig.edgeAnimated 
            ? (refConfig.edgeDashPattern || 5) * 15  // Animado: valor fixo maior para visibilidade
            : refConfig.edgeDashPattern || 5;         // Estático: valor configurado
          
          const showIcon = refConfig.showIcon ?? true;
          const icon = refConfig.icon || '🔗';
          
          return {
            id: `ref-${selectedNodeId}-${targetId}`,
            source: selectedNodeId,
            target: targetId,
            type: 'default',
            animated: refConfig.edgeAnimated || false,
            label: showIcon ? icon : undefined,
            labelStyle: {
              fontSize: refConfig.iconSize || 32,
              fill: refConfig.edgeColor || '#3b82f6',
              fontWeight: 'bold',
            },
            labelBgStyle: {
              fill: 'transparent',
            },
            labelShowBg: false,
            style: {
              stroke: refConfig.edgeColor || '#3b82f6',
              strokeWidth: refConfig.edgeWidth || 2,
              strokeDasharray: needsDashPattern ? dashValue : undefined,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: refConfig.edgeColor || '#3b82f6',
              width: 20,
              height: 20,
            },
          };
        });

        // Criar edges de referência (chegando ao nó selecionado - backlinks)
        const backwardReferenceEdges: Edge[] = Array.from(backlinksNodeIds).map(sourceId => {
          const needsDashPattern = refConfig.edgeAnimated || refConfig.edgeDashed;
          const dashValue = refConfig.edgeAnimated 
            ? (refConfig.edgeDashPattern || 5) * 15
            : refConfig.edgeDashPattern || 5;
          
          const showIcon = refConfig.showIcon ?? true;
          const icon = refConfig.icon || '🔗';
          
          return {
            id: `ref-${sourceId}-${selectedNodeId}`,
            source: sourceId,
            target: selectedNodeId,
            type: 'default',
            animated: refConfig.edgeAnimated || false,
            label: showIcon ? icon : undefined,
            labelStyle: {
              fontSize: refConfig.iconSize || 32,
              fill: refConfig.edgeColor || '#3b82f6',
              fontWeight: 'bold',
            },
            labelBgStyle: {
              fill: 'transparent',
            },
            labelShowBg: false,
            style: {
              stroke: refConfig.edgeColor || '#3b82f6',
              strokeWidth: refConfig.edgeWidth || 2,
              strokeDasharray: needsDashPattern ? dashValue : undefined,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: refConfig.edgeColor || '#3b82f6',
              width: 20,
              height: 20,
            },
          };
        });

        const withoutOldRefs = eds.filter(e => !e.id.startsWith('ref-'));
        return [...withoutOldRefs, ...forwardReferenceEdges, ...backwardReferenceEdges];
      });
    } else {
      // Remover edges de referência se não há mais referências (só se houver alguma)
      setEdges((eds) => {
        const hasRefs = eds.some(e => e.id.startsWith('ref-'));
        if (!hasRefs) return eds;
        return eds.filter(e => !e.id.startsWith('ref-'));
      });
    }

    // Atualizar nodes para marcar quais estão no caminho, quais devem ficar esmaecidos, e quais são referências
    setNodes((nds) => {
      // Combinar todos os nós relacionados por referência (para frente E para trás)
      const allReferencedNodes = new Set([...referencedNodeIds, ...backlinksNodeIds]);
      const hasActiveSearch = searchTerm.trim().length > 0;
      
      // Verificar se precisa atualizar (evitar loop infinito)
      const needsUpdate = nds.some(node => {
        const shouldBeInPath = nodesInPath.has(node.id) && node.id !== selectedNodeId;
        const isSearchResult = searchResults.has(node.id);
        const shouldBeFaded = hasActiveSearch
          ? !isSearchResult && node.id !== 'project-center'
          : !nodesInPath.has(node.id) && !allReferencedNodes.has(node.id);
        const shouldBeReference = allReferencedNodes.has(node.id);
        return node.data.isInPath !== shouldBeInPath || 
               node.data.isFaded !== shouldBeFaded ||
               node.data.isReference !== shouldBeReference ||
               node.data.isSearchResult !== isSearchResult;
      });
      
      if (!needsUpdate) return nds; // Nada mudou, não atualizar
      
      return nds.map((node) => {
        const isSearchResult = searchResults.has(node.id);
        return {
          ...node,
          data: { 
            ...node.data, 
            isInPath: nodesInPath.has(node.id) && node.id !== selectedNodeId,
            // Se há busca ativa: fade nós que não são resultados
            // Se não há busca: usar lógica original (fade nós fora do caminho e não referenciados)
            isFaded: hasActiveSearch
              ? !isSearchResult && node.id !== 'project-center'
              : !nodesInPath.has(node.id) && !allReferencedNodes.has(node.id),
            isReference: allReferencedNodes.has(node.id),
            isSearchResult, // Nova flag para possíveis estilos específicos futuramente
          },
        };
      });
    });
  }, [selectedNodeId, config, project, searchResults, searchTerm]);


  // Handler para salvar posição original ao iniciar drag
  const onNodeDragStart = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.position) {
      originalPositions.set(node.id, { ...node.position });
    }
    // Salvar posição inicial do mouse
    dragStartMouse.set(node.id, { x: event.clientX, y: event.clientY });
    dragActivated.set(node.id, false);
    // NÃO marcar isDragging ainda - só quando passar do threshold
  }, [originalPositions, dragStartMouse, dragActivated]);

  // Handler para verificar threshold durante o drag
  const onNodeDrag = useCallback((event: React.MouseEvent, node: Node) => {
    const startMouse = dragStartMouse.get(node.id);
    if (!startMouse) return;
    
    // Calcular distância do mouse desde o início
    const distance = Math.sqrt(
      Math.pow(event.clientX - startMouse.x, 2) + 
      Math.pow(event.clientY - startMouse.y, 2)
    );
    
    // Se passou do threshold e ainda não ativou o drag, ativar agora
    if (distance > DRAG_THRESHOLD && !dragActivated.get(node.id)) {
      dragActivated.set(node.id, true);
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: {
                ...n.data,
                isDragging: true,
              },
            };
          }
          return n;
        })
      );
    }
  }, [dragStartMouse, dragActivated, setNodes, DRAG_THRESHOLD]);

  // Handler para resetar posição ao soltar o nó
  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    const wasActivated = dragActivated.get(node.id);
    const originalPos = originalPositions.get(node.id);
    
    // Só resetar posição se o drag foi realmente ativado (passou do threshold)
    if (wasActivated && originalPos) {
      // Resetar para posição original com transição suave
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              position: originalPos,
              data: {
                ...n.data,
                isDragging: false,
                isReturning: true,
              },
            };
          }
          return n;
        })
      );
      
      // Limpar flag de retorno após animação
      setTimeout(() => {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  isReturning: false,
                },
              };
            }
            return n;
          })
        );
      }, 300);
    }
    
    // Limpar estados
    originalPositions.delete(node.id);
    dragStartMouse.delete(node.id);
    dragActivated.delete(node.id);
  }, [originalPositions, dragStartMouse, dragActivated, setNodes]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Calcular zoom para que o nó apareça com o tamanho alvo na tela
    const targetSize = (config as any).zoom?.onClickTargetSize || 200; // Tamanho alvo em pixels na tela
    
    let nodeSize = 100; // Tamanho padrão
    if (node.id === 'project-center') {
      nodeSize = config.project.node.size;
    } else if (node.data.calculatedSize) {
      // Usar tamanho calculado se disponível
      nodeSize = node.data.calculatedSize;
    } else if (node.data.level !== undefined) {
      // Calcular tamanho baseado no nível
      nodeSize = getNodeSize(node.data.level, config);
    }
    
    // Fórmula: zoom = tamanhoAlvo / tamanhoReal
    const zoomLevel = targetSize / nodeSize;

    // Centralizar câmera no node com animação suave
    const nodePosition = node.position;
    setCenter(nodePosition.x, nodePosition.y, { zoom: zoomLevel, duration: 800 });

    // Definir nó selecionado para destacar edges
    setSelectedNodeId(node.id);

    // Se clicou no projeto central
    if (node.id === 'project-center') {
      setSelectedNode({
        id: 'project',
        title: project?.title || '',
        content: project?.description || '',
        order: 0,
        created_at: new Date().toISOString(),
      } as Section);
      return;
    }

    // Encontrar seção correspondente
    const findSectionById = (sections: Section[], id: string): Section | null => {
      for (const section of sections) {
        if (section.id === id) return section;
      }
      return null;
    };

    const section = project ? findSectionById(project.sections || [], node.id) : null;
    setSelectedNode(section);
  }, [project, setCenter, config]);

  // Handler para quando clicar em referências no painel lateral
  const handleReferenceClick = useCallback((sectionId: string) => {
    // Encontrar o nó correspondente
    const node = nodes.find(n => n.id === sectionId);
    if (!node) return;

    // Calcular zoom
    const targetSize = config.zoom?.onClickTargetSize || 200;
    let nodeSize = 100;
    
    if (node.data.calculatedSize) {
      nodeSize = node.data.calculatedSize;
    } else if (node.data.level !== undefined) {
      nodeSize = getNodeSize(node.data.level, config);
    }
    
    const zoomLevel = targetSize / nodeSize;
    
    // Calcular posição central do node
    const centerX = node.position.x + (nodeSize / 2);
    const centerY = node.position.y + (nodeSize / 2);
    
    // Centralizar câmera
    setCenter(centerX, centerY, { zoom: zoomLevel, duration: 800 });
    
    // Selecionar o nó
    setSelectedNodeId(sectionId);
    
    // Encontrar seção
    const section = project?.sections?.find((s: Section) => s.id === sectionId);
    if (section) {
      setSelectedNode(section);
    }
  }, [nodes, config, setCenter, project]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <p className="text-gray-400">Projeto não encontrado</p>
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={config}>
      <style>
        {`
          @keyframes dashdraw {
            from {
              stroke-dashoffset: 0;
            }
            to {
              stroke-dashoffset: ${config.animation?.distance || 500};
            }
          }
          
          /* Aplicar animação para TODAS as edges animadas (não só highlight) */
          .react-flow__edge.animated path {
            animation: dashdraw ${config.animation?.speed || 2}s linear infinite !important;
          }
        `}
      </style>
      <div className="h-screen w-screen bg-gray-900">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Voltar
            </button>
            <h1 className="text-xl font-bold text-white">🧠 Mapa Mental</h1>
            <span className="text-gray-400">|</span>
            <span className="text-gray-300">{project.title}</span>
            
            {/* Busca */}
            <div className="flex items-center gap-2 ml-6">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar seções..."
                  className="bg-gray-700 text-white px-3 py-1.5 pl-8 pr-8 rounded-lg text-sm border border-gray-600 focus:border-blue-500 focus:outline-none w-64"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
              {searchResults.size > 0 && (
                <span className="text-sm text-gray-400 bg-gray-700 px-3 py-1.5 rounded-lg">
                  {searchResults.size} resultado{searchResults.size !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span>Seção</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span>Subseção</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-purple-500" style={{ backgroundImage: 'repeating-linear-gradient(to right, #8b5cf6 0, #8b5cf6 5px, transparent 5px, transparent 10px)' }}></div>
              <span>Referência</span>
            </div>
          </div>
        </div>

        {/* React Flow */}
        <div className="h-full pt-16">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            fitView
            fitViewOptions={{ padding: config.zoom.fitViewPadding || 0.2, maxZoom: config.zoom.fitViewMaxZoom }}
            maxZoom={maxZoom}
            minZoom={config.zoom.minZoom}
            attributionPosition="bottom-left"
            className="bg-gray-900"
          >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
          <Controls className="bg-gray-800 border-gray-700" />
          <MiniMap
            className="bg-gray-800 border border-gray-700"
            nodeColor={(node) => {
              const level = node.data.level || 0;
              return level === 0 ? '#3b82f6' : level === 1 ? '#8b5cf6' : '#a855f7';
            }}
          />
        </ReactFlow>
      </div>

      {/* Panel Lateral */}
      {selectedNode && (
        <div className="absolute top-16 right-0 w-96 h-[calc(100vh-4rem)] bg-gray-800 border-l border-gray-700 shadow-2xl overflow-y-auto z-20">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-white">{selectedNode.title}</h2>
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setSelectedNodeId(null);
                  // Limpar parâmetro focus da URL
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('focus');
                    window.history.replaceState({}, '', url.toString());
                  }
                }}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="prose prose-invert max-w-none">
              {selectedNode.content ? (
                <MarkdownWithMapReferences
                  content={selectedNode.content}
                  sections={project.sections || []}
                  onSectionClick={handleReferenceClick}
                />
              ) : (
                <p className="text-gray-500 italic">Sem conteúdo</p>
              )}
            </div>

            {/* Seção de Referenciado por */}
            {selectedNode.id !== 'project' && (() => {
              const backlinks = getBacklinks(selectedNode.id, project.sections || []);
              if (backlinks.length > 0) {
                return (
                  <div className="mt-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Referenciado por:</h3>
                    <div className="flex flex-wrap gap-2">
                      {backlinks.map((backlink) => {
                        return (
                          <button
                            key={backlink.id}
                            onClick={() => handleReferenceClick(backlink.id)}
                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-blue-200 rounded-full text-sm font-medium transition-all duration-200 border border-blue-500/30 hover:border-blue-400/50 hover:scale-105"
                          >
                            {backlink.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="mt-6 flex gap-2">
              {selectedNode.id !== 'project' && (
                <button
                  onClick={() => router.push(`/projects/${projectId}/sections/${selectedNode.id}`)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Ver Detalhes
                </button>
              )}
              {selectedNode.id === 'project' && (
                <button
                  onClick={() => router.push(`/projects/${projectId}/edit`)}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Editar Projeto
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </ConfigContext.Provider>
  );
}

// Componente wrapper que fornece o contexto do ReactFlow
export default function MindMapClient({ projectId }: MindMapClientProps) {
  return (
    <ReactFlowProvider>
      <FlowContent projectId={projectId} />
    </ReactFlowProvider>
  );
}
