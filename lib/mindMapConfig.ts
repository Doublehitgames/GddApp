/**
 * Configuração visual e física do Mapa Mental
 * Edite este arquivo para personalizar cores, tamanhos, fontes e comportamento físico
 */

export const MINDMAP_CONFIG = {
  // ========================================
  // CONFIGURAÇÕES GLOBAIS
  // ========================================
  
  // ========================================
  // ESTILO LIMPO
  // ========================================
  // Paleta unica do mapa. Fica FORA de project/sections/subsections de
  // proposito: aqueles caminhos existem nas configuracoes salvas de cada
  // projeto, e o salvo vence o default no deepMerge — um projeto ja
  // personalizado continuaria preto e grosso. Aqui nao ha o que sobrescrever.
  clean: {
    accent: '#ef5f56',       // Cor unica dos nos
    line: '#dcdfe4',         // Fio das conexoes
    lineWidth: 1,            // Espessura em px de TELA (nao escala com o zoom)
    label: '#e05a51',        // Texto das labels
    // Diametro do ponto em px de TELA, por profundidade. O ultimo vale para os
    // niveis alem dele.
    dotSize: [16, 11, 7, 6],
    projectDot: 22,          // Diametro do ponto do projeto (px de tela)
    // Linha do caminho destacado ao selecionar. Tambem em px de tela.
    highlight: '#ef5f56',
    highlightWidth: 1.6,
    highlightDash: 4,
    background: '#ffffff',
  },

  nodeSize: {
    baseSize: 100,           // Tamanho inicial do nível 0 (px)
    reductionFactor: 0.6,    // Reduz 40% a cada nível (0.6 = 60% do anterior)
    minSize: 18,             // Tamanho mínimo permitido (px)
    baseFontSize: 14,        // Tamanho base da fonte (px)
    minFontSize: 1,          // Tamanho mínimo da fonte (px)
    fontFamily: 'system-ui', // Família da fonte padrão
    fontWeight: '300',       // Peso da fonte padrão (300 = light)
  },

  // Espaçamento entre nós
  spacing: {
    projectMargin: 700,      // Margem entre o sol e as seções de nível 0 (px)
    levelMargin: 340,        // Margem entre nós pai e filho (px)
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
    minZoom: 0.01,           // Zoom mínimo (1% - permite ver mapas muito grandes)
    maxZoom: 20,             // Zoom máximo padrão (será calculado dinamicamente)
    fitViewMaxZoom: 2.0,     // Zoom máximo ao carregar (fitView)
    fitViewPadding: 0.2,     // Margem ao redor (20%)
    // Thresholds para mostrar labels (tamanho aparente mínimo em px)
    // Revelacao progressiva: cada profundidade so mostra sua label a partir de
    // um zoom. Longe ve-se so a raiz; aproximando, aparecem os hubs; mais perto,
    // as folhas. Sem isso, 245 labels de uma vez viram sopa de letrinha.
    // O ultimo valor do array vale para todos os niveis alem dele.
    labelVisibility: {
      byLevel: [0.09, 0.30, 0.85, 1.6],
      project: 0.02,
    },
    // Cálculo de maxZoom dinâmico
    targetApparentSize: 10000, // Tamanho alvo da menor bolinha na tela (px)
    zoomMargin: 1.5,         // Margem de segurança (50% extra)
    // Zoom ao clicar
    onClickTargetSize: 80,   // Tamanho que a bolinha terá na tela ao clicar (px)
  },

  // Painel lateral (conteúdo da bolinha)
  sidebar: {
    contentScale: 0.85,      // Escala do texto no painel lateral (1 = 100%)
  },

  // Compartilhamento público
  sharing: {
    isPublic: false,
    shareToken: "",
  },

  // Animação de edges destacadas
  animation: {
    speed: 2,                // Duração da animação em segundos (menor = mais rápido)
    distance: 500,           // Distância percorrida pelo traço (px)
  },

  // Efeito de esmaecer nós não destacados quando há seleção
  fadeEffect: {
    enabled: true,           // Ativar/desativar o efeito
    opacity: 0.3,            // Opacidade dos nós esmaecidos (0-1)
    grayscale: 50,           // Porcentagem de grayscale (0-100)
    blur: 1,                 // Blur em pixels (0 = sem blur)
  },

  // Destaque de referências cruzadas
  references: {
    enabled: true,           // Mostrar referências ao selecionar nó
    edgeColor: '#3b82f6',    // Cor das conexões de referência (azul)
    edgeWidth: 10,           // Espessura das linhas de referência
    edgeDashed: true,        // Linha tracejada
    edgeDashPattern: 5.5,    // Padrão do tracejado
    edgeAnimated: true,      // Animar a linha de referência (usa config.animation)
    showIcon: true,          // Mostrar ícone de link na conexão
    icon: '🔗',              // Ícone a ser exibido
    iconSize: 160,           // Tamanho do ícone (em pixels)
    nodeHighlight: {
      enabled: false,        // Destacar nós referenciados
      borderColor: '#3b82f6', // Cor da borda (azul)
      borderWidth: 10,       // Espessura da borda
    },
  },

  // ========================================
  // CONFIGURAÇÕES DE FÍSICA (D3-FORCE)
  // ========================================
  
  physics: {
    // Força de link (mantém nós próximos aos pais)
    link: {
      strength: 0.1,         // Força muito fraca - só sugere proximidade
      distance: {
        level0: 620,         // Distância do projeto ao nível 0
        base: 260,           // Distância base entre pai-filho
        multiplier: 1.35,    // Divisor por nível (base / mult^level)
      },
    },
    // Colisão (evita sobreposição de nós)
    collision: {
      enabled: true,
      radiusMargin: {
        project: 90,        // Margem extra ao redor do projeto (px)
        section: 30,         // Margem extra ao redor de seções (px)
      },
      strength: 1.0,         // Força da colisão (1.0 = máxima)
      iterations: 10,        // Iterações por tick
    },
    // Simulação
    simulation: {
      iterations: 330,       // Número de ticks da simulação
      linkStrength: 0.75,    // Força de link (0-1, menor = mais livre)
      collisionStrength: 0.3, // Força de colisão (0.1-0.3 recomendado para simetria)
    },
  },

  // ========================================
  // PROJETO CENTRAL (SOL)
  // ========================================
  
  project: {
    node: {
      size: 170,            // Tamanho fixo do projeto (px)
      colors: {
        gradient: {
          from: '#ef5f56',   // Acento unico
          to: '#ef5f56',     // Acento unico
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
      // Linha visivel no estado padrao (nenhum no selecionado). Desligar aqui
      // NAO afeta o destaque ao clicar numa bolinha — so o mapa em repouso.
      visible: true,
      strokeWidth: 2,
      color: '#d8dbe0',      // Fio cinza claro
      dashed: false,
      dashPattern: '',
      animated: false,
      // Estilo quando destacado (nó selecionado)
      highlighted: {
        strokeWidth: 1.5,
        color: '#fbbf24',
        animated: true,
        dashPattern: 5.5,    // Tamanho base do traço/espaço (proporcional ao zoom)
      },
    },
  },

  // ========================================
  // SEÇÕES E SUBSEÇÕES (NÍVEIS 0, 1, 2+)
  // ========================================
  
  // Seções principais (nível 0)
  sections: {
    node: {
      color: '#ef5f56',      // Acento unico
      textColor: '#e05a51',
      padding: 0.10,         // Padding interno (10% do tamanho)
      borderColor: '#fbbf24', // Borda dourada quando tem subsecções
      borderWidth: 2,
      shadowColor: 'rgba(0,0,0,0.3)',
      // Borda para nós com filhos
      hasChildrenBorder: {
        enabled: false,       // Desabilitado por padrão
        width: 2,             // Largura da borda (px)
        color: '#fbbf24',     // Cor da borda
        dashed: false,        // Tracejado
        dashPattern: '5 5',   // Padrão do tracejado (CSS)
      },
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
      // Linha visivel no estado padrao (nenhum no selecionado). Desligar aqui
      // NAO afeta o destaque ao clicar numa bolinha — so o mapa em repouso.
      visible: true,
      strokeWidth: 2,
      color: '#d8dbe0',      // Fio cinza claro
      dashed: false,
      dashPattern: '',
      animated: false,
      highlighted: {
        strokeWidth: 1.5,
        color: '#fbbf24',
        animated: true,
        dashPattern: 5.5,    // Tamanho base do traço/espaço (proporcional ao zoom)
      },
    },
  },

  // Subseções (nível 1)
  subsections: {
    node: {
      color: '#ef5f56',      // Acento unico
      textColor: '#e05a51',
      padding: 0.10,
      borderColor: '#fbbf24',
      borderWidth: 2,
      shadowColor: 'rgba(0,0,0,0.3)',
      // Borda para nós com filhos
      hasChildrenBorder: {
        enabled: false,       // Desabilitado por padrão
        width: 2,             // Largura da borda (px)
        color: '#fbbf24',     // Cor da borda
        dashed: false,        // Tracejado
        dashPattern: '5 5',   // Padrão do tracejado (CSS)
      },
      selected: {
        borderColor: '#fbbf24',
        borderWidth: 4,
        glowColor: 'rgba(139, 92, 246, 0.6)', // Brilho roxo
        scale: 1.15,
      },
      zoomOnClick: 2,
    },
    edge: {
      // Linha visivel no estado padrao (nenhum no selecionado). Desligar aqui
      // NAO afeta o destaque ao clicar numa bolinha — so o mapa em repouso.
      visible: true,
      strokeWidth: 2,
      color: '#d8dbe0',
      dashed: false,
      dashPattern: '',
      animated: false,
      highlighted: {
        strokeWidth: 1.5,
        color: '#fbbf24',
        animated: true,
        dashPattern: 5.5,
      },
    },
  },

  // Sub-subseções (nível 2+)
  deepSubsections: {
    node: {
      color: '#ef5f56',      // Acento unico
      textColor: '#e05a51',
      padding: 0.10,
      borderColor: '#fbbf24',
      borderWidth: 2,
      shadowColor: 'rgba(0,0,0,0.3)',
      // Borda para nós com filhos
      hasChildrenBorder: {
        enabled: false,       // Desabilitado por padrão
        width: 2,             // Largura da borda (px)
        color: '#fbbf24',     // Cor da borda
        dashed: false,        // Tracejado
        dashPattern: '5 5',   // Padrão do tracejado (CSS)
      },
      selected: {
        borderColor: '#fbbf24',
        borderWidth: 4,
        glowColor: 'rgba(168, 85, 247, 0.6)', // Brilho roxo claro
        scale: 1.15,
      },
      zoomOnClick: 1.8,
    },
    edge: {
      // Linha visivel no estado padrao (nenhum no selecionado). Desligar aqui
      // NAO afeta o destaque ao clicar numa bolinha — so o mapa em repouso.
      visible: true,
      strokeWidth: 2.2,
      color: '#d8dbe0',
      dashed: false,
      dashPattern: '',
      animated: false,
      highlighted: {
        strokeWidth: 1.5,
        color: '#fbbf24',
        animated: true,
        dashPattern: 5.5,    // Tamanho base do traço/espaço (proporcional ao zoom)
      },
    },
  },

  // ========================================
  // LAYOUT E POSICIONAMENTO ORBITAL
  // ========================================
  
  layout: {
    mainOrbitRadius: 3500,   // Distância das seções ao centro (px)
    subOrbitRadius: 1200,    // Distância base das subseções à seção pai (px)
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
