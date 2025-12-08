# Melhorias no Sistema "Melhorar com IA"

## 🎯 Objetivo
Implementar sistema de preview com confirmação antes de aplicar melhorias, similar ao fluxo de criação de projetos com IA.

---

## ✨ Novas Funcionalidades

### 1. **Sistema de Preview Modal**
- ✅ Usuário clica em "Melhorar com IA"
- ✅ Modal aparece com preview do conteúdo melhorado
- ✅ Usuário pode revisar antes de confirmar
- ✅ Opções: **Confirmar**, **Modificar**, ou **Cancelar**

### 2. **Solicitação de Modificações**
- Campo de texto para feedback do usuário
- Exemplos:
  - "Adicione mais exemplos práticos"
  - "Reduza o texto e seja mais direto"
  - "Foque mais em mecânicas de combate"
  - "Adicione uma tabela comparativa"
- IA aplica modificação mantendo elementos preservados

### 3. **Evitar Repetição de Subseções**
**Problema anterior:**
- IA repetia conteúdo que já estava nas subseções

**Solução implementada:**
- API agora recebe `subsections` com título e conteúdo
- Prompt instrui explicitamente: "NÃO repita o conteúdo dessas subseções"
- Contexto informativo no prompt:
  ```
  - Subseções existentes: "Combate Corpo a Corpo", "Combate à Distância"
    ⚠️ NÃO repita o conteúdo dessas subseções na descrição principal!
  ```

### 4. **Sugestão de Novas Subseções**
Quando o conteúdo fica muito extenso ou detalhado, IA sugere ao final:

```markdown
> 💡 **Sugestão:** Considere criar subseções para:
> - Sistema de Progressão de Personagem
> - Árvore de Habilidades
> - Economia de Recursos
```

Isso ajuda o usuário a organizar melhor o GDD sem poluir a descrição principal.

---

## 🔄 Fluxo de Uso

### Fluxo Básico (Sem Modificações)
```
1. [Visualizar Seção] 
   ↓
2. Clica "✨ Melhorar com IA"
   ↓
3. ⏳ Aguarda geração (3-5s)
   ↓
4. [Modal de Preview] aparece
   ↓
5. Revisa conteúdo
   ↓
6. Clica "✓ Confirmar e Aplicar"
   ↓
7. ✅ Conteúdo atualizado!
```

### Fluxo com Modificações
```
1. [Visualizar Seção] 
   ↓
2. Clica "✨ Melhorar com IA"
   ↓
3. [Modal de Preview] aparece
   ↓
4. Não gostou? Digite modificação:
   "Adicione mais exemplos de combos"
   ↓
5. Clica "🔄 Modificar"
   ↓
6. ⏳ IA reprocessa com feedback
   ↓
7. [Preview Atualizado] aparece
   ↓
8. Repete até satisfeito
   ↓
9. Clica "✓ Confirmar e Aplicar"
   ↓
10. ✅ Conteúdo atualizado!
```

---

## 🧪 Exemplos de Uso

### Exemplo 1: Seção "Sistema de Combate"

**Subseções existentes:**
- Combate Corpo a Corpo
- Combate à Distância
- Sistema de Esquiva

**Antes (IA repetia subseções):**
```markdown
## Sistema de Combate

O jogo possui combate corpo a corpo com espadas e machados...
Também tem combate à distância com arcos e flechas...
O sistema de esquiva permite rolar para desviar...
```

**Depois (com nova regra):**
```markdown
## Sistema de Combate

### Visão Geral
Sistema de combate dinâmico que combina elementos de ação em tempo real
com mecânicas táticas. O jogador pode escolher entre diferentes estilos
de combate conforme a situação.

### Mecânicas Principais
- **Sistema de Combo:** Encadear ataques para dano maior
- **Postura (Stance):** Alterna entre agressivo/defensivo
- **Recursos:** Stamina para ataques e esquivas

**Veja também:** $[Combate Corpo a Corpo], $[Combate à Distância]

> 💡 **Sugestão:** Considere criar subseções para:
> - Sistema de Progressão de Armas
> - Mecânicas de Bloqueio e Parry
```

### Exemplo 2: Modificação Iterativa

