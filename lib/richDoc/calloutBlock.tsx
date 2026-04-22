"use client";

import { createReactBlockSpec } from "@blocknote/react";

/** Variants of the callout block — ordered so they render in this
 *  sequence in the slash menu too. `id` is stored on the block's props
 *  and used as the `data-variant` attribute that CSS keys off of.
 *  `defaultTitle` / `defaultSubtext` are the English fallbacks; the
 *  actual slash-menu copy comes from the app's i18n dictionary under
 *  `richDocAddon.slashMenu.callout.<id>.title/subtext`. */
export type CalloutVariantId = "note" | "warning" | "design-decision" | "balance-note";

export interface CalloutVariant {
  id: CalloutVariantId;
  icon: string;
  defaultTitle: string;
  defaultSubtext: string;
  aliases: string[];
}

export const CALLOUT_VARIANTS: CalloutVariant[] = [
  {
    id: "note",
    icon: "💡",
    defaultTitle: "Note",
    defaultSubtext: "General info or annotation",
    aliases: ["note", "info", "nota", "info-box", "callout"],
  },
  {
    id: "warning",
    icon: "⚠️",
    defaultTitle: "Warning",
    defaultSubtext: "Caution, gotcha, or risk to flag",
    aliases: ["warning", "warn", "aviso", "atencao", "caution", "gotcha"],
  },
  {
    id: "design-decision",
    icon: "🎯",
    defaultTitle: "Design decision",
    defaultSubtext: "A documented call — why we chose this",
    aliases: [
      "design",
      "design-decision",
      "decision",
      "decisao",
      "adr",
      "rationale",
    ],
  },
  {
    id: "balance-note",
    icon: "⚖️",
    defaultTitle: "Balance note",
    defaultSubtext: "Playtesting observation or balance concern",
    aliases: [
      "balance",
      "balance-note",
      "balanceamento",
      "playtest",
      "tuning",
      "calibration",
    ],
  },
];

const VARIANT_BY_ID: Record<CalloutVariantId, CalloutVariant> = Object.fromEntries(
  CALLOUT_VARIANTS.map((v) => [v.id, v]),
) as Record<CalloutVariantId, CalloutVariant>;

function resolveVariant(id: unknown): CalloutVariant {
  if (typeof id === "string" && id in VARIANT_BY_ID) {
    return VARIANT_BY_ID[id as CalloutVariantId];
  }
  return CALLOUT_VARIANTS[0];
}

export const CalloutBlock = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      variant: {
        default: "note" as const,
        values: ["note", "warning", "design-decision", "balance-note"] as const,
      },
    },
    content: "inline",
  },
  {
    render: ({ block, contentRef }) => {
      const variant = resolveVariant((block.props as { variant?: string }).variant);
      return (
        <div className="rich-doc-callout" data-variant={variant.id}>
          <span className="rich-doc-callout-icon" aria-hidden="true">
            {variant.icon}
          </span>
          <div className="rich-doc-callout-content" ref={contentRef} />
        </div>
      );
    },
  },
);
