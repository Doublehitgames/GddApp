-- ============================================================
-- GDD Manager — remoção dos addons
-- Execute no Supabase SQL Editor.
--
-- Os addons saíram do produto: a ideia de espelhar dados reais do jogo dentro
-- do GDD não vingou, e o que sobrou foi peso. Este script derruba as colunas
-- que só existiam para sustentá-los.
--
-- IRREVERSÍVEL: o conteúdo de `balance_addons` (e o dos snapshots de versão)
-- se perde. Foi decidido assim — os dados eram de teste.
--
-- Ordem importa: `addon_types` é coluna GERADA a partir de `balance_addons`,
-- então tem de sair primeiro.
-- ============================================================

-- ── sections ────────────────────────────────────────────────
-- Coluna gerada (add_sections_addon_types.sql): índice barato dos tipos de
-- addon de cada página, para listar sem ler o jsonb pesado.
ALTER TABLE public.sections DROP COLUMN IF EXISTS addon_types;

-- O jsonb com os addons em si (add_sections_balance_addons.sql).
ALTER TABLE public.sections DROP COLUMN IF EXISTS balance_addons;

-- Notas por grupo de addons — a hipótese do teste A/B de balanceamento
-- (add_sections_addon_group_notes.sql).
ALTER TABLE public.sections DROP COLUMN IF EXISTS addon_group_notes;

-- Planilha do Google vinculada à página. Só servia para alimentar bindings de
-- campo de addon (add_sections_linked_spreadsheet.sql).
ALTER TABLE public.sections DROP COLUMN IF EXISTS linked_spreadsheet_id;

-- ── section_versions ────────────────────────────────────────
-- Os snapshots guardavam uma cópia dos addons junto do título/conteúdo.
ALTER TABLE public.section_versions DROP COLUMN IF EXISTS balance_addons;

-- ── projects ────────────────────────────────────────────────
-- Registro das planilhas do Google reutilizadas nos vínculos.
ALTER TABLE public.projects DROP COLUMN IF EXISTS linked_spreadsheets;
