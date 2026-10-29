-- Regra de tabelas da página-mãe de uma coleção.
--
-- Guarda, na página-mãe, a lista das tabelas que as filhas carregam na
-- descrição — o nome que vai no `##` e as colunas de cada uma (nome, tipo,
-- unidade, exigida). Forma em lib/tableRule/tableRule.ts:
--
--   { "tables": [ { "name": "Economia",
--                   "columns": [ { "name": "Compra", "type": "number",
--                                  "unit": "moedas", "required": true } ] } ] }
--
-- É dica de leitura, não dado: os números continuam nas tabelas das filhas.
-- Derrubar esta coluna apaga só a regra — nenhuma tabela, nenhum número.
--
-- NULL é "sem regra", o caso de quase toda página. Sem DEFAULT de propósito.
--
-- Aplicar ANTES do deploy que lê a coluna: as leituras do /api/v1 e do link
-- público caem para um conjunto menor de colunas quando uma delas não existe.

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS table_rule JSONB;

-- Só a forma de fora; o resto quem valida é a API (lib/api/v1/schemas.ts).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sections_table_rule_check'
  ) THEN
    ALTER TABLE public.sections
      ADD CONSTRAINT sections_table_rule_check
      CHECK (table_rule IS NULL OR jsonb_typeof(table_rule -> 'tables') = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.sections.table_rule IS
  'Regra de tabelas das filhas (página-mãe de coleção): nome de cada tabela e suas colunas. NULL = sem regra.';
