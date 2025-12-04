# Estrutura do Código Fonte

Esta pasta contém utilitários e constantes compartilhadas do projeto.

## 📁 Estrutura

```
src/
└── lib/
    ├── constants.ts  # Constantes centralizadas (mensagens, configurações, validações)
    └── utils.ts      # Funções utilitárias reutilizáveis
```

## 📚 Módulos

### `lib/constants.ts`
Centraliza todas as constantes do projeto:
- **STORAGE_KEY**: Chave do localStorage
- **EDITOR_CONFIG**: Configuração do editor markdown
- **VALIDATION**: Regras de validação (tamanhos, tipos permitidos)
- **DRAG_AND_DROP**: Configurações de drag-and-drop
- **SEARCH**: Configurações de busca
- **MESSAGES**: Mensagens de erro, sucesso, info e placeholders

### `lib/utils.ts`
Funções utilitárias para manipulação de seções:
- **matchesSearch**: Busca por termo em seções
- **getContentSnippet**: Gera preview de conteúdo com destaque
- **buildBreadcrumbs**: Constrói caminho de navegação (breadcrumbs)
- **generateId**: Gera IDs únicos para seções
- **collectDescendantIds**: Coleta IDs de todas as subseções (delete em cascata)

## 🎯 Filosofia

Esta estrutura segue o princípio de **refatoração mínima**:
- ✅ Apenas utilitários **realmente utilizados**
- ✅ Constantes que evitam **duplicação de strings**
- ✅ Funções que **simplificam lógica complexa**
- ❌ Sem abstrações excessivas
- ❌ Sem componentes não utilizados
- ❌ Sem "código para o futuro"

## 📖 Uso

```typescript
// Importar constantes
import { MESSAGES, EDITOR_CONFIG } from '@/src/lib/constants';

// Importar utilidades
import { matchesSearch, buildBreadcrumbs } from '@/src/lib/utils';
```
