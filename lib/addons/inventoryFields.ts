import type { DataSchemaValueType, InventoryAddonDraft, InventoryFieldKey } from "@/lib/addons/types";

/** Data Schema value type for each bindable Inventory field. */
export const INVENTORY_FIELD_VALUE_TYPE: Record<InventoryFieldKey, DataSchemaValueType> = {
  weight: "float",
  maxStack: "int",
  slotSize: "int",
  durability: "int",
  maxDurability: "int",
  volume: "float",
  stackable: "boolean",
  showInShop: "boolean",
  consumable: "boolean",
  discardable: "boolean",
  inventoryCategory: "string",
  bindType: "string",
};

/** All bindable Inventory fields, in display order. */
export const INVENTORY_FIELD_KEYS = Object.keys(INVENTORY_FIELD_VALUE_TYPE) as InventoryFieldKey[];

/**
 * Reads an Inventory field's effective value, typed per `INVENTORY_FIELD_VALUE_TYPE`.
 * Returns `undefined` when the field is absent so callers can fall back.
 */
export function resolveInventoryFieldValue(
  data: InventoryAddonDraft,
  field: InventoryFieldKey
): number | boolean | string | undefined {
  switch (field) {
    case "weight":
      return data.weight;
    case "maxStack":
      return data.maxStack;
    case "slotSize":
      return data.slotSize;
    case "durability":
      return data.durability;
    case "maxDurability":
      return data.maxDurability;
    case "volume":
      return data.volume;
    case "stackable":
      return Boolean(data.stackable);
    case "showInShop":
      return Boolean(data.showInShop);
    case "consumable":
      return Boolean(data.consumable);
    case "discardable":
      return Boolean(data.discardable);
    case "inventoryCategory":
      return data.inventoryCategory ?? "";
    case "bindType":
      return data.bindType ?? "none";
    default:
      return undefined;
  }
}
