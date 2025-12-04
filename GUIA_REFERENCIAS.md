# 🔗 Sistema de Referências Cruzadas - Guia Completo

## ✨ O que foi implementado

O sistema permite criar links entre seções do seu GDD usando a sintaxe `$[Nome da Seção]`.

### 🎯 Funcionalidades

#### 1. **Referências por Nome** (será convertido automaticamente)
```markdown
O jogador pode coletar $[Sementes] no mapa.
```

#### 2. **Referências por ID** (resiliente a renomeações)
```markdown
O jogador pode coletar $[#abc123] no mapa.
```

#### 3. **Conversão Automática ao Salvar** ✨
Quando você salva uma seção com `$[Nome da Seção]`, o sistema **automaticamente converte** para `$[#sectionId]`.

**Benefício:** Se você renomear "Sementes" para "Plantas", a referência continua funcionando!

#### 4. **Backlinks Automáticos**
Cada seção mostra quem está referenciando ela, criando uma rede de conexões.

#### 5. **Validação de Links**
- ✅ Link válido: **azul e clicável**
- ❌ Link quebrado: **vermelho com sublinhado ondulado**

---

## 📝 Como Usar

### Criar uma Referência

1. Na descrição de qualquer seção ou projeto, digite:
   ```markdown
   $[Nome Exato da Seção]
   ```

2. **Case-insensitive**: `$[Sementes]`, `$[sementes]` e `$[SEMENTES]` funcionam igual

3. Salve o conteúdo

4. **Magia acontece:** 
   - O sistema converte automaticamente para `$[#idDaSecao]`
   - Aparece como link azul clicável
   - Mostra o nome atual da seção (mesmo se renomear depois)

### Navegar entre Seções

- Clique no link azul → vai direto para a seção
- Na seção de destino, veja a caixa azul "🔗 Referenciado por" com backlinks

---

## 🔄 Como Funciona a Conversão Automática

### Antes de Salvar
```markdown
O jogador planta $[Sementes] no solo.
```

### Depois de Salvar (automático)
```markdown
O jogador planta $[#abc123def456] no solo.
```

### Na Visualização
```
O jogador planta [Sementes] no solo.
                  ↑ link azul clicável
```

### Se Renomear "Sementes" → "Plantas"
```
O jogador planta [Plantas] no solo.
                  ↑ ainda funciona! mostra o novo nome
```

---

## 🎨 Exemplos Práticos

### Exemplo 1: Sistema de Jogo Interconectado

**Seção: Sistema de Combate**
```markdown
O combate utiliza as habilidades aprendidas via $[Árvore de Skills].

O dano é calculado baseado em:
- Nível do personagem ($[Sistema de Progressão])
- Armas equipadas ($[Sistema de Inventário])
- Buffs ativos ($[Sistema de Status])
```

**Resultado:** 4 links clicáveis que conectam o sistema de combate com outros sistemas.

### Exemplo 2: Fluxo de Gameplay

**Seção: Tutorial Inicial**
```markdown
1. Jogador aprende $[Controles Básicos]
2. Enfrenta primeiro inimigo ($[Sistema de Combate])
3. Coleta primeira recompensa ($[Sistema de Loot])
4. Desbloqueia primeira habilidade ($[Árvore de Skills])
```

### Exemplo 3: Documentação de Features

**Seção: Multiplayer**
```markdown
## Modos de Jogo

### Co-op
Permite 2-4 jogadores cooperarem em $[Dungeons] e $[Raids].
Usa o mesmo $[Sistema de Progressão] do single player.

### PvP
Arena competitiva com ranking ($[Sistema de Ladder]).
Recompensas especiais ($[Loja PvP]).
```

---

## 🔍 Ver Todas as Referências

### Referências Diretas (Outgoing)
São os links que você coloca no conteúdo da seção.

### Backlinks (Incoming)
Aparecem automaticamente em uma caixa azul:

```
┌─────────────────────────────┐
│ 🔗 Referenciado por (3)     │
│                             │
│ • Sistema de Combate        │
│ • Tutorial Inicial          │
│ • Progressão do Jogador     │
└─────────────────────────────┘
```

---

## ⚠️ Importantes

### ✅ FAÇA:
- Use nomes exatos das seções
- Deixe o sistema converter automaticamente
- Verifique backlinks para ver impacto de mudanças

### ❌ NÃO FAÇA:
- Não edite manualmente o ID (`$[#abc123]`)
- Não use caracteres especiais no nome das seções
- Não se preocupe com maiúsculas/minúsculas

---

## 🐛 Resolução de Problemas

### Link aparece vermelho
**Causa:** Seção não encontrada
**Solução:** 
1. Verifique se digitou o nome correto
2. Verifique se a seção existe
3. Salve novamente para converter

### Link não funciona após renomear
**Causa:** Referência antiga ainda usa nome
**Solução:** Edite e salve novamente - será convertido para ID

### Backlinks não aparecem
**Causa:** Nenhuma seção está referenciando esta
**Solução:** Normal! Significa que esta seção não é referenciada ainda

---

## 💡 Dicas de Uso

### 1. **Planeje a Estrutura**
Identifique sistemas centrais que serão muito referenciados:
- Sistema de Progressão
- Sistema de Combate
- Sistema de Inventário

### 2. **Use Backlinks para Análise**
Seções com muitos backlinks são "centrais" no design.
Se precisar mudar algo, veja os backlinks primeiro!

### 3. **Documente Dependências**
```markdown
## Dependências
Este sistema depende de:
- $[Sistema X]
- $[Sistema Y]
```

### 4. **Crie Glossário**
```markdown
## Glossário
- **XP**: Experiência, veja $[Sistema de Progressão]
- **DPS**: Dano por segundo, veja $[Sistema de Combate]
```

---

## 🚀 Próximas Melhorias (Futuro)

- [ ] Autocomplete ao digitar `$[`
- [ ] Grafo visual de dependências
- [ ] Preview ao passar o mouse
- [ ] Busca por referências
- [ ] Exportar mapa de conexões

---

## 📊 Estatísticas

O sistema track automaticamente:
- Quantas seções referenciam cada seção (backlinks count)
- Links quebrados (vermelho)
- Rede de dependências

Use isso para:
- Identificar seções importantes
- Encontrar documentação órfã
- Mapear complexidade do design
