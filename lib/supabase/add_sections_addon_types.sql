-- Coluna gerada com os TIPOS dos addons de uma seção.
-- Execute no SQL Editor do Supabase.
--
-- Por quê: `balance_addons` é 84% dos bytes de uma listagem de seções (983 KB
-- de 1,17 MB no Granjita Alegre, com 185 seções). Listar o projeto para saber
-- "quais páginas têm Progression Table" obrigava o Postgres a ler todas as
-- tabelas de progressão inteiras — o jsonb grande vive fora da linha, em TOAST,
-- e é lido sempre que a coluna entra no SELECT.
--
-- Esta coluna guarda só os nomes dos tipos. Como é pequena, fica na própria
-- linha: um SELECT que peça `addon_types` em vez de `balance_addons` não
-- encosta no TOAST. Medido antes: 1049 ms para listar 185 seções com os tipos;
-- sem tocar no jsonb, 669 ms.
--
-- É GENERATED ... STORED, então o Postgres recalcula sozinho a cada escrita em
-- `balance_addons`. Não existe backfill a rodar nem trigger para manter, e não
-- há como a coluna ficar desatualizada.
--
-- `jsonb_path_query_array` é IMMUTABLE (só as variantes `_tz` são STABLE), que
-- é o requisito para coluna gerada. Em modo lax, `$[*].type` simplesmente pula
-- entradas sem `type` em vez de gerar nulos.
--
-- ATENÇÃO: adicionar coluna gerada STORED reescreve a tabela e toma lock
-- ACCESS EXCLUSIVE durante a reescrita. Em `sections` isso é rápido, mas
-- prefira rodar fora de horário de pico.

ALTER TABLE public.sections
ADD COLUMN IF NOT EXISTS addon_types jsonb
GENERATED ALWAYS AS (
  jsonb_path_query_array(COALESCE(balance_addons, '[]'::jsonb), '$[*].type')
) STORED;

COMMENT ON COLUMN public.sections.addon_types IS
  'Tipos dos addons da seção, derivados de balance_addons. Coluna gerada: não escrever nela. Serve para listar seções sem ler o jsonb pesado.';
