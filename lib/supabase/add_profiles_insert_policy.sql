-- Permite que o usuário autenticado crie a própria linha em profiles.
-- Necessário quando auth.users existe mas a linha em profiles foi apagada
-- (ex.: limpeza manual de tabelas). O app chama ensureUserProfile() e insere se faltar.

create policy "Usuário pode inserir próprio profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);
