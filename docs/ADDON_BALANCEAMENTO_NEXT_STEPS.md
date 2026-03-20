# Addon de Balanceamento: estado atual e próximos passos

Este documento reflete o estado atual do addon de balanceamento e os próximos incrementos.

## O que já está implementado

- Modelo unificado de addon em seção (`SectionAddon`) com normalização em `lib/addons/normalize.ts`.
- Persistência local dos addons no `projectStore` (`section.addons`).
- Sync de addons no payload de seções (coluna `balance_addons` no Supabase).
- Fallback no sync para banco antigo sem coluna `balance_addons` (não bloqueia sync geral).
- Migração SQL disponível: `lib/supabase/add_sections_balance_addons.sql`.

## Próximos passos recomendados

### 1) Exportação Unity

- Consolidar exportador dedicado por addon no fluxo de export.
- Garantir versão estável de schema para integração com engine.
- Cobrir presets/fórmulas no output com validação consistente.

### 2) i18n e UX

- Revisar todos os textos de addon em `pt-BR`, `en`, `es`.
- Melhorar mensagens de validação para cenários inválidos de parâmetros.
- Padronizar rótulos para novos tipos de addon no registry.

### 3) Testes

- Aumentar cobertura unitária de normalização e engine de fórmula.
- Adicionar testes de integração para fluxo completo (criar/editar/remover addons + sync).
- Cobrir cenários de retrocompatibilidade (DB com/sem `balance_addons`).

### 4) Expansão de arquitetura

- Evoluir `ADDON_REGISTRY` para mais tipos de bloco (além de balanceamento).
- Definir contrato estável para render read-only e editor por tipo de addon.
