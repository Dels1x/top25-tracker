import { useMemo } from "react";
import { GENRE_HIERARCHY, GENRES, UNTAGGED_GENRE, type GenreNode } from "./artistGenres";
import { usePersistedSetState } from "./usePersistedState";

const ALL_TOP_LEVEL = [...GENRES, UNTAGGED_GENRE];

/**
 * Selection state for the Leaderboard's genre filter checkboxes. Persisted
 * per person (key includes person) since each person's relevant genres
 * could differ. Starts with EVERY genre (including Unknown/Untagged)
 * selected - no filtering, matches today's unfiltered leaderboard - rather
 * than empty.
 *
 * Checking/unchecking ANY node (top-level genre or a subgenre at any depth)
 * cascades to its ENTIRE descendant subtree, however deep it goes - check
 * "Rock" -> also checks "Punk" and, through it, "Pop Punk"/"Post-Punk" too;
 * check "Punk" on its own -> checks its own children without touching
 * "Rock" or "Rock"'s other subgenres. A node can still be toggled
 * independently of its siblings/parent once the ancestor chain above it is
 * checked - unchecking just "Pop Punk" doesn't touch "Punk" or "Rock".
 */
export function useGenreFilter(storageKey: string) {
  const [selected, setSelected] = usePersistedSetState(
    `top25tracker:genreFilter:${storageKey}`,
    () => ALL_TOP_LEVEL
  );

  // Every genre's FULL (transitive) descendant list, not just its direct
  // children - so toggling "Rock" cascades through "Punk" down to
  // "Pop Punk"/"Post-Punk" too, however many levels deep the tree goes.
  const descendantsByGenre = useMemo(() => {
    const map = new Map<string, string[]>();
    function walk(node: GenreNode): string[] {
      const childLists = node.subgenres.map(walk);
      const all = node.subgenres.map((c) => c.genre).concat(...childLists);
      map.set(node.genre, all);
      return all;
    }
    for (const node of GENRE_HIERARCHY) walk(node);
    return map;
  }, []);

  /** Toggle any node (top-level or nested at any depth) - cascades to its whole subtree. */
  function toggleNode(genre: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const descendants = descendantsByGenre.get(genre) ?? [];
      const turningOn = !next.has(genre);
      if (turningOn) {
        next.add(genre);
        for (const d of descendants) next.add(d);
      } else {
        next.delete(genre);
        for (const d of descendants) next.delete(d);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(ALL_TOP_LEVEL));
  }

  function selectNone() {
    setSelected(new Set());
  }

  return { selected, toggleNode, selectAll, selectNone };
}
