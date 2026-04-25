import {
  buildSectionLookup,
  resolveExportSchema,
} from "@/lib/addons/exportSchemaResolver";
import type {
  AttributeDefinitionsSectionAddon,
  AttributeModifiersSectionAddon,
  ExportSchemaNode,
  SectionAddon,
  SkillsSectionAddon,
} from "@/lib/addons/types";

// ── Fixtures ─────────────────────────────────────────────────────────
//
// Three sections, each with ONE addon:
//   • SEC_DEFS  — AttributeDefinitions (defines the "hp" attribute key).
//   • SEC_MODS  — AttributeModifiers   (definitionsRef → SEC_DEFS).
//                Two entries: a burst (-10 hp instant, stack) and a
//                DoT       (-1 hp/s for 10s, unique).
//   • SEC_SKILL — Skills                (1 skill referencing both modifier
//                                        entries as effects).
//
// dataId values are what the `resolved.definitionsRef` /
// `attributeModifiersSectionId` bindings should ultimately surface.

const SEC_DEFS_ID = "sec-defs";
const SEC_DEFS_DATA_ID = "DATA_BASIC_ATTR";
const SEC_MODS_ID = "sec-mods";
const SEC_MODS_DATA_ID = "DATA_FIRE_MODS";
const SEC_SKILL_ID = "sec-skill";
const SEC_SKILL_DATA_ID = "DATA_FIRE_BALL";

const ADDON_DEFS_ID = "addon-defs";
const ADDON_MODS_ID = "addon-mods";
const ADDON_SKILLS_ID = "addon-skills";

const ENTRY_BURST_ID = "mod-burst";
const ENTRY_DOT_ID = "mod-dot";
const SKILL_ID = "skill-fireball";
const EFFECT_BURST_ID = "eff-burst";
const EFFECT_DOT_ID = "eff-dot";

const definitionsAddon: AttributeDefinitionsSectionAddon = {
  id: ADDON_DEFS_ID,
  type: "attributeDefinitions",
  name: "Basic Attributes",
  data: {
    id: ADDON_DEFS_ID,
    name: "Basic Attributes",
    attributes: [
      {
        id: "attr-hp",
        key: "hp",
        label: "HP",
        valueType: "int",
        defaultValue: 100,
      },
    ],
  },
};

const modifiersAddon: AttributeModifiersSectionAddon = {
  id: ADDON_MODS_ID,
  type: "attributeModifiers",
  name: "Fire Modifiers",
  data: {
    id: ADDON_MODS_ID,
    name: "Fire Modifiers",
    definitionsRef: SEC_DEFS_ID, // → resolves to SEC_DEFS_DATA_ID via lookup
    modifiers: [
      {
        id: ENTRY_BURST_ID,
        name: "HP Damage Impact",
        attributeKey: "hp",
        mode: "add",
        value: -10,
        stackingRule: "stack",
        // No `temporary` → instantaneous decrement.
      },
      {
        id: ENTRY_DOT_ID,
        name: "HP Damage Interval",
        attributeKey: "hp",
        mode: "add",
        value: -1,
        temporary: true,
        durationSeconds: 10,
        tickIntervalSeconds: 1,
        stackingRule: "unique",
      },
    ],
  },
};

const skillsAddon: SkillsSectionAddon = {
  id: ADDON_SKILLS_ID,
  type: "skills",
  name: "Spells",
  data: {
    id: ADDON_SKILLS_ID,
    name: "Spells",
    entries: [
      {
        id: SKILL_ID,
        name: "Fireball",
        kind: "active",
        cooldownSeconds: 1,
        effects: [
          {
            id: EFFECT_BURST_ID,
            attributeModifiersSectionId: SEC_MODS_ID,
            attributeModifiersAddonId: ADDON_MODS_ID,
            modifierEntryId: ENTRY_BURST_ID,
          },
          {
            id: EFFECT_DOT_ID,
            attributeModifiersSectionId: SEC_MODS_ID,
            attributeModifiersAddonId: ADDON_MODS_ID,
            modifierEntryId: ENTRY_DOT_ID,
          },
        ],
      },
    ],
  },
};

// `sectionAddons` is what the resolver gets from the host section's local
// scope (the page where the ExportSchema lives). For Skills export the
// host is the same page as the Skills addon, so we include it here.
const sectionAddons: SectionAddon[] = [skillsAddon];

// `sectionLookup` is project-wide — needed to follow cross-section refs
// (effect → modifier section → definitions section → dataId chain).
const sectionLookup = buildSectionLookup([
  {
    sections: [
      { id: SEC_DEFS_ID, dataId: SEC_DEFS_DATA_ID, addons: [definitionsAddon] },
      { id: SEC_MODS_ID, dataId: SEC_MODS_DATA_ID, addons: [modifiersAddon] },
      { id: SEC_SKILL_ID, dataId: SEC_SKILL_DATA_ID, addons: [skillsAddon] },
    ],
  },
]);

// ── Schema: skills[].effects[] ───────────────────────────────────────
//
// Outer array iterates Skills entries. Inner array iterates each skill's
// effects. The inner item template binds every `resolved*` field we expose
// through `skillEffectField`.

