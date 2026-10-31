import { useEffect, useRef, useState } from "react";

function readValue<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Like useState, but reads its initial value from localStorage and writes
 * back on every change - for simple per-browser UI preferences (a checkbox,
 * a toggle) that should survive a refresh. Not for anything that needs to be
 * shared across devices/people or read server-side - this is purely a local
 * convenience, wrapped in try/catch since storage can throw or be unavailable
 * (private browsing, blocked site data).
 *
 * A caller can pass a DIFFERENT key on a later render of the same component
 * instance (e.g. a per-person key like `top25tracker:showHalfDecades:${person}`,
 * when the active person changes without the component unmounting) - without
 * re-reading storage for that new key, this would otherwise (a) keep
 * showing the PREVIOUS key's value under the new key's name, and (b) the
 * persist effect below would then write that stale value into the new key,
 * silently overwriting whatever had actually been saved there from an
 * earlier visit. See usePersistedSetState's identical handling for the
 * Set<string> case.
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => readValue(key, defaultValue));
  const lastKeyRef = useRef(key);

  let effectiveValue = value;
  if (lastKeyRef.current !== key) {
    lastKeyRef.current = key;
    effectiveValue = readValue(key, defaultValue);
    setValue(effectiveValue);
  }

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(effectiveValue));
    } catch {
      // ignore (private browsing etc.)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, effectiveValue]);

  return [effectiveValue, setValue] as const;
}

/**
 * Same idea as usePersistedState, but for a Set<string> (JSON has no native
 * Set type, so it round-trips through an array). `defaultValue` is computed
 * lazily since it's often derived from data that isn't ready on first render
 * (e.g. "the top N artists" - the artist list itself has to load first).
 *
 * Some callers (e.g. Timeline's shownEras, keyed by
 * `eraTimelineShown:${eraGranularity}:${person}`) pass a DIFFERENT key on a
 * later render of the same component instance, when the caller switches
 * between genuinely disjoint name spaces (years vs. decades vs.
 * half-decades) rather than unmounting. useState's lazy initializer only
 * ever runs once, on first mount - without this reread-on-key-change
 * handling, switching keys would (a) keep showing the PREVIOUS key's value
 * under the new key's name space (stale/mismatched names), and worse,
 * (b) the persist effect below would then write that stale value into the
 * NEW key, silently corrupting whatever had been saved there from an
 * earlier visit. Tracking the last-seen key and re-reading storage (or
 * falling back to computeDefault) whenever it changes keeps every key
 * logically independent, as if each were its own hook call.
 */
function readSet(key: string, computeDefault: () => string[]): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // fall through to default
  }
  return new Set(computeDefault());
}

export function usePersistedSetState(key: string, computeDefault: () => string[]) {
  const [value, setValue] = useState<Set<string>>(() => readSet(key, computeDefault));
  const lastKeyRef = useRef(key);

  // key changed since the last render (not a fresh mount) - re-read that
  // key's own saved value (or compute its own default) right here, during
  // render, rather than the stale `value` from the PREVIOUS key. React
  // applies a state update made during render immediately, before this
  // render finishes or the persist effect below runs - the sanctioned
  // pattern for "derived state that resets when a prop changes" - so
  // `effectiveValue` is what both this render and the effect below actually
  // use, keeping every distinct key logically independent instead of
  // leaking one key's value into another's storage slot.
  let effectiveValue = value;
  if (lastKeyRef.current !== key) {
    lastKeyRef.current = key;
    effectiveValue = readSet(key, computeDefault);
    setValue(effectiveValue);
  }

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(effectiveValue)));
    } catch {
      // ignore (private browsing etc.)
    }
    // effectiveValue (not the raw `value` state) so this never persists a
    // stale previous-key value into the new key during the render where key
    // just changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, effectiveValue]);

  return [effectiveValue, setValue] as const;
}
