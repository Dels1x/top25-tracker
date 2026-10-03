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

  // Sparse tick labels - every month would overlap at 50+ entries. Always
  // include the first and last so the span's edges are legible.
  const tickIndices = useMemo(() => {
    if (months.length === 0) return [];
    const targetTicks = 6;
    const step = Math.max(1, Math.ceil(months.length / targetTicks));
    const ticks = new Set<number>();
    for (let i = 0; i < months.length; i += step) ticks.add(i);
    ticks.add(months.length - 1);
    return Array.from(ticks).sort((a, b) => a - b);
  }, [months.length]);

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
