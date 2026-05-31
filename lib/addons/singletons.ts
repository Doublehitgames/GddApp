import type { SectionAddonType } from "@/lib/addons/types";

/**
 * Tipos de addon limitados a UM por página (seção).
 *
 * Deve permanecer em sincronia com as flags `singleton: true` de
 * `lib/addons/registry.ts` — há um teste (`addons.singletons.test.ts`) que
 * garante essa equivalência. Mantido aqui como lista explícita (e não derivado
 * do registry) para que código server-side (rotas de API) possa importar sem
 * puxar os componentes React do registry.
 */
export const SINGLETON_ADDON_TYPES: ReadonlySet<SectionAddonType> = new Set<SectionAddonType>([
  "xpBalance",
  "progressionTable",
  "economyLink",
  "attributeDefinitions",
  "attributeProfile",
  "attributeModifiers",
  "skills",
  "currency",
  "currencyExchange",
  "dataSchema",
  "globalVariable",
  "production",
  "craftTable",
  "inventory",
  "fieldLibrary",
]);
