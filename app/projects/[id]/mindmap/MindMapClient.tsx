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
import { extractSectionReferences, findSection } from "@/utils/sectionReferences";
import { MINDMAP_CONFIG, getNodeConfig, getEdgeConfig } from "@/lib/mindMapConfig";
import * as d3 from "d3-force";

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
      edges.push({
        id: `${parentId}-${section.id}`,
        source: parentId,
        target: section.id,
        type: 'straight',
        animated: edgeConfig.animated,
        style: { 
          stroke: edgeConfig.color, 
          strokeWidth: edgeConfig.strokeWidth,
          ...(edgeConfig.dashed && { strokeDasharray: edgeConfig.dashPattern }),
        },
        data: {
          originalStyle: {
            stroke: edgeConfig.color,
            strokeWidth: edgeConfig.strokeWidth,
            strokeDasharray: edgeConfig.dashed ? edgeConfig.dashPattern : undefined,
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

  // Aplicar estilos de seleção
  const selectedStyles = isSelected ? nodeConfig.selected : null;
  const finalSize = isSelected && selectedStyles ? size * selectedStyles.scale : size;
  const finalBorderColor = isSelected && selectedStyles ? selectedStyles.borderColor : nodeConfig.borderColor;
  const finalBorderWidth = isSelected && selectedStyles ? selectedStyles.borderWidth : (data.hasSubsections ? nodeConfig.borderWidth : 0);
  // Glow usa a mesma cor da bolinha quando selecionada
  const glowColor = isSelected ? bgColor : null;
  
  // Calcular tamanho aparente na tela (size * zoom)
  const apparentSize = finalSize * zoom;
  // Só mostrar label se tamanho aparente for maior que threshold
  const showLabel = apparentSize > CONFIG.zoom.labelVisibility.section;

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <div
        style={{
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
          boxShadow: glowColor 
            ? `0 4px 6px ${nodeConfig.shadowColor}, 0 0 0 ${finalBorderWidth}px ${finalBorderColor}, 0 0 20px ${glowColor}, 0 0 40px ${glowColor}, 0 0 60px ${glowColor}`
            : finalBorderWidth > 0
              ? `0 4px 6px ${nodeConfig.shadowColor}, 0 0 0 ${finalBorderWidth}px ${finalBorderColor}`
              : `0 4px 6px ${nodeConfig.shadowColor}`,
          transition: 'all 0.3s ease',
          wordBreak: CONFIG.fonts.wordBreak ? 'break-word' : 'normal',
          overflowWrap: 'break-word',
          hyphens: 'auto',
          lineHeight: CONFIG.fonts.lineHeight,
        }}
        className="hover:scale-110"
      >
        {showLabel && data.label}
      </div>
    </>
  );
}

// Custom Node Component - Projeto Central
function ProjectNode({ data }: { data: any }) {
  const CONFIG = useContext(ConfigContext);
  
  // Obter zoom atual
  const zoom = useStore((state) => state.transform[2]);
  
  const config = CONFIG.project.node;
  const isSelected = data.isSelected;
  
  // Aplicar estilos de seleção
  const selectedStyles = isSelected ? config.selected : null;
  const finalSize = isSelected && selectedStyles ? config.size * selectedStyles.scale : config.size;
  const finalBorderWidth = isSelected && selectedStyles ? selectedStyles.borderWidth : 0;
  const finalBorderColor = isSelected && selectedStyles ? selectedStyles.borderColor : 'transparent';
  const glowColor = isSelected && selectedStyles ? selectedStyles.glowColor : config.colors.glow;
  
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
  
  return (
    <>
      <Handle type="source" position={Position.Top} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Left} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <div
        style={{
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
          boxShadow: finalBorderWidth > 0
            ? `0 8px 16px ${config.colors.shadow}, 0 0 60px ${glowColor}, 0 0 0 ${finalBorderWidth}px ${finalBorderColor}`
            : `0 8px 16px ${config.colors.shadow}, 0 0 60px ${glowColor}`,
          transition: 'all 0.3s ease',
          wordBreak: CONFIG.fonts.wordBreak ? 'break-word' : 'normal',
          overflowWrap: 'break-word',
          hyphens: 'auto',
          lineHeight: CONFIG.fonts.lineHeight,
        }}
        className="hover:scale-110"
      >
        {showLabel && (
          <div>
            <div>{config.icon}</div>
            <div style={{ marginTop: '8px' }}>{data.label}</div>
          </div>
        )}
        {!showLabel && <div>{config.icon}</div>}
      </div>
    </>
  );
}

const nodeTypes = Object.freeze({
  sectionNode: SectionNode,
  projectNode: ProjectNode,
});

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

  // Ler parâmetro de foco da URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const focusId = params.get('focus');
      if (focusId && nodes.length > 0) {
        // Encontrar o node
        const nodeToFocus = nodes.find(n => n.id === focusId);
        if (nodeToFocus) {
          // Selecionar o node
          const section = project?.sections?.find((s: Section) => s.id === focusId);
          if (section) {
            setSelectedNode(section);
          }
          
          // Atualizar nodes para mostrar seleção visual
          setNodes(nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              isSelected: node.id === focusId
            }
          })));
          
          // Centralizar câmera no node com zoom
          setTimeout(() => {
            setCenter(nodeToFocus.position.x, nodeToFocus.position.y, {
              zoom: 1.5,
              duration: 800,
            });
          }, 100);
        }
      }
    }
  }, [nodes.length, setCenter, project]);

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
          ...(projectEdgeConfig.dashed && { strokeDasharray: projectEdgeConfig.dashPattern }),
        },
        data: {
          originalStyle: {
            stroke: projectEdgeConfig.color,
            strokeWidth: projectEdgeConfig.strokeWidth,
            strokeDasharray: projectEdgeConfig.dashed ? projectEdgeConfig.dashPattern : undefined,
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
    if (!selectedNodeId) {
      // Sem seleção: resetar todas as edges para estilos originais
      setEdges((eds) =>
        eds.map((edge) => {
          const original = edge.data?.originalStyle;
          return {
            ...edge,
            animated: original?.animated || false,
            style: {
              stroke: original?.stroke || '#94a3b8',
              strokeWidth: original?.strokeWidth || 0.5,
              strokeDasharray: original?.strokeDasharray,
            },
          };
        })
      );
      return;
    }

    // Com seleção: resetar todas primeiro, depois destacar edges conectadas
    setEdges((eds) =>
      eds.map((edge) => {
        const original = edge.data?.originalStyle;
        const isConnected =
          edge.source === selectedNodeId || edge.target === selectedNodeId;

        if (isConnected) {
          // Edge conectada: usar configurações de highlight
          // Determinar qual config usar (projeto ou seção baseado no source)
          const isProjectEdge = edge.source === 'project-center';
          const highlightConfig = isProjectEdge 
            ? config.project.edge.highlighted
            : config.sections.edge.highlighted;
          
          return {
            ...edge,
            animated: highlightConfig.animated,
            style: {
              strokeWidth: highlightConfig.strokeWidth,
              stroke: highlightConfig.color,
              strokeDasharray: '5,5', // Sempre tracejado quando destacado
            },
          };
        }

        // Edge não conectada: usar estilo original
        return {
          ...edge,
          animated: original?.animated || false,
          style: {
            stroke: original?.stroke || '#94a3b8',
            strokeWidth: original?.strokeWidth || 0.5,
            strokeDasharray: original?.strokeDasharray,
          },
        };
      })
    );
  }, [selectedNodeId, setEdges]);

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

    // Atualizar estado visual dos nodes (marcar como selecionado)
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: n.id === node.id },
      }))
    );

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
  }, [project, setCenter, setNodes, config]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <p className="text-gray-400">Projeto não encontrado</p>
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={config}>
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
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: config.zoom.fitViewMaxZoom }}
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
                }}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="prose prose-invert max-w-none">
              {selectedNode.content ? (
                <div className="text-gray-300 whitespace-pre-wrap">
                  {selectedNode.content}
                </div>
              ) : (
                <p className="text-gray-500 italic">Sem conteúdo</p>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              {selectedNode.id !== 'project' && (
                <>
                  <button
                    onClick={() => router.push(`/projects/${projectId}/sections/${selectedNode.id}`)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Ver Detalhes
                  </button>
                  <button
                    onClick={() => router.push(`/projects/${projectId}/sections/${selectedNode.id}/edit`)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Editar
                  </button>
                </>
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
