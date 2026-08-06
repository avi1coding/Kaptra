"use client";

import { useCallback, useRef, useState } from "react";

/** How long two edits to the same control count as one undo step. */
const COALESCE_MS = 700;
const LIMIT = 60;

/**
 * Undo/redo over a single document value.
 *
 * The wrinkle is continuous controls: dragging a caption or sweeping a slider
 * fires dozens of updates a second, and pushing each one would mean dozens of
 * undos to get back across a single gesture. Callers pass a `coalesce` key —
 * consecutive edits sharing that key inside a short window replace the top of
 * the stack instead of stacking up, so one gesture is one undo.
 *
 * All history bookkeeping happens *outside* setState. React invokes state
 * updaters twice under StrictMode, so mutating the stacks inside one pushed
 * every entry twice and left undo restoring the value it had just replaced.
 * `valueRef` mirrors the committed value so the next state can be computed
 * without an updater at all.
 */
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

      // A merged edit keeps the snapshot already on the stack — that's the
      // state from *before* the gesture started, which is what undo wants.
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

  /** Replace the value and drop the history — for loading a new document. */
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
