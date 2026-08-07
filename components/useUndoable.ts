"use client";

import { useCallback, useRef, useState } from "react";

const COALESCE_MS = 700;
const LIMIT = 60;

export function useUndoable<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const valueRef = useRef<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastKey = useRef<string | null>(null);
  const lastAt = useRef(0);

  const commit = useCallback((next: T) => {
    valueRef.current = next;
    setValue(next);
  }, []);

  const update = useCallback(
    (next: T | ((prev: T) => T), coalesce?: string) => {
      const prev = valueRef.current;
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (Object.is(resolved, prev)) return;

      const now = Date.now();
      const merges =
        coalesce !== undefined &&
        coalesce === lastKey.current &&
        now - lastAt.current < COALESCE_MS &&
        past.current.length > 0;

      if (!merges) {
        past.current.push(prev);
        if (past.current.length > LIMIT) past.current.shift();
      }

      lastKey.current = coalesce ?? null;
      lastAt.current = now;
      future.current = [];
      commit(resolved);
    },
    [commit],
  );

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (previous === undefined) return;
    future.current.push(valueRef.current);
    lastKey.current = null;
    commit(previous);
  }, [commit]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(valueRef.current);
    lastKey.current = null;
    commit(next);
  }, [commit]);

  const reset = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function"
          ? (next as (p: T) => T)(valueRef.current)
          : next;
      past.current = [];
      future.current = [];
      lastKey.current = null;
      commit(resolved);
    },
    [commit],
  );

  return {
    value,
    update,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
