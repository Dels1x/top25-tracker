import { useMemo } from "react";
import styles from "./MonthRangeSlider.module.css";

interface MonthRangeSliderProps {
  /** All months available to pick from, sorted ascending ("YYYY-MM"). */
  months: string[];
  /** Index into `months` for each handle (inclusive range). */
  startIndex: number;
  endIndex: number;
  onChange: (startIndex: number, endIndex: number) => void;
}

function formatTick(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

/**
 * A dual-handle range slider over a discrete list of months - two overlapping
 * native range inputs sharing one visual track (each one's own thumb stays
 * independently draggable/keyboard-operable; CSS hides each input's own
 * track so only the shared one underneath shows). Operates on INDICES into
 * `months` rather than the month strings themselves, since months are a
 * sparse, evenly-spaced set rather than a continuous numeric range.
 */
export function MonthRangeSlider({
  months,
  startIndex,
  endIndex,
  onChange,
}: MonthRangeSliderProps) {
  const max = Math.max(months.length - 1, 0);

  // Sparse tick labels - every month would overlap at 50+ entries. Snap to
  // calendar-meaningful boundaries (January of each year, or also July when
  // that's not sparse enough) rather than an even stride through the array -
  // a stride ignores what calendar month the data happens to start on and
  // produces an arbitrary, inconsistent-looking sequence like "Jul 22, Apr
  // 23, Jan 24, Oct 24, ...". Always keep the first and last month too, so
  // the span's actual edges stay legible even if they don't land on a
  // boundary.
  const tickIndices = useMemo(() => {
    if (months.length === 0) return [];

    const isJanuary = (month: string) => month.endsWith("-01");
    const isJanOrJuly = (month: string) => month.endsWith("-01") || month.endsWith("-07");

    const yearlyCount = months.filter(isJanuary).length;
    const targetMax = 8;
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
  }, [months]);

  if (months.length === 0) return null;

  const startPct = (startIndex / max) * 100;
  const endPct = (endIndex / max) * 100;

  function handleStartChange(next: number) {
    onChange(Math.min(next, endIndex), endIndex);
  }

  function handleEndChange(next: number) {
    onChange(startIndex, Math.max(next, startIndex));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.track}>
        <div
          className={styles.selectedRange}
          style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
        />
        <input
          type="range"
          className={styles.thumb}
          min={0}
          max={max}
          step={1}
          value={startIndex}
          onChange={(e) => handleStartChange(Number(e.target.value))}
          aria-label="Range start month"
        />
        <input
          type="range"
          className={styles.thumb}
          min={0}
          max={max}
          step={1}
          value={endIndex}
          onChange={(e) => handleEndChange(Number(e.target.value))}
          aria-label="Range end month"
        />
      </div>

      <div className={styles.ticks}>
        {tickIndices.map((i) => (
          <span
            key={i}
            className={styles.tick}
            style={{ left: `${(i / max) * 100}%` }}
          >
            {formatTick(months[i])}
          </span>
        ))}
      </div>
    </div>
  );
}
