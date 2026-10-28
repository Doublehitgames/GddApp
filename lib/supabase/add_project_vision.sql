-- Adiciona a "Visão" do jogo em projetos: logline, o que o jogador faz,
-- sensação, pilares, gênero e o progresso do "Primeiros passos" (starter).
-- É metadado do projeto: não cobra crédito de sync.
-- Rodar no Supabase SQL Editor.

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS vision jsonb;
