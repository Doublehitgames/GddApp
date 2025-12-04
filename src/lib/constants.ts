export const STORAGE_KEY = "gdd_projects_v1" as const;

export const EDITOR_CONFIG = {
  DEFAULT_MODE: "wysiwyg" as const,
  PREVIEW_STYLE: "vertical" as const,
  DEFAULT_HEIGHT: "400px",
  TOOLBAR_ITEMS: [
    ["heading", "bold", "italic", "strike"],
    ["hr", "quote"],
    ["ul", "ol", "task"],
    ["table", "link", "image"],
    ["code", "codeblock"],
  ],
} as const;

export const VALIDATION = {
  PROJECT_NAME_MIN_LENGTH: 3,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ] as const,
} as const;

export const DRAG_AND_DROP = {
  ACTIVATION_DISTANCE: 10,
  ACTIVATION_DELAY: 100,
  TOLERANCE: 5,
} as const;

export const SEARCH = {
  SNIPPET_PREFIX_LENGTH: 40,
  SNIPPET_SUFFIX_LENGTH: 40,
} as const;

export const MESSAGES = {
  ERRORS: {
    PROJECT_NAME_REQUIRED: "O nome do projeto é obrigatório.",
    PROJECT_NAME_TOO_SHORT: "O nome do projeto deve ter pelo menos 3 caracteres.",
    SECTION_NAME_DUPLICATE: "Já existe uma seção com este nome no mesmo nível.",
    SECTION_NAME_DUPLICATE_ROOT: "Já existe uma seção raiz com este nome.",
    SUBSECTION_NAME_DUPLICATE: "Já existe uma subseção com este nome.",
    PROJECT_NOT_FOUND: "Projeto não encontrado.",
    SECTION_NOT_FOUND: "Seção não encontrada.",
    UPLOAD_FAILED: "Erro ao fazer upload da imagem",
    NO_FILE_PROVIDED: "Nenhum arquivo fornecido",
    INVALID_FILE_TYPE: "Tipo de arquivo inválido. Apenas imagens são permitidas.",
    FILE_TOO_LARGE: "Arquivo muito grande. Tamanho máximo é 5MB.",
  },
  SUCCESS: {
    PROJECT_CREATED: "Projeto criado com sucesso!",
    PROJECT_UPDATED: "Projeto atualizado com sucesso!",
    PROJECT_DELETED: "Projeto deletado com sucesso!",
    SECTION_CREATED: "Seção criada com sucesso!",
    SECTION_UPDATED: "Seção atualizada com sucesso!",
    SECTION_DELETED: "Seção deletada com sucesso!",
  },
  INFO: {
    LOADING: "Carregando...",
    NO_PROJECTS: "Nenhum projeto criado ainda.",
    NO_SECTIONS: "Nenhuma seção criada ainda.",
    NO_DESCRIPTION: "Sem descrição.",
  },
  PLACEHOLDERS: {
    PROJECT_NAME: "Nome do projeto",
    PROJECT_DESCRIPTION: "Descrição do projeto",
    SECTION_NAME: "Nome da seção",
    NEW_SECTION: "Nova seção",
    SEARCH_SECTIONS: "🔍 Buscar seções...",
  },
} as const;
