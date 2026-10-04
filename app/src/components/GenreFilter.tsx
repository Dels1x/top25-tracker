import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GENRE_HIERARCHY } from "../lib/artistGenres";
import styles from "./GenreFilter.module.css";

interface GenreFilterProps {
  selected: Set<string>;
  onToggleTopLevel: (genre: string) => void;
  onToggleSubgenre: (genre: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

/**
 * Checkbox filter for the Leaderboard: one row per top-level genre, each
 * with a disclosure arrow (only shown if it has subgenres) that expands a
 * list of child checkboxes underneath. Checking/unchecking the top-level
 * box cascades to its children (see useGenreFilter); a subgenre can still
 * be toggled on its own once its parent is checked.
 */
export function GenreFilter({
  selected,
  onToggleTopLevel,
  onToggleSubgenre,
  onSelectAll,
  onSelectNone,
}: GenreFilterProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(genre: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <span className={styles.label}>Filter by genre</span>
        <div className={styles.bulkActions}>
          <button type="button" className={styles.bulkButton} onClick={onSelectAll}>
            Select all
          </button>
          <button type="button" className={styles.bulkButton} onClick={onSelectNone}>
            Select none
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {GENRE_HIERARCHY.map(({ genre, subgenres }) => {
          const isOpen = expanded.has(genre);
          const hasChildren = subgenres.length > 0;
          return (
            <div key={genre} className={styles.item}>
              <div className={styles.row}>
                {hasChildren ? (
                  <button
                    type="button"
                    className={styles.disclosure}
                    onClick={() => toggleExpanded(genre)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${genre} subgenres`}
                  >
                    <span className={styles.disclosureArrow} data-open={isOpen}>
                      ▾
                    </span>
                  </button>
                ) : (
                  <span className={styles.disclosureSpacer} />
                )}
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selected.has(genre)}
                    onChange={() => onToggleTopLevel(genre)}
                  />
                  <span>{genre}</span>
                </label>
              </div>

              {hasChildren && (
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className={styles.subgenreWrap}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <div className={styles.subgenreList}>
                        {subgenres.map((sub) => (
                          <label key={sub} className={styles.subCheckboxLabel}>
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={selected.has(sub)}
                              onChange={() => onToggleSubgenre(sub)}
                            />
                            <span>{sub}</span>
                          </label>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
