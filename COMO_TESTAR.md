# 🧪 Como Testar Referências Cruzadas

## Passo 1: Criar um Projeto de Teste

1. Acesse http://localhost:3000
2. Clique em "Criar novo projeto"
3. Nome: **RPG Demo**
4. Descrição: **Projeto para testar referências cruzadas**

## Passo 2: Criar Seções de Exemplo

Crie as seguintes seções (na ordem):

### Seção 1: Sistema de Combate
**Conteúdo:**
```markdown
O jogador pode atacar, defender e usar habilidades especiais.

O combate é influenciado por:
- Nível do personagem ($[Sistema de Progressão])
- Equipamentos ($[Sistema de Inventário])
- Skills aprendidas ($[Árvore de Habilidades])

Os inimigos possuem padrões de ataque definidos em $[Inteligência Artificial].
```

### Seção 2: Sistema de Progressão
**Conteúdo:**
```markdown
O jogador ganha XP ao:
- Derrotar inimigos ($[Sistema de Combate])
- Completar missões ($[Sistema de Quests])
- Descobrir locais secretos ($[Exploração])

A cada level up, o jogador ganha pontos para distribuir na $[Árvore de Habilidades].
```

### Seção 3: Sistema de Inventário
**Conteúdo:**
```markdown
O jogador pode coletar:
- Armas e armaduras que afetam o $[Sistema de Combate]
- Consumíveis que restauram HP/MP
- Materiais para o $[Sistema de Crafting]

Capacidade limitada baseada no nível ($[Sistema de Progressão]).
```

### Seção 4: Árvore de Habilidades
**Conteúdo:**
```markdown
Skills divididas em 3 categorias:
- **Ofensivas**: Aumentam dano no $[Sistema de Combate]
- **Defensivas**: Reduzem dano recebido
- **Utilidade**: Facilitam $[Exploração] e $[Sistema de Crafting]

Requer pontos obtidos através da $[Sistema de Progressão].
```

### Seção 5: Sistema de Quests
**Conteúdo:**
```markdown
Missões principais e secundárias que recompensam:
- XP ($[Sistema de Progressão])
- Itens raros ($[Sistema de Inventário])
- Acesso a novas áreas ($[Exploração])

Algumas quests exigem nível mínimo no $[Sistema de Combate].
```

### Seção 6: Exploração
**Conteúdo:**
```markdown
Mundo aberto com:
- Dungeons que exigem $[Sistema de Combate] avançado
- Puzzles que requerem skills da $[Árvore de Habilidades]
- Tesouros escondidos para o $[Sistema de Inventário]

Progressão desbloqueada via $[Sistema de Quests].
```

## Passo 3: Testar Funcionalidades

### ✅ Teste 1: Links Funcionam
1. Abra qualquer seção
2. Clique em um link azul (ex: `$[Sistema de Combate]`)
3. **Esperado**: Navegar para a seção referenciada

### ✅ Teste 2: Backlinks Aparecem
1. Abra "Sistema de Combate"
2. Role até o final do conteúdo
3. **Esperado**: Ver caixa azul "🔗 Referenciado por" com lista de seções

### ✅ Teste 3: Referências Inválidas
1. Em qualquer seção, adicione: `$[Seção Inexistente]`
2. Salve e visualize
3. **Esperado**: Texto em vermelho com sublinhado ondulado

### ✅ Teste 4: Case Insensitive
1. Em uma seção, escreva: `$[sistema de combate]` (minúsculas)
2. **Esperado**: Ainda funciona (ignora maiúsculas/minúsculas)

### ✅ Teste 5: Múltiplas Referências
1. Abra "Sistema de Progressão"
2. **Esperado**: Ver 3-4 backlinks de diferentes seções

### ✅ Teste 6: Na Descrição do Projeto
1. Edite o projeto (botão amarelo "Editar")
2. Adicione na descrição: `Este RPG combina $[Sistema de Combate] com $[Exploração]`
3. Salve e volte
4. **Esperado**: Links funcionam também na descrição do projeto

## Passo 4: Testar Cenários de Erro

### ❌ Teste 7: Renomear Seção
1. Renomeie "Sistema de Combate" para "Combate Avançado"
2. Abra seções que referenciam ela
3. **Esperado**: Referências aparecem quebradas (vermelho)
4. **Correção Manual**: Edite as referências para `$[Combate Avançado]`

### ❌ Teste 8: Deletar Seção Referenciada
1. Delete "Sistema de Inventário"
2. Abra seções que referenciam ela
3. **Esperado**: Referências aparecem quebradas

## 📸 O que Você Deve Ver

### Links Válidos
- Texto em **azul**
- **Sublinhado**
- **Clicável**
- Tooltip mostra "Ir para: [Nome]"

### Links Inválidos
- Texto em **vermelho**
- **Sublinhado ondulado**
- **Não clicável**
- Tooltip mostra "Seção não encontrada"

### Backlinks
- Caixa com **fundo azul claro**
- Título "🔗 Referenciado por (N)"
- Lista de links para seções que referenciam a atual

## 🐛 Reportar Problemas

Se algo não funcionar:
1. Abra o console do navegador (F12)
2. Veja se há erros em vermelho
3. Anote qual teste falhou
4. Tente recarregar a página (Ctrl+R)

## 🎉 Próximos Passos

Se tudo funcionar, você pode:
- Criar seu GDD real usando referências cruzadas
- Experimentar criar redes complexas de dependências
- Ver quais seções são mais "centrais" (muitos backlinks)
