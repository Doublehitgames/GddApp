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
 * Base, Mín and Máx are always three separate fields in the data model.
 * When the toggle is open, both Mín and Máx are always visible.
 *
 * The base field supports FieldBindingPicker (progressionColumn + sheets).
 * Mín and Máx support sheets-only binding when limitMinBinding /
 * limitMaxBinding props are provided.
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
  readOnly?: boolean;

  // ── Limites toggle ────────────────────────────────────────────────────────
  limitMin?: number;
  onLimitMinChange: (next: number | undefined) => void;
  limitMinBinding?: FieldBinding;
  onLimitMinBindingChange?: (b: FieldBinding) => void;

  limitMax?: number;
  onLimitMaxChange: (next: number | undefined) => void;
  limitMaxBinding?: FieldBinding;
  onLimitMaxBindingChange?: (b: FieldBinding) => void;

  onLimitsClear: () => void;

  /** Override the toggle section label. Default: "Limites". */
  limitsLabel?: string;
  /** Label for the Mín input. Default: "Mín". */
  minLabel?: string;
  /** Label for the Máx input. Default: "Máx". */
  maxLabel?: string;

  // ── Optional FieldBindingPicker for the base field ────────────────────────
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
  limitMinBinding,
  onLimitMinBindingChange,
  limitMax,
  onLimitMaxChange,
  limitMaxBinding,
  onLimitMaxBindingChange,
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

  const hasLimitMinBinding = limitMinBinding !== undefined && limitMinBinding.source !== "manual";
  const hasLimitMaxBinding = limitMaxBinding !== undefined && limitMaxBinding.source !== "manual";

  // ── Base field row ────────────────────────────────────────────────────────

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

  // ── Limit fields (Mín / Máx) ──────────────────────────────────────────────

  const minInput = (
    <CommitOptionalNumberInput
      value={limitMin}
      onCommit={onLimitMinChange}
      min={0}
      step={step}
      integer={integer}
      className={inputClassName}
      readOnly={hasLimitMinBinding && limitMinBinding!.source === "sheets"}
    />
  );

  const maxInput = (
    <CommitOptionalNumberInput
      value={limitMax}
      onCommit={onLimitMaxChange}
      min={0}
      step={step}
      integer={integer}
      className={inputClassName}
      readOnly={hasLimitMaxBinding && limitMaxBinding!.source === "sheets"}
    />
  );

  const minField =
    onLimitMinBindingChange && bindingContext ? (
      <FieldBindingPicker
        config={{ valueType: "number", acceptedSources: ["sheets"], label: minLabel }}
        value={limitMinBinding ?? MANUAL_BINDING}
        onChange={onLimitMinBindingChange}
        context={bindingContext}
      >
        {minInput}
      </FieldBindingPicker>
    ) : (
      <label className="block">
        <span className="mb-1 block text-xs text-gray-400">{minLabel}</span>
        {minInput}
      </label>
    );

  const maxField =
    onLimitMaxBindingChange && bindingContext ? (
      <FieldBindingPicker
        config={{ valueType: "number", acceptedSources: ["sheets"], label: maxLabel }}
        value={limitMaxBinding ?? MANUAL_BINDING}
        onChange={onLimitMaxBindingChange}
        context={bindingContext}
      >
        {maxInput}
      </FieldBindingPicker>
    ) : (
      <label className="block">
        <span className="mb-1 block text-xs text-gray-400">{maxLabel}</span>
        {maxInput}
      </label>
    );

  return (
    <div>
      {fieldRow}
      <NumericLimitsToggle
        hasData={limitMin != null || limitMax != null || hasLimitMinBinding || hasLimitMaxBinding}
        onClear={onLimitsClear}
        label={limitsLabel}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {minField}
          {maxField}
        </div>
      </NumericLimitsToggle>
    </div>
  );
}
