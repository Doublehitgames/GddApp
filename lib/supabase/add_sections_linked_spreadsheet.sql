-- ============================================================
-- GDD Manager - Planilha vinculada por seção
-- Execute no Supabase SQL Editor.
-- ============================================================

alter table public.sections
  add column if not exists linked_spreadsheet_id text default null;

comment on column public.sections.linked_spreadsheet_id is 'ID (UUID do registro local) da planilha Google Sheets vinculada a esta seção. Referencia Project.linkedSpreadsheets[].id.';
