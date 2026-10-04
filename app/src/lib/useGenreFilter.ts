import { useMemo } from "react";
import { GENRE_HIERARCHY, GENRES, UNTAGGED_GENRE } from "./artistGenres";
import { usePersistedSetState } from "./usePersistedState";

const ALL_TOP_LEVEL = [...GENRES, UNTAGGED_GENRE];

/**
 * Selection state for the Leaderboard's genre filter checkboxes. Persisted
 * per person (key includes person) since each person's relevant genres
 * could differ. Starts with EVERY genre (including Unknown/Untagged)
 * selected - no filtering, matches today's unfiltered leaderboard - rather
 * than empty.
 *
 * Checking/unchecking a top-level genre cascades to all of its subgenres
 * (check parent -> check every child; uncheck parent -> uncheck every
 * child) - per the user's spec. A subgenre can still be toggled
 * independently of its siblings once the parent is checked.
 */
export function useGenreFilter(storageKey: string) {
  const [selected, setSelected] = usePersistedSetState(
    `top25tracker:genreFilter:${storageKey}`,
    () => ALL_TOP_LEVEL
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { genre, subgenres } of GENRE_HIERARCHY) {
      map.set(genre, subgenres);
    }
    return map;
  }, []);

  function toggleTopLevel(genre: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const children = childrenByParent.get(genre) ?? [];
      const turningOn = !next.has(genre);
      if (turningOn) {
        next.add(genre);
        for (const c of children) next.add(c);
      } else {
        next.delete(genre);
        for (const c of children) next.delete(c);
      }
      return next;
    });
  }

  function toggleSubgenre(genre: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(ALL_TOP_LEVEL));
  }

  function selectNone() {
    setSelected(new Set());
  }

  return { selected, toggleTopLevel, toggleSubgenre, selectAll, selectNone };
}
