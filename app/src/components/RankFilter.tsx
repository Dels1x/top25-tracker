import { RANK_FILTER_OPTIONS } from "../lib/useRankFilter";
import styles from "./RankFilter.module.css";

interface RankFilterProps {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Segmented "Top 1/3/5/10/25" control for the Leaderboard - acts like a
 * radio group (exactly one selected at a time, 25 = everyone, no filter)
 * rather than a checkbox group. Mirrors Compare's mode switch look
 * (Compare.module.css's .modeSwitch/.modeButton) since both are "exactly
 * one of a small fixed set" pickers, just with 5 options instead of 2.
 *
 * `value` of 25 is the full top 25 (StatsOptions.maxRank should be left
 * undefined/omitted in that case, same as "no filter" elsewhere in the
 * app) - see useRankFilter (lib/useRankFilter.ts) for the persisted
 * selection state, and Leaderboard.tsx for how it's translated into
 * StatsOptions.maxRank.
 */
export function RankFilter({ value, onChange }: RankFilterProps) {
  return (
    <div className={styles.wrap} role="radiogroup" aria-label="Limit to top N per month">
      {RANK_FILTER_OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={styles.button}
          data-active={value === n}
          onClick={() => onChange(n)}
        >
          Top {n}
        </button>
      ))}
    </div>
  );
}
