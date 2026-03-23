"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

export function blurOnEnterKey(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
}

type UseBlurCommitTextOptions = {
  value: string;
  resetKey: string | number;
  onCommit: (nextValue: string) => void;
};

export function useBlurCommitText({ value, resetKey, onCommit }: UseBlurCommitTextOptions) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value, resetKey]);

  const commitDraft = useCallback(() => {
    if (draft !== value) {
      onCommit(draft);
    }
  }, [draft, onCommit, value]);

  return {
    draft,
    setDraft,
    commitDraft,
  };
}

