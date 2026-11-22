import { useMemo, useState } from "react";
import compareStyles from "./Compare.module.css";

interface ArtistOption {
  name: string;
  count: number;
}

interface ArtistFilterProps {
  options: ArtistOption[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onClear: () => void;
}

const MATCH_LIMIT = 40;

/**
 * Searchable multi-select checklist for filtering All Songs down to one or
 * more credited artists - same search-box/checklist/removable-chips pattern
 * Compare's own artist picker already established (there can be hundreds of
 * artists, so a plain always-visible checkbox grid like GenreFilter's ~19
 * genres isn't workable here), reusing Compare.module.css directly rather
 * than duplicating that CSS.
 *
 * Unlike the genre filter's convention (an empty Set means "show nobody"),
 * an empty `selected` here means "no artist filter" (show everyone) - the
 * natural reading for a search-to-narrow picker where nothing has been
 * explicitly chosen yet, and it lets this filter start truly inert rather
 * than needing every artist pre-selected by default. AllSongs.tsx is the
 * one that interprets `selected.size === 0` as "don't filter" when building
 * its options for allTracks.
 */
export function ArtistFilter({ options, selected, onToggle, onClear }: ArtistFilterProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, MATCH_LIMIT);
    return options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, MATCH_LIMIT);
  }, [options, query]);

  const selectedNames = useMemo(() => options.filter((o) => selected.has(o.name)), [options, selected]);

  return (
    <div className={compareStyles.picker}>
      <div className={compareStyles.searchRow}>
        <input
          type="text"
          className={compareStyles.search}
          placeholder="Search artists to filter by..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        <button
          type="button"
          className={compareStyles.toggleButton}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Hide list" : "Browse list"}
        </button>
        {selectedNames.length > 0 && (
          <button type="button" className={compareStyles.toggleButton} onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      {open && (
        <ul className={compareStyles.optionList}>
          {matches.length === 0 && <li className={compareStyles.noMatches}>No matching artists.</li>}
          {matches.map((o) => (
            <li key={o.name}>
              <label className={compareStyles.optionLabel}>
                <input
                  type="checkbox"
                  className={compareStyles.checkbox}
                  checked={selected.has(o.name)}
                  onChange={() => onToggle(o.name)}
                />
                <span className={compareStyles.optionName}>{o.name}</span>
                <span className={compareStyles.optionCount}>{o.count}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {selectedNames.length > 0 && (
        <div className={compareStyles.chips}>
          {selectedNames.map((o) => (
            <button
              key={o.name}
              type="button"
              className={compareStyles.chip}
              onClick={() => onToggle(o.name)}
              title="Remove"
            >
              {o.name}
              <span className={compareStyles.chipX} aria-hidden="true">
                ×
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
