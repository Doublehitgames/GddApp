# Referências Cruzadas entre Seções

## 📎 O que são Referências Cruzadas?

Referências cruzadas permitem criar links internos entre seções do seu GDD usando uma sintaxe simples: `$[Nome da Seção]`

## 🚀 Como Usar

### Sintaxe Básica

```markdown
O jogador pode atacar inimigos usando o $[Sistema de Combate].

Os power-ups afetam diretamente as $[Mecânicas de Movimento] do personagem.
```

### Características

✅ **Links Clicáveis**: Clique no nome da seção para navegar diretamente
✅ **Validação Automática**: Seções inexistentes aparecem em vermelho com aviso
✅ **Case-Insensitive**: Funciona independente de maiúsculas/minúsculas
✅ **Backlinks**: Veja automaticamente quais seções referenciam a atual

## 📋 Exemplos Práticos

### Exemplo 1: Conectando Sistemas

```markdown
# Sistema de Progressão

O jogador começa no nível 1 (veja $[Tutorial Inicial]).

A cada missão completada (detalhes em $[Sistema de Missões]),
ele ganha XP e pode subir de nível.

O nível afeta diretamente:
- Pontos de Habilidade → $[Sistema de Skills]
- Itens Equipáveis → $[Sistema de Inventário]
- Dificuldade dos Inimigos → $[Balanceamento]
```

### Exemplo 2: Documentando Dependências

```markdown
# Boss Final

O boss utiliza:
- Ataques elementais baseados em $[Sistema de Magia]
- Fases múltiplas ($[Sistema de IA Adaptativa])
- Recompensas especiais ($[Sistema de Loot])

Requer que o jogador tenha completado $[Fase 3] e 
obtido o item $[Espada Lendária] em $[Dungeon Secreta].
```

### Exemplo 3: Referências no Projeto

```markdown
# Descrição do Projeto

Este jogo é um RPG que combina elementos de:
- $[Sistema de Combate] em tempo real
- $[Progressão de Personagem] não-linear
- $[Exploração de Mundo Aberto]

Veja também: $[Documento de Visão] e $[Requisitos Técnicos]
```

## 🔍 Recursos Avançados

### Backlinks (Referências Inversas)

Quando você está visualizando uma seção, automaticamente verá uma caixa azul mostrando **quais outras seções referenciam esta**.

Exemplo: Se você está em "Sistema de Combate" e ele é mencionado em 5 lugares, verá:

```
🔗 Referenciado por (5)
  - Tutorial Inicial
  - Boss Final
  - Progressão de Personagem
  - ...
```

### Validação de Referências

- ✅ **Válidas**: Links azuis clicáveis
- ⚠️ **Inválidas**: Texto vermelho ondulado com tooltip explicativo

Se você renomear uma seção, as referências **NÃO** são atualizadas automaticamente (ainda). Você verá avisos visuais de referências quebradas.

## 💡 Dicas de Uso

1. **Use nomes descritivos**: Prefira `$[Sistema de Combate]` ao invés de `$[Combate]`
2. **Evite ambiguidade**: Se tem "Combate Básico" e "Combate Avançado", seja específico
3. **Documente dependências**: Use para mostrar quais sistemas dependem de outros
4. **Crie uma seção "Glossário"**: Centralize definições e referencie de todos os lugares

## 🎯 Casos de Uso

### ✅ Bom Uso
- Conectar sistemas relacionados
- Documentar dependências
- Criar trilhas de leitura
- Evitar duplicação de informação

### ❌ Evite
- Referenciar a própria seção
- Referências circulares excessivas
- Usar para navegação quando breadcrumbs/hierarquia são mais apropriados

## 🔧 Limitações Atuais

- Referências são case-insensitive mas devem ter o nome exato
- Renomear seções não atualiza referências automaticamente
- Não há autocomplete no editor (ainda)
- Funciona apenas em conteúdo de seções, não em títulos

## 🚧 Próximas Melhorias

- [ ] Autocomplete ao digitar `$[`
- [ ] Atualização automática ao renomear seções
- [ ] Visualização de grafo de dependências
- [ ] Preview em hover
- [ ] Suporte a âncoras dentro de seções
