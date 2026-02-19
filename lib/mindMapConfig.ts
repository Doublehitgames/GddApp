/**
 * Configuração visual e física do Mapa Mental
 * Edite este arquivo para personalizar cores, tamanhos, fontes e comportamento físico
 */

export const MINDMAP_CONFIG = {
  // ========================================
  // CONFIGURAÇÕES GLOBAIS
  // ========================================
  
  // Tamanhos dinâmicos dos nós (baseado no nível de profundidade)
  nodeSize: {
    baseSize: 100,           // Tamanho inicial do nível 0 (px)
    reductionFactor: 0.7,    // Reduz 30% a cada nível (0.7 = 70% do anterior)
    minSize: 25,             // Tamanho mínimo permitido (px)
    fontFamily: 'system-ui', // Família da fonte padrão
    fontWeight: '300',       // Peso da fonte padrão (300 = light)
  },

  // Espaçamento entre nós
  spacing: {
    projectMargin: 80,       // Margem entre o sol e as seções de nível 0 (px)
    levelMargin: 60,         // Margem entre nós pai e filho (px)
  },

  // Fontes - Sistema automático de ajuste
  fonts: {
    // Para seções/subseções
    section: {
      sizePercent: 0.14,     // 14% do tamanho da bolinha (bolinha 100px = fonte 14px)
      minSize: 1,            // Tamanho mínimo (px)
      maxSize: 24,           // Tamanho máximo (px)
    },
    // Para projeto central
    project: {
      sizePercent: 0.10,     // 10% do tamanho da bolinha
      minSize: 10,           // Tamanho mínimo (px)
      maxSize: 28,           // Tamanho máximo (px)
    },
    // Propriedades de quebra de texto
    lineHeight: 1.2,         // Espaçamento entre linhas
    wordBreak: true,         // Permitir quebra de palavras longas
  },

  // Zoom e visibilidade
  zoom: {
    minZoom: 0.1,            // Zoom mínimo (10%)
    maxZoom: 20,             // Zoom máximo padrão (será calculado dinamicamente)
    fitViewMaxZoom: 1,       // Zoom máximo ao carregar (fitView)
    // Thresholds para mostrar labels (tamanho aparente mínimo em px)
    labelVisibility: {
      section: 40,           // Mostrar label de seções se > 40px na tela
      project: 60,           // Mostrar label do projeto se > 60px na tela
    },
    // Cálculo de maxZoom dinâmico
    targetApparentSize: 50,  // Tamanho alvo da menor bolinha na tela (px)
    zoomMargin: 1.5,         // Margem de segurança (50% extra)
    // Zoom ao clicar
    onClickTargetSize: 200,  // Tamanho que a bolinha terá na tela ao clicar (px)
  },

  // ========================================
  // CONFIGURAÇÕES DE FÍSICA (D3-FORCE)
  // ========================================
  
  physics: {
    // Força de link (mantém nós próximos aos pais)
    link: {
      strength: 0.1,         // Força muito fraca - só sugere proximidade
      distance: {
        level0: 280,         // Distância do projeto ao nível 0
        base: 100,           // Distância base entre pai-filho
        multiplier: 1.1,     // Divisor por nível (100 / 1.1^level)
      },
    },
    // Colisão (evita sobreposição de nós)
    collision: {
      enabled: true,
      radiusMargin: {
        project: 50,         // Margem extra ao redor do projeto (px)
        section: 20,         // Margem extra ao redor de seções (px)
      },
      strength: 1.0,         // Força da colisão (1.0 = máxima)
      iterations: 10,        // Iterações por tick
    },
    // Simulação
    simulation: {
      iterations: 130,       // Número de ticks da simulação
      linkStrength: 1,       // Força de link (0-1, menor = mais livre)
      collisionStrength: 0.3, // Força de colisão (0.1-0.3 recomendado para simetria)
    },
  },

  // ========================================
  // PROJETO CENTRAL (SOL)
  // ========================================
  
  project: {
    node: {
      size: 100,             // Tamanho fixo do projeto (px)
      colors: {
        gradient: {
          from: '#fbbf24',   // Dourado
          to: '#fbbf24',     // Dourado
        },
        text: '#ffffff',     // Cor do texto
        shadow: 'rgba(251, 191, 36, 0.5)', // Sombra
        glow: 'rgba(251, 191, 36, 0.3)',   // Brilho ao redor
      },
      icon: '🌟',
      padding: 0.12,         // Padding interno (12% do tamanho)
      // Estado quando selecionado
      selected: {
        borderColor: '#fbbf24',   // Cor da borda
        borderWidth: 4,           // Espessura da borda (px)
        glowColor: 'rgba(251, 191, 36, 0.6)', // Brilho mais intenso
        scale: 1.1,               // Escala da bolinha (110%)
      },
      // Zoom da câmera ao clicar
      zoomOnClick: 0.8,
    },
    edge: {
      strokeWidth: 0.5,
      color: '#94a3b8',      // Cinza claro
      dashed: false,
      dashPattern: '',
      animated: false,
      // Estilo quando destacado (nó selecionado)
      highlighted: {
        strokeWidth: 1,
        color: '#fbbf24',
        animated: true,
      },
    },
  },

  // ========================================
  // SEÇÕES E SUBSEÇÕES (NÍVEIS 0, 1, 2+)
  // ========================================
  
  // Seções principais (nível 0)
  sections: {
    node: {
      color: '#3b82f6',      // Azul
      textColor: '#ffffff',
      padding: 0.10,         // Padding interno (10% do tamanho)
      borderColor: '#fbbf24', // Borda dourada quando tem subsecções
      borderWidth: 2,
      shadowColor: 'rgba(0,0,0,0.3)',
      // Estado quando selecionado
      selected: {
        borderColor: '#fbbf24',
        borderWidth: 4,
        glowColor: 'rgba(59, 130, 246, 0.6)', // Brilho azul
        scale: 1.15,
      },
      zoomOnClick: 1.2,
    },
    edge: {
      strokeWidth: 0.5,
      color: '#94a3b8',      // Cinza claro
      dashed: false,
      dashPattern: '',
      animated: false,
      highlighted: {
        strokeWidth: 1,
        color: '#fbbf24',
        animated: true,
      },
    },
  },

  // Subseções (nível 1)
  subsections: {
    node: {
      color: '#8b5cf6',      // Roxo
      textColor: '#ffffff',
      padding: 0.10,
      borderColor: '#fbbf24',
      borderWidth: 2,
      shadowColor: 'rgba(0,0,0,0.3)',
      selected: {
        borderColor: '#fbbf24',
        borderWidth: 4,
        glowColor: 'rgba(139, 92, 246, 0.6)', // Brilho roxo
        scale: 1.15,
      },
      zoomOnClick: 2,
    },
    edge: {
      strokeWidth: 0.1,
      color: '#94a3b8',
      dashed: false,
      dashPattern: '',
      animated: false,
      highlighted: {
        strokeWidth: 1,
        color: '#fbbf24',
        animated: true,
      },
    },
  },

  // Sub-subseções (nível 2+)
  deepSubsections: {
    node: {
      color: '#a855f7',      // Roxo claro
      textColor: '#ffffff',
      padding: 0.10,
      borderColor: '#fbbf24',
      borderWidth: 2,
      shadowColor: 'rgba(0,0,0,0.3)',
      selected: {
        borderColor: '#fbbf24',
        borderWidth: 4,
        glowColor: 'rgba(168, 85, 247, 0.6)', // Brilho roxo claro
        scale: 1.15,
      },
      zoomOnClick: 1.8,
    },
    edge: {
      strokeWidth: 0.1,
      color: '#94a3b8',
      dashed: false,
      dashPattern: '',
      animated: false,
      highlighted: {
        strokeWidth: 1,
        color: '#fbbf24',
        animated: true,
      },
    },
  },

  // ========================================
  // REFERÊNCIAS CRUZADAS (DESABILITADAS)
  // ========================================
  
  references: {
    enabled: false,          // Por padrão não mostrar
    edge: {
      strokeWidth: 0.1,
      color: '#8b5cf6',      // Roxo
      dashed: true,
      dashPattern: '5,5',
      animated: true,
      label: '🔗',
    },
  },

  // ========================================
  // LAYOUT E POSICIONAMENTO ORBITAL
  // ========================================
  
  layout: {
    mainOrbitRadius: 350,    // Distância das seções ao centro (px)
    subOrbitRadius: 120,     // Distância base das subseções à seção pai (px)
    orbitRadiusMultiplier: 1.3, // Multiplicador por nível
    startAngle: -Math.PI / 2, // Ângulo inicial (-90° = topo)
  },

  // ========================================
  // VISUALIZAÇÃO GERAL
  // ========================================
  
  background: {
    color: '#111827',        // Cinza escuro
    dotsColor: '#374151',    // Cor dos pontos do grid
    dotsSize: 1,
    dotsGap: 20,
  },
};

/**
 * Helper function para obter configuração de node por nível
 */
export function getNodeConfig(level: number) {
  switch (level) {
    case 0:
      return MINDMAP_CONFIG.sections;
    case 1:
      return MINDMAP_CONFIG.subsections;
    default:
      return MINDMAP_CONFIG.deepSubsections;
  }
}

/**
 * Helper function para obter configuração de edge por nível
 */
export function getEdgeConfig(level: number) {
  switch (level) {
    case 0:
      return MINDMAP_CONFIG.sections.edge;
    case 1:
      return MINDMAP_CONFIG.subsections.edge;
    default:
      return MINDMAP_CONFIG.deepSubsections.edge;
  }
}
