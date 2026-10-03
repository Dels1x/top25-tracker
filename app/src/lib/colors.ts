/**
 * Categorical series colors, in fixed order. Per the dataviz color rule,
 * color must follow the ENTITY (the artist), never the entity's rank in a
 * filtered/sorted list - so we assign each artist a color once, the first
 * time we see them, and never reassign it when the visible set changes
 * (e.g. toggling other artists on/off).
 */
const SERIES_VARS = [
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-4",
  "--series-5",
  "--series-6",
  "--series-7",
  "--series-8",
] as const;

/** Beyond the 8 fixed slots, additional artists fall back to this muted neutral. */
const OVERFLOW_COLOR = "--text-muted";

export function cssVar(name: string): string {
  return `var(${name})`;
}

/**
 * Builds a stable artist -> CSS color variable map. `orderedArtists` should
 * be a stable ordering (e.g. by all-time total descending) so the same
 * artist gets the same slot across renders as long as the ordering itself
 * doesn't change dramatically.
 */
export function buildArtistColorMap(orderedArtists: string[]): Map<string, string> {
  const map = new Map<string, string>();
  orderedArtists.forEach((artist, index) => {
    const slot = SERIES_VARS[index];
    map.set(artist, cssVar(slot ?? OVERFLOW_COLOR));
  });
  return map;
}
