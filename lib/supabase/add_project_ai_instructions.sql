-- Adiciona campo de instruções para IA em projetos.
-- Cada projeto pode ter instruções específicas que ensinam o Claude
-- como estruturar os dados (quais addons usar, convenções de colunas, etc).
-- Rodar no Supabase SQL Editor.

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS ai_instructions text DEFAULT '';
