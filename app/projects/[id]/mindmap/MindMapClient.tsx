"use client";

import { useCallback, useEffect, useRef, useState, useMemo, memo, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  useStore,
  useStoreApi,
  type EdgeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { useProjectStore, Section, Project, MindMapSettings } from "@/store/projectStore";
import { sectionPathById, projectPath } from "@/lib/utils/slug";
import { extractSectionReferences, findSection, getBacklinks, SectionReference } from "@/utils/sectionReferences";
import { getDriveImageDisplayUrl } from "@/lib/googleDrivePicker";
import { SectionHeroThumb } from "@/components/SectionHeroThumb";
import { SectionPreviewDialog, toShortDescription } from "@/components/common/SectionPreviewDialog";
import { PAGE_STATUSES, PAGE_STATUS_META, type PageStatus } from "@/lib/pageStatus/types";
import {
  DEFAULT_DOCUMENT_HERO_THUMB_WIDTH,
  normalizeDocumentHeroThumbWidth,
} from "@/lib/documentThemes";
import { MindMapSearchProvider, useMindMapSearch } from "@/lib/mindMapSearchContext";
import { MINDMAP_CONFIG, getNodeConfig, getEdgeConfig } from "@/lib/mindMapConfig";
import { useI18n } from "@/lib/i18n/provider";
import { ProjectTopBar, IconeMapa } from "@/components/project/ProjectTopBar";
import PageModeLinks from "@/components/project/PageModeLinks";
import { DOMAIN_I18N_KEYS, type GameDesignDomainId } from "@/lib/gameDesignDomains";
import * as d3 from "d3-force";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MindMapClientProps {
  projectId: string;
  publicToken?: string;
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

/**
 * Um item do menu de navegacao do painel. Sem caixa e sem contorno, como o
 * "Referenciado por" logo abaixo: sao doze titulos numa coluna, e pilula com
 * fundo em cada um roubava da descricao a largura que ela precisa.
 *
 * O pai se distingue pela cor e pela seta que aponta pra cima da arvore. Nos
 * filhos a mesma casa leva o ponto da cor da bolinha, o que amarra o titulo
 * lido aqui ao no que voce esta vendo no mapa — e de quebra mantem a coluna de
 * titulos alinhada em vez de serrilhada.
 *
 * `netos` e quantos filhos AQUELA pagina tem. O mapa ja marca com borda quais
 * bolinhas continuam; aqui o numero evita que voce clique pra descobrir que era
 * folha.
 */
function ItemNavegacao({
  titulo,
  variante,
  cor,
  netos = 0,
  onClick,
}: {
  titulo: string;
  variante: "pai" | "filho";
  cor?: string;
  netos?: number;
  onClick: () => void;
}) {
  const ehPai = variante === "pai";
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className={`flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-sm transition-colors ${
        ehPai
          ? "font-semibold text-[#ef5f56] hover:bg-[#ef5f56]/10"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden="true">
        {ehPai ? (
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
          </svg>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cor }} />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{titulo}</span>
      {netos > 0 && (
        <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{netos}</span>
      )}
    </button>
  );
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

// Espessura e traco em px de TELA.
//
// Tentei antes com `vector-effect: non-scaling-stroke` e nao funciona aqui: o
// React Flow aplica o zoom como transform CSS num DIV ancestral, nao como
// transform dentro do SVG (conferido: .react-flow__viewport tem
// matrix(z,0,0,z,...) e o <svg> das edges nao tem transform proprio). O
// vector-effect so protege contra transform do proprio SVG, entao a linha
// continuava escalando no compositor.
//
// Pior: `getComputedStyle` devolve o valor ESPECIFICADO, que nao muda com o
// transform do ancestral — foi assim que eu medi "1.6px constante" enquanto na
// tela a linha engrossava. Dividir pela --gdd-zoom no proprio valor resolve, e
// e verificavel pela bbox real do path.
const pxTela = (valor: number) => `calc(${valor}px / var(--gdd-zoom, 1))`;

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
function calculateNodePositions(sections: SectionWithChildren[], config: typeof MINDMAP_CONFIG = MINDMAP_CONFIG): Map<string, { x: number; y: number; calculatedSize?: number; raioDosFilhos?: number }> {
  const positions = new Map<string, { x: number; y: number; calculatedSize?: number; raioDosFilhos?: number }>();
  
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
  
  // Raio do cacho de cada pai: distancia ate o filho mais distante, ja com as
  // posicoes finais. E o que o halo do hover usa para envolver a familia.
  const porId = new Map((nodes as any[]).map((n) => [n.id, n]));
  const raioPorPai = new Map<string, number>();
  for (const l of links as any[]) {
    // Depois do forceLink, source/target viram os proprios objetos de no.
    const pai = porId.get(typeof l.source === "string" ? l.source : l.source?.id);
    const filho = porId.get(typeof l.target === "string" ? l.target : l.target?.id);
    if (!pai || !filho) continue;
    const d = Math.hypot((filho.x || 0) - (pai.x || 0), (filho.y || 0) - (pai.y || 0)) + (filho.size || 0) / 2;
    raioPorPai.set(pai.id, Math.max(raioPorPai.get(pai.id) || 0, d));
  }

  // Extrair posições finais
  nodes.forEach(node => {
    if (node.id !== 'project-center') {
      positions.set(node.id, {
        x: node.x || 0,
        y: node.y || 0,
        calculatedSize: node.size,
        raioDosFilhos: raioPorPai.get(node.id) || 0,
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
  positions: Map<string, { x: number; y: number; calculatedSize?: number; raioDosFilhos?: number }>,
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
    const raioDosFilhos = (positionData as any).raioDosFilhos ?? 0;
    
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
        raioDosFilhos,  // Raio do cacho, usado pelo halo do hover
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
        type: 'centro',
        animated: edgeConfig.animated,
        style: { 
          stroke: (config as any).clean.line,
          strokeWidth: pxTela((config as any).clean.lineWidth),
          ...(needsDashPattern && { strokeDasharray: pxTela(Number(dashValue)) }),
        },
        data: {
          // O nivel do no de ORIGEM vai junto com a edge. Antes o efeito de estilo
          // fazia nodes.find() para descobrir isso — uma varredura por edge, ~60 mil
          // iteracoes por execucao, e o efeito reroda a cada frame de arrasto.
          sourceLevel: level - 1,
          originalStyle: {
            stroke: (config as any).clean.line,
            strokeWidth: pxTela((config as any).clean.lineWidth),
            strokeDasharray: needsDashPattern ? pxTela(Number(dashValue)) : undefined,
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
// memo: o React Flow recria o array de nodes a cada setNodes (selecao, fade,
// busca, drag). Sem memo, as 245 bolinhas re-renderizam juntas mesmo quando so
// uma mudou de estado. `data` e recriado por node, entao a comparacao rasa do
// memo ja corta a maioria.
const SectionNode = memo(function SectionNode({ data }: { data: any }) {
  const CONFIG = useContext(ConfigContext);
  
  
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
  
  // Estilo limpo: uma cor so para todos os niveis. A cor customizada por pagina
  // continua valendo, porque e escolha do usuario naquela pagina especifica.
  //
  // No modo "colorir por estado" a cor do estado vem na frente ate da cor
  // customizada: o mapa inteiro passa a responder uma pergunta so — o que ja
  // esta no jogo — e uma bolinha fora da escala ali seria ruido.
  const bgColor = data.statusColor || data.customColor || (CONFIG as any).clean.accent;
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
  
  // Assina o BOOLEANO, nao o numero do zoom: assim a bolinha so re-renderiza
  // quando a label de fato aparece ou some, em vez de a cada frame de camera.
  // Sao 245 bolinhas — assinar o numero custava 245 re-renders por frame.
  // Limiar de zoom da profundidade deste no. O array cobre os niveis; alem do
  // ultimo, repete o ultimo valor.
  const limiares = (CONFIG.zoom.labelVisibility as any).byLevel as number[];
  const limiar = limiares[Math.min(data.level ?? 0, limiares.length - 1)];
  const suavidade = (CONFIG.zoom.labelVisibility as any).suavidade ?? 2.5;
  const opacidadeLabel = `clamp(0, calc((var(--gdd-zoom, 1) / ${limiar} - 1) / ${suavidade}), 1)`;
  const showLabel = useStore((state) => state.transform[2] > limiar);

  // Tamanho do ponto em px de TELA. O contra-scale pela --gdd-zoom faz o ponto
  // (e a label junto) manter o mesmo tamanho em qualquer zoom — e isso que da o
  // carater de "pontinho" do Nuclino. Aproximar espalha o mapa sem inchar os
  // glifos. O tamanho em COORDENADAS (`size`) continua existindo pro layout e
  // pra colisao do d3-force; sao coisas diferentes de proposito.
  const pontos = (CONFIG as any).clean.dotSize as number[];
  const pontoBase = pontos[Math.min(data.level ?? 0, pontos.length - 1)];
  // Com uma bolinha selecionada, todo o conjunto em destaque cresce: a
  // selecionada mais, o caminho e os filhos 25%. Da peso ao ramo em foco sem
  // precisar de mais cor.
  const destacado = Boolean(isSelected || isInPath || isReference);
  const escala = isSelected ? 1.6 : destacado ? 1.25 : 1;
  const ponto = pontoBase * escala;

  // Durante o hover manda o hover: quem nao e o no sob o cursor nem vizinho
  // dele apaga, independente do fade da selecao.
  const apagadoPeloHover = Boolean(data.hoverAtivo && !data.isHovered && !data.hoverVizinho);
  // Sob o cursor (ou vizinho de quem esta) o no ignora o fade da selecao.
  const emFoco = Boolean(data.isHovered || data.hoverVizinho);

  // Halo do cacho: circulo suave em volta do no sob o cursor, grande o
  // bastante para envolver os filhos dele. O raio vem em coordenadas do MUNDO
  // (`data.raioDosFilhos`), nao em px de tela como o ponto — ele precisa
  // acompanhar a distancia real ate os filhos, senao descolaria do cacho
  // conforme a camera aproxima.

  const anel = isSelected
    ? `0 0 0 3px ${(CONFIG as any).clean.accent}55`
    : isInPath
      ? `0 0 0 2px ${(CONFIG as any).clean.accent}44`
      : isReference && (refConfig as any).nodeHighlight?.enabled
        ? `0 0 0 2px ${(refConfig as any).nodeHighlight.borderColor || '#3b82f6'}`
        : 'none';

  return (
    // A caixa vive em coordenadas do mundo e portanto CRESCE com o zoom, enquanto
    // o ponto tem tamanho fixo. Se ela capturasse o clique, aproximar criaria uma
    // area invisivel de centenas de pixels em volta de cada ponto (medido: 2.5x o
    // ponto no zoom de abertura, ~30x no maximo). O alvo e o ponto, nao a caixa.
    <div style={{ width: size, height: size, position: 'relative', pointerEvents: 'none' }}>
      {(data.raioDosFilhos || 0) > 0 && (
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: (data.raioDosFilhos || 0) * 2,
          height: (data.raioDosFilhos || 0) * 2,
          marginLeft: -(data.raioDosFilhos || 0),
          marginTop: -(data.raioDosFilhos || 0),
          opacity: data.isHovered ? 1 : 0,
          transition: "opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${(CONFIG as any).clean.accent}14 0%, ${(CONFIG as any).clean.accent}0a 55%, transparent 72%)`,
          pointerEvents: "none",
        }}
      />
      )}
      {/* Os handles nao participam mais do desenho — a edge calcula os centros
          sozinha (ver EdgeCentroACentro). Mas nao da para remover: sem eles o
          React Flow simplesmente nao renderiza edge nenhuma (testado: 0 de 244).
          Ficam invisiveis e sem tamanho. */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent', top: '50%', left: '50%', margin: 0, transform: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent', top: '50%', left: '50%', margin: 0, transform: 'none' }} />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: ponto,
          height: ponto,
          transform: 'translate(-50%, -50%) scale(calc(1 / var(--gdd-zoom, 1)))',
          // O wrapper nao esmaece mais: quem esmaece e a cor do ponto e a
          // opacidade da label, logo abaixo. Com o wrapper transparente, as
          // linhas de tras apareciam atraves do ponto.
          opacity: 1,
          // O crescimento do destaque entra por aqui. Como o wrapper e centrado
          // por translate(-50%,-50%), crescer nao desloca o ponto.
          // Sem isso os 245 pontos trocam de opacidade de uma vez, e o hover
          // pisca em vez de acender. A transicao e de opacidade pura, entao o
          // navegador resolve no compositor.
          transition: 'opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.45s cubic-bezier(0.4, 0, 0.2, 1), color 0.45s cubic-bezier(0.4, 0, 0.2, 1), width 0.4s cubic-bezier(0.4, 0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto',
        }}
      >
      {/* Alvo de clique um pouco maior que o ponto, e constante em px de tela
            porque mora dentro do wrapper contra-escalado. Sem isso, um ponto de
            6px seria dificil de acertar. */}
        <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', cursor: 'pointer' }} />
        {isSelected && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid ${(CONFIG as any).clean.accent}`,
              animation: 'gddPulso 1.9s cubic-bezier(0.2, 0.6, 0.3, 1) infinite',
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: (apagadoPeloHover || (!emFoco && isFaded && fadeConfig.enabled))
              ? (CONFIG as any).clean.muted
              : bgColor,
            // emFoco entra aqui por opacidade, acima; a cor ja e a certa.
            boxShadow: anel,
            cursor: 'pointer',
            transition: data.isDragging ? 'none' : 'box-shadow 0.2s ease, background-color 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        {(showLabel || data.isHovered || data.hoverSaindo) && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              // Sob o cursor a label desce: no lugar normal ela ficaria embaixo
              // do ponteiro, que fica exatamente sobre a bolinha.
              marginTop: data.isHovered ? 14 : 4,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              color: apagadoPeloHover ? (CONFIG as any).clean.mutedLabel : (CONFIG as any).clean.label,
              // A label do no sob o cursor tambem ignora o fade da selecao.
              // Fundo e respiro: no meio de um feixe de conexoes a label sem
              // fundo some. Usa a cor do proprio mapa para nao virar etiqueta.
              backgroundColor: (CONFIG as any).clean.background,
              padding: '1px 4px',
              borderRadius: 3,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: (CONFIG as any).nodeSize?.fontFamily || 'system-ui',
              // Gradacao continua: a label entra lavada no limiar e vai ganhando
              // corpo conforme a camera se aproxima. Resolvido em CSS pela
              // --gdd-zoom, para nao re-renderizar as 245 bolinhas a cada frame.
              // Sempre montada: montagem/desmontagem nao transiciona, e era isso
              // que fazia a label pipocar ao entrar e sumir de golpe ao sair.
              opacity: data.isHovered
                ? 1
                : (apagadoPeloHover || (!emFoco && isFaded && fadeConfig.enabled))
                  ? `calc(${opacidadeLabel} * 0.45)`
                  : opacidadeLabel,
              transition: 'opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.45s cubic-bezier(0.4, 0, 0.2, 1), color 0.45s cubic-bezier(0.4, 0, 0.2, 1), margin-top 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              // Montagem nao transiciona: quando a label so existe por causa do
              // hover, ela nasce ja pronta e a transicao acima nao alcanca. Uma
              // animacao de entrada cobre justamente esse caso.
              animation: (data.isHovered && !showLabel) ? 'gddLabelEntra 0.35s cubic-bezier(0.4, 0, 0.2, 1)' : undefined,
            }}
          >
            {data.label}
          </div>
        )}
      </div>
    </div>
  );
});

// Custom Node Component - Projeto Central
const ProjectNode = memo(function ProjectNode({ data }: { data: any }) {
  const CONFIG = useContext(ConfigContext);
  
  
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
  const showLabel = useStore((state) => state.transform[2] > (CONFIG.zoom.labelVisibility as any).project);
  
  const baseSize = config.size;
  
  // Mesmo tratamento das secoes: ponto em px de tela, contra-escalado. Sem isso
  // o sol cresceria com o zoom enquanto todo o resto fica parado.
  const ponto = isSelected
    ? (CONFIG as any).clean.projectDot * 1.4
    : (CONFIG as any).clean.projectDot;

  return (
    <div style={{ width: baseSize, height: baseSize, position: 'relative', pointerEvents: 'none' }}>
      <Handle type="source" position={Position.Top} style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent', top: '50%', left: '50%', margin: 0, transform: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent', top: '50%', left: '50%', margin: 0, transform: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent', top: '50%', left: '50%', margin: 0, transform: 'none' }} />
      <Handle type="source" position={Position.Left} style={{ opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent', top: '50%', left: '50%', margin: 0, transform: 'none' }} />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: ponto,
          height: ponto,
          transform: 'translate(-50%, -50%) scale(calc(1 / var(--gdd-zoom, 1)))',
          // Mesma suavizacao das secoes: o no do projeto tinha ficado de fora.
          transition: 'opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.45s cubic-bezier(0.4, 0, 0.2, 1), color 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: (CONFIG as any).clean.accent,
            boxShadow: isSelected ? `0 0 0 4px ${(CONFIG as any).clean.accent}44` : 'none',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s ease',
          }}
        />
        {showLabel && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 5,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              color: (CONFIG as any).clean.label,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: (CONFIG as any).nodeSize?.fontFamily || 'system-ui',
            }}
          >
            {data.label}
          </div>
        )}
      </div>
    </div>
  );
});

// Componente para renderizar markdown com referências clicáveis no mapa mental
function MarkdownWithMapReferences({
  content,
  sections,
  onSectionClick,
  heroThumbUrl,
  heroThumbWidth,
}: {
  content: string;
  sections: Section[];
  onSectionClick: (sectionId: string) => void;
  heroThumbUrl?: string | null;
  heroThumbWidth?: number;
}) {
  const normalizeContentForMapMarkdown = (input: string): string => {
    const normalized = input.replace(/\r\n/g, "\n");

    const meaningfulLines = normalized.split("\n").filter((line) => line.trim().length > 0);
    const tabLines = meaningfulLines.filter((line) => line.includes("\t"));

    const shouldConvertTsvToTable =
      meaningfulLines.length >= 2 &&
      tabLines.length === meaningfulLines.length &&
      !normalized.includes("|");

    if (!shouldConvertTsvToTable) {
      return normalized;
    }

    const rows = meaningfulLines.map((line) =>
      line
        .split("\t")
        .map((cell) => cell.trim())
        .filter((cell, index, array) => !(index === array.length - 1 && cell === ""))
    );

    const columnCount = Math.max(...rows.map((row) => row.length));
    if (columnCount < 2) {
      return normalized;
    }

    const padRow = (row: string[]) => {
      const padded = [...row];
      while (padded.length < columnCount) padded.push("");
      return padded;
    };

    const header = padRow(rows[0]);
    const body = rows.slice(1).map(padRow);

    const headerLine = `| ${header.join(" | ")} |`;
    const separatorLine = `| ${new Array(columnCount).fill("---").join(" | ")} |`;
    const bodyLines = body.map((row) => `| ${row.join(" | ")} |`);

    return [headerLine, separatorLine, ...bodyLines].join("\n");
  };

  const normalizedContent = normalizeContentForMapMarkdown(content);

  // Processar conteúdo substituindo referências por links clicáveis
  const processedContent = normalizedContent.replace(/\$\[([^\]]+)\]/g, (match, ref) => {
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
    <div className="prose max-w-none markdown-with-refs overflow-x-auto text-gray-700">
      {heroThumbUrl && heroThumbWidth ? (
        <SectionHeroThumb src={heroThumbUrl} alt="" width={heroThumbWidth} />
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw as any]}
        allowedElements={[
          "p", "br", "strong", "em", "u", "del", "code", "pre", "blockquote",
          "ul", "ol", "li",
          "h1", "h2", "h3", "h4", "h5", "h6",
          "a", "span", "img",
          "table", "thead", "tbody", "tr", "th", "td",
        ]}
        unwrapDisallowed
        components={{
          img: ({ src, alt }) => {
            const safeSrc = typeof src === "string" ? src.trim() : "";
            if (!safeSrc) return null;
            const displaySrc = getDriveImageDisplayUrl(safeSrc);
            return (
              <img
                src={displaySrc}
                alt={alt || ""}
                className="max-w-full h-auto rounded-md my-3"
                loading="lazy"
              />
            );
          },
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
                  className="text-blue-600 hover:text-blue-700 underline cursor-pointer"
                >
                  {children}
                </button>
              );
            }
            // Link normal
            return (
              <a href={href} {...props} className="text-blue-600 hover:text-blue-700">
                {children}
              </a>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {heroThumbUrl && heroThumbWidth ? <div style={{ clear: "both" }} /> : null}
    </div>
  );
}

// Publica o zoom atual numa CSS var, pra as labels se contra-escalarem e ficarem
// do mesmo tamanho na tela em qualquer zoom.
//
// A assinatura e IMPERATIVA de proposito: `useStore` faria este componente
// re-renderizar a cada frame de camera, que e exatamente o custo que a gente
// acabou de remover. Aqui nao ha render nenhum — so uma escrita de propriedade,
// escrita sincrona (ver o corpo).
function ZoomCssVar() {
  const store = useStoreApi();
  useEffect(() => {
    const alvo = document.documentElement;
    let ultimo = -1;
    // Escrita SINCRONA. A versao anterior agrupava por requestAnimationFrame, e
    // quando o rAF nao roda (aba em segundo plano, compositor parado) a variavel
    // congelava — e com ela congelada a contra-escala para de acompanhar, entao
    // pontos, labels e linhas voltam a crescer junto com o zoom. Escrever uma
    // custom property e barato; o recalculo de estilo o navegador ja agrupa
    // sozinho ate o proximo paint.
    const publicar = (z: number) => {
      if (z === ultimo) return;
      ultimo = z;
      alvo.style.setProperty('--gdd-zoom', String(z));
    };
    publicar(store.getState().transform[2]);
    const cancelar = store.subscribe((estado: any) => publicar(estado.transform[2]));
    return () => {
      cancelar();
      alvo.style.removeProperty('--gdd-zoom');
    };
  }, [store]);
  return null;
}

// Edge de centro a centro.
//
// O React Flow e um editor de NOS: a linha dele liga *handles* — portas na borda
// da caixa — e a posicao do handle sai do DOM. Isso e certo para fluxograma e
// errado para mapa mental, onde a linha vai do centro de uma bolinha ao centro
// da outra. Foi de la que vinha o desvio: o calculo do handle soma metade do
// tamanho dele, e `transform: translate(-50%,-50%)` nao entra nessa conta.
//
// Aqui a origem e o destino saem direto da posicao do no mais metade do tamanho.
// Nao ha handle no meio do caminho, entao nao ha desvio a corrigir.
const EdgeCentroACentro = memo(function EdgeCentroACentro({
  id, source, target, style, markerEnd, label, labelStyle,
}: EdgeProps) {
  // Selector devolve string para a comparacao do zustand ser por valor: assim a
  // edge so re-renderiza quando as pontas realmente se movem (arrasto), e nao a
  // cada mudanca qualquer do store.
  const coords = useStore((s: any) => {
    const a = s.nodeInternals.get(source);
    const b = s.nodeInternals.get(target);
    if (!a || !b) return '';
    const ax = a.position.x + (a.width ?? 0) / 2;
    const ay = a.position.y + (a.height ?? 0) / 2;
    const bx = b.position.x + (b.width ?? 0) / 2;
    const by = b.position.y + (b.height ?? 0) / 2;
    return `${ax},${ay},${bx},${by}`;
  });

  if (!coords) return null;
  const [ax, ay, bx, by] = coords.split(',').map(Number);

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={`M ${ax},${ay} L ${bx},${by}`}
        style={style}
        markerEnd={markerEnd}
        fill="none"
      />
      {label ? (
        <text
          x={(ax + bx) / 2}
          y={(ay + by) / 2}
          textAnchor="middle"
          dominantBaseline="central"
          style={labelStyle}
        >
          {label}
        </text>
      ) : null}
    </>
  );
});

// Componente interno que tem acesso ao contexto do ReactFlow
// Largura do painel: metade da tela, como na referencia — mapa e conteudo com
// o mesmo peso. O piso de 380px e para telas estreitas, onde 50% nao caberia o
// texto. Compartilhada com a margem do mapa: os dois PRECISAM ler o mesmo
// valor, senao sobra faixa vazia ou o mapa passa por baixo.
const LARGURA_PAINEL = "max(380px, 50vw)";

function FlowContent({ projectId, publicToken }: MindMapClientProps) {
  const router = useRouter();
  const { t } = useI18n();
  // Tipos estáveis por instância (evita warning React Flow #002: "new nodeTypes/edgeTypes object")
  const nodeTypesStable = useMemo(
    () => ({ sectionNode: SectionNode, projectNode: ProjectNode }),
    []
  );
  const edgeTypesStable = useMemo(() => ({ centro: EdgeCentroACentro }), []);
  const { getProjectBySlug } = useProjectStore();
  const projects = useProjectStore((s) => s.projects);
  const [publicProject, setPublicProject] = useState<Project | null>(null);
  const [isPublicLoading, setIsPublicLoading] = useState(Boolean(publicToken));
  const projectFromStore = getProjectBySlug(projectId);
  const project: Project | undefined = publicProject || projectFromStore;
  const realProjectId = project?.id ?? "";
  const isPublicMode = Boolean(publicToken);
  const { setCenter, fitView } = useReactFlow(); // Agora funciona porque está dentro do ReactFlow

  useEffect(() => {
    if (!isPublicMode || !publicToken) return;

    let cancelled = false;
    setIsPublicLoading(true);

    const loadPublicProject = async () => {
      try {
        const response = await fetch(`/api/public/projects/${projectId}?token=${encodeURIComponent(publicToken)}`);
        if (!response.ok) {
          if (!cancelled) {
            setPublicProject(null);
            setIsPublicLoading(false);
          }
          return;
        }
        const payload = await response.json();
        if (!cancelled) {
          setPublicProject(payload?.project || null);
          setIsPublicLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPublicProject(null);
          setIsPublicLoading(false);
        }
      }
    };

    void loadPublicProject();

    return () => {
      cancelled = true;
    };
  }, [isPublicMode, publicToken, projectId]);
  
  // Merge de configurações: custom settings do projeto sobre defaults
  const config = useMemo(() => 
    deepMerge(MINDMAP_CONFIG, project?.mindMapSettings),
    [project?.mindMapSettings]
  );
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Section | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Bolinha sob o cursor. E um estado separado da selecao de proposito: o hover
  // e leitura passageira (some quando o mouse sai), a selecao e escolha do
  // usuario (abre o painel e persiste).
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Guarda quem tinha o hover no ciclo anterior, para a label ter tempo de sair.
  const hoverAnteriorRef = useRef<string | null>(null);
  // Refs cruzadas ficam escondidas por padrao: numa bolinha muito referenciada
  // elas viram dezenas de linhas de uma vez e o mapa fica ilegivel. O usuario
  // liga no toggle do painel, e trocar de bolinha volta pro default.
  const [showReferences, setShowReferences] = useState(false);
  const [referenceCount, setReferenceCount] = useState(0);
  // Colorir por maturidade. Nao persiste de propósito: e um modo de vistoria
  // ("quanto do GDD ja esta no jogo?"), nao o jeito de ler o mapa todo dia.
  const [colorirPorEstado, setColorirPorEstado] = useState(false);
  // Previa pendente: clicar numa referencia abre o modal em vez de saltar.
  const [pendingReference, setPendingReference] = useState<{ sectionId: string; title: string; description: string } | null>(null);
  // Trilha de saltos por referencia, pra oferecer a volta. Zera quando o usuario
  // clica direto numa bolinha do mapa — ali ele escolheu o lugar, nao foi levado.
  const [navigationStack, setNavigationStack] = useState<string[]>([]);
  const [maxZoom, setMaxZoom] = useState<number>(8);
  
  
  // Estado para guardar posições originais durante o drag
  const [originalPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  
  // Estado para threshold de drag (evitar ativar drag em clicks)
  
  // Busca — termo vem do contexto compartilhado (input renderizado no breadcrumbs pelo layout
  // no modo privado, ou no header interno no modo público).
  const {
    searchTerm,
    setSearchTerm,
    setResults: setContextResults,
    activeResultId,
    resultCount,
    activeIndex,
    navigate: navigateSearchResult,
  } = useMindMapSearch();
  const [searchResults, setSearchResults] = useState<Set<string>>(new Set());
  const flowWrapperRef = useRef<HTMLDivElement>(null);
  const panelContentScaleRaw = Number((config as any)?.sidebar?.contentScale ?? 0.85);
  const panelContentScale = Number.isFinite(panelContentScaleRaw)
    ? Math.min(1.2, Math.max(0.5, panelContentScaleRaw))
    : 0.85;
  const heroThumbWidthRaw = project?.mindMapSettings?.documentView?.heroThumbWidth;
  const heroThumbWidth =
    heroThumbWidthRaw == null
      ? DEFAULT_DOCUMENT_HERO_THUMB_WIDTH
      : normalizeDocumentHeroThumbWidth(heroThumbWidthRaw);

  // Impedir que o scroll do mouse role a página quando estiver sobre o mapa (zoom do ReactFlow deve consumir o wheel)
  useEffect(() => {
    const el = flowWrapperRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Função para realizar busca
  const performSearch = useCallback((term: string) => {
    if (!term.trim() || !project) {
      setSearchResults(new Set());
      setContextResults([]);
      return;
    }

    const lowerTerm = term.toLowerCase();
    const orderedIds: string[] = [];

    // Buscar em todas as seções; o título tem prioridade sobre matches só por conteúdo,
    // então iteramos em duas passadas para que o primeiro resultado cicle por títulos primeiro.
    const sections = project.sections || [];
    const titleMatches: string[] = [];
    const contentOnlyMatches: string[] = [];
    sections.forEach((section: Section) => {
      const titleMatch = section.title.toLowerCase().includes(lowerTerm);
      const contentMatch = section.content?.toLowerCase().includes(lowerTerm) ?? false;
      if (titleMatch) {
        titleMatches.push(section.id);
      } else if (contentMatch) {
        contentOnlyMatches.push(section.id);
      }
    });
    orderedIds.push(...titleMatches, ...contentOnlyMatches);

    setSearchResults(new Set(orderedIds));
    setContextResults(orderedIds);
  }, [project, setContextResults]);

  // Effect para realizar busca quando searchTerm muda
  useEffect(() => {
    performSearch(searchTerm);
  }, [searchTerm, performSearch]);

  // Espelho dos nos para o foco da busca ler sem depender deles.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Centralizar a viewport no resultado ativo quando o usuário navega pelos resultados (↑/↓/Enter).
  //
  // A dependencia aqui e SO o `activeResultId`. Antes `nodes` estava na lista, e
  // como a busca marca os resultados via setNodes, o efeito reexecutava durante
  // a animacao e chamava setCenter de novo — cada chamada reiniciava a
  // suavizacao a partir da posicao atual. O resultado era a camera indo em
  // passinhos: medido, uma animacao de 600ms ainda nao tinha assentado depois
  // de 1.56s.
  useEffect(() => {
    if (!activeResultId) return;
    const node = nodesRef.current.find((n) => n.id === activeResultId);
    if (!node) return;
    const targetSize = (config as any).zoom?.onClickTargetSize || 200;
    let nodeSize = 100;
    if (node.data?.calculatedSize) {
      nodeSize = node.data.calculatedSize;
    } else if (node.data?.level !== undefined) {
      nodeSize = getNodeSize(node.data.level, config);
    }
    const zoomLevel = targetSize / nodeSize;
    setCenter(node.position.x + nodeSize / 2, node.position.y + nodeSize / 2, { zoom: zoomLevel, duration: 600 });
  }, [activeResultId, setCenter, config]);

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
        type: 'centro',
        animated: projectEdgeConfig.animated,
        style: { 
          stroke: (config as any).clean.line, 
          strokeWidth: pxTela((config as any).clean.lineWidth),
          ...(needsDashPattern && { strokeDasharray: pxTela(Number(dashValue)) }),
        },
        data: {
          sourceLevel: -1,
          originalStyle: {
            stroke: (config as any).clean.line,
            strokeWidth: pxTela((config as any).clean.lineWidth),
            strokeDasharray: needsDashPattern ? pxTela(Number(dashValue)) : undefined,
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

  // A linha de parentesco pode ser desligada nas configuracoes do projeto, por
  // nivel e para o no central. Vale SO no estado de repouso: assim que o usuario
  // seleciona uma bolinha, o destaque e o fade voltam a mandar e as linhas
  // reaparecem. Ausente ou true = visivel, pra nao mexer em projeto ja existente.
  const linhaVisivelEmRepouso = useCallback((edge: Edge) => {
    if (edge.source === 'project-center') {
      return (config.project?.edge as any)?.visible !== false;
    }
    const nivel = (edge.data as any)?.sourceLevel ?? 0;
    const niveis = (config as any).levels;
    if (niveis && niveis.length > 0) {
      const doNivel = niveis[nivel] || niveis[niveis.length - 1];
      return doNivel?.edge?.visible !== false;
    }
    const legado = nivel === 0
      ? config.sections.edge
      : nivel === 1
        ? config.subsections.edge
        : config.deepSubsections.edge;
    return (legado as any)?.visible !== false;
  }, [config]);

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
            const sourceLevel = (edge.data as any)?.sourceLevel ?? 0;
            
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
            hidden: !linhaVisivelEmRepouso(edge),
            className: undefined,
            animated: edgeConfig.animated || false,
            style: {
              stroke: (config as any).clean.line,
              strokeWidth: pxTela((config as any).clean.lineWidth),
              strokeDasharray: needsDashPattern ? pxTela(Number(dashValue)) : undefined,
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
            const sourceLevel = (edge.data as any)?.sourceLevel ?? 0;
            
            // Usar config do nível apropriado
            if (sourceLevel === 0) {
              highlightConfig = config.sections.edge.highlighted;
            } else if (sourceLevel === 1) {
              highlightConfig = config.subsections.edge.highlighted;
            } else {
              highlightConfig = config.deepSubsections.edge.highlighted;
            }
          }
          
          // Espessura e tracejado em unidades de TELA, via pxTela (ver o helper).
          // <style> abaixo, classe gdd-edge-fixa). Antes isso era feito
          // dividindo pelo zoom, o que exigia assinar `transform` do store e
          // re-renderizar o componente inteiro a cada frame de camera — 828
          // mutacoes de DOM no painel lateral por gesto de zoom, medido.
          // O resultado na tela e o mesmo: 1.5px de linha, 5.5px de traco.
          const baseStrokeWidth = highlightConfig.strokeWidth || 1;
          const baseDashSize = highlightConfig.dashPattern || 5;
          // No modo animado o traco precisa ser maior pra leitura do movimento.
          // Valor escolhido, nao medido: este projeto usa highlighted.animated
          // = false, entao a variante animada nao foi exercitada.
          const dashValue = highlightConfig.animated ? baseDashSize * 3 : baseDashSize;

          return {
            ...edge,
            // Com o toggle de refs ligado, some com as linhas de parentesco do no
            // selecionado: sao elas que dominam a tela (uma pagina com 20 filhos
            // gera 20 linhas amarelas) e abafam justamente o que o toggle quer
            // mostrar. As linhas do resto do mapa continuam, ja esmaecidas.
            hidden: showReferences,
            className: "gdd-edge-fixa",
            animated: highlightConfig.animated,
            style: {
              strokeWidth: pxTela((config as any).clean.highlightWidth),
              stroke: (config as any).clean.highlight,
              strokeDasharray: (config as any).clean.highlightDash > 0
                ? `${pxTela((config as any).clean.highlightDash)} ${pxTela((config as any).clean.highlightDash)}`
                : undefined,
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
          const sourceLevel = (edge.data as any)?.sourceLevel ?? 0;
          
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
          hidden: false, // limpa o hidden herdado pelo spread quando a edge sai do destaque
          className: undefined, // idem para a classe de espessura fixa
          animated: edgeConfig.animated || false,
          style: {
            stroke: (config as any).clean.line,
            strokeWidth: pxTela((config as any).clean.lineWidth),
            strokeDasharray: needsDashPattern ? pxTela(Number(dashValue)) : undefined,
            opacity: edgeOpacity, // Aplicar opacity reduzida nas edges não destacadas
          },
        };
      });
    });
  }, [selectedNodeId, setEdges, config, showReferences, linhaVisivelEmRepouso]);

  // Efeito para marcar node selecionado visualmente (glow)
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: n.id === selectedNodeId },
      }))
    );
  }, [selectedNodeId, setNodes]);

  // Marca quem esta sob o cursor e quem e vizinho dele (pai e filhos diretos).
  // Roda por ENTRADA no no, nao por frame, entao reconstruir o array de nos aqui
  // custa pouco — diferente do efeito de camera, que rodava a 60fps.
  // Marca quem esta sob o cursor, quem e vizinho, e quem ACABOU de sair.
  //
  // O "acabou de sair" existe porque desmontar nao transiciona: sem ele a label
  // do no que perde o hover desaparece de golpe. A alternativa seria manter as
  // 245 labels montadas o tempo todo, mas isso custava ~6ms a mais por passo de
  // zoom (medido: 28.7ms contra 22.8ms) — caro para resolver o desaparecimento
  // de UMA label.
  //
  // A marcacao acontece DENTRO deste efeito, e nao por um estado separado: com
  // estado havia um render intermediario em que a label ja tinha desmontado, e
  // remontar tambem nao transiciona.
  useEffect(() => {
    const anterior = hoverAnteriorRef.current;
    hoverAnteriorRef.current = hoveredId;

    setNodes((nds) => {
      if (!hoveredId) {
        if (!nds.some((n) => n.data.hoverAtivo || n.data.hoverSaindo)) return nds;
        return nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            hoverAtivo: false,
            isHovered: false,
            hoverVizinho: false,
            hoverSaindo: n.id === anterior,
          },
        }));
      }
      const vizinhos = new Set<string>();
      for (const e of edges) {
        if (e.id.startsWith("ref-")) continue;
        if (e.source === hoveredId) vizinhos.add(e.target);
        if (e.target === hoveredId) vizinhos.add(e.source);
      }
      return nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          hoverAtivo: true,
          isHovered: n.id === hoveredId,
          hoverVizinho: vizinhos.has(n.id),
          hoverSaindo: false,
        },
      }));
    });

    // Nao ha temporizador para limpar o `hoverSaindo`: ele e zerado no proximo
    // hover (ver o ramo acima). Havia um setTimeout de 600ms aqui e ele estava
    // desfazendo a SELECAO — medido: a bolinha clicada ficava em 25.6px com
    // aura ate os 400ms e voltava a 16px sem aura aos 600ms, e desligar o timer
    // fazia a selecao persistir. Nao encontrei o mecanismo lendo o codigo (o
    // callback preserva `isSelected` no spread), entao removi a causa em vez de
    // insistir. O custo de nao limpar por tempo e uma label invisivel que fica
    // montada ate o hover seguinte.
  }, [hoveredId, edges, setNodes]);

  // Trocar de bolinha (ou fechar o painel) sempre volta ao estado escondido.
  useEffect(() => {
    setShowReferences(false);
  }, [selectedNodeId]);

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
      setReferenceCount(0);
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

    // Se um nó referenciado (ou que nos referencia) já faz parte do parentesco
    // (pais/avós/filhos diretos), não criamos edge de referência para ele:
    // a edge normal de parentesco já representa a conexão, mostrar as duas
    // gera linhas duplicadas apontando para o mesmo destino.
    nodesInPath.forEach((id) => {
      referencedNodeIds.delete(id);
      backlinksNodeIds.delete(id);
    });

    // A contagem sai das refs REAIS, antes de qualquer filtro do toggle: o
    // painel precisa dizer quantas linhas apareceriam mesmo estando escondidas.
    setReferenceCount(referencedNodeIds.size + backlinksNodeIds.size);

    // Toggle desligado (default): zera os dois conjuntos. Isso mata as edges e
    // tambem tira os nos referenciados da isencao de fade la embaixo — senao o
    // mapa fica cheio de bolinha acesa sem linha nenhuma explicando o porque.
    if (!showReferences) {
      referencedNodeIds.clear();
      backlinksNodeIds.clear();
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
          // Traco em px de tela, como o resto do estilo limpo.
          const dashValue = (config as any).clean.referenceDash;
          
          const showIcon = refConfig.showIcon ?? true;
          const icon = refConfig.icon || '🔗';
          
          return {
            id: `ref-${selectedNodeId}-${targetId}`,
            source: selectedNodeId,
            target: targetId,
            type: 'centro',
            animated: refConfig.edgeAnimated || false,
            label: showIcon ? icon : undefined,
            labelStyle: {
              fontSize: pxTela((config as any).clean.referenceIcon),
              fill: (config as any).clean.reference,
              fontWeight: 'bold',
            },
            labelBgStyle: {
              fill: 'transparent',
            },
            labelShowBg: false,
            style: {
              stroke: (config as any).clean.reference,
              strokeWidth: pxTela((config as any).clean.referenceWidth),
              strokeDasharray: needsDashPattern ? pxTela(Number(dashValue)) : undefined,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: (config as any).clean.reference,
              width: 9,
              height: 9,
            },
          };
        });

        // Criar edges de referência (chegando ao nó selecionado - backlinks)
        const backwardReferenceEdges: Edge[] = Array.from(backlinksNodeIds).map(sourceId => {
          const needsDashPattern = refConfig.edgeAnimated || refConfig.edgeDashed;
          // Traco em px de tela, como o resto do estilo limpo.
          const dashValue = (config as any).clean.referenceDash;
          
          const showIcon = refConfig.showIcon ?? true;
          const icon = refConfig.icon || '🔗';
          
          return {
            id: `ref-${sourceId}-${selectedNodeId}`,
            source: sourceId,
            target: selectedNodeId,
            type: 'centro',
            animated: refConfig.edgeAnimated || false,
            label: showIcon ? icon : undefined,
            labelStyle: {
              fontSize: pxTela((config as any).clean.referenceIcon),
              fill: (config as any).clean.reference,
              fontWeight: 'bold',
            },
            labelBgStyle: {
              fill: 'transparent',
            },
            labelShowBg: false,
            style: {
              stroke: (config as any).clean.reference,
              strokeWidth: pxTela((config as any).clean.referenceWidth),
              strokeDasharray: needsDashPattern ? pxTela(Number(dashValue)) : undefined,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: (config as any).clean.reference,
              width: 9,
              height: 9,
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
  }, [selectedNodeId, config, project, searchResults, searchTerm, showReferences]);

  /** Estado de cada pagina, para o modo de cor por maturidade. */
  const estadoPorId = useMemo(() => {
    const mapa = new Map<string, PageStatus | undefined>();
    for (const s of project?.sections ?? []) mapa.set(s.id, s.status);
    return mapa;
  }, [project?.sections]);

  /** Quantas paginas em cada estado — a legenda so mostra o que existe. */
  const contagemPorEstado = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const estado of estadoPorId.values()) {
      const chave = estado ?? "__sem__";
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    return contagem;
  }, [estadoPorId]);

  /**
   * Pinta as bolinhas por estado sem refazer o layout.
   *
   * De proposito uma passada leve sobre os nodes existentes, e nao um parametro
   * do processSections: refazer o layout recalcularia as posicoes das 250
   * bolinhas a cada clique no toggle, e o mapa saltaria na cara do usuario so
   * por trocar de cor.
   */
  useEffect(() => {
    const corDoNo = (id: string): string | undefined => {
      if (!colorirPorEstado || !estadoPorId.has(id)) return undefined;
      const estado = estadoPorId.get(id);
      // Sem estado nao fica invisivel, fica em segundo plano: e o cinza que o
      // mapa ja usa para "isso nao e o assunto agora".
      return estado ? PAGE_STATUS_META[estado].graphColor : (config as any).clean.muted;
    };

    setNodes((nds) => {
      if (nds.every((n) => n.data.statusColor === corDoNo(n.id))) return nds;
      return nds.map((n) => ({ ...n, data: { ...n.data, statusColor: corDoNo(n.id) } }));
    });
  }, [colorirPorEstado, estadoPorId, config, setNodes]);


  // Guarda a posicao para devolver o no ao soltar. O `nodeDragThreshold` do
  // React Flow so dispara o arrasto depois de 5px de movimento, entao quando
  // este handler roda o arrasto ja e real — nao ha clique disfarcado de arrasto
  // para filtrar. Antes isso era feito a mao com dois Maps, um contador de
  // distancia dentro do onNodeDrag e uma flag de "ativado".
  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.position) {
      originalPositions.set(node.id, { ...node.position });
    }
    setNodes((nds) =>
      nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, isDragging: true } } : n))
    );
  }, [originalPositions, setNodes]);

  // Handler para resetar posição ao soltar o nó
  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    const originalPos = originalPositions.get(node.id);
    if (originalPos) {
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
  }, [originalPositions, setNodes]);

  // Caminho da raiz ate o AVO do no selecionado, montado subindo pelas edges de
  // parentesco. Nao inclui o proprio no — o titulo logo abaixo ja o mostra — e
  // tambem nao inclui o pai: ele abre o menu de navegacao em destaque, e ter os
  // dois a 300px um do outro era dizer a mesma coisa duas vezes. Aqui fica o
  // "por onde eu vim, la de cima"; o passo de um grau e do menu.
  const caminhoAcimaDoPai = useMemo(() => {
    if (!selectedNodeId || selectedNodeId === "project-center") return [];
    const pais = new Map<string, string>();
    for (const e of edges) {
      if (e.id.startsWith("ref-")) continue;
      pais.set(e.target, e.source);
    }
    const trilha: { id: string; titulo: string }[] = [];
    let atual = pais.get(selectedNodeId);
    const visitados = new Set<string>([selectedNodeId]);
    while (atual && !visitados.has(atual)) {
      visitados.add(atual);
      if (atual === "project-center") {
        trilha.unshift({ id: atual, titulo: project?.title || "" });
        break;
      }
      const sec = (project?.sections || []).find((x: Section) => x.id === atual);
      if (sec) trilha.unshift({ id: atual, titulo: sec.title || atual });
      atual = pais.get(atual);
    }
    // Fora o ultimo, que e o pai — quem o mostra e o menu.
    return trilha.slice(0, -1);
  }, [selectedNodeId, edges, project]);

  // O menu do painel: o PAI, para subir, e os filhos de primeiro grau, para
  // descer. Um grau so de propositio — a arvore inteira ja e o mapa ali do
  // lado; aqui a pergunta e so "e o que vem depois desta pagina?".
  //
  // A ordem dos filhos e a mesma do array de secoes, que e a ordenacao do
  // projeto — a mesma que o mapa usa para distribuir as bolinhas.
  const menuDeNavegacao = useMemo(() => {
    const vazio = {
      pai: null as { id: string; titulo: string } | null,
      filhos: [] as Array<{ id: string; titulo: string; cor: string; netos: number }>,
    };
    if (!selectedNodeId || !project) return vazio;

    const secoes = project.sections || [];
    const corPadrao = (config as any).clean.accent;

    // Quantos filhos cada pagina tem, numa passada so. Um filter por item da
    // lista seria quadratico, e projeto grande aqui passa de 240 paginas.
    const quantosFilhos = new Map<string, number>();
    for (const s of secoes) {
      if (!s.parentId) continue;
      quantosFilhos.set(s.parentId, (quantosFilhos.get(s.parentId) || 0) + 1);
    }

    const comoItem = (s: Section) => ({
      id: s.id,
      titulo: s.title,
      // A mesma cor da bolinha no mapa (ver `bgColor` no no): a customizada da
      // pagina e, na falta dela, o acento do tema. E o que liga o titulo lido
      // aqui a bolinha que voce esta vendo ao lado.
      cor: s.color || corPadrao,
      netos: quantosFilhos.get(s.id) || 0,
    });

    // A bolinha do centro nao tem pai e seus filhos sao as secoes de raiz.
    if (selectedNodeId === "project-center") {
      return { pai: null, filhos: secoes.filter((s: Section) => !s.parentId).map(comoItem) };
    }

    const atual = secoes.find((s: Section) => s.id === selectedNodeId);
    if (!atual) return vazio;

    const secaoPai = atual.parentId
      ? secoes.find((s: Section) => s.id === atual.parentId)
      : undefined;
    // Sem parentId a pagina e de primeiro nivel: quem esta acima dela e o
    // projeto, a bolinha do centro do mapa.
    const pai = secaoPai
      ? { id: secaoPai.id, titulo: secaoPai.title }
      : atual.parentId
        ? null
        : { id: "project-center", titulo: project.title || "" };

    return {
      pai,
      filhos: secoes.filter((s: Section) => s.parentId === selectedNodeId).map(comoItem),
    };
  }, [selectedNodeId, project, config]);

  // A lista de filhos tem rolagem propria, e rolagem que nao se anuncia parece
  // lista que acabou. O fio de esfumado so aparece enquanto sobra coisa embaixo.
  const listaFilhosRef = useRef<HTMLDivElement>(null);
  const [temMaisFilhosAbaixo, setTemMaisFilhosAbaixo] = useState(false);
  const conferirRolagemDosFilhos = useCallback(() => {
    const el = listaFilhosRef.current;
    if (!el) return;
    // 2px de folga: com alturas fracionarias o fim da rolagem nunca bate exato.
    setTemMaisFilhosAbaixo(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
  }, []);
  useEffect(() => {
    conferirRolagemDosFilhos();
  }, [conferirRolagemDosFilhos, menuDeNavegacao.filhos]);


  // Centraliza a camera num no pelo id. Existe separado porque precisa ser
  // chamado de novo depois que o painel abre (ver o efeito logo abaixo).
  const centralizarNo = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    const targetSize = (config as any).zoom?.onClickTargetSize || 200;
    let nodeSize = 100;
    if (node.id === 'project-center') {
      nodeSize = config.project.node.size;
    } else if (node.data?.calculatedSize) {
      nodeSize = node.data.calculatedSize;
    } else if (node.data?.level !== undefined) {
      nodeSize = getNodeSize(node.data.level, config);
    }
    // position e o CANTO superior esquerdo; sem somar metade do tamanho a
    // camera centraliza no canto e a bolinha sai do enquadramento.
    setCenter(node.position.x + nodeSize / 2, node.position.y + nodeSize / 2, {
      zoom: targetSize / nodeSize,
      duration: 800,
    });
  }, [config, setCenter]);

  // Seleciona um no pelo id, como se o usuario tivesse clicado nele no mapa.
  const selecionarPorId = useCallback((id: string) => {
    centralizarNo(id);
    setNavigationStack([]);
    setSelectedNodeId(id);
    if (id === "project-center") {
      setSelectedNode({
        id: "project",
        title: project?.title || "",
        content: project?.description || "",
        order: 0,
        created_at: new Date().toISOString(),
      } as Section);
      return;
    }
    const sec = (project?.sections || []).find((x: Section) => x.id === id);
    if (sec) setSelectedNode(sec);
  }, [centralizarNo, project]);

  // Quando o painel ABRE, o mapa encolhe para dar lugar a ele. A
  // centralizacao feita no clique usou a largura ANTIGA (tela inteira), entao
  // a bolinha acabava fora do enquadramento — e so no segundo clique, com o
  // painel ja aberto, o foco saia certo. Aqui recentralizamos depois que a
  // faixa terminou de abrir.
  const painelAberto = Boolean(selectedNode);
  const painelAbertoAntes = useRef(painelAberto);
  useEffect(() => {
    const abriuAgora = painelAberto && !painelAbertoAntes.current;
    painelAbertoAntes.current = painelAberto;
    if (!abriuAgora || !selectedNodeId) return;
    const t = setTimeout(() => centralizarNo(selectedNodeId), 260);
    return () => clearTimeout(t);
  }, [painelAberto, selectedNodeId, centralizarNo]);

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

    // So centraliza agora se o painel JA estiver aberto. Se ele vai abrir, o
    // mapa esta prestes a encolher e essa centralizacao seria descartada — o
    // efeito abaixo faz a boa depois que a faixa termina de abrir. Centralizar
    // duas vezes custava ~3s ate a bolinha assentar.
    if (selectedNode) centralizarNo(node.id);

    // Clique direto numa bolinha e escolha do usuario, nao um salto: zera a trilha.
    setNavigationStack([]);
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
  }, [project, setCenter, config, selectedNode, centralizarNo]);

  // Salto propriamente dito: centraliza a camera e seleciona a bolinha.
  // `cameDeId` empilha a origem, pra o painel poder oferecer a volta.
  const goToSection = useCallback((sectionId: string, cameDeId?: string | null) => {
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

    if (cameDeId) {
      setNavigationStack((stack) => [...stack, cameDeId]);
    }
  }, [nodes, config, setCenter, project]);

  // Clicar numa referencia NAO salta direto: abre a previa e espera confirmacao.
  // Saltar na hora fazia o usuario perder de vista onde estava — o mapa some
  // debaixo dele e nao ha titulo de pagina pra ancorar, so bolinhas.
  const handleReferenceClick = useCallback((sectionId: string) => {
    const section = project?.sections?.find((s: Section) => s.id === sectionId);
    if (!section) return;
    setPendingReference({
      sectionId,
      title: section.title || sectionId,
      description: toShortDescription(section.content || ""),
    });
  }, [project]);

  // Volta um salto: desempilha a origem e vai pra ela sem empilhar de novo.
  const handleGoBack = useCallback(() => {
    const previousId = navigationStack[navigationStack.length - 1];
    if (!previousId) return;
    setNavigationStack((stack) => stack.slice(0, -1));
    goToSection(previousId);
  }, [navigationStack, goToSection]);

  const getDocumentTargetUrl = (sectionId?: string) => {
    if (isPublicMode) {
      const base = `/s/${encodeURIComponent(publicToken || "")}?mode=view`;
      return sectionId ? `${base}&focus=${encodeURIComponent(sectionId)}#section-${sectionId}` : base;
    }

    const base = `/projects/${projectId}/view`;
    return sectionId ? `${base}?focus=${encodeURIComponent(sectionId)}#section-${sectionId}` : base;
  };

  const getFlowchartTargetUrl = (sectionId: string) => {
    if (isPublicMode) {
      return `/s/${encodeURIComponent(publicToken || "")}?mode=diagramas&sectionId=${encodeURIComponent(sectionId)}`;
    }
    return `${sectionPathById(project ?? { title: "", sections: [] }, sectionId)}/diagramas`;
  };

  if (!project) {
    if (isPublicMode && isPublicLoading) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-900">
          <p className="text-gray-400">{t("common.loading")}</p>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <p className="text-gray-400">{isPublicMode ? t("mindMap.publicProjectNotFound") : t("mindMap.projectNotFound")}</p>
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={config}>
      <style>
        {`
          /* Aura do no selecionado: um anel que nasce no tamanho do ponto e
             se abre desaparecendo. Fica dentro do wrapper contra-escalado,
             entao pulsa do mesmo tamanho em qualquer zoom. */
          @keyframes gddPulso {
            0%   { transform: scale(1);   opacity: 0.55; }
            70%  { opacity: 0; }
            100% { transform: scale(3.2); opacity: 0; }
          }

          @keyframes gddLabelEntra {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes dashdraw {
            from {
              stroke-dashoffset: 0;
            }
            to {
              stroke-dashoffset: ${config.animation?.distance || 500};
            }
          }
          

          /* Bolinhas e labels acima das linhas. Sem isso, num cacho denso a
             label fica atras do feixe de conexoes e vira ilegivel — as duas
             camadas ficavam em z-index 0 e quem pintava por cima era a ordem
             no DOM. */
          .react-flow__nodes { z-index: 3; }

          /* A espessura das linhas NAO e resolvida aqui — ver o helper pxTela.
             O zoom do React Flow vem de um transform CSS em div ancestral, e
             contra isso o vector-effect nao faz efeito. */
          /* Aplicar animação para TODAS as edges animadas (não só highlight) */
          .react-flow__edge.animated path {
            animation: dashdraw ${config.animation?.speed || 2}s linear infinite !important;
          }
        `}
      </style>
      <div className="fixed inset-0 overflow-hidden" style={{ backgroundColor: (config as any).clean.background }}>
        {/* A barra e a mesma do shell e do documento; em modo publico ela e a unica. */}
        {isPublicMode && (
          <ProjectTopBar
            icone={<IconeMapa />}
            iconeProjetoUrl={project?.mindMapSettings?.documentView?.spotlight?.titleIconUrl}
            titulo={t("projectTabs.mapTitle", "Game Design Map")}
            projectSlug={projectId}
            active="graph"
            publicToken={publicToken}
            badge={
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                <span>🔓</span>
                <span className="hidden sm:inline">{t("mindMap.publicBadge")}</span>
              </span>
            }
            busca={
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (resultCount > 0) navigateSearchResult(e.shiftKey ? -1 : 1);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      if (resultCount > 0) navigateSearchResult(1);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (resultCount > 0) navigateSearchResult(-1);
                    } else if (e.key === "Escape" && searchTerm) {
                      e.preventDefault();
                      setSearchTerm("");
                    }
                  }}
                  placeholder={t("mindMap.searchPlaceholder")}
                  className="bg-gray-50 text-gray-900 px-3 py-1.5 pl-8 pr-16 rounded-lg text-sm border border-gray-300 focus:border-blue-500 focus:outline-none w-44 sm:w-56 md:w-64"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                {searchTerm.trim().length > 0 && (
                  <span
                    className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-400 tabular-nums"
                    aria-live="polite"
                  >
                    {resultCount > 0 ? `${activeIndex + 1}/${resultCount}` : "0/0"}
                  </span>
                )}
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => navigateSearchResult(-1)}
                disabled={resultCount === 0}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title={t("mindMap.searchPrevious")}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => navigateSearchResult(1)}
                disabled={resultCount === 0}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title={t("mindMap.searchNext")}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            }
          />
        )}


        {/* React Flow - overflow-hidden evita barras de rolagem; onWheel evita scroll da página ao zoomar */}
        {/* O mapa cede espaco para o painel em vez de ficar por baixo dele.
            Posicionamento absoluto com `right`, e nao margem: por algum motivo a
            margem era ignorada neste elemento (computava 0px ate com !important).
            Com `right` o encaixe e explicito e nao depende disso. */}
        <div
          className="absolute left-0 top-20 bottom-0 overflow-hidden transition-[right] duration-200"
          style={{ right: selectedNode ? LARGURA_PAINEL : 0 }}
          ref={flowWrapperRef}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={(_e, node) => setHoveredId(node.id)}
            onNodeMouseLeave={() => setHoveredId(null)}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypesStable}
            edgeTypes={edgeTypesStable}
            nodesDraggable={true}
            nodeDragThreshold={5}
            nodesConnectable={false}
            elementsSelectable={true}
            fitView
            fitViewOptions={{ padding: config.zoom.fitViewPadding || 0.2, maxZoom: config.zoom.fitViewMaxZoom }}
            maxZoom={maxZoom}
            minZoom={config.zoom.minZoom}
            proOptions={{ hideAttribution: true }}
            onlyRenderVisibleElements
            style={{ backgroundColor: (config as any).clean.background }}
          >
          <ZoomCssVar />
          <Controls className="border-gray-300" />

          {/* Vistoria de maturidade. Fica sobre o mapa, e nao no painel do no,
              porque fala do documento inteiro — o painel so aparece quando ha
              uma pagina selecionada, e a pergunta aqui e "quanto do GDD ja
              esta no jogo", nao "o que e esta pagina". */}
          <Panel position="top-left" className="!m-3">
            <div className="rounded-lg border border-gray-300 bg-white/95 shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={() => setColorirPorEstado((v) => !v)}
                aria-pressed={colorirPorEstado}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  colorirPorEstado
                    ? "text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: colorirPorEstado
                      ? PAGE_STATUS_META.implemented.graphColor
                      : (config as any).clean.accent,
                  }}
                />
                {t("mindMap.statusColors.toggle", "Cores por maturidade")}
              </button>

              {colorirPorEstado && (
                <div className="flex flex-col gap-1 border-t border-gray-200 px-3 py-2">
                  {PAGE_STATUSES.filter((estado) => contagemPorEstado.get(estado)).map((estado) => (
                    <span key={estado} className="flex items-center gap-2 text-xs text-gray-600">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: PAGE_STATUS_META[estado].graphColor }}
                      />
                      {t(PAGE_STATUS_META[estado].labelKey, PAGE_STATUS_META[estado].labelFallback)}
                      <span className="ml-auto tabular-nums text-gray-400">
                        {contagemPorEstado.get(estado)}
                      </span>
                    </span>
                  ))}
                  {(contagemPorEstado.get("__sem__") ?? 0) > 0 && (
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: (config as any).clean.muted }}
                      />
                      {t("pageStatus.unset", "sem estado")}
                      <span className="ml-auto tabular-nums text-gray-400">
                        {contagemPorEstado.get("__sem__")}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Panel Lateral */}
      {selectedNode && (
        <div
          className="absolute top-20 right-0 h-[calc(100vh-5rem)] border-l border-gray-200 overflow-y-auto z-20"
          style={{ width: LARGURA_PAINEL, backgroundColor: (config as any).clean.backgroundPainel }}
        >
          <div className="px-12 py-10">
            {/* Volta de um salto por referencia. So aparece quando o usuario foi
                TRAZIDO pra ca — clicar direto numa bolinha zera a trilha, porque
                ali ele escolheu o lugar e nao precisa de migalha. */}
            {navigationStack.length > 0 && (() => {
              const previousId = navigationStack[navigationStack.length - 1];
              const previous = previousId === "project"
                ? { title: project?.title || "" }
                : (project?.sections || []).find((s: Section) => s.id === previousId);
              if (!previous) return null;
              return (
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="mb-3 flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <span aria-hidden="true">←</span>
                  <span className="min-w-0 truncate">
                    {t("mindMap.panel.backTo").replace("{{title}}", previous.title)}
                  </span>
                </button>
              );
            })()}
            {selectedNode.id !== "project" && Boolean((selectedNode as Section).flowchartEnabled) && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/45 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                </span>
                {t("sectionDetail.flowchart.breadcrumb")}
              </div>
            )}
            {caminhoAcimaDoPai.length > 0 && (
              <nav aria-label="breadcrumb" className="mb-3 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-gray-500">
                {caminhoAcimaDoPai.map((c, i) => (
                  <span key={c.id} className="flex items-center gap-x-1 min-w-0">
                    {i > 0 && <span className="text-gray-300" aria-hidden="true">›</span>}
                    <button
                      type="button"
                      onClick={() => selecionarPorId(c.id)}
                      className="max-w-[13rem] truncate rounded px-1 py-0.5 transition-colors hover:bg-gray-100 hover:text-gray-800"
                    >
                      {c.titulo}
                    </button>
                  </span>
                ))}
              </nav>
            )}
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-900 min-w-0">{selectedNode.title}</h2>
              {/* Acoes no topo, junto do fechar: sao atalhos para sair do mapa e
                  nao conclusao da leitura — no rodape ficavam depois de uma
                  descricao que pode ter varias telas de rolagem. */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Para uma pagina, o trio compartilhado: ver no Doc, no Deck,
                    editar. Para o node do projeto nao ha pagina para levar, so
                    o documento inteiro. */}
                {selectedNode.id === "project" ? (
                  <button
                    type="button"
                    title={t("mindMap.panel.goToDocument")}
                    aria-label={t("mindMap.panel.goToDocument")}
                    onClick={() => router.push(getDocumentTargetUrl())}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  >
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                ) : (
                  <PageModeLinks
                    current="graph"
                    projectId={projectId}
                    project={project}
                    sectionId={selectedNode.id}
                    publicToken={publicToken}
                    iconClassName="h-[18px] w-[18px]"
                    buttonClassName="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  />
                )}
                {selectedNode.id !== "project" && Boolean((selectedNode as Section).flowchartEnabled) && (
                  <button
                    type="button"
                    title={t("sectionDetail.flowchart.openWithTitle").replace("{{title}}", selectedNode.title)}
                    aria-label={t("sectionDetail.flowchart.openWithTitle").replace("{{title}}", selectedNode.title)}
                    onClick={() => router.push(getFlowchartTargetUrl(selectedNode.id))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h6m0 0v6m0-6l-8 8m-4 0h4v4" />
                    </svg>
                  </button>
                )}
                {/* So o node do projeto: para uma pagina, o lapis ja veio no
                    trio acima e este botao seria o mesmo destino duas vezes. */}
                {!isPublicMode && selectedNode.id === "project" && (
                  <button
                    type="button"
                    title={t("mindMap.panel.viewDetails")}
                    aria-label={t("mindMap.panel.viewDetails")}
                    onClick={() =>
                      router.push(
                        selectedNode.id === 'project'
                          ? (project ? `${projectPath(project)}/edit` : "/")
                          : sectionPathById(project ?? { title: "", sections: [] }, selectedNode.id)
                      )
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  >
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setNavigationStack([]);
                  setSelectedNodeId(null);
                  // Limpar parâmetro focus da URL
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('focus');
                    window.history.replaceState({}, '', url.toString());
                  }
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 text-2xl leading-none"
              >
                ×
              </button>
              </div>
            </div>

            {/* Tags de domínio (só para seções, não para o node do projeto) */}
            {selectedNode.id !== "project" && (selectedNode.domainTags?.length ?? 0) > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {(selectedNode.domainTags || []).map((tag) => {
                  const label = DOMAIN_I18N_KEYS[tag as GameDesignDomainId] ? t(DOMAIN_I18N_KEYS[tag as GameDesignDomainId]) : tag;
                  return (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 border border-gray-200"
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Toggle das refs cruzadas. Fica aqui, entre as tags e a descricao,
                porque a descricao costuma ser longa: no fim do painel o botao
                exigiria rolar ate embaixo pra mexer no mapa que esta a esquerda.
                Some quando o no nao referencia nem e referenciado por ninguem. */}
            {referenceCount > 0 && (
              <button
                type="button"
                onClick={() => setShowReferences((v) => !v)}
                aria-pressed={showReferences}
                className={`mb-4 inline-flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  showReferences
                    ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "border-gray-300 bg-gray-700/50 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true">{config.references?.icon || "🔗"}</span>
                  {showReferences
                    ? t("mindMap.references.hide")
                    : t("mindMap.references.show")}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    showReferences ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {referenceCount}
                </span>
              </button>
            )}

            {/* Daqui pra baixo o painel se divide em duas colunas: o menu de
                navegacao e a leitura. O cabecalho e o botao das referencias
                ficaram acima, na largura inteira — eles falam da pagina que voce
                esta lendo, e nao de para onde voce pode ir. */}
            <div className="flex flex-col gap-6 lg:flex-row lg:gap-7">
              {(menuDeNavegacao.pai || menuDeNavegacao.filhos.length > 0) && (
                // `sticky` porque a descricao pode ter varias telas: o menu e
                // navegacao, e navegacao que rola pra fora da tela nao serve.
                <nav
                  aria-label={t("mindMap.panel.navMenu", "Páginas vizinhas")}
                  className="shrink-0 self-start lg:sticky lg:top-2 lg:w-40 xl:w-48"
                >
                  {menuDeNavegacao.pai && (
                    <ItemNavegacao
                      titulo={menuDeNavegacao.pai.titulo}
                      variante="pai"
                      onClick={() => selecionarPorId(menuDeNavegacao.pai!.id)}
                    />
                  )}
                  {menuDeNavegacao.filhos.length > 0 && (
                    // Rolagem propria: o pai fica preso aqui em cima, sempre
                    // visivel, e sao os filhos que correm quando sao muitos.
                    // O fio separa quem esta acima de quem esta abaixo — e o
                    // mesmo fio que separa o "Referenciado por" da descricao.
                    <div
                      className={`relative ${
                        menuDeNavegacao.pai ? "mt-1.5 border-t border-gray-200 pt-1.5" : ""
                      }`}
                    >
                      <div
                        ref={listaFilhosRef}
                        onScroll={conferirRolagemDosFilhos}
                        className="flex max-h-[calc(100vh-18rem)] flex-col overflow-y-auto"
                      >
                        {menuDeNavegacao.filhos.map((filho) => (
                          <ItemNavegacao
                            key={filho.id}
                            titulo={filho.titulo}
                            variante="filho"
                            cor={filho.cor}
                            netos={filho.netos}
                            onClick={() => selecionarPorId(filho.id)}
                          />
                        ))}
                      </div>
                      {temMaisFilhosAbaixo && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
                          style={{
                            backgroundImage: `linear-gradient(to top, ${(config as any).clean.backgroundPainel}, transparent)`,
                          }}
                        />
                      )}
                    </div>
                  )}
                </nav>
              )}

              <div className="min-w-0 flex-1">
            <div className="prose max-w-none text-gray-700" style={{ fontSize: `${panelContentScale}em` }}>
              {selectedNode.content ? (
                <MarkdownWithMapReferences
                  content={selectedNode.content}
                  sections={project.sections || []}
                  onSectionClick={handleReferenceClick}
                  heroThumbUrl={
                    selectedNode.id !== "project" ? (selectedNode as Section).thumbImageUrl : undefined
                  }
                  heroThumbWidth={heroThumbWidth}
                />
              ) : (
                <>
                  {selectedNode.id !== "project" && (
                    <SectionHeroThumb
                      src={(selectedNode as Section).thumbImageUrl}
                      alt={t("sectionDetail.thumbnail.alt")}
                      width={heroThumbWidth}
                    />
                  )}
                  <p className="text-gray-500 italic">{t("mindMap.panel.noContent")}</p>
                  <div style={{ clear: "both" }} />
                </>
              )}
            </div>

            {/* Seção de Referenciado por */}
            {selectedNode.id !== 'project' && (() => {
              const backlinks = getBacklinks(selectedNode.id, project.sections || []);
              if (backlinks.length > 0) {
                return (
                  // Sem caixa e sem contorno: eram doze pilulas azuis dentro de um
                  // card, e o bloco pesava mais que a descricao da pagina. Agora e
                  // uma lista discreta separada por um fio, no registro do resto
                  // do painel.
                  <div className="mt-8 border-t border-gray-200 pt-5">
                    <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {t("mindMap.panel.backlinks")}
                    </h3>
                    <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                      {backlinks.map((backlink) => (
                        <button
                          key={backlink.id}
                          onClick={() => handleReferenceClick(backlink.id)}
                          className="max-w-full truncate rounded px-1.5 py-0.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                        >
                          {backlink.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {pendingReference && (
        <SectionPreviewDialog
          theme="light"
          title={pendingReference.title}
          description={pendingReference.description}
          confirmLabel={t("mindMap.panel.goToTarget").replace("{{title}}", pendingReference.title)}
          onCancel={() => setPendingReference(null)}
          onConfirm={() => {
            // A origem do salto e a bolinha aberta agora — e ela que a trilha guarda.
            goToSection(pendingReference.sectionId, selectedNodeId);
            setPendingReference(null);
          }}
        />
      )}
    </ConfigContext.Provider>
  );
}

// Componente wrapper que fornece o contexto do ReactFlow.
// Em modo público não temos o ProjectLayoutShell como pai, então aplicamos
// aqui o MindMapSearchProvider como fallback (no modo privado ele é um
// no-op aninhado — o `useMindMapSearch` resolve pelo provider mais interno,
// mas no privado o componente usa `setSearchTerm` só localmente dentro do
// wrapper público, então não há conflito).
export default function MindMapClient({ projectId, publicToken }: MindMapClientProps) {
  const content = (
    <ReactFlowProvider>
      <FlowContent projectId={projectId} publicToken={publicToken} />
    </ReactFlowProvider>
  );
  if (publicToken) {
    return <MindMapSearchProvider>{content}</MindMapSearchProvider>;
  }
  return content;
}
