import styles from "./ModeSwitch.module.css";

interface ModeSwitchProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  "aria-label": string;
}

/**
 * The pill-shaped "Artists / Genres" mode switch - originally built for
 * Compare, now shared by Leaderboard and Timeline too (same visual language
 * for "one view, two parallel modes" rather than two separate tabs). A true
 * `role="tablist"` radio-like control: exactly one option active at a time.
 */
export function ModeSwitch<T extends string>({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
}: ModeSwitchProps<T>) {
  return (
    <div className={styles.modeSwitch} role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={styles.modeButton}
          data-active={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
