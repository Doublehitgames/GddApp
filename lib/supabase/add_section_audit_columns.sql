-- ============================================================
-- GDD Manager - Auditoria em seções (quem criou / quem modificou)
-- Execute no Supabase SQL Editor. Campos opcionais para exibição.
-- ============================================================

alter table public.sections
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_by_name text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by_name text;

comment on column public.sections.created_by is 'Usuário que criou a seção';
comment on column public.sections.created_by_name is 'Nome de exibição no momento da criação';
comment on column public.sections.updated_by is 'Usuário da última modificação';
comment on column public.sections.updated_by_name is 'Nome de exibição no momento da última modificação';
