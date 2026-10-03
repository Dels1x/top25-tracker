import styles from "./ToggleCheckbox.module.css";

interface ToggleCheckboxProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

/** A labeled checkbox for a global scoring-option toggle (shown above the active view). */
export function ToggleCheckbox({ checked, onChange, label }: ToggleCheckboxProps) {
  return (
    <label className={styles.label}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
