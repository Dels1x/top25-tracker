import { usePersistedState } from "./usePersistedState";

/**
 * Selection state for the Leaderboard's "Weight by placement" checkbox -
 * persisted per person (same convention as useRankFilter/useGenreFilter),
 * default OFF so the leaderboard's familiar flat "1 point per song" counting
 * is what shows up until someone opts into the placement-weighted curve
 * (see rankPoints in stats.ts).
 */
export function useWeightByRank(storageKey: string) {
  return usePersistedState(`top25tracker:weightByRank:${storageKey}`, false);
}
