import { RANGE_PRESETS } from "../lib/useMonthRange";
import { MonthRangeSlider } from "./MonthRangeSlider";
import styles from "./RangePicker.module.css";

interface RangePickerProps {
  months: string[];
  startIndex: number;
  endIndex: number;
  lastIndex: number;
  /** Distinct calendar years present in this person's data (see useMonthRange) - renders one button per year, e.g. hryash only ever gets 2024/2025/2026, never 2022/2023. */
  availableYears: string[];
  onSliderChange: (startIndex: number, endIndex: number) => void;
  onPreset: (monthsBack: number | null) => void;
  onYear: (year: string) => void;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

/** The date-range control shared by Leaderboard and Timeline: a live label,
 * quick presets, and the drag slider underneath. */
export function RangePicker({
  months,
  startIndex,
  endIndex,
  lastIndex,
  availableYears,
  onSliderChange,
  onPreset,
  onYear,
}: RangePickerProps) {
  if (months.length === 0) return null;

  return (
    <div className={styles.rangeRow}>
      <div className={styles.rangeHeadRow}>
        <span className={styles.rangeLabel}>
          {formatMonth(months[startIndex] ?? "")} &rarr;{" "}
          {endIndex === lastIndex ? "now" : formatMonth(months[endIndex] ?? "")}
        </span>
        <div className={styles.presets}>
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={styles.presetButton}
              onClick={() => onPreset(preset.months)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {availableYears.length > 0 && (
        <div className={styles.years}>
          {availableYears.map((year) => (
            <button
              key={year}
              type="button"
              className={styles.yearButton}
              onClick={() => onYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      <MonthRangeSlider
        months={months}
        startIndex={startIndex}
        endIndex={endIndex}
        onChange={onSliderChange}
      />
    </div>
  );
}
