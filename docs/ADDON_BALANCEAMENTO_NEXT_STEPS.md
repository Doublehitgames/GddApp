# Addon de Balanceamento: Proximos passos

Este documento registra o que foi propositalmente deixado fora do MVP visual atual.

## Fase 2: persistencia e sync

- Persistir addons no modelo de `Section` no `projectStore`.
- Garantir serializacao no `localStorage` junto dos projetos.
- Incluir addons no payload de sync (`projectSync`) e no diff da API de sync.
- Definir schema no Supabase para armazenar os addons (jsonb em `sections` ou tabela dedicada).

## Fase 3: exportacao Unity

- Criar exportador JSON dedicado para engine (`unity-export-v1`).
- Exportar tabela calculada (`level -> value`) por addon de balanceamento.
- Opcionalmente exportar tambem formula e parametros para runtime.
- Versionar o schema para evolucao sem quebrar consumidores.

## Fase 4: i18n e UX final

- Migrar textos do addon para i18n (`pt-BR`, `en`, `es`).
- Padronizar labels/ajudas para clareza de design de progressao.
- Adicionar validacoes de UX (limites de faixa, mensagens de erro mais guiadas).

## Fase 5: testes

- Testes unitarios para `formulaEngine` (presets, parser, funcoes permitidas, erros).
- Testes de componente para `BalanceAddonPanel` (modo preset/avancado, tabela e grafico).
- Testes de integracao na pagina de secao para fluxo de adicionar/remover varios addons.
- Na fase de sync, cobrir cenarios de diff e impacto em quota.
