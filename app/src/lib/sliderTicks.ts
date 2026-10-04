/**
 * Sparse, calendar-meaningful tick positions for a slider over a discrete
 * list of months ("YYYY-MM", ascending) - shared by MonthRangeSlider and
 * ReplayScrubber so both render the same "mark every January (or every
 * January+July if that's too sparse), plus the true first/last month"
 * behavior rather than two copies that could drift. An even stride through
 * the array ignores what calendar month the data happens to start on and
 * produces an arbitrary, inconsistent-looking sequence like
 * "Jul 22, Apr 23, Jan 24, Oct 24, ..." - snapping to year (or half-year)
 * boundaries instead reads as actual calendar markers.
 */
export function sliderTickIndices(months: string[], targetMax = 8): number[] {
  if (months.length === 0) return [];

  const isJanuary = (month: string) => month.endsWith("-01");
  const isJanOrJuly = (month: string) => month.endsWith("-01") || month.endsWith("-07");

  const yearlyCount = months.filter(isJanuary).length;
  // Prefer yearly ticks; fall back to half-yearly only if a full year span
  // would be too sparse (e.g. under ~2 years of data) to be useful alone.
  const matchesBoundary = yearlyCount >= 3 ? isJanuary : isJanOrJuly;

  const ticks = new Set<number>();
  months.forEach((month, i) => {
    if (matchesBoundary(month)) ticks.add(i);
  });
  ticks.add(0);
  ticks.add(months.length - 1);

  let result = Array.from(ticks).sort((a, b) => a - b);
  // If boundary ticks are still too dense for the available width (lots of
  // years of data), thin them out evenly rather than switching strategy.
  if (result.length > targetMax) {
    const keepStep = Math.ceil(result.length / targetMax);
    const thinned = result.filter((_, idx) => idx % keepStep === 0);
    const lastKept = thinned[thinned.length - 1];
    const lastOverall = result[result.length - 1];
    const prevKept = thinned[thinned.length - 2] ?? 0;
    // Keep the true final edge too, but only as a separate tick if it's at
    // least half the regular inter-tick spacing away from the last thinned
    // one - otherwise they'd render on top of each other. Close enough:
    // just replace the last thinned tick with the true edge instead.
    const regularSpacing = lastKept - prevKept;
    result =
      lastOverall - lastKept >= regularSpacing / 2
        ? [...thinned, lastOverall]
        : [...thinned.slice(0, -1), lastOverall];
  }
  return result;
}
