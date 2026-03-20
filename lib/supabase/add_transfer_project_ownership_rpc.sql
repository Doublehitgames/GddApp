-- Transferência transacional de ownership do projeto
-- Objetivo: evitar estados parciais (ex.: troca de owner sem ajustar membros)
-- Execução: Supabase SQL Editor

create or replace function public.transfer_project_ownership(
  p_project_id uuid,
  p_new_owner_id uuid
)
returns table(new_owner_id uuid, previous_owner_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_current_owner uuid;
  v_target_role text;
begin
  if v_actor is null then
    raise exception 'unauthenticated';
  end if;

  if p_project_id is null or p_new_owner_id is null then
    raise exception 'invalid_payload';
  end if;

  select owner_id
    into v_current_owner
  from public.projects
  where id = p_project_id
  for update;

  if v_current_owner is null then
    raise exception 'project_not_found';
  end if;

  if v_current_owner <> v_actor then
    raise exception 'forbidden_only_owner_can_transfer';
  end if;

  if p_new_owner_id = v_actor then
    raise exception 'target_must_be_different';
  end if;

  select role
    into v_target_role
  from public.project_members
  where project_id = p_project_id
    and user_id = p_new_owner_id
  for update;

  if v_target_role is distinct from 'editor' then
    raise exception 'target_must_be_editor_member';
  end if;

  -- Mantém o antigo dono como editor
  insert into public.project_members (project_id, user_id, role, invited_by)
  values (p_project_id, v_actor, 'editor', v_actor)
  on conflict (project_id, user_id)
  do update set role = 'editor', invited_by = excluded.invited_by;

  -- Troca ownership
  update public.projects
  set owner_id = p_new_owner_id,
      updated_at = now()
  where id = p_project_id
    and owner_id = v_actor;

  -- Novo dono não deve ficar duplicado como membro
  delete from public.project_members
  where project_id = p_project_id
    and user_id = p_new_owner_id;

  return query
    select p_new_owner_id, v_actor;
end;
$$;

revoke all on function public.transfer_project_ownership(uuid, uuid) from public;
grant execute on function public.transfer_project_ownership(uuid, uuid) to authenticated;
