# 📄 Visualização de GDD como Documento

## O que é?

Uma página dedicada para visualizar o GDD completo formatado como um documento profissional, tipo um preview bonito antes de entrar no modo gerenciamento.

## 🎯 Problema Resolvido

**Antes:** Após gerar o GDD com IA, você caía direto na página de gerenciamento (com menus expansivos, botões de edição, etc.)

**Agora:** Você vê primeiro o documento completo formatado, igual um GDD de verdade, para ter aquela primeira impressão profissional! 📚✨

## 🚀 Como Usar

### 1. Após Criar com IA
Quando você gera um GDD com IA e clica em **"📄 Ver GDD Completo"**, você é direcionado para a visualização do documento com:
- ✨ Banner de boas-vindas animado
- 📑 Índice clicável
- 📄 Documento formatado profissionalmente
- 🖨️ Botão de impressão

### 2. Dentro de um Projeto Existente
Na página de gerenciamento do projeto, clique no botão **"📄 Ver como Documento"** no topo da página.

## 🎨 Features da Visualização

### Capa Profissional
- Imagem de capa do projeto (quando configurada)
- Ícone de jogo destacado
- Título do projeto em destaque
- Descrição do projeto
- Data de criação

### Índice Interativo
- Todas as seções numeradas
- Links clicáveis para navegação rápida
- Subseções indentadas

### Conteúdo Formatado
- Seções com numeração hierárquica (1. 1.1, 1.2, etc.)
- Markdown renderizado com estilo
- Referências cruzadas funcionando
- Indicação visual de seções vazias

### Toolbar Superior
- **← Modo Gerenciamento:** Volta para a página de edição
- **🏠 Home:** Volta para a lista de projetos
- **🖨️ Imprimir:** Abre diálogo de impressão (oculta os botões automaticamente)

## 📁 Estrutura de Arquivos

```
app/projects/[id]/view/
├── page.tsx              # Route handler
└── GDDViewClient.tsx     # Client component com toda lógica
```

## 🔄 Fluxo de Navegação

```
Criar com IA → Preview do template → [Ver GDD Completo] → 
Visualização do Documento → [Modo Gerenciamento] → Página de edição
```

ou

```
Lista de Projetos → Projeto → [Ver como Documento] → Visualização
```

## 🎨 Estilos de Impressão

A página detecta quando você imprime e automaticamente:
- Remove todos os botões
- Remove gradientes de fundo
- Ajusta para formato de papel
- Evita quebras de página no meio das seções

## 💡 Dicas de UX

1. **Banner de Boas-Vindas:** Aparece apenas quando `?new=true` está na URL (primeira visualização após criação)
2. **Auto-hide:** O banner desaparece automaticamente após 5 segundos
3. **Navegação Suave:** Os links do índice fazem scroll suave até a seção
4. **Seções Vazias:** Aparecem com estilo diferenciado (fundo cinza claro, texto itálico)

## 🔧 Customização

Para ajustar o design do documento, edite:
- **Capa:** `app/projects/[id]/view/GDDViewClient.tsx` (bloco "Cover Page")
- **Índice:** `app/projects/[id]/view/GDDViewClient.tsx` (render de TOC)
- **Seções:** `app/projects/[id]/view/GDDViewClient.tsx` (render de conteúdo)
- **Estilos de impressão:** Tag `<style jsx global>` no final

## Google Drive na capa

- Se a capa vier do Google Drive, o app usa fallback de URLs para melhorar compatibilidade.
- Se nenhuma URL renderizar, aparece aviso de falha de carregamento.
- Para funcionar em qualquer visualização, o arquivo no Drive deve estar como **"Qualquer pessoa com o link"**.

## 🐛 Debug

Se o documento não aparecer:
1. Verifique se o projeto existe no Zustand store
2. Verifique se há seções no projeto
3. Verifique o console para erros de renderização do Markdown

## ✅ Checklist de Implementação

- [x] Rota `/projects/[id]/view`
- [x] Componente de visualização completo
- [x] Índice com links internos
- [x] Markdown com referências cruzadas
- [x] Botão "Ver como Documento" no gerenciamento
- [x] Redirecionamento após criar com IA
- [x] Banner de boas-vindas
- [x] Estilos de impressão
- [x] Indicação de seções vazias
- [x] Numeração hierárquica
