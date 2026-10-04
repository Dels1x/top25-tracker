import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GENRE_HIERARCHY, type GenreNode } from "../lib/artistGenres";
import styles from "./GenreFilter.module.css";

interface GenreFilterProps {
  selected: Set<string>;
  onToggle: (genre: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

/**
 * Checkbox filter for the Leaderboard: one row per top-level genre, each
 * with a disclosure arrow (only shown if it has subgenres) that expands a
 * list of child rows underneath. A child row can itself have its own
 * disclosure arrow and children (GENRE_HIERARCHY nests to whatever depth
 * PARENT_GENRE implies, e.g. Rock > Punk > {Pop Punk, Post-Punk}), so this
 * renders recursively via GenreNodeRow rather than assuming exactly two
 * levels. Checking/unchecking any node cascades to its whole descendant
 * subtree (see useGenreFilter); a node can still be toggled independently
 * of its ancestors/siblings once they're checked.
 */
export function GenreFilter({ selected, onToggle, onSelectAll, onSelectNone }: GenreFilterProps) {
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
        {GENRE_HIERARCHY.map((node) => (
          <GenreNodeRow
            key={node.genre}
            node={node}
            depth={0}
            selected={selected}
            expanded={expanded}
            onToggle={onToggle}
            onToggleExpanded={toggleExpanded}
          />
        ))}
      </div>
    </div>
  );
}

interface GenreNodeRowProps {
  node: GenreNode;
  depth: number;
  selected: Set<string>;
  expanded: Set<string>;
  onToggle: (genre: string) => void;
  onToggleExpanded: (genre: string) => void;
}

/** One row (at any depth) plus its own expandable children, recursively. */
function GenreNodeRow({ node, depth, selected, expanded, onToggle, onToggleExpanded }: GenreNodeRowProps) {
  const { genre, subgenres } = node;
  const isOpen = expanded.has(genre);
  const hasChildren = subgenres.length > 0;

  return (
    <div className={styles.item}>
      <div className={styles.row}>
        {hasChildren ? (
          <button
            type="button"
            className={styles.disclosure}
            onClick={() => onToggleExpanded(genre)}
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
        <label className={depth === 0 ? styles.checkboxLabel : styles.subCheckboxLabel}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={selected.has(genre)}
            onChange={() => onToggle(genre)}
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
                {subgenres.map((child) => (
                  <GenreNodeRow
                    key={child.genre}
                    node={child}
                    depth={depth + 1}
                    selected={selected}
                    expanded={expanded}
                    onToggle={onToggle}
                    onToggleExpanded={onToggleExpanded}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
