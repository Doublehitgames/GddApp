export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing Supabase URL. Configure NEXT_PUBLIC_SUPABASE_URL in environment variables."
    );
  }
  return url;
}

/**
 * Chave pública do Supabase. Preferir PUBLISHABLE_KEY (recomendado pelo Supabase);
 * ANON_KEY é legada e será descontinuada.
 */
export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Missing Supabase key. Configure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  return key;
}

export function getPublicSiteUrl(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) return null;
  return siteUrl.replace(/\/$/, "");
}
