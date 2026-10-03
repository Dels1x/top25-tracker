import { useEffect, useState } from "react";

/**
 * Like useState, but reads its initial value from localStorage and writes
 * back on every change - for simple per-browser UI preferences (a checkbox,
 * a toggle) that should survive a refresh. Not for anything that needs to be
 * shared across devices/people or read server-side - this is purely a local
 * convenience, wrapped in try/catch since storage can throw or be unavailable
 * (private browsing, blocked site data).
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore (private browsing etc.)
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/**
 * Same idea as usePersistedState, but for a Set<string> (JSON has no native
 * Set type, so it round-trips through an array). `defaultValue` is computed
 * lazily since it's often derived from data that isn't ready on first render
 * (e.g. "the top N artists" - the artist list itself has to load first).
 */
export function usePersistedSetState(key: string, computeDefault: () => string[]) {
  const [value, setValue] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // fall through to default
    }
    return new Set(computeDefault());
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(value)));
    } catch {
      // ignore (private browsing etc.)
    }
  }, [key, value]);

  return [value, setValue] as const;
}
