"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";

const DEFAULT_INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";

type SharedInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "onBlur" | "onKeyDown" | "type" | "min" | "max" | "step"
>;

type CommitTextInputProps = SharedInputProps & {
  value: string;
  onCommit: (next: string) => void;
  transform?: (raw: string) => string;
  selectOnFocus?: boolean;
};

export function CommitTextInput({
  value,
  onCommit,
  transform,
  selectOnFocus,
  className,
  onFocus,
  ...rest
}: CommitTextInputProps) {
  const [draft, setDraft] = useState(value);
  const committedRef = useRef(value);

  useEffect(() => {
    setDraft(value);
    committedRef.current = value;
  }, [value]);

  const handleBlur = useCallback(() => {
    const next = transform ? transform(draft) : draft;
    if (next !== committedRef.current) {
      committedRef.current = next;
      onCommit(next);
    }
    if (next !== draft) {
      setDraft(next);
    }
  }, [draft, onCommit, transform]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(committedRef.current);
      event.currentTarget.blur();
    }
  }, []);

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (selectOnFocus) event.currentTarget.select();
      onFocus?.(event);
    },
    [onFocus, selectOnFocus]
  );

  return (
    <input
      type="text"
      value={draft}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.currentTarget.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      className={className ?? DEFAULT_INPUT_CLASS}
      {...rest}
    />
  );
}

type CommitNumberInputProps = SharedInputProps & {
  value: number;
  onCommit: (next: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  integer?: boolean;
  allowNaNFallback?: number;
  parse?: (raw: string, previous: number) => number;
  selectOnFocus?: boolean;
};

function clampNumber(value: number, min?: number, max?: number): number {
  let next = value;
  if (typeof min === "number" && Number.isFinite(min)) next = Math.max(min, next);
  if (typeof max === "number" && Number.isFinite(max)) next = Math.min(max, next);
  return next;
}

function defaultNumberParse(raw: string, previous: number): number {
  const trimmed = raw.trim();
  if (trimmed === "") return previous;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : previous;
}

export function CommitNumberInput({
  value,
  onCommit,
  min,
  max,
  step,
  integer,
  parse,
  allowNaNFallback,
  selectOnFocus,
  className,
  onFocus,
  ...rest
}: CommitNumberInputProps) {
  const initialDraft = Number.isFinite(value) ? String(value) : "";
  const [draft, setDraft] = useState<string>(initialDraft);
  const committedRef = useRef<number>(value);

  useEffect(() => {
    committedRef.current = value;
    setDraft(Number.isFinite(value) ? String(value) : "");
  }, [value]);

  const handleBlur = useCallback(() => {
    const fallback = Number.isFinite(committedRef.current)
      ? committedRef.current
      : allowNaNFallback ?? 0;
    const parser = parse ?? defaultNumberParse;
    let parsed = parser(draft, fallback);
    if (!Number.isFinite(parsed)) parsed = fallback;
    if (integer) parsed = Math.trunc(parsed);
    const clamped = clampNumber(parsed, min, max);

    if (clamped !== committedRef.current) {
      committedRef.current = clamped;
      onCommit(clamped);
    }
    setDraft(String(clamped));
  }, [draft, onCommit, parse, min, max, integer, allowNaNFallback]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(String(committedRef.current));
      event.currentTarget.blur();
    }
  }, []);

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (selectOnFocus) event.currentTarget.select();
      onFocus?.(event);
    },
    [onFocus, selectOnFocus]
  );

  return (
    <input
      type="number"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.currentTarget.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      className={className ?? DEFAULT_INPUT_CLASS}
      {...rest}
    />
  );
}

type CommitOptionalNumberInputProps = SharedInputProps & {
  value: number | null | undefined;
  onCommit: (next: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number | string;
  integer?: boolean;
  parse?: (raw: string, previous: number | undefined) => number | undefined;
  selectOnFocus?: boolean;
};

function defaultOptionalParse(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function CommitOptionalNumberInput({
  value,
  onCommit,
  min,
  max,
  step,
  integer,
  parse,
  selectOnFocus,
  className,
  onFocus,
  ...rest
}: CommitOptionalNumberInputProps) {
  const initialDraft = typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  const [draft, setDraft] = useState<string>(initialDraft);
  const committedRef = useRef<number | undefined>(
    typeof value === "number" && Number.isFinite(value) ? value : undefined
  );

  useEffect(() => {
    const normalized = typeof value === "number" && Number.isFinite(value) ? value : undefined;
    committedRef.current = normalized;
    setDraft(normalized === undefined ? "" : String(normalized));
  }, [value]);

  const handleBlur = useCallback(() => {
    const parser = parse ?? defaultOptionalParse;
    let parsed = parser(draft, committedRef.current);
    if (parsed !== undefined) {
      if (!Number.isFinite(parsed)) parsed = undefined;
      else {
        if (integer) parsed = Math.trunc(parsed);
        parsed = clampNumber(parsed, min, max);
      }
    }
    if (parsed !== committedRef.current) {
      committedRef.current = parsed;
      onCommit(parsed);
    }
    setDraft(parsed === undefined ? "" : String(parsed));
  }, [draft, onCommit, parse, min, max, integer]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(committedRef.current === undefined ? "" : String(committedRef.current));
      event.currentTarget.blur();
    }
  }, []);

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (selectOnFocus) event.currentTarget.select();
      onFocus?.(event);
    },
    [onFocus, selectOnFocus]
  );

  return (
    <input
      type="number"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.currentTarget.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      className={className ?? DEFAULT_INPUT_CLASS}
      {...rest}
    />
  );
}

type CommitTextareaProps = Omit<
  InputHTMLAttributes<HTMLTextAreaElement>,
  "value" | "defaultValue" | "onChange" | "onBlur" | "onKeyDown"
> & {
  value: string;
  onCommit: (next: string) => void;
  transform?: (raw: string) => string;
  rows?: number;
};

export function CommitTextarea({
  value,
  onCommit,
  transform,
  className,
  ...rest
}: CommitTextareaProps) {
  const [draft, setDraft] = useState(value);
  const committedRef = useRef(value);

  useEffect(() => {
    setDraft(value);
    committedRef.current = value;
  }, [value]);

  const handleBlur = useCallback(() => {
    const next = transform ? transform(draft) : draft;
    if (next !== committedRef.current) {
      committedRef.current = next;
      onCommit(next);
    }
    if (next !== draft) setDraft(next);
  }, [draft, onCommit, transform]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(committedRef.current);
      event.currentTarget.blur();
    }
  }, []);

  return (
    <textarea
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className ?? DEFAULT_INPUT_CLASS}
      {...(rest as InputHTMLAttributes<HTMLTextAreaElement>)}
    />
  );
}
