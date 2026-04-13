/**
 * API key generation, hashing, and validation.
 * Server-only — never import from client code.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const KEY_PREFIX = "gdd_sk_";

/** Generate a new API key: "gdd_sk_" + 32 random bytes as hex (71 chars total). */
export function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(32).toString("hex");
}

/** SHA-256 hex digest of the full raw key. */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Displayable prefix for a key: "gdd_sk_" + first 4 hex + "..." + last 4 hex.
 * Example: "gdd_sk_a1b2...7890"
 */
export function makeKeyPrefix(rawKey: string): string {
  const hex = rawKey.slice(KEY_PREFIX.length);
  return KEY_PREFIX + hex.slice(0, 4) + "..." + hex.slice(-4);
}

/**
 * Validate a raw API key against the database.
 * Uses the admin (service-role) client to bypass RLS.
 * Returns the owning userId and keyId if valid, null otherwise.
 */
export async function validateApiKey(
  rawKey: string
): Promise<{ userId: string; keyId: string } | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;

  const hash = hashApiKey(rawKey);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("user_api_keys")
    .select("id, user_id, key_hash, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at) return null;

  // Timing-safe compare of hashes to prevent timing attacks
  const storedBuf = Buffer.from(data.key_hash, "utf8");
  const providedBuf = Buffer.from(hash, "utf8");
  if (storedBuf.length !== providedBuf.length) return null;
  if (!timingSafeEqual(storedBuf, providedBuf)) return null;

  // Update last_used_at (fire-and-forget, don't block the response)
  supabase
    .from("user_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { userId: data.user_id, keyId: data.id };
}
