# Homologacao do Addon de Tabela

## Objetivo

Validar o addon `progressionTable` em fluxo real de uso antes da release.

## Escopo da homologacao

- Localizacao em `pt-BR`, `en` e `es`.
- Persistencia local apos refresh.
- Sync com nuvem com `balance_addons`.
- Export JSON no proprio addon.
- Ordem de colunas preservada no JSON exportado.

## Checklist manual (fase 2)

1. Criar projeto e adicionar addon de tabela em uma secao.
2. Renomear tabela, adicionar/remover/reordenar colunas e editar valores.
3. Trocar locale para `en` e `es` e revisar labels do painel.
4. Recarregar a pagina e confirmar que estrutura/valores permanecem.
5. Executar sync do projeto e validar ausencia de erro.
6. Clicar em `Exportar JSON` no addon e abrir arquivo:
   - `columns` deve seguir a mesma ordem visual dos blocos.
   - cada `rows[i].values` deve respeitar a mesma ordem de `columns`.
7. Validar leitura em modo somente visual (view/mindmap) para mesma secao.

## Evidencias recomendadas

- Screenshot do painel em cada idioma.
- JSON exportado de exemplo.
- Log de sync sem erros.

