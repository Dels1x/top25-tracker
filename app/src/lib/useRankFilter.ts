import { usePersistedState } from "./usePersistedState";

export const RANK_FILTER_OPTIONS = [1, 3, 5, 10, 25] as const;

/**
 * Selection state for the Leaderboard's Top 1/3/5/10/25 buttons - persisted
 * per person (key includes person, same convention as useGenreFilter and
 * the range picker's storageKey) since it's a per-tab-per-person UI
 * preference, not something that should bleed across people. Defaults to
 * 25 (the full top 25, i.e. unfiltered) to match today's behavior.
 */
export function useRankFilter(storageKey: string) {
  return usePersistedState(`top25tracker:rankFilter:${storageKey}`, 25);
}
