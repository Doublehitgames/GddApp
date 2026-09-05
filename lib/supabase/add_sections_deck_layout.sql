-- Modo de exibição das filhas no Deck.
--
-- `grid`  → as filhas abrem como parede de cartas, num andar próprio.
-- `list`  → as filhas ficam na lista lateral da gaveta.
-- NULL    → automático: o app decide pela quantidade de filhas.
--
-- NULL é o caso normal e de longe o mais comum: um GDD antigo tem centenas de
-- páginas que ninguém vai classificar uma a uma. Por isso a coluna NASCE SEM
-- DEFAULT — um `DEFAULT` aqui preencheria todas as linhas existentes na hora,
-- transformando "ninguém escolheu" em "todo mundo escolheu list", e o
-- automático nunca mais valeria para nada.

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS deck_layout TEXT;

-- Só os dois valores conhecidos, e NULL continua permitido.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sections_deck_layout_check'
  ) THEN
    ALTER TABLE public.sections
      ADD CONSTRAINT sections_deck_layout_check
      CHECK (deck_layout IS NULL OR deck_layout IN ('list', 'grid'));
  END IF;
END $$;

COMMENT ON COLUMN public.sections.deck_layout IS
  'Como a página mostra as filhas no modo Deck: list, grid ou NULL (automático).';