**Preview inicial:**
```markdown
## Progressão de Personagem

O jogador ganha XP ao completar missões e derrotar inimigos.
Cada nível desbloqueia novos pontos de habilidade.
```

**Usuário solicita:** *"Adicione exemplos de habilidades e uma tabela de níveis"*

**Preview modificado:**
```markdown
## Progressão de Personagem

### Sistema de Experiência
O jogador acumula XP através de:
- ⚔️ Combate (10-100 XP por inimigo)
- 📋 Missões (500-2000 XP)
- 🔍 Exploração (50 XP por descoberta)

### Árvore de Habilidades
Três ramos disponíveis:
- **Guerreiro:** Ataques poderosos, resistência
- **Assassino:** Furtividade, críticos aumentados
- **Mago:** Magias elementais, controle de campo

### Tabela de Progressão

| Nível | XP Necessário | Pontos de Habilidade | Desbloqueios |
|-------|---------------|----------------------|--------------|
| 1     | 0             | 2                    | Básico       |
| 5     | 5000          | 3                    | Especial     |
| 10    | 20000         | 4                    | Ultimate     |
```

---

## 🛠️ Implementação Técnica

### Arquivos Modificados

1. **`app/api/ai/improve-content/route.ts`**
   - Adiciona `additionalRequest` ao request
   - Atualiza prompt para evitar repetir subseções
   - Adiciona regra para sugerir novas subseções
   - Passa conteúdo das subseções existentes no contexto

2. **`app/projects/[id]/sections/SectionDetailClient.tsx`**
   - Estados adicionados:
     ```typescript
     const [showPreview, setShowPreview] = useState(false);
     const [previewContent, setPreviewContent] = useState("");
     const [modificationRequest, setModificationRequest] = useState("");
     ```
   
   - Funções adicionadas:
     ```typescript
     function handleConfirmImprovement() // Aplica conteúdo
     function handleCancelImprovement() // Cancela preview
     function handleRequestModification() // Solicita modificação
     ```
   
   - Modal de preview com:
     - Header gradiente roxo/azul
     - Preview do markdown renderizado
     - Campo para solicitar modificações
     - Botões: Cancelar, Modificar, Confirmar

---

## 📊 Benefícios

### UX Melhorada
- ✅ Usuário tem controle total antes de aplicar
- ✅ Pode iterar quantas vezes quiser
- ✅ Não perde conteúdo original acidentalmente
- ✅ Feedback visual imediato

### Qualidade do Conteúdo
- ✅ Não repete subseções desnecessariamente
- ✅ Descrição principal mais concisa e relevante
- ✅ Sugestões inteligentes de organização
- ✅ Melhor estruturação do GDD

### Eficiência
- ✅ Menos refações manuais após IA
- ✅ Iteração rápida com feedback específico
- ✅ Economiza tokens (não precisa refazer do zero)

---

## 🔮 Próximos Passos (Futuro)

- [ ] Histórico de versões (desfazer/refazer)
- [ ] Comparação lado a lado (antes/depois)
- [ ] Templates de solicitações comuns
- [ ] Preview de sugestões de subseções (criar automaticamente)
- [ ] Exportar preview sem aplicar

---

## 📝 Notas Técnicas

### Preservação de Elementos
O sistema continua preservando:
- ✅ Imagens `![alt](url)`
- ✅ Links `[texto](url)`
- ✅ Uploads `/uploads/...`
- ✅ Referências `$[Seção]`

### Contexto Enviado para IA
```typescript
{
  currentContent: string, // Conteúdo atual ou preview
  sectionTitle: string,
  sectionContext: {
    parentTitle?: string,
    subsections: [{ title, content }], // Agora inclui conteúdo!
    otherSections: [{ title }]
  },
  projectTitle: string,
  additionalRequest?: string // Novo!
}
```

### Prompt Key Rules
```
6. NÃO REPETIR SUBSEÇÕES: Se a seção tem subseções, 
   NÃO repita o conteúdo delas na descrição principal

7. SUGERIR NOVAS SUBSEÇÕES: Se o conteúdo está ficando 
   muito extenso, adicione ao final:
   > 💡 **Sugestão:** Considere criar subseções para: [lista]
```

---

**Implementado em:** 2025-12-08  
**Versão:** 2.0  
**Status:** ✅ Completo e Testável