const schemaNodes: ExportSchemaNode[] = [
  {
    id: "n-skills",
    key: "Skill",
    nodeType: "array",
    arraySource: { type: "skills", addonId: ADDON_SKILLS_ID },
    itemTemplate: [
      {
        id: "n-name",
        key: "name",
        nodeType: "value",
        binding: { source: "skillField", field: "name" },
      },
      {
        id: "n-cooldown",
        key: "cooldown",
        nodeType: "value",
        binding: { source: "skillField", field: "cooldownSeconds" },
      },
      {
        id: "n-effects",
        key: "effect",
        nodeType: "array",
        arraySource: { type: "skillEffects" },
        itemTemplate: [
          {
            id: "n-eff-defref",
            key: "attr_id",
            nodeType: "value",
            binding: { source: "skillEffectField", field: "resolvedDefinitionsRef" },
          },
          {
            id: "n-eff-key",
            key: "attr_key",
            nodeType: "value",
            binding: { source: "skillEffectField", field: "resolvedAttributeKey" },
          },
          {
            id: "n-eff-name",
            key: "attr_name",
            nodeType: "value",
            binding: { source: "skillEffectField", field: "resolvedName" },
          },
          {
            id: "n-eff-mode",
            key: "attr_mode",
            nodeType: "value",
            binding: { source: "skillEffectField", field: "resolvedMode" },
          },
          {
            id: "n-eff-value",
            key: "attr_value",
            nodeType: "value",
            binding: { source: "skillEffectField", field: "resolvedValue" },
          },
          {
            id: "n-eff-temp",
            key: "attr_temporary",
            nodeType: "value",
            binding: { source: "skillEffectField", field: "resolvedTemporary" },
          },
          {
            id: "n-eff-dur",
            key: "attr_duration",
            nodeType: "value",
            binding: { source: "skillEffectField", field: "resolvedDurationSeconds" },
          },
          {
            id: "n-eff-tick",
            key: "attr_tick",
            nodeType: "value",
            binding: { source: "skillEffectField", field: "resolvedTickIntervalSeconds" },
          },
          {
            id: "n-eff-stack",
            key: "attr_stack",
            nodeType: "value",
            binding: { source: "skillEffectField", field: "resolvedStacking" },
          },
        ],
      },
    ],
  },
];

// ── Tests ────────────────────────────────────────────────────────────

