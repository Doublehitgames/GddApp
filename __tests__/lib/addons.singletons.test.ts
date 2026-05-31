import { SINGLETON_ADDON_TYPES } from "@/lib/addons/singletons";
import { ADDON_REGISTRY } from "@/lib/addons/registry";

describe("SINGLETON_ADDON_TYPES", () => {
  it("permanece em sincronia com as flags `singleton` do ADDON_REGISTRY", () => {
    const fromRegistry = new Set(
      ADDON_REGISTRY.filter((e) => e.singleton).map((e) => e.type)
    );
    // Mesmos elementos nos dois sentidos.
    expect([...SINGLETON_ADDON_TYPES].sort()).toEqual([...fromRegistry].sort());
  });
});
