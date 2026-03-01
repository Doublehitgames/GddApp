-- Corrige a policy de DELETE em projects para usar a função security definer
-- (evita possível recursão ou falha de permissão)

drop policy if exists "Dono deleta seus projetos" on public.projects;

create policy "Dono deleta seus projetos"
  on public.projects for delete
  using (auth.uid() = owner_id);