describe("resolveExportSchema — skillEffects nested iteration", () => {
  it("emits one row per effect with every resolved* field populated", () => {
    const out = resolveExportSchema(
      schemaNodes,
      sectionAddons,
      undefined,
      "rowMajor",
      sectionLookup
    );

    expect(out).toEqual({
      Skill: [
        {
          name: "Fireball",
          cooldown: 1,
          effect: [
            {
              attr_id: SEC_DEFS_DATA_ID, // ← cross-section ref to AttributeDefinitions
              attr_key: "hp",
              attr_name: "HP Damage Impact",
              attr_mode: "add",
              attr_value: -10,
              attr_temporary: false, // burst — modifier has no `temporary: true`
              attr_duration: 0,
              attr_tick: 0,
              attr_stack: "stack",
            },
            {
              attr_id: SEC_DEFS_DATA_ID,
              attr_key: "hp",
              attr_name: "HP Damage Interval",
              attr_mode: "add",
              attr_value: -1,
              attr_temporary: true,
              attr_duration: 10,
              attr_tick: 1,
              attr_stack: "unique",
            },
          ],
        },
      ],
    });
  });

  it("resolvedDefinitionsRef returns empty string when the modifiers addon has no definitionsRef", () => {
    // Same fixtures, but strip the definitionsRef from the modifiers addon.
    const noDefsRefModifiers: AttributeModifiersSectionAddon = {
      ...modifiersAddon,
      data: { ...modifiersAddon.data, definitionsRef: undefined },
    };
    const localLookup = buildSectionLookup([
      {
        sections: [
          { id: SEC_DEFS_ID, dataId: SEC_DEFS_DATA_ID, addons: [definitionsAddon] },
          { id: SEC_MODS_ID, dataId: SEC_MODS_DATA_ID, addons: [noDefsRefModifiers] },
          { id: SEC_SKILL_ID, dataId: SEC_SKILL_DATA_ID, addons: [skillsAddon] },
        ],
      },
    ]);

    const out = resolveExportSchema(schemaNodes, sectionAddons, undefined, "rowMajor", localLookup) as {
      Skill: Array<{ effect: Array<{ attr_id: string }> }>;
    };

    // Every effect now reports an empty attr_id, but the rest of the
    // fields (attr_key, attr_value, …) keep resolving normally.
    expect(out.Skill[0].effect.every((e) => e.attr_id === "")).toBe(true);
  });

  it("resolvedStacking returns empty string when the source modifier has no stackingRule", () => {
    const looseModifiers: AttributeModifiersSectionAddon = {
      ...modifiersAddon,
      data: {
        ...modifiersAddon.data,
        modifiers: modifiersAddon.data.modifiers.map((m) => ({ ...m, stackingRule: undefined })),
      },
    };
    const localLookup = buildSectionLookup([
      {
        sections: [
          { id: SEC_DEFS_ID, dataId: SEC_DEFS_DATA_ID, addons: [definitionsAddon] },
          { id: SEC_MODS_ID, dataId: SEC_MODS_DATA_ID, addons: [looseModifiers] },
          { id: SEC_SKILL_ID, dataId: SEC_SKILL_DATA_ID, addons: [skillsAddon] },
        ],
      },
    ]);

    const out = resolveExportSchema(schemaNodes, sectionAddons, undefined, "rowMajor", localLookup) as {
      Skill: Array<{ effect: Array<{ attr_stack: string }> }>;
    };

    expect(out.Skill[0].effect.map((e) => e.attr_stack)).toEqual(["", ""]);
  });

  it("resolvedName falls back to empty when the modifier entry didn't set a display name", () => {
    const unnamedModifiers: AttributeModifiersSectionAddon = {
      ...modifiersAddon,
      data: {
        ...modifiersAddon.data,
        modifiers: modifiersAddon.data.modifiers.map((m) => ({ ...m, name: undefined })),
      },
    };
    const localLookup = buildSectionLookup([
      {
        sections: [
          { id: SEC_DEFS_ID, dataId: SEC_DEFS_DATA_ID, addons: [definitionsAddon] },
          { id: SEC_MODS_ID, dataId: SEC_MODS_DATA_ID, addons: [unnamedModifiers] },
          { id: SEC_SKILL_ID, dataId: SEC_SKILL_DATA_ID, addons: [skillsAddon] },
        ],
      },
    ]);

    const out = resolveExportSchema(schemaNodes, sectionAddons, undefined, "rowMajor", localLookup) as {
      Skill: Array<{ effect: Array<{ attr_name: string }> }>;
    };

    expect(out.Skill[0].effect.map((e) => e.attr_name)).toEqual(["", ""]);
  });

  it("returns empty effect array when the source skill has no effects", () => {
    const skillsNoEffects: SkillsSectionAddon = {
      ...skillsAddon,
      data: {
        ...skillsAddon.data,
        entries: skillsAddon.data.entries.map((e) => ({ ...e, effects: undefined })),
      },
    };
    const localLookup = buildSectionLookup([
      {
        sections: [
          { id: SEC_DEFS_ID, dataId: SEC_DEFS_DATA_ID, addons: [definitionsAddon] },
          { id: SEC_MODS_ID, dataId: SEC_MODS_DATA_ID, addons: [modifiersAddon] },
          { id: SEC_SKILL_ID, dataId: SEC_SKILL_DATA_ID, addons: [skillsNoEffects] },
        ],
      },
    ]);

    const out = resolveExportSchema(
      schemaNodes,
      [skillsNoEffects],
      undefined,
      "rowMajor",
      localLookup
    ) as { Skill: Array<{ effect: unknown[] }> };

    expect(out.Skill[0].effect).toEqual([]);
  });

  it("falls back to default scalars when the effect ref points at a missing modifier entry", () => {
    // Effect points at an entry id that doesn't exist in the modifiers addon.
    // The resolver should yield safe defaults instead of throwing.
    const skillsBrokenRef: SkillsSectionAddon = {
      ...skillsAddon,
      data: {
        ...skillsAddon.data,
        entries: [
          {
            ...skillsAddon.data.entries[0],
            effects: [
              {
                id: "eff-broken",
                attributeModifiersSectionId: SEC_MODS_ID,
                attributeModifiersAddonId: ADDON_MODS_ID,
                modifierEntryId: "does-not-exist",
              },
            ],
          },
        ],
      },
    };
    const localLookup = buildSectionLookup([
      {
        sections: [
          { id: SEC_DEFS_ID, dataId: SEC_DEFS_DATA_ID, addons: [definitionsAddon] },
          { id: SEC_MODS_ID, dataId: SEC_MODS_DATA_ID, addons: [modifiersAddon] },
          { id: SEC_SKILL_ID, dataId: SEC_SKILL_DATA_ID, addons: [skillsBrokenRef] },
        ],
      },
    ]);

    const out = resolveExportSchema(
      schemaNodes,
      [skillsBrokenRef],
      undefined,
      "rowMajor",
      localLookup
    ) as { Skill: Array<{ effect: Array<Record<string, unknown>> }> };

    const broken = out.Skill[0].effect[0];
    // The effect ref's own fields stay populated (they don't depend on
    // resolution), but every `resolved*` field falls back to its scalar
    // default. attr_id still resolves because it's read from the parent
    // modifier addon's definitionsRef, which exists.
    expect(broken.attr_id).toBe(SEC_DEFS_DATA_ID);
    expect(broken.attr_key).toBe("");
    expect(broken.attr_name).toBe("");
    expect(broken.attr_mode).toBe("");
    expect(broken.attr_value).toBe(0);
    expect(broken.attr_temporary).toBe(false);
    expect(broken.attr_duration).toBe(0);
    expect(broken.attr_tick).toBe(0);
    expect(broken.attr_stack).toBe("");
  });
});
