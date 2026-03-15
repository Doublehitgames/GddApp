import type { User } from "@supabase/supabase-js";

// Aceita o cliente Supabase do server ou do client (select/insert em profiles).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientLike = any;

/**
 * Garante que o usuário autenticado tenha uma linha na tabela profiles.
 * Útil quando alguém apagou dados de profiles mas manteve usuários em auth
 * (ex.: limpeza manual de tabelas). Sem profile, sync e outras features quebram.
 *
 * Se não existir linha para user.id, insere uma com id, email e display_name.
 * Requer a policy "Usuário pode inserir próprio profile" (migração add_profiles_insert_policy.sql).
 */
export async function ensureUserProfile(
  supabase: SupabaseClientLike,
  user: Pick<User, "id" | "email" | "user_metadata">
): Promise<{ ensured: boolean; error?: string }> {
  const { data: existing, error: selectErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selectErr) {
    const msg = typeof selectErr === "object" && selectErr !== null && "message" in selectErr
      ? String((selectErr as { message: unknown }).message)
      : String(selectErr);
    return { ensured: false, error: msg };
  }
  if (existing) {
    return { ensured: true };
  }

  const displayName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    (user.email ? user.email.split("@")[0] : null);

  const { error: insertErr } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email ?? null,
    display_name: displayName,
  });

  if (insertErr) {
    const msg = typeof insertErr === "object" && insertErr !== null && "message" in insertErr
      ? String((insertErr as { message: unknown }).message)
      : String(insertErr);
    return { ensured: false, error: msg };
  }
  return { ensured: true };
}
