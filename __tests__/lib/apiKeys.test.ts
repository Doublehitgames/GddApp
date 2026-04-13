import { generateApiKey, hashApiKey, makeKeyPrefix } from "@/lib/apiKeys";

describe("API key utilities", () => {
  describe("generateApiKey", () => {
    it("starts with gdd_sk_ prefix", () => {
      expect(generateApiKey()).toMatch(/^gdd_sk_/);
    });

    it("is exactly 71 characters (7 prefix + 64 hex)", () => {
      expect(generateApiKey()).toHaveLength(71);
    });

    it("contains only valid hex characters after prefix", () => {
      const key = generateApiKey();
      const hex = key.slice("gdd_sk_".length);
      expect(hex).toMatch(/^[0-9a-f]{64}$/);
    });

    it("generates unique keys on each call", () => {
      const a = generateApiKey();
      const b = generateApiKey();
      expect(a).not.toBe(b);
    });
  });

  describe("hashApiKey", () => {
    it("returns a 64-char hex string (SHA-256)", () => {
      const hash = hashApiKey("gdd_sk_test123");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is deterministic (same input = same hash)", () => {
      const key = generateApiKey();
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it("different keys produce different hashes", () => {
      const a = generateApiKey();
      const b = generateApiKey();
      expect(hashApiKey(a)).not.toBe(hashApiKey(b));
    });

    it("never returns the original key", () => {
      const key = generateApiKey();
      expect(hashApiKey(key)).not.toBe(key);
    });
  });

  describe("makeKeyPrefix", () => {
    it("returns gdd_sk_ + first 4 hex + ... + last 4 hex", () => {
      // "gdd_sk_" (7) + "a1b2" (4) + "..." (3) + "7890" (4) = 18 chars
      const key = "gdd_sk_a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890";
      const prefix = makeKeyPrefix(key);
      expect(prefix).toBe("gdd_sk_a1b2...7890");
    });

    it("preserves the gdd_sk_ prefix", () => {
      const key = generateApiKey();
      expect(makeKeyPrefix(key)).toMatch(/^gdd_sk_/);
    });

    it("contains the ellipsis separator", () => {
      const key = generateApiKey();
      expect(makeKeyPrefix(key)).toContain("...");
    });
  });
});
