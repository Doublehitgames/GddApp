import type { CropAddonDraft, CropFieldKey } from "@/lib/addons/types";

/**
 * Resolves the numeric value of a Crop addon field. Shared by the DataSchema
 * editor preview and the Remote Config (exportSchema) resolver so both read the
 * same value. `outputId` is required for the `output*` fields — it selects which
 * harvest output row is read.
 */
export function resolveCropFieldValue(
  data: CropAddonDraft,
  field: CropFieldKey,
  outputId?: string
): number | undefined {
  switch (field) {
    case "growthSeconds":
      return data.growthSeconds;
    case "growthSecondsMin":
      return data.growthSecondsMin;
    case "growthSecondsMax":
      return data.growthSecondsMax;
    case "totalHarvest":
      return data.totalHarvest;
    case "totalHarvestMin":
      return data.totalHarvestMin;
    case "totalHarvestMax":
      return data.totalHarvestMax;
    case "seedQuantity":
      return data.seedQuantity;
    case "seedQuantityMin":
      return data.seedQuantityMin;
    case "seedQuantityMax":
      return data.seedQuantityMax;
    case "plantEnergy":
      return data.plantEnergy;
    case "plantEnergyMin":
      return data.plantEnergyMin;
    case "plantEnergyMax":
      return data.plantEnergyMax;
    case "plantXp":
      return data.plantXp?.xp;
    case "harvestXp":
      return data.harvestXp?.xp;
    case "outputQuantity":
    case "outputQuantityMin":
    case "outputQuantityMax": {
      const output = (data.outputs || []).find((o) => o.id === outputId);
      if (!output) return undefined;
      if (field === "outputQuantity") return output.quantity;
      if (field === "outputQuantityMin") return output.quantityMin;
      return output.quantityMax;
    }
    default:
      return undefined;
  }
}
