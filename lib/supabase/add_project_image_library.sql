-- Biblioteca de imagens do projeto: índice cacheado de uma pasta pública do Google Drive.
-- Mesmo padrão de linked_spreadsheets — metadata do Google buscada pelo browser
-- (token do picker, scope drive.readonly) e persistida aqui para o MCP/agente ler
-- sem precisar de credencial Google no servidor.
--
-- Shape:
-- {
--   "folderId": "1AbC...",
--   "folderUrl": "https://drive.google.com/drive/folders/1AbC...",
--   "syncedAt": "2026-08-25T12:00:00.000Z",
--   "files": [{ "fileId": "1Xy...", "name": "SEED_TURNIP.png" }]
-- }
--
-- Execute no SQL Editor do Supabase.

alter table if exists public.projects
add column if not exists image_library jsonb;
