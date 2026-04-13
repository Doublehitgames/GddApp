/**
 * Unified auth resolver for API routes.
 *
 * Checks for an API key in the Authorization header first, then falls back to
 * Supabase session cookies. Returns a Supabase client appropriate for each
 * auth method:
 *
 * - **session**: regular SSR client with RLS enforced by Supabase.
 * - **apiKey**: admin (service-role) client that bypasses RLS. Routes MUST
 *   filter by userId manually when using this client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateApiKey } from "@/lib/apiKeys";

export type AuthResult =
  | {
      authenticated: true;
      userId: string;
      source: "session";
      supabase: SupabaseClient;
    }
  | {
      authenticated: true;
      userId: string;
      source: "apiKey";
      keyId: string;
      supabase: SupabaseClient;
    }
  | {
      authenticated: false;
      error: string;
      status: 401 | 403;
    };

export async function getApiUser(request: NextRequest): Promise<AuthResult> {
  // 1. Try API key from Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer gdd_sk_")) {
    const rawKey = authHeader.slice("Bearer ".length);
    const result = await validateApiKey(rawKey);
    if (result) {
      return {
        authenticated: true,
        userId: result.userId,
        source: "apiKey",
        keyId: result.keyId,
        supabase: createAdminClient(),
      };
    }
    return {
      authenticated: false,
      error: "Invalid or revoked API key",
      status: 401,
    };
  }

  // 2. Fall back to Supabase session cookies
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      authenticated: false,
      error: "Not authenticated",
      status: 401,
    };
  }

  return {
    authenticated: true,
    userId: user.id,
    source: "session",
    supabase,
  };
}
