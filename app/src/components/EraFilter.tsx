import genreFilterStyles from "./GenreFilter.module.css";

interface EraFilterProps {
  label: string;
  buckets: string[];
  selected: Set<string>;
  onToggle: (bucket: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

/**
 * A flat checkbox list of release-year/decade buckets - the All Songs tab's
 * year/decade filter. Deliberately NOT GenreFilter's recursive tree (a
 * release year/decade has no hierarchy the way a genre does - "2016" isn't a
 * parent or child of any other year), so this is a plain single-level grid
 * rather than reusing GenreNodeRow. Still imports GenreFilter.module.css
 * directly for the visual shell (`.wrap`/`.headRow`/`.label`/`.bulkActions`/
 * `.bulkButton`/`.grid`/`.checkboxLabel`/`.checkbox`) rather than duplicating
 * that CSS, same "borrow the module instead of copying it" precedent
 * AllSongs.tsx already set by reusing Leaderboard.module.css's song-row
 * grid - there's no genuinely different layout need here, just a different
 * bucket list and no nesting.
 */
export function EraFilter({ label, buckets, selected, onToggle, onSelectAll, onSelectNone }: EraFilterProps) {
  return (
    <div className={genreFilterStyles.wrap}>
      <div className={genreFilterStyles.headRow}>
        <span className={genreFilterStyles.label}>{label}</span>
        <div className={genreFilterStyles.bulkActions}>
          <button type="button" className={genreFilterStyles.bulkButton} onClick={onSelectAll}>
            Select all
          </button>
          <button type="button" className={genreFilterStyles.bulkButton} onClick={onSelectNone}>
            Select none
          </button>
        </div>
      </div>

      <div className={genreFilterStyles.grid}>
        {buckets.map((bucket) => (
          <div key={bucket} className={genreFilterStyles.item}>
            <div className={genreFilterStyles.row}>
              <span className={genreFilterStyles.disclosureSpacer} />
              <label className={genreFilterStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={genreFilterStyles.checkbox}
                  checked={selected.has(bucket)}
                  onChange={() => onToggle(bucket)}
                />
                <span>{bucket}</span>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
