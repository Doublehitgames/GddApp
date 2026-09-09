-- ============================================================
-- GDD Manager — remoção do Diário (agenda) e do KPI Tracker
-- Execute no Supabase SQL Editor.
--
-- As duas features saíram do produto: uma era um gerenciador de tarefas
-- semanais, a outra um painel de métricas de operação. Nenhuma das duas
-- apresentava informação de design — o GDD virou só isso, e elas viraram peso.
--
-- IRREVERSÍVEL: as tarefas do diário e o histórico de KPI se perdem. Se alguém
-- ainda quiser esses dados, exporte antes de rodar.
--
-- As políticas de RLS caem junto com as tabelas; não precisa derrubá-las antes.
-- ============================================================

-- ── Diário (agenda_migration.sql) ───────────────────────────
-- Uma linha por (usuário, projeto) com o array de tarefas em jsonb.
DROP TABLE IF EXISTS public.agenda_data;

-- ── KPI Tracker (kpi_migration.sql, kpi_members_migration.sql) ──
-- Entradas (hipótese, resultado, métricas) e a config por projeto (gênero,
-- benchmarks customizados).
DROP TABLE IF EXISTS public.kpi_entries;
DROP TABLE IF EXISTS public.kpi_configs;
