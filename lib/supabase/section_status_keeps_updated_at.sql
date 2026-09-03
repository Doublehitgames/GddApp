-- ============================================================
-- GDD Manager - Marcar o estado de uma pagina nao conta como editar a pagina
-- Execute no Supabase SQL Editor. Idempotente.
--
-- O trigger sections_updated_at carimba updated_at = now() em QUALQUER update
-- da linha. Isso derruba a intencao do app, que de proposito nao mexe em
-- updated_at ao trocar o estado: aprovar uma pagina nao e reescreve-la.
--
-- Sem esta correcao o selo de "pode estar desatualizada" vira ruido: marcar
-- 20 paginas como aprovadas de uma vez faria toda pagina que cita alguma
-- delas parecer desatualizada, sem que uma linha de texto tenha mudado.
--
-- A regra: se o unico campo que mudou foi status/status_at, updated_at fica
-- onde estava. Qualquer outra mudanca (titulo, texto, cor, ordem, pai)
-- continua carimbando now(), como sempre.
--
-- Vale so para sections; projects continua usando set_updated_at().
-- ============================================================

create or replace function public.set_sections_updated_at()
returns trigger as $$
begin
  if to_jsonb(new) - 'status' - 'status_at' - 'updated_at'
     = to_jsonb(old) - 'status' - 'status_at' - 'updated_at' then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists sections_updated_at on public.sections;

create trigger sections_updated_at
  before update on public.sections
  for each row execute function public.set_sections_updated_at();
