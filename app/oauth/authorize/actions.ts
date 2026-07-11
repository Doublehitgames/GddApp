"use server";

/**
 * Server actions da tela de consentimento OAuth.
 * Rodam com a sessão Supabase do usuário (cookies) e proteção CSRF nativa
 * das server actions do Next.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAuthorizationCode, getClient, OAUTH_SCOPE } from "@/lib/oauth";

function redirectWithParams(base: string, params: Record<string, string | undefined>) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  redirect(url.toString());
}

export async function approveAuthorization(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const state = formData.get("state") ? String(formData.get("state")) : undefined;
  const scope = formData.get("scope") ? String(formData.get("scope")) : OAUTH_SCOPE;

  // Nunca confiar só nos hidden fields: revalida cliente + redirect_uri + sessão.
  const client = await getClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    redirect("/oauth/authorize?error=invalid_client");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  if (!codeChallenge) {
    redirectWithParams(redirectUri, { error: "invalid_request", state });
  }

  const code = await createAuthorizationCode({
    clientId,
    userId: user.id,
    redirectUri,
    codeChallenge,
    scope,
  });

  if (!code) {
    redirectWithParams(redirectUri, { error: "server_error", state });
  }

  redirectWithParams(redirectUri, { code: code!, state });
}

export async function denyAuthorization(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = formData.get("state") ? String(formData.get("state")) : undefined;

  const client = await getClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    redirect("/");
  }

  redirectWithParams(redirectUri, { error: "access_denied", state });
}
