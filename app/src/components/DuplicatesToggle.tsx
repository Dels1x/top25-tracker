import styles from "./DuplicatesToggle.module.css";

interface DuplicatesToggleProps {
  includeDuplicates: boolean;
  onChange: (value: boolean) => void;
}

/**
 * Checkbox controlling whether a song that shows up in more than one
 * month's top 25 counts once per occurrence (checked) or just once overall,
 * toward the first month it appeared in (unchecked). Affects every
 * artist-scoring stat/chart; the Replay view is unaffected since it always
 * shows each month's literal list.
 */
export function DuplicatesToggle({ includeDuplicates, onChange }: DuplicatesToggleProps) {
  return (
    <label className={styles.label}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={includeDuplicates}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>Count repeat songs every time they appear</span>
    </label>
  );
}
