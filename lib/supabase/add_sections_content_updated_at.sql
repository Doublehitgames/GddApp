-- ============================================================
-- GDD Manager - "quando o texto mudou", separado de "quando a linha mudou"
-- Execute no Supabase SQL Editor. Idempotente, e conserta a si mesma.
-- Substitui section_status_keeps_updated_at.sql (mesma funcao, regra maior).
--
-- O selo de "pode estar desatualizada" pergunta se o SENTIDO de uma pagina
-- citada mudou depois da confirmacao. Ele vinha lendo updated_at, que o
-- trigger carimba a cada update da linha — trocar a cor de um no do mapa
-- mental ou arrastar uma pagina na arvore acendia o aviso em todas as
-- paginas que a citam, sem uma palavra ter mudado.
--
-- Agora sao duas datas:
--   updated_at         - a linha mudou (menos status/status_at, que nao contam)
--   content_updated_at - o TEXTO mudou: titulo, content ou content_blocks
--
-- Ninguem escreve content_updated_at pelo app: quem mantem e este trigger.
--
-- ORDEM IMPORTA. A coluna nasce SEM default: no Postgres, ADD COLUMN com
-- default preenche todas as linhas existentes na hora, e o backfill logo
-- abaixo nao acharia nada para corrigir — as 250 paginas ficariam alegando
-- que o texto delas mudou no minuto da migration. O default entra depois do
-- backfill, valendo so para linhas novas.
-- ============================================================

alter table public.sections
  add column if not exists content_updated_at timestamptz;

-- Fora do caminho do trigger, que senao desfaz o backfill: para uma linha cujo
-- texto nao mudou, a regra dele e justamente preservar content_updated_at.
drop trigger if exists sections_updated_at on public.sections;

-- Linhas antigas: a melhor aproximacao disponivel e o proprio updated_at.
-- O segundo caso conserta quem rodou a primeira versao desta migration: por
-- construcao content_updated_at nunca pode ser MAIOR que updated_at, porque
-- toda mudanca de texto carimba as duas datas.
update public.sections
   set content_updated_at = updated_at
 where content_updated_at is null
    or content_updated_at > updated_at;

alter table public.sections
  alter column content_updated_at set default now();

comment on column public.sections.content_updated_at is 'Quando titulo/content/content_blocks mudaram pela ultima vez. Base do selo de pagina desatualizada; mantido pelo trigger, nunca pelo app.';

create or replace function public.set_sections_updated_at()
returns trigger as $$
declare
  novo jsonb := to_jsonb(new);
  velho jsonb := to_jsonb(old);
begin
  -- updated_at: qualquer mudanca, exceto uma que so mexa no estado da pagina.
  -- Marcar como aprovada nao e editar a pagina.
  if novo - 'status' - 'status_at' - 'updated_at' - 'content_updated_at'
     = velho - 'status' - 'status_at' - 'updated_at' - 'content_updated_at' then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;

  -- content_updated_at: so o texto conta. A comparacao passa pelo jsonb de
  -- proposito — assim a funcao nao quebra num banco onde content_blocks ainda
  -- nao existe (a chave ausente vira NULL dos dois lados).
  if (novo -> 'title') is distinct from (velho -> 'title')
     or (novo -> 'content') is distinct from (velho -> 'content')
     or (novo -> 'content_blocks') is distinct from (velho -> 'content_blocks') then
    new.content_updated_at = now();
  else
    new.content_updated_at = old.content_updated_at;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger sections_updated_at
  before update on public.sections
  for each row execute function public.set_sections_updated_at();
