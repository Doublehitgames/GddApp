"use client";

import type { ReactNode } from "react";
import { CommitOptionalNumberInput } from "@/components/common/CommitInput";
import { FieldBindingPicker } from "@/components/common/FieldBindingPicker";
import { NumericLimitsToggle } from "@/components/common/NumericLimitsToggle";
import {
  MANUAL_BINDING,
  type FieldBinding,
  type FieldBindingPickerContext,
} from "@/lib/addons/fieldBinding";

/**
 * Standard bounded numeric field:
 *   [label]  [optional binding chip]
 *   [main input]
 *   ── Limites ── [OFF/ON]
 *     Mín [input]   Máx [input]
 *
 * If `binding` + `onBindingChange` + `acceptedSources` + `bindingContext` are
 * all provided, the main input is wrapped inside a FieldBindingPicker.
 * Otherwise just the label + plain input are rendered.
 *
 * The Mín / Máx inputs inside the toggle are ALWAYS plain — never bound.
 */

const DEFAULT_INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";

interface BoundedNumericFieldProps {
  // ── Label ─────────────────────────────────────────────────────────────────
  label: string;
  hint?: string;

  // ── Main value ────────────────────────────────────────────────────────────
  value?: number;
  onValueChange: (next: number | undefined) => void;
  /** Makes the main input read-only (e.g. when source is "sheets"). */
  readOnly?: boolean;

  // ── Limites toggle ────────────────────────────────────────────────────────
  /**
   * Value for the Mín input inside the toggle.
   * Pass `undefined` to hide the Mín field (toggle shows Máx only).
   * Note: for fields where the main value IS the minimum (e.g. "Quantidade"),
   * pass `limitMin={limitMax != null ? value : undefined}` so the toggle only
   * opens when a max has been set.
   */
  limitMin?: number;
  onLimitMinChange: (next: number | undefined) => void;
  limitMax?: number;
  onLimitMaxChange: (next: number | undefined) => void;
  /**
   * Called when the user turns Limites off.
   * Must clear limitMin, limitMax and any related bindings.
   */
  onLimitsClear: () => void;

  /** Override the toggle section label. Default: "Limites". */
  limitsLabel?: string;
  /** Label for the Mín input. Default: "Mín". */
  minLabel?: string;
  /** Label for the Máx input. Default: "Máx". */
  maxLabel?: string;

  // ── Optional FieldBindingPicker ───────────────────────────────────────────
  binding?: FieldBinding;
  onBindingChange?: (b: FieldBinding) => void;
  acceptedSources?: FieldBinding["source"][];
  bindingContext?: FieldBindingPickerContext;
  /** Level-simulation badges rendered below the main row. */
  badges?: ReactNode;

  // ── Input constraints ─────────────────────────────────────────────────────
  step?: number;
  integer?: boolean;
  inputClassName?: string;
}

export function BoundedNumericField({
  label,
  hint,
  value,
  onValueChange,
  readOnly,
  limitMin,
  onLimitMinChange,
  limitMax,
  onLimitMaxChange,
  onLimitsClear,
  limitsLabel,
  minLabel = "Mín",
  maxLabel = "Máx",
  binding,
  onBindingChange,
  acceptedSources,
  bindingContext,
  badges,
  step = 1,
  integer,
  inputClassName = DEFAULT_INPUT_CLASS,
}: BoundedNumericFieldProps) {
  const hasBinding =
    binding !== undefined &&
    onBindingChange !== undefined &&
    acceptedSources !== undefined &&
    bindingContext !== undefined;

  const isReadOnly = readOnly || (hasBinding && binding?.source === "sheets");

  const mainInput = (
    <CommitOptionalNumberInput
      value={value}
      onCommit={onValueChange}
      min={0}
      step={step}
      integer={integer}
      className={inputClassName}
      readOnly={isReadOnly}
    />
  );

  const fieldRow = hasBinding ? (
    <FieldBindingPicker
      config={{ valueType: "number", acceptedSources: acceptedSources!, label, hint }}
      value={binding ?? MANUAL_BINDING}
      onChange={onBindingChange!}
      context={bindingContext!}
      badges={badges}
    >
      {mainInput}
    </FieldBindingPicker>
  ) : (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-gray-400">{label}</span>
        {hint ? <span className="text-[10px] text-gray-500">{hint}</span> : null}
      </div>
      {mainInput}
      {badges}
    </div>
  );

  const showMin = limitMin !== undefined;

  return (
    <div>
      {fieldRow}
      <NumericLimitsToggle
        hasData={limitMin != null || limitMax != null}
        onClear={onLimitsClear}
        label={limitsLabel}
      >
        <div className={`grid gap-2 ${showMin ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
          {showMin && (
            <label className="block">
              <span className="mb-1 block text-xs text-gray-400">{minLabel}</span>
              <CommitOptionalNumberInput
                value={limitMin}
                onCommit={onLimitMinChange}
                min={0}
                step={step}
                integer={integer}
                className={inputClassName}
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">{maxLabel}</span>
            <CommitOptionalNumberInput
              value={limitMax}
              onCommit={onLimitMaxChange}
              min={0}
              step={step}
              integer={integer}
              className={inputClassName}
            />
          </label>
        </div>
      </NumericLimitsToggle>
    </div>
  );
}
