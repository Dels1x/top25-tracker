import { usePersistedState } from "./usePersistedState";

/**
 * Selection state for the "Weight by length" checkbox - persisted per
 * storage key (same convention as useWeightByRank), default OFF so the
 * leaderboard's familiar flat "1 point per song" counting is what shows up
 * until someone opts into ranking by total listening time instead (see
 * weightByLength in stats.ts).
 */
export function useWeightByLength(storageKey: string) {
  return usePersistedState(`top25tracker:weightByLength:${storageKey}`, false);
}
