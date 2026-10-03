import { useMemo } from "react";
import { usePersistedState } from "./usePersistedState";
import type { StatsOptions } from "./stats";

export const RANGE_PRESETS = [
  { label: "All time", months: null },
  { label: "Last 6 months", months: 6 },
  { label: "Last 12 months", months: 12 },
  { label: "Last 24 months", months: 24 },
] as const;

/**
 * Shared month-range selection state, used by both the Leaderboard and
 * Timeline tabs so picking a range behaves identically (and independently)
 * in each. `storageKey` should be unique per tab+person (e.g.
 * "timeline:delsix" / "leaderboard:delsix") so each tab remembers its own
 * range per person rather than sharing one.
 */
export function useMonthRange(availableMonths: string[], storageKey: string) {
  const lastIndex = Math.max(availableMonths.length - 1, 0);

  // Persisted as actual month strings (stable even if the number of
  // available months changes between sessions); the slider/preset UI
  // operates on indices into availableMonths, converted both ways below.
  const [startMonth, setStartMonth] = usePersistedState(
    `top25tracker:rangeStart:${storageKey}`,
    availableMonths[0] ?? ""
  );
  const [endMonth, setEndMonth] = usePersistedState(
    `top25tracker:rangeEnd:${storageKey}`,
    availableMonths[lastIndex] ?? ""
  );

  const startIndex = Math.max(availableMonths.indexOf(startMonth), 0);
  const endIndexRaw = availableMonths.indexOf(endMonth);
  const endIndex = endIndexRaw === -1 ? lastIndex : endIndexRaw;

  const isFullRange = startIndex === 0 && endIndex === lastIndex;

  const rangeOptions = useMemo<StatsOptions>(
    () => ({
      startMonth: isFullRange ? undefined : availableMonths[startIndex],
      endMonth: isFullRange ? undefined : availableMonths[endIndex],
    }),
    [isFullRange, availableMonths, startIndex, endIndex]
  );

  function handleSliderChange(newStartIndex: number, newEndIndex: number) {
    setStartMonth(availableMonths[newStartIndex]);
    setEndMonth(availableMonths[newEndIndex]);
  }

  function applyPreset(monthsBack: number | null) {
    if (monthsBack === null) {
      setStartMonth(availableMonths[0]);
    } else {
      setStartMonth(availableMonths[Math.max(lastIndex - monthsBack + 1, 0)]);
    }
    setEndMonth(availableMonths[lastIndex]);
  }

  return {
    startIndex,
    endIndex,
    lastIndex,
    rangeOptions,
    handleSliderChange,
    applyPreset,
  };
}
