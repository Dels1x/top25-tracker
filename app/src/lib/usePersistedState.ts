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
