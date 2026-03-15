/**
 * Variáveis de ambiente usadas APENAS no servidor.
 * Importar somente de código server-side (API routes, Server Components, server-only modules).
 * Nunca importar este arquivo de componentes com "use client" ou de código que rode no browser.
 *
 * @see https://supabase.com/docs/guides/api/api-keys
 */

import { getSupabaseUrl } from "./env";

export { getSupabaseUrl };

/**
 * Chave com privilégios elevados (backend apenas). Pode ser a nova secret key
 * (sb_secret_..., recomendada) ou a legada service_role JWT. Nunca expor no client.
 */
export function getSupabaseServiceRoleKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing Supabase backend key. Configure SUPABASE_SECRET_KEY (recommended) or SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return key;
}
