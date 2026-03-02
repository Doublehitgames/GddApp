import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";
import { supabaseSafeFetch } from "@/lib/supabase/safeFetch";

let browserClient: SupabaseClient | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      global: {
        fetch: supabaseSafeFetch,
      },
    }
  );

  return browserClient;
}
